// Small real conversation when free reservations exist. Never resets/raises the budget.
// Synthetic text enters the private demo only, never Meta or the tester's conversation.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import baseline from './generated/catalogo.json' with {type:'json'};
import {refreshCatalog,verifyAssets} from './live.mjs';
import {factBook} from './alex.mjs';
const base=process.env.PILOT_BASE_URL,headers={Authorization:'Bearer '+process.env.PILOT_TOKEN,'Content-Type':'application/json'},session=crypto.randomUUID();
const report={mode:'private_https_conversation_not_Messenger',at:new Date().toISOString(),status:'running',passed:null,protocol_passed:false,real_generative_turns:0,messages_sent_to_Messenger:0,paid_services_activated:false,assets:[],tests:[]};
async function get(path){const r=await fetch(base+path,{headers,signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r.json();}
async function ask(message){
 const r=await fetch(base+'/alex/chat',{method:'POST',headers,body:JSON.stringify({session_id:session,message}),signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);const a=await r.json();
 report.tests.push({input:message,text:a.text,generative:a.generative,error_code:a.error_code,facts:a.facts,focus:a.focus,image:a.image,buttons:a.quick_replies?.map(q=>q.title),memory:a.memory});
 assert.equal(a.outbound_enabled,false);assert.ok(a.text.length<=440);assert.ok((a.text.match(/\?/g)||[]).length<=1);assert.ok(!/\b(?:MICR27|POWE003|ADAP005|stock|referencial)\b/i.test(a.text));
 return a;
}
try{
 for(let i=0;i<15;i++){const health=await get('/health');if(health.release===process.env.EXPECTED_RELEASE){report.health=health;break;}await new Promise(r=>setTimeout(r,2000));}
 assert.ok(report.health,'Expected release is not served');assert.equal(report.health.meta_ingress_enabled,false);assert.equal(report.health.alex_generative,true);assert.equal(report.health.cloud_bindings,false);
 for(const path of ['/alex/chat','/alex/quota','/alex/review/queue','/messenger/seller/results'])assert.equal((await fetch(base+path)).status,401);report.private_routes_http=401;
 const source=await refreshCatalog(baseline),book=factBook(source);
 for(const p of source.productos){
  const media=await verifyAssets(p);const r=await fetch(base+'/banners/'+p.sku,{headers,signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);const html=await r.text();assert.ok(html.includes(p.foto));assert.ok(html.includes(p.promo.toFixed(2)));report.assets.push({sku:p.sku,banner_http:r.status,current_price:p.promo,current_card_price:p.pvp,source_fresh:true,verified_media:media});
 }
 const status=await get('/messenger/status');assert.equal(status.mode,'development-only');assert.equal(status.reception_enabled,false);assert.equal(status.test_senders_present,true);report.tester_outbound_enabled=status.outbound_enabled;report.protocol_passed=true;
 report.quota_before=await get('/alex/quota');
 // Leave at least two reservations to the personal tester. No live model call when exhausted.
 if(report.quota_before.remaining_calls<4){
  report.status='blocked_free_quota';report.resume_at=report.quota_before.reset_at;
  if(report.quota_before.remaining_calls===0){const a=await ask('Busco una batería para mi celular');assert.equal(a.generative,false);assert.equal(a.error_code,'FREE_QUOTA_REACHED');assert.deepEqual(a.facts,[]);assert.equal(a.image,null);report.quota_guard_verified=true;}
 }else{
  let a=await ask('Busco una batería para mi celular. En los viajes siempre termino buscando un enchufe 😂. Mi presupuesto es de cuarenta dólares.');
  assert.equal(a.generative,true,a.error_code);report.real_generative_turns++;assert.deepEqual(a.focus,['POWE003']);assert.equal(a.memory.budget,40);assert.ok(a.text.startsWith('💵'));assert.ok(a.image?.includes('/powe003/'));assert.ok(a.text.includes('?'),'The recommendation must open a useful conversation');
  for(const amount of a.text.match(/\$\d+(?:\.\d{2})?/g)||[])assert.ok(a.facts.some(k=>book[k]?.includes(amount)));
  a=await ask('Me preocupa quedarme sin batería cuando trabajo fuera de casa. No quiero comprar todavía; quiero elegir con calma. ¿Qué debería tener en cuenta?');
  assert.equal(a.generative,true,a.error_code);report.real_generative_turns++;assert.deepEqual(a.focus,['POWE003']);assert.equal(a.memory.budget,40);assert.notEqual(a.action,'interest');assert.ok(!a.quick_replies.some(q=>q.payload.includes(':buy:')));assert.ok(!/\b(?:hola|epa|bienvenid[oa])\b/i.test(a.text));
  for(const k of a.facts)assert.ok(Object.hasOwn(book,k));
  report.status='passed';report.passed=true;
 }
 report.quota_after=await get('/alex/quota');
}catch(e){report.status='failed';report.passed=false;report.failure=String(e.message).slice(0,400);}
const folder=new URL('./generated/fase2/',import.meta.url);await mkdir(folder,{recursive:true});await writeFile(new URL('alex-conversation-flow.json',folder),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(report.passed===false)process.exitCode=1;
