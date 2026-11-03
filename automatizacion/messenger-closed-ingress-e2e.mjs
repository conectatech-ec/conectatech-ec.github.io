// Real private HTTPS closed-ingress probe. No customer event, draft, pairing, AI or Graph send.
import {createHmac} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const fail=code=>{throw Error(code);};
const check=(condition,code)=>{if(!condition)fail(code);};
export const PRIVATE_SOURCE_PREFLIGHT_PATH='automatizacion/generated/fase2/private-source-pre.json';
export function expectedTesterOutboundFromReceipt(receipt){
 check(receipt?.schema==='conectatech.private-source-gate.v1'&&receipt.phase==='pre'&&receipt.ok===true&&receipt.audit_only===true&&receipt.catalog_http_200===true&&receipt.source_stable===true&&receipt.equal_except_published_at===true&&receipt.original_expiry_preserved===true&&receipt.general_reception_enabled===false&&typeof receipt.tester_transport_enabled==='boolean','CLOSED_PROBE_PREFLIGHT_RECEIPT');
 return receipt.tester_transport_enabled;
}
export async function readTesterBaseline(path,reader=readFile){
 check(path===PRIVATE_SOURCE_PREFLIGHT_PATH,'CLOSED_PROBE_PREFLIGHT_PATH');
 let receipt;try{const text=await reader(path,'utf8');check(text.length<=64000,'CLOSED_PROBE_PREFLIGHT_SIZE');receipt=JSON.parse(text);}catch{fail('CLOSED_PROBE_PREFLIGHT_READ');}
 return expectedTesterOutboundFromReceipt(receipt);
}
export async function runClosedIngressProbe({base,token,appSecret,verifyToken,expectedRelease,expectedTesterOutbound=false,fetcher=fetch}){
 check(typeof expectedTesterOutbound==='boolean','CLOSED_PROBE_TESTER_BASELINE');
 check(/^https:\/\/conectatech-comercial-piloto\.[a-z0-9-]+\.workers\.dev$/.test(base||''),'CLOSED_PROBE_ORIGIN');
 check(typeof token==='string'&&token.length>=32,'CLOSED_PROBE_PRIVATE_TOKEN');
 check(typeof appSecret==='string'&&appSecret.length>0&&typeof verifyToken==='string'&&verifyToken.length>=32,'CLOSED_PROBE_META_SECRETS');
 const report={mode:'real_private_https_closed_ingress_only',passed:false,AI_calls_issued_by_test:0,Graph_messages_sent:0,customer_events_created:0,financial_drafts_created:0,actual_Meta_delivery_verified:false,existing_tester_transport_enabled:expectedTesterOutbound,probe_outbound_enabled:false,general_reception_enabled:false,checks:[]};
 const deadline=AbortSignal.timeout(90000);
 const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 async function request(path,{method='GET',body,auth=true,extraHeaders={}}={}){
  try{return await fetcher(base+path,{method,headers:{...(auth?headers:{}),...extraHeaders},body,redirect:'error',signal:AbortSignal.any([deadline,AbortSignal.timeout(15000)])});}catch{fail('CLOSED_PROBE_TRANSPORT');}
 }
 async function json(path,options){const r=await request(path,options);check(r.status===200,'CLOSED_PROBE_HTTP');try{return await r.json();}catch{fail('CLOSED_PROBE_JSON');}}
 async function closed(){
  const health=await json('/health');check(health.meta_ingress_enabled===false,'CLOSED_PROBE_GENERAL_INGRESS_OPEN');check(health.messenger_outbound===expectedTesterOutbound,'CLOSED_PROBE_TESTER_STATE_CHANGED');
  check(/^[a-f0-9]{40}$/.test(health.release||''),'CLOSED_PROBE_RELEASE');if(expectedRelease)check(health.release===expectedRelease,'CLOSED_PROBE_RELEASE_MISMATCH');
  const state=await json('/messenger/status');check(state.mode==='development-only'&&state.reception_enabled===false,'CLOSED_PROBE_GENERAL_INGRESS_OPEN');check(state.outbound_enabled===expectedTesterOutbound,'CLOSED_PROBE_TESTER_STATE_CHANGED');
  if(expectedTesterOutbound){const seller=await json('/messenger/seller/status');check(seller.mode==='authorized-testers-only'&&seller.enabled===true&&seller.live_customers_enabled===false,'CLOSED_PROBE_TESTER_SCOPE_CHANGED');}
  return health.release;
 }
 report.release=await closed();
 const sentBefore={};for(const scope of ['ci','development']){const m=await json('/messenger/metrics'+(scope==='ci'?'?scope=ci':''));check(Number.isSafeInteger(m.messages_sent)&&m.messages_sent>=0&&m.outbound_enabled===(scope==='ci'?false:expectedTesterOutbound),'CLOSED_PROBE_METRICS');sentBefore[scope]=m.messages_sent;}
 for(const [kind,status]of [['bad_signature',403],['tamper',403],['foreign_sender',200],['echo',200],['verify_challenge',200],['bad_verify_token',403],['ingress_disabled',200]]){
  const data=await json('/messenger/self-test',{method:'POST',body:JSON.stringify({sku:'MICR27',test_id:'closed-'+crypto.randomUUID(),case:kind})});
  check(data.synthetic===true&&data.webhook_status===status,'CLOSED_PROBE_SELF_TEST');
  if(data.ack)check((data.ack.queued||0)===0&&data.ack.outbound_enabled!==true&&data.ack.reception_enabled!==true,'CLOSED_PROBE_SELF_TEST_QUEUED');
  if(kind==='verify_challenge')check(data.challenge_matches===true,'CLOSED_PROBE_CHALLENGE');report.checks.push({case:kind,http:status});
 }
 const challenge='closed-ingress-challenge';
 for(const valid of [true,false]){
  const q=new URLSearchParams({'hub.mode':'subscribe','hub.verify_token':valid?verifyToken:verifyToken+'-invalid','hub.challenge':challenge});
  const r=await request('/webhooks/meta?'+q);check(r.status===(valid?200:403),'CLOSED_PROBE_CONFIGURED_CHALLENGE');if(valid)check(await r.text()===challenge,'CLOSED_PROBE_CONFIGURED_CHALLENGE');
 }
 const raw=JSON.stringify({object:'page',entry:[]}),signature='sha256='+createHmac('sha256',appSecret).update(raw).digest('hex');
 const signed=await request('/webhooks/meta',{method:'POST',body:raw,extraHeaders:{'X-Hub-Signature-256':signature}});check(signed.status===200,'CLOSED_PROBE_CONFIGURED_HMAC');const ack=await signed.json();
 check(ack.reception_enabled===false&&typeof ack.outbound_enabled==='boolean'&&(ack.outbound_enabled===false||ack.outbound_enabled===expectedTesterOutbound)&&ack.queued===0,'CLOSED_PROBE_CONFIGURED_INGRESS_OPEN');
 const tampered=await request('/webhooks/meta',{method:'POST',body:raw+' ',extraHeaders:{'X-Hub-Signature-256':signature}});check(tampered.status===403,'CLOSED_PROBE_CONFIGURED_TAMPER');
 const audit=await json('/messenger/receipts');check(audit.receipts?.some(r=>r.source==='authorized_ci_probe'&&r.signature_valid===true&&r.http_status===200&&r.reason==='ingress_disabled'),'CLOSED_PROBE_SIGNED_RECEIPT');
 check(audit.receipts?.some(r=>r.source==='authorized_ci_probe'&&r.signature_valid===false&&r.http_status===403&&r.reason==='invalid_signature'),'CLOSED_PROBE_INVALID_RECEIPT');
 for(const path of ['/commercial/catalog','/messenger/status','/messenger/metrics','/messenger/receipts'])check((await request(path,{auth:false})).status===401,'CLOSED_PROBE_PRIVATE_ROUTE');
 for(const scope of ['ci','development']){
  const m=await json('/messenger/metrics'+(scope==='ci'?'?scope=ci':''));check(Number.isSafeInteger(m.messages_sent)&&m.messages_sent>=0&&m.outbound_enabled===(scope==='ci'?false:expectedTesterOutbound),'CLOSED_PROBE_METRICS');
  const delta=m.messages_sent-sentBefore[scope];
  if(scope==='ci'||!expectedTesterOutbound)check(delta===0,'CLOSED_PROBE_MESSAGES_CHANGED');
  if(scope==='ci')report.ci_messages_sent_delta=delta;
  else{report.global_messages_counter_delta=delta;report.concurrent_global_counter_change_observed=delta!==0;report.global_counter_change_attribution='not_attributed_to_probe';}
 }
 check(await closed()===report.release,'CLOSED_PROBE_RELEASE_CHANGED');
 report.configured_challenge_verified=true;report.configured_hmac_verified=true;report.configured_tamper_http=403;report.signed_empty_probe_receipt_verified=true;report.messages_sent_by_probe=0;report.general_reception_enabled=false;report.passed=true;return report;
}
async function main(){
 let report;
 try{
  check(process.argv.length===2,'CLOSED_PROBE_ARGUMENT');
  const expectedTesterOutbound=process.env.PRIVATE_SOURCE_PREFLIGHT?await readTesterBaseline(process.env.PRIVATE_SOURCE_PREFLIGHT):false;
  report=await runClosedIngressProbe({expectedTesterOutbound,base:process.env.PILOT_BASE_URL||'https://conectatech-comercial-piloto.conectatech-ecu.workers.dev',token:process.env.PILOT_TOKEN,appSecret:process.env.META_APP_SECRET,verifyToken:process.env.META_VERIFY_TOKEN,expectedRelease:process.env.EXPECTED_RELEASE});
 }catch(error){report={mode:'real_private_https_closed_ingress_only',passed:false,error:/^[A-Z0-9_]+$/.test(error.message)?error.message:'CLOSED_PROBE_FAILED',actual_Meta_delivery_verified:false};process.exitCode=1;}
 const dir=new URL('./generated/fase2/',import.meta.url);await mkdir(dir,{recursive:true});await writeFile(new URL('messenger-closed-ingress-e2e.json',dir),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await main();
