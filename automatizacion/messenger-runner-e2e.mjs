// Synthetic CI integration only: real loopback HTTP, SQLite and HMAC; never cloud delivery.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import worker,{MessengerTestInbox} from './worker.mjs';
import catalog from './generated/catalogo.json' with {type:'json'};
import {LIVE_FEED} from './live.mjs';

const fixtureSkus=['MICR27','POWE003','ADAP005'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function syntheticRunnerFixture(seed,at=new Date().toISOString()){
 const copy=structuredClone(seed),assets=new Map();
 copy.fuente_fecha=at;
 copy.productos=fixtureSkus.map(sku=>{
  const matches=seed.productos.filter(p=>p.sku===sku);assert.equal(matches.length,1,'Runner requires the three existing public fixtures');
  const original=matches[0],p=structuredClone(original);
  for(const kind of ['foto','banner']){
   if(kind==='banner'&&!original.banner)continue;
   const bytes=Buffer.from('SYNTHETIC RUNNER MEDIA; NOT A PUBLISHED PRODUCT IMAGE; '+sku+' '+kind);
   const url='https://conectatech-ec.github.io/imagenes/messenger-runner-fixture/'+sku.toLowerCase()+'-'+kind+'.webp';
   p[kind]=url;p[kind+'_sha256']=sha(bytes);assets.set(url,bytes);
  }
  assert.equal(p.nombre,original.nombre);assert.equal(p.promo,original.promo);assert.equal(p.pvp,original.pvp);assert.equal(p.stock,original.stock);assert.equal(p.url,original.url);
  return p;
 });
 const feed={fechaCatalogo:at,productos:copy.productos.map(p=>({sku:p.sku,nombre:p.nombre,promo:p.promo,pvp:p.pvp,stock:p.stock,url:p.url}))};
 return {catalog:copy,feed,assets};
}
export function installRunnerFixture(seed,at,{nativeFetch=globalThis.fetch,loopbackOrigin=null}={}){
 const originalFetch=globalThis.fetch,original=structuredClone(seed),fixture=syntheticRunnerFixture(seed,at);
 const counts={catalog_requests:0,asset_requests:0,loopback_requests:0,blocked_requests:0,real_external_requests:0};
 let local=null;
 function setLoopback(origin){const u=new URL(origin);assert.equal(u.protocol,'http:');assert.equal(u.hostname,'127.0.0.1');assert.ok(u.port&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash);local=u.origin;}
 if(loopbackOrigin)setLoopback(loopbackOrigin);
 seed.fuente_fecha=fixture.catalog.fuente_fecha;seed.productos=fixture.catalog.productos;
 const deny=()=>{counts.blocked_requests++;throw Error('RUNNER_EXTERNAL_NETWORK_DISABLED');};
 const fetchFixture=async(input,options={})=>{
  let u;try{u=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);}catch{return deny();}
  const method=String(options.method||input?.method||'GET').toUpperCase();
  if(u.href===LIVE_FEED&&method==='GET'){counts.catalog_requests++;return Response.json(fixture.feed);}
  if(fixture.assets.has(u.href)&&method==='GET'){counts.asset_requests++;return new Response(fixture.assets.get(u.href),{headers:{'Content-Type':'application/octet-stream'}});}
  if(local&&u.origin===local&&u.hostname==='127.0.0.1'&&!u.username&&!u.password){counts.loopback_requests++;return nativeFetch(input,{...options,redirect:'error'});}
  return deny();
 };
 globalThis.fetch=fetchFixture;
 return {fixture,fetch:fetchFixture,setLoopback,counts:()=>({...counts}),restore(){globalThis.fetch=originalFetch;for(const key of Object.keys(seed))delete seed[key];Object.assign(seed,original);}};
}

async function run(){
 const isChild=process.env.MESSENGER_RUNNER_FIXTURE_CHILD==='true';
 const at=isChild?process.env.MESSENGER_RUNNER_FIXTURE_AT:new Date().toISOString();
 const fixture=installRunnerFixture(catalog,at,{loopbackOrigin:isChild?process.env.PILOT_BASE_URL:null});
 if(isChild){
  try{await import('./messenger-e2e.mjs');}
  finally{
   if(process.send&&process.connected)await new Promise(resolve=>process.send({kind:'messenger_runner_fixture_counts',counts:fixture.counts()},resolve));
   if(process.connected)process.disconnect();fixture.restore();
  }
  return;
 }
 const stores=new Map(),closers=[],pending=new Set();
 const namespace={idFromName:name=>name,get(name){
  if(!stores.has(name)){
   const db=new DatabaseSync(':memory:');let box,timer;
   const state={id:{name},storage:{sql:{exec(sql,...args){const stmt=db.prepare(sql);let rows=[];if(/^SELECT/i.test(sql))rows=stmt.all(...args);else stmt.run(...args);return {toArray:()=>rows,one:()=>{if(rows.length!==1)throw Error('SQLite single row expected');return rows[0];}};}},setAlarm:async time=>{clearTimeout(timer);timer=setTimeout(()=>{const work=box.alarm();pending.add(work);work.catch(()=>{}).finally(()=>pending.delete(work));},Math.max(1,time-Date.now()));timer.unref();}}};
   box=new MessengerTestInbox(state,env);stores.set(name,box);closers.push({stop:()=>clearTimeout(timer),close:()=>db.close()});
  }
  return {fetch:(url,options)=>stores.get(name).fetch(new Request(url,options))};
 }};
 const env={PILOT_TOKEN:'synthetic-runner-token-not-a-production-secret',META_MODE:'development-only',META_INGRESS_ENABLED:'false',META_PAGE_ID:'100000000000001',META_APP_SECRET:'synthetic-app-secret-not-a-Meta-credential',META_VERIFY_TOKEN:'synthetic-runner-verification-token-0000001',META_TEST_SENDER_IDS:'100000000000002',MESSENGER_TEST_INBOX:namespace};
 const server=createServer(async(req,res)=>{
  try{
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const request=new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
   const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Runner fixture failed');}
 });
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;fixture.setLoopback(origin);let childCounts=null;
  const exitCode=await new Promise(resolve=>{
   const child=spawn(process.execPath,[...process.execArgv,'automatizacion/messenger-runner-e2e.mjs'],{stdio:['inherit','inherit','inherit','ipc'],env:{...process.env,MESSENGER_RUNNER_FIXTURE_CHILD:'true',MESSENGER_RUNNER_FIXTURE_AT:at,PILOT_BASE_URL:origin,PILOT_TOKEN:env.PILOT_TOKEN,META_VERIFY_TOKEN:env.META_VERIFY_TOKEN,META_APP_SECRET:env.META_APP_SECRET,MESSENGER_E2E_SCOPE:'synthetic_loopback_http_real_sqlite_hmac_no_external_network'}});
   child.on('message',message=>{if(message?.kind==='messenger_runner_fixture_counts')childCounts=message.counts;});
   child.on('error',()=>resolve(1));child.on('close',resolve);
  });
  const parentCounts=fixture.counts();
  assert.equal(exitCode,0,'Synthetic child HTTP integration must pass');assert.ok(childCounts,'Child fixture counters required');
  assert.ok(parentCounts.catalog_requests>=3&&parentCounts.asset_requests>=3&&childCounts.loopback_requests>0);
  for(const counts of [parentCounts,childCounts]){assert.equal(counts.blocked_requests,0,'Unexpected request outside fixture allowlist');assert.equal(counts.real_external_requests,0);}
  console.log(JSON.stringify({mode:'synthetic_loopback_http_real_sqlite_hmac_no_external_network',passed:true,parent:parentCounts,child:childCounts,live_catalog_checked:false,live_assets_checked:false,actual_cloud_delivery_verified:false,fixture_names_prices_preserved:true}));
 }finally{
  server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));
  for(const c of closers)c.stop();await Promise.allSettled([...pending]);for(const c of closers){c.stop();c.close();}fixture.restore();
 }
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await run();
