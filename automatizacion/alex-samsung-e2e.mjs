// Actual deployed HTTPS, synthetic public queries. No fabricated Messenger inbound events.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {refreshAlexCatalog,quoteCurrent} from './alex-catalog.mjs';
import {factBook} from './alex.mjs';
const base=process.env.PILOT_BASE_URL,headers={Authorization:'Bearer '+process.env.PILOT_TOKEN,'Content-Type':'application/json'},session=crypto.randomUUID();
const report={mode:'samsung_private_https_not_Messenger',at:new Date().toISOString(),passed:false,messages_sent:0,paid_services_activated:false,tests:[],model_calls:0,real_Messenger_verified:false};
async function get(path){const r=await fetch(base+path,{headers,signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);return r.json();}
async function ask(input,catalog_only=false){const r=await fetch(base+'/alex/chat',{method:'POST',headers,body:JSON.stringify({session_id:session,message:input,catalog_only}),signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);const a=await r.json();report.tests.push({input,catalog_only,text:a.text,generative:a.generative,response_mode:a.response_mode,error_code:a.error_code,focus:a.focus,facts:a.facts,image:a.image,buttons:a.quick_replies?.map(q=>q.title),source_fresh:a.source_fresh,source_error_code:a.source_error_code});if(a.generative)report.model_calls++;assert.equal(a.outbound_enabled,false);assert.notEqual(a.action,'handoff');assert.ok(a.text.length<=440);assert.ok(!/TELF011|TELF012|stock referencial|\d+ unidades/i.test(a.text));return a;}
try{
 for(let i=0;i<15;i++){const h=await get('/health');if(h.release===process.env.EXPECTED_RELEASE){report.health=h;break;}await new Promise(r=>setTimeout(r,2000));}assert.ok(report.health);assert.equal(report.health.meta_ingress_enabled,false);assert.equal(report.health.catalog_first,true);
 for(const path of ['/alex/chat','/messenger/seller/recover-model-handoffs','/alex/quota'])assert.equal((await fetch(base+path)).status,401);
 const recovery=await fetch(base+'/messenger/seller/recover-model-handoffs',{method:'POST',headers,body:'{}'});assert.equal(recovery.status,200);report.recovery=await recovery.json();assert.equal(report.recovery.messages_replayed,0);
 report.quota_before=await get('/alex/quota');const source=await refreshAlexCatalog(),book=factBook(source);report.source_published_at=source.fuente_fecha;
 let a=await ask('Hola, busco un celular Samsung');assert.deepEqual(a.focus,['TELF011','TELF012']);assert.match(a.text,/128 GB/);assert.match(a.text,/256 GB/);assert.match(a.text,/¿Cuál/);
 a=await ask('Me interesa el Samsung A17 de 128 GB para trabajar. ¿Qué me puedes contar?');assert.deepEqual(a.focus,['TELF011']);assert.ok(a.image?.includes('/telf011/'));assert.ok(!a.text.includes('$'));
 for(const [input,type]of [['¿Qué precio tiene ese Samsung A17 de 128 GB al contado?','cash'],['¿Y ese con tarjeta cuánto cuesta?','card']]){const before=await get('/alex/quota');a=await ask(input);assert.deepEqual(a.focus,['TELF011']);if(quoteCurrent(source,source.productos.find(p=>p.sku==='TELF011'))){assert.ok(a.text.includes(book['TELF011.'+type].match(/\$[\d.]+/)[0]));}else{assert.ok(!a.text.includes('$'));assert.match(a.text,/requiere confirmación/);}assert.equal((await get('/alex/quota')).calls,before.calls);}
 a=await ask('¿Qué batería tiene ese Samsung A17 de 128 GB?');assert.match(a.text,/5000 mAh/);assert.deepEqual(a.focus,['TELF011']);
 a=await ask('¿Tienen disponibilidad de ese Samsung A17 de 128 GB?');assert.ok(!/tenemos|disponible para|\d+ unidades/i.test(a.text));assert.ok(!a.text.includes('$'));
 a=await ask('¿Hacen contraentrega en Quito?');assert.match(a.text,/Contraentrega en Quito/);assert.match(a.text,/cobertura/);
 a=await ask('¿Y envíos nacionales?');assert.match(a.text,/costo adicional/);
 a=await ask('¿Qué precio tiene el Samsung A17 de 128 GB?',true);assert.equal(a.generative,false);assert.equal(a.response_mode,'verified_catalog');assert.notEqual(a.action,'handoff');
 report.quota_after=await get('/alex/quota');assert.ok(report.model_calls>=1,'At least one actual generative response, not only the catalog fallback');assert.ok(report.quota_after.remaining_calls>=20);report.passed=true;
}catch(e){report.failure=String(e.message).slice(0,400);}
const dir=new URL('./generated/fase2/',import.meta.url);await mkdir(dir,{recursive:true});await writeFile(new URL('alex-samsung-cloud.json',dir),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
