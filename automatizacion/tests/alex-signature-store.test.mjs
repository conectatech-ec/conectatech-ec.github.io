// Synthetic one-pixel PNG only; private commercial banners never enter the repository.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';import {createHash} from 'node:crypto';
import {signatureAssetFetch} from '../alex-signature-store.mjs';
import worker from '../worker.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2ZBfQAAAAASUVORK5CYII=','base64');
const sha=createHash('sha256').update(png).digest('hex'),path='/alex/signature/TELF011/'+sha+'.png';
const manifest={schema:'conectatech.alex.signature.private.v1',scope:'private_simulator',owner_approved:true,external_delivery_allowed:false,products:{TELF011:{owner_approved:true,approved_scope:'private_simulator',sha256:sha,bytes_count:png.length}}};
function fixture(t){const db=new DatabaseSync(':memory:');t.after(()=>db.close());const box={name:'alex-private-signature',env:{PILOT_TOKEN:'synthetic-private-owner-key-never-real-000000'},sql:{exec(q,...p){const s=db.prepare(q),rows=/^SELECT/i.test(q)?s.all(...p):(s.run(...p.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v)),[]);return {toArray:()=>rows};}}};const call=(route,options={})=>signatureAssetFetch(route,new Request('https://inbox'+route,options),box,{manifest});return {db,box,call};}
test('Approved PNG upload validates exact bytes, encrypts at rest and returns only through the private namespace',async t=>{
 const f=fixture(t);assert.equal((await f.call(path)).status,404);
 const up=await f.call('/alex/signature/upload/TELF011',{method:'POST',headers:{'Content-Type':'image/png'},body:png});assert.equal(up.status,200);assert.equal((await up.json()).upload_verified,true);
 const row=f.db.prepare('SELECT * FROM alex_signature_assets').get();assert.ok(!Buffer.from(row.sealed).includes(png));assert.notDeepEqual(Buffer.from(row.sealed),png);
 const status=await (await f.call('/alex/signature/status')).json();assert.equal(status.products.TELF011.ready,true);
 const got=await f.call(path);assert.equal(got.status,200);assert.equal(got.headers.get('Content-Type'),'image/png');assert.match(got.headers.get('Cache-Control'),/private, no-store/);assert.deepEqual(Buffer.from(await got.arrayBuffer()),png);
 assert.equal((await signatureAssetFetch(path,new Request('https://inbox'+path),{...f.box,name:'alex-demo-COL001-simulator-synthetic'},{manifest})).status,403);
});
test('Unapproved hashes, MIME, size and changed approved bytes cannot enter private storage',async t=>{
 const f=fixture(t);const upload=(body,type='image/png')=>f.call('/alex/signature/upload/TELF011',{method:'POST',headers:{'Content-Type':type},body});
 assert.equal((await upload(png,'text/plain')).status,415);assert.equal((await upload(png.subarray(0,30))).status,409);
 const altered=Buffer.from(png);altered[altered.length-1]^=1;assert.equal((await upload(altered)).status,409);assert.equal((await upload(new Uint8Array(2000001))).status,413);
 assert.equal((await f.call('/alex/signature/upload/TELF099',{method:'POST',headers:{'Content-Type':'image/png'},body:png})).status,404);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM alex_signature_assets').get().n,0);
});
test('Ciphertext tampering and an owner-key rotation cannot expose plaintext or an unverified image',async t=>{
 const f=fixture(t);await f.call('/alex/signature/upload/TELF011',{method:'POST',headers:{'Content-Type':'image/png'},body:png});
 const good=f.db.prepare('SELECT sealed FROM alex_signature_assets').get().sealed;
 f.box.env.PILOT_TOKEN='different-synthetic-private-owner-key-000000000';assert.equal((await f.call(path)).status,503);f.box.env.PILOT_TOKEN='synthetic-private-owner-key-never-real-000000';
 const altered=Buffer.from(good);altered[0]^=1;f.db.prepare('UPDATE alex_signature_assets SET sealed=?').run(altered);assert.equal((await f.call(path)).status,503);
 assert.equal((await f.call('/alex/signature/TELF011/'+'f'.repeat(64)+'.png')).status,404);
});
test('The outer Worker requires owner authentication before reading or uploading any private PNG',async()=>{
 const env={PILOT_TOKEN:'synthetic-private-owner-key-never-real-000000'};
 for(const [route,method]of [[path,'GET'],['/alex/signature/upload/TELF011','POST']]){
  const r=await worker.fetch(new Request('https://pilot.test'+route,{method,...(method==='POST'?{body:png}:{})}),env,{});assert.equal(r.status,401);
 }
 const authenticated=await worker.fetch(new Request('https://pilot.test'+path,{headers:{Authorization:'Bearer '+env.PILOT_TOKEN}}),env,{});assert.equal(authenticated.status,503);
});
