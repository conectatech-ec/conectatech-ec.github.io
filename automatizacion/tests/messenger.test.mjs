import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {handleMessengerWebhook,hmac,detectSkus} from '../messenger.mjs';
import {MessengerTestInbox,commercialDraft} from '../messenger-store.mjs';
import {answer} from '../commerce.mjs';
import catalog from '../generated/catalogo.json' with {type:'json'};
function storage() {
 const db=new DatabaseSync(':memory:');let alarm=null;
 return {sql:{exec(sql,...params){const stmt=db.prepare(sql);let rows=[];if(/^SELECT/i.test(sql))rows=stmt.all(...params);else stmt.run(...params);return {toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}},setAlarm:async n=>{alarm=n;},alarm:()=>alarm};
}
const page='100000001',sender='100000002';
function fixture(text='precio MICR27',overrides={}) {return {object:'page',entry:[{id:page,messaging:[{sender:{id:sender},recipient:{id:page},timestamp:Date.now(),message:{mid:'fixture-mid-000001',text},...overrides}]}]};}
async function signed(payload,env,modify=false) {let raw=JSON.stringify(payload);const sig='sha256='+await hmac(env.META_APP_SECRET,raw);if(modify)raw+=' ';return new Request('https://p/webhooks/meta',{method:'POST',headers:{'X-Hub-Signature-256':sig},body:raw});}
function environment() {
 const captured=[];
 return {captured,META_INGRESS_ENABLED:'true',META_MODE:'development-only',META_PAGE_ID:page,META_TEST_SENDER_IDS:sender,META_APP_SECRET:'fixture-signing-secret',MESSENGER_TEST_INBOX:{idFromName:n=>n,get:n=>({fetch:async(url,req)=>{captured.push({namespace:n,data:JSON.parse(req.body)});return Response.json({duplicate:false});}})}};
}
test('SKU recognition requires exact SKU; aliases and duplicates normalize',()=>{assert.deepEqual(detectSkus('MICR027 micr27 y POWE003 ADAP005'),['MICR27','POWE003','ADAP005']);assert.deepEqual(detectSkus('xMICR27fake y POWE0039'),[]);});
test('Unsigned and tampered Meta events never reach durable storage',async()=>{const env=environment();assert.equal((await handleMessengerWebhook(new Request('https://p/webhooks/meta',{method:'POST',body:'{}'}),env)).status,403);assert.equal((await handleMessengerWebhook(await signed(fixture(),env,true),env)).status,403);assert.equal(env.captured.length,0);});
test('Only allowed test sender and recipient Page accepted; old replay ignored',async()=>{for(const changes of [{sender:{id:'900000000'}},{recipient:{id:'900000000'}},{timestamp:Date.now()-86400001}]){const env=environment();const r=await handleMessengerWebhook(await signed(fixture('MICR27',changes),env),env);assert.equal(r.status,200);assert.equal((await r.json()).queued,0);assert.equal(env.captured.length,0);}});
test('Durable envelope contains SKU and HMAC only; no sender or raw message',async()=>{const env=environment();const privateText='Persona privada 0999999999 consulta MICR27';const r=await handleMessengerWebhook(await signed(fixture(privateText),env),env);assert.equal(r.status,200);assert.equal(env.captured[0].namespace,'messenger-development');assert.deepEqual(env.captured[0].data.skus,['MICR27']);assert.match(env.captured[0].data.key,/^[a-f0-9]{64}$/);const saved=JSON.stringify(env.captured);assert.ok(!saved.includes(sender));assert.ok(!saved.includes(privateText));});
test('Missing allowlist or live-mode flag fails closed',async()=>{const env=environment();env.META_TEST_SENDER_IDS='';assert.equal((await handleMessengerWebhook(await signed(fixture(),env),env)).status,503);env.META_MODE='live';assert.equal((await handleMessengerWebhook(await signed(fixture(),env),env)).status,503);});
test('Deployment ingress gate blocks even authentic allowed Page events',async()=>{const env=environment();env.META_INGRESS_ENABLED='false';const r=await handleMessengerWebhook(await signed(fixture(),env),env);assert.equal(r.status,200);assert.equal((await r.json()).reception_enabled,false);assert.equal(env.captured.length,0);});
test('SQLite duplicate protection survives object restart and concurrent delivery',async()=>{const s=storage();const req=()=>new Request('https://i/accept',{method:'POST',body:JSON.stringify({key:'a'.repeat(64),skus:[]})});const a=new MessengerTestInbox({storage:s},{});const results=await Promise.all([a.fetch(req()),a.fetch(req())]);const values=await Promise.all(results.map(r=>r.json()));assert.equal(values.filter(v=>v.duplicate).length,1);const b=new MessengerTestInbox({storage:s},{});assert.equal((await (await b.fetch(req())).json()).duplicate,true);await b.alarm();const preview=await (await b.fetch(new Request('https://i/results'))).json();assert.equal(preview.events.length,1);assert.equal(preview.events[0].status,'prepared');assert.equal(preview.outbound_enabled,false);});
test('Prepared commercial reply includes verified photo, existing banner and native card',()=>{for(const p of catalog.productos){const a=answer(p.sku,'',Date.parse(catalog.fuente_fecha)+1);const d=commercialDraft(a);assert.equal(d.send_enabled,false);assert.equal(d.foto,p.foto);assert.equal(d.banner,p.banner);assert.equal(d.precio,p.promo);assert.ok(d.messages.some(m=>m.attachment?.type==='template'));assert.ok(!('recipient' in d));}});
test('Retry stops at three attempts; retained rows expire',async()=>{const s=storage();const box=new MessengerTestInbox({storage:s},{});await box.fetch(new Request('https://i/accept',{method:'POST',body:JSON.stringify({key:'b'.repeat(64),skus:['MICR27']})}));const oldFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('fixture upstream failure');};try{for(let i=0;i<3;i++){s.sql.exec('UPDATE events SET next_at = 0');await box.alarm();}}finally{globalThis.fetch=oldFetch;}let p=await (await box.fetch(new Request('https://i/results'))).json();assert.equal(p.events[0].status,'failed');assert.equal(p.events[0].attempts,3);assert.equal(p.events[0].error,'SOURCE_OR_MEDIA_FAILED');s.sql.exec('UPDATE events SET expires = 0');await box.alarm();p=await (await box.fetch(new Request('https://i/results'))).json();assert.equal(p.events.length,0);});
test('Review pins exact draft; stale or expired approval fails, no send occurs',async()=>{
 const s=storage(),box=new MessengerTestInbox({storage:s},{}),key='c'.repeat(64);
 const accept=()=>new Request('https://i/accept',{method:'POST',body:JSON.stringify({key,skus:[]})});
 await box.fetch(accept());await box.fetch(accept());await box.alarm();
 const row=(await (await box.fetch(new Request('https://i/results'))).json()).events[0];
 const review=d=>new Request('https://i/review',{method:'POST',body:JSON.stringify({event_ref:key,result_digest:d,decision:'aprobado'})});
 assert.equal((await box.fetch(review('0'.repeat(64)))).status,409);
 const ok=await (await box.fetch(review(row.result_digest))).json();assert.equal(ok.decision,'aprobado');assert.equal(ok.send_enabled,false);
 const m=await (await box.fetch(new Request('https://i/metrics'))).json();assert.equal(m.daily[0].consultas,1);assert.equal(m.daily[0].duplicates,1);assert.equal(m.messages_sent,0);assert.equal(m.reviews[0].n,1);
 s.sql.exec('UPDATE events SET expires = 0');assert.equal((await box.fetch(review(row.result_digest))).status,409);assert.equal(s.sql.exec('SELECT COUNT(*) AS n FROM reviews').one().n,0);
});
