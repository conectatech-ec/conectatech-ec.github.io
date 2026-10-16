import catalog from './generated/catalogo.json' with {type:'json'};
import {answer} from './commerce.mjs';
import {refreshCatalog,verifyAssets} from './live.mjs';
const json=(x,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
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
  this.state=state;this.env=env;this.sql=state.storage.sql;
  this.sql.exec('CREATE TABLE IF NOT EXISTS events (k TEXT PRIMARY KEY, day INTEGER, status TEXT, skus TEXT, result TEXT, attempts INTEGER, next_at INTEGER, expires INTEGER, error TEXT)');
  this.sql.exec('CREATE INDEX IF NOT EXISTS events_expiry ON events(expires)');
  this.sql.exec('CREATE INDEX IF NOT EXISTS events_pending ON events(status,next_at)');
  this.sql.exec('CREATE INDEX IF NOT EXISTS events_day ON events(day)');
 }
 async fetch(req) {
  const path=new URL(req.url).pathname;
  if(path==='/results') {
   const rows=this.sql.exec('SELECT k AS event_ref,status,skus,result,attempts,error FROM events ORDER BY rowid DESC LIMIT 30').toArray();
   return json({mode:'development-only',outbound_enabled:false,events:rows.map(r=>({...r,skus:JSON.parse(r.skus),result:r.result?JSON.parse(r.result):null}))});
  }
  if(path!=='/accept'||req.method!=='POST')return json({error:'Not found'},404);
  const b=await req.json();if(!/^[a-f0-9]{64}$/.test(b.key)||!Array.isArray(b.skus)||b.skus.some(s=>!['MICR27','POWE003','ADAP005'].includes(s)))return json({error:'Bad fixture'},400);
  const now=Date.now();this.sql.exec('DELETE FROM events WHERE expires <= ?',now);
  const existing=this.sql.exec('SELECT status FROM events WHERE k = ?',b.key).toArray()[0];
  if(existing){if(existing.status==='queued')await this.state.storage.setAlarm(now+100);return json({duplicate:true});}
  const day=Math.floor(now/86400000);
  const count=this.sql.exec('SELECT COUNT(*) AS n FROM events WHERE day = ?',day).one().n;
  if(count>=100)return json({error:'Daily test limit'},429);
  this.sql.exec('INSERT INTO events VALUES (?, ?, ?, ?, NULL, 0, ?, ?, NULL)',b.key,day,'queued',JSON.stringify([...new Set(b.skus)]),now,now+7*86400000);
  await this.state.storage.setAlarm(now+100);
  return json({queued:true,duplicate:false});
 }
 async alarm() {
  const now=Date.now();this.sql.exec('DELETE FROM events WHERE expires <= ?',now);
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
  if(next||expiry)await this.state.storage.setAlarm(Math.max(Date.now()+200,Math.min(next||Infinity,expiry||Infinity)));
 }
}
