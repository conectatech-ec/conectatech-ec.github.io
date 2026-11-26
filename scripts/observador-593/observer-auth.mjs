// Restricted identity adapter for the EXISTING commercial receiver.
// No persistent Google access token and no access to other Worker routes.
const OWNER='conectatech.ecu@gmail.com';
const AUDIENCE='305117727240-us52oigt57o2sr79rdmubjl1flg60t97.apps.googleusercontent.com';
const SUBJECT='__VERIFIED_ENTERPRISE_GOOGLE_SUBJECT__';
const JWKS='https://www.googleapis.com/oauth2/v3/certs';
let keyCache={until:0,checked:0,keys:[]};
const reply=(data,status)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function decode(value){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
export async function verifyObserverIdentity(token,{now=Date.now(),fetcher=fetch,audience=AUDIENCE,subject=SUBJECT,owner=OWNER}={}){
 try{
  if(typeof token!=='string'||token.length>12000||!/^\d{10,30}$/.test(subject))return false;
  const pieces=token.split('.');if(pieces.length!==3)return false;
  const header=JSON.parse(new TextDecoder().decode(decode(pieces[0]))),claims=JSON.parse(new TextDecoder().decode(decode(pieces[1])));
  const second=Math.floor(now/1000);
  if(header.alg!=='RS256'||!/^[-A-Za-z0-9_]{1,128}$/.test(header.kid||'')||
     !['accounts.google.com','https://accounts.google.com'].includes(claims.iss)||claims.aud!==audience||
     claims.sub!==subject||claims.email!==owner||claims.email_verified!==true||
     !Number.isInteger(claims.exp)||claims.exp<=second||!Number.isInteger(claims.iat)||
     claims.iat>second+60||claims.exp-claims.iat>7200)return false;
  if(keyCache.until<=now||(!keyCache.keys.some(k=>k.kid===header.kid)&&now-keyCache.checked>60000)){
   const r=await fetcher(JWKS,{redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)return false;
   const text=await r.text();if(text.length>50000)return false;const data=JSON.parse(text);
   if(!Array.isArray(data.keys)||data.keys.length>20)return false;
   const maxAge=Math.min(3600,Number(/max-age=(\d+)/.exec(r.headers.get('Cache-Control')||'')?.[1]||300));
   keyCache={until:now+maxAge*1000,checked:now,keys:data.keys};
  }
  const jwk=keyCache.keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256'));
  if(!jwk)return false;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(pieces[2]),new TextEncoder().encode(pieces[0]+'.'+pieces[1]));
 }catch{return false;}
}
export function observerRoute(url,method){
 const u=new URL(url);
 if(u.searchParams.has('scope'))return false;
 const keys=[...u.searchParams.keys()];
 if(u.pathname==='/commercial/status'&&method==='GET')return keys.length===0||(keys.length===1&&keys[0]==='sha256'&&/^[a-f0-9]{64}$/.test(u.searchParams.get('sha256')));
 return keys.length===0&&method==='POST'&&['/commercial/report','/commercial/complete'].includes(u.pathname);
}
export async function handleObserverRequest(req,env,{verify=verifyObserverIdentity}={}){
 const auth=req.headers.get('Authorization')||'';
 if(auth==='Bearer '+env.PILOT_TOKEN)return null; // Existing private operator path is untouched.
 if(!observerRoute(req.url,req.method))return null;
 if(!await verify(auth.startsWith('Bearer ')?auth.slice(7):''))return reply({error:'Unauthorized'},401);
 let body=req.body;
 const path=new URL(req.url).pathname;
 if(path==='/commercial/complete'){
  if(Number(req.headers.get('Content-Length')||0)>256)return reply({error:'OBSERVER_SCOPE'},403);
  const reader=req.body?.getReader();if(!reader)return reply({error:'OBSERVER_SCOPE'},403);
  const chunks=[];let count=0;
  for(;;){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>256){await reader.cancel();return reply({error:'OBSERVER_SCOPE'},403);}chunks.push(value);}
  let payload;try{payload=JSON.parse(new TextDecoder().decode(Uint8Array.from(chunks.flatMap(x=>Array.from(x)))));}catch{return reply({error:'OBSERVER_SCOPE'},403);}
  if(payload.status!=='retry'||!/^[a-f0-9]{64}$/.test(payload.sha256||'')||Object.keys(payload).sort().join(',')!=='sha256,status')return reply({error:'OBSERVER_SCOPE'},403);
  body=JSON.stringify(payload);
 }
 if(!env.MESSENGER_TEST_INBOX)return reply({error:'RECEIVER_UNAVAILABLE'},503);
 const headers=new Headers(req.headers);headers.delete('Authorization');
 headers.set('X-Observer-Contract','CT593_OBSERVER_V1');
 return env.MESSENGER_TEST_INBOX.get(env.MESSENGER_TEST_INBOX.idFromName('commercial-source')).fetch('https://inbox'+path+new URL(req.url).search,{method:req.method,headers,body:req.method==='GET'?undefined:body,duplex:'half'});
}
