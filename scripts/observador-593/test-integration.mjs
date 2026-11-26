import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,readFile,writeFile,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {observerReady,dispatchReport,verifyPublished593} from './observer-dispatch.mjs';
const root=await mkdtemp(join(tmpdir(),'ct593-receiver-'));
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
const sha='a'.repeat(64),commit='b'.repeat(40),v={cut_date:'2026-11-26',generated_at:'2026-11-26T20:00:00.000Z'};
const env={COMMERCIAL_ACTIONS_TOKEN:'synthetic-secret',COMMERCIAL_OBSERVER_READY:'CT593_OBSERVER_V1',PILOT_TOKEN:'fixture'};
await test('despacho cerrado sin credencial o habilitación',async()=>{
 assert.equal(observerReady({}),false);assert.equal(observerReady({COMMERCIAL_ACTIONS_TOKEN:'x'}),false);
 assert.equal(await dispatchReport({},sha,{fetcher:()=>assert.fail('no network')}),'observer_not_ready');
});
await test('despacho usa únicamente publicador y rama originales',async()=>{
 let got;assert.equal(await dispatchReport(env,sha,{fetcher:async(url,options)=>{got={url,options};return new Response(null,{status:204});}}),'triggered');
 assert.ok(got.url.endsWith('/actions/workflows/publicar-corte-comercial-593.yml/dispatches'));
 assert.deepEqual(JSON.parse(got.options.body),{ref:'automatizacion/piloto-cloud-3sku-20261015',inputs:{source_sha256:sha,verify_only:false}});
 assert.equal(got.options.redirect,'manual');
});
await test('errores de despacho no se presentan como éxito',async()=>{
 assert.equal(await dispatchReport(env,sha,{fetcher:async()=>new Response(null,{status:302,headers:{Location:'https://untrusted.invalid'}})}),'dispatch_denied');
 assert.equal(await dispatchReport(env,sha,{fetcher:async()=>new Response(null,{status:403})}),'dispatch_denied');
 assert.equal(await dispatchReport(env,sha,{fetcher:async()=>{throw Error('timeout');}}),'dispatch_unavailable');
});
const publicFetcher=(alter={})=>async url=>url.includes('/compare/')?Response.json({status:'identical',merge_base_commit:{sha:commit},...alter.ancestry}):Response.json({origen_sha256:sha,fecha_corte:v.cut_date,revision_fuente:{generado_en:v.generated_at},...alter.state});
await test('sólo publicación exacta y ancestral en main puede cerrar recibo',async()=>{
 assert.equal(await verifyPublished593(sha,commit,v,{fetcher:publicFetcher()}),true);
 for(const alter of [{state:{origen_sha256:'c'.repeat(64)}},{ancestry:{status:'diverged'}},{ancestry:{merge_base_commit:{sha:'d'.repeat(40)}}}])assert.equal(await verifyPublished593(sha,commit,v,{fetcher:publicFetcher(alter)}),false);
});
await cp(new URL('./candidate/commercial-reception.mjs',import.meta.url),join(root,'commercial-reception.mjs'));
await cp(new URL('./observer-dispatch.mjs',import.meta.url),join(root,'observer-dispatch.mjs'));
await writeFile(join(root,'messenger-control.mjs'),"export const seal=async x=>'sealed:'+x; export const unseal=async x=>x.slice(7);\n");
await writeFile(join(root,'central-source.mjs'),"export const central={};export const validateCentral=()=>{};\n");
const receiver=await import(pathToFileURL(join(root,'commercial-reception.mjs')));
let dispatched=0;const realFetch=globalThis.fetch;
globalThis.fetch=async (url,options)=>{if(url.endsWith('/dispatches')){dispatched++;return new Response(null,{status:204});}return publicFetcher()(url);};
function box(){
 const db=new DatabaseSync(':memory:');return {db,name:'commercial-source',env,state:{storage:{setAlarm:async()=>{}}},sql:{exec:(q,...args)=>{const rows=db.prepare(q).all(...args);return {toArray:()=>rows};}}};
}
// Minimal safe ZIP directory, not a valid commercial inventory. Only the
// unchanged receiver container guard is exercised here, never the validator.
function zip(){
 let locals=[],central=[],offset=0;
 for(const name of ['xl/workbook.xml','xl/worksheets/sheet1.xml','docProps/core.xml']){
  const n=Buffer.from(name),body=Buffer.from('<fixture/>'),local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(n.length,26);local.writeUInt32LE(body.length,18);local.writeUInt32LE(body.length,22);
  locals.push(local,n,body);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt32LE(body.length,20);c.writeUInt32LE(body.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);central.push(c,n);offset+=30+n.length+body.length;
 }
 const c=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(3,8);end.writeUInt16LE(3,10);end.writeUInt32LE(c.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,c,end]);
}
const bytes=zip();const sourceSha=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');
const upload=()=>new Request('https://inbox/commercial/report',{method:'POST',body:bytes,headers:{'X-Report-Filename':'Reporte-Inventario.xlsx','X-Report-SHA256':sourceSha,'X-Report-Detected-At':new Date().toISOString()}});
const operation=data=>new Request('https://inbox/commercial/complete',{method:'POST',body:JSON.stringify({sha256:sourceSha,...data})});
const b=box();receiver.commercialInit(b);
await test('migración aditiva idempotente conserva tabla y recibos',async()=>{receiver.commercialInit(b);assert.ok(b.sql.exec('PRAGMA table_info(commercial_receipts)').toArray().some(c=>c.name==='published_commit'));});
await test('dos cargas concurrentes producen una recepción y un despacho',async()=>{
 const result=await Promise.all([receiver.commercialFetch('/commercial/report',upload(),b),receiver.commercialFetch('/commercial/report',upload(),b)]);
 const bodies=await Promise.all(result.map(r=>r.json()));assert.ok(bodies.every(x=>x.received));assert.equal(b.sql.exec('SELECT COUNT(*) AS n FROM commercial_receipts').toArray()[0].n,1);assert.equal(dispatched,1);
});
let lease;
await test('observador y supervisor no pueden obtener dos reservas',async()=>{
 const result=await Promise.all([receiver.commercialFetch('/commercial/complete',operation({status:'claim'}),b),receiver.commercialFetch('/commercial/complete',operation({status:'claim'}),b)]);
 assert.deepEqual(result.map(r=>r.status).sort(),[200,409]);lease=(await result.find(r=>r.status===200).json()).lease_token;
});
await test('recibo no se cierra sin commit publicado',async()=>{
 const r=await receiver.commercialFetch('/commercial/complete',operation({status:'processed',lease_token:lease,validation:v}),b);assert.equal(r.status,409);
 assert.equal(b.sql.exec('SELECT status FROM commercial_receipts').toArray()[0].status,'received');
});
await test('reserva caducada no cierra tras verificación de red',async()=>{
 globalThis.fetch=async url=>{b.sql.exec('UPDATE commercial_receipts SET lease_until=0').toArray();return url.includes('/compare/')?Response.json({status:'identical',merge_base_commit:{sha:commit}}):Response.json({origen_sha256:sourceSha,fecha_corte:v.cut_date,revision_fuente:{generado_en:v.generated_at}});};
 const r=await receiver.commercialFetch('/commercial/complete',operation({status:'processed',lease_token:lease,validation:v,published_commit:commit}),b);assert.equal(r.status,409);assert.equal((await r.json()).error,'REPORT_LEASE');
});
await test('cierre verificado conserva evidencia y borra sólo copia temporal',async()=>{
 const r=await receiver.commercialFetch('/commercial/complete',operation({status:'claim'}),b);lease=(await r.json()).lease_token;
 globalThis.fetch=async url=>url.includes('/compare/')?Response.json({status:'identical',merge_base_commit:{sha:commit}}):Response.json({origen_sha256:sourceSha,fecha_corte:v.cut_date,revision_fuente:{generado_en:v.generated_at}});
 const completed=await receiver.commercialFetch('/commercial/complete',operation({status:'processed',lease_token:lease,validation:v,published_commit:commit}),b);assert.equal(completed.status,200);
 const receipt=b.sql.exec('SELECT * FROM commercial_receipts').toArray()[0];assert.equal(receipt.published_commit,commit);assert.ok(receipt.published_at);assert.equal(b.sql.exec('SELECT sealed FROM commercial_inbox').toArray()[0].sealed,'');
});
await test('mismos bytes publicados no vuelven a despacharse',async()=>{const r=await receiver.commercialFetch('/commercial/report',upload(),b);assert.equal((await r.json()).duplicate,true);assert.equal(dispatched,1);});
await test('copia vencida puede recibirse otra vez sin segundo registro',async()=>{
 b.sql.exec("UPDATE commercial_receipts SET status='expired',lease=NULL,lease_until=0").toArray();b.sql.exec('DELETE FROM commercial_inbox').toArray();
 globalThis.fetch=async()=>new Response(null,{status:204});const r=await receiver.commercialFetch('/commercial/report',upload(),b);assert.equal(r.status,202);assert.equal(b.sql.exec('SELECT COUNT(*) AS n FROM commercial_receipts').toArray()[0].n,1);assert.equal(b.sql.exec('SELECT status FROM commercial_receipts').toArray()[0].status,'received');
});
globalThis.fetch=realFetch;b.db.close();await rm(root,{recursive:true});
console.log(JSON.stringify({tests:passed,passed,synthetic:true,remote_execution:false}));
