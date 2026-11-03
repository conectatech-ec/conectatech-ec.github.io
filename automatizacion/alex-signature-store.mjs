// Exact approved PNGs live only in the existing private Durable Object, encrypted at rest.
// Public repository content contains approval metadata, never the PNG bytes or upload credentials.
import release from './alex-signature-release.json' with {type:'json'};
const NS='alex-private-signature',MAX=2000000;
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
function approved(manifest,sku){const p=manifest?.products?.[sku];return manifest?.schema==='conectatech.alex.signature.private.v1'&&manifest.scope==='private_simulator'&&manifest.owner_approved===true&&manifest.external_delivery_allowed===false&&p?.owner_approved===true&&p.approved_scope==='private_simulator'&&/^[a-f0-9]{64}$/.test(p.sha256||'')&&Number.isInteger(p.bytes_count)&&p.bytes_count>8&&p.bytes_count<=MAX?p:null;}
function init(box){box.sql.exec('CREATE TABLE IF NOT EXISTS alex_signature_assets (sku TEXT PRIMARY KEY, sha TEXT NOT NULL, iv BLOB NOT NULL, sealed BLOB NOT NULL, bytes INTEGER NOT NULL, uploaded INTEGER NOT NULL)');}
async function key(box){if(typeof box.env.PILOT_TOKEN!=='string'||box.env.PILOT_TOKEN.length<24)throw Error('PRIVATE_ASSET_KEY_REQUIRED');const material=new TextEncoder().encode(box.env.PILOT_TOKEN+'\nCONECTATECH/private/signature/v1');return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',material),'AES-GCM',false,['encrypt','decrypt']);}
const aad=(sku,digest)=>new TextEncoder().encode(NS+'|'+sku+'|'+digest);
async function readBounded(req){const reader=req.body?.getReader();if(!reader)throw Error('EMPTY_IMAGE');const parts=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX)throw Error('IMAGE_LIMIT');parts.push(value);}}catch(e){await reader.cancel().catch(()=>{});throw e;}const bytes=new Uint8Array(size);let at=0;for(const p of parts){bytes.set(p,at);at+=p.byteLength;}return bytes;}
function png(bytes){return bytes.length>24&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);}

export async function signatureAssetFetch(path,req,box,{manifest=release}={}){
 if(!path.startsWith('/alex/signature/'))return null;
 if(box.name!==NS)return json({error:'Private asset scope required'},403);
 init(box);
 if(path==='/alex/signature/status'&&req.method==='GET'){
  const products={};for(const sku of Object.keys(manifest.products||{})){const p=approved(manifest,sku);if(!p)continue;const r=box.sql.exec('SELECT sha,bytes FROM alex_signature_assets WHERE sku=?',sku).toArray()[0];products[sku]={sku,sha256:p.sha256,ready:r?.sha===p.sha256&&r?.bytes===p.bytes_count};}
  return json({scope:'private_simulator',external_delivery_allowed:false,products});
 }
 const upload=/^\/alex\/signature\/upload\/(TELF011|TELF012|REL046)$/.exec(path);
 const get=/^\/alex\/signature\/(TELF011|TELF012|REL046)\/([a-f0-9]{64})\.png$/.exec(path);
 const sku=upload?.[1]||get?.[1],p=approved(manifest,sku);
 if(!p)return json({error:'Approved private image not found'},404);
 if(upload&&req.method==='POST'){
  if((req.headers.get('Content-Type')||'').split(';')[0]!=='image/png')return json({error:'PNG required'},415);
  let bytes;try{bytes=await readBounded(req);}catch{return json({error:'Invalid image size'},413);}
  if(bytes.byteLength!==p.bytes_count||!png(bytes)||await sha(bytes)!==p.sha256)return json({error:'Approved image hash mismatch'},409);
  const iv=crypto.getRandomValues(new Uint8Array(12)),sealed=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(sku,p.sha256)},await key(box),bytes);
  box.sql.exec('INSERT INTO alex_signature_assets VALUES (?,?,?,?,?,?) ON CONFLICT(sku) DO UPDATE SET sha=excluded.sha,iv=excluded.iv,sealed=excluded.sealed,bytes=excluded.bytes,uploaded=excluded.uploaded',sku,p.sha256,iv.buffer,sealed,bytes.byteLength,Date.now());
  return json({ok:true,sku,sha256:p.sha256,bytes_count:bytes.byteLength,scope:'private_simulator',private:true,upload_verified:true,external_delivery_allowed:false});
 }
 if(get&&req.method==='GET'){
  if(get[2]!==p.sha256)return json({error:'Approved image not found'},404);
  const r=box.sql.exec('SELECT sha,iv,sealed,bytes FROM alex_signature_assets WHERE sku=?',sku).toArray()[0];
  if(!r||r.sha!==p.sha256||r.bytes!==p.bytes_count)return json({error:'Private image pending upload'},404);
  let bytes;try{bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(r.iv),additionalData:aad(sku,r.sha)},await key(box),new Uint8Array(r.sealed));}catch{return json({error:'Private image unavailable'},503);}
  if(bytes.byteLength!==p.bytes_count||await sha(bytes)!==p.sha256)return json({error:'Private image unavailable'},503);
  return new Response(bytes,{headers:{'Content-Type':'image/png','Content-Length':String(bytes.byteLength),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'X-Alex-Asset-Scope':'private_simulator','X-Alex-Asset-Sha256':p.sha256}});
 }
 return json({error:'Method not allowed'},405);
}

export async function privateSignatureReady(box,{sku,sha256}){
 const binding=box.env.MESSENGER_TEST_INBOX;if(!binding)return false;
 try{const stub=binding.get(binding.idFromName(NS)),r=await stub.fetch('https://inbox/alex/signature/status');if(!r.ok)return false;const d=await r.json(),p=d.products?.[sku];return d.scope==='private_simulator'&&d.external_delivery_allowed===false&&p?.ready===true&&p.sha256===sha256?{ready:true,sku,sha256}:false;}catch{return false;}
}
