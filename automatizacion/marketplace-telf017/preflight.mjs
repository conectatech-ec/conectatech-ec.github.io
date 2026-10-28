// New isolated observer. No deployment, Graph sends, billing calls or changes to existing automations.
import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';
import {association,handoff,resolveLead} from './lead.mjs';import candidate from './candidate.json' with {type:'json'};
import library from './library-evidence.json' with {type:'json'};import {prepare} from './prepare.mjs';
const base='https://conectatech-comercial-piloto.conectatech-ecu.workers.dev';
const report={at:new Date().toISOString(),scope:'read_only_observation_and_isolated_operator_preview',association,prepared:prepare(candidate,library),personal_inbox_access:false,outgoing_messages:0,existing_automations_changed:false,real_channel_e2e_complete:false};
try{
 const p=await fetch('https://conectatech-ec.github.io/datos-593/estado-ultimo-corte.json',{signal:AbortSignal.timeout(15000)});assert.equal(p.status,200);const pointer=await p.json();report.published_Hub={cut_date:pointer.fecha_corte,sha256:pointer.origen_sha256,matches_candidate:pointer.origen_sha256===candidate.source.sha256};
 const page=await fetch(report.prepared.reply.catalog_url,{signal:AbortSignal.timeout(15000)});assert.equal(page.status,200);report.catalog_anonymous_http=page.status;
 report.handoff_roundtrip=resolveLead(new URL(handoff().url).searchParams.get('text'));assert.equal(report.handoff_roundtrip.requested_sku,'TELF017');
 const health=await fetch(base+'/health',{signal:AbortSignal.timeout(15000)});assert.equal(health.status,200);const h=await health.json();report.Worker={release:h.release,meta_ingress_enabled:h.meta_ingress_enabled};
 if(process.env.PILOT_TOKEN){
  const r=await fetch(base+'/marketplace/preview',{method:'POST',headers:{Authorization:'Bearer '+process.env.PILOT_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({channel:'marketplace_personal',session_id:crypto.randomUUID(),message:handoff().message}),signal:AbortSignal.timeout(35000)});assert.equal(r.status,200);const d=await r.json();assert.deepEqual(d.focus,['TELF017']);assert.equal(d.acquisition.outbound_enabled,false);
  report.existing_pilot={http:r.status,focus:d.focus,text:d.text,source_cut:d.inventory_cut_date,source_sha256:d.source_sha256,source_fresh:d.source_fresh,ad_association_installed_in_live_Worker:false,real_customer_message:false};
 }
 const waToken=process.env.WHATSAPP_ACCESS_TOKEN,phone=process.env.META_PHONE_NUMBER_ID,waba=process.env.META_WABA_ID;
 report.WhatsApp={token_provided_to_this_observer:!!waToken,phone_provided:!!phone,WABA_provided:!!waba,asset_read_verified:false,cost_zero_verified:false,send_enabled:false};
 if(waToken&&/^\d{4,30}$/.test(phone||'')){
  const r=await fetch('https://graph.facebook.com/v26.0/'+phone+'?fields=id',{headers:{Authorization:'Bearer '+waToken},signal:AbortSignal.timeout(15000)});const b=await r.json();report.WhatsApp.asset_http=r.status;report.WhatsApp.asset_read_verified=r.ok&&String(b.id)===phone;
 }
 report.technical_preflight_passed=true;
}catch(e){report.technical_preflight_passed=false;report.error=String(e.message).slice(0,400);}
await writeFile(new URL('./cloud-preflight.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.technical_preflight_passed)process.exitCode=1;
