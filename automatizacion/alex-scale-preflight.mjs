// Private operator HTTPS verification, never a customer event or Graph send.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {central} from './central-source.mjs';
import {readSharedHub} from './shared-hub.mjs';
import {refreshAlexCatalog,alexBaseline} from './alex-catalog.mjs';
import {generateAlex} from './alex.mjs';
import {assessChannel,referrals} from './alex-channel-readiness.mjs';
const base='https://conectatech-comercial-piloto.conectatech-ecu.workers.dev';
const report={at:new Date().toISOString(),schema:'conectatech.alex.readiness.v1',production_modified:false,worker_deployed:false,
 Graph_sends:0,customer_webhook_events_posted:0,external_customers_activated:false,new_paid_services:0,
 evidence_kind:'public_Hub_and_private_operator_HTTPS_not_real_channel_delivery',checks:[],conversations:[]};
const token=process.env.PILOT_TOKEN,headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
async function request(path,body,privateRequest=true){
 const r=await fetch(base+path,{method:body?'POST':'GET',headers:privateRequest?headers:{},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(60000)});
 assert.equal(r.status,200);return r.json();
}
try{
 assert.ok(token,'OPERATOR_SECRET_REQUIRED');
 const h=await request('/health',null,false);assert.equal(h.ok,true);assert.equal(h.meta_ingress_enabled,false);
 report.Worker={release:h.release,ai_binding:h.ai_binding,generative_configured:h.alex_generative,catalog_first:h.catalog_first,external_ingress:false,tester_outbound:h.messenger_outbound};
 for(const path of ['/alex/status','/alex/quota','/commercial/catalog','/messenger/status']){
  const r=await fetch(base+path,{redirect:'error',signal:AbortSignal.timeout(15000)});assert.equal(r.status,401);report.checks.push({path,anonymous_http:r.status});
 }
 for(const path of ['/privacy','/data-deletion']){const r=await fetch(base+path,{redirect:'error',signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);report.checks.push({path,anonymous_http:r.status});}
 // Exercise THIS branch's adapter using real public files, without publishing it.
 const hub=await readSharedHub(central),now=Date.now(),fresh=Date.parse(hub.expires_at)>=now;
 assert.equal(hub.shared_hub_status.state,'verified');
 report.branch_Hub={cut:hub.source.cut_date,sha256:hub.source.sha256,generated_at:hub.source.generated_at,expires_at:hub.expires_at,fresh,
  known_products:hub.products.length,identity_and_business_valid:hub.products.filter(p=>p.availability!=='blocked').length,
  identity_blocked:hub.products.filter(p=>p.blocked_reasons.some(r=>/IDENTITY|VARIANT/.test(r))).length,
  note:'Counts describe known compiled identities, not all new SKU in the master. No quantities copied.'};
 async function ask(message,session=crypto.randomUUID(),extra={}){
  const d=await request('/marketplace/preview',{channel:'messenger_page',session_id:session,message,...extra});
  assert.equal(d.generative,false);assert.equal(d.outbound_enabled,false);assert.equal(d.acquisition.outbound_enabled,false);
  assert.equal(d.source_sha256,hub.source.sha256);assert.equal(d.inventory_cut_date,hub.source.cut_date);
  if(!d.source_fresh)assert.ok(!d.text.includes('$'));
  const amounts=[...d.text.matchAll(/\$(\d+(?:\.\d{2})?)/g)].map(x=>Math.round(Number(x[1])*100));
  const allowed=new Set(d.focus.flatMap(sku=>{const p=hub.products.find(p=>p.sku===sku);return p?.availability==='in_stock'&&p.prices?[p.prices.promo_cash_cents,p.prices.pvp_card_cents]:[];}));
  assert.ok(amounts.every(n=>allowed.has(n)));assert.ok(!/\d+ unidades|stock referencial/i.test(d.text));
  assert.ok(d.acquisition.banners.every(b=>b.delivery_enabled===false));
  return {message,text:d.text,focus:d.focus,source_sha256:d.source_sha256,cut:d.inventory_cut_date,quote_current:d.quote_current,source_fresh:d.source_fresh,
   image:d.image,banners:d.acquisition.banners,quick_replies:d.quick_replies?.map(q=>q.title),action:d.action};
 }
 for(const sku of ['TELF017','TELF018','TELF011','TELF012']){
  const cash=await ask('Precio de contado '+sku),card=await ask('Precio con tarjeta '+sku);assert.deepEqual(cash.focus,[sku]);assert.deepEqual(card.focus,[sku]);
  report.conversations.push({scope:'private_catalog_operator',sku,turns:[cash,card]});
 }
 const session=crypto.randomUUID(),turns=[];
 for(const message of ['Busco un Redmi 15C de 128 GB','¿Y con tarjeta cuánto cuesta?','Pero no tengo tarjeta Pacífico','Tengo Pichincha','Quiero contraentrega en Quito','¿Y envíos nacionales?','Muéstrame la fotografía','No compraré todavía','Quiero continuar después']){
  const d=await ask(message,session);assert.deepEqual(d.focus,['TELF017']);assert.notEqual(d.action,'handoff');assert.ok(!d.text.includes('En octubre, Pacífico'));turns.push(d);
 }
 report.conversations.push({scope:'private_HTTPS_conversation_not_Messenger',turns});
 const comparison=await ask('Compara el Redmi 15C 128 GB con el Samsung A17 128 GB');assert.equal(comparison.focus.length,2);report.comparison=comparison;
 // Run pending branch code against the SAME real Hub; distinct from the unchanged live Worker.
 let memory={history:[],focus:[],shown:[]};report.branch_conversation=[];
 for(const input of ['Busco un Redmi 15C de 128 GB','¿Y con tarjeta cuánto cuesta?','Pero no tengo tarjeta Pacífico','Tengo Pichincha','¿Y a seis meses?','Quiero contraentrega en Quito','¿Y envíos nacionales?','Muéstrame la fotografía','No compraré todavía','Quiero continuar después','Sigamos con ese celular']){
  const source=await refreshAlexCatalog(alexBaseline,fetch,Date.now(),{input,focus:memory.focus},hub);
  const d=await generateAlex(input,source,memory,{CATALOG_FIRST:'true'});memory=d.memory;assert.deepEqual(d.focus,['TELF017']);assert.notEqual(d.action,'handoff');
  if(input==='Tengo Pichincha'){assert.equal(d.intent,'payment');assert.ok(d.facts.includes('bank_terms_pending'));}
  if(input==='Muéstrame la fotografía'){assert.equal(d.intent,'photo');assert.equal(d.image,'TELF017');}
  if(input==='No compraré todavía'){assert.equal(memory.purchase_deferred,true);assert.ok(!d.text.includes('?'));}
  report.branch_conversation.push({input,text:d.text,focus:d.focus,intent:d.intent,facts:d.facts,image_requested:d.image,bank:memory.bank||null,purchase_deferred:memory.purchase_deferred===true});
 }
 const comparing='Compara la batería del Samsung A17 128 GB con el Redmi 15C 128 GB';
 const source=await refreshAlexCatalog(alexBaseline,fetch,Date.now(),{input:comparing},hub),d=await generateAlex(comparing,source,{},{});
 assert.equal(d.intent,'compare');assert.ok(d.facts.includes('TELF011.battery')&&d.facts.includes('TELF017.battery'));
 report.branch_comparison={input:comparing,text:d.text,facts:d.facts,source_sha256:source.source_sha256};
 const out=hub.products.find(p=>p.availability==='out_of_stock'&&!p.blocked_reasons.length);
 if(out){const d=await ask('Precio de '+out.sku);assert.ok(!d.text.includes('$'));report.out_of_stock_protection={sku:out.sku,passed:true};}
 const quota=await request('/alex/quota');report.internal_quota=quota;
 report.generative_probe={attempted:false,reason:process.env.ALEX_RUN_SINGLE_AI_PROBE==='true'?'FREE_PLAN_ATTESTATION_OR_QUOTA_REQUIRED':'NOT_REQUESTED_FOR_THIS_REPEAT'};
 // At most one live inference, guarded by the existing Worker reservation and Free-only binding.
 if(process.env.ALEX_RUN_SINGLE_AI_PROBE==='true'&&process.env.CF_FREE_ONLY_CONFIRMED==='true'&&h.ai_binding&&h.alex_generative&&quota.remaining_calls>=2){
  const a=await request('/alex/chat',{session_id:crypto.randomUUID(),message:'Estoy entre el Redmi 15C 128 GB y el Samsung A17 128 GB. Lo usaré para trabajar, ¿cómo los comparo?'});
  assert.equal(a.outbound_enabled,false);
  report.generative_probe={attempted:true,maximum_operator_turns:1,generative:a.generative,model:a.model,error_code:a.error_code,
   text:a.text,focus:a.focus,source_fresh:a.source_fresh,source_sha256:a.source_sha256,response_mode:a.response_mode};
 }
 await import('./meta-account-check.mjs');
 const meta=JSON.parse(await readFile(new URL('./generated/fase2/meta-account-check.json',import.meta.url)));
 report.Meta=meta;
 const status=await request('/messenger/status');assert.equal(status.mode,'development-only');assert.equal(status.reception_enabled,false);
 report.Messenger={mode:status.mode,registered_testers:status.test_senders_present,tester_transport:status.outbound_enabled,
  external_ingress:status.reception_enabled,window_hours:24};
 const receipts=await request('/messenger/receipts');const rows=receipts.receipts||[];
 report.receipt_counts={signed_external:rows.filter(r=>r.source==='external_https'&&r.signature_valid===true).length,
  signed_CI:rows.filter(r=>r.source==='authorized_ci_probe'&&r.signature_valid===true).length,
  real_new_Messenger_conversation_verified:false};
 // Minimal existing-credential asset read only; never request permissions or log IDs.
 report.Instagram={asset_link_read:false,professional_asset_found:null,transport_implemented_and_tested:false};
 const pageToken=process.env.META_PAGE_ACCESS_TOKEN;
 if(pageToken&&meta.page_identity_matches){
  const r=await fetch('https://graph.facebook.com/v26.0/105549695770538?fields=instagram_business_account',{headers:{Authorization:'Bearer '+pageToken},redirect:'error',signal:AbortSignal.timeout(15000)});const d=await r.json();
  report.Instagram={...report.Instagram,asset_http:r.status,asset_link_read:r.ok,professional_asset_found:r.ok?!!d.instagram_business_account?.id:null,error_code:Number(d.error?.code)||null};
 }
 report.WhatsApp={token_present:!!process.env.WHATSAPP_ACCESS_TOKEN,phone_configured:!!process.env.META_PHONE_NUMBER_ID,WABA_configured:!!process.env.META_WABA_ID,asset_verified:false,zero_cost_account_verified:false,transport_implemented_and_tested:false};
 if(process.env.WHATSAPP_ACCESS_TOKEN&&/^\d{4,30}$/.test(process.env.META_PHONE_NUMBER_ID||'')){
  const r=await fetch('https://graph.facebook.com/v26.0/'+process.env.META_PHONE_NUMBER_ID+'?fields=id',{headers:{Authorization:'Bearer '+process.env.WHATSAPP_ACCESS_TOKEN},redirect:'error',signal:AbortSignal.timeout(15000)});const d=await r.json();report.WhatsApp.asset_http=r.status;report.WhatsApp.asset_verified=r.ok&&String(d.id)===process.env.META_PHONE_NUMBER_ID;
 }
 report.channel_assessments=[assessChannel('messenger_page',{identity_verified:meta.page_identity_matches,messaging_permission:meta.pages_messaging_granted,
  subscription_verified:meta.messages_subscribed===true,registered_tester:status.test_senders_present,current_commercial_source:fresh}),assessChannel('instagram_professional'),assessChannel('whatsapp_business'),assessChannel('marketplace_personal')];
 report.marketplace_referrals=referrals();
 const after=await request('/health',null,false);assert.equal(after.release,h.release);assert.equal(after.meta_ingress_enabled,false);assert.equal(after.messenger_outbound,h.messenger_outbound);
 report.passed=true;
}catch(error){report.passed=false;report.failure={code:error.code||'PREFLIGHT_FAILED',type:error.name};}
await mkdir(new URL('./generated/fase2/',import.meta.url),{recursive:true});
await writeFile(new URL('./generated/fase2/alex-scale-cloud.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
