const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync('Code.gs','utf8')+'\n'+fs.readFileSync('Auth.gs','utf8');
function runtime(){
 const config={users:['first@example.test','second@example.test'],manifestId:'private',rootId:'private',approvedFolders:['private'],hubUrl:'https://conectatech-ec.github.io/datos-593/estado-ultimo-corte.json'};
 const props=new Map(Object.entries({BANNERS_PRO_PUBLIC_BANNERS:'false',BANNERS_PRO_CONFIG:JSON.stringify(config),BANNERS_PRO_OAUTH_CLIENT_ID:'test.apps.googleusercontent.com',BANNERS_PRO_OAUTH_CLIENT_SECRET:'server-secret',BANNERS_PRO_OAUTH_REDIRECT_URI:'https://script.google.com/macros/s/existing/exec'}));
 const values=new Map(),calls=[],control={claims:{},status:200,driveReads:0},cache={get:k=>values.get(k)||null,put:(k,v)=>values.set(k,v),remove:k=>values.delete(k)};
 let held=false,nonce;
 const api=vm.runInNewContext(source+';({startGoogleSignIn,completeGoogleSignIn,googleCallback_,authorize_,signOut,getLibrary,validateAsset,getAsset,doGet})',{
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null})},
  CacheService:{getScriptCache:()=>cache},LockService:{getScriptLock:()=>({waitLock:()=>{assert.equal(held,false);held=true},releaseLock:()=>held=false})},
  Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,s)=>Array.from(crypto.createHash('sha256').update(typeof s==='string'?s:Buffer.from(s)).digest()),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url')},
  DriveApp:{getFileById:()=>{control.driveReads++;throw Error('Unexpected Drive read')}},
  Session:new Proxy({},{get:()=>{throw Error('Session identity must not be used')}}),
  HtmlService:{createHtmlOutput:s=>s,createHtmlOutputFromFile:()=>({setTitle(){return this},addMetaTag(){return this}})},
  UrlFetchApp:{fetch:(url,options)=>{
   calls.push({url,options});let data;
   if(url==='https://oauth2.googleapis.com/token'){
    assert.equal(options.payload.client_secret,'server-secret');assert.equal(options.payload.redirect_uri,props.get('BANNERS_PRO_OAUTH_REDIRECT_URI'));assert.match(options.payload.code_verifier,/^[a-f0-9]{64}$/);data={id_token:'header.payload.signature',access_token:'never-return-this'};
   }else if(url.startsWith('https://oauth2.googleapis.com/tokeninfo?')){
    assert.equal(options.followRedirects,false);assert.equal(options.validateHttpsCertificates,true);
    data={iss:'https://accounts.google.com',aud:'test.apps.googleusercontent.com',sub:'google-subject',email:'first@example.test',email_verified:'true',nonce,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,...control.claims};
   }else throw Error('Unexpected endpoint');
   return {getResponseCode:()=>control.status,getContentText:()=>JSON.stringify(data)};
  }}
 });
 function start(){const p=api.startGoogleSignIn(),url=new URL(p.url);nonce=url.searchParams.get('nonce');assert.equal(url.searchParams.get('scope'),'openid email');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert(!p.url.includes(p.binding));return p}
 function login(){const p=start();api.googleCallback_({state:p.state,code:'one-time-code'});return {p,result:api.completeGoogleSignIn(p.state,p.binding)}}
 return {api,props,config,cache,control,calls,start,login};
}
test('OAuth empresarial, Google verifica identidad; sesión opaca, sin tokens Google',()=>{const r=runtime(),{result}=r.login();assert.match(result.session,/^[a-f0-9]{64}$/);assert.equal(r.api.authorize_(result.session),'first@example.test');assert(!JSON.stringify(result).includes('never-return'));assert(!JSON.stringify(result).includes('signature'));assert.equal(r.control.driveReads,0)});
test('segunda identidad de lista blanca',()=>{const r=runtime();r.control.claims.email='second@example.test';const {result}=r.login();assert.equal(r.api.authorize_(result.session),'second@example.test')});
test('sin sesión, email falsificado o ID token directo: cero lecturas Drive',()=>{const r=runtime();for(const token of [undefined,'first@example.test',{email:'first@example.test'},'header.payload.signature','a'.repeat(64)]){assert.throws(()=>r.api.authorize_(token),/ACCESO_DENEGADO/);assert.throws(()=>r.api.getLibrary(token),/ACCESO_DENEGADO/);assert.throws(()=>r.api.validateAsset('id',1,token),/ACCESO_DENEGADO/);assert.throws(()=>r.api.getAsset('id',1,token),/ACCESO_DENEGADO/)}assert.equal(r.control.driveReads,0)});
for(const [name,claims] of Object.entries({ajeno:{email:'other@example.test'},noVerificado:{email_verified:'false'},audiencia:{aud:'attacker.apps.googleusercontent.com'},emisor:{iss:'attacker'},caducado:{exp:1},nonce:{nonce:'different'},azp:{azp:'attacker'},futuro:{iat:9999999999},sinSub:{sub:''}}))test('rechaza '+name,()=>{const r=runtime();r.control.claims=claims;const p=r.start();assert.throws(()=>r.api.googleCallback_({state:p.state,code:'code'}),/ACCESO_DENEGADO/);assert.throws(()=>r.api.completeGoogleSignIn(p.state,p.binding),/ACCESO_DENEGADO/);assert.equal(r.control.driveReads,0)});
test('Google rechaza token o falla: no hay sesión',()=>{const r=runtime(),p=r.start();r.control.status=400;assert.throws(()=>r.api.googleCallback_({state:p.state,code:'code'}),/ACCESO_DENEGADO/);assert.throws(()=>r.api.completeGoogleSignIn(p.state,p.binding),/ACCESO_DENEGADO/)});
test('state y binding no adivinables ni reutilizables',()=>{const r=runtime(),p=r.start();assert.throws(()=>r.api.completeGoogleSignIn(p.state,'f'.repeat(64)),/ACCESO_DENEGADO/);r.api.googleCallback_({state:p.state,code:'code'});assert.throws(()=>r.api.googleCallback_({state:p.state,code:'code'}),/ACCESO_DENEGADO/);r.api.completeGoogleSignIn(p.state,p.binding);assert.throws(()=>r.api.completeGoogleSignIn(p.state,p.binding),/ACCESO_DENEGADO/)});
test('callback sin state o cancelado no autoriza',()=>{const r=runtime();assert.throws(()=>r.api.googleCallback_({code:'code'}),/ACCESO_DENEGADO/);const p=r.start();r.api.googleCallback_;assert.throws(()=>r.api.googleCallback_({state:p.state,error:'access_denied'}),/ACCESO_DENEGADO/)});
test('revocación por lista blanca inmediata',()=>{const r=runtime(),{result}=r.login();r.config.users=['second@example.test'];r.props.set('BANNERS_PRO_CONFIG',JSON.stringify(r.config));assert.throws(()=>r.api.authorize_(result.session),/ACCESO_DENEGADO/)});
test('cerrar sesión, rotar epoch o caché perdida revoca',()=>{for(const action of ['logout','epoch','eviction']){const r=runtime(),{result}=r.login();if(action==='logout')r.api.signOut(result.session);if(action==='epoch')r.props.set('BANNERS_PRO_AUTH_EPOCH','2');if(action==='eviction')r.cache.remove('bp:auth:v2:session:'+crypto.createHash('sha256').update(result.session).digest('hex'));assert.throws(()=>r.api.authorize_(result.session),/ACCESO_DENEGADO/)}});
test('sesión vencida no autoriza',()=>{const r=runtime(),{result}=r.login(),key='bp:auth:v2:session:'+crypto.createHash('sha256').update(result.session).digest('hex'),data=JSON.parse(r.cache.get(key));data.expires=1;r.cache.put(key,JSON.stringify(data));assert.throws(()=>r.api.authorize_(result.session),/ACCESO_DENEGADO/)});
test('shell público no lee Drive y errores callback no revelan credenciales',()=>{const r=runtime();r.api.doGet();const page=r.api.doGet({parameter:{state:'invalid',code:'secret-code'}});assert(!page.includes('secret-code'));assert(!page.includes('server-secret'));assert.equal(r.control.driveReads,0)});
