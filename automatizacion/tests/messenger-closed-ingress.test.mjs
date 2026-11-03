import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {runClosedIngressProbe} from '../messenger-closed-ingress-e2e.mjs';
import {messengerProbeScript} from '../tail-proof.mjs';
const base='https://conectatech-comercial-piloto.fixture.workers.dev',token='synthetic-private-probe-token-00000000001',appSecret='synthetic-HMAC-secret-not-a-Meta-credential',verifyToken='synthetic-verification-token-0000000001',release='a'.repeat(40);
function harness(change={}){
 const calls=[],self=[],metrics={ci:0,development:0};let healthCalls=0,metricsCalls=0;
 async function fetcher(input,options={}){
  const u=new URL(input),path=u.pathname,body=options.body,auth=options.headers.Authorization==='Bearer '+token;calls.push({path,method:options.method,redirect:options.redirect,auth,hasBody:!!body});
  assert.equal(u.origin,base);assert.equal(options.redirect,'error');
  const json=(d,status=200)=>Response.json(d,{status});
  if(path==='/health'){healthCalls++;return json({release:change.changedRelease&&healthCalls>1?'b'.repeat(40):release,meta_ingress_enabled:change.ingress===true,messenger_outbound:change.outbound===true});}
  if(path==='/webhooks/meta'){
   if(options.method==='GET')return u.searchParams.get('hub.verify_token')===verifyToken?new Response(change.badChallenge?'wrong':u.searchParams.get('hub.challenge')):new Response('Forbidden',{status:403});
   assert.equal(body.trim(),JSON.stringify({object:'page',entry:[]}));
   const valid=options.headers['X-Hub-Signature-256']==='sha256='+createHmac('sha256',appSecret).update(body).digest('hex');
   if(change.acceptTamper&&body.endsWith(' '))return json({});
   if(!valid||change.rejectHmac)return json({error:'Invalid signature'},403);
   return json({queued:change.queuedActual?1:0,reception_enabled:false,outbound_enabled:false});
  }
  if(!auth)return json({},change.unprotected?200:401);
  if(path==='/messenger/status')return json({mode:'development-only',reception_enabled:false,outbound_enabled:false,private_ignored:'SYNTHETIC PRIVATE MUST NOT LEAK'});
  if(path==='/messenger/metrics'){
   const scope=u.searchParams.get('scope')==='ci'?'ci':'development';metricsCalls++;if(change.sent&&metricsCalls>2)metrics[scope]++;
   return json({messages_sent:metrics[scope],outbound_enabled:false});
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
 const h=harness(),r=await runClosedIngressProbe(options(h));assert.equal(r.passed,true);assert.equal(r.configured_hmac_verified,true);assert.equal(r.messages_sent_delta,0);assert.equal(r.actual_Meta_delivery_verified,false);assert.equal(r.financial_drafts_created,0);assert.equal(r.customer_events_created,0);
 assert.deepEqual(h.self,['bad_signature','tamper','foreign_sender','echo','verify_challenge','bad_verify_token','ingress_disabled']);assert.equal(h.calls.length,24);
 assert.ok(h.calls.every(c=>['/health','/messenger/status','/messenger/metrics','/messenger/self-test','/webhooks/meta','/messenger/receipts','/commercial/catalog'].includes(c.path)));
 assert.ok(h.calls.filter(c=>c.path==='/commercial/catalog').every(c=>!c.auth&&c.method==='GET'));
 const serialized=JSON.stringify(r);for(const secret of [token,appSecret,verifyToken,'SYNTHETIC PRIVATE','SYNTHETIC_EVENT','SYNTHETIC SENDER'])assert.ok(!serialized.includes(secret));
});
test('Unsafe origin, missing credentials, open ingress/outbound or wrong release fail before any POST',async()=>{
 for(const edit of [{base:'https://graph.facebook.com'},{token:''},{appSecret:''},{verifyToken:''},{expectedRelease:'b'.repeat(40)}]){const h=harness();await assert.rejects(runClosedIngressProbe({...options(h),...edit}),/^Error: CLOSED_PROBE_/);assert.ok(h.calls.every(c=>c.method!=='POST'));}
 for(const change of [{ingress:true},{outbound:true}]){const h=harness(change);await assert.rejects(runClosedIngressProbe(options(h)),/INGRESS_OR_OUTBOUND_OPEN/);assert.ok(h.calls.every(c=>c.method!=='POST'));}
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
