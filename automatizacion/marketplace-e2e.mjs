// Actual HTTPS preview and Alex source checks. No fake customer events, Graph sends or AI calls.
import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.PILOT_BASE_URL||'https://conectatech-comercial-piloto.conectatech-ecu.workers.dev',token=process.env.PILOT_TOKEN,headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
const report={at:new Date().toISOString(),kind:'real_private_HTTPS_not_Messenger_or_Marketplace_delivery',passed:false,AI_calls_issued_by_test:0,Graph_messages_sent:0,WhatsApp_API_calls:0,external_customers_enabled:false,checks:[],conversations:[]};
async function get(path){const r=await fetch(base+path,{headers,signal:AbortSignal.timeout(25000)});assert.equal(r.status,200);return r.json();}
async function ask(channel,session,message,extra={}){const r=await fetch(base+'/marketplace/preview',{method:'POST',headers,body:JSON.stringify({channel,session_id:session,message,...extra}),signal:AbortSignal.timeout(40000)});assert.equal(r.status,200);const d=await r.json();assert.equal(d.generative,false);assert.equal(d.outbound_enabled,false);assert.equal(d.acquisition.outbound_enabled,false);assert.ok(d.quick_replies.every(q=>q.title&&q.title.length<=20));if(!d.source_fresh)assert.ok(!d.text.includes('$'));assert.ok(!/\d+ unidades|stock referencial/i.test(d.text));assert.ok(d.acquisition.banners.every(b=>!b.delivery_enabled));return d;}
try{
 for(let i=0;i<12;i++){report.health=await get('/health');if(!process.env.EXPECTED_RELEASE||report.health.release===process.env.EXPECTED_RELEASE)break;await new Promise(r=>setTimeout(r,2000));}
 assert.equal(report.health.release,process.env.EXPECTED_RELEASE||report.health.release);assert.equal(report.health.meta_ingress_enabled,false);
 const shell=await fetch(base+'/marketplace/pilot');assert.equal(shell.status,200);assert.ok(!(await shell.text()).includes(token));assert.equal((await fetch(base+'/marketplace/preview',{method:'POST',body:'{}'})).status,401);
 const pointer=await(await fetch('https://conectatech-ec.github.io/datos-593/estado-ultimo-corte.json',{signal:AbortSignal.timeout(20000)})).json();report.shared_cut={cut_date:pointer.fecha_corte,sha256:pointer.origen_sha256};
 for(const channel of ['marketplace_personal','messenger_page','whatsapp_business']){
  for(const [sku,message] of [['TELF017','Busco un Redmi 15C de 128 GB'],['TELF001','Quiero información del ZTE A56 Pro'],['REL046','Busco un Infinix XWATCH H4']]){
   const d=await ask(channel,crypto.randomUUID(),message);assert.deepEqual(d.focus,[sku]);assert.equal(d.inventory_cut_date,pointer.fecha_corte);assert.equal(d.source_sha256,pointer.origen_sha256);assert.equal(d.source_kind,'shared_validated_central_593');
   report.checks.push({channel,sku,text:d.text,source_fresh:d.source_fresh,cut:d.inventory_cut_date,source_sha256:d.source_sha256,image:d.image,banner:d.acquisition.banners[0],transport:d.acquisition.transport});
  }
 }
 const session=crypto.randomUUID();
 for(const message of ['Busco un Redmi 15C de 128 GB','¿Cuál es el precio de contado?','¿Y con tarjeta cuánto cuesta?','Pero no tengo tarjeta Pacífico','Tengo Pichincha','Quiero contraentrega en Quito','¿Y envíos nacionales?','Muéstrame la fotografía','No compraré todavía','Quiero continuar después']){
  const d=await ask('messenger_page',session,message);assert.deepEqual(d.focus,['TELF017']);assert.notEqual(d.action,'handoff');assert.ok(!d.text.includes('En octubre, Pacífico'));report.conversations.push({message,text:d.text,focus:d.focus,image:d.image,buttons:d.quick_replies.map(q=>q.title)});
 }
 const ambiguity=await ask('marketplace_personal',crypto.randomUUID(),'Busco un Redmi 15C');assert.equal(ambiguity.focus.length,2);assert.ok(ambiguity.acquisition.handoff.prefilled_message.includes('versión por confirmar'));
 const picked=await ask('messenger_page',crypto.randomUUID(),'Elijo este producto',{quick_reply_payload:'ALEX:choose:TELF018'});assert.deepEqual(picked.focus,['TELF018']);
 const direct=await fetch(base+'/alex/chat',{method:'POST',headers,body:JSON.stringify({session_id:crypto.randomUUID(),message:'¿Qué batería tiene el Redmi 15C de 128 GB?',catalog_only:true})});assert.equal(direct.status,200);const a=await direct.json();assert.deepEqual(a.focus,['TELF017']);assert.ok(a.text.includes('6000 mAh'));assert.equal(a.source_sha256,pointer.origen_sha256);report.original_Alex_path={focus:a.focus,text:a.text,source_sha256:a.source_sha256};
 report.private_source=await get('/commercial/catalog/status');report.seller=await get('/messenger/status');report.quota=await get('/alex/quota');assert.equal(report.seller.reception_enabled,false);report.passed=true;
}catch(e){report.error=String(e.message).slice(0,500);}
const path=new URL('./generated/fase2/',import.meta.url);await mkdir(path,{recursive:true});await writeFile(new URL('marketplace-cloud.json',path),JSON.stringify(report,null,2)+'\n');
// Seller status includes only already sanitized operational fields, never PSID or token values.
console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
