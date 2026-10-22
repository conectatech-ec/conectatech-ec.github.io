// Read-only Worker diagnostics; no payloads, sender identifiers or credentials.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('./activar-cloud.json',import.meta.url)));
const base=process.env.CLOUDFLARE_PILOT_URL||config.url_publica;
const headers={Authorization:'Bearer '+process.env.PILOT_TOKEN};
const report={scope:'private_worker_receipts_not_general_HTTP_logs',meta_delivery_confirmed:null};
async function get(path){try{const r=await fetch(base+path,{headers,signal:AbortSignal.timeout(10000)});return {http:r.status,data:r.ok?await r.json():null};}catch{return {http:0,data:null};}}
const state=await get('/messenger/status');report.status_http=state.http;
if(state.data)report.configuration={development_only:state.data.mode==='development-only',reception_enabled:state.data.reception_enabled,outbound_enabled:state.data.outbound_enabled,test_senders_present:state.data.test_senders_present,human_review_required:state.data.test_seller?.human_review_required===true};
if(state.data?.test_seller)report.message_limits={daily_limit:state.data.test_seller.daily_limit,source:state.data.test_seller.message_limit_source,window:state.data.test_seller.message_limit_window,accepted_last24h:state.data.test_seller.accepted_last24h,remaining_messages:state.data.test_seller.remaining_messages,next_slot_at:state.data.test_seller.next_slot_at};
const receipts=await get('/messenger/receipts');report.receipts_http=receipts.http;
report.receipts=(receipts.data?.receipts||[]).map(r=>({at:r.at,http_status:r.http_status,signature_valid:r.signature_valid,reason:r.reason,page_matches:r.page_matches,source:r.source,reception_enabled:r.reception_enabled,outbound_enabled:r.outbound_enabled}));
report.external_signed_receipts=report.receipts.filter(r=>r.source==='external_https'&&r.signature_valid===true).length;
report.external_pairing_receipt_seen=report.receipts.some(r=>r.source==='external_https'&&r.reason==='pairing_claimed'&&r.signature_valid===true);
const alex=await get('/alex/status');if(alex.http===200)report.alex=alex.data;
const quota=await get('/alex/quota');if(quota.http===200)report.alex_quota=quota.data;
const results=await get('/messenger/seller/results');
report.alex_messenger=(results.data?.events||[]).filter(e=>e.intent==='alex').map(e=>{
 const a=results.data.drafts?.find(d=>d.event_ref===e.k&&d.advisor==='Alex');return{incoming_at:new Date(e.inbound).toISOString(),status:e.status,generative:a?.generative===true,model:a?.model||null,error_code:a?.error_code||null,response_mode:a?.response_mode||null,focus:a?.focus||[],facts:a?.facts||[],commercial_facts:a?.commercial_facts||[],human_approved:a?.human_approved===true,quality:a?.quality||null,media_count:a?.media_count||0,graph_http:a?.graph_http||[],graph_accepted_parts:e.parts?.filter(p=>p.state==='accepted').length||0,delivery_receipts:e.parts?.filter(p=>p.delivered===1).length||0,error:e.error||null};
});
// Explicit synthetic operator queries only; never replays customer events or enters Graph.
if(config.diagnosticar_alex===true){
 report.synthetic_private_probes=[];const session=crypto.randomUUID();
 if((report.alex_quota?.remaining_calls||0)>=22)for(const message of ['Hola, busco un celular Samsung','¿Qué precio tiene el Samsung A17?']){
  const r=await fetch(base+'/alex/chat',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({session_id:session,message}),signal:AbortSignal.timeout(60000)});const a=r.ok?await r.json():{};
  report.synthetic_private_probes.push({input:message,http:r.status,text:a.text,generative:a.generative,error_code:a.error_code,focus:a.focus,source_fresh:a.source_fresh,outbound_enabled:a.outbound_enabled});
 }
}
// External signed receipts are not attributed to the owner's earlier test automatically.
const output=new URL('./generated/fase2/',import.meta.url);await mkdir(output,{recursive:true});await writeFile(new URL('meta-diagnostics.json',output),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
