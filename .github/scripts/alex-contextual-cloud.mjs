// Actual private simulator browser conversations. No screenshots, asset paths,
// private hashes, personal messages or credentials are exported in the receipt.
import {spawn} from 'node:child_process';
import {access,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import policy from '../../automatizacion/alex-policy.json' with {type:'json'};
const BASE='https://conectatech-comercial-piloto.conectatech-ecu.workers.dev',token=process.env.PILOT_TOKEN,DIR='automatizacion/generated/fase2';
const report={schema:'conectatech.alex.contextual-browser.v1',at:new Date().toISOString(),passed:false,scope:'private_simulator_actual_Chromium',revision:process.env.GITHUB_SHA,profiles:[],messages:0,maximum_messages:15,checks:{},Graph_sends:0,customer_events:0,external_customers_enabled:false,new_cost_usd:0,private_images_recorded:false};
let chrome,profileDir,cdp,session,nextId=0,stage='preflight';const pending=new Map();
function check(value,code){if(!value)throw Object.assign(new Error(code),{code});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function json(path){const r=await fetch(BASE+path,{headers:{Authorization:'Bearer '+token},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(25000)});check(r.status===200,'PRIVATE_HTTP_200_REQUIRED');return r.json();}
function command(method,params={},scoped=true){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(Object.assign(new Error('CDP_TIMEOUT'),{code:'CDP_TIMEOUT'}));},65000);pending.set(id,{resolve,reject,timer});cdp.send(JSON.stringify({id,method,params,...(scoped?{sessionId:session}:{})}));});}
async function evaluate(expression){const d=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});check(!d.exceptionDetails,'BROWSER_EVALUATION_FAILED');return d.result?.value;}
async function until(expression,timeout=65000){const start=Date.now();while(Date.now()-start<timeout){const value=await evaluate(expression);if(value)return value;await sleep(150);}check(false,'BROWSER_WAIT_TIMEOUT');}
async function launch(){
 let binary;for(const path of ['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].filter(Boolean)){try{await access(path);binary=path;break;}catch{}}
 check(binary,'CHROME_REQUIRED');profileDir=await mkdtemp(join(tmpdir(),'alex-contextual-'));
 chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--window-size=1280,1000','--user-data-dir='+profileDir,'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{let buffer='';const timer=setTimeout(()=>reject(Object.assign(new Error('CHROME_START_FAILED'),{code:'CHROME_START_FAILED'})),20000);chrome.on('error',()=>{clearTimeout(timer);reject(Object.assign(new Error('CHROME_START_FAILED'),{code:'CHROME_START_FAILED'}));});chrome.stderr.on('data',b=>{buffer=(buffer+b.toString()).slice(-10000);const m=buffer.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 cdp=new WebSocket(endpoint);await new Promise((resolve,reject)=>{cdp.onopen=resolve;cdp.onerror=()=>reject(Object.assign(new Error('CDP_CONNECT_FAILED'),{code:'CDP_CONNECT_FAILED'}));});
 cdp.onmessage=e=>{const d=JSON.parse(String(e.data)),p=pending.get(d.id);if(!p)return;clearTimeout(p.timer);pending.delete(d.id);if(d.error)p.reject(Object.assign(new Error('CDP_PROTOCOL_FAILED'),{code:'CDP_PROTOCOL_FAILED'}));else p.resolve(d.result);};
 const target=await command('Target.createTarget',{url:'about:blank'},false);session=(await command('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
 await command('Page.enable');await command('Runtime.enable');await command('Page.navigate',{url:BASE+'/alex'});await until("document.readyState==='complete'&&!!document.getElementById('connect')");
 await evaluate(`(()=>{window.__replies=[];window.__failImage=false;const original=window.fetch.bind(window);window.fetch=async(...args)=>{const path=new URL(typeof args[0]==='string'?args[0]:args[0].url,location.href).pathname;if(window.__failImage&&path.startsWith('/alex/signature/')){window.__failImage=false;return new Response('',{status:503});}const response=await original(...args);if(path==='/alex/chat'){const b=JSON.parse(args[1]?.body||'{}');response.clone().json().then(body=>window.__replies.push({HTTP:response.status,collaborator:b.collaborator_id,catalog_only:b.catalog_only===true,body}));}return response;};document.getElementById('key').value=${JSON.stringify(token)};document.getElementById('connect').click();return true;})()`);
 await until("!document.getElementById('message').disabled&&document.getElementById('collaborator').options.length===2");check(await evaluate("document.getElementById('key').value===''")===true,'KEY_NOT_CLEARED');
}
async function send(message,id,payload=null){
 check(report.messages<report.maximum_messages,'MESSAGE_LIMIT');report.messages++;
 const before=await evaluate('window.__replies.length'),beforeImages=await evaluate("document.querySelectorAll('#chat figure img').length");
 if(payload){const index=await evaluate(`window.__replies.at(-1).body.quick_replies.findIndex(q=>q.payload===${JSON.stringify(payload)})`);check(index>=0,'EXPECTED_CONTEXT_BUTTON_MISSING');await evaluate(`(()=>{document.querySelectorAll('#chat [data-choice]')[${index}].click();return true;})()`);}
 else await evaluate(`(()=>{document.getElementById('message').value=${JSON.stringify(message)};document.getElementById('form').requestSubmit();return true;})()`);
 await until(`window.__replies.length>${before}&&!document.getElementById('send').disabled`);
 const r=await evaluate(`window.__replies[${before}]`),a=r.body;check(r.HTTP===200,'CHAT_HTTP_200_REQUIRED');check(r.collaborator===id&&a.collaborator?.id===id&&a.outbound_enabled===false&&!r.catalog_only,'PROFILE_SCOPE_OR_NORMAL_MODE_WRONG');
 check(a.source_fresh===true&&a.quote_current===true,'VERIFIED_CURRENT_SOURCE_REQUIRED');
 await evaluate("(()=>{for(const i of document.querySelectorAll('#chat figure img'))i.loading='eager';document.querySelector('#chat figure:last-of-type')?.scrollIntoView();return true;})()");
 if(a.images?.length)await until("!document.getElementById('media-note').textContent.includes('Cargando')&&!/imagen…|imágenes…/.test(document.getElementById('media-note').textContent)",30000);
 const ui=await evaluate(`({text:Array.from(document.querySelectorAll('#chat .bubble:not(.you)')).at(-1)?.children[1]?.textContent||'',buttons:Array.from(document.querySelectorAll('#chat [data-choice]')).map(b=>b.textContent),images:Array.from(document.querySelectorAll('#chat figure img')).slice(${beforeImages}).map(i=>({loaded:i.complete&&i.naturalWidth>0,width:i.naturalWidth,height:i.naturalHeight,private_blob:i.src.startsWith('blob:')})),media:document.getElementById('media-note').textContent,error:document.getElementById('error').textContent,advisor:document.getElementById('advisor-title').textContent})`);
 check(!ui.error,'UI_TECHNICAL_ERROR');check(ui.buttons.length>=3&&ui.buttons.length<=4,'CONTEXT_BUTTON_COUNT');check(!/te llega hoy|envío gratis|reserva confirmada|pago confirmado/i.test(ui.text),'UNAUTHORIZED_PROMISE');
 return {a,ui,row:{question:message||(a.quick_replies?'[botón contextual]':''),clicked:payload,HTTP:r.HTTP,text:ui.text,suggestions:a.quick_replies.map(q=>({title:q.title,payload:q.payload})),generative:a.generative===true,response_mode:a.response_mode,error_code:a.error_code||null,cut_date:a.inventory_cut_date,source_fresh:a.source_fresh,loaded_images:ui.images.filter(i=>i.loaded).length,image_dimensions:ui.images.filter(i=>i.loaded).map(i=>[i.width,i.height]),memory:{focus:a.memory.focus,budget:a.memory.budget,delivery:a.memory.delivery||null},checks:{}}};
}
const includes=(r,p)=>r.a.quick_replies.some(q=>q.payload===p);
try{
 check(typeof token==='string'&&token.length>=32,'PILOT_SECRET_REQUIRED');await mkdir(DIR,{recursive:true});
 const health=await json('/health'),status=await json('/alex/status'),quota=await json('/alex/quota');
 check(health.ok&&health.meta_ingress_enabled===false&&status.live_customers_enabled===false,'EXTERNAL_ACCESS_MUST_STAY_CLOSED');check(status.free_only===true&&status.model===policy.model&&quota.paid_fallback===false&&quota.reserved_limit===policy.daily_neurons_reserved,'ECONOMIC_GUARDS_CHANGED');
 report.quota={preventive_remaining_calls:quota.remaining_calls,reserved_limit:quota.reserved_limit,provider_meter:false};
 stage='browser';await launch();
 for(const id of ['COL001','COL002']){
  stage=id;await evaluate(`(()=>{document.getElementById('collaborator').value=${JSON.stringify(id)};document.getElementById('collaborator').dispatchEvent(new Event('change'));return true;})()`);
  await until("!document.getElementById('message').disabled");const profile={id,turns:[]};report.profiles.push(profile);
  let r=await send('Busco un Samsung A17, tengo un presupuesto de 250 dólares',id);profile.turns.push(r.row);
  check(r.ui.images.length===2&&r.ui.images.every(i=>i.loaded&&i.private_blob),'BOTH_APPROVED_BANNERS_MUST_RENDER');
  check(r.a.presentation?.with_banner===r.ui.text&&!/\$|\bRAM\b|\bGB\b/.test(r.ui.text)&&r.ui.text.length<240,'DUPLICATE_BANNER_COPY_NOT_REMOVED');check(includes(r,'ALEX:card')&&includes(r,'ALEX:sim:compare'),'FIRST_CONTEXT_OPTIONS_WRONG');r.row.checks={both_banners_rendered:true,compact_only_after_load:true,personality_differentiated:id==='COL002'?/Te muestro/.test(r.ui.text):/Aquí van/.test(r.ui.text)};
  r=await send('¿Cuánto cuesta con tarjeta?',id,'ALEX:card');profile.turns.push(r.row);check(r.ui.text===r.a.text&&/232\.38/.test(r.ui.text)&&/299\.88/.test(r.ui.text),'DIRECT_CARD_PRICE_MUST_REMAIN');check(includes(r,'ALEX:sim:installments')&&!includes(r,'ALEX:card'),'CARD_BUTTONS_DID_NOT_EVOLVE');check(r.ui.images.length===0,'UNREQUESTED_BANNER_REPEAT');r.row.checks={direct_verified_prices:true,buttons_evolved:true,no_repeated_banners:true};
  r=await send('Revisar cuotas',id,'ALEX:sim:installments');profile.turns.push(r.row);check(!includes(r,'ALEX:sim:installments')&&!/sin intereses/.test(r.ui.text),'REPEATED_OR_UNCONFIRMED_FINANCING');r.row.checks={installments_not_repeated:true,no_unconfirmed_bank_offer:true};
  r=await send('¿Qué cámara tienen ambos?',id);profile.turns.push(r.row);check(r.a.presentation===null&&/cámara/i.test(r.ui.text),'DIRECT_CAMERA_ANSWER_REQUIRED');check(!includes(r,'ALEX:sim:installments')&&!includes(r,'ALEX:sim:camera_compare'),'CAMERA_BUTTONS_DID_NOT_EVOLVE');r.row.checks={direct_camera_facts:true,buttons_evolved:true};
  r=await send('Prefiero contraentrega en Quito',id);profile.turns.push(r.row);check(r.a.memory.delivery==='quito'&&r.a.memory.budget===250&&r.a.memory.focus.includes('TELF011')&&r.a.memory.focus.includes('TELF012'),'CONTEXT_LOST');check(includes(r,'ALEX:sim:delivery_terms'),'DELIVERY_BUTTONS_DID_NOT_EVOLVE');r.row.checks={product_budget_delivery_remembered:true,buttons_evolved:true};
  r=await send('Cobertura y costo',id,'ALEX:sim:delivery_terms');profile.turns.push(r.row);check(!/te llega hoy|gratis/i.test(r.ui.text),'UNVERIFIED_LOGISTICS_PROMISE');r.row.checks={no_delivery_promise:true};
 }
 stage='controlled_browser_image_failure';await evaluate("(()=>{document.getElementById('reset').click();return true;})()");await until("!document.getElementById('send').disabled");await evaluate('window.__failImage=true');
 const fallback=await send('Busco un Samsung A17','COL002');check(fallback.a.presentation&&fallback.ui.text===fallback.a.text&&/185\.90/.test(fallback.ui.text)&&/239\.90/.test(fallback.ui.text),'FULL_VERIFIED_TEXT_REQUIRED_AFTER_IMAGE_FAILURE');
 report.image_failure={HTTP:200,controlled_browser_only:true,full_verified_text_preserved:true,loaded_images:fallback.row.loaded_images,no_assets_modified:true};
 const after=await json('/health'),lastQuota=await json('/alex/quota');check(after.meta_ingress_enabled===false&&after.release===health.release&&after.messenger_outbound===health.messenger_outbound,'RUNTIME_SAFETY_CHANGED');check(lastQuota.reserved_limit===quota.reserved_limit&&lastQuota.paid_fallback===false,'ECONOMIC_GUARDS_CHANGED');
 report.checks={both_profiles_verified:true,contextual_buttons_clicked:true,no_external_sends:true,quota_limits_preserved:true,banners_and_source_unchanged:true,failed_image_keeps_verified_text:true};report.passed=true;
}catch(e){report.failure={stage,code:typeof e.code==='string'&&/^[A-Z_]+$/.test(e.code)?e.code:'PRIVATE_DIAGNOSTIC_WITHHELD'};process.exitCode=1;}
finally{if(cdp?.readyState===WebSocket.OPEN){try{await command('Browser.close',{},false);}catch{}cdp.close();}chrome?.kill('SIGTERM');if(profileDir)await rm(profileDir,{recursive:true,force:true}).catch(()=>{});await mkdir(DIR,{recursive:true});const safe=JSON.stringify(report,null,2).replaceAll(token||'__NO_TOKEN__','[secret omitted]');check(!/\/alex\/signature\/|data:image|blob:https|"sha256"/.test(safe),'PRIVATE_ASSET_METADATA_MUST_NOT_BE_EXPORTED');await writeFile(join(DIR,'alex-contextual-cloud.json'),safe+'\n');console.log(safe);}
