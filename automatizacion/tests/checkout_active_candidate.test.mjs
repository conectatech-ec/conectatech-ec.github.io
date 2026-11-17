// Check only the adapted live host and DO hooks; the 71 accepted tests are reused.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdtemp,readdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const sha=body=>createHash('sha256').update(body).digest('hex');
test('candidate from authenticated live modules keeps all checkout gates closed and initializes no checkout tables',async t=>{
 const temp=await mkdtemp(join(tmpdir(),'ct-checkout-active-'));
 t.after(()=>rm(temp,{recursive:true,force:true}));
 for(const name of await readdir(root))if(/\.(mjs|json)$/.test(name))await cp(join(root,name),join(temp,name));
 for(const dir of ['central','generated'])await cp(join(root,dir),join(temp,dir),{recursive:true});
 const plan=JSON.parse(await readFile(join(root,'revision-checkout/delta-base-activa.json')));
 for(const name of ['worker.mjs','messenger-store.mjs']){
  const body=await readFile(join(root,'revision-checkout/candidato-base-activa',name));
  assert.equal(sha(body),plan.runtime_modules.find(x=>x.name===name).after_sha256);
  await writeFile(join(temp,name),body);
 }
 // Existing compiled catalog import, mapped to the existing local JSON fixture.
 await writeFile(join(temp,'catalog.mjs'),"export {default} from './generated/catalogo.json' with {type:'json'};\n");
 const worker=await import(pathToFileURL(join(temp,'worker.mjs')).href);
 const env={PILOT_TOKEN:'synthetic-only-never-deployed',FREE_TIER_VERIFIED:'true',
  MESSENGER_TEST_INBOX:{idFromName(){throw Error('Closed checkout reached storage');}}};
 for(const [path,method] of [['catalogo','GET'],['cotizacion','POST'],['pedidos','POST']]){
  const res=await worker.default.fetch(new Request('https://pilot/api/compra/'+path,{method,
   headers:{Origin:'https://conectatech-ec.github.io'}}),env);
  assert.equal(res.status,503);assert.equal((await res.json()).error,'COMPRA_NO_HABILITADA');
 }
 const url='https://pilot/api/compra/admin/pedidos';
 assert.equal((await worker.default.fetch(new Request(url),env)).status,401);
 assert.equal((await worker.default.fetch(new Request(url,{headers:{Authorization:'Bearer '+env.PILOT_TOKEN}}),env)).status,503);
 assert.equal((await worker.default.fetch(new Request('https://pilot/health'),env)).status,200);
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 const storage={sql:{exec(sql,...args){const rows=db.prepare(sql).all(...args);return {toArray:()=>rows,one:()=>rows[0]};}},setAlarm:async()=>{}};
 new worker.MessengerTestInbox({id:{name:'messenger-development'},storage},env);
 assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'checkout_%'").all(),[]);
 const body=await readFile(join(temp,'worker.mjs'),'utf8');
 assert.ok(body.includes('routeSimulator(b)')&&body.includes('alex-private-signature')&&body.includes('renderBanner'));
 assert.ok(!body.includes('renderValidatedBanner'));
});
