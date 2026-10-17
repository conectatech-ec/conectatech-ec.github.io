// A targeted real regression after the recorded 24-turn run, not a full-run pass.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.PILOT_BASE_URL,headers={Authorization:'Bearer '+process.env.PILOT_TOKEN,'Content-Type':'application/json'},session=crypto.randomUUID();
const report={mode:'two_real_ai_regression_turns_not_a_full_24_turn_pass',passed:false,messages_sent_to_Messenger:0,paid_services_activated:false,tests:[]};
async function quota(){const r=await fetch(base+'/alex/quota',{headers});assert.equal(r.status,200);return r.json();}
try{
 report.quota_before=await quota();assert.ok(report.quota_before.remaining_calls>=2,'No additional free budget available; no paid fallback');
 for(const input of ['¿Cuánto cuesta de contado el JBL Quantum Stream? Pago al contado. Quiero retiro en tienda.','¿Qué cambia entre cardioide y omnidireccional?']){
  const r=await fetch(base+'/alex/chat',{method:'POST',headers,body:JSON.stringify({session_id:session,message:input}),signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);const a=await r.json();report.tests.push({input,text:a.text,generative:a.generative,facts:a.facts,image:a.image,buttons:a.quick_replies?.map(x=>x.title),memory:a.memory});
  assert.equal(a.generative,true,a.error_code);assert.equal(a.outbound_enabled,false);assert.deepEqual(a.focus,['MICR27']);assert.ok(!/stock|referencial|\b\d+\s+unidades?\b/i.test(a.text));assert.ok(a.text.length<=440);assert.equal(a.memory.payment,'contado');assert.equal(a.memory.delivery,'retiro');
  if(report.tests.length===1){assert.ok(a.text.startsWith('💵'));assert.ok(a.image?.includes('/micr27/'));}else{assert.deepEqual(a.facts,['MICR27.patterns']);assert.match(a.text,/cardioide.*omnidireccional/);assert.ok(!/Retiro|Diciembre|local 3/.test(a.text));assert.ok(a.quick_replies.length>=2);}
 }
 report.quota_after=await quota();report.passed=true;
}catch(e){report.failure=String(e.message).slice(0,350);}
const folder=new URL('./generated/fase2/',import.meta.url);await mkdir(folder,{recursive:true});await writeFile(new URL('alex-targeted-regression.json',folder),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
