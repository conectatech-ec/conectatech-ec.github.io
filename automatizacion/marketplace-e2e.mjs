// Actual HTTPS preview and Alex source checks. No fake customer events, Graph sends or AI calls.
import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
import {quoteCurrent} from './alex-catalog.mjs';
import {createHash} from 'node:crypto';
const base=process.env.PILOT_BASE_URL||'https://conectatech-comercial-piloto.conectatech-ecu.workers.dev',token=process.env.PILOT_TOKEN,headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
const report={at:new Date().toISOString(),kind:'real_private_HTTPS_not_Messenger_or_Marketplace_delivery',passed:false,AI_calls_issued_by_test:0,Graph_messages_sent:0,WhatsApp_API_calls:0,external_customers_enabled:false,checks:[],conversations:[]};
async function get(path){const r=await fetch(base+path,{headers,signal:AbortSignal.timeout(25000)});assert.equal(r.status,200);return r.json();}
async function ask(channel,session,message,extra={},timeout=40000){const r=await fetch(base+'/marketplace/preview',{method:'POST',headers,body:JSON.stringify({channel,session_id:session,message,...extra}),signal:AbortSignal.timeout(timeout)});assert.equal(r.status,200);const d=await r.json();assert.equal(d.generative,false);assert.equal(d.outbound_enabled,false);assert.equal(d.acquisition.outbound_enabled,false);assert.ok(d.quick_replies.every(q=>q.title&&q.title.length<=20));if(!d.source_fresh)assert.ok(!d.text.includes('$'));assert.ok(!/\d+ unidades|stock referencial/i.test(d.text));assert.ok(d.acquisition.banners.every(b=>!b.delivery_enabled));return d;}
try{
 for(let i=0;i<12;i++){report.health=await get('/health');if(!process.env.EXPECTED_RELEASE||report.health.release===process.env.EXPECTED_RELEASE)break;await new Promise(r=>setTimeout(r,2000));}
 assert.equal(report.health.release,process.env.EXPECTED_RELEASE||report.health.release);assert.equal(report.health.meta_ingress_enabled,false);
 const shell=await fetch(base+'/marketplace/pilot');assert.equal(shell.status,200);assert.ok(!(await shell.text()).includes(token));assert.equal((await fetch(base+'/marketplace/preview',{method:'POST',body:'{}'})).status,401);
 const pointerResponse=await fetch('https://conectatech-ec.github.io/datos-593/estado-ultimo-corte.json',{signal:AbortSignal.timeout(20000)});assert.equal(pointerResponse.status,200);const pointer=await pointerResponse.json();
 const cutResponse=await fetch('https://conectatech-ec.github.io/datos-593/corte-comercial-publico-validado.json',{signal:AbortSignal.timeout(20000)});assert.equal(cutResponse.status,200);const cut=await cutResponse.json();
 assert.equal(pointer.referencia,'datos-593/corte-comercial-publico-validado.json');assert.equal(cut.fecha_corte,pointer.fecha_corte);assert.equal(cut.sha256_original,pointer.origen_sha256);
 const target=cut.productos?.TELF017;assert.ok(target&&target.stock>0);for(const k of ['promo_centavos','pvp_centavos'])assert.ok(Number.isSafeInteger(target[k])&&target[k]>0);
 const allowedAmounts=new Set([target.promo_centavos,target.pvp_centavos]);
 function assertCurrentQuote(d){assert.equal(d.quote_current,true);assert.equal(d.source_fresh,true);assert.equal(d.source_sha256,pointer.origen_sha256);assert.equal(d.inventory_cut_date,pointer.fecha_corte);const stamp=Date.parse(d.source_verified_at),now=Date.now();assert.ok(Number.isFinite(stamp)&&stamp<=now+300000&&now-stamp<=86400000);assert.equal(quoteCurrent({fuente_fecha:d.source_verified_at},{price_verified:true},stamp+86400001),false);}
 function assertAmount(d,fact,cents){assert.ok(d.facts?.includes(fact));const amounts=[...d.text.matchAll(/\$(\d+(?:\.\d{2})?)/g)].map(m=>Math.round(Number(m[1])*100));assert.ok(amounts.includes(cents));assert.ok(amounts.every(n=>allowedAmounts.has(n)));}
 report.shared_cut={cut_date:pointer.fecha_corte,sha256:pointer.origen_sha256};report.current_quote_expected={sku:'TELF017',cash_cents:target.promo_centavos,card_cents:target.pvp_centavos};report.expiry_guard_scope='local same-release guard at live verified timestamp plus 24h; no server clock changed';
 for(const channel of ['marketplace_personal','messenger_page','whatsapp_business']){
  for(const [sku,message] of [['TELF017','Busco un Redmi 15C de 128 GB'],['TELF001','Quiero información del ZTE A56 Pro'],['REL046','Busco un Infinix XWATCH H4']]){
   const d=await ask(channel,crypto.randomUUID(),message);assert.deepEqual(d.focus,[sku]);assert.equal(d.inventory_cut_date,pointer.fecha_corte);assert.equal(d.source_sha256,pointer.origen_sha256);assert.equal(d.source_kind,'shared_validated_central_593');
   if(sku==='TELF017')assertCurrentQuote(d);
   report.checks.push({channel,sku,text:d.text,quote_current:d.quote_current,source_fresh:d.source_fresh,cut:d.inventory_cut_date,source_sha256:d.source_sha256,image:d.image,banner:d.acquisition.banners[0],transport:d.acquisition.transport});
  }
 }
 const session=crypto.randomUUID();
 for(const message of ['Busco un Redmi 15C de 128 GB','¿Cuál es el precio de contado?','¿Y con tarjeta cuánto cuesta?','Pero no tengo tarjeta Pacífico','Tengo Pichincha','Quiero contraentrega en Quito','¿Y envíos nacionales?','Muéstrame la fotografía','No compraré todavía','Quiero continuar después']){
  const d=await ask('messenger_page',session,message);assert.deepEqual(d.focus,['TELF017']);assertCurrentQuote(d);assert.notEqual(d.action,'handoff');assert.ok(!d.text.includes('En octubre, Pacífico'));
  if(message==='¿Cuál es el precio de contado?')assertAmount(d,'TELF017.cash',target.promo_centavos);
  if(message==='¿Y con tarjeta cuánto cuesta?')assertAmount(d,'TELF017.card',target.pvp_centavos);
  report.conversations.push({message,text:d.text,quote_current:d.quote_current,facts:d.facts,focus:d.focus,image:d.image,buttons:d.quick_replies.map(q=>q.title)});
 }
 report.identity_blocks=[];
 for(const sku of ['CABL166','HUB017','FLAS024','MOUS010']){const d=await ask('messenger_page',crypto.randomUUID(),'¿Cuál es el precio de '+sku+'?');assert.deepEqual(d.focus,[sku]);assert.equal(d.source_sha256,pointer.origen_sha256);assert.equal(d.quote_current,false);assert.ok(d.image===null,'BLOCKED_IDENTITY_PHOTO');assert.ok(!d.text.includes('$'));assert.ok(!d.facts?.some(k=>/\.(cash|card|pvp)$/.test(k)));report.identity_blocks.push({sku,quote_current:d.quote_current,protected:true});}
 const ambiguity=await ask('marketplace_personal',crypto.randomUUID(),'Busco un Redmi 15C');assert.equal(ambiguity.focus.length,2);assert.ok(ambiguity.acquisition.handoff.prefilled_message.includes('versión por confirmar'));
 const picked=await ask('messenger_page',crypto.randomUUID(),'Elijo este producto',{quick_reply_payload:'ALEX:choose:TELF018'});assert.deepEqual(picked.focus,['TELF018']);
 const direct=await fetch(base+'/alex/chat',{method:'POST',headers,body:JSON.stringify({session_id:crypto.randomUUID(),message:'¿Qué batería tiene el Redmi 15C de 128 GB?',catalog_only:true})});assert.equal(direct.status,200);const a=await direct.json();assert.deepEqual(a.focus,['TELF017']);assert.ok(a.text.includes('6000 mAh'));assert.equal(a.source_sha256,pointer.origen_sha256);assertCurrentQuote(a);report.original_Alex_path={focus:a.focus,text:a.text,source_sha256:a.source_sha256};

 // Verify the public presentation independently of the private commercial identity.
 // New snapshots contain only public titles/media/prices and verification flags.
 const presentationRequire=(ok,code)=>{if(!ok)throw Error(code);};
 const digest=value=>createHash('sha256').update(value).digest('hex');
 const stable=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 async function publicPresentation(){
  const r=await fetch('https://conectatech-ec.github.io/exportaciones/catalogo-ventas.json',{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(10000)});
  presentationRequire(r.status===200,'PUBLIC_PRESENTATION_HTTP');const sales=await r.json(),doc=sales.presentation;
  presentationRequire(sales.fuente_sha256===pointer.origen_sha256&&sales.fecha_corte===pointer.fecha_corte,'PUBLIC_PRESENTATION_CROSS_SOURCE');
  presentationRequire(doc?.schema==='conectatech.alex.presentation.v1'&&doc.source_sha256===pointer.origen_sha256&&doc.cut_date===pointer.fecha_corte,'PUBLIC_PRESENTATION_CROSS_SOURCE');
  presentationRequire(/^alex-presentation-v1-[a-f0-9]{64}$/.test(doc.version||'')&&['multichannel_sha256','meta_sha256'].every(k=>/^[a-f0-9]{64}$/.test(doc.inputs?.[k]||'')),'PUBLIC_PRESENTATION_INTEGRITY_METADATA');
  const {version,...body}=doc;
  presentationRequire(version==='alex-presentation-v1-'+digest(stable(body)),'PUBLIC_PRESENTATION_DIGEST');
  const published=Date.parse(doc.published_at);presentationRequire(Number.isFinite(published)&&published<=Date.now()+300000,'PUBLIC_PRESENTATION_DATE');return doc;
 }
 async function verifyPublicImage(media){
  const u=new URL(media.url);presentationRequire(u.origin==='https://conectatech-ec.github.io'&&u.pathname.startsWith('/imagenes/')&&!u.search&&!u.hash&&!u.username&&!u.password&&u.href===media.url&&/^[a-f0-9]{64}$/.test(media.sha256||''),'PUBLIC_PRESENTATION_MEDIA_METADATA');
  const r=await fetch(media.url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(10000)});
  presentationRequire(r.status===200&&/^image\//i.test(r.headers.get('content-type')||''),'PUBLIC_PRESENTATION_IMAGE_HTTP');
  const limit=8*1024*1024;presentationRequire(Number(r.headers.get('content-length')||0)<=limit&&r.body,'PUBLIC_PRESENTATION_IMAGE_SIZE');
  const hash=createHash('sha256'),reader=r.body.getReader();let bytes=0;
  for(;;){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>limit){await reader.cancel();throw Error('PUBLIC_PRESENTATION_IMAGE_SIZE');}hash.update(chunk.value);}
  presentationRequire(bytes>0&&hash.digest('hex')===media.sha256,'PUBLIC_PRESENTATION_IMAGE_SHA');return {http:r.status,sha256:media.sha256,bytes};
 }
 function assertPresentation(d,doc){
  presentationRequire(d.presentation_version===doc.version,'PRESENTATION_VERSION_NOT_CURRENT');
  presentationRequire(['verified','unchanged'].includes(d.presentation_state)&&d.presentation_error_code===null,'PRESENTATION_NOT_FRESHLY_VERIFIED');
  assertCurrentQuote(d);
 }
 function assertPublicTitlePrice(d,sku,view,row,kind){
  const field=kind==='cash'?'promo_centavos':'pvp_centavos',icon=kind==='cash'?'💵':'💳';
  const line=d.text.split('\n').find(s=>s.startsWith(icon+' ')),match=line?.match(/^[💵💳]+\s(.+):\s\$(\d+(?:\.\d{2})?)(?=\s|$)/u);
  presentationRequire(match?.[1]===view.display_title,'PRESENTATION_TITLE_NOT_EXACT');
  presentationRequire(d.facts?.includes(sku+'.'+kind)&&Math.round(Number(match[2])*100)===row[field],'PRESENTATION_PRICE_NOT_EXACT');
  const amounts=[...d.text.matchAll(/\$(\d+(?:\.\d{2})?)/g)].map(m=>Math.round(Number(m[1])*100));
  presentationRequire(amounts.every(n=>[row.promo_centavos,row.pvp_centavos].includes(n)),'PRESENTATION_UNEXPECTED_AMOUNT');
 }
 async function checkCurrentPresentation(){
  const doc=await publicPresentation();
  const skus=['AUDI044','REL069','CABL139'].filter(sku=>cut.productos?.[sku]?.stock>0&&doc.products?.[sku]?.approved_media).slice(0,2);
  presentationRequire(skus.length>=1,'PUBLIC_PRESENTATION_NO_APPROVED_AVAILABLE_TARGET');
  const checked=[];
  for(const sku of skus){
   const view=doc.products[sku],row=cut.productos[sku],operatorSession=crypto.randomUUID();
   presentationRequire(typeof view.display_title==='string'&&view.display_title.trim().length>0&&view.display_title.length<=300,'PUBLIC_PRESENTATION_TITLE_METADATA');
   presentationRequire(['promo_centavos','pvp_centavos'].every(k=>Number.isSafeInteger(row[k])&&row[k]>0),'PUBLIC_PRESENTATION_PRICE_METADATA');
   const cash=await ask('messenger_page',operatorSession,'Precio de contado '+sku,{},15000);assert.deepEqual(cash.focus,[sku]);assertPresentation(cash,doc);assertPublicTitlePrice(cash,sku,view,row,'cash');
   presentationRequire(cash.image===view.approved_media.url,'PRESENTATION_IMAGE_URL_NOT_EXACT');
   const card=await ask('messenger_page',operatorSession,'Precio con tarjeta '+sku,{},15000);assert.deepEqual(card.focus,[sku]);assertPresentation(card,doc);assertPublicTitlePrice(card,sku,view,row,'card');
   presentationRequire(card.image===null||card.image===view.approved_media.url,'PRESENTATION_IMAGE_URL_NOT_EXACT');
   const photo=await ask('messenger_page',operatorSession,'Muéstrame la fotografía '+sku,{},15000);assert.deepEqual(photo.focus,[sku]);assertPresentation(photo,doc);
   presentationRequire(photo.image===view.approved_media.url,'PRESENTATION_IMAGE_URL_NOT_EXACT');const image=await verifyPublicImage(view.approved_media);
   checked.push({sku,display_title:view.display_title,image_url:view.approved_media.url,image_sha256:image.sha256,image_http:image.http,image_bytes:image.bytes,presentation_version:doc.version,presentation_state:photo.presentation_state,source_sha256:photo.source_sha256,cut:photo.inventory_cut_date,quote_current:photo.quote_current,cash_cents:row.promo_centavos,card_cents:row.pvp_centavos,generative:false,outbound_enabled:false});
  }
  const after=await publicPresentation();presentationRequire(after.version===doc.version,'PUBLIC_PRESENTATION_VERSION_CHANGED');
  return {version:doc.version,source_sha256:doc.source_sha256,cut:doc.cut_date,checks:checked};
 }
 for(let attempt=1;attempt<=3;attempt++){
  try{report.current_presentation=await checkCurrentPresentation();report.current_presentation.attempts=attempt;break;}
  catch(error){if(attempt===3||!['PRESENTATION_VERSION_NOT_CURRENT','PUBLIC_PRESENTATION_VERSION_CHANGED'].includes(error.message))throw error;await new Promise(resolve=>setTimeout(resolve,30000));}
 }
 report.private_source=await get('/commercial/catalog/status');report.seller=await get('/messenger/status');report.quota=await get('/alex/quota');assert.equal(report.seller.reception_enabled,false);report.passed=true;
}catch(e){report.error=String(e.message).slice(0,500);}
const path=new URL('./generated/fase2/',import.meta.url);await mkdir(path,{recursive:true});await writeFile(new URL('marketplace-cloud.json',path),JSON.stringify(report,null,2)+'\n');
// Seller status includes only already sanitized operational fields, never PSID or token values.
console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
