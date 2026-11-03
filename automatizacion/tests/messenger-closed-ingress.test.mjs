import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {runClosedIngressProbe,expectedTesterOutboundFromReceipt,readTesterBaseline,PRIVATE_SOURCE_PREFLIGHT_PATH} from '../messenger-closed-ingress-e2e.mjs';
import {messengerProbeScript} from '../tail-proof.mjs';
const base='https://conectatech-comercial-piloto.fixture.workers.dev',token='synthetic-private-probe-token-00000000001',appSecret='synthetic-HMAC-secret-not-a-Meta-credential',verifyToken='synthetic-verification-token-0000000001',release='a'.repeat(40);
function harness(change={}){
 const calls=[],self=[],metrics={ci:0,development:0};let healthCalls=0,statusCalls=0,sellerCalls=0;const metricReads={ci:0,development:0};
 async function fetcher(input,options={}){
  const u=new URL(input),path=u.pathname,body=options.body,auth=options.headers.Authorization==='Bearer '+token;calls.push({path,method:options.method,redirect:options.redirect,auth,hasBody:!!body});
  assert.equal(u.origin,base);assert.equal(options.redirect,'error');
  const json=(d,status=200)=>Response.json(d,{status});
  if(path==='/health'){healthCalls++;return json({release:change.changedRelease&&healthCalls>1?'b'.repeat(40):release,meta_ingress_enabled:change.ingress===true,messenger_outbound:change.changedTester&&healthCalls>1?!change.outbound:change.outbound===true});}
  if(path==='/webhooks/meta'){
   if(options.method==='GET')return u.searchParams.get('hub.verify_token')===verifyToken?new Response(change.badChallenge?'wrong':u.searchParams.get('hub.challenge')):new Response('Forbidden',{status:403});
   assert.equal(body.trim(),JSON.stringify({object:'page',entry:[]}));
   const valid=options.headers['X-Hub-Signature-256']==='sha256='+createHmac('sha256',appSecret).update(body).digest('hex');
   if(change.acceptTamper&&body.endsWith(' '))return json({});
   if(!valid||change.rejectHmac)return json({error:'Invalid signature'},403);
   return json({queued:change.queuedActual?1:0,reception_enabled:false,outbound_enabled:Object.hasOwn(change,'actualOutbound')?change.actualOutbound:false});
  }
  if(!auth)return json({},change.unprotected?200:401);
  if(path==='/messenger/status'){statusCalls++;return json({mode:change.generalMode?'live':'development-only',reception_enabled:change.generalReception===true,outbound_enabled:change.changedStatus&&statusCalls>1?!change.outbound:change.outbound===true,private_ignored:'SYNTHETIC PRIVATE MUST NOT LEAK'});}
  if(path==='/messenger/seller/status'){sellerCalls++;return json({mode:change.sellerGeneral?'all-customers':'authorized-testers-only',enabled:change.sellerDisabled===true||change.sellerChanged&&sellerCalls>1?false:change.outbound===true,live_customers_enabled:change.sellerGeneral===true});}
  if(path==='/messenger/metrics'){
   const scope=u.searchParams.get('scope')==='ci'?'ci':'development';metricReads[scope]++;if(metricReads[scope]>1&&(change.sent||change.globalSent&&scope==='development'||change.ciSent&&scope==='ci'))metrics[scope]++;
   return json({messages_sent:metrics[scope],outbound_enabled:scope==='ci'?false:change.outbound===true});
  }
  if(path==='/messenger/self-test'){
   const d=JSON.parse(body);self.push(d.case);assert.ok(!['accept','pairing_claim'].includes(d.case));
   const status=['bad_signature','tamper','bad_verify_token'].includes(d.case)?403:200;
   return json({synthetic:true,webhook_status:status,challenge_matches:true,event_ref:'SYNTHETIC_EVENT_MUST_NOT_LEAK',ack:d.case.includes('verify')?undefined:{queued:change.queuedSelf?1:0,outbound_enabled:false}});
  }
  if(path==='/messenger/receipts')return json({receipts:change.missingReceipts?[]:[{source:'authorized_ci_probe',signature_valid:true,http_status:200,reason:'ingress_disabled',sender:'SYNTHETIC SENDER MUST NOT LEAK'},{source:'authorized_ci_probe',signature_valid:false,http_status:403,reason:'invalid_signature'}]});
  throw Error('UNEXPECTED_ROUTE');
 }
 return {fetcher,calls,self};
}
const options=h=>({base,token,appSecret,verifyToken,expectedRelease:release,fetcher:h.fetcher});
test('Explicit closed scope chooses only closed probe; all legacy/default scopes remain unchanged',()=>{
 assert.equal(messengerProbeScript('closed_ingress_only'),'automatizacion/messenger-closed-ingress-e2e.mjs');
 for(const scope of [undefined,'','marketplace_pilot','synthetic_loopback_http_real_sqlite_hmac_no_external_network'])assert.equal(messengerProbeScript(scope),'automatizacion/messenger-e2e.mjs');
});
test('Success uses actual cryptographic configured HMAC and only bounded non-queue operations',async()=>{
 const h=harness(),r=await runClosedIngressProbe(options(h));assert.equal(r.passed,true);assert.equal(r.configured_hmac_verified,true);assert.equal(r.messages_sent_by_probe,0);assert.equal(r.actual_Meta_delivery_verified,false);assert.equal(r.financial_drafts_created,0);assert.equal(r.customer_events_created,0);
 assert.deepEqual(h.self,['bad_signature','tamper','foreign_sender','echo','verify_challenge','bad_verify_token','ingress_disabled']);assert.equal(h.calls.length,24);
 assert.ok(h.calls.every(c=>['/health','/messenger/status','/messenger/metrics','/messenger/self-test','/webhooks/meta','/messenger/receipts','/commercial/catalog'].includes(c.path)));
 assert.ok(h.calls.filter(c=>c.path==='/commercial/catalog').every(c=>!c.auth&&c.method==='GET'));
 const serialized=JSON.stringify(r);for(const secret of [token,appSecret,verifyToken,'SYNTHETIC PRIVATE','SYNTHETIC_EVENT','SYNTHETIC SENDER'])assert.ok(!serialized.includes(secret));
});
test('Unsafe origin, missing credentials, open ingress/outbound or wrong release fail before any POST',async()=>{
 for(const edit of [{base:'https://graph.facebook.com'},{token:''},{appSecret:''},{verifyToken:''},{expectedRelease:'b'.repeat(40)}]){const h=harness();await assert.rejects(runClosedIngressProbe({...options(h),...edit}),/^Error: CLOSED_PROBE_/);assert.ok(h.calls.every(c=>c.method!=='POST'));}
 for(const change of [{ingress:true},{outbound:true}]){const h=harness(change);await assert.rejects(runClosedIngressProbe(options(h)),/GENERAL_INGRESS_OPEN|TESTER_STATE_CHANGED/);assert.ok(h.calls.every(c=>c.method!=='POST'));}
});
test('A self-test that enqueues and an actual empty probe that enqueues are both rejected',async()=>{
 for(const [change,code]of [[{queuedSelf:true},'SELF_TEST_QUEUED'],[{queuedActual:true},'CONFIGURED_INGRESS_OPEN']]){const h=harness(change);await assert.rejects(runClosedIngressProbe(options(h)),new RegExp(code));}
});
test('Wrong challenge, invalid configured HMAC and accepted tamper cannot pass',async()=>{
 for(const [change,code]of [[{badChallenge:true},'CONFIGURED_CHALLENGE'],[{rejectHmac:true},'CONFIGURED_HMAC'],[{acceptTamper:true},'CONFIGURED_TAMPER']]){const h=harness(change);await assert.rejects(runClosedIngressProbe(options(h)),new RegExp(code));}
});
test('Missing signed receipts, unprotected routes, delivery counter change and release change are rejected',async()=>{
 for(const [change,code]of [[{missingReceipts:true},'SIGNED_RECEIPT'],[{unprotected:true},'PRIVATE_ROUTE'],[{sent:true},'MESSAGES_CHANGED'],[{changedRelease:true},'RELEASE_MISMATCH']]){const h=harness(change);await assert.rejects(runClosedIngressProbe(options(h)),new RegExp(code));}
});
test('Transport errors containing a credential URL are replaced by a fixed code without cause or values',async()=>{
 const h=harness();h.fetcher=async()=>{throw Error('URL '+base+'?hub.verify_token='+verifyToken+' token='+token);};
 await assert.rejects(runClosedIngressProbe(options(h)),error=>{assert.equal(error.message,'CLOSED_PROBE_TRANSPORT');assert.equal(error.cause,undefined);assert.ok(!String(error).includes(verifyToken));assert.ok(!String(error).includes(token));return true;});
});

function receipt(enabled=false){return {schema:'conectatech.private-source-gate.v1',phase:'pre',ok:true,audit_only:true,catalog_http_200:true,source_stable:true,equal_except_published_at:true,original_expiry_preserved:true,general_reception_enabled:false,tester_transport_enabled:enabled};}
test('A complete successful pre receipt is the only CLI baseline source; default remains false',async()=>{
 for(const enabled of [false,true]){const r=receipt(enabled);assert.equal(expectedTesterOutboundFromReceipt(r),enabled);let reads=0;assert.equal(await readTesterBaseline(PRIVATE_SOURCE_PREFLIGHT_PATH,async path=>{reads++;assert.equal(path,PRIVATE_SOURCE_PREFLIGHT_PATH);return JSON.stringify(r);}),enabled);assert.equal(reads,1);}
 const h=harness({outbound:true});await assert.rejects(runClosedIngressProbe(options(h)),/TESTER_STATE_CHANGED/);assert.ok(h.calls.every(c=>c.method!=='POST'));
});
test('Forged, failed, wrong phase, general-open, partial or string-boolean receipts cannot enable the probe',async()=>{
 for(const change of [{schema:'other'},{phase:'post'},{ok:false},{audit_only:false},{catalog_http_200:false},{source_stable:false},{equal_except_published_at:false},{original_expiry_preserved:false},{general_reception_enabled:true},{tester_transport_enabled:'true'},{tester_transport_enabled:undefined}])assert.throws(()=>expectedTesterOutboundFromReceipt({...receipt(true),...change}),/PREFLIGHT_RECEIPT/);
 assert.throws(()=>expectedTesterOutboundFromReceipt({phase:'pre',ok:true,tester_transport_enabled:true}),/PREFLIGHT_RECEIPT/);
 for(const path of ['/tmp/forged.json','../private-source-pre.json',PRIVATE_SOURCE_PREFLIGHT_PATH+'?changed=1'])await assert.rejects(readTesterBaseline(path,async()=>{throw Error('MUST_NOT_READ');}),/PREFLIGHT_PATH/);
 await assert.rejects(readTesterBaseline(PRIVATE_SOURCE_PREFLIGHT_PATH,async()=>'{broken'),/PREFLIGHT_READ/);
 const h=harness();await assert.rejects(runClosedIngressProbe({...options(h),expectedTesterOutbound:'true'}),/TESTER_BASELINE/);assert.equal(h.calls.length,0);
});
test('Existing authorized tester transport stays enabled while probe and CI send no messages',async()=>{
 for(const actualOutbound of [false,true]){
  const h=harness({outbound:true,actualOutbound}),r=await runClosedIngressProbe({...options(h),expectedTesterOutbound:expectedTesterOutboundFromReceipt(receipt(true))});
  assert.equal(r.passed,true);assert.equal(r.existing_tester_transport_enabled,true);assert.equal(r.probe_outbound_enabled,false);assert.equal(r.general_reception_enabled,false);assert.equal(r.ci_messages_sent_delta,0);assert.equal(r.messages_sent_by_probe,0);assert.equal(r.global_messages_counter_delta,0);assert.equal(h.calls.length,26);
  assert.equal(r.outbound_enabled,undefined);assert.equal(r.actual_Meta_delivery_verified,false);
  assert.ok(!h.calls.some(c=>/enable|disable|arm|promote|process|accept|chat|pairing/.test(c.path)));assert.ok(h.calls.every(c=>c.method!=='POST'||['/messenger/self-test','/webhooks/meta'].includes(c.path)));
 }
});
test('Activity from the existing tester transport is reported separately without claiming attribution',async()=>{
 const h=harness({outbound:true,globalSent:true}),r=await runClosedIngressProbe({...options(h),expectedTesterOutbound:true});
 assert.equal(r.passed,true);assert.equal(r.global_messages_counter_delta,1);assert.equal(r.concurrent_global_counter_change_observed,true);assert.equal(r.global_counter_change_attribution,'not_attributed_to_probe');assert.equal(r.ci_messages_sent_delta,0);assert.equal(r.Graph_messages_sent,0);assert.equal(r.messages_sent_by_probe,0);
 const ci=harness({outbound:true,ciSent:true});await assert.rejects(runClosedIngressProbe({...options(ci),expectedTesterOutbound:true}),/MESSAGES_CHANGED/);
});
test('Existing tester mode, enablement and closed general ingress must match the baseline throughout',async()=>{
 for(const [change,code]of [[{outbound:true,ingress:true},'GENERAL_INGRESS_OPEN'],[{outbound:true,generalReception:true},'GENERAL_INGRESS_OPEN'],[{outbound:true,generalMode:true},'GENERAL_INGRESS_OPEN'],[{outbound:true,sellerGeneral:true},'TESTER_SCOPE_CHANGED'],[{outbound:true,sellerDisabled:true},'TESTER_SCOPE_CHANGED'],[{outbound:true,changedTester:true},'TESTER_STATE_CHANGED'],[{outbound:true,changedStatus:true},'TESTER_STATE_CHANGED'],[{outbound:true,sellerChanged:true},'TESTER_SCOPE_CHANGED']]){const h=harness(change);await assert.rejects(runClosedIngressProbe({...options(h),expectedTesterOutbound:true}),new RegExp(code));}
});
test('Empty probe acknowledgement cannot turn outbound on from a false baseline or use a nonboolean',async()=>{
 for(const [change,expectedTesterOutbound]of [[{actualOutbound:true},false],[{actualOutbound:'true',outbound:true},true]]){const h=harness(change);await assert.rejects(runClosedIngressProbe({...options(h),expectedTesterOutbound}),/CONFIGURED_INGRESS_OPEN/);}
});
