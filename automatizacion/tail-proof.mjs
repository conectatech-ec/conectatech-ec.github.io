import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const worker='conectatech-comercial-piloto';
const reasons=new Set(['ingress_disabled','pairing_claimed','ignored_object','invalid_json','event_limit','allowlist_missing','storage_unavailable','processed','not_configured','invalid_body','invalid_signature']);
const sources=new Set(['external_https','authorized_ci_probe','synthetic_ci']);
export function sanitizeTrace(t){
 if(t.scriptName!==worker||t.event?.request?.method!=='POST')return null;
 try{if(new URL(t.event.request.url).pathname!=='/webhooks/meta')return null;}catch{return null;}
 let receipt;
 for(const log of t.logs||[])for(const item of log.message||[]){if(typeof item!=='string')continue;try{const x=JSON.parse(item);if(x.event==='meta_webhook_receipt'&&reasons.has(x.reason)&&sources.has(x.source))receipt=x;}catch{}}
 return {worker,method:'POST',path:'/webhooks/meta',http_status:Number.isInteger(t.event.response?.status)?t.event.response.status:null,signature_valid:[true,false,null].includes(receipt?.signature_valid)?receipt.signature_valid:null,reason:receipt?.reason||null,source:receipt?.source||null,page_matches:receipt?.page_matches===true,at:Number.isFinite(t.eventTimestamp)?new Date(t.eventTimestamp).toISOString():null};
}
async function main(){
 const report={scope:'Cloudflare_live_Worker_invocations',tail_connected:false,observed:[],historical_meta_test_verified:false};let ws;
 try{
  if(process.env.CF_WORKER_TAIL_URL){
   ws=new WebSocket(process.env.CF_WORKER_TAIL_URL,'trace-v1');
   ws.addEventListener('error',()=>{});
   ws.addEventListener('message',async event=>{try{const raw=typeof event.data==='string'?event.data:await event.data.text();const safe=sanitizeTrace(JSON.parse(raw));if(safe&&report.observed.length<30)report.observed.push(safe);}catch{}});
   report.tail_connected=await new Promise(resolve=>{const timeout=setTimeout(()=>resolve(false),8000);ws.addEventListener('open',()=>{clearTimeout(timeout);ws.send(JSON.stringify({debug:false}));resolve(true);},{once:true});ws.addEventListener('error',()=>{clearTimeout(timeout);resolve(false);},{once:true});});
  }
  if(report.tail_connected)await new Promise(resolve=>setTimeout(resolve,1000));
  const exitCode=await new Promise(resolve=>{const child=spawn(process.execPath,['automatizacion/messenger-e2e.mjs'],{stdio:'inherit',env:process.env});child.on('error',()=>resolve(1));child.on('close',resolve);});
  if(report.tail_connected)await new Promise(resolve=>setTimeout(resolve,3000));
  report.signed_closed_probe_observed=report.observed.some(r=>r.source==='authorized_ci_probe'&&r.signature_valid===true&&r.http_status===200&&r.reason==='ingress_disabled');
  report.invalid_signature_probe_observed=report.observed.some(r=>r.source==='authorized_ci_probe'&&r.signature_valid===false&&r.http_status===403);
  if(exitCode!==0)process.exitCode=exitCode||1;
 }catch{console.error('Worker tail verification failed; sensitive details withheld');process.exitCode=1;}finally{
  try{if(ws&&[WebSocket.OPEN,WebSocket.CONNECTING].includes(ws.readyState))ws.close();}catch{}
  const root=new URL('./generated/fase2/',import.meta.url);await mkdir(root,{recursive:true});await writeFile(new URL('tail-proof.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
  // A diagnostic socket must never keep the verifier running after evidence is saved.
  setTimeout(()=>process.exit(process.exitCode||0),500);
 }
}
if(process.argv[1]?.endsWith('/tail-proof.mjs')||process.argv[1]==='automatizacion/tail-proof.mjs')await main();
