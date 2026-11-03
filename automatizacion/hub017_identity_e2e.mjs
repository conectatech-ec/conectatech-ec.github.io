// HUB017 operator-only HTTPS check. No AI, customer events, stock writes or Graph sends.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
const base='https://conectatech-comercial-piloto.conectatech-ecu.workers.dev';
const publicBase='https://conectatech-ec.github.io';
const sha='756693acd771ee3ae6c0881d173c802be18b82c2ccae2957d61189b5d01384f0';
const image=publicBase+'/imagenes/hub017/HUB017-01.webp';
const imageSHA='1bcafdaf7ee44c13cd3324c008a962d36dd61a9c8bc23dbc287d07e421bb59bb';
const headers={Authorization:'Bearer '+process.env.PILOT_TOKEN,'Content-Type':'application/json'};
const rollback=JSON.parse(readFileSync(new URL('./activar-cloud.json',import.meta.url))).hub017_identity_mode==='rollback';
const report={sku:'HUB017',mode:rollback?'rollback':'apply',passed:false,AI_calls:0,Graph_sends:0,stock_or_price_writes:0,checks:[]};
try{
 const pointer=await fetch(publicBase+'/datos-593/estado-ultimo-corte.json',{signal:AbortSignal.timeout(20000)});assert.equal(pointer.status,200);const state=await pointer.json();assert.equal(state.origen_sha256,sha);assert.equal(state.fecha_corte,'2026-11-03');
 const health=await fetch(base+'/health',{signal:AbortSignal.timeout(20000)});assert.equal(health.status,200);const h=await health.json();assert.equal(h.meta_ingress_enabled,false);report.runtime_release=h.release;
 const session='hub017-approval-'+randomUUID();
 for(const [message,kind,amount]of [['Precio de contado HUB017','cash',1190],['Precio con tarjeta HUB017','card',1369],['Muéstrame la fotografía HUB017','photo',null]]){
  let d;
  for(let attempt=0;attempt<8;attempt++){
   const response=await fetch(base+'/marketplace/preview',{method:'POST',headers,body:JSON.stringify({channel:'messenger_page',session_id:session,message}),signal:AbortSignal.timeout(40000)});
   assert.equal(response.status,200);d=await response.json();
   if(d.quote_current===!rollback)break;
   await new Promise(resolve=>setTimeout(resolve,2500));
  }
  assert.deepEqual(d.focus,['HUB017']);assert.equal(d.generative,false);assert.equal(d.outbound_enabled,false);assert.equal(d.source_sha256,sha);assert.equal(d.inventory_cut_date,'2026-11-03');assert.equal(d.quote_current,!rollback);
  if(rollback){assert.equal(d.image,null);assert.ok(!d.text.includes('$'));}
  else if(amount!==null){assert.equal(d.source_fresh,true);const amounts=[...d.text.matchAll(/\$(\d+(?:\.\d{2})?)/g)].map(m=>Math.round(Number(m[1])*100));assert.ok(amounts.includes(amount));assert.ok(d.facts?.includes('HUB017.'+kind));}
  else assert.equal(d.image,image);
  report.checks.push({kind,text:d.text,source_sha256:d.source_sha256,source_fresh:d.source_fresh,quote_current:d.quote_current,image:d.image,generative:d.generative,outbound_enabled:d.outbound_enabled});
 }
 const photo=await fetch(image,{signal:AbortSignal.timeout(20000)});assert.equal(photo.status,200);assert.equal(createHash('sha256').update(Buffer.from(await photo.arrayBuffer())).digest('hex'),imageSHA);
 report.public_image_verified=true;report.passed=true;
}catch(e){report.error=String(e.message).slice(0,600);process.exitCode=1;}
await mkdir(new URL('./generated/fase2/',import.meta.url),{recursive:true});await writeFile(new URL('./generated/fase2/hub017-identity-cloud.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
