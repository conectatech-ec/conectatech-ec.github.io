// Authorized tester activation only. Never sends a fabricated incoming message.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('./activar-cloud.json',import.meta.url)));
const base=process.env.CLOUDFLARE_PILOT_URL||config.url_publica;
const headers={Authorization:'Bearer '+process.env.PILOT_TOKEN,'Content-Type':'application/json'};
async function call(path,body){try{const r=await fetch(base+'/messenger/'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});return{http:r.status,data:await r.json()};}catch{return{http:0,data:{error:'REQUEST_FAILED_VALUES_WITHHELD'}};}}
const report={authorized_testers_only:true,live_customers_enabled:false,paid_services_activated:false};
for(const route of ['seller/status','seller/enable','seller/disable','seller/promote','seller/results']){const r=await fetch(base+'/messenger/'+route);if(r.status!==401)throw Error('Private seller route not protected');}report.private_routes_http=401;
let state=await call('seller/status');report.initial_status_http=state.http;
if(config.habilitar_vendedor_probadores===true){
 const paired=await call('pairing/status');
 if(paired.data.claimed){const p=await call('seller/promote',{confirmed_tester:true});report.promote_http=p.http;}
 state=await call('seller/status');
 if(state.data.testers_configured){const enabled=await call('seller/enable',{});report.enable_http=enabled.http;report.activation_result=enabled.data;}
 else report.blocker='AUTHORIZED_TESTER_MESSAGE_REQUIRED';
}
const final=await call('seller/status');report.seller=final.data;
report.evidence={incoming_received:false,graph_response_accepted:false,messenger_delivery_confirmed:false};
const receipts=await call('receipts');report.evidence.incoming_received=receipts.data.receipts?.some(r=>r.source==='external_https'&&r.signature_valid===true&&r.reason==='processed')||false;
report.evidence.graph_response_accepted=final.data.parts?.some(p=>p.state==='accepted'&&p.n>0)||false;
report.evidence.messenger_delivery_confirmed=final.data.parts?.some(p=>p.state==='accepted'&&p.delivered>0)||false;
const out=new URL('./generated/fase2/',import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL('seller-activation.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
