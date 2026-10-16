import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {handleMessengerWebhook,hmac,detectSkus} from '../messenger.mjs';
import {MessengerTestInbox,commercialDraft} from '../messenger-store.mjs';
import {answer} from '../commerce.mjs';
import {pairingHash} from '../messenger-control.mjs';
import worker from '../worker.mjs';
import {sanitizeTrace} from '../tail-proof.mjs';
import catalog from '../generated/catalogo.json' with {type:'json'};
function storage() {
 const db=new DatabaseSync(':memory:');let alarm=null;
 return {sql:{exec(sql,...params){const stmt=db.prepare(sql);let rows=[];if(/^SELECT/i.test(sql))rows=stmt.all(...params);else stmt.run(...params);return {toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}},setAlarm:async n=>{alarm=n;},alarm:()=>alarm};
}
const page='100000001',sender='100000002';
function fixture(text='precio MICR27',overrides={}) {return {object:'page',entry:[{id:page,messaging:[{sender:{id:sender},recipient:{id:page},timestamp:Date.now(),message:{mid:'fixture-mid-000001',text},...overrides}]}]};}
async function signed(payload,env,modify=false) {let raw=JSON.stringify(payload);const sig='sha256='+await hmac(env.META_APP_SECRET,raw);if(modify)raw+=' ';return new Request('https://p/webhooks/meta',{method:'POST',headers:{'X-Hub-Signature-256':sig},body:raw});}
function environment() {
 const captured=[],receipts=[];
 return {captured,receipts,META_INGRESS_ENABLED:'true',META_MODE:'development-only',META_PAGE_ID:page,META_TEST_SENDER_IDS:sender,META_APP_SECRET:'fixture-signing-secret',MESSENGER_TEST_INBOX:{idFromName:n=>n,get:n=>({fetch:async(url,req)=>{const b=JSON.parse(req.body);if(url.endsWith('/receipt'))receipts.push(b);else captured.push({namespace:n,data:b});return Response.json({duplicate:false});}})}};
}
test('SKU recognition requires exact SKU; aliases and duplicates normalize',()=>{assert.deepEqual(detectSkus('MICR027 micr27 y POWE003 ADAP005'),['MICR27','POWE003','ADAP005']);assert.deepEqual(detectSkus('xMICR27fake y POWE0039'),[]);});
test('Unsigned and tampered Meta events never reach durable storage',async()=>{const env=environment();assert.equal((await handleMessengerWebhook(new Request('https://p/webhooks/meta',{method:'POST',body:'{}'}),env)).status,403);assert.equal((await handleMessengerWebhook(await signed(fixture(),env,true),env)).status,403);assert.equal(env.captured.length,0);});
test('Only allowed test sender and recipient Page accepted; old replay ignored',async()=>{for(const changes of [{sender:{id:'900000000'}},{recipient:{id:'900000000'}},{timestamp:Date.now()-86400001}]){const env=environment();const r=await handleMessengerWebhook(await signed(fixture('MICR27',changes),env),env);assert.equal(r.status,200);assert.equal((await r.json()).queued,0);assert.equal(env.captured.length,0);}});
test('Durable envelope contains SKU and HMAC only; no sender or raw message',async()=>{const env=environment();const privateText='Persona privada 0999999999 consulta MICR27';const r=await handleMessengerWebhook(await signed(fixture(privateText),env),env);assert.equal(r.status,200);assert.equal(env.captured[0].namespace,'messenger-development');assert.deepEqual(env.captured[0].data.skus,['MICR27']);assert.match(env.captured[0].data.key,/^[a-f0-9]{64}$/);const saved=JSON.stringify(env.captured);assert.ok(!saved.includes(sender));assert.ok(!saved.includes(privateText));});
test('Missing allowlist or live-mode flag fails closed',async()=>{const env=environment();env.META_TEST_SENDER_IDS='';assert.equal((await handleMessengerWebhook(await signed(fixture(),env),env)).status,503);env.META_MODE='live';assert.equal((await handleMessengerWebhook(await signed(fixture(),env),env)).status,503);});
test('Deployment ingress gate blocks even authentic allowed Page events',async()=>{const env=environment();env.META_INGRESS_ENABLED='false';const r=await handleMessengerWebhook(await signed(fixture(),env),env);assert.equal(r.status,200);assert.equal((await r.json()).reception_enabled,false);assert.equal(env.captured.length,0);});
test('Closed gate acknowledges signed Page even without allowlist; invalid signature stays 403',async()=>{
 const env=environment();env.META_INGRESS_ENABLED='false';env.META_TEST_SENDER_IDS='';
 assert.equal((await handleMessengerWebhook(await signed(fixture(),env),env)).status,200);assert.equal(env.receipts[0].signature_valid,true);assert.equal(env.receipts[0].reason,'ingress_disabled');assert.equal(env.captured.length,0);
 assert.equal((await handleMessengerWebhook(await signed(fixture(),env,true),env)).status,403);assert.equal(env.receipts[1].signature_valid,false);
});
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
test('Tester enrollment needs owner consent, valid Meta signature, Page, nonce and recent timestamp; PSID is sealed and one-use',async()=>{
 const s=storage(),env={...environment(),PILOT_TOKEN:'synthetic-private-owner-token-0000000001',META_INGRESS_ENABLED:'false',META_TEST_SENDER_IDS:''};
 const box=new MessengerTestInbox({storage:s},env);env.MESSENGER_TEST_INBOX={idFromName:n=>n,get:()=>({fetch:(url,opts)=>box.fetch(new Request(url,opts))})};
 const post=(path,b={})=>new Request('https://i/'+path,{method:'POST',body:JSON.stringify(b)});
 assert.equal((await box.fetch(post('pairing/start'))).status,400);
 const start=await (await box.fetch(post('pairing/start',{confirmed_tester:true}))).json();assert.match(start.phrase,/^CONECTATECH-PRUEBA [a-f0-9]{32}$/);
 for(const changes of [{recipient:{id:'999000000'}},{timestamp:Date.now()-600001}])await handleMessengerWebhook(await signed(fixture(start.phrase,changes),env),env);
 await handleMessengerWebhook(await signed(fixture(start.phrase),env,true),env);
 assert.equal((await (await box.fetch(new Request('https://i/pairing/status'))).json()).claimed,false);
 const ack=await (await handleMessengerWebhook(await signed(fixture(start.phrase),env),env)).json();assert.equal(ack.queued,0);assert.equal(ack.reception_enabled,false);
 const stored=JSON.stringify(s.sql.exec('SELECT * FROM pairing').toArray());assert.ok(!stored.includes(sender));assert.ok(!stored.includes(start.phrase.slice(-32)));
 const psid=await (await box.fetch(post('pairing/consume'))).json();assert.ok(psid.psid===sender,'Private test identity mismatch; values withheld');assert.equal((await box.fetch(post('pairing/consume'))).status,409);
 const receipts=await (await box.fetch(new Request('https://i/receipts'))).json();assert.ok(receipts.receipts.some(r=>r.reason==='pairing_claimed'&&r.signature_valid));assert.ok(!JSON.stringify(receipts).includes(sender));assert.ok(!JSON.stringify(receipts).includes(start.phrase));assert.equal(s.sql.exec('SELECT COUNT(*) AS n FROM events').one().n,0);
});
test('Enrollment expires and parallel claims cannot overwrite the first identity',async()=>{
 const s=storage(),env={PILOT_TOKEN:'synthetic-private-fixture-token-0000001',META_MODE:'development-only',META_INGRESS_ENABLED:'false'},box=new MessengerTestInbox({storage:s},env);
 const req=(path,b={})=>new Request('https://i/'+path,{method:'POST',body:JSON.stringify(b)});
 let p=await (await box.fetch(req('pairing/start',{confirmed_tester:true}))).json();const hash=await pairingHash(p.phrase.slice(-32),env.PILOT_TOKEN);
 const claims=await Promise.all(['100000011','100000012'].map(psid=>box.fetch(req('pairing/claim',{psid,code_hash:hash})).then(r=>r.json())));assert.equal(claims.filter(r=>r.claimed).length,1);
 await box.fetch(req('pairing/start',{confirmed_tester:true}));s.sql.exec('UPDATE pairing SET expires=0');await box.alarm();assert.equal((await box.fetch(req('pairing/consume'))).status,409);
});
test('Receipts sanitize data, retain valid signature evidence against invalid floods, and preserve queue alarm',async()=>{
 const s=storage(),box=new MessengerTestInbox({storage:s},{});
 await box.fetch(new Request('https://i/accept',{method:'POST',body:JSON.stringify({key:'d'.repeat(64),skus:[]})}));
 const append=valid=>box.fetch(new Request('https://i/receipt',{method:'POST',body:JSON.stringify({signature_valid:valid,http_status:valid?200:403,reason:valid?'ingress_disabled':'invalid_signature',source:'external_https',sender:'999888777',text:'private-user-message'})}));
 await append(true);assert.ok(s.alarm()<Date.now()+1000);
 for(let i=0;i<110;i++)await append(false);
 const list=await (await box.fetch(new Request('https://i/receipts'))).json();assert.equal(list.receipts.length,11);assert.equal(list.receipts.filter(r=>r.signature_valid).length,1);assert.ok(!JSON.stringify(list).includes('999888777'));assert.ok(!JSON.stringify(list).includes('private-user-message'));
 s.sql.exec('UPDATE receipts SET expires=0');await box.alarm();assert.equal((await (await box.fetch(new Request('https://i/receipts'))).json()).receipts.length,0);
});
test('Operator shell exposes no credentials; all enrollment and receipt data requires bearer authorization',async()=>{
 const env={PILOT_TOKEN:'synthetic-private-fixture-key-000001'};
 for(const path of ['/messenger/receipts','/messenger/pairing/start','/messenger/pairing/status','/messenger/pairing/consume'])assert.equal((await worker.fetch(new Request('https://p'+path),env)).status,401);
 const r=await worker.fetch(new Request('https://p/messenger/setup'),env);assert.equal(r.status,200);assert.match(r.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.ok(!(await r.text()).includes(env.PILOT_TOKEN));
});
test('Cloudflare tail exports only Worker webhook status and sanitized audit fields',()=>{
 const sensitive='synthetic-sensitive-credential-and-message';
 const input={scriptName:'conectatech-comercial-piloto',eventTimestamp:Date.now(),event:{request:{method:'POST',url:'https://pilot/webhooks/meta?private='+sensitive,headers:{Authorization:sensitive}},response:{status:200}},logs:[{message:[JSON.stringify({event:'meta_webhook_receipt',signature_valid:true,http_status:200,reason:'ingress_disabled',source:'authorized_ci_probe',page_matches:false,text:sensitive,psid:sensitive})]}]};
 const safe=sanitizeTrace(input);assert.equal(safe.http_status,200);assert.equal(safe.signature_valid,true);assert.ok(!JSON.stringify(safe).includes(sensitive));assert.equal(sanitizeTrace({...input,scriptName:'production'}),null);assert.equal(sanitizeTrace({...input,event:{request:{method:'GET',url:'https://pilot/webhooks/meta?secret='+sensitive}}}),null);
});
