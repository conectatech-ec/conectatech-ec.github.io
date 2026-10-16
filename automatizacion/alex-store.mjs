import baseline from './generated/catalogo.json' with {type:'json'};
import {generateAlex,policy,redact,quickReplies,fresh} from './alex.mjs';
import {refreshCatalog,verifyAssets} from './live.mjs';
import {seal,unseal} from './messenger-control.mjs';
const json=(x,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
export function alexInit(box){
 for(const q of [
  'CREATE TABLE IF NOT EXISTS alex_memory (who TEXT PRIMARY KEY, sealed TEXT, expires INTEGER)',
  'CREATE TABLE IF NOT EXISTS alex_inputs (job TEXT PRIMARY KEY, sealed TEXT, expires INTEGER)',
  'CREATE TABLE IF NOT EXISTS alex_opportunities (who TEXT PRIMARY KEY, sealed TEXT, expires INTEGER)',
  'CREATE TABLE IF NOT EXISTS alex_usage (day INTEGER PRIMARY KEY, reserved INTEGER, calls INTEGER)'
 ])box.sql.exec(q);
}
export function alexCleanup(box,now){for(const name of ['alex_memory','alex_inputs','alex_opportunities'])box.sql.exec('DELETE FROM '+name+' WHERE expires<=?',now);box.sql.exec('DELETE FROM alex_usage WHERE day<?',Math.floor(now/86400000)-1);}
export function alexNext(box){return Math.min(...['alex_memory','alex_inputs','alex_opportunities'].map(n=>box.sql.exec('SELECT MIN(expires) AS t FROM '+n).one().t||Infinity));}
export async function reserveAI(box){
 const ns=box.env.MESSENGER_TEST_INBOX;if(!ns)return false;
 const r=await ns.get(ns.idFromName('alex-ai-quota')).fetch('https://inbox/alex/quota',{method:'POST',body:'{}'});return r.ok&&(await r.json()).reserved===true;
}
export async function loadMemory(box,who){const row=box.sql.exec('SELECT sealed FROM alex_memory WHERE who=?',who).toArray()[0];if(!row)return {history:[],focus:[],shown:[]};try{return JSON.parse(await unseal(row.sealed,box.env.PILOT_TOKEN));}catch{return {history:[],focus:[],shown:[]};}}
export async function saveMemory(box,who,memory){const data=await seal(JSON.stringify(memory),box.env.PILOT_TOKEN);box.sql.exec('INSERT INTO alex_memory VALUES (?,?,?) ON CONFLICT(who) DO UPDATE SET sealed=excluded.sealed,expires=excluded.expires',who,data,Date.now()+policy.memory_idle_hours*3600000);}
export async function saveInput(box,key,text){const data=await seal(redact(text),box.env.PILOT_TOKEN);box.sql.exec('INSERT OR IGNORE INTO alex_inputs VALUES (?,?,?)',key,data,Date.now()+86400000);}
export async function prepareAlex(box,row,deps={refreshCatalog,verifyAssets}){
 const data=box.sql.exec('SELECT sealed FROM alex_inputs WHERE job=?',row.k).toArray()[0];if(!data)throw Error('ALEX_INPUT_EXPIRED');
 const input=await unseal(data.sealed,box.env.PILOT_TOKEN),memory=await loadMemory(box,row.who);
 let source;try{source=await deps.refreshCatalog(baseline);}catch{source={...baseline,fuente_fecha:null,productos:baseline.productos.map(p=>({...p,stock:0}))};}
 const result=await generateAlex(input,source,memory,box.env,()=>reserveAI(box));
 if(!result.image&&result.generative&&result.facts?.some(k=>k.startsWith(result.focus[0]+'.'))&&!(memory.shown||[]).includes(result.focus[0]))result.image=result.focus[0];
 if(result.action==='erase'){
  box.sql.exec('DELETE FROM alex_memory WHERE who=?',row.who);box.sql.exec('DELETE FROM seller_handoffs WHERE who=?',row.who);box.sql.exec('DELETE FROM alex_opportunities WHERE who=?',row.who);
  box.sql.exec("DELETE FROM alex_inputs WHERE job IN (SELECT k FROM seller_jobs WHERE who=?)",row.who);
  box.sql.exec("UPDATE seller_jobs SET sealed='' WHERE who=? AND status NOT IN ('queued','processing','sending')",row.who);
 }
 if(result.action==='interest'||result.action==='handoff'){
  const context={focus:result.memory.focus,stage:result.action==='interest'?'interes_pendiente':'derivacion_pendiente',budget:result.memory.budget,delivery:result.memory.delivery,sector:result.memory.sector,payment:result.memory.payment,history:result.memory.history};
  const encrypted=await seal(JSON.stringify(context),box.env.PILOT_TOKEN);box.sql.exec('INSERT INTO alex_opportunities VALUES (?,?,?) ON CONFLICT(who) DO UPDATE SET sealed=excluded.sealed,expires=excluded.expires',row.who,encrypted,Date.now()+7*86400000);
 }
 const messages=[{text:result.text,quick_replies:quickReplies(result)}];if(!messages[0].quick_replies.length)delete messages[0].quick_replies;
 const product=source.productos.find(p=>p.sku===result.image);
 const already=(memory.shown||[]).includes(result.image);
 if(product&&fresh(source)&&product.stock>0&&(!already||result.intent==='photo')){
  try{
   await deps.verifyAssets(product);const old=baseline.productos.find(p=>p.sku===product.sku);
   const image=product.banner&&product.promo===old.promo&&product.pvp===old.pvp&&product.stock===old.stock?product.banner:product.foto;
   messages.push({attachment:{type:'template',payload:{template_type:'generic',elements:[{title:product.nombre.slice(0,80),image_url:image,buttons:[{type:'web_url',title:'Ver ficha',url:product.url}]}]}}});
   result.memory.shown=[...new Set([...(memory.shown||[]),product.sku])];
  }catch{/* No unverified or changed image is sent. Text remains factual. */}
 }
 return {messages,result,source};
}
export async function alexFetch(path,req,box){
 const q=box.sql,now=Date.now();
 if(path==='/alex/quota'&&req.method==='POST'){
  if(box.name!=='alex-ai-quota')return json({error:'Quota scope'},409);
  const day=Math.floor(now/86400000),row=q.exec('SELECT reserved,calls FROM alex_usage WHERE day=?',day).toArray()[0];
  if((row?.reserved||0)+policy.neurons_reserved_per_call>policy.daily_neurons_reserved)return json({reserved:false});
  q.exec('INSERT INTO alex_usage VALUES (?,?,1) ON CONFLICT(day) DO UPDATE SET reserved=reserved+excluded.reserved,calls=calls+1',day,policy.neurons_reserved_per_call);return json({reserved:true});
 }
 if(path==='/alex/status'&&req.method==='GET')return json({name:'Alex, tu asesor de CONECTATECH',generative:box.env.ALEX_ENABLED==='true',model:policy.model,free_only:box.env.FREE_TIER_VERIFIED==='true',memory_hours:policy.memory_idle_hours,opportunities:q.exec('SELECT COUNT(*) AS n FROM alex_opportunities').one().n,live_customers_enabled:false});
 if(path==='/alex/handoffs'&&req.method==='GET'){
  const rows=q.exec('SELECT who,sealed,expires FROM alex_opportunities ORDER BY rowid DESC LIMIT 20').toArray();const contexts=[];
  for(const row of rows){try{contexts.push({reference:row.who,context:JSON.parse(await unseal(row.sealed,box.env.PILOT_TOKEN)),expires_at:new Date(row.expires).toISOString()});}catch{}}
  return json({opportunities:contexts,private:true});
 }
 if(path==='/alex/chat'&&req.method==='POST'){
  // Operator demonstration namespaces never enter Graph transport.
  if(!box.name.startsWith('alex-demo-'))return json({error:'Demo only'},409);
  const b=await req.json();if(typeof b.message!=='string'||b.message.length>1000)return json({error:'Invalid message'},400);
  if(b.reset===true){q.exec('DELETE FROM alex_memory');q.exec('DELETE FROM alex_opportunities');}
  let source;try{source=await refreshCatalog(baseline);}catch{source={...baseline,fuente_fecha:null,productos:baseline.productos.map(p=>({...p,stock:0}))};}
  const memory=await loadMemory(box,'demo');const result=await generateAlex(b.message,source,memory,box.env,()=>reserveAI(box));
  if(!result.image&&result.generative&&result.facts?.some(k=>k.startsWith(result.focus[0]+'.'))&&!(memory.shown||[]).includes(result.focus[0]))result.image=result.focus[0];
  if(result.action==='erase'){q.exec('DELETE FROM alex_memory');q.exec('DELETE FROM alex_opportunities');}else await saveMemory(box,'demo',result.memory);
  const p=source.productos.find(p=>p.sku===result.image);let image=null;
  if(p&&fresh(source)&&p.stock>0&&(!(memory.shown||[]).includes(p.sku)||result.intent==='photo')){try{await verifyAssets(p);const old=baseline.productos.find(x=>x.sku===p.sku);image=p.banner&&p.promo===old.promo&&p.pvp===old.pvp&&p.stock===old.stock?p.banner:p.foto;result.memory.shown=[...new Set([...(memory.shown||[]),p.sku])];await saveMemory(box,'demo',result.memory);}catch{}}
  if(Number.isFinite(alexNext(box)))await box.state.storage.setAlarm(alexNext(box));
  return json({name:'Alex',text:result.text,generative:result.generative,model:result.model||null,error_code:result.error_code||null,focus:result.focus,intent:result.intent,action:result.action,image,quick_replies:quickReplies(result),memory:{focus:result.memory.focus,budget:result.memory.budget,sector:result.memory.sector,payment:result.memory.payment,turns:result.memory.history?.length||0},source_fresh:fresh(source),outbound_enabled:false});
 }
 return null;
}
