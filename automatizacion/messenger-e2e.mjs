import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {hmac} from './messenger.mjs';
const base=process.env.PILOT_BASE_URL,token=process.env.PILOT_TOKEN;
assert.ok(base&&token,'Deployed pilot and private token required');
const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
const report={mode:process.env.MESSENGER_E2E_SCOPE||'synthetic_signed_https_development_pipeline',meta_app_verified:false,outbound_enabled:false,tests:[],prepared:[],passed:false};
const output=new URL('./generated/fase2/messenger-e2e.json',import.meta.url);
async function call(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});const data=await r.json();assert.equal(r.status,200);return data;}
try {
 const references=[];
 for(const sku of ['MICR27','POWE003','ADAP005']) {
  const test_id='ci-'+crypto.randomUUID();const b={sku,test_id,case:'accept'};
  const a=await call('/messenger/self-test',b);assert.equal(a.synthetic,true);assert.equal(a.webhook_status,200);assert.equal(a.ack.queued,1);assert.equal(a.ack.outbound_enabled,false);
  const duplicate=await call('/messenger/self-test',b);assert.equal(duplicate.ack.duplicates,1);references.push({sku,ref:a.event_ref});
 }
 for(const [kind,status] of [['bad_signature',403],['tamper',403],['foreign_sender',200],['echo',200],['verify_challenge',200],['bad_verify_token',403],['ingress_disabled',200]]) {
  const r=await call('/messenger/self-test',{sku:'MICR27',test_id:'ci-'+crypto.randomUUID(),case:kind});assert.equal(r.webhook_status,status);if(r.ack)assert.equal(r.ack.queued||0,0);if(kind==='verify_challenge')assert.equal(r.challenge_matches,true);report.tests.push({case:kind,status});
 }
 let rows=[];
 for(let i=0;i<25;i++) {
  const preview=await call('/messenger/test-results?scope=ci');rows=preview.events;
  if(references.every(x=>rows.some(r=>r.event_ref===x.ref&&r.status==='prepared')))break;
  await new Promise(r=>setTimeout(r,1000));
 }
 for(const reference of references) {
  const row=rows.find(r=>r.event_ref===reference.ref);assert.equal(row?.status,'prepared',reference.sku+' must be durably prepared');const draft=row.result.find(d=>d.sku===reference.sku);assert.ok(draft.foto);assert.ok(draft.precio>0);assert.equal(draft.send_enabled,false);assert.ok(draft.messages.some(m=>m.attachment?.type==='template'));report.prepared.push({sku:draft.sku,precio:draft.precio,stock_referencial:draft.stock_referencial,foto:draft.foto,banner:draft.banner,native_card:true,duplicate_ignored:true});
 }
 const reviewRow=rows.find(r=>r.event_ref===references[0].ref);
 const approved=await call('/messenger/review?scope=ci',{event_ref:reviewRow.event_ref,result_digest:reviewRow.result_digest,decision:'aprobado'});assert.equal(approved.send_enabled,false);assert.equal(approved.decision,'aprobado');
 const rejectedRow=rows.find(r=>r.event_ref===references[1].ref);
 await call('/messenger/review?scope=ci',{event_ref:rejectedRow.event_ref,result_digest:rejectedRow.result_digest,decision:'rechazado'});
 const stale=await fetch(base+'/messenger/review?scope=ci',{method:'POST',headers,body:JSON.stringify({event_ref:reviewRow.event_ref,result_digest:'0'.repeat(64),decision:'aprobado'})});assert.equal(stale.status,409);
 const metrics=await call('/messenger/metrics?scope=ci');assert.equal(metrics.messages_sent,0);assert.ok(metrics.daily.reduce((n,d)=>n+d.consultas,0)>=3);assert.ok(metrics.daily.reduce((n,d)=>n+d.duplicates,0)>=3);report.metrics_and_human_review='passed';report.changed_draft_review_status=409;
 const health=await (await fetch(base+'/health')).json();report.runtime_meta_configuration_present=health.messenger_configured;assert.equal(health.meta_ingress_enabled,false);report.meta_page_reception_enabled=false;
 const status=await call('/messenger/status');report.meta_secret_readiness={app_secret:status.app_secret_present,verify_token:status.verify_token_present,page:status.page_present,test_senders:status.test_senders_present};
 if(process.env.META_VERIFY_TOKEN) {
  const url=new URL(base+'/webhooks/meta');url.searchParams.set('hub.mode','subscribe');url.searchParams.set('hub.verify_token',process.env.META_VERIFY_TOKEN);url.searchParams.set('hub.challenge','ct-meta-dev-challenge');
  let r;try{r=await fetch(url,{signal:AbortSignal.timeout(10000)});}catch{throw Error('Configured verification HTTPS request failed; URL withheld');}
  assert.equal(r.status,200);assert.equal(await r.text(),'ct-meta-dev-challenge');report.configured_verify_token_handshake='passed';
 } else report.configured_verify_token_handshake='pending_secret';
 if(process.env.META_APP_SECRET) {
  assert.equal(status.app_secret_present,true);
  const raw=JSON.stringify({object:'page',entry:[]});const signature='sha256='+await hmac(process.env.META_APP_SECRET,raw);
  const signed=await fetch(base+'/webhooks/meta',{method:'POST',headers:{'X-Hub-Signature-256':signature},body:raw,signal:AbortSignal.timeout(10000)});
  assert.equal(signed.status,status.page_present&&status.test_senders_present?200:503);
  const tampered=await fetch(base+'/webhooks/meta',{method:'POST',headers:{'X-Hub-Signature-256':signature},body:raw+' '});assert.equal(tampered.status,403);
  report.configured_app_secret_hmac='passed_empty_fixture_not_Meta_delivery';report.configured_signature_tamper_status=403;
 } else report.configured_app_secret_hmac='pending_secret';
 for(const path of ['/messenger/test-results?scope=ci','/messenger/status','/messenger/metrics','/messenger/review']){const unauth=await fetch(base+path);assert.equal(unauth.status,401);}report.preview_without_token=401;report.passed=true;console.log(JSON.stringify(report));
} catch(e){report.error=String(e.message).slice(0,500);throw e;}
finally{await mkdir(new URL('./generated/fase2/',import.meta.url),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');}
