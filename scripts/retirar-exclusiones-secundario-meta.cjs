'use strict';
// Exclusión pública autorizada 21nov2026. Misma credencial, workflow y mutex;
// nunca toca Sistema593, precios, stock, fotos ni la biblioteca privada.
const fs=require('node:fs'),crypto=require('node:crypto');
const {SecondaryGraph,validateConfig,PHONE,NAME,FEED_NAME,PUBLIC_EXCLUSION_SKUS:SKUS,RETIREMENT_CATALOG:CATALOG}=require('./sincronizar-secundario-meta.cjs');
const BACKUP='work/auto-meta/respaldo-exclusiones-secundario.json',RECEIPT='work/auto-meta/resultado-exclusiones-secundario.json';
const FIELDS='id,retailer_id,brand,price,availability,product_catalog{id},product_feed{id}';
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
const ref=value=>typeof value==='object'?value?.id:value;
const save=(file,data)=>{fs.mkdirSync('work/auto-meta',{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');};
const fail=code=>{throw Error('RETIRADA_'+code);};
function validateBackup(backup){
 const {backup_sha256,...body}=backup||{};
 if(body.version!==1||body.catalog_id!==CATALOG||JSON.stringify(body.authorized_skus)!==JSON.stringify(SKUS)||digest(body)!==backup_sha256||!/^\d+$/.test(body.feed_id||'')||!Array.isArray(body.targets))fail('RESPALDO_INVALIDO');
 const ids=new Set(),skus=new Set();
 for(const row of body.targets){
  if(!SKUS.includes(row.retailer_id)||ids.has(row.id)||skus.has(row.retailer_id)||!/^\d+$/.test(row.id||'')||row.catalog_id!==CATALOG||row.feed_id!==body.feed_id)fail('RESPALDO_FUERA_DE_ALCANCE');
  ids.add(row.id);skus.add(row.retailer_id);
 }
 return backup;
}
function publicItem(row,feedId){
 if(!/^\d+$/.test(row.id||'')||!SKUS.includes(row.retailer_id)||ref(row.product_catalog)!==CATALOG||ref(row.product_feed)!==feedId)fail('PRODUCTO_PADRE_O_FUENTE_DISTINTOS');
 if(row.brand&&String(row.brand).trim().toUpperCase()!=='STEREN')fail('MARCA_DISTINTA');
 if(typeof row.price!=='string'||!/^\d+(?:[.,]\d{1,2})?(?: [A-Z]{3})?$/.test(row.price)||!['in stock','out of stock'].includes(String(row.availability).replace(/_/g,' ')))fail('DATOS_PUBLICOS_NO_CONFIRMADOS');
 // El respaldo de Actions se trata como público: esquema cerrado, sin URL,
 // descripciones, cantidades, costos, headers ni respuestas Graph completas.
 return {id:row.id,retailer_id:row.retailer_id,catalog_id:CATALOG,feed_id:feedId,brand:row.brand?'STEREN':null,price:row.price,availability:row.availability};
}
async function snapshot(api){
 if(!(api instanceof SecondaryGraph)||api.catalogId!==CATALOG)fail('ADAPTADOR_FUERA_DE_ALCANCE');
 const catalog=await api.request('GET',CATALOG,{fields:'id,name'});
 if(catalog.id!==CATALOG||catalog.name!==NAME)fail('IDENTIDAD_DISTINTA');
 const feeds=await api.list(CATALOG+'/product_feeds','id,name,schedule'),sources=feeds.filter(f=>f.name===FEED_NAME);
 if(sources.length!==1||sources[0].schedule&&Object.keys(sources[0].schedule).length)fail('FUENTE_NO_CONFIRMADA');
 const feed=sources[0];if(!/^\d+$/.test(feed.id||''))fail('FUENTE_NO_CONFIRMADA');
 const uploads=await api.list(feed.id+'/uploads','id,end_time,error_count');
 if(uploads.some(u=>!u.end_time&&!u.error_count))fail('IMPORTACION_EN_CURSO');
 const products=await api.list(CATALOG+'/products',FIELDS),ids=new Set(),skus=new Set();
 for(const p of products){if(!/^\d+$/.test(p.id||'')||typeof p.retailer_id!=='string'||ids.has(p.id)||skus.has(p.retailer_id))fail('IDENTIDAD_PRODUCTOS_AMBIGUA');ids.add(p.id);skus.add(p.retailer_id);}
 const others=products.filter(p=>!SKUS.includes(p.retailer_id)).map(p=>({id:p.id,sku:p.retailer_id,price:p.price,availability:p.availability})).sort((a,b)=>a.id.localeCompare(b.id));
 return {feedId:feed.id,products,others_sha256:digest(others)};
}
async function prepare({api}){
 const before=await snapshot(api),targets=[];
 // Prevalidar todos los cinco antes de persistir y antes de cualquier DELETE.
 for(const sku of SKUS){const row=before.products.find(p=>p.retailer_id===sku);if(row)targets.push(publicItem(await api.request('GET',row.id,{fields:FIELDS}),before.feedId));}
 const body={version:1,catalog_id:CATALOG,feed_id:before.feedId,authorized_skus:[...SKUS],targets,others_sha256:before.others_sha256};
 return {...body,backup_sha256:digest(body)};
}
async function apply({api,backup,artifactId,onReceipt=()=>{},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 let receipt={estado:'PREPARADO',catalog_id:CATALOG,retirados:[],ya_ausentes:[],backup_sha256:backup?.backup_sha256||null};
 const persist=()=>onReceipt(structuredClone(receipt));
 try{
  if(typeof artifactId!=='string'||!/^\d+$/.test(artifactId))fail('RESPALDO_REMOTO_NO_CONFIRMADO');
  validateBackup(backup);const fresh=await snapshot(api);
  if(fresh.feedId!==backup.feed_id||fresh.others_sha256!==backup.others_sha256)fail('FUENTE_O_PRODUCTOS_AJENOS_CAMBIARON');
  const targets=[];
  for(const sku of SKUS){
   const row=fresh.products.find(p=>p.retailer_id===sku),saved=backup.targets.find(p=>p.retailer_id===sku);
   if(!row){receipt.ya_ausentes.push(sku);continue;}
   if(!saved||row.id!==saved.id)fail('OBJETIVO_CAMBIO_REPREPARAR');
   const live=publicItem(await api.request('GET',row.id,{fields:FIELDS}),fresh.feedId);
   if(digest(live)!==digest(saved))fail('OBJETIVO_CAMBIO_REPREPARAR');
   targets.push(saved);
  }
  persist();
  for(const target of targets){
   // Nueva lectura individual inmediatamente antes del único intento de baja.
   const live=publicItem(await api.request('GET',target.id,{fields:FIELDS}),fresh.feedId);
   if(digest(live)!==digest(target))fail('OBJETIVO_CAMBIO_REPREPARAR');
   api.authorizeProductRetirement(target.id);
   let uncertain=false,response,deleteError;
   try{response=await api.request('DELETE',target.id,{});}catch(error){uncertain=true;deleteError=error;}
   if(!uncertain&&response?.success!==true)fail('BORRADO_NO_CONFIRMADO');
   let after;
   for(let attempt=0;attempt<4;attempt++){
    after=await api.list(CATALOG+'/products',FIELDS);
    if(!after.some(p=>p.retailer_id===target.retailer_id))break;
    if(uncertain){
     if(/^META_HTTP_(401|403)_CODIGO_/.test(deleteError?.message||''))fail('PERMISO_DENEGADO');
     if(/^META_HTTP_429_CODIGO_/.test(deleteError?.message||''))fail('LIMITE_API');
     fail('RESPUESTA_INCIERTA_PRODUCTO_PRESENTE');
    }
    if(attempt<3)await wait(2000);
   }
   if(after.some(p=>p.retailer_id===target.retailer_id))fail('LECTURA_POSTERIOR_NO_CONFIRMA');
   receipt.retirados.push(target.retailer_id);persist();
  }
  const after=await snapshot(api);
  if(after.products.some(p=>SKUS.includes(p.retailer_id))||after.others_sha256!==backup.others_sha256)fail('VERIFICACION_FINAL_NO_COINCIDE');
  receipt={...receipt,estado:'VERIFICADO',artifact_id:artifactId,productos_no_autorizados_intactos:true,restantes:after.products.length,verified_at:new Date().toISOString()};persist();return receipt;
 }catch(error){receipt={...receipt,estado:'BLOQUEADO',codigo:/^RETIRADA_[A-Z_]+$/.test(error.message)?error.message:'RETIRADA_META_NO_COMPLETADA'};persist();throw Error(receipt.codigo);}
}
async function main(){
 const config=validateConfig(JSON.parse(fs.readFileSync('integraciones/whatsapp-secundario.json','utf8')));
 if(config.enabled!==true||config.catalog_id!==CATALOG||config.phone!==PHONE)fail('CONFIGURACION_FUERA_DE_ALCANCE');
 if(!process.env.META_WHATSAPP_SECONDARY_TOKEN)fail('FALTA_CREDENCIAL_EXISTENTE');
 const api=new SecondaryGraph({config,token:process.env.META_WHATSAPP_SECONDARY_TOKEN,version:'v26.0'});
 if(process.argv.includes('--prepare')){
  const backup=await prepare({api});save(BACKUP,backup);
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'needs_apply='+(backup.targets.length>0)+'\n');
  console.log('EXCLUSION_SECUNDARIO: '+JSON.stringify({estado:'PREPARADO',sku:backup.targets.map(p=>p.retailer_id),sin_cambios:backup.targets.length===0}));
 }else if(process.argv.includes('--apply')){
  const receipt=await apply({api,backup:JSON.parse(fs.readFileSync(BACKUP,'utf8')),artifactId:process.env.META_RETIREMENT_BACKUP_ARTIFACT_ID,onReceipt:r=>save(RECEIPT,r)});
  console.log('EXCLUSION_SECUNDARIO: '+JSON.stringify({estado:receipt.estado,retirados:receipt.retirados,ya_ausentes:receipt.ya_ausentes,productos_no_autorizados_intactos:receipt.productos_no_autorizados_intactos}));
 }else fail('MODO_EXPLICITO_REQUERIDO');
}
module.exports={SKUS,CATALOG,NAME,FEED_NAME,prepare,apply,digest};
if(require.main===module)main().catch(error=>{
 const codigo=/^RETIRADA_[A-Z_]+$/.test(error.message)?error.message:'RETIRADA_META_NO_COMPLETADA';
 let prior;try{prior=JSON.parse(fs.readFileSync(RECEIPT,'utf8'));}catch{}
 if(prior?.estado!=='BLOQUEADO'||prior.codigo!==codigo)save(RECEIPT,{estado:'BLOQUEADO',codigo});
 console.error('EXCLUSION_SECUNDARIO: '+JSON.stringify({estado:'BLOQUEADO',codigo}));process.exitCode=1;
});
