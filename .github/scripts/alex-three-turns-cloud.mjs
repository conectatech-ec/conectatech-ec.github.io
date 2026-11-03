// Actual owner simulator in Chromium. Six normal UI sends, never Meta or customer events.
// No packages or paid APIs: use the runner's installed Chrome and Node's native CDP WebSocket.
import {spawn} from 'node:child_process';
import {access,mkdtemp,mkdir,writeFile,rm,appendFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import central from '../../automatizacion/central/current.json' with {type:'json'};
import enrichment from '../../automatizacion/central/enrichment.json' with {type:'json'};
import library from '../../automatizacion/marketplace-library.json' with {type:'json'};
import policy from '../../automatizacion/alex-policy.json' with {type:'json'};
import attestations from '../../automatizacion/central/source-attestations.json' with {type:'json'};
import signatureRelease from '../../automatizacion/alex-signature-release.json' with {type:'json'};
import {readSharedHub} from '../../automatizacion/shared-hub.mjs';

const BASE='https://conectatech-comercial-piloto.conectatech-ecu.workers.dev',PUBLIC='https://conectatech-ec.github.io';
const QUESTIONS=['Busco un Samsung A17','¿Cuánto cuesta con tarjeta?','Muéstrame una imagen y compárame las versiones'];
const SIGNATURE_ONLY=process.env.ALEX_SIGNATURE_ONLY==='true',MEDIA_ONLY=!SIGNATURE_ONLY&&process.env.ALEX_MEDIA_ONLY==='true',MAX_MESSAGES=SIGNATURE_ONLY?8:MEDIA_ONLY?2:6;
const MEDIA_CASES={COL001:{sku:'TELF012',question:'Muéstrame una imagen del Samsung A17 de 256 GB',expected:'pending_exact_variant_photo'},COL002:{sku:'REL046',question:'Muéstrame una imagen del Infinix XWATCH H4',expected:'approved_photo_rendered'}};
const PRIVATE_RELEASE=signatureRelease.schema==='conectatech.alex.signature.private.v1'&&signatureRelease.scope==='private_simulator'&&signatureRelease.owner_approved===true&&signatureRelease.external_delivery_allowed===false&&signatureRelease.public_image_publication_allowed===false;
const DIR='automatizacion/generated/fase2',token=process.env.PILOT_TOKEN;
const report={schema:'conectatech.alex.three-turns.browser.v1',at:new Date().toISOString(),passed:false,
 scope:'authenticated_owner_actual_simulator_browser',browser:'installed_Chromium_native_CDP',media_only:MEDIA_ONLY,signature_only:SIGNATURE_ONLY,normal_UI_messages:0,maximum_normal_UI_messages:MAX_MESSAGES,
 Graph_sends:0,customer_events:0,external_customers_enabled:false,worker_deployed:false,new_paid_services:0,
 branch_revision:process.env.GITHUB_SHA||null,baseline_probe:process.env.ALEX_BASELINE_PROBE==='true',profiles:[],checks:{},signature:{released:false},failures:[]};
let stage='setup',chrome,profileDir,cdp,session,hub,healthBefore,quotaBefore,presentation;
const pending=new Map(),assets=new Map();let nextId=0;
const safe=text=>String(text||'').replaceAll(token||'__NO_TOKEN__','[secret omitted]').replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[correo omitido]');
function check(ok,code){if(!ok){const e=new Error(code);e.probeCode=code;throw e;}}
function requireCheck(ok,code,detail={}){if(!ok)report.failures.push({stage,code,...detail});return !!ok;}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function json(url,privateRequest=false){const r=await fetch(url,{headers:privateRequest?{Authorization:'Bearer '+token}:{Accept:'application/json'},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000)});check(r.status===200,'HTTP_200_REQUIRED');const t=await r.text();check(t.length<=2_000_000,'JSON_SIZE_LIMIT');return JSON.parse(t);}
function command(method,params={},scoped=true){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(Object.assign(new Error('CDP_TIMEOUT'),{probeCode:'BROWSER_COMMAND_TIMEOUT'}));},70000);pending.set(id,{resolve,reject,timer});cdp.send(JSON.stringify({id,method,params,...(scoped?{sessionId:session}:{})}));});}
async function evaluate(expression){const d=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});check(!d.exceptionDetails,'BROWSER_EVALUATION_FAILED');return d.result?.value;}
async function until(expression,timeout=70000){const start=Date.now();while(Date.now()-start<timeout){const value=await evaluate(expression);if(value)return value;await sleep(150);}throw Object.assign(new Error('BROWSER_WAIT_FAILED'),{probeCode:'BROWSER_WAIT_FAILED'});}
async function launch(){
 let binary;for(const path of [process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean)){try{await access(path);binary=path;break;}catch{}}
 check(binary,'INSTALLED_CHROME_REQUIRED');profileDir=await mkdtemp(join(tmpdir(),'alex-three-turns-'));
 chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--window-size=1280,1000','--user-data-dir='+profileDir,'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{let buffer='';const timer=setTimeout(()=>reject(Object.assign(new Error('CHROME_START_FAILED'),{probeCode:'CHROME_START_FAILED'})),20000);chrome.on('error',()=>{clearTimeout(timer);reject(Object.assign(new Error('CHROME_START_FAILED'),{probeCode:'CHROME_START_FAILED'}));});chrome.stderr.on('data',bytes=>{buffer=(buffer+bytes.toString()).slice(-10000);const m=buffer.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 cdp=new WebSocket(endpoint);await new Promise((resolve,reject)=>{cdp.onopen=resolve;cdp.onerror=()=>reject(Object.assign(new Error('CDP_CONNECT_FAILED'),{probeCode:'CDP_CONNECT_FAILED'}));});
 cdp.onmessage=e=>{const d=JSON.parse(String(e.data));if(!d.id)return;const p=pending.get(d.id);if(!p)return;clearTimeout(p.timer);pending.delete(d.id);if(d.error)p.reject(Object.assign(new Error('CDP_PROTOCOL_FAILED'),{probeCode:'CDP_PROTOCOL_FAILED'}));else p.resolve(d.result);};
 const target=await command('Target.createTarget',{url:'about:blank'},false);session=(await command('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
 await command('Page.enable');await command('Runtime.enable');await command('Page.navigate',{url:BASE+'/alex'});
 await until("document.readyState==='complete'&&!!document.getElementById('connect')");
 // Observe only response JSON and non-secret routing fields; never headers or credentials.
 await evaluate(`(()=>{window.__alexProbeReplies=[];const original=window.fetch.bind(window);window.fetch=async(...args)=>{const response=await original(...args);if(new URL(typeof args[0]==='string'?args[0]:args[0].url,location.href).pathname==='/alex/chat'){const b=JSON.parse(args[1]?.body||'{}');response.clone().json().then(body=>window.__alexProbeReplies.push({status:response.status,collaborator:b.collaborator_id,session:b.session_id,catalog_only:b.catalog_only===true,body}));}return response;};return true;})()`);
 await evaluate(`(()=>{document.getElementById('key').value=${JSON.stringify(token)};document.getElementById('connect').click();return true;})()`);
 await until("!document.getElementById('message').disabled&&document.getElementById('collaborator').options.length===2");
 check(await evaluate("document.getElementById('key').value===''")===true,'KEY_NOT_CLEARED');
}
function photoFor(sku){const view=presentation?.products?.[sku]?.approved_media;if(view?.url&&view.sha256)return view;const p=central.products.find(p=>p.sku===sku),e=enrichment.products?.[sku];return p&&e&&e.source_name===p.source_name&&JSON.stringify(e.variant_gb)===JSON.stringify(p.variant_gb)&&e.photo_url&&e.photo_sha256?{url:e.photo_url,sha256:e.photo_sha256}:null;}
async function verifyImage(image,answer){
 const u=new URL(image.url);check(u.protocol==='https:'&&!u.search&&!u.hash&&!u.username&&!u.password,'IMAGE_PUBLIC_ORIGIN');
 const known=MEDIA_ONLY||SIGNATURE_ONLY?['TELF011','TELF012','REL046']:['TELF011','TELF012'];check(known.includes(image.sku),'IMAGE_WRONG_SKU');let expected,privateSignature=false;
 const release=signatureRelease.products?.[image.sku];
 if(image.kind==='approved_banner'&&image.private_scope===true){
  const pinned=u.pathname.match(/^\/alex\/signature\/(TELF011|TELF012|REL046)\/([a-f0-9]{64})\.png$/);
  check(PRIVATE_RELEASE&&u.origin===BASE&&image.signature_verified===true&&image.scope==='private_simulator'&&release?.owner_approved===true&&release.approved_scope==='private_simulator'&&pinned&&pinned[1]===image.sku&&pinned[2]===release.sha256&&image.sha256===release.sha256,'PRIVATE_SIGNATURE_OWNER_APPROVAL_REQUIRED');
  const product=hub.products.find(p=>p.sku===image.sku);check(product?.prices&&release.promo_cash_cents===product.prices.promo_cash_cents&&release.pvp_card_cents===product.prices.pvp_card_cents,'SIGNATURE_CURRENT_PRICES_MISMATCH');
  check(Number.isSafeInteger(release.bytes_count)&&release.bytes_count>8&&release.bytes_count<=8*1024*1024,'SIGNATURE_SIZE_METADATA_REQUIRED');
  expected={url:release.url,sha256:release.sha256,bytes_count:release.bytes_count};privateSignature=true;
 }else{
 check(u.origin===PUBLIC,'IMAGE_PUBLIC_ORIGIN');
 if(image.kind==='approved_photo')expected=photoFor(image.sku);
 else {const e=library.products?.[image.sku];check(image.kind==='approved_banner'&&library.live_registry_connection_verified===true&&library.no_send_to_buyers===false&&library.messaging_enabled===true&&e?.visual_approved===true&&e.publication_verified===true&&e.delivery_allowed===true&&e.source_sha256===answer.source_sha256&&e.cut_date===answer.inventory_cut_date,'SIGNATURE_NOT_RELEASED');expected={url:e.banner_url,sha256:e.banner_sha256};}
 }
 check(expected?.url===u.href&&/^[a-f0-9]{64}$/.test(expected.sha256||''),'IMAGE_APPROVAL_MISMATCH');
 if(!assets.has(u.href)){
  let anonymousHTTP;
  if(privateSignature){const anonymous=await fetch(u.href,{redirect:'error',signal:AbortSignal.timeout(30000)});anonymousHTTP=anonymous.status;check([401,403,404].includes(anonymousHTTP),'PRIVATE_SIGNATURE_ANONYMOUS_ACCESS_NOT_BLOCKED');await anonymous.body?.cancel();}
  // Credentials are attached only after the exact same-origin private route,
  // SKU, hash, owner release and current prices have all been checked.
  const r=await fetch(u.href,{...(privateSignature?{headers:{Authorization:'Bearer '+token}}:{}),redirect:'error',signal:AbortSignal.timeout(30000)});
  check(r.status===200&&(privateSignature?/^image\/png(?:;|$)/i:/^image\//i).test(r.headers.get('content-type')||''),'IMAGE_HTTP_OR_MIME');
  const hash=createHash('sha256');let size=0,prefix=Buffer.alloc(0);
  for await(const bytes of r.body){size+=bytes.length;check(size<=8*1024*1024,'IMAGE_SIZE_LIMIT');hash.update(bytes);if(prefix.length<8)prefix=Buffer.concat([prefix,Buffer.from(bytes)]).subarray(0,8);}
  check(size>0&&hash.digest('hex')===expected.sha256,'IMAGE_SHA_MISMATCH');
  if(privateSignature){check(size===expected.bytes_count&&prefix.equals(Buffer.from([137,80,78,71,13,10,26,10])),'PRIVATE_SIGNATURE_PNG_OR_SIZE_MISMATCH');check(/no-store|private/i.test(r.headers.get('cache-control')||''),'PRIVATE_SIGNATURE_CACHE_POLICY_REQUIRED');}
  assets.set(u.href,{HTTP:200,...(privateSignature?{anonymous_HTTP:anonymousHTTP,PNG_magic_verified:true,bytes_count:size}: {})});
 }
 return {sku:image.sku,url:u.href,kind:image.kind,sha256:expected.sha256,...assets.get(u.href),approved_bytes_verified:true,signature_verified:privateSignature,private_scope:privateSignature,...(privateSignature?{scope:'private_simulator'}:{})};
}
async function send(message){
 check(report.normal_UI_messages<MAX_MESSAGES,'UI_SEND_LIMIT');report.normal_UI_messages++;
 const before=await evaluate('window.__alexProbeReplies.length'),beforeImages=await evaluate("document.querySelectorAll('#chat figure img').length");
 await evaluate(`(()=>{document.getElementById('message').value=${JSON.stringify(message)};document.getElementById('form').requestSubmit();return true;})()`);
 await until(`window.__alexProbeReplies.length>${before}&&!document.getElementById('message').disabled`);
 const reply=await evaluate(`window.__alexProbeReplies[${before}]`);check(reply.status===200,'CHAT_HTTP_NOT_200');
 await evaluate("(()=>{for(const image of document.querySelectorAll('#chat figure img'))image.loading='eager';const images=document.querySelectorAll('#chat figure img');images[images.length-1]?.scrollIntoView();return true;})()");
 const urls=(Array.isArray(reply.body.images)?reply.body.images:reply.body.image?[{url:reply.body.image}]:[]).map(x=>x.url);
 if(urls.length)try{await until(`${JSON.stringify(urls)}.every(url=>Array.from(document.querySelectorAll('#chat figure img')).slice(${beforeImages}).some(i=>(i.dataset.sourceUrl||i.currentSrc||i.src)===url&&i.complete&&i.naturalWidth>0&&i.naturalHeight>0))`,20000);}catch{/* Preserve diagnostics rather than claim a loaded image. */}
 reply.browser=await evaluate(`({before_images:${beforeImages},after_images:document.querySelectorAll('#chat figure img').length,rendered:Array.from(document.querySelectorAll('#chat figure img')).slice(${beforeImages}).filter(i=>${JSON.stringify(urls)}.includes(i.dataset.sourceUrl||i.currentSrc||i.src)).map(i=>({url:i.dataset.sourceUrl||i.currentSrc||i.src,private_blob:i.src.startsWith(${JSON.stringify('blob:'+BASE+'/')}),loaded:i.complete&&i.naturalWidth>0&&i.naturalHeight>0,width:i.naturalWidth,height:i.naturalHeight,caption:i.closest('figure')?.querySelector('figcaption')?.textContent||'',alt:i.alt})),error:document.getElementById('error').textContent,advisor:document.getElementById('advisor-title').textContent})`);
 return reply;
}
async function validate(reply,id,index){
 const a=reply.body,row={question:QUESTIONS[index],text:safe(a.text),HTTP:200,generative:a.generative===true,response_mode:a.response_mode,error_code:a.error_code||null,source_fresh:a.source_fresh===true,cut_date:a.inventory_cut_date,source_sha256:a.source_sha256,images:[],browser:{new_images:reply.browser.after_images-reply.browser.before_images,loaded_images:reply.browser.rendered.filter(i=>i.loaded).length},checks:{}};
 const detail={collaborator:id,turn:index+1};
 requireCheck(reply.collaborator===id&&a.collaborator?.id===id&&a.attribution?.collaborator_id===id&&a.attribution?.origin_verification==='operator_authenticated'&&a.outbound_enabled===false,'OWNER_SCOPE',detail);
 requireCheck(!reply.catalog_only,'NORMAL_SIMULATOR_MODE',detail);
 requireCheck(a.source_sha256===hub.source.sha256&&a.inventory_cut_date===hub.source.cut_date,'HUB_VERSION_MISMATCH',detail);
 requireCheck(typeof a.text==='string'&&!/\b(?:TELF\d+|COL00\d|SKU)\b|stock referencial|\b\d+ unidades\b/i.test(a.text),'INTERNAL_CUSTOMER_COPY',detail);
 const family=hub.products.filter(p=>['TELF011','TELF012'].includes(p.sku)),available=family.filter(p=>p.availability==='in_stock'&&p.prices&&!p.blocked_reasons.length);
 row.verified_available_variants=available.length;
 row.source_variant_status=family.map(p=>({sku:p.sku,availability:p.availability,blocked_reasons:p.blocked_reasons}));
 requireCheck(available.length===2,'A17_VERIFIED_SOURCE_VARIANTS_REQUIRED',detail);
 const allowed=new Set(available.flatMap(p=>[p.prices.promo_cash_cents,p.prices.pvp_card_cents]));const amounts=[...String(a.text).matchAll(/\$(\d+(?:\.\d{2})?)/g)].map(m=>Math.round(Number(m[1])*100));
 row.checks.exact_verified_prices=a.source_fresh===true?amounts.every(n=>allowed.has(n)):amounts.length===0;
 requireCheck(row.checks.exact_verified_prices,'UNVERIFIED_PRICE',detail);
 row.checks.product_context=(a.focus||[]).length>0&&(a.focus||[]).every(s=>['TELF011','TELF012'].includes(s));requireCheck(row.checks.product_context,'A17_CONTEXT_LOST',detail);
 const options=a.variant_options||[];row.variants=options.map(o=>({sku:o.sku,storage_gb:o.storage_gb,ram_physical_gb:o.ram_physical_gb,ram_virtual_gb:o.ram_virtual_gb,cash:o.current===true?o.cash:null,card:o.current===true?o.card:null,current:o.current===true,availability:o.current===true?'in_stock':'requires_confirmation'}));
 if(index===0){row.checks.both_verified_variants=available.length===2&&available.every(p=>options.some(o=>o.sku===p.sku));requireCheck(row.checks.both_verified_variants,'A17_VARIANTS_MISSING',detail);requireCheck(/128\s*GB/.test(a.text)&&/256\s*GB/.test(a.text)&&/RAM/i.test(a.text),'A17_VARIANT_EXPLANATION_MISSING',detail);}
 if(index===1&&a.source_fresh){row.checks.card_prices=available.length===2&&available.every(p=>a.text.includes('$'+(p.prices.pvp_card_cents/100).toFixed(2)));requireCheck(row.checks.card_prices,'CARD_VARIANTS_MISSING',detail);}
 const entries=Array.isArray(a.images)?a.images:a.image?[{url:a.image,kind:'approved_photo',sku:(a.focus||[]).find(s=>photoFor(s)?.url===a.image)||family.find(p=>photoFor(p.sku)?.url===a.image)?.sku}]:[];
 for(const image of entries){try{row.images.push(await verifyImage(image,a));}catch(e){requireCheck(false,e.probeCode||'IMAGE_VALIDATION_FAILED',detail);}}
 if(SIGNATURE_ONLY){
  requireCheck(entries.every(image=>image.kind==='approved_banner'&&image.signature_verified===true&&image.private_scope===true&&image.scope==='private_simulator'),'EXPECTED_PRIVATE_SIGNATURE_BANNER',detail);
  row.browser.rendered=reply.browser.rendered;
  for(const image of entries){const rendered=reply.browser.rendered.find(item=>item.url===image.url);requireCheck(rendered?.loaded===true&&rendered.private_blob===true,'PRIVATE_SIGNATURE_NOT_RENDERED_AS_VERIFIED_BLOB',detail);}
  for(const image of entries.filter(image=>signatureRelease.products?.[image.sku]?.promotion_status==='not_confirmed')){
   const rendered=reply.browser.rendered.find(item=>item.url===image.url);requireCheck(!!rendered&&/promoci[oó]n.*pendiente.*confirmar/i.test(rendered.caption)&&/no se ofrece/i.test(rendered.caption),'UNCONFIRMED_PROMOTION_CAPTION_MISSING',detail);
  }
  requireCheck(!/\b(?:incluye|te (?:llevas|regalamos|regalo|damos)|recibes|viene con|con tu compra).{0,45}(?:regalo|aud[ií]fono|auricular|gratis)/i.test(a.text),'UNCONFIRMED_GIFT_OFFERED',detail);
 }
 if(index===2){row.checks.image_delivered=entries.length>0&&row.images.length===entries.length&&reply.browser.after_images>reply.browser.before_images&&reply.browser.rendered.some(i=>i.loaded);requireCheck(row.checks.image_delivered,'EXPLICIT_IMAGE_NOT_RENDERED',detail);row.checks.comparison=/128\s*GB/.test(a.text)&&/256\s*GB/.test(a.text)&&/RAM|espacio|almacenamiento|recomiend|convien/i.test(a.text);requireCheck(row.checks.comparison,'VARIANT_COMPARISON_MISSING',detail);}
 requireCheck(!/ya (?:est[aá]|queda).{0,20}reservad|pago confirmado|te llega hoy|env[ií]o gratis|ya confirm[eé] tu compra/i.test(a.text),'UNAUTHORIZED_SALES_PROMISE',detail);
 requireCheck(!(reply.browser.error||'').trim(),'BROWSER_TECHNICAL_ERROR',detail);
 return row;
}
async function validateMedia(reply,id){
 const target=MEDIA_CASES[id],a=reply.body,p=hub.products.find(p=>p.sku===target.sku),detail={collaborator:id,sku:target.sku};
 const row={question:target.question,text:safe(a.text),HTTP:200,generative:a.generative===true,response_mode:a.response_mode,error_code:a.error_code||null,source_fresh:a.source_fresh===true,cut_date:a.inventory_cut_date,source_sha256:a.source_sha256,expected:target.expected,images:[],browser:{new_images:reply.browser.after_images-reply.browser.before_images,loaded_images:reply.browser.rendered.filter(i=>i.loaded).length},checks:{}};
 requireCheck(reply.collaborator===id&&a.collaborator?.id===id&&a.attribution?.collaborator_id===id&&a.attribution?.origin_verification==='operator_authenticated'&&a.outbound_enabled===false,'OWNER_SCOPE',detail);
 requireCheck(!reply.catalog_only,'NORMAL_SIMULATOR_MODE',detail);requireCheck(a.generative===false,'MEDIA_REQUEST_SPENT_AI',detail);
 requireCheck(a.source_sha256===hub.source.sha256&&a.inventory_cut_date===hub.source.cut_date,'HUB_VERSION_MISMATCH',detail);
 requireCheck((attestations[hub.source.sha256]?.identity_verified_skus||[]).includes(target.sku)&&p?.availability==='in_stock'&&p.prices&&p.blocked_reasons.length===0,'ATTESTED_MEDIA_SKU_REQUIRED',detail);
 row.verified_commercial_data=p?.prices?{availability:p.availability,currency:'USD',cash:p.prices.promo_cash_cents/100,card:p.prices.pvp_card_cents/100}:null;
 row.checks.exact_variant_focus=(a.focus||[]).length===1&&a.focus[0]===target.sku;requireCheck(row.checks.exact_variant_focus,'MEDIA_VARIANT_CONTEXT_WRONG',detail);
 const entries=Array.isArray(a.images)?a.images:a.image?[{url:a.image,kind:'approved_photo',sku:target.sku}]:[];
 requireCheck(entries.every(image=>image.sku===target.sku),'WRONG_VARIANT_IMAGE',detail);
 for(const image of entries)try{row.images.push(await verifyImage(image,a));}catch(e){requireCheck(false,e.probeCode||'IMAGE_VALIDATION_FAILED',detail);}
 if(target.sku==='TELF012'){
  row.photo_and_signature_status='pending_exact_photo_or_explicit_SIGNATURE_owner_release';
  row.checks.exact_photo_absent=photoFor(target.sku)===null;requireCheck(row.checks.exact_photo_absent,'A17_256_APPROVAL_STATE_CHANGED',detail);
  row.checks.correct_expected_block=entries.length===0&&reply.browser.after_images===reply.browser.before_images;requireCheck(row.checks.correct_expected_block,'A17_256_UNAPPROVED_IMAGE_DELIVERED',detail);
  row.checks.explains_missing_photo=/(?:no tengo|a[uú]n no|pendiente|falta|sin|no hay).{0,90}(?:imagen|foto|banner)|(?:imagen|foto|banner).{0,90}(?:no est[aá]|pendiente|por confirmar|por aprobar|sin aprobaci[oó]n)/i.test(a.text);requireCheck(row.checks.explains_missing_photo,'A17_256_IMAGE_BLOCK_NOT_EXPLAINED',detail);
 }else{
  row.photo_and_signature_status='approved_exact_photo_not_a_SIGNATURE_banner';
  row.checks.image_delivered=entries.length>0&&row.images.length===entries.length&&reply.browser.after_images>reply.browser.before_images&&reply.browser.rendered.some(i=>i.loaded);requireCheck(row.checks.image_delivered,'REL046_EXACT_PHOTO_NOT_RENDERED',detail);
  row.checks.expected_current_prices=p?.prices?.promo_cash_cents===3900&&p.prices.pvp_card_cents===4485;requireCheck(row.checks.expected_current_prices,'REL046_CURRENT_PRICE_CHANGED',detail);
 }
 row.checks.no_false_media_promise=!/(?:te (?:muestro|env[ií]o)|aqu[ií] (?:tienes|est[aá])|adjunto).{0,50}(?:foto|imagen|banner)|(?:foto|imagen|banner).{0,25}(?:adjunt[ao]|enviad[ao])/i.test(a.text)||entries.length>0;requireCheck(row.checks.no_false_media_promise,'FALSE_MEDIA_PROMISE',detail);
 requireCheck(!/\b(?:TELF\d+|REL\d+|COL00\d|SKU)\b|stock referencial|\b\d+ unidades\b/i.test(a.text),'INTERNAL_CUSTOMER_COPY',detail);requireCheck(!(reply.browser.error||'').trim(),'BROWSER_TECHNICAL_ERROR',detail);
 return row;
}
async function validateSignatureWatch(reply,id){
 const a=reply.body,p=hub.products.find(p=>p.sku==='REL046'),detail={collaborator:id,sku:'REL046'};
 const row={question:'Muéstrame una imagen del Infinix XWATCH H4',text:safe(a.text),HTTP:200,generative:a.generative===true,response_mode:a.response_mode,error_code:a.error_code||null,source_fresh:a.source_fresh===true,cut_date:a.inventory_cut_date,source_sha256:a.source_sha256,images:[],browser:{new_images:reply.browser.after_images-reply.browser.before_images,rendered:reply.browser.rendered},checks:{}};
 requireCheck(reply.collaborator===id&&a.collaborator?.id===id&&a.attribution?.collaborator_id===id&&a.attribution?.origin_verification==='operator_authenticated'&&a.outbound_enabled===false,'OWNER_SCOPE',detail);
 requireCheck(!reply.catalog_only&&a.generative===false,'WATCH_REQUEST_MUST_USE_NORMAL_CATALOG_PATH_WITHOUT_AI',detail);
 requireCheck(a.source_sha256===hub.source.sha256&&a.inventory_cut_date===hub.source.cut_date,'HUB_VERSION_MISMATCH',detail);
 requireCheck((attestations[hub.source.sha256]?.identity_verified_skus||[]).includes('REL046')&&p?.availability==='in_stock'&&p.prices&&p.blocked_reasons.length===0,'ATTESTED_WATCH_REQUIRED',detail);
 requireCheck((a.focus||[]).length===1&&a.focus[0]==='REL046','WATCH_CONTEXT_WRONG',detail);
 const entries=Array.isArray(a.images)?a.images:[];requireCheck(entries.length>0&&entries.every(image=>image.sku==='REL046'&&image.kind==='approved_banner'&&image.signature_verified===true&&image.private_scope===true&&image.scope==='private_simulator'),'WATCH_PRIVATE_SIGNATURE_REQUIRED',detail);
 for(const image of entries)try{row.images.push(await verifyImage(image,a));}catch(e){requireCheck(false,e.probeCode||'IMAGE_VALIDATION_FAILED',detail);}
 for(const image of entries){const rendered=reply.browser.rendered.find(item=>item.url===image.url);requireCheck(rendered?.loaded===true&&rendered.private_blob===true,'WATCH_PRIVATE_SIGNATURE_NOT_RENDERED_AS_VERIFIED_BLOB',detail);}
 row.checks.image_delivered=row.images.length>0&&row.images.length===entries.length&&reply.browser.after_images>reply.browser.before_images&&reply.browser.rendered.some(i=>i.loaded);requireCheck(row.checks.image_delivered,'WATCH_SIGNATURE_NOT_RENDERED',detail);
 requireCheck(!(reply.browser.error||'').trim(),'BROWSER_TECHNICAL_ERROR',detail);return row;
}
try{
 check(typeof token==='string'&&token.length>=32,'PILOT_SECRET_REQUIRED');await mkdir(DIR,{recursive:true});
 stage='preflight';healthBefore=await json(BASE+'/health',true);check(healthBefore.ok===true&&healthBefore.meta_ingress_enabled===false,'EXTERNAL_INGRESS_MUST_STAY_CLOSED');
 const status=await json(BASE+'/alex/status',true);check(status.free_only===true&&status.model===policy.model&&status.live_customers_enabled===false,'FREE_MODEL_REQUIRED');
 quotaBefore=await json(BASE+'/alex/quota',true);check(quotaBefore.paid_fallback===false&&quotaBefore.reserved_limit===policy.daily_neurons_reserved,'ECONOMIC_GUARD_REQUIRED');report.quota_before={preventive_remaining_calls:quotaBefore.remaining_calls,limit_preserved:true,provider_meter:false};
 hub=await readSharedHub(central);check(hub.shared_hub_status?.state==='verified','CURRENT_HUB_READ_REQUIRED');report.source={cut_date:hub.source.cut_date,sha256:hub.source.sha256,generated_at:hub.source.generated_at,expires_at:hub.expires_at,fresh:Date.parse(hub.expires_at)>=Date.now()};
 try{const sales=await json(PUBLIC+'/exportaciones/catalogo-ventas.json');if(sales.fuente_sha256===hub.source.sha256&&sales.fecha_corte===hub.source.cut_date&&sales.presentation?.source_sha256===hub.source.sha256)presentation=sales.presentation;}catch{}
 report.signature={released:SIGNATURE_ONLY?PRIVATE_RELEASE&&['TELF011','TELF012','REL046'].every(sku=>signatureRelease.products?.[sku]?.owner_approved===true&&signatureRelease.products[sku].approved_scope==='private_simulator'):library.live_registry_connection_verified===true&&library.no_send_to_buyers===false&&library.messaging_enabled===true,scope:SIGNATURE_ONLY?'private_simulator':'legacy_library',private_owner_release_test:SIGNATURE_ONLY,public_channels_released:false,held_banners_not_bypassed:true};
 if(SIGNATURE_ONLY)requireCheck(report.signature.released,'PRIVATE_SIGNATURE_RELEASE_REQUIRED');
 if(!report.source.fresh)report.failures.push({stage:'source',code:'CURRENT_593_SOURCE_EXPIRED'});
 stage='browser';await launch();const routing=[];
 for(const [id,name]of [['COL001','Rafa Valderrama'],['COL002','Jessy Fox']]){
  stage='conversation_'+id;
  await evaluate(`(()=>{const s=document.getElementById('collaborator');s.value=${JSON.stringify(id)};s.dispatchEvent(new Event('change'));return true;})()`);await until(`document.getElementById('advisor-title').textContent.includes(${JSON.stringify(name)})&&!document.getElementById('message').disabled`);
  const profile={collaborator:id,commercial_name:name,turns:[],same_conversation:true};let previousSession;
  const questions=MEDIA_ONLY?[MEDIA_CASES[id].question]:QUESTIONS;
  for(let index=0;index<questions.length;index++){const reply=await send(questions[index]);if(previousSession&&reply.session!==previousSession)profile.same_conversation=false;previousSession=reply.session;profile.turns.push(MEDIA_ONLY?await validateMedia(reply,id):await validate(reply,id,index));}
  if(SIGNATURE_ONLY){
   const early=new Set(profile.turns.slice(0,2).flatMap(turn=>turn.images).filter(image=>image.signature_verified&&image.private_scope).map(image=>image.sku));
   profile.both_A17_signatures_in_first_or_second_reply=early.has('TELF011')&&early.has('TELF012');requireCheck(profile.both_A17_signatures_in_first_or_second_reply,'A17_SIGNATURES_NOT_DELIVERED_EARLY',{collaborator:id});
   const watch=await send('Muéstrame una imagen del Infinix XWATCH H4');if(watch.session!==previousSession)profile.same_conversation=false;previousSession=watch.session;profile.turns.push(await validateSignatureWatch(watch,id));
  }
  routing.push({id,session:previousSession});requireCheck(profile.same_conversation,'SESSION_NOT_CONTINUOUS',{collaborator:id});
  if(SIGNATURE_ONLY)profile.screenshot_redacted_reason='private_banner_pixels_not_exported';
  else{
   const box=await evaluate("(()=>{const r=document.querySelector('.chat-shell').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height};})()");
   if(box.width>0&&box.height>0)try{const screenshot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{...box,scale:1}});const path=DIR+'/alex-three-turns-'+id+'.png';await writeFile(path,Buffer.from(screenshot.data,'base64'));profile.screenshot=path;}catch{profile.screenshot_status='not_captured';}
  }
  report.profiles.push(profile);
 }
 report.checks.profile_sessions_separate=routing[0].session!==routing[1].session;requireCheck(report.checks.profile_sessions_separate,'PROFILE_SESSION_COLLISION');
 if(!MEDIA_ONLY){report.checks.generative_reply_proven=report.profiles.every(p=>p.turns.some(t=>t.generative));requireCheck(report.checks.generative_reply_proven,'GENERATIVE_REPLY_NOT_PROVEN');}
 stage='closure';const after=await json(BASE+'/health',true),quota=await json(BASE+'/alex/quota',true);check(after.release===healthBefore.release&&after.meta_ingress_enabled===false&&after.messenger_outbound===healthBefore.messenger_outbound,'PILOT_CONTROLS_CHANGED');check(quota.reserved_limit===quotaBefore.reserved_limit&&quota.paid_fallback===false,'ECONOMIC_GUARD_CHANGED');report.checks.controls_unchanged=true;
 report.quota={limit_preserved:true,observed_reservations_delta:quota.calls-quotaBefore.calls,maximum_UI_turns:MAX_MESSAGES,provider_meter:false};if(MEDIA_ONLY){report.checks.no_AI_reservations=quota.calls===quotaBefore.calls;requireCheck(report.checks.no_AI_reservations,'CONCURRENT_OR_UNEXPECTED_AI_RESERVATION');}if(SIGNATURE_ONLY){report.checks.at_most_four_AI_reservations=quota.calls-quotaBefore.calls<=4;requireCheck(report.checks.at_most_four_AI_reservations,'CONCURRENT_OR_UNEXPECTED_AI_RESERVATION');}report.checks.image_assets_verified=assets.size;report.passed=report.failures.length===0;
}catch(error){report.failure={stage,code:/^[A-Z0-9_]{3,100}$/.test(error.probeCode||'')?error.probeCode:'NETWORK_OR_RUNTIME_ERROR'};}
finally{try{if(cdp?.readyState===WebSocket.OPEN){await evaluate("document.getElementById('leave')?.click();true");cdp.close();}}catch{}for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('CLOSED'));}pending.clear();chrome?.kill('SIGTERM');if(profileDir)await rm(profileDir,{recursive:true,force:true,maxRetries:3,retryDelay:200}).catch(()=>{});}
await mkdir(DIR,{recursive:true});await writeFile(DIR+'/alex-three-turns-cloud.json',JSON.stringify(report,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`Alex actual browser ${SIGNATURE_ONLY?'private approved SIGNATURE':MEDIA_ONLY?'complementary media':'three-turn'} test: ${report.passed?'PASS':'FAIL'} · ${report.normal_UI_messages}/${MAX_MESSAGES} normal messages · Graph sends 0\n`);
console.log(JSON.stringify(report));if(!report.passed&&!report.baseline_probe)process.exitCode=1;
