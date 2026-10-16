// Actual Workers AI over HTTPS in a private demo namespace; no fabricated Messenger events.
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import baseline from './generated/catalogo.json' with {type:'json'};
import {refreshCatalog} from './live.mjs';
const base=process.env.PILOT_BASE_URL,headers={Authorization:'Bearer '+process.env.PILOT_TOKEN,'Content-Type':'application/json'},session=crypto.randomUUID();
const report={mode:'real_ai_context_upgrade_private_https_not_Messenger',passed:false,paid_services_activated:false,messages_sent_to_Messenger:0,tests:[]};
async function get(path){const r=await fetch(base+path,{headers,signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r.json();}
async function ask(message,check,reset=false){const r=await fetch(base+'/alex/chat',{method:'POST',headers,body:JSON.stringify({session_id:session,message,reset}),signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);const a=await r.json();report.tests.push({input:message,text:a.text,generative:a.generative,error_code:a.error_code,focus:a.focus,image:a.image,buttons:a.quick_replies?.map(x=>x.title),memory:a.memory});assert.equal(a.outbound_enabled,false);assert.ok(a.text.length<=440);assert.ok((a.text.match(/\?/g)||[]).length<=1);assert.ok(!/\b(?:MICR27|POWE003|ADAP005)\b/.test(a.text));await check(a);return a;}
const real=a=>assert.equal(a.generative,true,a.error_code||'Real model response required');
try{
 const source=await refreshCatalog(baseline);report.quota_before=await get('/alex/quota');assert.ok(report.quota_before.remaining_calls>=10,'Free local quota insufficient for ten model tests; no paid fallback');
 for(const path of ['/alex/quota','/alex/review/queue','/alex/review/mode','/alex/review/decision','/alex/review/regenerate'])assert.equal((await fetch(base+path)).status,401);report.private_endpoints_http=401;
 const shell=await fetch(base+'/alex/review');assert.equal(shell.status,200);const html=await shell.text();assert.ok(!html.includes(process.env.PILOT_TOKEN));new Function(html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1]);report.review_shell_http=200;
 const queue=await get('/alex/review/queue');report.review={required:queue.required,pending_count:queue.drafts.filter(d=>d.decision==='pending').length,scope:queue.scope,live_customers_enabled:queue.live_customers_enabled};assert.equal(queue.live_customers_enabled,false);
 const ci=await fetch(base+'/alex/review/mode?scope=ci',{method:'POST',headers,body:'{"required":true}'});assert.equal(ci.status,409);report.ci_review_mutation_http=409;
 for(const [input,sku]of [['Busco el JBL Quantum Stream, ¿cuánto cuesta y hay stock?','MICR27'],['Quiero la batería Philco, ¿cuánto cuesta y hay stock?','POWE003'],['¿Cuánto cuesta el adaptador Europa a Latino y hay stock?','ADAP005']])await ask(input,a=>{real(a);assert.deepEqual(a.focus,[sku]);assert.ok(a.text.includes('$'+source.productos.find(p=>p.sku===sku).promo.toFixed(2)));assert.match(a.text,/disponibilidad/i);assert.ok(a.image?.includes('/'+sku.toLowerCase()+'/'));},true);
 await ask('Busco una batería portátil para mi celular; mi presupuesto es de cuarenta dólares.',a=>{real(a);assert.deepEqual(a.focus,['POWE003']);assert.equal(a.memory.budget,40);},true);
 await ask('Mi presupuesto ahora 35. Pago al contado y estoy en La Carolina, Quito. Quiero entrega en Quito.',a=>{real(a);assert.equal(a.memory.budget,35);assert.equal(a.memory.payment,'contado');assert.equal(a.memory.delivery,'quito');assert.match(a.memory.sector,/Carolina/i);assert.ok(!/\?[^?]*(?:presupuesto|sector)|(?:presupuesto|sector)[^?]*\?/i.test(a.text));});
 await ask('No quiero hablar con una persona todavía; prefiero seguir contigo.',a=>{real(a);assert.notEqual(a.action,'handoff');assert.equal(a.memory.budget,35);assert.equal(a.memory.payment,'contado');});
 await ask('¿Me muestras otra vez la foto de esa batería?',a=>{real(a);assert.deepEqual(a.focus,['POWE003']);assert.ok(a.image?.includes('/powe003/'));assert.ok(a.quick_replies.some(q=>q.payload==='ALEX:cash:POWE003'));});
 await ask('¿Qué capacidad tiene esa batería?',a=>{real(a);assert.match(a.text,/20\.000 mAh/);assert.equal(a.image,null);});
 await ask('¿Me haces una rebajita? 😂',a=>{real(a);assert.match(a.text,/aprobación/);});
 await ask('¿Y con tarjeta cuánto cuesta?',a=>{real(a);assert.ok(a.text.includes('$'+source.productos.find(p=>p.sku==='POWE003').pvp.toFixed(2)));assert.equal(a.memory.payment,'contado');});
 await ask('¿Eres una persona?',a=>{assert.match(a.text,/automatizado/);assert.equal(a.action,'answer');});
 await ask('olvida esta conversación',a=>{assert.equal(a.action,'erase');assert.equal(a.memory.turns,0);});
 report.quota_after=await get('/alex/quota');report.passed=true;
}catch(e){report.failure=String(e.message).slice(0,200);}
const folder=new URL('./generated/fase2/',import.meta.url);await mkdir(folder,{recursive:true});await writeFile(new URL('alex-context-upgrade.json',folder),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
