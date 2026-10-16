// Official Messenger transport. No marketing tags, paid features or other channels.
export const GRAPH='https://graph.facebook.com/v26.0/';
export async function graphRead(path,token,fetcher=fetch){
 try{const r=await fetcher(GRAPH+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});const data=await r.json();return {http:r.status,data};}catch{return {http:0,data:{}};}
}
export async function verifyPage(env,fetcher=fetch){
 const token=env.META_PAGE_ACCESS_TOKEN;
 if(!token)return {ready:false,reason:'PAGE_TOKEN_MISSING'};
 const me=await graphRead('me?fields=id',token,fetcher);
 if(me.http!==200||String(me.data.id)!==env.META_PAGE_ID)return {ready:false,reason:'PAGE_TOKEN_IDENTITY_FAILED',http:me.http,code:Number(me.data.error?.code)||null};
 const subs=await graphRead(env.META_PAGE_ID+'/subscribed_apps?fields=id,name,subscribed_fields',token,fetcher);
 const app=subs.data.data?.find(a=>a.name==='Jotacellcomunicapp');
 const appInfo=app?null:await graphRead('app?fields=id,name',token,fetcher);
 const appId=app?.id||env.META_APP_ID||(appInfo?.data.name==='Jotacellcomunicapp'?appInfo.data.id:null);
 if(!appId)return {ready:false,reason:'APP_ID_REQUIRED_FOR_TOKEN_VERIFICATION',http:subs.http};
 if(app&&!app.subscribed_fields?.includes('messages'))return {ready:false,reason:'MESSAGES_NOT_SUBSCRIBED'};
 if(!env.META_APP_SECRET)return {ready:false,reason:'APP_SECRET_MISSING'};
 const debug=await graphRead('debug_token?input_token='+encodeURIComponent(token),appId+'|'+env.META_APP_SECRET,fetcher);
 const d=debug.data.data||{};
 if(debug.http!==200||d.is_valid!==true||String(d.app_id)!==String(appId)||d.type!=='PAGE'||!d.scopes?.includes('pages_messaging')||(d.expires_at>0&&d.expires_at*1000<=Date.now()))return {ready:false,reason:'PAGES_MESSAGING_NOT_VERIFIED',http:debug.http};
 return {ready:true,reason:'AUTHORIZED_TEST_SEND_READY',pages_messaging:true,subscription_read_http:subs.http,messages_subscription_verified:!!app?.subscribed_fields?.includes('messages'),delivery_subscribed:!!app?.subscribed_fields?.includes('message_deliveries'),advanced_access_verified:false,app_live_verified:false,checked_at:Date.now()};
}
export async function sendMessage(env,recipient,message,{inboundAt,scope,enabled},fetcher=fetch){
 // CI can never reach the real transport, even if real credentials are injected.
 if(scope!=='messenger-development'||!enabled||env.META_MODE!=='development-only'||!env.META_PAGE_ACCESS_TOKEN)return {state:'blocked',code:'TRANSPORT_DISABLED'};
 if(!/^\d{1,32}$/.test(recipient)||!Number.isFinite(inboundAt)||inboundAt>Date.now()+300000||Date.now()-inboundAt>=86400000)return {state:'blocked',code:'OUTSIDE_24H_WINDOW'};
 try{
  const r=await fetcher(GRAPH+env.META_PAGE_ID+'/messages',{method:'POST',headers:{Authorization:'Bearer '+env.META_PAGE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({recipient:{id:recipient},messaging_type:'RESPONSE',message}),signal:AbortSignal.timeout(15000)});
  const b=await r.json();
  if(r.ok&&typeof b.message_id==='string'&&String(b.recipient_id)===recipient)return {state:'accepted',messageId:b.message_id,http:r.status};
  // No automatic retry: 5xx or ambiguous response may already have sent a message.
  return {state:r.status>=500||r.ok?'unknown':'rejected',http:r.status,code:Number(b.error?.code)||null};
 }catch{return {state:'unknown',http:0,code:'SEND_RESULT_UNKNOWN'};}
}
