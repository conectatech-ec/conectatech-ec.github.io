// Read-only readiness evidence. No AI calls, authenticated messages or account mutations.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const root=new URL('./',import.meta.url),read=async name=>JSON.parse(await readFile(new URL(name,root),'utf8'));
const config=await read('activar-cloud.json'),prior=await read('generated/fase2/alex-cloud-verificado.json');
if(config.url_publica!=='https://conectatech-comercial-piloto.conectatech-ecu.workers.dev'||config.costo_maximo_usd!==0)throw Error('Isolated free pilot required');
const report={read_only:true,worker_code_changed:false,ai_calls:0,messages_sent:0,paid_services_activated:false,public_checks:[],private_access_checks:[]};
const checks=[
 ['/health','health'],['/privacy','privacy'],['/data-deletion','deletion'],
 ['/alex/chat','private'],['/alex/status','private'],['/alex/handoffs','private'],['/messenger/seller/enable','private'],['/messenger/seller/results','private']
];
await Promise.all(checks.map(async([path,kind])=>{
 try{
  // Never attach credentials. All requests are GET; private endpoints must reject them.
  const r=await fetch(config.url_publica+path,{redirect:'error',signal:AbortSignal.timeout(15000)});
  if(kind==='private'){report.private_access_checks.push({path,http:r.status,passed:r.status===401});return;}
  const body=await r.text();let passed=r.status===200;
  if(kind==='privacy')passed&&=body.includes('Cloudflare Workers AI')&&body.includes('24 horas')&&body.includes('siete días');
  if(kind==='deletion')passed&&=body.includes('olvida esta conversación')&&body.includes('Messenger');
  if(kind==='health'){
   const state=JSON.parse(body);passed&&=state.ok===true&&state.alex_generative===true&&state.meta_ingress_enabled===false;
   report.worker={release:state.release,alex_enabled:state.alex_generative,tester_outbound_enabled:state.messenger_outbound,commercial_ingress_enabled:state.meta_ingress_enabled};
  }
  report.public_checks.push({path,http:r.status,passed});
 }catch{(kind==='private'?report.private_access_checks:report.public_checks).push({path,http:0,passed:false});}
}));
for(const key of ['public_checks','private_access_checks'])report[key].sort((a,b)=>a.path.localeCompare(b.path));
let account={};try{account=await read('generated/fase2/meta-account-check.json');}catch{/* Only report verified values when evidence exists. */}
report.existing_permission_evidence={page_identity_matches:account.page_identity_matches===true,token_valid:account.token_valid===true,pages_messaging_granted:account.pages_messaging_granted===true,app_messages_field:account.app_messages_field===true,callback_matches:account.app_callback_matches===true,page_subscription_read_http:account.subscriptions_http||null};
report.permissions_not_proven_by_token={advanced_access:'not_verified',app_live:'not_verified'};
let ownerStatus=null;try{ownerStatus=await read('meta-access-status.json');}catch{/* No dashboard status is inferred from a token scope. */}
if(ownerStatus?.source==='owner_confirmation_of_meta_dashboard')report.owner_dashboard_status={access_level:ownerStatus.access_level,app_mode:ownerStatus.app_mode,source:ownerStatus.source,confirmed_date_local:ownerStatus.confirmed_date_local};
report.acceptance={real_messenger_conversation:prior.messenger_alex_new_conversation_verified===true,text_and_image_confirmed_by_tester:prior.tester_confirmation?.received_text===true&&prior.tester_confirmation?.received_image===true,card_payment_response_validated_by_owner:prior.tester_confirmation?.card_payment_response_correct===true,meta_delivery_receipt_verified:prior.messenger_delivery_verification?.meta_delivery_receipt_verified===true};
report.technical_checks_passed=[...report.public_checks,...report.private_access_checks].every(x=>x.passed)&&Object.entries(report.existing_permission_evidence).filter(([k])=>k!=='page_subscription_read_http').every(([,v])=>v===true);
report.public_operation_enabled=false;
report.review_submission_status='not_submitted_by_this_session';
report.owner_account_steps=['Confirmar nivel de pages_messaging y modo de app en Meta','Completar únicamente los campos y requisitos que exija el panel','Proporcionar grabación y acceso de revisión restringido si Meta los requiere'];
if(ownerStatus?.access_level==='standard'&&ownerStatus?.app_mode==='development')report.owner_account_steps[0]='Solicitar acceso avanzado de pages_messaging en Meta; no abrir mensajería general con acceso estándar y modo Desarrollo';
const out=new URL('generated/fase2/meta-review-readiness.json',root);await mkdir(new URL('generated/fase2/',root),{recursive:true});await writeFile(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
if(!report.technical_checks_passed)process.exitCode=1;
