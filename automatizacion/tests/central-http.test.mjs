import test from 'node:test';
import assert from 'node:assert/strict';
import {privateRequest} from '../central-http.mjs';
test('deployment private GETs are fixed, no-cache, redirect-free and token stays in header',async()=>{
 const calls=[];
 for(const path of ['/health','/commercial/catalog','/messenger/status','/messenger/seller/status']){
  const result=await privateRequest({path,token:'synthetic-only',fetcher:async(url,options)=>{calls.push({url,...options});return Response.json({fixture:true});}});
  assert.equal(result.status,200);
 }
 assert.ok(calls.every(x=>x.method==='GET'&&x.body===undefined&&x.redirect==='error'&&x.headers['Cache-Control']==='no-cache'));
 assert.ok(calls.every(x=>!x.url.includes('synthetic-only')));
});
test('read endpoints reject any body and arbitrary URL/path before fetch',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error('MUST_NOT_CALL');};
 for(const path of ['/health','/commercial/catalog','/commercial/catalog/status','/messenger/status','/messenger/seller/status'])await assert.rejects(privateRequest({path,input:'{}',token:'fixture',fetcher}),/READ_ONLY/);
 for(const path of ['https://graph.facebook.com','/messenger/enable','/commercial/catalog?sha256='+'a'.repeat(64),'/health?x=1'])await assert.rejects(privateRequest({path,token:'fixture',fetcher}),/PATH/);
 assert.equal(calls,0);
});
test('existing commercial status query/report/complete paths remain supported; private errors sanitized',async()=>{
 const fetcher=async(_url,options)=>Response.json({method:options.method});
 for(const path of ['/commercial/status?sha256='+'a'.repeat(64),'/commercial/report?sha256='+'a'.repeat(64),'/commercial/complete'])assert.equal((await privateRequest({path,token:'fixture',fetcher})).status,200);
 const result=await privateRequest({path:'/health',token:'synthetic-token',fetcher:async()=>{throw Error('synthetic-private-body');}});
 assert.deepEqual(result,{status:0,error:'PRIVATE_SOURCE_TRANSPORT'});
});
