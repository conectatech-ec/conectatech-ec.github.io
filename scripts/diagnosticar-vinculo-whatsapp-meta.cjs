'use strict';
// Diagnóstico autorizado: sólo GET a activos conocidos. No importa ni modifica productos,
// números, páginas, catálogos, plantillas, suscripciones ni configuración de mensajería.
const REQUESTS=Object.freeze([
 {key:'catalogo_maestro',path:'1036301566100990',fields:'id,name'},
 {key:'permisos_credencial',path:'me/permissions',fields:'permission,status'},
 {key:'cuenta_principal',path:'2639516313038513',fields:'id,name'},
 {key:'cuenta_secundaria',path:'100630632770993',fields:'id,name'},
 {key:'catalogos_principal',path:'2639516313038513/product_catalogs',fields:'id,name'},
 {key:'catalogos_secundario',path:'100630632770993/product_catalogs',fields:'id,name'},
 {key:'telefono_secundario',path:'105264852297951',fields:'id,display_phone_number,verified_name'},
 {key:'perfil_principal',path:'291534458544743',fields:'id,display_phone_number,verified_name'}
].map(Object.freeze));
const CATALOG='1036301566100990';
function redact(value,token){
 let s=String(value||'');
 if(token)s=s.split(token).join('[OCULTO]').split(encodeURIComponent(token)).join('[OCULTO]');
 return s.replace(/([?&]access_token=)[^&\s"'<>]+/gi,'$1[OCULTO]')
  .replace(/\bEAA[A-Za-z0-9_-]{20,}\b/g,'[OCULTO]').slice(0,500);
}
function project(item,token){
 const out={};
 if(/^\d+$/.test(String(item?.id||'')))out.id=String(item.id);
 for(const key of ['name','display_phone_number','verified_name']){
  if(typeof item?.[key]==='string')out[key]=redact(item[key],token);
 }
 return out;
}
async function readAsset({token,request,transport=fetch}){
 if(!token)throw Error('FALTA_CREDENCIAL_EXISTENTE');
 const allowed=REQUESTS.find(r=>r.key===request?.key&&r.path===request?.path&&r.fields===request?.fields);
 if(!allowed)throw Error('CONSULTA_FUERA_DE_ALCANCE');
 const url=new URL('https://graph.facebook.com/v26.0/'+allowed.path);
 url.searchParams.set('fields',allowed.fields);
 if(allowed.path.includes('/'))url.searchParams.set('limit','100');
 let response,data;
 try{
  response=await transport(url,{
   method:'GET',headers:{Authorization:'Bearer '+token},
   redirect:'error',signal:AbortSignal.timeout(12000)
  });
  data=JSON.parse(await response.text());
 }catch{
  return {consulta:allowed.key,estado:'NO_CONSULTABLE',motivo:'TRANSPORTE_O_RESPUESTA_INVALIDA'};
 }
 if(!response.ok||data.error){
  return {consulta:allowed.key,estado:'NO_CONSULTABLE',http:response.status,
   codigo:Number(data.error?.code)||null,subcodigo:Number(data.error?.error_subcode)||null,
   motivo:redact(data.error?.message||'SIN_DETALLE',token)};
 }
 if(allowed.key==='permisos_credencial'){
  if(!Array.isArray(data.data))return {consulta:allowed.key,estado:'NO_CONSULTABLE',motivo:'LISTA_INVALIDA'};
  return {consulta:allowed.key,estado:'LEIDO',datos:data.data.map(p=>({
   permiso:redact(p.permission,token),estado:redact(p.status,token)
  })),hay_mas_paginas:Boolean(data.paging?.next)};
 }
 if(allowed.path.endsWith('/product_catalogs')){
  if(!Array.isArray(data.data))return {consulta:allowed.key,estado:'NO_CONSULTABLE',motivo:'LISTA_INVALIDA'};
  return {consulta:allowed.key,estado:'LEIDO',datos:data.data.map(p=>project(p,token)),
   hay_mas_paginas:Boolean(data.paging?.next)};
 }
 const record=project(data,token);
 if(!record.id)return {consulta:allowed.key,estado:'NO_CONSULTABLE',motivo:'IDENTIDAD_NO_DEVUELTA'};
 return {consulta:allowed.key,estado:'LEIDO',datos:record};
}
async function diagnose({token,transport=fetch}){
 if(!token)return {estado:'SIN_CREDENCIAL_WHATSAPP_SECUNDARIO',solo_lectura:true};
 const results=await Promise.all(REQUESTS.map(request=>readAsset({token,request,transport})));
 const master=results.find(r=>r.consulta==='catalogo_maestro');
 const secondary=results.find(r=>r.consulta==='catalogos_secundario');
 return {estado:'DIAGNOSTICO_REAL_SOLO_LECTURA',solo_lectura:true,
  catalogo_maestro_accesible:master.estado==='LEIDO'&&master.datos?.id===CATALOG,
  maestro_en_catalogos_secundario:secondary.estado==='LEIDO'?
   secondary.datos.some(c=>c.id===CATALOG):null,
  visibilidad_cliente_whatsapp_verificada:false,resultados:results};
}
async function main({env=process.env,transport=fetch,log=console.log}={}){
 // Secreto independiente: nunca recurrir al usado por la sincronización principal.
 const result=await diagnose({token:env.META_WHATSAPP_SECONDARY_TOKEN,transport});
 log('VINCULO_WHATSAPP_META: '+JSON.stringify(result));
 return result;
}
module.exports={REQUESTS,redact,readAsset,diagnose,main};
if(require.main===module){
 main().catch(()=>{
  console.error('VINCULO_WHATSAPP_META: ERROR_DE_VALIDACION_SIN_DATOS_SENSIBLES');
  process.exitCode=1;
 });
}
