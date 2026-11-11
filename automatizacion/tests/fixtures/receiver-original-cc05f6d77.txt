// Private single-file inbox. No raw workbook, costs or stock quantities enter GitHub logs/artifacts.
import {seal,unseal} from './messenger-control.mjs';
import {central,validateCentral} from './central-source.mjs';
const repo='conectatech-ec/conectatech-ec.github.io',branch='automatizacion/piloto-cloud-3sku-20261015';
const json=(d,s=200)=>Response.json(d,{status:s,headers:{'Cache-Control':'no-store'}});
export function commercialInit(box){box.sql.exec('CREATE TABLE IF NOT EXISTS commercial_inbox (id INTEGER PRIMARY KEY CHECK(id=1), sha TEXT, filename TEXT, sealed TEXT, status TEXT, received INTEGER, expires INTEGER, error TEXT)');}
export function commercialCleanup(box,now){box.sql.exec('DELETE FROM commercial_inbox WHERE expires<=?',now);}
async function dispatch(env){
 if(!env.COMMERCIAL_ACTIONS_TOKEN)return 'needs_actions_token';
 const headers={Authorization:'Bearer '+env.COMMERCIAL_ACTIONS_TOKEN,Accept:'application/vnd.github+json','User-Agent':'CONECTATECH-pilot'};
 try{
  const r=await fetch('https://api.github.com/repos/'+repo+'/actions/workflows/central-593.yml/runs?branch='+encodeURIComponent(branch)+'&status=completed&per_page=5',{headers,signal:AbortSignal.timeout(10000)});if(!r.ok)return 'dispatch_denied';
  const run=(await r.json()).workflow_runs?.find(r=>r.head_branch===branch&&r.path==='.github/workflows/central-593.yml');if(!run)return 'bootstrap_workflow_required';
  const jobs=await fetch('https://api.github.com/repos/'+repo+'/actions/runs/'+run.id+'/jobs',{headers,signal:AbortSignal.timeout(10000)});if(!jobs.ok)return 'dispatch_denied';
  const job=(await jobs.json()).jobs?.find(j=>j.name==='ingresar');if(!job)return 'bootstrap_workflow_required';
  const retry=await fetch('https://api.github.com/repos/'+repo+'/actions/jobs/'+job.id+'/rerun',{method:'POST',headers,signal:AbortSignal.timeout(10000)});return retry.status===201?'triggered':'dispatch_denied';
 }catch{return 'dispatch_unavailable';}
}
export async function commercialFetch(path,req,box){
 if(!path.startsWith('/commercial/'))return null;
 if(!box.name.startsWith('commercial-source'))return json({error:'Source scope'},409);
 const row=box.sql.exec('SELECT * FROM commercial_inbox WHERE id=1').toArray()[0];
 if(path==='/commercial/status'&&req.method==='GET')return json({pending:row?.status==='received',status:row?.status||'empty',file_sha256:row?.sha||null,error_code:row?.error||null,automatic_trigger_configured:!!box.env.COMMERCIAL_ACTIONS_TOKEN,retention_hours:24,live_customers_enabled:false});
 if(path==='/commercial/report'&&req.method==='POST'){
  if(Number(req.headers.get('content-length')||0)>1000000)return json({error:'FILE_SIZE_LIMIT'},413);
  const reader=req.body?.getReader();if(!reader)return json({error:'EMPTY_FILE'},400);const chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000){await reader.cancel();return json({error:'FILE_SIZE_LIMIT'},413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
  if(size<100||bytes[0]!==80||bytes[1]!==75)return json({error:'XLSX_REQUIRED'},400);
  const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(row?.sha===sha)return json({received:true,duplicate:true,sha256:sha,status:row.status});
  if(row?.status==='received')return json({error:'PREVIOUS_REPORT_PENDING'},409);
  let filename;try{filename=decodeURIComponent(req.headers.get('X-Report-Filename')||'');}catch{return json({error:'FILENAME'},400);}
  if(!/^Reporte-Inventario \d{2}-\d{2}-\d{4}\.xlsx$/.test(filename))return json({error:'REPORT_FILENAME'},400);
  let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));
  const sealed=await seal(btoa(raw),box.env.PILOT_TOKEN),now=Date.now();
  // Recheck after encryption; concurrent uploads may not replace a pending file.
  if(box.sql.exec("SELECT id FROM commercial_inbox WHERE status='received'").toArray().length)return json({error:'PREVIOUS_REPORT_PENDING'},409);
  box.sql.exec('INSERT INTO commercial_inbox VALUES(1,?,?,?,?,?,?,NULL) ON CONFLICT(id) DO UPDATE SET sha=excluded.sha,filename=excluded.filename,sealed=excluded.sealed,status=excluded.status,received=excluded.received,expires=excluded.expires,error=NULL',sha,filename,sealed,'received',now,now+86400000);
  await box.state.storage.setAlarm(now+86400000);
  const trigger=box.name==='commercial-source-ci'?'ci_no_dispatch':await dispatch(box.env);
  return json({received:true,sha256:sha,status:'awaiting_validation',trigger,raw_file_public:false},202);
 }
 if(path==='/commercial/report'&&req.method==='GET'){
  if(!row||row.status!=='received')return json({error:'NO_PENDING_REPORT'},404);
  if(new URL(req.url).searchParams.get('sha256')!==row.sha)return json({error:'REPORT_CHANGED'},409);
  const raw=atob(await unseal(row.sealed,box.env.PILOT_TOKEN));return new Response(Uint8Array.from(raw,c=>c.charCodeAt(0)),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Cache-Control':'no-store','X-Report-Filename':encodeURIComponent(row.filename)}});
 }
 if(path==='/commercial/complete'&&req.method==='POST'){
  const b=await req.json();if(!row||row.sha!==b.sha256||!['processed','rejected'].includes(b.status))return json({error:'REPORT_CHANGED'},409);
  const error=b.status==='rejected'&&/^[A-Z0-9_]{1,80}$/.test(b.error_code||'')?b.error_code:null;
  box.sql.exec('UPDATE commercial_inbox SET status=?,sealed=?,error=? WHERE sha=?',b.status,'',error,row.sha);return json({completed:true,raw_file_erased:true,status:b.status});
 }
 return json({error:'Not found'},404);
}
export function centralStatus(){
 try{validateCentral(central);return {schema:central.schema,source_sha256:central.source.sha256,cut_date:central.source.cut_date,generated_at:central.source.generated_at,normalized_at:central.normalized_at,published_at:central.published_at||null,expires_at:central.expires_at,current:Date.parse(central.expires_at)>=Date.now(),products:central.products.length,blocked:central.products.filter(p=>p.availability==='blocked').length};}catch{return {current:false,error:'CENTRAL_INVALID'};}
}
export function uploadPage(){
 const nonce=crypto.randomUUID();return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><title>CONECTATECH · Fuente comercial</title><style>body{font:17px system-ui;max-width:720px;margin:3em auto;padding:1em}input,button{font:inherit;margin:1em 0;display:block}pre{white-space:pre-wrap}</style><h1>CONECTATECH · Reporte único 593</h1><p>Acceso privado del propietario. El Excel se cifra y se elimina al terminar su procesamiento; nunca se publica completo. Los canales de producción siguen sujetos a aprobación.</p><label>Clave privada del piloto<input id="key" type="password" autocomplete="off"></label><label>Reporte-Inventario DD-MM-AAAA.xlsx<input id="file" type="file" accept=".xlsx"></label><button id="send">Enviar para validación</button><button id="status">Consultar estado</button><pre id="result"></pre><script nonce="${nonce}">const el=id=>document.getElementById(id);async function call(path,options={}){const r=await fetch(path,{...options,headers:{Authorization:'Bearer '+el('key').value,...options.headers}});const d=await r.json();el('result').textContent=JSON.stringify(d,null,2);if(!r.ok)throw Error(d.error);return d;}el('send').onclick=async()=>{try{const f=el('file').files[0];if(!f||f.size>1000000)throw Error('Selecciona un XLSX de hasta un millón de bytes.');await call('/commercial/report',{method:'POST',headers:{'X-Report-Filename':encodeURIComponent(f.name)},body:f});el('file').value='';}catch(e){el('result').textContent=e.message;}};el('status').onclick=()=>call('/commercial/status').catch(e=>el('result').textContent=e.message);setTimeout(()=>{el('key').value='';},600000);</script></html>`,{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-"+nonce+"'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",'Referrer-Policy':'no-referrer'}});
}
