'use strict';
const fs=require('fs'),crypto=require('node:crypto');
const CATALOG='1036301566100990';
const FEED='https://conectatech-ec.github.io/exportaciones/meta-catalogo-piloto.csv';
const normal=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const stable=x=>JSON.stringify(canonical(typeof x==='string'?JSON.parse(x):x));
function canonical(x){if(Array.isArray(x))return x.map(canonical);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]));return x;}
const stock=x=>normal(x).replace(/_/g,' ');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class Graph{
 constructor({token,version,transport=fetch}){
  if(!token||!/^v\d+\.\d+$/.test(version||''))throw Error('Falta credencial o versión Graph');
  this.token=token;this.version=version;this.transport=transport;
 }
 async request(method,path,params={},file=null){
  if(!['GET','POST'].includes(method)||!/^\d+(\/(product_sets|product_feeds|products|uploads))?$/.test(path))throw Error('Operación Meta fuera de alcance');
  const url=new URL('https://graph.facebook.com/'+this.version+'/'+path);
  const options={method,headers:{Authorization:'Bearer '+this.token},redirect:'error',signal:AbortSignal.timeout(30000)};
  if(method==='GET')for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
  else if(file){const body=new FormData();for(const [k,v] of Object.entries(params))body.set(k,String(v));body.set('file',new Blob([file.content],{type:'text/csv'}),file.name);options.body=body;}
  else options.body=new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k,v])=>[k,typeof v==='object'?JSON.stringify(v):String(v)])));
  let res,data;
  try{res=await this.transport(url,options);data=await res.json();}catch{throw Error('META_TRANSPORTE_O_RESPUESTA_INVALIDA');}
  if(!res.ok||data.error)throw Error('META_HTTP_'+res.status+'_CODIGO_'+(Number(data.error?.code)||'NO_DISPONIBLE'));
  return data;
 }
 async list(path,fields){
  const rows=[];let after;const seen=new Set();
  for(let page=0;page<1000;page++){
   const r=await this.request('GET',path,{fields,limit:100,...(after?{after}:{})});
   if(!Array.isArray(r.data))throw Error('META_LISTA_INVALIDA');rows.push(...r.data);
   if(!r.paging?.next)return rows;
   after=r.paging.cursors?.after;if(!after||seen.has(after))throw Error('META_PAGINACION_INVALIDA');seen.add(after);
  }
  throw Error('META_LIMITE_PAGINACION');
 }
}
function reconcile(plan,existing){
 if(plan.catalog_id!==CATALOG)throw Error('Catálogo distinto del Maestro');
 const used=new Set();
 return plan.groups.map(g=>{
  const names=[g.name,...(g.aliases||[])].map(normal);
  const matches=existing.filter(s=>s.retailer_id===g.retailer_id||names.includes(normal(s.name)));
  if(matches.length>1)throw Error('CONJUNTOS_DUPLICADOS_'+g.retailer_id);
  const found=matches[0];if(found&&used.has(found.id))throw Error('CONJUNTO_ASIGNADO_DOS_VECES');if(found)used.add(found.id);
  return {group:g,found,action:!found?(g.sku.length?'CREAR':'OMITIR_VACIO'):
   (stable(found.filter)!==stable(g.filter)||found.retailer_id!==g.retailer_id?'ACTUALIZAR':'SIN_CAMBIOS')};
 });
}
function checkRemote(plan,remote){
 const by=new Map();for(const r of remote){if(by.has(r.retailer_id))throw Error('META_SKU_DUPLICADO');by.set(r.retailer_id,r);}
 const expected=new Map(plan.groups.flatMap(g=>g.sku.map(s=>[s,g.label])));
 for(const [sku,label] of expected){const r=by.get(sku);if(!r||r.custom_label_0!==label||stock(r.availability)!=='in stock')throw Error('META_IMPORTACION_NO_COINCIDE_'+sku);}
 for(const r of remote)if(String(r.custom_label_0||'').startsWith('ct-web:')&&stock(r.availability)==='in stock'&&!expected.has(r.retailer_id))throw Error('META_SKU_FUERA_DE_SELECCION_'+r.retailer_id);
 return true;
}
async function synchronize({plan,csv,api,wait=pause,attempts=120,onProgress=()=>{}}){
 if(plan.catalog_id!==CATALOG||!plan.groups.length||!plan.productos_meta)throw Error('Plan Meta inválido');
 const catalog=await api.request('GET',CATALOG,{fields:'id,name'});
 if(catalog.id!==CATALOG||normal(catalog.name)!==normal('CONECTATECH | Catálogo Maestro'))throw Error('Identidad del Catálogo Maestro no coincide');
 const feeds=await api.list(CATALOG+'/product_feeds','id,name,schedule');
 const candidates=feeds.filter(f=>f.schedule?.url===FEED);
 if(candidates.length!==1)throw Error('No se identificó una única fuente existente con la URL aprobada');
 const operations=reconcile(plan,await api.list(CATALOG+'/product_sets','id,name,retailer_id,filter'));
 const digest=crypto.createHash('sha256').update(csv).digest('hex');
 const filename='ct-'+digest+'.csv',feed=candidates[0];
 const uploads=await api.list(feed.id+'/uploads','id,filename,end_time,error_count,num_invalid_items,num_persisted_items');
 let upload=uploads.find(u=>String(u.filename||'').endsWith(filename)&&!u.error_count&&!u.num_invalid_items);
 if(!upload){
  onProgress('IMPORTANDO_FEED_EXISTENTE');
  const submitted=await api.request('POST',feed.id+'/uploads',{update_only:true},{name:filename,content:csv});
  if(!/^\d+$/.test(submitted.id||''))throw Error('Respuesta de importación sin ID');
  upload={id:submitted.id};
 }
 if(!upload.end_time){
  onProgress('META_IMPORTACION_EN_CURSO_ID_'+upload.id);
  for(let i=0;i<attempts;i++){
   upload=await api.request('GET',upload.id,{fields:'id,end_time,error_count,num_invalid_items,num_persisted_items'});
   if(upload.end_time)break;
   if(i%10===0)onProgress('META_IMPORTACION_EN_CURSO');
   await wait(3000);
  }
 }
 if(!upload?.end_time)throw Error('META_IMPORTACION_PENDIENTE');
 if(upload.error_count||upload.num_invalid_items||upload.num_persisted_items<plan.productos_meta)throw Error('META_IMPORTACION_CON_ERRORES_O_INCOMPLETA');
 // Verificar primero la importación y disponibilidad; no crear conjuntos sobre datos antiguos.
 let verified=false;
 for(let i=0;i<attempts;i++){
  try{checkRemote(plan,await api.list(CATALOG+'/products','id,retailer_id,custom_label_0,availability'));verified=true;break;}
  catch(e){if(!/^META_(IMPORTACION_NO_COINCIDE|SKU_FUERA_DE_SELECCION)_/.test(e.message)||i===attempts-1)throw e;await wait(3000);}
 }
 if(!verified)throw Error('META_IMPORTACION_NO_VERIFICADA');
 const results=[];
 for(const op of operations){
  const {group:g,found,action}=op;if(action==='OMITIR_VACIO')continue;
  let id=found?.id;
  if(action==='CREAR'){
   const r=await api.request('POST',CATALOG+'/product_sets',{name:g.name,filter:g.filter,retailer_id:g.retailer_id});id=r.id;
  }else if(action==='ACTUALIZAR')await api.request('POST',id,{filter:g.filter,retailer_id:g.retailer_id});
  if(!/^\d+$/.test(id||''))throw Error('CONJUNTO_SIN_ID');
  const readback=await api.request('GET',id,{fields:'id,filter,retailer_id'});
  if(stable(readback.filter)!==stable(g.filter)||readback.retailer_id!==g.retailer_id)throw Error('CONJUNTO_NO_COINCIDE_'+id);
  let matched=false;
  for(let i=0;i<attempts;i++){
   const members=await api.list(id+'/products','retailer_id');
   if(stable(members.map(p=>p.retailer_id).sort())===stable(g.sku)){matched=true;break;}
   await wait(3000);
  }
  if(!matched)throw Error('PERTENENCIA_NO_VERIFICADA_'+id);
  results.push({id,familia:g.family,accion:action,sku:g.sku.length,estado:'CONJUNTO_META_VERIFICADO'});onProgress('CONJUNTO_META_VERIFICADO');
 }
 return {estado:'META_SINCRONIZADO',catalog_id:CATALOG,fuente_sha256:plan.fuente_sha256,feed_sha256:digest,importacion_id:upload.id,
  conjuntos:results,colecciones_whatsapp_verificadas:false,
  nota:'Importación y pertenencia comprobadas en Meta. Visibilidad y orden de colecciones en WhatsApp requieren evidencia de cliente.'};
}
async function main(){
 const plan=JSON.parse(fs.readFileSync('exportaciones/meta-conjuntos-web.json','utf8'));
 let receipt={estado:'PENDIENTE_AUTORIZACION_META',familias:plan.groups.filter(g=>g.sku.length).length,sku_clasificados:plan.groups.reduce((n,g)=>n+g.sku.length,0),colecciones_whatsapp_verificadas:false};
 if(!process.argv.includes('--plan')&&process.env.META_SYNC_ENABLED==='true'&&process.env.META_ACCESS_TOKEN&&process.env.META_GRAPH_VERSION){
  receipt=await synchronize({plan,csv:fs.readFileSync('exportaciones/meta-catalogo-piloto.csv','utf8'),api:new Graph({token:process.env.META_ACCESS_TOKEN,version:process.env.META_GRAPH_VERSION}),onProgress:s=>console.log(s)});
 }
 fs.mkdirSync('work/auto-meta',{recursive:true});fs.writeFileSync('work/auto-meta/resultado.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'\nEstado de integración Meta: '+receipt.estado+'\nColecciones WhatsApp verificadas: no\n');
}
module.exports={Graph,reconcile,checkRemote,synchronize};
if(require.main===module)main().catch(e=>{fs.mkdirSync('work/auto-meta',{recursive:true});fs.writeFileSync('work/auto-meta/resultado.json',JSON.stringify({estado:'ERROR',codigo:(e.message.match(/^(META_[A-Z_]+(?:_\d+)?|CONJUNTO_[A-Z_]+|PERTENENCIA_NO_VERIFICADA|CONJUNTOS_DUPLICADOS)/)||['ERROR_DE_VALIDACION'])[0],detalle:'La ejecución no pudo confirmar sincronización. Revisar autorización/importación y reejecutar; no se acreditó visibilidad WhatsApp.'},null,2)+'\n');console.error('ERROR_META: '+(e.message.match(/^(META_[A-Z_]+(?:_\d+)?|CONJUNTO_[A-Z_]+|PERTENENCIA_NO_VERIFICADA|CONJUNTOS_DUPLICADOS)/)||['ERROR_DE_VALIDACION'])[0]);process.exitCode=1;});

