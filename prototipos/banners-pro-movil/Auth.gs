/* OAuth authorization-code flow. All Google credentials remain server-side. */
const AUTH_TTL_=1800, LOGIN_TTL_=600;
function denied_(){return new Error('ACCESO_DENEGADO: inicia sesión con una cuenta autorizada.');}
function random_(){return Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');}
function validSecret_(s){return typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);}
function oauthConfiguration_(){
  const p=PropertiesService.getScriptProperties(),c={clientId:p.getProperty('BANNERS_PRO_OAUTH_CLIENT_ID'),secret:p.getProperty('BANNERS_PRO_OAUTH_CLIENT_SECRET'),redirect:p.getProperty('BANNERS_PRO_OAUTH_REDIRECT_URI')};
  if(!c.clientId||!c.clientId.endsWith('.apps.googleusercontent.com')||!c.secret||!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(c.redirect||''))throw new Error('Inicio de sesión pendiente de configuración empresarial.');
  return c;
}
function authCache_(){return CacheService.getScriptCache();}
function lockAuth_(fn){const lock=LockService.getScriptLock();lock.waitLock(10000);try{return fn();}finally{lock.releaseLock();}}
function authKey_(kind,token){return 'bp:auth:v2:'+kind+':'+hash_(token);}
function cached_(key){const raw=authCache_().get(key);if(!raw)return null;try{return JSON.parse(raw);}catch(e){return null;}}
function currentUsers_(){return configuration_().users;}
function startGoogleSignIn(){
  const c=oauthConfiguration_(),state=random_(),binding=random_(),nonce=random_(),verifier=random_();
  const digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,verifier);
  const challenge=Utilities.base64EncodeWebSafe(digest).replace(/=+$/,'');
  authCache_().put(authKey_('login',state),JSON.stringify({binding:hash_(binding),nonce,verifier,status:'pending',expires:Date.now()+LOGIN_TTL_*1000}),LOGIN_TTL_);
  const params={client_id:c.clientId,redirect_uri:c.redirect,response_type:'code',scope:'openid email',state,nonce,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account',access_type:'online'};
  return {state,binding,url:'https://accounts.google.com/o/oauth2/v2/auth?'+Object.keys(params).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(params[k])).join('&')};
}
function googleJson_(url,options){
  let response;try{response=UrlFetchApp.fetch(url,{...options,muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});}catch(e){throw denied_();}
  if(response.getResponseCode()!==200)throw denied_();
  try{return JSON.parse(response.getContentText());}catch(e){throw denied_();}
}
function verifiedClaims_(token,c,pending){
  if(typeof token!=='string'||token.length>16384||token.split('.').length!==3)throw denied_();
  // Google verifies the JWT signature; no browser-supplied email or decoded JWT is trusted.
  const claims=googleJson_('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(token),{method:'get'});
  const now=Math.floor(Date.now()/1000),email=typeof claims.email==='string'?claims.email.toLowerCase().trim():'';
  if(!['https://accounts.google.com','accounts.google.com'].includes(claims.iss)||claims.aud!==c.clientId||(claims.azp&&claims.azp!==c.clientId)||!Number.isFinite(Number(claims.exp))||Number(claims.exp)<=now||!Number.isFinite(Number(claims.iat))||Number(claims.iat)>now+60||Number(claims.iat)>Number(claims.exp)||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>255||![true,'true'].includes(claims.email_verified)||claims.nonce!==pending.nonce||!currentUsers_().includes(email))throw denied_();
  return {email,sub:claims.sub,expires:Math.min(Number(claims.exp)*1000,Date.now()+AUTH_TTL_*1000)};
}
function googleCallback_(params){
  const state=params.state;
  if(!validSecret_(state))throw denied_();
  let pending;
  lockAuth_(()=>{
    pending=cached_(authKey_('login',state));
    if(!pending||pending.status!=='pending'||pending.expires<=Date.now())throw denied_();
    pending.status='processing';authCache_().put(authKey_('login',state),JSON.stringify(pending),LOGIN_TTL_);
  });
  try{
    if(params.error||typeof params.code!=='string'||!params.code||params.code.length>4096)throw denied_();
    const c=oauthConfiguration_();
    const tokens=googleJson_('https://oauth2.googleapis.com/token',{method:'post',payload:{grant_type:'authorization_code',code:params.code,client_id:c.clientId,client_secret:c.secret,redirect_uri:c.redirect,code_verifier:pending.verifier}});
    const identity=verifiedClaims_(tokens.id_token,c,pending);
    // Store identity only; Google tokens and PKCE verifier are never returned to visitors.
    authCache_().put(authKey_('login',state),JSON.stringify({binding:pending.binding,status:'ready',identity,expires:pending.expires}),LOGIN_TTL_);
  }catch(e){authCache_().put(authKey_('login',state),JSON.stringify({binding:pending.binding,status:'denied',expires:pending.expires}),LOGIN_TTL_);throw denied_();}
}
function completeGoogleSignIn(state,binding){
  if(!validSecret_(state)||!validSecret_(binding))throw denied_();
  return lockAuth_(()=>{
    const key=authKey_('login',state),p=cached_(key);
    if(!p||p.expires<=Date.now()||p.binding!==hash_(binding))throw denied_();
    if(['pending','processing'].includes(p.status))return {pending:true};
    authCache_().remove(key);
    if(p.status!=='ready'||!currentUsers_().includes(p.identity.email)||p.identity.expires<=Date.now())throw denied_();
    const session=random_(),identity=p.identity;
    identity.epoch=PropertiesService.getScriptProperties().getProperty('BANNERS_PRO_AUTH_EPOCH')||'1';
    authCache_().put(authKey_('session',session),JSON.stringify(identity),Math.max(1,Math.floor((identity.expires-Date.now())/1000)));
    return {session,expires:identity.expires};
  });
}
function authorize_(session){
  if(!validSecret_(session))throw denied_();
  const identity=cached_(authKey_('session',session)),epoch=PropertiesService.getScriptProperties().getProperty('BANNERS_PRO_AUTH_EPOCH')||'1';
  if(!identity||identity.expires<=Date.now()||identity.epoch!==epoch||!currentUsers_().includes(identity.email))throw denied_();
  return identity.email;
}
function signOut(session){if(validSecret_(session))authCache_().remove(authKey_('session',session));return {ok:true};}
