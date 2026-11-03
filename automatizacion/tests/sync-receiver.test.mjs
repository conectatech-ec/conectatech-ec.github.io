import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inbox,workbook,claim,confirmed} from './sync-fixtures.mjs';
import {validReportName} from '../commercial-reception.mjs';

test('Original and both historical names accepted, invalid names and dates rejected',async()=>{
 for(const name of ['Reporte-Inventario.xlsx','Reporte-Inventario al 25-10-2026.xlsx','Reporte-Inventario 25-10-2026.xlsx']){
  const b=inbox(),r=await b.upload(workbook(),name);assert.equal(r.status,202);const data=await r.json();assert.equal(data.original_name,name);assert.equal(data.validated,false);assert.equal(data.cut_date,null);
 }
 for(const name of ['../Reporte-Inventario.xlsx','Reporte-Inventario 31-02-2026.xlsx','Reporte-Inventario 25-10-2026.xlsm','otro.xlsx'])assert.equal(validReportName(name),false);
});
test('Malformed ZIP and hash mismatch never replace a pending report',async()=>{
 const b=inbox(),data=await(await b.upload()).json(),fake=Buffer.alloc(200,65);fake[0]=80;fake[1]=75;
 const invalid=await b.upload(fake);assert.equal(invalid.status,400);const invalidSha=(await invalid.json()).sha256;
 assert.equal((await(await b.call('/commercial/status?sha256='+invalidSha)).json()).error_code,'XLSX_STRUCTURE');
 assert.equal((await b.upload(workbook('changed'),'Reporte-Inventario.xlsx',{'X-Report-SHA256':'0'.repeat(64)})).status,409);
 assert.equal((await(await b.call('/commercial/status')).json()).file_sha256,data.sha256);
});
test('Permanent SHA history deduplicates renamed and previous files without raw retention',async()=>{
 const b=inbox(),bytes=workbook(),first=await(await b.upload(bytes)).json(),lease=(await claim(b,first.sha256)).data;
 assert.equal((await b.call('/commercial/complete',confirmed(lease))).status,200);
 assert.equal(b.db.prepare('SELECT sealed FROM commercial_inbox').get().sealed,'');
 const next=await(await b.upload(workbook('next'))).json();assert.notEqual(next.sha256,first.sha256);
 const again=await(await b.upload(bytes,'Reporte-Inventario al 25-10-2026.xlsx')).json();assert.equal(again.duplicate,true);assert.equal(again.status,'processed');
 assert.equal((await(await b.call('/commercial/status')).json()).file_sha256,next.sha256);
 assert.equal(b.db.prepare('SELECT COUNT(*) n FROM commercial_receipts').get().n,2);
});
test('A duplicate retries a failed dispatch with backoff; it does not refresh expiry',async()=>{
 const b=inbox('commercial-source'),first=await(await b.upload()).json();assert.equal(first.trigger,'needs_actions_token');
 const expires=b.db.prepare('SELECT expires FROM commercial_inbox').get().expires;
 assert.equal((await(await b.upload()).json()).trigger,'retry_deferred');
 b.db.prepare('UPDATE commercial_receipts SET last_trigger=0').run();
 assert.equal((await(await b.call('/commercial/complete',{sha256:first.sha256,status:'retry'})).json()).trigger,'needs_actions_token');
 assert.equal(b.db.prepare('SELECT expires FROM commercial_inbox').get().expires,expires);assert.equal(b.alarms,1);
});
test('Concurrent different uploads cannot overwrite the single pending source',async()=>{
 const b=inbox(),results=await Promise.all([b.upload(workbook('a')),b.upload(workbook('b'))]);
 assert.deepEqual(results.map(r=>r.status).sort(),[202,409]);assert.equal(b.db.prepare('SELECT COUNT(*) n FROM commercial_receipts').get().n,1);
});
test('Leases exclude concurrent processors; interruption permits recovery and fences the old owner',async()=>{
 const b=inbox(),data=await(await b.upload()).json(),old=(await claim(b,data.sha256)).data;
 assert.equal((await claim(b,data.sha256)).response.status,409);
 b.db.prepare('UPDATE commercial_receipts SET lease_until=0').run();const current=(await claim(b,data.sha256)).data;
 assert.notEqual(current.lease_token,old.lease_token);assert.equal((await b.call('/commercial/complete',confirmed(old))).status,409);
 assert.equal((await b.call('/commercial/complete',{...current,status:'release'})).status,200);
 const recovered=(await claim(b,data.sha256)).data;
 assert.equal((await b.call('/commercial/complete',{...recovered,status:'processed'})).status,400);
 assert.equal((await b.call('/commercial/complete',confirmed(recovered))).status,200);
 const history=await(await b.call('/commercial/status?sha256='+data.sha256)).json();assert.equal(history.cut_date,'2026-10-25');assert.equal(history.original_name,'Reporte-Inventario.xlsx');assert.equal(history.validated,true);assert.ok(!JSON.stringify(history).includes('lease_token'));
});
test('Rejected and expired files retain an incident receipt, not the private workbook',async()=>{
 const b=inbox(),first=await(await b.upload()).json(),lease=(await claim(b,first.sha256)).data;
 assert.equal((await b.call('/commercial/complete',{...lease,status:'rejected',error_code:'REPORT_CUT_DATE_UNCONFIRMED'})).status,200);
 const r=await(await b.call('/commercial/status?sha256='+first.sha256)).json();assert.equal(r.cut_date,null);assert.equal(r.error_code,'REPORT_CUT_DATE_UNCONFIRMED');
 const second=await(await b.upload(workbook('second'))).json();b.db.prepare('UPDATE commercial_inbox SET expires=0').run();
 const expired=await(await b.call('/commercial/status?sha256='+second.sha256)).json();assert.equal(expired.status,'expired');assert.equal(b.db.prepare('SELECT COUNT(*) n FROM commercial_inbox').get().n,0);
});
test('Concurrent duplicate retries reserve one external dispatch before awaiting HTTP',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({}, {status:403});};
 try{
  let source=await readFile(new URL('../commercial-reception.mjs',import.meta.url),'utf8');
  source=source.replace("import {seal,unseal} from './messenger-control.mjs';","const seal=async()=> 'synthetic';const unseal=async()=> ''; ");
  source=source.replace("import {central,validateCentral} from './central-source.mjs';","const central={};const validateCentral=()=>{};");
  source=source.replace('__COMMERCIAL_PROCESSOR_RELEASE__','a'.repeat(40)).replace('__COMMERCIAL_PROCESSOR_CODE_SHA256__','e'.repeat(64));
  const receiver=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const b=inbox('commercial-source',{COMMERCIAL_ACTIONS_TOKEN:'synthetic-only'},receiver),first=await(await b.upload()).json();assert.equal(first.trigger,'dispatch_denied');assert.equal(calls,1);
  b.db.prepare('UPDATE commercial_receipts SET last_trigger=0').run();
  await Promise.all([b.upload(),b.upload()]);assert.equal(calls,2);
 } finally {globalThis.fetch=original;}
});
test('Unrendered receiver fails closed and never falls back to env PILOT_RELEASE',async()=>{
 const original=globalThis.fetch;let calls=0;const release='a'.repeat(40);
 globalThis.fetch=async()=>{calls++;return Response.json({workflow_runs:[{id:123,head_branch:'automatizacion/piloto-cloud-3sku-20261015',head_sha:'b'.repeat(40),path:'.github/workflows/central-593.yml'}]});};
 try{
  const b=inbox('commercial-source',{COMMERCIAL_ACTIONS_TOKEN:'synthetic-only',PILOT_RELEASE:release});
  assert.equal((await(await b.upload()).json()).trigger,'processor_release_unverified');assert.equal(calls,0);
 } finally {globalThis.fetch=original;}
});
