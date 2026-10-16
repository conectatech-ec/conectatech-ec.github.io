// HTTPS verification only. Never log the query URL, response body or credentials.
import {randomBytes} from 'node:crypto';
const base=process.argv[2],token=process.env.META_VERIFY_TOKEN;
if(!/^https:\/\/conectatech-comercial-piloto\.[a-z0-9-]+\.workers\.dev$/.test(base||'')||!token)process.exit(1);
const challenge='ct-rotation-'+randomBytes(16).toString('hex');
async function request(candidate){
 const url=new URL(base+'/webhooks/meta');
 url.searchParams.set('hub.mode','subscribe');url.searchParams.set('hub.verify_token',candidate);url.searchParams.set('hub.challenge',challenge);
 try {
  const r=await fetch(url,{headers:{'User-Agent':'CONECTATECH-Pilot-Verification/1.0',Accept:'text/plain','Cache-Control':'no-cache'},signal:AbortSignal.timeout(10000)});
  return {status:r.status,match:(await r.text())===challenge};
 }catch{return {status:0,match:false};}
}
let positive={status:0,match:false},attempt=0;
for(attempt=1;attempt<=15;attempt++){
 positive=await request(token);if(positive.status===200&&positive.match)break;
 if(attempt<15)await new Promise(resolve=>setTimeout(resolve,2000));
}
const negative=positive.match?await request('invalid-'+randomBytes(24).toString('hex')):{status:0};
const result={passed:positive.status===200&&positive.match&&negative.status===403,configured_token_http:positive.status,challenge_matches:positive.match,wrong_token_http:negative.status,attempts:attempt};
console.log(JSON.stringify(result));if(!result.passed)process.exitCode=1;
