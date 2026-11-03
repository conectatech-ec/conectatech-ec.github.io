import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syntheticRunnerFixture,installRunnerFixture} from '../messenger-runner-e2e.mjs';
import {LIVE_FEED,refreshCatalog,verifyAssets} from '../live.mjs';

const ids=['MICR27','POWE003','ADAP005'];
const seed=variant=>({fuente_fecha:'2000-01-01T00:00:00Z',productos:ids.map((sku,i)=>({sku,nombre:'SYNTHETIC PUBLIC FIXTURE '+sku,promo:10+variant+i,pvp:20+variant+i,stock:i+1,url:'https://conectatech-ec.github.io/productos/fixture-'+sku.toLowerCase()+'/',foto:'https://conectatech-ec.github.io/imagenes/old-'+sku+'.webp',foto_sha256:'0'.repeat(64),banner:i===0?'https://conectatech-ec.github.io/imagenes/old-banner.webp':null,banner_sha256:i===0?'0'.repeat(64):null,private_test_column:'SYNTHETIC_PRIVATE_MUST_NOT_REACH_FEED'}))});
test('Synthetic fixtures preserve the three input identities, prices, stock and URLs without writing the seed',()=>{
 for(let variant=0;variant<20;variant++){
  const original=seed(variant),before=JSON.stringify(original),f=syntheticRunnerFixture(original,'2026-11-02T22:48:22.000Z');
  assert.equal(JSON.stringify(original),before);assert.deepEqual(f.catalog.productos.map(p=>p.sku),ids);
  for(let i=0;i<ids.length;i++)for(const key of ['sku','nombre','promo','pvp','stock','url'])assert.equal(f.catalog.productos[i][key],original.productos[i][key]);
  assert.ok(!JSON.stringify(f.feed).includes('SYNTHETIC_PRIVATE_MUST_NOT_REACH_FEED'));
 }
});
test('Only the exact feed and synthetic assets are answered in memory; their SHA checks use real crypto',async t=>{
 let native=0;const fixture=installRunnerFixture(seed(0),new Date().toISOString(),{nativeFetch:async()=>{native++;throw Error('NATIVE_FETCH_NOT_EXPECTED');}});t.after(()=>fixture.restore());
 assert.equal((await fetch(LIVE_FEED)).status,200);
 for(const p of fixture.fixture.catalog.productos)for(const kind of ['foto','banner'])if(p[kind]){
  const r=await fetch(p[kind]),bytes=await r.arrayBuffer(),actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');assert.equal(actual,p[kind+'_sha256']);
 }
 assert.equal(native,0);assert.deepEqual(fixture.counts(),{catalog_requests:1,asset_requests:4,loopback_requests:0,blocked_requests:0,real_external_requests:0});
});
test('Raw external URLs, unapproved assets, alternative ports and non-GET fixture operations never reach native fetch',async t=>{
 let native=0;const fixture=installRunnerFixture(seed(0),new Date().toISOString(),{loopbackOrigin:'http://127.0.0.1:18081',nativeFetch:async()=>{native++;return new Response('bad');}});t.after(()=>fixture.restore());
 const targets=['https://graph.facebook.com/v26.0/me/messages','https://example.invalid/','https://conectatech-ec.github.io/index.html','https://conectatech-ec.github.io/imagenes/unapproved.webp',LIVE_FEED+'?changed=1','http://127.0.0.1:18082/health','http://127.0.0.1.example.invalid:18081/health','http://fixture:fake@127.0.0.1:18081/health','https://127.0.0.1:18081/health'];
 for(const url of targets)await assert.rejects(fetch(url),{message:'RUNNER_EXTERNAL_NETWORK_DISABLED'});
 await assert.rejects(fetch(LIVE_FEED,{method:'POST'}),{message:'RUNNER_EXTERNAL_NETWORK_DISABLED'});
 assert.equal(native,0);assert.equal(fixture.counts().blocked_requests,10);assert.equal(fixture.counts().real_external_requests,0);
 const snapshot=fixture.counts();snapshot.blocked_requests=0;assert.equal(fixture.counts().blocked_requests,10);
});
test('Only the bound loopback origin uses native HTTP and redirects cannot escape the local server',async t=>{
 const calls=[];const fixture=installRunnerFixture(seed(0),new Date().toISOString(),{loopbackOrigin:'http://127.0.0.1:18081',nativeFetch:async(input,options)=>{calls.push({url:String(input),redirect:options.redirect,method:options.method});return new Response('local');}});t.after(()=>fixture.restore());
 assert.equal(await(await fetch('http://127.0.0.1:18081/health',{method:'GET',redirect:'follow'})).text(),'local');
 assert.deepEqual(calls,[{url:'http://127.0.0.1:18081/health',redirect:'error',method:'GET'}]);assert.equal(fixture.counts().loopback_requests,1);assert.equal(fixture.counts().real_external_requests,0);
});
test('Real runtime guards still reject changed identity and tampered media inside the synthetic fixture',async t=>{
 let native=0;const original=seed(0),fixture=installRunnerFixture(original,new Date().toISOString(),{nativeFetch:async()=>{native++;throw Error('NATIVE_FETCH_NOT_EXPECTED');}});t.after(()=>fixture.restore());
 fixture.fixture.feed.productos[0].nombre='SYNTHETIC DIFFERENT PRODUCT';await assert.rejects(refreshCatalog(original),/product_changed_refresh_required/);
 fixture.fixture.assets.set(original.productos[0].foto,Buffer.from('SYNTHETIC CORRUPT BYTES'));await assert.rejects(verifyAssets(original.productos[0]),/asset_changed_refresh_required/);
 assert.equal(native,0);assert.equal(fixture.counts().real_external_requests,0);
});
test('Fixture teardown restores the in-memory seed and global fetch exactly',()=>{
 const original=seed(0),before=JSON.stringify(original),fetchBefore=globalThis.fetch,fixture=installRunnerFixture(original,new Date().toISOString());
 assert.notEqual(JSON.stringify(original),before);fixture.restore();assert.equal(JSON.stringify(original),before);assert.equal(globalThis.fetch,fetchBefore);
});
