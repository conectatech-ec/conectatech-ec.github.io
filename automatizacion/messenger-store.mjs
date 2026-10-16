import catalog from './generated/catalogo.json' with {type:'json'};
import {answer} from './commerce.mjs';
import {alexInit,alexCleanup,alexNext,alexFetch} from './alex-store.mjs';
import {sellerInit,sellerCleanup,sellerFetch,sellerAlarm,sellerNext,sellerActive} from './messenger-seller.mjs';
import {refreshCatalog,verifyAssets} from './live.mjs';
import {controlInit,controlCleanup,controlNextAlarm,controlFetch} from './messenger-control.mjs';
const json=(x,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
async function digest(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function commercialDraft(response) {
 if(response.error) throw Error('SOURCE_INVALID');
 if(!response.disponible) return {sku:response.sku,text:response.text,send_enabled:false};
 const messages=[{text:response.text},{attachment:{type:'image',payload:{url:response.foto,is_reusable:false}}}];
 if(response.banner)messages.push({attachment:{type:'image',payload:{url:response.banner,is_reusable:false}}});
 messages.push({attachment:{type:'template',payload:{template_type:'generic',elements:[{title:'CONECTATECH · '+response.sku,subtitle:`Promo contado $${response.precio.toFixed(2)} · Stock referencial ${response.stock_referencial}`,image_url:response.foto,buttons:[{type:'web_url',title:'Ver ficha',url:response.url}]}]}}});
 return {sku:response.sku,send_enabled:false,precio:response.precio,stock_referencial:response.stock_referencial,fuente_fecha:response.fuente_fecha,foto:response.foto,banner:response.banner,messages};
}
export class MessengerTestInbox {
 constructor(state,env) {
  this.state=state;this.env=env;this.sql=state.storage.sql;this.name=state.id?.name||'unknown';
  this.sql.exec('CREATE TABLE IF NOT EXISTS events (k TEXT PRIMARY KEY, day INTEGER, status TEXT, skus TEXT, result TEXT, attempts INTEGER, next_at INTEGER, expires INTEGER, error TEXT)');
  this.sql.exec('CREATE INDEX IF NOT EXISTS events_expiry ON events(expires)');
  this.sql.exec('CREATE INDEX IF NOT EXISTS events_pending ON events(status,next_at)');
  this.sql.exec('CREATE INDEX IF NOT EXISTS events_day ON events(day)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS reviews (k TEXT PRIMARY KEY, decision TEXT, digest TEXT, reviewed_at INTEGER)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS counters (day INTEGER PRIMARY KEY, duplicates INTEGER NOT NULL DEFAULT 0)');
  controlInit(this);sellerInit(this);alexInit(this);
 }
 cleanup(now){this.sql.exec('DELETE FROM events WHERE expires <= ?',now);this.sql.exec('DELETE FROM reviews WHERE k NOT IN (SELECT k FROM events)');this.sql.exec('DELETE FROM counters WHERE day < ?',Math.floor(now/86400000)-6);controlCleanup(this,now);sellerCleanup(this,now);alexCleanup(this,now);}
 async fetch(req) {
  const path=new URL(req.url).pathname;
  this.cleanup(Date.now());
  const alex=await alexFetch(path,req,this);if(alex)return alex;
  const seller=await sellerFetch(path,req,this);if(seller)return seller;
  const control=await controlFetch(path,req,this);if(control)return control;
  if(path==='/results') {
   const rows=this.sql.exec('SELECT e.k AS event_ref,e.status,e.skus,e.result,e.attempts,e.error,r.decision,r.reviewed_at FROM events e LEFT JOIN reviews r ON r.k=e.k ORDER BY e.rowid DESC LIMIT 30').toArray();
   return json({mode:'development-only',outbound_enabled:false,events:await Promise.all(rows.map(async r=>({...r,decision:r.decision||'pendiente',result_digest:r.result?await digest(r.result):null,skus:JSON.parse(r.skus),result:r.result?JSON.parse(r.result):null})))});
  }
  if(path==='/metrics'&&req.method==='GET') {
   const daily=this.sql.exec("SELECT day,COUNT(*) AS consultas,SUM(status='prepared') AS borradores_preparados,SUM(status='queued') AS pendientes,SUM(status='failed') AS fallidos,SUM(skus!='[]') AS consultas_con_sku,SUM(attempts) AS reintentos FROM events GROUP BY day ORDER BY day DESC").toArray();
   const duplicates=this.sql.exec('SELECT day,duplicates FROM counters').toArray();
   const reviews=this.sql.exec('SELECT decision,COUNT(*) AS n FROM reviews GROUP BY decision').toArray();
   const sent=this.sql.exec("SELECT COUNT(*) AS n FROM seller_parts WHERE state='accepted'").one().n;
   const delivered=this.sql.exec("SELECT COUNT(*) AS n FROM seller_parts WHERE state='accepted' AND delivered=1").one().n;
   const seller=this.sql.exec('SELECT status,COUNT(*) AS n FROM seller_jobs GROUP BY status').toArray();
   return json({retention_days:7,mode:'development-only',outbound_enabled:sellerActive(this),messages_sent:sent,messages_delivered:delivered,seller,confirmed_orders:0,opportunity_definition:'consultas_con_sku cuenta interés en SKU; no equivale a ventas ni clientes únicos',daily:daily.map(r=>({...r,duplicates:duplicates.find(d=>d.day===r.day)?.duplicates||0})),reviews});
  }
  if(path==='/review'&&req.method==='POST') {
   const b=await req.json();
   if(!/^[a-f0-9]{64}$/.test(b.event_ref||'')||!['aprobado','rechazado'].includes(b.decision)||!/^[a-f0-9]{64}$/.test(b.result_digest||''))return json({error:'Invalid review'},400);
   const row=this.sql.exec('SELECT status,result FROM events WHERE k = ?',b.event_ref).toArray()[0];
   if(!row||row.status!=='prepared'||await digest(row.result)!==b.result_digest)return json({error:'Draft unavailable or changed; review again'},409);
   this.sql.exec('INSERT INTO reviews VALUES (?,?,?,?) ON CONFLICT(k) DO UPDATE SET decision=excluded.decision,digest=excluded.digest,reviewed_at=excluded.reviewed_at',b.event_ref,b.decision,b.result_digest,Date.now());
   return json({event_ref:b.event_ref,decision:b.decision,send_enabled:false,notice:'Revisión registrada. No se ha enviado ningún mensaje.'});
  }
  if(path!=='/accept'||req.method!=='POST')return json({error:'Not found'},404);
  const b=await req.json();if(!/^[a-f0-9]{64}$/.test(b.key)||!Array.isArray(b.skus)||b.skus.some(s=>!['MICR27','POWE003','ADAP005'].includes(s)))return json({error:'Bad fixture'},400);
  const now=Date.now();
  const existing=this.sql.exec('SELECT status FROM events WHERE k = ?',b.key).toArray()[0];
  if(existing){this.sql.exec('INSERT INTO counters(day,duplicates) VALUES (?,1) ON CONFLICT(day) DO UPDATE SET duplicates=duplicates+1',Math.floor(now/86400000));if(existing.status==='queued')await this.state.storage.setAlarm(now+100);return json({duplicate:true});}
  const day=Math.floor(now/86400000);
  const count=this.sql.exec('SELECT COUNT(*) AS n FROM events WHERE day = ?',day).one().n;
  if(count>=100)return json({error:'Daily test limit'},429);
  this.sql.exec('INSERT INTO events VALUES (?, ?, ?, ?, NULL, 0, ?, ?, NULL)',b.key,day,'queued',JSON.stringify([...new Set(b.skus)]),now,now+7*86400000);
  await this.state.storage.setAlarm(now+100);
  return json({queued:true,duplicate:false});
 }
 async alarm() {
  const now=Date.now();this.cleanup(now);
  await sellerAlarm(this);
  const rows=this.sql.exec("SELECT k,skus,attempts FROM events WHERE status = 'queued' AND next_at <= ? ORDER BY rowid LIMIT 3",now).toArray();
  for(const row of rows) {
   try {
    const skus=JSON.parse(row.skus);const drafts=[];
    if(skus.length) {
     const source=await refreshCatalog(catalog);
     for(const sku of skus) {
      const response=answer(sku,'precio disponibilidad envío y opciones de compra',Date.now(),source);
      if(!response.error&&response.disponible)await verifyAssets(source.productos.find(p=>p.sku===sku));
      drafts.push(commercialDraft(response));
     }
    } else drafts.push({send_enabled:false,text:'Indica MICR27, POWE003 o ADAP005 para consultar el piloto.'});
    this.sql.exec("UPDATE events SET status = 'prepared', result = ?, error = NULL WHERE k = ?",JSON.stringify(drafts),row.k);
   } catch {
    const attempt=row.attempts+1;
    this.sql.exec('UPDATE events SET status = ?, attempts = ?, next_at = ?, error = ? WHERE k = ?',attempt>=3?'failed':'queued',attempt,Date.now()+1000*2**attempt,'SOURCE_OR_MEDIA_FAILED',row.k);
    console.error(JSON.stringify({event:'messenger_test_processing_failed',code:'SOURCE_OR_MEDIA_FAILED',attempt}));
   }
  }
  const next=this.sql.exec("SELECT MIN(next_at) AS t FROM events WHERE status = 'queued'").one().t;
  const expiry=this.sql.exec('SELECT MIN(expires) AS t FROM events').one().t;
  const controlExpiry=Math.min(controlNextAlarm(this),sellerNext(this),alexNext(this));
  if(next||expiry||Number.isFinite(controlExpiry))await this.state.storage.setAlarm(Math.max(Date.now()+200,Math.min(next||Infinity,expiry||Infinity,controlExpiry)));
 }
}
