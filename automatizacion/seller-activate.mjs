// Authorized tester activation only. Never sends a fabricated incoming message.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('./activar-cloud.json',import.meta.url)));
const base=process.env.CLOUDFLARE_PILOT_URL||config.url_publica;
const headers={Authorization:'Bearer '+process.env.PILOT_TOKEN,'Content-Type':'application/json'};
async function call(path,body){try{const r=await fetch(base+'/messenger/'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});return{http:r.status,data:await r.json()};}catch{return{http:0,data:{error:'REQUEST_FAILED_VALUES_WITHHELD'}};}}
const report={authorized_testers_only:true,live_customers_enabled:false,paid_services_activated:false};
for(const route of ['seller/status','seller/enable','seller/disable','seller/promote','seller/results','seller/arm','seller/process']){const r=await fetch(base+'/messenger/'+route);if(r.status!==401)throw Error('Private seller route not protected');}report.private_routes_http=401;
let state;for(let attempt=0;attempt<15;attempt++){state=await call('seller/status');if(state.http===200&&state.data.mode==='authorized-testers-only')break;await new Promise(r=>setTimeout(r,2000));}
 report.initial_status_http=state.http;
 if(state.http!==200||state.data.mode!=='authorized-testers-only')throw Error('Deployed seller status route is unavailable');
if(config.habilitar_vendedor_probadores===true){
 const paired=await call('pairing/status');
 if(paired.data.claimed){const p=await call('seller/promote',{confirmed_tester:true});report.promote_http=p.http;}
 state=await call('seller/status');
 if(state.data.testers_configured){const enabled=await call('seller/enable',{});report.enable_http=enabled.http;report.activation_result=enabled.data;}
 else {const armed=await call('seller/arm',{});report.arm_http=armed.http;report.enrollment_result=armed.data;if(armed.http!==200||armed.data.armed!==true)throw Error('Tester enrollment could not be armed; inspect permission check');report.blocker='AUTHORIZED_TESTER_MESSAGE_REQUIRED';}
}
if(config.procesar_cola_probadores===true&&state.data.enabled&&state.data.testers_configured){const job=await call('seller/process',{});report.authorized_queued_tester_processing_http=job.http;}
const final=await call('seller/status');report.seller=final.data;
report.evidence={incoming_received:false,graph_response_accepted:false,messenger_delivery_confirmed:false};
const receipts=await call('receipts');report.evidence.incoming_received=receipts.data.receipts?.some(r=>r.source==='external_https'&&r.signature_valid===true&&r.reason==='processed')||false;
report.evidence.graph_response_accepted=final.data.parts?.some(p=>p.state==='accepted'&&p.n>0)||false;
report.evidence.messenger_delivery_confirmed=final.data.parts?.some(p=>p.state==='accepted'&&p.delivered>0)||false;
const out=new URL('./generated/fase2/',import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL('seller-activation.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
