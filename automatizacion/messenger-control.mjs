// Private diagnostics and one-use tester enrollment. No outbound messaging.
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
const hex=bytes=>[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');
export async function pairingHash(code,secret){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('tester-pairing:'+code))));
}
async function cipherKey(secret){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode('conectatech:tester-psid:'+secret)),'AES-GCM',false,['encrypt','decrypt']);}
export async function seal(psid,secret){
 const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},await cipherKey(secret),new TextEncoder().encode(psid));
 return JSON.stringify({iv:[...iv],cipher:[...new Uint8Array(bytes)]});
}
export async function unseal(raw,secret){const x=JSON.parse(raw);return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(x.iv)},await cipherKey(secret),new Uint8Array(x.cipher)));}
export function controlInit(box){
 box.sql.exec('CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, at INTEGER, data TEXT, expires INTEGER)');
 box.sql.exec('CREATE TABLE IF NOT EXISTS pairing (id INTEGER PRIMARY KEY CHECK(id=1), code_hash TEXT, expires INTEGER, sealed TEXT)');
 box.sql.exec('CREATE TABLE IF NOT EXISTS pairing_rate (day INTEGER PRIMARY KEY, n INTEGER)');
 box.sql.exec('CREATE TABLE IF NOT EXISTS receipt_rate (day INTEGER PRIMARY KEY, n INTEGER)');
}
export function controlCleanup(box,now){
 box.sql.exec('DELETE FROM receipts WHERE expires <= ?',now);box.sql.exec('DELETE FROM pairing WHERE expires <= ?',now);box.sql.exec('DELETE FROM pairing_rate WHERE day < ?',Math.floor(now/86400000));
 box.sql.exec('DELETE FROM receipt_rate WHERE day < ?',Math.floor(now/86400000));
}
export function controlNextAlarm(box){
 const a=box.sql.exec('SELECT MIN(expires) AS t FROM receipts').one().t,b=box.sql.exec('SELECT MIN(expires) AS t FROM pairing').one().t;
 return Math.min(a||Infinity,b||Infinity);
}
async function schedule(box){const pending=box.sql.exec("SELECT MIN(next_at) AS t FROM events WHERE status='queued'").one().t,expiry=box.sql.exec('SELECT MIN(expires) AS t FROM events').one().t;const at=Math.min(pending??Infinity,expiry??Infinity,controlNextAlarm(box));if(Number.isFinite(at))await box.state.storage.setAlarm(Math.max(Date.now()+100,at));}
export async function controlFetch(path,req,box){
 const sql=box.sql,now=Date.now();
 if(path==='/receipts'&&req.method==='GET')return json({scope:'worker_webhook_receipts',outbound_enabled:false,receipts:sql.exec('SELECT data FROM receipts ORDER BY at DESC LIMIT 50').toArray().map(r=>JSON.parse(r.data))});
 if(path==='/receipt'&&req.method==='POST'){
  const b=await req.json();
  const reasons=['ingress_disabled','pairing_claimed','pairing_phrase_format','pairing_recipient_mismatch','pairing_timestamp_rejected','pairing_not_current','pairing_standby_ignored','pairing_echo_ignored','pairing_no_user_text','ignored_object','invalid_json','event_limit','allowlist_missing','storage_unavailable','processed','not_configured','invalid_body','invalid_signature'];
  if(!reasons.includes(b.reason)||![true,false,null].includes(b.signature_valid)||![200,400,403,413,503].includes(b.http_status)||!['external_https','authorized_ci_probe','synthetic_ci'].includes(b.source))return json({error:'Invalid receipt'},400);
  if(b.signature_valid!==true){
   const day=Math.floor(now/86400000),count=sql.exec('SELECT n FROM receipt_rate WHERE day=?',day).toArray()[0]?.n||0;
   if(count>=100)return json({recorded:false,capped:true});
   sql.exec('INSERT INTO receipt_rate VALUES (?,1) ON CONFLICT(day) DO UPDATE SET n=n+1',day);
  }
  // Rebuild the envelope explicitly: discard all unrecognized fields.
  const data={id:crypto.randomUUID(),at:new Date(now).toISOString(),method:'POST',path:'/webhooks/meta',signature_valid:b.signature_valid,http_status:b.http_status,reason:b.reason,page_matches:b.page_matches===true,source:b.source,reception_enabled:b.reception_enabled===true,outbound_enabled:b.outbound_enabled===true};
  sql.exec('INSERT INTO receipts VALUES (?,?,?,?)',data.id,now,JSON.stringify(data),now+7*86400000);
  sql.exec("DELETE FROM receipts WHERE json_extract(data,'$.signature_valid')=1 AND id NOT IN (SELECT id FROM receipts WHERE json_extract(data,'$.signature_valid')=1 ORDER BY at DESC,rowid DESC LIMIT 50)");
  sql.exec("DELETE FROM receipts WHERE COALESCE(json_extract(data,'$.signature_valid'),0)=0 AND id NOT IN (SELECT id FROM receipts WHERE COALESCE(json_extract(data,'$.signature_valid'),0)=0 ORDER BY at DESC,rowid DESC LIMIT 10)");
  await schedule(box);return json({recorded:true,id:data.id});
 }
 if(!path.startsWith('/pairing/'))return null;
 if(box.env.META_MODE!=='development-only'||box.env.META_INGRESS_ENABLED!=='false'||!box.env.PILOT_TOKEN)return json({error:'Enrollment requires closed development-only pilot'},503);
 if(path==='/pairing/start'&&req.method==='POST'){
  const b=await req.json();if(b.confirmed_tester!==true)return json({error:'Authorized app tester confirmation required'},400);
  const day=Math.floor(now/86400000),count=sql.exec('SELECT n FROM pairing_rate WHERE day=?',day).toArray()[0]?.n||0;
  if(count>=25)return json({error:'Daily enrollment limit'},429);
  sql.exec('INSERT INTO pairing_rate VALUES (?,1) ON CONFLICT(day) DO UPDATE SET n=n+1',day);
  const code=hex(crypto.getRandomValues(new Uint8Array(16))),expires=now+600000,hash=await pairingHash(code,box.env.PILOT_TOKEN);
  sql.exec('INSERT INTO pairing VALUES (1,?,?,NULL) ON CONFLICT(id) DO UPDATE SET code_hash=excluded.code_hash,expires=excluded.expires,sealed=NULL',hash,expires);
  await schedule(box);
  return json({phrase:'CONECTATECH-PRUEBA '+code,expires_at:new Date(expires).toISOString(),outbound_enabled:false});
 }
 const row=sql.exec('SELECT code_hash,expires,sealed FROM pairing WHERE id=1').toArray()[0];
 if(path==='/pairing/status'&&req.method==='GET')return json({pending:!!row&&!row.sealed,claimed:!!row?.sealed,expires_at:row?new Date(row.expires).toISOString():null});
 if(path==='/pairing/cancel'&&req.method==='POST'){sql.exec('DELETE FROM pairing');return json({cancelled:true});}
 if(path==='/pairing/claim'&&req.method==='POST'){
  const b=await req.json();if(!row||row.sealed||b.code_hash!==row.code_hash||!/^\d{1,32}$/.test(b.psid||''))return json({claimed:false});
  const sealed=await seal(b.psid,box.env.PILOT_TOKEN);
  sql.exec('UPDATE pairing SET sealed=? WHERE id=1 AND code_hash=? AND sealed IS NULL AND expires>?',sealed,b.code_hash,Date.now());
  return json({claimed:sql.exec('SELECT sealed FROM pairing WHERE id=1').toArray()[0]?.sealed===sealed});
 }
 if(path==='/pairing/consume'&&req.method==='POST'){
  if(!row?.sealed)return json({error:'No enrolled tester available'},409);
  sql.exec('DELETE FROM pairing');
  return json({psid:await unseal(row.sealed,box.env.PILOT_TOKEN),one_use:true,notice:'Guarda este PSID en META_TEST_SENDER_IDS del environment GitHub; no lo compartas en el chat.'});
 }
 return json({error:'Not found'},404);
}
