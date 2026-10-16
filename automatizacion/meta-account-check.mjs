// Read-only Meta account check. Never log URLs containing tokens or Graph bodies.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('./activar-cloud.json',import.meta.url)));
const selected=['META_PAGE_ACCESS_TOKEN','PAGE_ACCESS_TOKEN','META_PAGE_TOKEN'].find(k=>!!process.env[k]);
const token=selected?process.env[selected]:null;
const report={read_only:true,page_token_present:!!token,page_token_secret_name:selected||null,test_sender_secret_present:!!process.env.META_TEST_SENDER_IDS,app_secret_present:!!process.env.META_APP_SECRET};
const version='v26.0';
async function get(path,bearer){try{const r=await fetch('https://graph.facebook.com/'+version+'/'+path,{headers:{Authorization:'Bearer '+bearer},signal:AbortSignal.timeout(15000)});const b=await r.json();return {http:r.status,b};}catch{return {http:0,b:{}};}}
if(token){
 const me=await get('me?fields=id',token);report.page_identity_http=me.http;report.page_identity_matches=me.http===200&&String(me.b.id)===config.meta_page_id;
 if(me.b.error)report.identity_error_code=Number(me.b.error.code)||null;
 if(report.page_identity_matches){
  const apps=await get(config.meta_page_id+'/subscribed_apps?fields=id,name,subscribed_fields',token);report.subscriptions_http=apps.http;report.subscriptions_error_code=Number(apps.b.error?.code)||null;report.subscriptions_error_subcode=Number(apps.b.error?.error_subcode)||null;report.subscriptions_requires_manage_metadata=/pages_manage_metadata/i.test(apps.b.error?.message||'');
  const app=apps.b.data?.find(a=>a.name==='Jotacellcomunicapp');report.app_subscription_found=apps.http===200?!!app:null;report.messages_subscribed=apps.http===200?!!app?.subscribed_fields?.includes('messages'):null;report.delivery_subscribed=apps.http===200?!!app?.subscribed_fields?.includes('message_deliveries'):null;
  const appInfo=await get('app?fields=id,name',token);report.app_identity_http=appInfo.http;report.app_name_matches=appInfo.b.name==='Jotacellcomunicapp';
  const appId=app?.id||process.env.META_APP_ID||(report.app_name_matches?appInfo.b.id:null);
  if(appId&&process.env.META_APP_SECRET){
   const d=await get('debug_token?input_token='+encodeURIComponent(token),appId+'|'+process.env.META_APP_SECRET);
   const data=d.b.data||{};report.token_debug_http=d.http;report.token_debug_error_code=Number(d.b.error?.code)||null;report.token_valid=data.is_valid===true;report.token_type=data.type||null;report.token_app_matches=String(data.app_id)===String(appId);report.pages_messaging_granted=!!data.scopes?.includes('pages_messaging');report.pages_manage_metadata_granted=!!data.scopes?.includes('pages_manage_metadata');report.token_expired=Number(data.expires_at)>0&&Number(data.expires_at)*1000<=Date.now();
  }
 }
}
// A granted token scope does not prove Advanced Access or App Live mode.
report.advanced_access_verified=false;report.app_live_verified=false;
const base=process.env.CLOUDFLARE_PILOT_URL||config.url_publica;
for(const [key,path]of [['pairing','/messenger/pairing/status'],['seller','/messenger/seller/status']]){
 try{const r=await fetch(base+path,{headers:{Authorization:'Bearer '+process.env.PILOT_TOKEN},signal:AbortSignal.timeout(10000)});report[key+'_http']=r.status;if(r.ok){const b=await r.json();report[key]=key==='pairing'?{pending:!!b.pending,claimed:!!b.claimed}:b;}}catch{report[key+'_http']=0;}
}
const dir=new URL('./generated/fase2/',import.meta.url);await mkdir(dir,{recursive:true});await writeFile(new URL('meta-account-check.json',dir),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
