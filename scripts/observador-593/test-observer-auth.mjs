import assert from 'node:assert/strict';
import {verifyObserverIdentity,observerRoute,handleObserverRequest} from './observer-auth.mjs';
const {privateKey,publicKey}=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',publicKey),kid:'fixture'};
const now=1795720000000,subject='123456789012345678901',audience='fixture.apps.googleusercontent.com';
const opts={now,subject,audience,fetcher:async()=>Response.json({keys:[jwk]},{headers:{'Cache-Control':'max-age=300'}})};
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const claims={iss:'https://accounts.google.com',aud:audience,sub:subject,email:'conectatech.ecu@gmail.com',email_verified:true,iat:Math.floor(now/1000),exp:Math.floor(now/1000)+3600};
async function token(change={},header={}){let data=b64({alg:'RS256',kid:'fixture',...header})+'.'+b64({...claims,...change});return data+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',privateKey,Buffer.from(data))).toString('base64url');}
let tests=0;async function test(name,fn){await fn();tests++;console.log('PASS '+name);}
await test('fallo de claves expone sólo código fijo',async()=>{let reason;assert.equal(await verifyObserverIdentity(await token(),{...opts,fetcher:async()=>{throw Error('PRIVATE_RESPONSE');},onFailure:x=>reason=x}),false);assert.equal(reason,'KEY_FETCH');});
await test('firma RSA e identidad empresarial correctas',async()=>assert.equal(await verifyObserverIdentity(await token(),opts),true));
for(const [name,change] of Object.entries({audience:{aud:'other'},owner:{email:'other@gmail.com'},subject:{sub:'999999999999999999999'},expired:{exp:Math.floor(now/1000)-1},unverified:{email_verified:false},issuer:{iss:'https://attacker.example'}}))await test('rechaza '+name,async()=>assert.equal(await verifyObserverIdentity(await token(change),opts),false));
await test('rechaza firma alterada',async()=>{let t=await token();const p=t.split('.');p[1]=b64({...claims,exp:claims.exp+1});assert.equal(await verifyObserverIdentity(p.join('.'),opts),false);});
await test('rechaza algoritmo none',async()=>assert.equal(await verifyObserverIdentity(await token({}, {alg:'none'}),opts),false));
await test('subjetivo no configurado falla cerrado',async()=>assert.equal(await verifyObserverIdentity(await token(),{...opts,subject:''}),false));
await test('sin acceso a datos binarios, checkout, SIGNATURE o ámbito CI',()=>{for(const [path,method] of [['/commercial/report','GET'],['/checkout/admin','POST'],['/alex/signature/upload/TELF011','POST'],['/commercial/status?scope=ci','GET']])assert.equal(observerRoute('https://test'+path,method),false);});
await test('prohíbe claim o completar recibos desde observador',async()=>{for(const status of ['claim','processed','release']){const req=new Request('https://test/commercial/complete',{method:'POST',body:JSON.stringify({status,sha256:'a'.repeat(64)})});let r=await handleObserverRequest(req,{}, {verify:async()=>true});assert.equal(r.status,403);}});
await test('token privado existente conserva su ruta',async()=>assert.equal(await handleObserverRequest(new Request('https://test/commercial/status',{headers:{Authorization:'Bearer original'}}),{PILOT_TOKEN:'original'}),null));
await test('retry autenticado llega sólo al receptor original sin token Google',async()=>{let got;const env={MESSENGER_TEST_INBOX:{idFromName:n=>n,get:id=>({fetch:async(url,o)=>{got={id,url,o};return Response.json({ok:true});}})}};await handleObserverRequest(new Request('https://test/commercial/complete',{method:'POST',body:JSON.stringify({status:'retry',sha256:'a'.repeat(64)}),headers:{Authorization:'Bearer test'}}),env,{verify:async()=>true});assert.equal(got.id,'commercial-source');assert.equal(got.o.headers.get('Authorization'),null);});
console.log(JSON.stringify({tests,passed:tests,synthetic:true,remote_execution:false}));
