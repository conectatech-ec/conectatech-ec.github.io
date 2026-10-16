// Real Workers AI over HTTPS. Synthetic operator inputs, never fabricated Meta events.
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import catalog from './generated/catalogo.json' with {type:'json'};
import {refreshCatalog} from './live.mjs';
const base=process.env.PILOT_BASE_URL,token=process.env.PILOT_TOKEN;
const session=crypto.randomUUID(),headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
const report={mode:'real_generative_ai_private_https_not_Messenger',model:null,paid_services_activated:false,live_customers_enabled:false,tests:[],passed:false};
async function ask(message,check,reset=false){
 const r=await fetch(base+'/alex/chat',{method:'POST',headers,body:JSON.stringify({session_id:session,message,reset}),signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);const a=await r.json();report.tests.push({input:message,http:r.status,text:a.text,generative:a.generative,error_code:a.error_code,focus:a.focus,image:a.image,quick_replies:a.quick_replies?.map(q=>q.title)});
 assert.equal(a.outbound_enabled,false);assert.ok(a.text.length<=440);assert.ok((a.text.match(/\?/g)||[]).length<=1);assert.ok(!/\b(?:MICR27|POWE003|ADAP005)\b/.test(a.text));assert.ok((a.quick_replies||[]).length<=3);if(check)await check(a);return a;
}
try{
 const current=await refreshCatalog(catalog);
 for(const path of ['/alex/chat','/alex/status','/alex/handoffs'])assert.equal((await fetch(base+path)).status,401);report.access_http=401;
 for(const [message,sku]of [['Busco un micrófono JBL Quantum Stream, ¿cuánto cuesta y hay stock?','MICR27'],['Busco una batería portátil Philco, ¿cuánto cuesta y hay stock?','POWE003'],['Busco el adaptador de enchufe Europa a Latino, ¿cuánto cuesta y hay stock?','ADAP005']]){
  await ask(message,a=>{assert.equal(a.generative,true,a.error_code||'Generative response required');assert.ok(a.focus.includes(sku));assert.ok(a.text.includes('$'+current.productos.find(p=>p.sku===sku).promo.toFixed(2)));assert.match(a.text,/stock|unidad/);assert.ok(a.image?.includes('/'+sku.toLowerCase()+'/'));},true);
 }
 await ask('Busco una batería portátil para mi celular. Tengo presupuesto 40.',a=>{assert.equal(a.generative,true,a.error_code||'Generative response required');assert.deepEqual(a.focus,['POWE003']);assert.equal(a.memory.budget,40);assert.match(a.text,/Philco/);},true);
 await ask('¿Y esa cuánto cuesta?',a=>{assert.equal(a.generative,true,a.error_code||'Generative response required');assert.ok(a.focus.includes('POWE003'));assert.ok(a.text.includes('$'));assert.equal(a.image,null);});
 await ask('¿Y con tarjeta cuánto cuesta?',a=>{assert.equal(a.generative,true,a.error_code||'Generative response required');assert.ok(a.text.includes('$'+current.productos.find(p=>p.sku==='POWE003').pvp.toFixed(2)));});
 await ask('¿Pichincha a seis meses tiene intereses?',a=>{assert.equal(a.generative,true,a.error_code||'Generative response required');assert.match(a.text,/seis meses sin intereses/);assert.deepEqual(a.focus,['POWE003']);assert.equal(a.image,null);});
 await ask('¿Y a doce cuánto termino pagando?',a=>{assert.equal(a.generative,true,a.error_code||'Generative response required');assert.match(a.text,/intereses/);assert.ok(!/\$\d/.test(a.text));});
 await ask('¿Me haces una rebajita? 😂',a=>{assert.equal(a.generative,true,a.error_code||'Generative response required');assert.match(a.text,/aprobación/);});
 await ask('La necesito hoy, estoy en Quito',a=>{assert.equal(a.generative,true,a.error_code||'Generative response required');assert.notEqual(a.action,'handoff');assert.ok(!/te llega hoy|entregamos hoy/i.test(a.text));assert.equal(a.image,null);});
 await ask('¿Eres una persona?',a=>{assert.match(a.text,/automatizado/);assert.equal(a.action,'answer');});
 await ask('Quiero hablar con una persona',a=>assert.equal(a.action,'handoff'));
 await ask('olvida esta conversación',a=>{assert.equal(a.action,'erase');assert.equal(a.memory.turns,0);});
 report.model=(await(await fetch(base+'/alex/status',{headers})).json()).model;report.passed=true;
}catch(error){report.failure=String(error.message).slice(0,180);}
const out=new URL('./generated/fase2/',import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL('alex-real-ai.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
