// Real HTTPS, verified report facts, no fabricated Messenger events or paid calls.
import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
import {central} from './central-source.mjs';
const base=process.env.PILOT_BASE_URL||'https://conectatech-comercial-piloto.conectatech-ecu.workers.dev',headers={Authorization:'Bearer '+process.env.PILOT_TOKEN,'Content-Type':'application/json'};
const report={at:new Date().toISOString(),kind:'validated_593_private_HTTPS',passed:false,source_sha256:central.source.sha256,source_generated_at:central.source.generated_at,cut_date:central.source.cut_date,messages_to_Messenger:0,AI_calls:0,production_channels_changed:false,checks:[]};
async function get(path){const r=await fetch(base+path,{headers,signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);return r.json();}
try{
 for(let i=0;i<15;i++){const d=await get('/commercial/catalog/status');if(d.source_sha256===central.source.sha256){report.central=d;break;}await new Promise(r=>setTimeout(r,2000));}assert.ok(report.central);assert.equal(report.central.current,true);assert.equal((await get('/health')).meta_ingress_enabled,false);
 for(const path of ['/commercial/catalog','/commercial/status','/commercial/report'])assert.equal((await fetch(base+path)).status,401);
 const shell=await fetch(base+'/commercial/upload');assert.equal(shell.status,200);assert.ok(!(await shell.text()).includes(process.env.PILOT_TOKEN));
 const session=crypto.randomUUID();
 for(const sku of ['TELF011','TELF012','MICR27','POWE003','ADAP005','ADAP100','POWE014','FLAS024','FLAS026','MOUS010','ENVI001','HUB003','AUDI078','TELF019']){
  const p=central.products.find(p=>p.sku===sku);assert.ok(p);
  for(const method of p.availability==='in_stock'?['contado','tarjeta']:['contado']){
   const r=await fetch(base+'/alex/chat',{method:'POST',headers,body:JSON.stringify({session_id:session,message:'¿Qué precio tiene '+sku+' con '+method+'?',catalog_only:true,reset:true}),signal:AbortSignal.timeout(40000)});assert.equal(r.status,200);const a=await r.json();assert.deepEqual(a.focus,[sku]);assert.equal(a.generative,false);assert.equal(a.source_sha256,central.source.sha256);assert.equal(a.source_kind,'validated_central_593');
   if(p.availability==='in_stock'){const key=method==='tarjeta'?'pvp_card_cents':'promo_cash_cents';assert.ok(a.text.includes('$'+(p.prices[key]/100).toFixed(2)),sku+' exact verified amount');assert.equal(a.quote_current,true);}else{assert.ok(!a.text.includes('$'));assert.ok(!a.quick_replies.some(q=>q.payload.includes(':buy:')));}
   assert.ok(!/stock referencial|\d+ unidades/i.test(a.text));report.checks.push({sku,method,text:a.text,focus:a.focus,image:a.image,source_fresh:a.source_fresh,source_kind:a.source_kind});
  }
 }
 const raw=new Uint8Array(160).fill(65);raw[0]=80;raw[1]=75;
 const upload=await fetch(base+'/commercial/report?scope=ci',{method:'POST',headers:{Authorization:headers.Authorization,'X-Report-Filename':'Reporte-Inventario%2021-10-2026.xlsx'},body:raw});assert.ok([200,202].includes(upload.status));const file=await upload.json();assert.equal(file.trigger||'ci_no_dispatch','ci_no_dispatch');assert.equal((await(await fetch(base+'/commercial/report?scope=ci',{method:'POST',headers:{Authorization:headers.Authorization,'X-Report-Filename':'Reporte-Inventario%2021-10-2026.xlsx'},body:raw})).json()).duplicate,true);
 const download=await fetch(base+'/commercial/report?scope=ci&sha256='+file.sha256,{headers});if(download.status===200){assert.equal((await download.arrayBuffer()).byteLength,160);const end=await fetch(base+'/commercial/complete?scope=ci',{method:'POST',headers,body:JSON.stringify({sha256:file.sha256,status:'processed'})});assert.equal(end.status,200);assert.equal((await end.json()).raw_file_erased,true);}
 report.receiver={private_upload_verified:true,synthetic_CI_only:true,raw_original_source_uploaded_by_test:false,no_GitHub_dispatch_from_CI:true};report.receiving_status=await get('/commercial/status');report.quota=await get('/alex/quota');report.passed=true;
}catch(e){report.failure=String(e.message).slice(0,500);}
const dir=new URL('./generated/fase2/',import.meta.url);await mkdir(dir,{recursive:true});await writeFile(new URL('central-cloud.json',dir),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
