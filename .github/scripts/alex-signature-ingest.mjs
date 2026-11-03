// Private, one-time transfer: original PNG bytes and download capabilities never
// enter the repository, artifacts, logs or workflow inputs. Only this job owns
// the ephemeral X25519 private key; only the fixed authenticated pilot receives bytes.
import {generateKeyPairSync,createPrivateKey,createPublicKey,diffieHellman,hkdfSync,createDecipheriv,createCipheriv,createHash,randomBytes} from 'node:crypto';
import {readFile,writeFile,mkdir,appendFile,unlink,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const ROOT=new URL('../../',import.meta.url),BASE='https://conectatech-comercial-piloto.conectatech-ecu.workers.dev';
const BRANCH='automatizacion/piloto-cloud-3sku-20261015',REF='refs/heads/'+BRANCH;
const HANDOFF='https://raw.githubusercontent.com/conectatech-ec/conectatech-ec.github.io/'+BRANCH+'/.github/alex-signature-sealed.json';
const INFO='conectatech.alex.private.signature.v1',SEALED_SCHEMA='conectatech.alex.signature.sealed.v1';
const PUBLIC_SCHEMA='conectatech.alex.signature.public-key.v1',REPORT_PATH=new URL('automatizacion/generated/fase2/alex-signature-ingest.json',ROOT);
const IDS=['TELF011','TELF012','REL046'],SHA=/^[a-f0-9]{64}$/,MAX_PNG=2_000_000,MAX_ENVELOPE=100_000;
const SPKI_PREFIX=Buffer.from('302a300506032b656e032100','hex'),PNG=Buffer.from([137,80,78,71,13,10,26,10]);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let stage='setup';
function fail(code){throw Object.assign(new Error(code),{safeCode:code});}
function requireValue(value,code){if(!value)fail(code);}
function runIdentity(){const id=process.env.GITHUB_RUN_ID;requireValue(/^\d{5,30}$/.test(id||''),'INGEST_RUN_ID_REQUIRED');return id;}
function paths(id){const dir=process.env.RUNNER_TEMP||tmpdir();return {privateKey:join(dir,'alex-signature-private-'+id+'.pem'),publicKey:join(dir,'alex-signature-public-'+id+'.json')};}
async function control(){
 requireValue(process.env.GITHUB_REF===REF,'INGEST_PILOT_BRANCH_REQUIRED');
 const value=JSON.parse(await readFile(new URL('.github/alex-signature-ingest.json',ROOT),'utf8'));
 requireValue(value.worker==='conectatech-comercial-piloto'&&value.cost_max_usd===0&&value.ingest===true,'INGEST_CONTROL_DISABLED');
}
function rawPublic(key){const bytes=key.export({type:'spki',format:'der'});requireValue(bytes.length===44&&bytes.subarray(0,12).equals(SPKI_PREFIX),'INGEST_KEY_TYPE');return bytes.subarray(12);}
function parsePublic(encoded){
 requireValue(typeof encoded==='string'&&/^[A-Za-z0-9_-]{43}$/.test(encoded),'INGEST_PUBLIC_KEY_INVALID');
 const bytes=Buffer.from(encoded,'base64url');requireValue(bytes.length===32&&bytes.toString('base64url')===encoded,'INGEST_PUBLIC_KEY_INVALID');
 return createPublicKey({key:Buffer.concat([SPKI_PREFIX,bytes]),type:'spki',format:'der'});
}
function binary(value,length){requireValue(typeof value==='string'&&/^[A-Za-z0-9_-]+$/.test(value),'INGEST_ENVELOPE_BINARY_INVALID');const b=Buffer.from(value,'base64url');requireValue(b.length===length&&b.toString('base64url')===value,'INGEST_ENVELOPE_BINARY_INVALID');return b;}
function secretKey(privateKey,peer,runId){const shared=diffieHellman({privateKey,publicKey:peer});try{return Buffer.from(hkdfSync('sha256',shared,Buffer.from(runId),Buffer.from(INFO),32));}finally{shared.fill(0);}}
export function decryptEnvelope(envelope,privateKey,runId){
 requireValue(envelope?.schema===SEALED_SCHEMA&&envelope.run_id===runId,'INGEST_ENVELOPE_SCOPE');
 const peer=parsePublic(envelope.client_public_key),iv=binary(envelope.iv,12),tag=binary(envelope.tag,16);
 requireValue(typeof envelope.ciphertext==='string'&&envelope.ciphertext.length>0&&envelope.ciphertext.length<=MAX_ENVELOPE&&/^[A-Za-z0-9_-]+$/.test(envelope.ciphertext),'INGEST_ENVELOPE_SIZE');
 const key=secretKey(privateKey,peer,runId);let plaintext;
 try{const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(Buffer.from(runId));decipher.setAuthTag(tag);plaintext=Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64url')),decipher.final()]);requireValue(plaintext.length<=64_000,'INGEST_PAYLOAD_SIZE');return JSON.parse(plaintext.toString('utf8'));}
 catch{fail('INGEST_ENVELOPE_AUTHENTICATION_FAILED');}
 finally{key.fill(0);plaintext?.fill(0);}
}
export function privateDownloadURL(value){
 if(typeof value!=='string'||value.length>12_000)return false;
 try{const u=new URL(value);return u.href===value&&u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&!u.hash&&/^(?:[a-z0-9-]+\.)*oaiusercontent\.com$/.test(u.hostname)&&/^\/files\/[A-Za-z0-9_-]{1,120}\/raw$/.test(u.pathname)&&u.searchParams.get('sp')==='r'&&!!u.searchParams.get('sig')&&Number.isFinite(Date.parse(u.searchParams.get('se')))&&Date.parse(u.searchParams.get('se'))>Date.now();}catch{return false;}
}
async function keygen(){
 await control();const id=runIdentity(),p=paths(id),pair=generateKeyPairSync('x25519'),raw=rawPublic(pair.publicKey),public_key=raw.toString('base64url');
 await writeFile(p.privateKey,pair.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600,flag:'wx'});await chmod(p.privateKey,0o600);
 await writeFile(p.publicKey,JSON.stringify({schema:PUBLIC_SCHEMA,run_id:id,public_key,algorithm:'X25519-HKDF-SHA256-AES256GCM',key_info:INFO,salt:'UTF8(run_id)',aad:'UTF8(run_id)'})+'\n',{mode:0o644});
 const artifact_name='alex-sig-pub-'+public_key;
 requireValue(!!process.env.GITHUB_OUTPUT,'INGEST_GITHUB_OUTPUT_REQUIRED');
 await appendFile(process.env.GITHUB_OUTPUT,'artifact_name='+artifact_name+'\npublic_path='+p.publicKey+'\n');
 console.log(JSON.stringify({schema:PUBLIC_SCHEMA,run_id:id,public_artifact:artifact_name,private_key_recorded:false}));
}
async function waitForEnvelope(id,ownPublic){
 const until=Date.now()+5*60_000;
 while(Date.now()<until){
  // Public run identity only: avoid a previously cached 404 while the owner
  // commits this run's sealed envelope. No capability is put in this URL.
  let r;try{r=await fetch(HANDOFF+'?run='+id+'&fresh='+Date.now(),{headers:{Accept:'application/json','Cache-Control':'no-cache'},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15_000)});}catch{fail('INGEST_HANDOFF_NETWORK_FAILED');}
  if(r.status!==404){
   requireValue(r.ok,'INGEST_HANDOFF_READ_FAILED');const text=await r.text();requireValue(text.length<=MAX_ENVELOPE,'INGEST_ENVELOPE_SIZE');let e;try{e=JSON.parse(text);}catch{fail('INGEST_ENVELOPE_FORMAT');}
   if(e.run_id===id&&(!e.recipient_public_key||e.recipient_public_key===ownPublic))return e;
  }
  await sleep(15_000);
 }
 fail('INGEST_HANDOFF_TIMEOUT');
}
async function privateGet(path,token){
 const r=await fetch(BASE+path,{headers:{Authorization:'Bearer '+token},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30_000)});
 requireValue(r.status===200,'INGEST_PRIVATE_HTTP_REQUIRED');const t=await r.text();requireValue(t.length<=200_000,'INGEST_PRIVATE_RESPONSE_LIMIT');return JSON.parse(t);
}
async function approvedRelease(){
 const release=JSON.parse(await readFile(new URL('automatizacion/alex-signature-release.json',ROOT),'utf8'));
 requireValue(release.schema==='conectatech.alex.signature.private.v1'&&release.scope==='private_simulator'&&release.owner_approved===true&&release.external_delivery_allowed===false,'INGEST_OWNER_APPROVAL_REQUIRED');
 for(const id of IDS){const p=release.products?.[id];requireValue(p?.owner_approved===true&&p.approved_scope==='private_simulator'&&SHA.test(p.sha256||'')&&Number.isSafeInteger(p.bytes_count??p.size_bytes)&&(p.bytes_count??p.size_bytes)>8&&(p.bytes_count??p.size_bytes)<=MAX_PNG,'INGEST_APPROVAL_RECORD_INVALID');}
 return release;
}
function validatePayload(payload,release){
 requireValue(Array.isArray(payload?.files)&&payload.files.length===IDS.length,'INGEST_PAYLOAD_FILES');const seen=new Set();
 for(const f of payload.files){const p=release.products[f.sku],size=p?.bytes_count??p?.size_bytes;requireValue(IDS.includes(f.sku)&&!seen.has(f.sku)&&f.sha256===p?.sha256&&f.bytes_count===size&&privateDownloadURL(f.url),'INGEST_PRIVATE_SOURCE_NOT_APPROVED');seen.add(f.sku);}
}
async function download(f){
 let r;try{r=await fetch(f.url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(60_000)});}catch{fail('INGEST_PRIVATE_SOURCE_DOWNLOAD_FAILED');}
 requireValue(r.status===200,'INGEST_PRIVATE_SOURCE_HTTP');requireValue(Number(r.headers.get('content-length')||0)<=MAX_PNG,'INGEST_IMAGE_SIZE');
 const chunks=[];let length=0;
 for await(const bytes of r.body){length+=bytes.length;if(length>MAX_PNG){for(const b of chunks)b.fill(0);fail('INGEST_IMAGE_SIZE');}chunks.push(Buffer.from(bytes));}
 const image=Buffer.concat(chunks);for(const b of chunks)b.fill(0);
 try{requireValue(length===f.bytes_count&&image.length>=24&&image.subarray(0,8).equals(PNG)&&image.subarray(12,16).toString()==='IHDR'&&image.readUInt32BE(16)>0&&image.readUInt32BE(16)<=4096&&image.readUInt32BE(20)>0&&image.readUInt32BE(20)<=4096,'INGEST_PNG_INVALID');
  requireValue(createHash('sha256').update(image).digest('hex')===f.sha256,'INGEST_APPROVED_HASH_MISMATCH');return image;
 }catch(error){image.fill(0);throw error;}
}
async function ingest(){
 const id=runIdentity(),p=paths(id),report={schema:'conectatech.alex.signature.private-ingest.v1',at:new Date().toISOString(),run_id:id,passed:false,scope:'private_simulator',public_PNG_files:0,public_capability_URLs:0,customer_messages:0,paid_services_activated:0,files:[]};
 let key;
 try{
  await control();requireValue(process.env.CF_FREE_ONLY_CONFIRMED==='true','INGEST_FREE_ONLY_REQUIRED');const token=process.env.PILOT_TOKEN;requireValue(typeof token==='string'&&token.length>=32,'INGEST_PILOT_SECRET_REQUIRED');
  stage='approval';const release=await approvedRelease();key=createPrivateKey(await readFile(p.privateKey));const ownPublic=rawPublic(createPublicKey(key)).toString('base64url');
  stage='health';const before=await privateGet('/health',token);requireValue(before.ok===true&&before.meta_ingress_enabled===false,'INGEST_EXTERNAL_MESSAGES_MUST_REMAIN_CLOSED');
  stage='sealed_handoff';const envelope=await waitForEnvelope(id,ownPublic),payload=decryptEnvelope(envelope,key,id);validatePayload(payload,release);
  for(const f of payload.files){
   stage='upload_'+f.sku;let bytes;
   try{
    bytes=await download(f);
    const r=await fetch(BASE+'/alex/signature/upload/'+f.sku,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'image/png'},body:bytes,redirect:'error',signal:AbortSignal.timeout(60_000)});
    requireValue(r.status===200,'INGEST_WORKER_UPLOAD_HTTP');const text=await r.text();requireValue(text.length<=10_000,'INGEST_UPLOAD_RESPONSE_SIZE');const d=JSON.parse(text);
    requireValue(d.ok===true&&d.upload_verified===true&&d.scope==='private_simulator'&&d.sha256===f.sha256&&d.sku===f.sku,'INGEST_UPLOAD_NOT_VERIFIED');
    report.files.push({sku:f.sku,sha256:f.sha256,bytes_count:f.bytes_count,HTTP:200,upload_verified:true,private_storage:true});
   }finally{bytes?.fill(0);f.url='';}
  }
  stage='closure';const after=await privateGet('/health',token);requireValue(after.release===before.release&&after.meta_ingress_enabled===false&&after.messenger_outbound===before.messenger_outbound,'INGEST_PILOT_CONTROLS_CHANGED');report.passed=true;
 }catch(error){report.failure={stage,code:/^[A-Z0-9_]{3,100}$/.test(error.safeCode||'')?error.safeCode:'INGEST_PRIVATE_TRANSFER_FAILED'};}
 finally{key=null;await unlink(p.privateKey).catch(()=>{});await unlink(p.publicKey).catch(()=>{});}
 await mkdir(new URL('automatizacion/generated/fase2/',ROOT),{recursive:true});await writeFile(REPORT_PATH,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
}
async function cleanup(){const p=paths(runIdentity());await unlink(p.privateKey).catch(()=>{});await unlink(p.publicKey).catch(()=>{});}
async function selftest(){
 const runId='12345678901',server=generateKeyPairSync('x25519'),client=generateKeyPairSync('x25519'),iv=randomBytes(12),key=secretKey(client.privateKey,server.publicKey,runId),original={files:[{sku:'TELF011',example:'synthetic only'}]};
 const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(runId));const encrypted=Buffer.concat([cipher.update(JSON.stringify(original)),cipher.final()]);key.fill(0);
 const envelope={schema:SEALED_SCHEMA,run_id:runId,client_public_key:rawPublic(client.publicKey).toString('base64url'),iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),ciphertext:encrypted.toString('base64url')};
 requireValue(JSON.stringify(decryptEnvelope(envelope,server.privateKey,runId))===JSON.stringify(original),'INGEST_SELFTEST_ROUNDTRIP');
 let rejected=false;try{decryptEnvelope({...envelope,run_id:'different'},server.privateKey,runId);}catch{rejected=true;}requireValue(rejected,'INGEST_SELFTEST_SCOPE');
 rejected=false;try{decryptEnvelope({...envelope,tag:Buffer.alloc(16).toString('base64url')},server.privateKey,runId);}catch{rejected=true;}requireValue(rejected,'INGEST_SELFTEST_TAMPERING');
 for(const u of ['https://example.com/files/x/raw?sp=r&sig=x','https://oaiusercontent.com.evil.test/files/x/raw?sp=r&sig=x','http://oaiusercontent.com/files/x/raw?sp=r&sig=x','https://user:secret@oaiusercontent.com/files/x/raw?sp=r&sig=x','https://oaiusercontent.com/files/x/raw?sp=w&sig=x'])requireValue(!privateDownloadURL(u),'INGEST_SELFTEST_URL_GUARD');
 console.log(JSON.stringify({schema:'conectatech.alex.signature.private-ingest-selftest.v1',passed:true,synthetic:true,network_requests:0,private_sources_read:0}));
}

const mode=process.argv[2];
try{if(mode==='keygen')await keygen();else if(mode==='ingest')await ingest();else if(mode==='cleanup')await cleanup();else if(mode==='selftest')await selftest();else fail('INGEST_MODE_REQUIRED');}
catch(error){console.error(JSON.stringify({schema:'conectatech.alex.signature.private-ingest-error.v1',stage,code:/^[A-Z0-9_]{3,100}$/.test(error.safeCode||'')?error.safeCode:'INGEST_PRIVATE_TRANSFER_FAILED'}));process.exitCode=1;}
