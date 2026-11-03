'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {PUBLIC_SKUS,verifyPostImport,createReadOnlyReader,imageFacts}=require('./verificar-postimport-meta.cjs');
const CATALOG='123456',SIGNED='https://scontent.example.fbcdn.net/private-image.jpg?signature=PRIVATE_SIGNATURE_SENTINEL',SECRET='PRIVATE_TOKEN_SENTINEL',PRIVATE_ID='PRIVATE_GRAPH_ID_SENTINEL';
const origin=sku=>'https://conectatech-ec.github.io/imagenes/'+sku.toLowerCase()+'/'+sku+'-approved.webp';
const q=v=>'"'+String(v).replace(/"/g,'""')+'"';
function csv({duplicate=false,omit=false}={}){const ids=omit?PUBLIC_SKUS.slice(1):[...PUBLIC_SKUS];if(duplicate)ids.push(PUBLIC_SKUS[0]);return 'id,title,image_link,price,availability\n'+ids.map(sku=>[sku,'Public title '+sku,origin(sku),'PRICE_PRIVATE_SENTINEL','STOCK_PRIVATE_SENTINEL'].map(q).join(',')).join('\n')+'\n';}
function products(image=origin){return PUBLIC_SKUS.map(sku=>({id:PRIVATE_ID,retailer_id:sku,name:'Public title '+sku,image_url:typeof image==='function'?image(sku):image,price:'PRICE_PRIVATE_SENTINEL',availability:'STOCK_PRIVATE_SENTINEL'}));}
function fake(handler){const calls=[];return {calls,list(){throw Error('UNBOUNDED_LIST_FORBIDDEN');},async request(...args){calls.push(args);return handler(...args);}};}
function privateFieldError(){const error=new Error('Field unavailable '+SECRET+' '+SIGNED);error.meta={code:100,reason:PRIVATE_ID+' '+SECRET+' '+SIGNED};return error;}
function privacy(result){const text=JSON.stringify(result);for(const raw of [SIGNED,SECRET,PRIVATE_ID,CATALOG,'Public title','PRICE_PRIVATE_SENTINEL','STOCK_PRIVATE_SENTINEL','graph.facebook.com','signature='])assert.ok(!text.includes(raw),'private/raw value escaped');for(const d of result.details){assert.ok(PUBLIC_SKUS.includes(d.sku));for(const [k,v]of Object.entries(d))if(k!=='sku')assert.equal(typeof v,'boolean');}}
test('Exact approved names and origin URLs confirm source metadata only, with GET-only fields',async()=>{
 const api=fake(()=>({data:products()})),r=await verifyPostImport({csv:csv(),api,catalogId:CATALOG});assert.equal(r.all_names_confirmed,true);assert.equal(r.all_accepted_source_metadata_confirmed,true);assert.equal(r.accepted_source_url_matches,4);assert.equal(r.rendered_image_bytes_verified,false);assert.equal(r.whatsapp_client_visibility_verified,false);assert.equal(r.requests,1);assert.deepEqual(api.calls[0],['GET',CATALOG+'/products',{fields:'retailer_id,name,image_url',limit:100}]);privacy(r);
});
test('A signed Meta CDN image remains cache-unknown and never certifies the approved source or rendered pixels',async()=>{
 const api=fake(()=>({data:products(SIGNED)})),r=await verifyPostImport({csv:csv(),api,catalogId:CATALOG});assert.equal(r.all_names_confirmed,true);assert.equal(r.all_accepted_source_metadata_confirmed,false);assert.equal(r.accepted_source_url_matches,0);assert.equal(r.image_cache_unknown,4);assert.equal(r.image_unknown,4);assert.ok(r.details.every(d=>d.image_is_meta_cache&&d.image_unknown&&!d.image_exact_content_verified));privacy(r);
});
test('Different origin query parameters are unknown; cache-busting/signature parameters are not stripped into an exact match',()=>{
 const expected='https://conectatech-ec.github.io/imagenes/a.webp?v=2',facts=imageFacts('https://conectatech-ec.github.io/imagenes/a.webp?v=1',expected);assert.equal(facts.accepted_source_url_matches,false);assert.equal(facts.image_is_meta_cache,false);assert.equal(facts.image_exact_content_verified,false);
});
test('Write methods, other resources, extra fields and over-budget calls are rejected before Graph transport',async()=>{
 const api=fake(()=>({data:[]})),reader=createReadOnlyReader(api,{catalogId:CATALOG,maxRequests:1}),params={fields:'retailer_id,name,image_url',limit:100};
 for(const method of ['POST','DELETE','PATCH','PUT'])await assert.rejects(reader.request(method,CATALOG+'/products',params),/VERIFY_WRITES_FORBIDDEN/);
 await assert.rejects(reader.request('GET',CATALOG+'/uploads',params),/VERIFY_REQUEST_OUT_OF_SCOPE/);await assert.rejects(reader.request('GET',CATALOG+'/products',{...params,fields:'id,price,availability'}),/VERIFY_REQUEST_OUT_OF_SCOPE/);await assert.rejects(reader.request('GET',CATALOG+'/products',{...params,access_token:SECRET}),/VERIFY_REQUEST_OUT_OF_SCOPE/);assert.equal(api.calls.length,0);
 await reader.request('GET',CATALOG+'/products',params);await assert.rejects(reader.request('GET',CATALOG+'/products',params),/VERIFY_REQUEST_LIMIT/);assert.equal(api.calls.length,1);assert.throws(()=>createReadOnlyReader(api,{catalogId:CATALOG,maxRequests:21}),/VERIFY_CONFIGURATION_INVALID/);
});
test('An inaccessible image field falls back to names, leaves images unknown, and suppresses raw error details',async()=>{
 const api=fake((method,p,params)=>{if(params.fields.includes('image_url'))throw privateFieldError();return {data:products().map(({retailer_id,name})=>({retailer_id,name}))};});
 const r=await verifyPostImport({csv:csv(),api,catalogId:CATALOG});assert.equal(r.requests,2);assert.equal(r.field_fallback_used,true);assert.equal(r.requested_fields.image_url,false);assert.equal(r.all_names_confirmed,true);assert.equal(r.accepted_source_url_matches,0);assert.equal(r.image_unknown,4);privacy(r);
});
test('If both optional fields are inaccessible, retailer IDs alone never imply names/images match',async()=>{
 const api=fake((method,p,params)=>{if(params.fields!=='retailer_id')throw privateFieldError();return {data:PUBLIC_SKUS.map(retailer_id=>({retailer_id}))};});
 const r=await verifyPostImport({csv:csv(),api,catalogId:CATALOG});assert.equal(r.requests,4);assert.equal(r.targets_found,4);assert.equal(r.names_confirmed,0);assert.equal(r.image_unknown,4);assert.equal(r.requested_fields.name,false);assert.equal(r.requested_fields.image_url,false);privacy(r);
});
test('Permission denial fails closed without exporting IDs, tokens, signed URLs or error text',async()=>{
 const api=fake(()=>{const e=privateFieldError();e.meta.code=200;throw e;});const r=await verifyPostImport({csv:csv(),api,catalogId:CATALOG});assert.equal(r.requests,1);assert.equal(r.graph_access_confirmed,false);assert.equal(r.remote_read_failed,true);assert.equal(r.all_names_confirmed,false);assert.equal(r.field_fallback_used,false);privacy(r);
});
test('Pagination stops at 20 requests including field probes and never follows paging.next URLs',async()=>{
 let calls=0;const api=fake((method,p,params)=>{calls++;if(calls===1)throw privateFieldError();assert.equal(method,'GET');assert.equal(p,CATALOG+'/products');return {data:calls===2?products():[],paging:{next:SIGNED,cursors:{after:'PRIVATE_CURSOR_'+calls}}};});
 const r=await verifyPostImport({csv:csv(),api,catalogId:CATALOG});assert.equal(api.calls.length,20);assert.equal(r.requests,20);assert.equal(r.pages,19);assert.equal(r.request_limit_reached,true);assert.equal(r.pagination_complete,false);assert.equal(r.targets_found,4);assert.equal(r.all_names_confirmed,false);assert.equal(r.all_accepted_source_metadata_confirmed,false);privacy(r);assert.ok(!JSON.stringify(r).includes('PRIVATE_CURSOR_'));
});
test('Missing/repeated pagination cursors fail closed without certifying a partial catalog',async()=>{
 for(const repeated of [false,true]){const api=fake(()=>({data:products(),paging:{next:SIGNED,cursors:repeated?{after:'opaque-cursor'}:{}}})),r=await verifyPostImport({csv:csv(),api,catalogId:CATALOG});assert.equal(r.pagination_invalid,true);assert.equal(r.pagination_complete,false);assert.equal(r.all_names_confirmed,false);assert.ok(r.requests<=2);privacy(r);}
});
test('Invalid expected targets or missing CSV fields prevent every Graph request',async()=>{
 for(const input of [csv({duplicate:true}),csv({omit:true}),'id,title\nAUDI044,Missing image field\n']){const api=fake(()=>{throw Error('MUST_NOT_READ_GRAPH');}),r=await verifyPostImport({csv:input,api,catalogId:CATALOG});assert.equal(r.local_expected_csv_valid,false);assert.equal(r.requests,0);assert.equal(api.calls.length,0);privacy(r);}
});
test('Missing returned fields and duplicate remote SKUs never receive false positive confirmation',async()=>{
 const api=fake(()=>({data:[...products().map(({retailer_id})=>({retailer_id})),{retailer_id:PUBLIC_SKUS[0],name:'Public title '+PUBLIC_SKUS[0],image_url:origin(PUBLIC_SKUS[0])}]})),r=await verifyPostImport({csv:csv(),api,catalogId:CATALOG});assert.equal(r.duplicate_target_count,1);assert.equal(r.names_confirmed,0);assert.equal(r.accepted_source_url_matches,0);assert.ok(r.details.every(d=>!d.name_matches_expected&&!d.accepted_source_url_matches));privacy(r);
});
test('An exhausted request budget during field discovery never turns an inaccessible field into a match',async()=>{
 const api=fake(()=>{throw privateFieldError();}),r=await verifyPostImport({csv:csv(),api,catalogId:CATALOG,maxRequests:1});assert.equal(r.requests,1);assert.equal(r.request_limit_reached,true);assert.equal(r.graph_access_confirmed,false);assert.equal(r.all_names_confirmed,false);assert.equal(r.all_accepted_source_metadata_confirmed,false);privacy(r);
});
const graphModule=process.env.META_VERIFY_GRAPH_MODULE||path.join(__dirname,'sincronizar-conjuntos-meta.cjs');
test('Existing Graph class contract works with an injected transport and makes no real network request',{skip:!fs.existsSync(graphModule)},async()=>{
 // The read-only snapshot may omit the unrelated ordering module. Execute the
 // unchanged existing source with that unused dependency blocked, never main.
 const exported={exports:{}},sandboxRequire=name=>{if(name==='fs')return {};if(name==='node:crypto')return require('node:crypto');if(name==='./prioridad-comercial-meta.cjs')return {orderProducts(){throw Error('ORDERING_FORBIDDEN_IN_READONLY_TEST');}};throw Error('UNEXPECTED_DEPENDENCY');};
 vm.runInNewContext(fs.readFileSync(graphModule,'utf8'),{module:exported,require:sandboxRequire,URL,URLSearchParams,AbortSignal,FormData,Blob,fetch(){throw Error('REAL_NETWORK_FORBIDDEN');}});
 const {Graph}=exported.exports;let count=0;
 const api=new Graph({token:'SYNTHETIC_TEST_TOKEN',version:'v26.0',transport:async(url,options)=>{count++;assert.equal(options.method,'GET');assert.equal(url.pathname,'/v26.0/'+CATALOG+'/products');assert.equal(url.searchParams.get('fields'),'retailer_id,name,image_url');assert.equal(url.searchParams.has('access_token'),false);return {ok:true,text:async()=>JSON.stringify({data:products(SIGNED)})};}});
 const r=await verifyPostImport({csv:csv(),api,catalogId:CATALOG});assert.equal(count,1);assert.equal(r.all_names_confirmed,true);assert.equal(r.image_cache_unknown,4);assert.equal(r.all_accepted_source_metadata_confirmed,false);privacy(r);assert.ok(!JSON.stringify(r).includes('SYNTHETIC_TEST_TOKEN'));
});
