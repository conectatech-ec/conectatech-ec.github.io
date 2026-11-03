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
