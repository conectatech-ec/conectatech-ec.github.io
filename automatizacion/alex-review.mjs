import {seal,unseal} from './messenger-control.mjs';
import {alexBaseline as baseline,quoteCurrent} from './alex-catalog.mjs';
const json=(x,s=200)=>Response.json(x,{status:s,headers:{'Cache-Control':'no-store'}});
export const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(n=>n.toString(16).padStart(2,'0')).join('');
export function reviewInit(box){
 box.sql.exec('CREATE TABLE IF NOT EXISTS alex_review_policy(id INTEGER PRIMARY KEY CHECK(id=1), required INTEGER)');
 box.sql.exec('CREATE TABLE IF NOT EXISTS alex_reviews(job TEXT PRIMARY KEY,sealed TEXT,digest TEXT,expires INTEGER,decision TEXT)');
}
export const reviewRequired=box=>box.sql.exec('SELECT required FROM alex_review_policy WHERE id=1').toArray()[0]?.required===1;
export function reviewCleanup(box,now){
 const rows=box.sql.exec("SELECT job FROM alex_reviews WHERE decision IN ('pending','approved') AND expires<=?",now).toArray();
 for(const r of rows){box.sql.exec("UPDATE alex_reviews SET sealed='',decision='expired' WHERE job=?",r.job);box.sql.exec("UPDATE seller_jobs SET status='review_expired',sealed='',error='REVIEW_EXPIRED' WHERE k=? AND status IN ('awaiting_review','queued')",r.job);box.sql.exec('DELETE FROM alex_inputs WHERE job=?',r.job);}
 box.sql.exec('DELETE FROM alex_reviews WHERE job NOT IN(SELECT k FROM seller_jobs)');
}
export function reviewNext(box){return box.sql.exec("SELECT MIN(expires) AS t FROM alex_reviews WHERE decision IN ('pending','approved')").one().t||Infinity;}
export async function stageReview(box,row,prepared){
 if(['erase','handoff'].includes(prepared.result.action))return false;
 const previous=box.sql.exec('SELECT decision FROM alex_reviews WHERE job=?',row.k).toArray()[0];
 if(!reviewRequired(box)&&previous?.decision!=='regenerate')return false;
 const payload={messages:prepared.messages,result:prepared.result,source:prepared.source};
 const [sealed,hash]=await Promise.all([seal(JSON.stringify(payload),box.env.PILOT_TOKEN),digest(payload)]);
 if(box.sql.exec('SELECT enabled FROM seller_settings WHERE id=1').toArray()[0]?.enabled!==1){box.sql.exec("UPDATE seller_jobs SET status='paused',error='OPERATOR_STOP' WHERE k=?",row.k);return true;}
 const expires=Math.min(Date.now()+15*60000,row.inbound+86400000);
 box.sql.exec("INSERT INTO alex_reviews VALUES(?,?,?,?,'pending') ON CONFLICT(job) DO UPDATE SET sealed=excluded.sealed,digest=excluded.digest,expires=excluded.expires,decision='pending'",row.k,sealed,hash,expires);
 box.sql.exec("UPDATE seller_jobs SET status='awaiting_review' WHERE k=?",row.k);return true;
}
export async function approvedDraft(box,row,deps){
 const stored=box.sql.exec('SELECT * FROM alex_reviews WHERE job=?',row.k).toArray()[0];if(!stored||stored.decision!=='approved')return null;
 if(stored.expires<=Date.now()||Date.now()-row.inbound>=86400000)throw Error('REVIEW_EXPIRED');
 const payload=JSON.parse(await unseal(stored.sealed,box.env.PILOT_TOKEN));if(await digest(payload)!==stored.digest)throw Error('REVIEW_CHANGED');
 const source=await deps.refreshCatalog(payload.source);
 if(payload.result.facts?.some(k=>/\.(?:cash|card|pvp)$/.test(k))&&payload.result.focus.some(s=>!quoteCurrent(source,source.productos.find(p=>p.sku===s))))throw Error('REVIEW_SOURCE_STALE');
 for(const sku of payload.result.focus||[]){
  const old=payload.source.productos.find(p=>p.sku===sku),current=source.productos.find(p=>p.sku===sku);
  if(!old||!current||['nombre','promo','pvp','stock','url','foto','banner','foto_sha256','banner_sha256'].some(k=>old[k]!==current[k]))throw Error('REVIEW_SOURCE_CHANGED');
  const image=payload.messages.some(m=>m.attachment?.payload?.elements?.[0]?.image_url===old.banner)?current:{...current,banner:null};
  if(payload.messages.some(m=>m.attachment))await deps.verifyAssets(image);
 }
 // Recheck after network awaits: a rejected or stopped draft cannot resume.
 const now=box.sql.exec('SELECT decision,expires FROM alex_reviews WHERE job=?',row.k).toArray()[0];
 if(now?.decision!=='approved'||now.expires<=Date.now())throw Error('REVIEW_NO_LONGER_APPROVED');
 return {...payload,source};
}
export function invalidateReview(box,key,code){
 box.sql.exec("UPDATE alex_reviews SET sealed='',decision='invalidated' WHERE job=?",key);
 box.sql.exec("UPDATE seller_jobs SET status='review_invalidated',error=? WHERE k=?",code,key);
}
export function cancelConversationReviews(box,who){
 const rows=box.sql.exec("SELECT r.job FROM alex_reviews r JOIN seller_jobs j ON j.k=r.job WHERE j.who=? AND r.decision IN ('pending','approved','regenerate','invalidated')",who).toArray();
 for(const row of rows){box.sql.exec("UPDATE alex_reviews SET sealed='',decision='revoked' WHERE job=?",row.job);box.sql.exec("UPDATE seller_jobs SET status='review_revoked',sealed='',error='CONVERSATION_CONTROL' WHERE k=? AND status IN ('queued','awaiting_review','review_invalidated')",row.job);box.sql.exec('DELETE FROM alex_inputs WHERE job=?',row.job);}
}
export async function reviewFetch(path,req,box){
 const q=box.sql;
 if(path==='/alex/review/queue'&&req.method==='GET'){
  const rows=q.exec('SELECT r.*,j.inbound,j.status,j.error FROM alex_reviews r JOIN seller_jobs j ON j.k=r.job ORDER BY j.rowid DESC LIMIT 20').toArray(),drafts=[];
  for(const row of rows){let p=null;if(row.sealed&&row.decision==='pending')try{p=JSON.parse(await unseal(row.sealed,box.env.PILOT_TOKEN));}catch{}
   drafts.push({job:row.job,digest:row.digest,status:row.status,decision:row.decision,error:row.error,expires_at:new Date(row.expires).toISOString(),incoming_at:new Date(row.inbound).toISOString(),messages:p?.messages||[],context:p?.result.memory.history?.slice(-6)||[],generative:p?.result.generative===true});
  }
  return json({required:reviewRequired(box),drafts,scope:'authorized-testers-only',live_customers_enabled:false});
 }
 if(!['/alex/review/mode','/alex/review/decision','/alex/review/regenerate'].includes(path)||req.method!=='POST')return null;
 if(box.name!=='messenger-development'||box.env.META_MODE!=='development-only')return json({error:'Only authorized tester review is supported'},409);
 const b=await req.json();
 if(path==='/alex/review/mode'){
  if(typeof b.required!=='boolean')return json({error:'Boolean required'},400);
  q.exec('INSERT INTO alex_review_policy VALUES(1,?) ON CONFLICT(id) DO UPDATE SET required=excluded.required',b.required?1:0);
  return json({required:b.required,waiting_drafts_auto_approved:false,live_customers_enabled:false});
 }
 if(!/^[a-f0-9]{64}$/.test(b.job||''))return json({error:'Invalid reference'},400);
 const row=q.exec('SELECT * FROM alex_reviews WHERE job=?',b.job).toArray()[0],job=q.exec('SELECT status,inbound FROM seller_jobs WHERE k=?',b.job).toArray()[0];
 if(!row||!job)return json({error:'Unavailable draft'},404);
 if(path==='/alex/review/regenerate'){
  if(q.exec('SELECT job FROM seller_parts WHERE job=? LIMIT 1',b.job).toArray()[0])return json({error:'Partial or uncertain sends require a new user inquiry'},409);
  if(!['invalidated','expired'].includes(row.decision)||!q.exec('SELECT job FROM alex_inputs WHERE job=?',b.job).toArray()[0]||Date.now()-job.inbound>=86400000)return json({error:'A new user inquiry is required'},409);
  if(q.exec('SELECT enabled FROM seller_settings WHERE id=1').toArray()[0]?.enabled!==1)return json({error:'Operator stop'},409);
  q.exec("UPDATE alex_reviews SET decision='regenerate',sealed='',digest='' WHERE job=?",b.job);q.exec("UPDATE seller_jobs SET status='queued',error=NULL WHERE k=?",b.job);await box.state.storage.setAlarm(Date.now()+200);return json({queued_for_new_review:true});
 }
 if(!['approve','reject'].includes(b.decision)||b.digest!==row.digest||row.decision!=='pending'||job.status!=='awaiting_review'||row.expires<=Date.now())return json({error:'Draft changed or expired; refresh'},409);
 if(b.decision==='reject'){
  q.exec("UPDATE alex_reviews SET decision='rejected',sealed='' WHERE job=?",b.job);q.exec("UPDATE seller_jobs SET status='review_rejected',sealed='',error='REVIEW_REJECTED' WHERE k=?",b.job);q.exec('DELETE FROM alex_inputs WHERE job=?',b.job);await box.state.storage.setAlarm(Date.now()+200);return json({rejected:true,messages_sent:0});
 }
 if(q.exec('SELECT enabled FROM seller_settings WHERE id=1').toArray()[0]?.enabled!==1||Date.now()-job.inbound>=86400000)return json({error:'Stopped or outside messaging window'},409);
 q.exec("UPDATE alex_reviews SET decision='approved' WHERE job=?",b.job);q.exec("UPDATE seller_jobs SET status='queued' WHERE k=?",b.job);await box.state.storage.setAlarm(Date.now()+200);return json({approved:true,send_status:'pending_validation_not_sent_yet'});
}
export function reviewPage(){
 const nonce=crypto.randomUUID();
 return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aprobaciones · Alex · CONECTATECH</title><style>body{font:16px system-ui;background:#edf4f2;color:#163d34}main{max-width:850px;margin:30px auto;padding:18px}section{background:white;border-radius:12px;padding:18px;margin:15px 0}button,input{font:inherit;padding:10px;margin:5px}button{cursor:pointer}img{max-width:280px}pre{white-space:pre-wrap}small{display:block}</style><main><h1>Aprobaciones de Alex</h1><p>Panel privado. Solo probadores autorizados; compradores externos bloqueados.</p><input id="key" type="password" autocomplete="off" placeholder="Clave privada del piloto"><button id="connect">Conectar</button><button id="close">Cerrar</button><button id="refresh">Actualizar</button><section><label><input id="required" type="checkbox"> Requerir aprobación humana de las próximas respuestas comerciales</label><button id="mode">Guardar modo</button><p>Desactivar este modo no aprueba borradores pendientes. La parada global sigue en /messenger/setup. Caducidad: quince minutos y siempre dentro de la ventana de Messenger.</p></section><p id="status" role="status"></p><div id="drafts"></div></main><script nonce="${nonce}">
let key='',timer;const el=id=>document.getElementById(id);function close(){key='';el('key').value='';el('drafts').replaceChildren();clearTimeout(timer);el('status').textContent='Sesión cerrada.';}async function api(path,body){if(!key)throw Error('Conecta primero.');const r=await fetch('/alex/review/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo completar la operación.');return d;}function button(parent,label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=()=>fn().catch(e=>el('status').textContent=e.message);parent.append(b);}async function refresh(){const a=await api('queue');el('required').checked=a.required;el('drafts').replaceChildren();for(const d of a.drafts){const card=document.createElement('section'),title=document.createElement('h2');title.textContent=d.status;card.append(title);for(const t of d.context||[]){const p=document.createElement('p');p.textContent=(t.role==='user'?'Consulta: ':'Alex: ')+t.text;card.append(p);}for(const m of d.messages){if(m.text){const p=document.createElement('pre');p.textContent=m.text;card.append(p);}const src=m.attachment?.payload?.elements?.[0]?.image_url;if(src&&src.startsWith('https://conectatech-ec.github.io/imagenes/')){const i=document.createElement('img');i.src=src;i.alt='Imagen aprobada del producto';card.append(i);}}const small=document.createElement('small');small.textContent='Caduca: '+new Date(d.expires_at).toLocaleString('es-EC',{timeZone:'America/Guayaquil'})+' · '+(d.error||d.decision);card.append(small);if(d.decision==='pending'){for(const [label,decision]of [['Aprobar envío','approve'],['Rechazar','reject']])button(card,label,async()=>{await api('decision',{job:d.job,digest:d.digest,decision});el('status').textContent=decision==='approve'?'Aprobado; el envío queda sujeto a validación. Actualiza para comprobar su estado.':'Rechazado, sin envío.';await refresh();});}if(d.decision==='invalidated')button(card,'Generar nuevo borrador',async()=>{await api('regenerate',{job:d.job});el('status').textContent='Se preparará otro borrador; requiere nueva aprobación.';await refresh();});el('drafts').append(card);}if(!a.drafts.length)el('status').textContent='No hay borradores.';}
el('connect').onclick=()=>{key=el('key').value;el('key').value='';clearTimeout(timer);timer=setTimeout(close,600000);refresh().catch(e=>el('status').textContent=e.message);};el('close').onclick=close;el('refresh').onclick=()=>refresh().catch(e=>el('status').textContent=e.message);el('mode').onclick=()=>api('mode',{required:el('required').checked}).then(()=>{el('status').textContent='Modo guardado; no cambia permisos de Meta ni habilita clientes externos.';}).catch(e=>el('status').textContent=e.message);window.addEventListener('pagehide',close);
</script></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':`default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; img-src https://conectatech-ec.github.io; frame-ancestors 'none'; base-uri 'none'`}});
}
