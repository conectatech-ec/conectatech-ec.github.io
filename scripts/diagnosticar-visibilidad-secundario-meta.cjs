'use strict';
// Lectura acotada al catálogo secundario. No importa, cambia, conecta ni elimina activos.
const CATALOG='1668633188201887',NAME='CONECTATECH | Catálogo WhatsApp 0964206977';
const BASE='id,retailer_id,availability';
const FIELDS=BASE+',review_status,visibility,image_fetch_status,origin_country,review_rejection_reasons';
const DIAG='affected_channels,error_code,number_of_affected_items,severity,title,type';
const RELATIONS=['id,store_catalog_settings{page{id,name}}','id,commerce_merchant_settings{merchant_page{id,name}}'];
function safeText(value,token){
 let s=String(value??'');
 if(token)s=s.split(token).join('[OCULTO]').split(encodeURIComponent(token)).join('[OCULTO]');
 return s.replace(/\bEAA[A-Za-z0-9_-]{20,}\b/g,'[OCULTO]').replace(/https?:\/\/[^\s"<>]+/gi,'[URL_OMITIDA]').slice(0,300);
}
function safeData(value,token,depth=0){
 if(depth>5)return '[LIMITE]';
 if(value===null||typeof value==='boolean'||typeof value==='number')return value;
 if(typeof value==='string')return safeText(value,token);
 if(Array.isArray(value))return value.slice(0,20).map(x=>safeData(x,token,depth+1));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).slice(0,30).filter(([k])=>!/token|secret|password|authorization|url|paging/i.test(k)).map(([k,v])=>[safeText(k,token),safeData(v,token,depth+1)]));
 return null;
}
class CatalogReader{
 constructor({token,transport=fetch}){if(!token)throw Error('FALTA_CREDENCIAL_SECUNDARIA');this.token=token;this.transport=transport;this.items=new Set();}
 async get(path,fields,after){
  const own=path.endsWith('/channels_to_integrity_status')&&this.items.has(path.split('/')[0])&&fields==='channels,rejection_information';
  if(!(path===CATALOG&&['id,name',...RELATIONS].includes(fields))&&!(path===CATALOG+'/products'&&[BASE,FIELDS].includes(fields))&&!(path===CATALOG+'/diagnostics'&&fields===DIAG)&&!own)throw Error('CONSULTA_FUERA_DE_ALCANCE');
  const url=new URL('https://graph.facebook.com/v26.0/'+path);url.searchParams.set('fields',fields);
  if(path.includes('/'))url.searchParams.set('limit','100');if(after)url.searchParams.set('after',after);
  let response,data;
  try{response=await this.transport(url,{method:'GET',headers:{Authorization:'Bearer '+this.token},redirect:'error',signal:AbortSignal.timeout(15000)});data=JSON.parse(await response.text());}
  catch{throw Error('TRANSPORTE_O_RESPUESTA_INVALIDA');}
  if(!response.ok||data.error)throw Object.assign(Error('META_NO_CONSULTABLE'),{http:response.status,code:Number(data.error?.code)||null,subcode:Number(data.error?.error_subcode)||null});
  if(path===CATALOG+'/products'&&Array.isArray(data.data))for(const p of data.data)if(/^\d+$/.test(p.id||'')&&p.id!==CATALOG&&p.id!=='1036301566100990')this.items.add(p.id);
  return data;
 }
 async list(path,fields){
  const all=[],seen=new Set();let after;
  for(let n=0;n<100;n++){
   const d=await this.get(path,fields,after);if(!Array.isArray(d.data))throw Error('LISTA_INVALIDA');all.push(...d.data);
   if(!d.paging?.next)return all;
   after=d.paging.cursors?.after;if(!after||seen.has(after))throw Error('PAGINACION_INVALIDA');seen.add(after);
  }
  throw Error('LIMITE_PAGINACION');
 }
}
function aggregate(items,field,token){
 const result={};for(const p of items){const v=p[field];const key=typeof v==='string'?safeText(v,token):v==null?'NO_DEVUELTO':'OTRO_FORMATO';result[key]=(result[key]||0)+1;}return result;
}
function unavailable(error){return {estado:'NO_CONSULTABLE',http:Number(error.http)||null,codigo:Number(error.code)||null,subcodigo:Number(error.subcode)||null};}
async function diagnose({token,transport=fetch}){
 if(!token)return {estado:'SIN_CREDENCIAL_SECUNDARIA',solo_lectura:true};
 const api=new CatalogReader({token,transport});const identity=await api.get(CATALOG,'id,name');
 if(identity.id!==CATALOG||identity.name!==NAME)throw Error('IDENTIDAD_NO_COINCIDE');
 let products,reviewRead={estado:'LEIDO'};
 try{products=await api.list(CATALOG+'/products',FIELDS);}
 catch(e){reviewRead=unavailable(e);products=await api.list(CATALOG+'/products',BASE);}
 let diagnostics,relations=[];
 try{const rows=await api.list(CATALOG+'/diagnostics',DIAG);diagnostics={estado:'LEIDO',datos:safeData(rows.map(r=>Object.fromEntries(DIAG.split(',').filter(k=>r[k]!==undefined).map(k=>[k,r[k]]))),token)};}
 catch(e){diagnostics=unavailable(e);}
 for(const fields of RELATIONS){
  const key=fields.includes('store_catalog_settings')?'store_catalog_settings':'commerce_merchant_settings';
  try{const d=await api.get(CATALOG,fields);relations.push({campo:key,estado:'LEIDO',datos:safeData(d[key]??null,token)});}
  catch(e){relations.push({campo:key,...unavailable(e)});}
 }
 const samples=[];
 for(const p of products.filter(p=>String(p.availability).replace(/_/g,' ')==='in stock').slice(0,3)){
  const sku=/^[A-Z0-9_-]{1,60}$/.test(p.retailer_id||'')?p.retailer_id:'SKU_OMITIDO';
  try{const data=await api.list(p.id+'/channels_to_integrity_status','channels,rejection_information');samples.push({sku,estado:'LEIDO',canales:safeData(data,token)});}
  catch(e){samples.push({sku,...unavailable(e)});}
 }
 return {estado:'VISIBILIDAD_META_SOLO_LECTURA',solo_lectura:true,catalog_id:CATALOG,productos:products.length,lectura_revision:reviewRead,
  disponibilidad:aggregate(products,'availability',token),revision:aggregate(products,'review_status',token),visibilidad:aggregate(products,'visibility',token),imagenes:aggregate(products,'image_fetch_status',token),
  origen_declarado:products.filter(p=>typeof p.origin_country==='string'&&p.origin_country).length,
  rechazos:products.filter(p=>Array.isArray(p.review_rejection_reasons)&&p.review_rejection_reasons.length).slice(0,10).map(p=>({sku:safeText(p.retailer_id,token),motivos:safeData(p.review_rejection_reasons,token)})),
  diagnosticos_catalogo:diagnostics,relaciones_paginas:relations,muestras_canales:samples,conexion_nativa_verificada:false,visibilidad_cliente_verificada:false};
}
async function main({env=process.env,transport=fetch,log=console.log}={}){
 let result;try{result=await diagnose({token:env.META_WHATSAPP_SECONDARY_TOKEN,transport});}
 catch(e){result={estado:'VISIBILIDAD_NO_CONFIRMADA',solo_lectura:true,...unavailable(e)};}
 log('VISIBILIDAD_SECUNDARIO_META: '+JSON.stringify(result));return result;
}
module.exports={CATALOG,BASE,FIELDS,CatalogReader,diagnose,main,safeData};
if(require.main===module)main();
