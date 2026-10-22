import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {central,sourceToAlex,validateCentral} from '../central-source.mjs';import {alexBaseline,refreshAlexCatalog,quoteCurrent} from '../alex-catalog.mjs';import {generateAlex,quickReplies} from '../alex.mjs';import worker from '../worker.mjs';import {MessengerTestInbox} from '../messenger-store.mjs';
test('Validated central data supply exact SKU prices while expiry never reverts to an old feed',async()=>{
 const s=await refreshAlexCatalog();assert.equal(s.source_kind,'validated_central_593');assert.equal(s.inventory_cut_date,'2026-10-21');assert.equal(s.productos.find(p=>p.sku==='TELF011').promo,185.9);assert.equal(s.productos.find(p=>p.sku==='TELF012').pvp,299.88);assert.equal(s.productos[0].stock_is_availability_marker,true);
 const expired=sourceToAlex(alexBaseline,central,null,Date.parse(central.expires_at)+1);assert.equal(quoteCurrent(expired,expired.productos[0],Date.parse(central.expires_at)+1),false);assert.equal(expired.source_error_code,'CENTRAL_REPORT_STALE');
});
test('Conflicting, missing and zero-stock SKU never generate amounts or purchase buttons',async()=>{
 for(const sku of ['POWE014','FLAS024','FLAS026','MOUS010','ENVI001','HUB003','AUDI078','TELF019','TELF020']){
  const s=await refreshAlexCatalog(undefined,fetch,Date.now(),sku);const a=await generateAlex('Precio de '+sku,s,{}, {CATALOG_FIRST:'true'});assert.deepEqual(a.focus,[sku]);assert.ok(!a.text.includes('$'));assert.ok(!quickReplies(a).some(q=>q.payload.includes(':buy:')));assert.notEqual(a.action,'handoff');
 }
});
test('Central schema rejects duplicate records, hidden stock and future timestamps',()=>{
 for(const change of [d=>d.products.push(d.products[0]),d=>d.products[0].stock=99,d=>d.source.generated_at='2099-01-01T00:00:00Z']){const d=structuredClone(central);change(d);assert.throws(()=>validateCentral(d));}
});
function box(){const db=new DatabaseSync(':memory:'),env={PILOT_TOKEN:'synthetic-private-test-pilot-key-00000'},state={id:{name:'commercial-source-ci'},storage:{sql:{exec(s,...p){const q=db.prepare(s),rows=/^SELECT/i.test(s)?q.all(...p):(q.run(...p),[]);return{toArray:()=>rows,one:()=>rows[0]};}},setAlarm:async()=>{}}};return new MessengerTestInbox(state,env);}
test('Private file inbox encrypts, deduplicates, protects SHA, erases originals and isolates CI',async()=>{
 const b=box(),raw=new Uint8Array(200).fill(65);raw[0]=80;raw[1]=75;
 const req=()=>new Request('https://inbox/commercial/report',{method:'POST',headers:{'X-Report-Filename':'Reporte-Inventario%2021-10-2026.xlsx'},body:raw});let r=await b.fetch(req());assert.equal(r.status,202);const a=await r.json();assert.equal(a.trigger,'ci_no_dispatch');assert.equal((await(await b.fetch(req())).json()).duplicate,true);
 const stored=b.sql.exec('SELECT sealed FROM commercial_inbox').one().sealed;assert.ok(!stored.includes('AAAAAA'));assert.equal((await b.fetch(new Request('https://inbox/commercial/report?sha256=wrong'))).status,409);
 const data=await b.fetch(new Request('https://inbox/commercial/report?sha256='+a.sha256));assert.deepEqual(new Uint8Array(await data.arrayBuffer()),raw);
 const done=await b.fetch(new Request('https://inbox/commercial/complete',{method:'POST',body:JSON.stringify({sha256:a.sha256,status:'processed'})}));assert.equal(done.status,200);assert.equal(b.sql.exec('SELECT sealed FROM commercial_inbox').one().sealed,'');
 for(const p of ['/commercial/status','/commercial/report','/commercial/catalog','/commercial/catalog/status'])assert.equal((await worker.fetch(new Request('https://pilot'+p),{})).status,401);
 const html=await(await worker.fetch(new Request('https://pilot/commercial/upload'),{})).text();assert.ok(!html.includes('synthetic-private'));new Function(html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1]);
});
