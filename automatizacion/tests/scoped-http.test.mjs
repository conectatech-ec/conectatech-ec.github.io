import test from 'node:test';
import assert from 'node:assert/strict';
import {readPrivate} from '../scoped-http.mjs';
test('only fixed safe GETs are issued, without redirects, with token confined to header',async()=>{
 const calls=[];
 for(const path of ['/health','/commercial/catalog','/commercial/catalog/status','/messenger/status','/messenger/seller/status']){
  const result=await readPrivate(path,{token:'synthetic-credential',fetcher:async(url,options)=>{calls.push({url,...options});return Response.json({fixture:true});}});
  assert.equal(result.status,200);
 }
 assert.ok(calls.every(x=>x.method==='GET'&&x.redirect==='error'&&!x.body&&x.headers.Authorization==='Bearer synthetic-credential'&&!x.url.includes('synthetic-credential')));
 assert.ok(calls.every(x=>x.headers['Cache-Control']==='no-cache'));
});
test('status route with dispatcher, writes, arbitrary URL/query and missing token fail before network',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error('UNEXPECTED_NETWORK');};
 for(const path of ['/commercial/status','/commercial/report','/commercial/complete','/messenger/enable','/health?x=1','https://graph.facebook.com'])await assert.rejects(readPrivate(path,{token:'fixture',fetcher}),/READ_REJECTED/);
 await assert.rejects(readPrivate('/health',{token:'',fetcher}),/READ_REJECTED/);assert.equal(calls,0);
});
test('transport errors and oversized private bodies produce fixed codes without values',async()=>{
 const result=await readPrivate('/health',{token:'synthetic-token',fetcher:async()=>{throw Error('synthetic-token PRIVATE_IDENTITY PRIVATE_VALUE');}});
 assert.deepEqual(result,{status:0,error:'SCOPED_PRIVATE_TRANSPORT_FAILED'});
 const oversized=await readPrivate('/commercial/catalog',{token:'fixture',fetcher:async()=>new Response('x'.repeat(2_000_001))});
 assert.deepEqual(oversized,{status:0,error:'SCOPED_PRIVATE_TRANSPORT_FAILED'});
});
test('checkout closure probes are fixed GETs; public Origin and anonymous admin are strictly bounded',async()=>{
 const calls=[];const fetcher=async(url,options)=>{calls.push({url,...options});return Response.json({error:'COMPRA_NO_HABILITADA'},{status:503});};
 assert.equal((await readPrivate('/api/compra/catalogo',{token:'fixture',fetcher})).status,503);
 await readPrivate('/api/compra/admin/pedidos',{token:'fixture',fetcher,anonymous:true});
 await readPrivate('/api/compra/admin/pedidos',{token:'fixture',fetcher});
 assert.equal(calls[0].headers.Origin,'https://conectatech-ec.github.io');
 assert.equal(calls[1].headers.Authorization,undefined);
 assert.equal(calls[2].headers.Authorization,'Bearer fixture');
 assert.ok(calls.every(x=>x.method==='GET'&&x.redirect==='error'&&!x.body));
 await assert.rejects(readPrivate('/health',{token:'fixture',fetcher,anonymous:true}),/READ_REJECTED/);
 await assert.rejects(readPrivate('/api/compra/pedidos',{token:'fixture',fetcher}),/READ_REJECTED/);
 assert.equal(calls.length,3);
});
