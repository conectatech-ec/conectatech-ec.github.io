// One real generative operator turn plus factual follow-ups and erase. No Meta sends.
import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
const base='https://conectatech-comercial-piloto.conectatech-ecu.workers.dev',token=process.env.PILOT_TOKEN;
const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
const report={schema:'conectatech.alex.simulator-https.v1',at:new Date().toISOString(),url:base+'/alex',passed:false,Graph_sends:0,new_services:0,external_customers_enabled:false,turns:[]};
async function get(path,auth=true){const r=await fetch(base+path,{headers:auth?headers:{},redirect:'error',signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);return r.json();}
async function chat(session,message,extra={}){const r=await fetch(base+'/alex/chat',{method:'POST',headers,body:JSON.stringify({session_id:session,message,...extra}),redirect:'error',signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);const a=await r.json();assert.equal(a.outbound_enabled,false);return a;}
try{
 const h=await get('/health',false);assert.equal(h.meta_ingress_enabled,false);assert.equal(h.release,process.env.EXPECTED_ENGINE_RELEASE);report.engine_release=h.release;
 const htmlResponse=await fetch(report.url,{cache:'no-store',redirect:'error'});assert.equal(htmlResponse.status,200);const html=await htmlResponse.text();assert.ok(html.includes('Nueva conversación'));assert.ok(!html.includes(token));assert.ok(htmlResponse.headers.get('content-security-policy')?.includes("connect-src 'self'"));report.html_http=htmlResponse.status;
 const denied=await fetch(base+'/alex/status',{redirect:'error'});assert.equal(denied.status,401);report.unauthenticated_http=denied.status;
 const status=await get('/alex/status');assert.equal(status.free_only,true);report.model=status.model;
 const quota=await get('/alex/quota');report.quota_before=quota;
 const session=crypto.randomUUID(),first=await chat(session,'Busco un Redmi 15C de 128 GB para trabajar, tengo presupuesto de 180 dólares. ¿Qué me aconsejas?');assert.deepEqual(first.focus,['TELF017']);report.real_generative_response=first.generative===true;
 report.turns.push({message:'Consulta natural de Redmi 15C 128 GB',text:first.text,generative:first.generative,error_code:first.error_code,source_sha256:first.source_sha256,cut:first.inventory_cut_date,source_fresh:first.source_fresh});
 const follow=await chat(session,'¿Y con tarjeta?');assert.deepEqual(follow.focus,['TELF017']);assert.equal(follow.memory.budget,180);assert.equal(follow.source_sha256,first.source_sha256);report.context_verified=true;report.turns.push({message:'¿Y con tarjeta?',text:follow.text,focus:follow.focus});
 const picture=await chat(session,'Muéstrame la fotografía');assert.deepEqual(picture.focus,['TELF017']);assert.ok(picture.image?.startsWith('https://conectatech-ec.github.io/imagenes/'));const img=await fetch(picture.image,{redirect:'error'});assert.equal(img.status,200);report.authorized_image_http=img.status;
 const erase=await chat(session,'olvida esta conversación',{catalog_only:true});assert.equal(erase.action,'erase');assert.deepEqual(erase.focus,[]);report.context_erased=true;
 const after=await get('/health',false);assert.equal(after.release,h.release);assert.equal(after.meta_ingress_enabled,false);assert.equal(after.messenger_outbound,h.messenger_outbound);
 report.quota_after=await get('/alex/quota');assert.ok(report.quota_after.calls-quota.calls<=1);report.maximum_operator_AI_turns=1;
 assert.equal(report.real_generative_response,true,'GENERATIVE_MODEL_NOT_VERIFIED');report.passed=true;
}catch(error){report.failure={type:error.name,code:error.code||'SIMULATOR_HTTPS_FAILED'};}
await mkdir('automatizacion/generated/fase2',{recursive:true});await writeFile('automatizacion/generated/fase2/alex-simulator-https.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
