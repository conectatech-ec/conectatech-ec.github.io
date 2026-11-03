import test from 'node:test';
import assert from 'node:assert/strict';
import {auditPrivateSource as auditSource,makeGetter,BASELINE_URL,BASELINE_SHA,WORKER_ORIGIN} from '../private-source-preflight.mjs';

const auditPrivateSource=options=>auditSource({sleep:async()=>{},...options});

function fixture() {
  const catalog = {schema:'conectatech.commercial.v1',source:{sha256:BASELINE_SHA,
    cut_date:'2026-10-21',generated_at:'2026-10-22T00:25:22Z',received_at:'2026-10-22T01:10:43Z'},
    normalized_at:'2026-10-22T01:10:43Z',published_at:null,expires_at:'2026-10-23T00:25:22Z',
    products:Array.from({length:1556},(_,i)=>({sku:`PUBLIC${i}`,name:'synthetic',
      source_name:'synthetic',variant_gb:[],availability:'available',price_cash:1}))};
  const status={schema:catalog.schema,source_sha256:BASELINE_SHA,cut_date:catalog.source.cut_date,
    generated_at:catalog.source.generated_at,expires_at:catalog.expires_at,products:1556,current:false};
  const calls=[]; let read=0; const privateCatalog=structuredClone(catalog);
  return {catalog,status,calls,privateCatalog,get:async(url, options)=>{
    calls.push({url,...options});
    if(url===BASELINE_URL)return structuredClone(catalog);
    if(url.endsWith('/health'))return {ok:true,pilot:true,release:'old-release',meta_ingress_enabled:false,messenger_outbound:false};
    if(url.endsWith('/messenger/status'))return {mode:'development-only',reception_enabled:false,outbound_enabled:false};
    if(url.endsWith('/messenger/seller/status'))return {mode:'authorized-testers-only',enabled:false,live_customers_enabled:false};
    if(url.endsWith('/commercial/catalog/status')) {read++; return structuredClone(status);}
    return structuredClone(privateCatalog);
  },readCount:()=>read};
}
const now = new Date('2026-11-03T00:00:00Z');

test('expired fallback accepted, only published_at ignored; pre records old release',async()=>{
  const f=fixture(); f.privateCatalog.published_at='2026-11-03T00:00:00Z';
  const r=await auditPrivateSource({getJson:f.get,phase:'pre',expectedRelease:'future-release',now});
  assert.equal(r.ok,true); assert.equal(r.observed_release,'old-release');
  assert.equal(r.original_expiry_preserved,true); assert.equal(r.freshness_required,false);
  assert.equal(f.readCount(),2); assert.equal(f.calls.length,7);
  assert.ok(!JSON.stringify(r).includes('synthetic'));
});

test('source, expiry, financial or identity mutation rejected without private values',async()=>{
  for(const mutate of [
    x=>{x.source.sha256='PRIVATE_CHANGED_SECRET';},
    x=>{x.expires_at='2099-01-01T00:00:00Z';},
    x=>{x.products[0].source_name='PRIVATE_CHANGED_SECRET';},
    x=>{x.products[0].price_cash=987654321;},
    x=>{x.products[0].availability='blocked';},
    x=>{x.products[0].variant_gb=['PRIVATE_CHANGED_SECRET'];},
  ]) {
    const f=fixture(); mutate(f.privateCatalog);
    const r=await auditPrivateSource({getJson:f.get,now});
    assert.equal(r.ok,false);
    assert.ok(!JSON.stringify(r).includes('PRIVATE_CHANGED_SECRET'));
    assert.ok(!JSON.stringify(r).includes('987654321'));
  }
});

test('status source changes during read fail closed; post must match candidate release',async()=>{
  const f=fixture(); let n=0;
  const get=async(url,opts)=>{const d=await f.get(url,opts); if(url.endsWith('/commercial/catalog/status')&&++n===2)d.source_sha256='secret';return d;};
  const unstable=await auditPrivateSource({getJson:get,now});
  assert.equal(unstable.error,'STATUS_AFTER_SOURCE_MISMATCH');
  assert.ok(!JSON.stringify(unstable).includes('secret'));
  assert.equal((await auditPrivateSource({getJson:f.get,phase:'post',expectedRelease:'new-release',now})).error,'RELEASE_MISMATCH');
  assert.equal((await auditPrivateSource({getJson:f.get,phase:'post',expectedRelease:'old-release',now})).ok,true);
  assert.equal((await auditPrivateSource({getJson:f.get,phase:'post',now})).error,'EXPECTED_RELEASE_REQUIRED');
});

test('open or missing ingress/outbound flags stop the gate before catalog read',async()=>{
  for(const [field,value,code] of [
    ['meta_ingress_enabled',true,'INGRESS_MUST_BE_CLOSED'],
    ['messenger_outbound',true,'TESTER_SCOPE_MISMATCH'],
    ['messenger_outbound',undefined,'OUTBOUND_STATE_REQUIRED'],
  ]) {
    const f=fixture();
    const get=async(url,opts)=>{const data=await f.get(url,opts);if(url.endsWith('/health'))data[field]=value;return data;};
    const r=await auditPrivateSource({getJson:get,now});
    assert.equal(r.error,code); assert.equal(f.readCount(),0);
  }
});

test('transport is fixed GET-only and token never sent to public origin; errors sanitize body',async()=>{
  const observed=[];
  const get=makeGetter({token:'fixture-only-secret',fetchImpl:async(url,opts)=>{
    observed.push({url,...opts}); return new Response('{"ok":true}',{status:200});
  }});
  await get(BASELINE_URL,{privateRequest:false});
  await get(`${WORKER_ORIGIN}/commercial/catalog`,{privateRequest:true});
  assert.ok(observed.every(x=>x.method==='GET'&&x.body===undefined&&x.redirect==='error'));
  assert.equal(observed[0].headers.Authorization,undefined);
  assert.equal(observed[1].headers.Authorization,'Bearer fixture-only-secret');
  await assert.rejects(()=>get(`${WORKER_ORIGIN}/commercial/report`,{privateRequest:true}),/URL_NOT_ALLOWED/);
  const bad=makeGetter({token:'fixture-only-secret',fetchImpl:async()=>new Response('PRIVATE_RESPONSE',{status:403})});
  await assert.rejects(()=>bad(`${WORKER_ORIGIN}/commercial/catalog`,{privateRequest:true}),error=>error.message==='HTTP_200_REQUIRED');
});


test('post waits only for release propagation, bounded to twelve health reads',async()=>{
 const f=fixture();let healthReads=0;const waits=[];
 const get=async(url,opts)=>{const value=await f.get(url,opts);if(url.endsWith('/health'))value.release=++healthReads<3?'old-release':'new-release';return value;};
 const result=await auditPrivateSource({getJson:get,phase:'post',expectedRelease:'new-release',sleep:async ms=>waits.push(ms)});
 assert.equal(result.ok,true);assert.equal(result.health_attempts,3);assert.deepEqual(waits,[2000,2000]);
 const stuck=fixture();const denied=await auditPrivateSource({getJson:stuck.get,phase:'post',expectedRelease:'never-active'});
 assert.equal(denied.error,'RELEASE_MISMATCH');assert.equal(denied.health_attempts,12);assert.equal(stuck.readCount(),0);
});
test('open ingress during propagation fails immediately without catalog read or further retries',async()=>{
 const f=fixture();let healthReads=0;const waits=[];
 const get=async(url,opts)=>{const value=await f.get(url,opts);if(url.endsWith('/health')&&++healthReads===2)value.meta_ingress_enabled=true;return value;};
 const result=await auditPrivateSource({getJson:get,phase:'post',expectedRelease:'new-release',sleep:async ms=>waits.push(ms)});
 assert.equal(result.error,'INGRESS_MUST_BE_CLOSED');assert.equal(healthReads,2);assert.equal(f.readCount(),0);assert.deepEqual(waits,[2000]);
});


test('existing tester transport is preserved only with private authorized scope and unchanged post state',async()=>{
 const f=fixture();
 const get=async(url,opts)=>{const d=await f.get(url,opts);if(url.endsWith('/health'))d.messenger_outbound=true;if(url.endsWith('/messenger/status'))d.outbound_enabled=true;if(url.endsWith('/messenger/seller/status'))d.enabled=true;return d;};
 const pre=await auditPrivateSource({getJson:get});assert.equal(pre.ok,true);assert.equal(pre.tester_transport_enabled,true);assert.equal(pre.general_reception_enabled,false);
 const post=await auditPrivateSource({getJson:get,phase:'post',expectedRelease:'old-release',previous:pre});assert.equal(post.ok,true);assert.equal(post.previous_verified,true);
 const changed=await auditPrivateSource({getJson:f.get,phase:'post',expectedRelease:'old-release',previous:pre});assert.equal(changed.error,'TESTER_TRANSPORT_CHANGED');
 const publicScope=async(url,opts)=>{const d=await get(url,opts);if(url.endsWith('/messenger/seller/status'))d.mode='general';return d;};
 assert.equal((await auditPrivateSource({getJson:publicScope})).error,'TESTER_SCOPE_MISMATCH');
 const forged={...pre};delete forged.tester_transport_enabled;
 assert.equal((await auditPrivateSource({getJson:get,phase:'post',expectedRelease:'old-release',previous:forged})).error,'PREVIOUS_RECEIPT_INVALID');
});
