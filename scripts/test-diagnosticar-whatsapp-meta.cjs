'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {ReadOnlyMeta,diagnose,CATALOG}=require('./diagnosticar-whatsapp-meta.cjs');
const TOKEN='synthetic-only-token-never-a-real-credential';
const BUSINESS='800000000000001',WABA='800000000000002',PRIVATE_PHONE='+593 999 111 222';
const scope=new Set(['SKU001','SKU002']);
const json=(body,status=200)=>new Response(JSON.stringify(body),{status});
const denied=(message='PRIVATE_GRAPH_ERROR')=>json({error:{code:100,message}},400);

function fullTransport(calls){return async(url,options)=>{
 assert.equal(url.hostname,'graph.facebook.com');assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
 assert.equal(options.headers.Authorization,'Bearer '+TOKEN);assert.equal(url.searchParams.has('access_token'),false);
 calls.push({path:url.pathname,fields:url.searchParams.get('fields')});
 const path=url.pathname.replace('/v26.0/',''),fields=url.searchParams.get('fields');
 if(path===CATALOG){
  if(fields==='id')return json({id:CATALOG,name:'PRIVATE_NAME_IGNORED'});
  if(fields==='id,business{id}')return denied('PRIVATE_REASON_'+TOKEN);
  if(fields==='id,owner_business{id}')return json({id:CATALOG,owner_business:{id:BUSINESS,name:'PRIVATE_BUSINESS_NAME'}});
 }
 if(path===CATALOG+'/products'){
  if(fields==='retailer_id,review_status')return json({data:[{retailer_id:'SKU001',review_status:'APPROVED'},{retailer_id:'SKU002',review_status:'PENDING'},{retailer_id:'PRIVATE_OUTSIDE_SKU',review_status:'REJECTED'},{retailer_id:'SKU001',review_status:'APPROVED'}]});
  if(fields==='retailer_id,visibility')return json({data:[{retailer_id:'SKU001',visibility:'published'},{retailer_id:'SKU002',visibility:'hidden'}]});
  if(fields==='retailer_id,review_rejection_reasons')return json({data:[{retailer_id:'SKU001',review_rejection_reasons:[]},{retailer_id:'SKU002',review_rejection_reasons:['PRIVATE_REJECTION_REASON_'+TOKEN]}]});
 }
 if(path===BUSINESS+'/owned_whatsapp_business_accounts')return json({data:[{id:WABA,name:'PRIVATE_WABA_NAME'}]});
 if(path===BUSINESS+'/client_whatsapp_business_accounts')return json({data:[]});
 if(path===WABA+'/phone_numbers')return json({data:[{id:'800000000000003',display_phone_number:'+593 99 857 6759'},{id:'800000000000004',display_phone_number:PRIVATE_PHONE}]});
 if(path===WABA+'/product_catalogs')return json({data:[{id:CATALOG,name:'PRIVATE_OTHER_NAME'}]});
 throw Error('Unexpected synthetic path');
};}

test('Every write and every unregistered asset/field is rejected before transport',async()=>{
 let calls=0;const client=new ReadOnlyMeta({token:TOKEN,transport:async()=>{calls++;throw Error('Not expected');}});
 for(const method of ['POST','PUT','PATCH','DELETE'])await assert.rejects(client.request(method,CATALOG,{fields:'id'}),/GET_ONLY/);
 for(const [path,fields]of [[BUSINESS+'/owned_whatsapp_business_accounts','id'],[WABA+'/phone_numbers','id,display_phone_number'],[CATALOG+'/products','retailer_id,price'],[CATALOG+'/uploads','id'],['me/messages','id']])await assert.rejects(client.request('GET',path,{fields}),/READ_SCOPE_VIOLATION/);
 assert.equal(calls,0);
});

test('Existing catalog access discovers only aggregates and same-WABA linkage without leaking private values',async()=>{
 const calls=[];const report=await diagnose({token:TOKEN,scope,transport:fullTransport(calls)});
 assert.equal(report.state,'READ_ONLY_DISCOVERY_COMPLETE');
 assert.deepEqual(report.product_review.review_status.counts,{approved:1,pending:1});
 assert.equal(report.product_review.review_status.outside_public_scope,1);
 assert.equal(report.product_review.review_status.duplicate_records,1);
 assert.deepEqual(report.product_review.visibility.counts,{published:1,hidden:1});
 assert.equal(report.product_review.review_rejection_reasons.public_items_with_rejection_reasons,1);
 assert.equal(report.catalog_ownership.business.readable,false);assert.equal(report.catalog_ownership.owner_business.business_found,true);
 assert.equal(report.assets.businesses_found,1);assert.equal(report.assets.wabas_found,1);
 assert.equal(report.assets.main_public_number_found,true);assert.equal(report.assets.master_catalog_found,true);assert.equal(report.assets.main_number_and_master_catalog_same_waba,true);
 assert.equal(report.write_requests,0);assert.equal(report.customer_messages,0);
 const text=JSON.stringify(report);
 for(const privateValue of [TOKEN,BUSINESS,WABA,PRIVATE_PHONE,'PRIVATE_GRAPH_ERROR','PRIVATE_BUSINESS_NAME','PRIVATE_WABA_NAME','PRIVATE_REJECTION_REASON','PRIVATE_OUTSIDE_SKU','SKU001','SKU002','800000000000003','800000000000004'])assert.equal(text.includes(privateValue),false);
 assert.equal(calls.length,report.read_requests);
});

test('Review field failures remain independent and cannot be mistaken for permission proof',async()=>{
 const transport=async(url)=>{
  const path=url.pathname.replace('/v26.0/',''),fields=url.searchParams.get('fields');
  if(path===CATALOG&&fields==='id')return json({id:CATALOG});
  if(path===CATALOG+'/products'&&fields==='retailer_id,visibility')return json({data:[{retailer_id:'SKU001',visibility:'published'}]});
  return denied('A possibly unsupported field; '+TOKEN);
 };
 const r=await diagnose({token:TOKEN,scope,transport});
 assert.equal(r.product_review.review_status.readable,false);assert.equal(r.product_review.review_status.meta_error_code,100);
 assert.equal(r.product_review.visibility.readable,true);assert.deepEqual(r.product_review.visibility.counts,{published:1});
 assert.equal(r.product_review.review_rejection_reasons.readable,false);assert.equal(r.assets.businesses_found,0);
 assert.equal(JSON.stringify(r).includes(TOKEN),false);assert.equal(r.whatsapp_app_visibility_verified,false);
});

test('Rate limiting stops all further network requests without retries',async()=>{
 let count=0;const transport=async()=>{count++;return count===1?json({id:CATALOG}):json({error:{code:4,message:TOKEN}},429);};
 const r=await diagnose({token:TOKEN,scope,transport});
 assert.equal(count,2);assert.equal(r.read_requests,2);assert.equal(r.limits.rate_limit_stop,true);assert.equal(r.state,'READ_ONLY_DISCOVERY_PARTIAL');
 assert.equal(r.product_review.visibility.reason,'RATE_LIMIT_STOP');assert.equal(JSON.stringify(r).includes(TOKEN),false);
});

test('Pagination uses bounded Graph cursors rather than following provider URLs',async()=>{
 const urls=[];const client=new ReadOnlyMeta({token:TOKEN,maxPages:2,transport:async(url)=>{
  urls.push(url.toString());return url.searchParams.has('after')?json({data:[{retailer_id:'SKU002',visibility:'hidden'}]}):json({data:[{retailer_id:'SKU001',visibility:'published'}],paging:{next:'https://evil.invalid/?access_token='+TOKEN,cursors:{after:'synthetic-cursor'}}});
 }});
 const r=await client.list(CATALOG+'/products','retailer_id,visibility');assert.equal(r.rows.length,2);assert.equal(r.complete,true);
 assert.ok(urls.every(u=>u.startsWith('https://graph.facebook.com/v26.0/')));assert.ok(urls.every(u=>!u.includes('access_token')));
 const bounded=new ReadOnlyMeta({token:TOKEN,maxPages:1,transport:async()=>json({data:[],paging:{next:'https://evil.invalid',cursors:{after:'synthetic'}}})});
 assert.equal((await bounded.list(CATALOG+'/products','retailer_id,visibility')).complete,false);
});

test('Missing configured access and read budget do not initiate unnecessary requests',async()=>{
 let calls=0;const r=await diagnose({token:null,scope,transport:async()=>{calls++;throw Error('Not expected');}});
 assert.equal(r.state,'NO_EXISTING_META_ACCESS');assert.equal(r.read_requests,0);assert.equal(calls,0);
 const client=new ReadOnlyMeta({token:TOKEN,maxRequests:0,transport:async()=>{calls++;throw Error('Not expected');}});
 await assert.rejects(client.request('GET',CATALOG,{fields:'id'}),/READ_BUDGET_EXHAUSTED/);assert.equal(calls,0);
});

test('A matching phone and catalog in different WABAs never certify an actual link',async()=>{
 const first='800000000000101',second='800000000000102';
 const transport=async(url)=>{
  const path=url.pathname.replace('/v26.0/',''),fields=url.searchParams.get('fields');
  if(path===CATALOG&&fields==='id')return json({id:CATALOG});
  if(path===CATALOG&&fields==='id,business{id}')return json({id:CATALOG,business:{id:BUSINESS}});
  if(path===CATALOG&&fields==='id,owner_business{id}')return json({id:CATALOG});
  if(path===CATALOG+'/products')return json({data:[]});
  if(path===BUSINESS+'/owned_whatsapp_business_accounts')return json({data:[{id:first},{id:second}]});
  if(path===BUSINESS+'/client_whatsapp_business_accounts')return json({data:[]});
  if(path===first+'/phone_numbers')return json({data:[{display_phone_number:'+593998576759'}]});
  if(path===second+'/product_catalogs')return json({data:[{id:CATALOG}]});
  return json({data:[]});
 };
 const r=await diagnose({token:TOKEN,scope,transport});
 assert.equal(r.assets.main_public_number_found,true);assert.equal(r.assets.master_catalog_found,true);assert.equal(r.assets.main_number_and_master_catalog_same_waba,false);
 for(const id of [first,second,BUSINESS])assert.equal(JSON.stringify(r).includes(id),false);
});

test('Unsafe numeric private asset IDs stop discovery instead of querying a rounded identifier',async()=>{
 const calls=[];const transport=async(url)=>{
  const path=url.pathname.replace('/v26.0/',''),fields=url.searchParams.get('fields');calls.push(path);
  if(path===CATALOG&&fields==='id')return json({id:CATALOG});
  if(path===CATALOG&&fields==='id,business{id}')return json({id:CATALOG,business:{id:Number(9007199254740993n)}});
  if(path===CATALOG&&fields==='id,owner_business{id}')return json({id:CATALOG,owner_business:{id:Number(9007199254740993n)}});
  return json({data:[]});
 };
 const r=await diagnose({token:TOKEN,scope,transport});
 assert.equal(r.catalog_ownership.business.reason,'ASSET_ID_SCHEMA_INVALID');assert.equal(r.catalog_ownership.owner_business.reason,'ASSET_ID_SCHEMA_INVALID');
 assert.equal(r.assets.businesses_found,0);assert.ok(calls.every(p=>p===CATALOG||p===CATALOG+'/products'));
 assert.equal(JSON.stringify(r).includes('9007199254740992'),false);
});
