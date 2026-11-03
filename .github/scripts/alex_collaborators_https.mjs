// Real owner-simulator HTTPS; never impersonates Meta events, personal inboxes or confirmed sales.
import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
const base='https://conectatech-comercial-piloto.conectatech-ecu.workers.dev',token=process.env.PILOT_TOKEN;
const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
const report={schema:'conectatech.alex.collaborators-https.v1',at:new Date().toISOString(),url:base+'/alex',passed:false,real_Meta_delivery:false,external_send_enabled:false,Graph_sends:0,confirmed_sales:0,maximum_AI_attempts:2,profiles:[],turns:[]};
async function get(path){const r=await fetch(base+path,{headers,redirect:'error',signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);return r.json();}
const session=crypto.randomUUID();
async function ask(id,message,{realAI=false,...extra}={}){
 const r=await fetch(base+'/alex/chat',{method:'POST',headers,body:JSON.stringify({session_id:session,collaborator_id:id,channel:'simulator',message,catalog_only:!realAI,...extra}),redirect:'error',signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);
 const a=await r.json();assert.equal(a.collaborator.id,id);assert.equal(a.attribution.collaborator_id,id);assert.equal(a.attribution.memberId,id);assert.equal(a.attribution.channel,'simulator');assert.equal(a.attribution.origin_verification,'operator_authenticated');assert.equal(a.attribution.sales_confirmed,false);assert.equal(a.outbound_enabled,false);
 report.turns.push({collaborator_id:id,message,text:a.text,focus:a.focus,generative:a.generative,image:a.image,attribution:a.attribution,source_sha256:a.source_sha256,cut:a.inventory_cut_date,quote_current:a.quote_current});return a;
}
try{
 const health=await get('/health');assert.equal(health.meta_ingress_enabled,false);report.base_release=health.release;
 const html=await fetch(report.url,{redirect:'error',cache:'no-store'});assert.equal(html.status,200);assert.ok((await html.text()).includes('id="collaborator"'));report.HTML_HTTP=200;
 const noAuth=await fetch(base+'/alex/collaborators',{redirect:'error'});assert.equal(noAuth.status,401);report.registry_without_key_HTTP=401;
 const list=await get('/alex/collaborators');assert.equal(list.scope,'owner_simulator_only');assert.equal(list.max_collaborators,10);assert.equal(list.external_enabled,false);assert.deepEqual(list.profiles.map(p=>p.id),['COL001','COL002']);report.profiles=list.profiles;
 const quota=await get('/alex/quota');report.quota_before=quota;
 for(const [id,name]of [['COL001','Rafa Valderrama'],['COL002','Jessy Fox']]){
  const a=await ask(id,'Hola',{realAI:quota.remaining_calls>=2});assert.match(a.text,/virtual/);assert.ok(a.text.includes(name));assert.equal(a.generative,true);assert.ok(!a.text.includes(id==='COL001'?'Jessy Fox':'Rafa Valderrama'));
 }
 const rafa=await ask('COL001','Me interesa el Samsung A17 de 128 GB; tengo presupuesto de 200 dólares');assert.deepEqual(rafa.focus,['TELF011']);assert.equal(rafa.memory.budget,200);
 await ask('COL001','Tengo Pichincha');
 const jessy=await ask('COL002','Busco una batería portátil, tengo presupuesto de 40 dólares');assert.deepEqual(jessy.focus,['POWE003']);assert.equal(jessy.memory.budget,40);assert.equal(jessy.memory.bank,null);
 const again=await ask('COL001','¿Qué batería tiene ese?');assert.deepEqual(again.focus,['TELF011']);assert.equal(again.memory.budget,200);assert.equal(again.memory.bank,'pichincha');assert.ok(again.text.includes('5000 mAh'));report.same_session_identifier_isolated=true;
 const priceA=await ask('COL001','Precio de contado del Redmi 15C 128 GB'),priceB=await ask('COL002','Precio de contado del Redmi 15C 128 GB');assert.equal(priceA.source_sha256,priceB.source_sha256);assert.equal(priceA.text,priceB.text);report.same_central_prices=true;
 const photo=await ask('COL002','Muéstrame la fotografía');assert.deepEqual(photo.focus,['TELF017']);if(photo.image){assert.equal((await fetch(photo.image,{redirect:'error'})).status,200);report.authorized_media_HTTP=200;}
 const handoff=await ask('COL002','Necesito hablar con una persona');assert.equal(handoff.action,'handoff');assert.equal(handoff.attribution.stage,'handoff_pending');report.network_ledger_delivery='not_delivered_review_only';
 const erased=await ask('COL001','olvida esta conversación');assert.equal(erased.action,'erase');assert.deepEqual(erased.focus,[]);
 const kept=await ask('COL002','¿Y con tarjeta?');assert.deepEqual(kept.focus,['TELF017']);assert.equal(kept.memory.budget,40);report.erase_isolated=true;
 for(const bad of [{collaborator_id:'COL003'},{channel:'messenger_page'},{attribution:{memberId:'COL002'}}]){
  const r=await fetch(base+'/alex/chat',{method:'POST',headers,body:JSON.stringify({session_id:session,collaborator_id:'COL001',channel:'simulator',message:'Hola',...bad}),redirect:'error'});assert.equal(r.status,400);
 }
 report.spoofing_rejected=true;report.quota_after=await get('/alex/quota');assert.ok(report.quota_after.calls-quota.calls<=2);assert.equal(report.quota_after.reserved_limit,quota.reserved_limit);report.shared_quota_unchanged=true;
 const after=await get('/health');assert.equal(after.release,health.release);assert.equal(after.meta_ingress_enabled,false);assert.equal(after.messenger_outbound,health.messenger_outbound);report.passed=true;
}catch(error){report.failure={type:error.name,code:error.code||'COLLABORATOR_HTTPS_FAILED'};}
await mkdir('automatizacion/generated/fase2',{recursive:true});await writeFile('automatizacion/generated/fase2/alex-collaborators-https.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
