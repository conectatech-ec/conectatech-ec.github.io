import {verifyMetaWebhook,verifyMetaSignature,normalizeEvents} from './channels.mjs';
import {pairingHash} from './messenger-control.mjs';
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
 let payload,pageMatches=false,signatureValid=null;
 const source=scope==='ci'?'synthetic_ci':env.PILOT_TOKEN&&req.headers.get('Authorization')===`Bearer ${env.PILOT_TOKEN}`?'authorized_ci_probe':'external_https';
 async function finish(data,status,reason){
  const receipt={signature_valid:signatureValid,http_status:status,reason,page_matches:pageMatches,source,reception_enabled:env.META_INGRESS_ENABLED==='true'};
  console.info(JSON.stringify({event:'meta_webhook_receipt',...receipt}));
  try{if(env.MESSENGER_TEST_INBOX)await env.MESSENGER_TEST_INBOX.get(env.MESSENGER_TEST_INBOX.idFromName('messenger-'+scope)).fetch('https://inbox/receipt',{method:'POST',body:JSON.stringify(receipt)});}catch{console.error(JSON.stringify({event:'meta_receipt_unavailable'}));}
  return json(data,status);
 }
 if(env.META_MODE!=='development-only'||!env.META_APP_SECRET) return finish({error:'Messenger development secrets not configured'},503,'not_configured');
 let raw;try{raw=await limitedBody(req);}catch{return finish({error:'Invalid body'},413,'invalid_body');}
 signatureValid=await verifyMetaSignature(raw,req.headers.get('X-Hub-Signature-256'),env.META_APP_SECRET);
 if(!signatureValid)return finish({error:'Invalid signature'},403,'invalid_signature');
 try{payload=JSON.parse(raw);}catch{return finish({error:'Invalid JSON'},400,'invalid_json');}
 if(payload.object!=='page') return finish({received:0,ignored:true,outbound_enabled:false},200,'ignored_object');
 pageMatches=Array.isArray(payload.entry)&&payload.entry.some(e=>String(e.id)===env.META_PAGE_ID);
 // Real tester transport is independent of legacy draft ingress. CI cannot enter it.
 if(source==='external_https'&&pageMatches&&env.META_PAGE_ACCESS_TOKEN&&env.MESSENGER_TEST_INBOX){
  const stub=env.MESSENGER_TEST_INBOX.get(env.MESSENGER_TEST_INBOX.idFromName('messenger-'+scope));
  const seller=await (await stub.fetch('https://inbox/seller/status')).json();
  let queued=0,duplicates=0;
  // Delivery receipts prove transport delivery, not that a person has read a message.
  for(const entry of payload.entry||[])if(String(entry.id)===env.META_PAGE_ID)for(const e of entry.messaging||[]){
   if(e.sender?.id&&String(e.recipient?.id)===env.META_PAGE_ID&&Array.isArray(e.delivery?.mids))await stub.fetch('https://inbox/seller/delivery',{method:'POST',body:JSON.stringify({mids:e.delivery.mids.slice(0,20).filter(m=>typeof m==='string'&&m.length<500)})});
  }
  if(seller.enabled){
   let events;try{events=normalizeEvents(payload,env);}catch{return finish({error:'Event limit'},400,'event_limit');}
   if(events.length>10)return finish({error:'Batch limit'},400,'event_limit');
   for(const event of events){
    if(event.recipient!==env.META_PAGE_ID)continue;
    const key=await hmac(env.META_APP_SECRET,env.META_PAGE_ID+':'+event.id);
    const r=await stub.fetch('https://inbox/seller/ingest',{method:'POST',body:JSON.stringify({key,sender:String(event.sender||''),timestamp:event.timestamp,skus:detectSkus(event.text),text:event.text.slice(0,1000),handoff:/\b(vendedor|humano|persona|asesor|garant[ií]a|reclamo|cancelar|no\s+me\s+escribas)\b/i.test(event.text)})});
    if(!r.ok)return finish({error:'Storage unavailable; Meta may retry'},503,'storage_unavailable');
    const a=await r.json();if(a.queued)queued++;if(a.duplicate)duplicates++;
   }
   return finish({mode:'authorized-testers-only',queued,duplicates,outbound_enabled:true},200,'processed');
  }
 }
 // A closed receiver acknowledges signed deliveries without business processing.
 // Enrollment is a separate, owner-authorized one-use control phrase only.
 if(env.META_INGRESS_ENABLED!=='true'){
  let paired=false;
  if(pageMatches&&env.PILOT_TOKEN&&env.MESSENGER_TEST_INBOX){
   let events;try{events=normalizeEvents(payload,env);}catch{return finish({error:'Event limit'},400,'event_limit');}
   if(events.length>10)return finish({error:'Test batch limit'},400,'event_limit');
   for(const event of events){
    const match=/^CONECTATECH-PRUEBA ([a-f0-9]{32})$/.exec(event.text);
    if(!match||event.recipient!==env.META_PAGE_ID||!Number.isFinite(event.timestamp)||event.timestamp>Date.now()+300000||Date.now()-event.timestamp>600000)continue;
    try{
     const stub=env.MESSENGER_TEST_INBOX.get(env.MESSENGER_TEST_INBOX.idFromName('messenger-'+scope));
     const r=await stub.fetch('https://inbox/pairing/claim',{method:'POST',body:JSON.stringify({code_hash:await pairingHash(match[1],env.PILOT_TOKEN),psid:String(event.sender||'')})});
     if(r.ok)paired=(await r.json()).claimed||paired;
    }catch{console.error(JSON.stringify({event:'meta_pairing_unavailable'}));}
   }
  }
  return finish({mode:'development-only',queued:0,ignored:true,reception_enabled:false,outbound_enabled:false},200,paired?'pairing_claimed':'ingress_disabled');
 }
 const allowed=new Set(String(env.META_TEST_SENDER_IDS||'').split(',').map(s=>s.trim()).filter(s=>/^\d+$/.test(s)));
 if(!env.META_PAGE_ID||allowed.size===0) return finish({error:'Page or test sender allowlist missing'},503,'allowlist_missing');
 if(!env.MESSENGER_TEST_INBOX) return finish({error:'Durable test storage unavailable'},503,'storage_unavailable');
 let events;try{events=normalizeEvents(payload,env);}catch{return finish({error:'Event limit'},400,'event_limit');}
 if(events.length>10) return finish({error:'Test batch limit'},400,'event_limit');
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
  return finish({mode:'development-only',queued,duplicates,ignored,outbound_enabled:false},200,'processed');
 } catch {console.error(JSON.stringify({event:'messenger_test_enqueue_failed',code:'STORE_UNAVAILABLE'}));return finish({error:'Storage unavailable; Meta may retry'},503,'storage_unavailable');}
}
export async function messengerSelfTest(body,env) {
 if(env.META_MODE!=='development-only'||!env.MESSENGER_TEST_INBOX) return json({error:'Development test unavailable'},503);
 if(!/^[a-zA-Z0-9_-]{16,80}$/.test(body.test_id||'')||!['MICR27','POWE003','ADAP005'].includes(body.sku)||!['accept','bad_signature','tamper','foreign_sender','echo','verify_challenge','bad_verify_token','ingress_disabled','pairing_claim'].includes(body.case||''))return json({error:'Invalid synthetic fixture'},400);
 if(body.case==='pairing_claim'&&!/^CONECTATECH-PRUEBA [a-f0-9]{32}$/.test(body.pairing_phrase||''))return json({error:'Invalid enrollment fixture'},400);
 const testEnv={...env,META_INGRESS_ENABLED:['ingress_disabled','pairing_claim'].includes(body.case)?'false':'true',META_APP_SECRET:env.PILOT_TOKEN,META_PAGE_ID:'100000000000001',META_TEST_SENDER_IDS:'100000000000002'};
 if(body.case==='verify_challenge'||body.case==='bad_verify_token') {
  const q=new URL('https://pilot/webhooks/meta');q.searchParams.set('hub.mode','subscribe');q.searchParams.set('hub.verify_token',body.case==='bad_verify_token'?'invalid-fixture':env.PILOT_TOKEN);q.searchParams.set('hub.challenge','fixture-challenge');
  const r=verifyMetaWebhook(new Request(q),{META_VERIFY_TOKEN:env.PILOT_TOKEN});
  return json({synthetic:true,meta_app_verified:false,webhook_status:r.status,challenge_matches:(await r.text())==='fixture-challenge'});
 }
 const payload={object:'page',entry:[{id:testEnv.META_PAGE_ID,messaging:[{sender:{id:body.case==='foreign_sender'?'100000000000003':'100000000000002'},recipient:{id:testEnv.META_PAGE_ID},timestamp:Date.now(),message:{mid:body.test_id,text:body.case==='pairing_claim'?body.pairing_phrase:body.sku,is_echo:body.case==='echo'}}]}]};
 let raw=JSON.stringify(payload);let signature='sha256='+await hmac(testEnv.META_APP_SECRET,raw);
 if(body.case==='bad_signature')signature='sha256'+'='+'0'.repeat(64);
 if(body.case==='tamper')raw+=' ';
 const response=await handleMessengerWebhook(new Request('https://pilot/webhooks/meta',{method:'POST',headers:{'X-Hub-Signature-256':signature},body:raw}),testEnv,'ci');
 return json({synthetic:true,meta_app_verified:false,event_ref:await hmac(testEnv.META_APP_SECRET,testEnv.META_PAGE_ID+':messenger:'+body.test_id),webhook_status:response.status,ack:await response.json()});
}
