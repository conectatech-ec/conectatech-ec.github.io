// SQLite fixtures only. No connection to Cloudflare, GitHub Actions or live inboxes.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import * as receiver from '../commercial-reception.mjs';

const original=await readFile(new URL('./fixtures/receiver-original-cc05f6d77.txt',import.meta.url),'utf8');
const target=await readFile(new URL('../commercial-reception.mjs',import.meta.url),'utf8');
function box(name){
 const db=new DatabaseSync(':memory:');
 return {name,db,sql:{exec(sql,...args){const q=db.prepare(sql);const rows=/^SELECT/i.test(sql)?q.all(...args):(q.run(...args),[]);return {toArray:()=>rows};}}};
}
test('Existing encrypted inbox and unrelated Messenger rows survive initialization twice',()=>{
 for(const status of ['received','processed','rejected']){
  const b=box('commercial-source');
  b.db.exec('CREATE TABLE commercial_inbox (id INTEGER PRIMARY KEY CHECK(id=1), sha TEXT, filename TEXT, sealed TEXT, status TEXT, received INTEGER, expires INTEGER, error TEXT)');
  b.db.exec('CREATE TABLE messenger_fixture (id TEXT PRIMARY KEY, opaque BLOB)');
  b.db.prepare('INSERT INTO messenger_fixture VALUES(?,?)').run('same',Buffer.from([0,255,10]));
  b.db.prepare('INSERT INTO commercial_inbox VALUES(1,?,?,?,?,?,?,?)').run('a'.repeat(64),'Reporte-Inventario 10-11-2026.xlsx','synthetic-sealed',status,100,9999999999999,status==='rejected'?'REJECTED':null);
  const before=b.db.prepare('SELECT * FROM commercial_inbox').all(),messenger=b.db.prepare('SELECT * FROM messenger_fixture').all();
  receiver.commercialInit(b);receiver.commercialInit(b);
  assert.deepEqual(b.db.prepare('SELECT * FROM commercial_inbox').all(),before);
  assert.deepEqual(b.db.prepare('SELECT * FROM messenger_fixture').all(),messenger);
  const r=b.db.prepare('SELECT * FROM commercial_receipts').get();
  assert.equal(r.sha,before[0].sha);assert.equal(r.filename,before[0].filename);assert.equal(r.status,status);
  assert.equal(r.received,100);assert.equal(r.error,before[0].error);
  assert.equal(r.cut_date,null);assert.equal(r.generated_at,null);assert.equal(r.lease,null);assert.equal(r.lease_until,0);
  assert.equal(b.db.prepare('SELECT COUNT(*) n FROM commercial_receipts').get().n,1);
 }
});
test('Messenger namespace receives no commercial ledger and retains historical inbox layout',()=>{
 const b=box('messenger-development');receiver.commercialInit(b);
 assert.equal(b.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='commercial_receipts'").get().n,0);
 assert.deepEqual(b.db.prepare('PRAGMA table_info(commercial_inbox)').all().map(r=>r.name),['id','sha','filename','sealed','status','received','expires','error']);
});
test('All original exports and HTTP route/method pairs remain available',()=>{
 const exportsOf=s=>[...s.matchAll(/export (?:async )?function (\w+)\(/g)].map(m=>m[1]);
 for(const name of exportsOf(original))assert.ok(exportsOf(target).includes(name),name);
 const routes=s=>new Set([...s.matchAll(/path==='([^']+)'&&req.method==='([^']+)'/g)].map(m=>m[1]+' '+m[2]));
 assert.deepEqual(routes(target),routes(original));
 assert.ok(!target.includes('env.PILOT_RELEASE')); // Alex binding is never repurposed.
});
test('Catalog status adds public processor identity without changing source metadata',async()=>{
 const central={schema:'conectatech.commercial.v1',source:{sha256:'b'.repeat(64),cut_date:'2026-11-10',generated_at:'2026-11-10T22:00:00Z'},normalized_at:'2026-11-10T22:00:01Z',published_at:null,expires_at:'2026-11-11T22:00:00Z',products:[{availability:'blocked'},{availability:'in_stock'}]};
 const load=async text=>{
  text=text.replace("import {seal,unseal} from './messenger-control.mjs';",'const seal=()=>{},unseal=()=>{};')
   .replace("import {central,validateCentral} from './central-source.mjs';",'const central='+JSON.stringify(central)+';const validateCentral=()=>{};')
   .replace('__COMMERCIAL_PROCESSOR_RELEASE__','c'.repeat(40)).replace('__COMMERCIAL_PROCESSOR_CODE_SHA256__','e'.repeat(64));
  return import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
 };
 const old=(await load(original)).centralStatus(),updated=(await load(target)).centralStatus();
 assert.equal(updated.processor_release,'c'.repeat(40));assert.equal(updated.processor_code_sha256,'e'.repeat(64));
 delete updated.processor_release;delete updated.processor_code_sha256;
 assert.deepEqual(updated,old);
});
