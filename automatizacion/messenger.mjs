import {verifyMetaWebhook,verifyMetaSignature,normalizeEvents} from './channels.mjs';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function hmac(secret,text) {
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function detectSkus(text) {
 const matches=String(text).toUpperCase().match(/\b(?:MICR027|MICR27|POWE003|ADAP005)\b/g)||[];
 return [...new Set(matches.map(s=>s==='MICR027'?'MICR27':s))];
}
async function limitedBody(req) {
 if(Number(req.headers.get('Content-Length')||0)>64000) throw Error('BODY_SIZE');
 const reader=req.body?.getReader();if(!reader) return '';
 const chunks=[];let n=0;
 while(true){const {value,done}=await reader.read();if(done)break;n+=value.byteLength;if(n>64000){await reader.cancel();throw Error('BODY_SIZE');}chunks.push(value);}
 const bytes=new Uint8Array(n);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.byteLength;}
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export async function handleMessengerWebhook(req,env,scope='development') {
 if(req.method==='GET') return verifyMetaWebhook(req,env);
 if(req.method!=='POST') return json({error:'Method not allowed'},405);
 if(env.META_MODE!=='development-only'||!env.META_APP_SECRET) return json({error:'Messenger development secrets not configured'},503);
 let raw;try{raw=await limitedBody(req);}catch{return json({error:'Invalid body'},413);}
 if(!await verifyMetaSignature(raw,req.headers.get('X-Hub-Signature-256'),env.META_APP_SECRET)) return json({error:'Invalid signature'},403);
 let payload;try{payload=JSON.parse(raw);}catch{return json({error:'Invalid JSON'},400);}
 if(payload.object!=='page') return json({received:0,ignored:true,outbound_enabled:false});
 const allowed=new Set(String(env.META_TEST_SENDER_IDS||'').split(',').map(s=>s.trim()).filter(s=>/^\d+$/.test(s)));
 if(!env.META_PAGE_ID||allowed.size===0) return json({error:'Page or test sender allowlist missing'},503);
 if(env.META_INGRESS_ENABLED!=='true')return json({mode:'development-only',queued:0,ignored:true,reception_enabled:false,outbound_enabled:false});
 if(!env.MESSENGER_TEST_INBOX) return json({error:'Durable test storage unavailable'},503);
 let events;try{events=normalizeEvents(payload,env);}catch{return json({error:'Event limit'},400);}
 if(events.length>10) return json({error:'Test batch limit'},400);
 let queued=0,duplicates=0,ignored=0;
 try {
  for(const event of events) {
   if(!allowed.has(String(event.sender))||event.recipient!==env.META_PAGE_ID||!Number.isFinite(event.timestamp)||event.timestamp>Date.now()+300000||Date.now()-event.timestamp>86400000){ignored++;continue;}
   const key=await hmac(env.META_APP_SECRET,env.META_PAGE_ID+':'+event.id);
   const stub=env.MESSENGER_TEST_INBOX.get(env.MESSENGER_TEST_INBOX.idFromName('messenger-'+scope));
   const r=await stub.fetch('https://inbox/accept',{method:'POST',body:JSON.stringify({key,skus:detectSkus(event.text)})});
   if(!r.ok) throw Error('STORE_UNAVAILABLE');
   const a=await r.json();if(a.duplicate)duplicates++;else queued++;
  }
  return json({mode:'development-only',queued,duplicates,ignored,outbound_enabled:false});
 } catch {console.error(JSON.stringify({event:'messenger_test_enqueue_failed',code:'STORE_UNAVAILABLE'}));return json({error:'Storage unavailable; Meta may retry'},503);}
}
export async function messengerSelfTest(body,env) {
 if(env.META_MODE!=='development-only'||!env.MESSENGER_TEST_INBOX) return json({error:'Development test unavailable'},503);
 if(!/^[a-zA-Z0-9_-]{16,80}$/.test(body.test_id||'')||!['MICR27','POWE003','ADAP005'].includes(body.sku)||!['accept','bad_signature','tamper','foreign_sender','echo','verify_challenge','bad_verify_token','ingress_disabled'].includes(body.case||''))return json({error:'Invalid synthetic fixture'},400);
 const testEnv={...env,META_INGRESS_ENABLED:body.case==='ingress_disabled'?'false':'true',META_APP_SECRET:env.PILOT_TOKEN,META_PAGE_ID:'100000000000001',META_TEST_SENDER_IDS:'100000000000002'};
 if(body.case==='verify_challenge'||body.case==='bad_verify_token') {
  const q=new URL('https://pilot/webhooks/meta');q.searchParams.set('hub.mode','subscribe');q.searchParams.set('hub.verify_token',body.case==='bad_verify_token'?'invalid-fixture':env.PILOT_TOKEN);q.searchParams.set('hub.challenge','fixture-challenge');
  const r=verifyMetaWebhook(new Request(q),{META_VERIFY_TOKEN:env.PILOT_TOKEN});
  return json({synthetic:true,meta_app_verified:false,webhook_status:r.status,challenge_matches:(await r.text())==='fixture-challenge'});
 }
 const payload={object:'page',entry:[{id:testEnv.META_PAGE_ID,messaging:[{sender:{id:body.case==='foreign_sender'?'100000000000003':'100000000000002'},recipient:{id:testEnv.META_PAGE_ID},timestamp:Date.now(),message:{mid:body.test_id,text:body.sku,is_echo:body.case==='echo'}}]}]};
 let raw=JSON.stringify(payload);let signature='sha256='+await hmac(testEnv.META_APP_SECRET,raw);
 if(body.case==='bad_signature')signature='sha256'+'='+'0'.repeat(64);
 if(body.case==='tamper')raw+=' ';
 const response=await handleMessengerWebhook(new Request('https://pilot/webhooks/meta',{method:'POST',headers:{'X-Hub-Signature-256':signature},body:raw}),testEnv,'ci');
 return json({synthetic:true,meta_app_verified:false,event_ref:await hmac(testEnv.META_APP_SECRET,testEnv.META_PAGE_ID+':messenger:'+body.test_id),webhook_status:response.status,ack:await response.json()});
}
