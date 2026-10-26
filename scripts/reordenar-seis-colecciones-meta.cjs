'use strict';
const fs=require('fs'),crypto=require('node:crypto');
const {Graph}=require('./sincronizar-conjuntos-meta.cjs');
const CATALOG='1036301566100990';
const FAMILIES=['Celulares y Smartphones','Tablets','Televisores','Monitores','Smartwatches y Wearables','Almacenamiento'];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const stable=x=>JSON.stringify(canonical(typeof x==='string'?JSON.parse(x):x));
const hash=x=>crypto.createHash('sha256').update(stable(x)).digest('hex');
const filter=x=>typeof x==='string'?JSON.parse(x):x;
const sorted=rows=>[...rows].sort((a,b)=>a.id.localeCompare(b.id));
function validate(request,backup){
 const copy={...backup};delete copy.respaldo_sha256;
 const digest=crypto.createHash('sha256').update(JSON.stringify(copy)).digest('hex');
 if(!request.autorizado||request.catalog_id!==CATALOG||request.targets?.length!==6||digest!==request.respaldo_sha256||digest!==backup.respaldo_sha256)throw Error('REORDEN_AUTORIZACION_O_RESPALDO_INVALIDO');
 const ids=new Set();
 for(const [i,family] of FAMILIES.entries()){
  const t=request.targets[i],b=backup.colecciones.find(c=>c.familia===family)?.conjunto_original;
  if(t.familia!==family||t.prioridad!==i+1||!b||t.old_id!==b.id||t.retailer_id!==b.retailer_id||!/^[0-9]+$/.test(t.old_id)||t.old_id===CATALOG||ids.has(t.old_id))throw Error('REORDEN_ALCANCE_INVALIDO');
  ids.add(t.old_id);
 }
 return hash(request);
}
async function recreate({request,backup,plan,api,state=null,onState=()=>{},onProgress=()=>{},wait=pause,attempts=40}){
 const requestHash=validate(request,backup);
 if(state?.estado==='RECREACION_META_VERIFICADA'&&state.request_sha256===requestHash)return {...state,reejecucion:'SIN_CAMBIOS'};
 if(state&&state.request_sha256!==requestHash)throw Error('REORDEN_ESTADO_DE_OTRA_SOLICITUD');
 if(state&&(state.registros?.length!==6||new Set(state.registros.map(r=>r.old_id)).size!==6))throw Error('REORDEN_ESTADO_INVALIDO');
 const catalog=await api.request('GET',CATALOG,{fields:'id,name'});
 if(catalog.id!==CATALOG||catalog.name!=='CONECTATECH | Catálogo Maestro'||plan.catalog_id!==CATALOG)throw Error('REORDEN_CATALOGO_DISTINTO');
 const fields='id,name,retailer_id,filter,ordering_info';
 const all=await api.list(CATALOG+'/product_sets',fields);
 const productFields='id,retailer_id,price,availability';
 const products=await api.list(CATALOG+'/products',productFields);
 const baseline=hash(sorted(products)),retailers=new Set(request.targets.map(t=>t.retailer_id));
 const others=hash(sorted(all.filter(s=>!retailers.has(s.retailer_id))));
 if(state&&(state.productos_sha256!==baseline||state.otros_conjuntos_sha256!==others))throw Error('REORDEN_BASE_CAMBIO_DESDE_INTENTO_PREVIO');
 const records=[];
 // Completar todas las comprobaciones antes de la primera eliminación.
 for(const t of [...request.targets].reverse()){
  const g=plan.groups.find(g=>g.retailer_id===t.retailer_id),matches=all.filter(s=>s.retailer_id===t.retailer_id);
  const previous=state?.registros.find(r=>r.old_id===t.old_id);
  if(!g||!g.sku.length||matches.length>1)throw Error('REORDEN_CONJUNTO_AUSENTE_O_DUPLICADO');
  const s=matches[0];
  if(previous&&(previous.retailer_id!==t.retailer_id||previous.snapshot?.id!==t.old_id||stable(previous.snapshot.filter)!==stable(g.filter)||stable([...previous.sku].sort())!==stable([...g.sku].sort())))throw Error('REORDEN_RESPALDO_EN_CURSO_DISTINTO');
  if(!s&&!['ELIMINANDO','ELIMINADO','CREANDO'].includes(previous?.estado))throw Error('REORDEN_IDENTIDAD_AUSENTE');
  if(s&&s.id!==t.old_id&&s.id!==previous?.new_id&&previous?.estado!=='CREANDO')throw Error('REORDEN_IDENTIDAD_NO_RECONOCIDA');
  if(s){
   if(stable(s.filter)!==stable(g.filter))throw Error('REORDEN_FILTRO_DISTINTO');
   const members=await api.list(s.id+'/products','id,retailer_id');
   if(stable(members.map(p=>p.retailer_id).sort())!==stable([...g.sku].sort()))throw Error('REORDEN_MIEMBROS_DISTINTOS');
  }
  records.push(previous||{...t,estado:'PREPARADO',snapshot:s,sku:[...g.sku]});
 }
 state=state||{version:1,request_id:request.id,request_sha256:requestHash,estado:'RESPALDADO',catalog_id:CATALOG,fecha_corte:plan.fecha_corte,productos:products.length,productos_sha256:baseline,otros_conjuntos_sha256:others,registros:records,orden_whatsapp_verificado:false};
 const save=()=>onState(structuredClone(state));save();
 const verify=async(r,id)=>{
  for(let i=0;i<attempts;i++){
   const actual=await api.request('GET',id,{fields:'id,name,retailer_id,filter,ordering_info,product_catalog'});
   const parent=typeof actual.product_catalog==='object'?actual.product_catalog?.id:actual.product_catalog;
   if(parent!==CATALOG||actual.retailer_id!==r.retailer_id||actual.name!==r.snapshot.name||stable(actual.filter)!==stable(r.snapshot.filter))throw Error('REORDEN_REEMPLAZO_DISTINTO');
   const members=await api.list(id+'/products','id,retailer_id');
   const membership=stable(members.map(p=>p.retailer_id).sort())===stable([...r.sku].sort());
   const ordering=stable((actual.ordering_info||[]).map(String))===stable((r.snapshot.ordering_info||[]).map(String));
   if(membership&&ordering)return;
   await wait(3000);
  }
  throw Error('REORDEN_REEMPLAZO_NO_VERIFICADO');
 };
 for(const r of state.registros){
  if(r.estado==='VERIFICADO'){await verify(r,r.new_id);continue;}
  const current=(await api.list(CATALOG+'/product_sets',fields)).filter(s=>s.retailer_id===r.retailer_id);
  if(current.length>1)throw Error('REORDEN_DUPLICADO_ANTES_DE_ESCRIBIR');
  if(current[0]?.id===r.old_id){
   const live=await api.request('GET',r.old_id,{fields:'id,retailer_id,filter,product_catalog'});
   const parent=typeof live.product_catalog==='object'?live.product_catalog?.id:live.product_catalog;
   if(parent!==CATALOG||live.retailer_id!==r.retailer_id||stable(live.filter)!==stable(r.snapshot.filter))throw Error('REORDEN_ULTIMA_IDENTIDAD_DISTINTA');
   r.estado='ELIMINANDO';save();
   const deleted=await api.request('DELETE',r.old_id,{allow_live_product_set_deletion:false});
   if(deleted.success!==true)throw Error('REORDEN_ELIMINACION_NO_CONFIRMADA');
   r.estado='ELIMINADO';save();
  }else if(current[0]){
   if(!r.new_id&&r.estado==='CREANDO')r.new_id=current[0].id;
   else if(current[0].id!==r.new_id)throw Error('REORDEN_IDENTIDAD_CAMBIO');
  }
  if(!r.new_id){
   r.estado='CREANDO';save();
   const params={name:r.snapshot.name,filter:filter(r.snapshot.filter),retailer_id:r.retailer_id};
   if(r.snapshot.ordering_info?.length)params.ordering_info='['+r.snapshot.ordering_info.map(String).join(',')+']';
   try{const created=await api.request('POST',CATALOG+'/product_sets',params);r.new_id=created.id;}
   catch(e){
    // Una respuesta perdida puede haber creado el conjunto: recuperar por retailer_id antes de reintentar.
    const recovered=(await api.list(CATALOG+'/product_sets',fields)).filter(s=>s.retailer_id===r.retailer_id);
    if(recovered.length===1&&recovered[0].id!==r.old_id)r.new_id=recovered[0].id;
    else if(recovered.length===0){
     try{const restored=await api.request('POST',CATALOG+'/product_sets',params);r.new_id=restored.id;onProgress('REORDEN_REEMPLAZO_RECUPERADO');}
     catch(restoreError){r.estado='RESTAURACION_PENDIENTE';state.estado='REQUIERE_RECUPERACION';save();throw restoreError;}
    }else throw Error('REORDEN_CREACION_AMBIGUA');
   }
   if(!/^[0-9]+$/.test(r.new_id||'')||r.new_id===r.old_id)throw Error('REORDEN_NUEVO_ID_INVALIDO');
   r.estado='VERIFICANDO';save();
  }
  await verify(r,r.new_id);r.estado='VERIFICADO';save();onProgress('COLECCION_RECREADA: '+r.familia+' '+r.old_id+' -> '+r.new_id);
 }
 let finalSets;
 for(let i=0;i<attempts;i++){
  finalSets=await api.list(CATALOG+'/product_sets',fields);
  if(finalSets.length===all.length&&hash(sorted(finalSets.filter(s=>!retailers.has(s.retailer_id))))===others)break;
  if(i===attempts-1)throw Error('REORDEN_OTROS_CONJUNTOS_CAMBIARON');
  await wait(3000);
 }
 const finalProducts=await api.list(CATALOG+'/products',productFields);
 if(hash(sorted(finalProducts))!==baseline)throw Error('REORDEN_PRODUCTOS_CAMBIARON');
 const desired=[...request.targets].sort((a,b)=>a.prioridad-b.prioridad).map(t=>t.retailer_id);
 state.estado='RECREACION_META_VERIFICADA';state.orden_solicitado=FAMILIES;
 state.orden_lista_meta=finalSets.slice(0,6).map(s=>s.retailer_id);
 state.orden_lista_meta_coincide=stable(state.orden_lista_meta)===stable(desired);
 state.productos_sin_cambios=finalProducts.length;state.finalizado_utc=new Date().toISOString();save();return state;
}
async function main(){
 const path='reportes/integracion-whatsapp/solicitud-reordenar-seis-colecciones.json';
 if(!fs.existsSync(path)){console.log('REORDEN_SIN_SOLICITUD');return;}
 const request=JSON.parse(fs.readFileSync(path,'utf8'));
 const backup=JSON.parse(fs.readFileSync('reportes/integracion-whatsapp/respaldo-reordenar-seis-colecciones.json','utf8'));
 const saved='reportes/integracion-whatsapp/resultado-reordenar-seis-colecciones.json';
 const state=fs.existsSync(saved)?JSON.parse(fs.readFileSync(saved,'utf8')):null;
 const requestHash=validate(request,backup);
 if(state?.estado==='RECREACION_META_VERIFICADA'&&state.request_sha256===requestHash){console.log('REORDEN_YA_EJECUTADO_SIN_CAMBIOS');return;}
 if(process.env.META_RECREATE_SIX_ENABLED!=='true'||!process.argv.includes('--apply'))throw Error('REORDEN_EJECUCION_NO_HABILITADA');
 const result=await recreate({request,backup,state,plan:JSON.parse(fs.readFileSync('exportaciones/meta-conjuntos-web.json','utf8')),
  api:new Graph({token:process.env.META_ACCESS_TOKEN,version:process.env.META_GRAPH_VERSION,deletableProductSetIds:request.targets.map(t=>t.old_id)}),
  onState:s=>{fs.mkdirSync('work/auto-meta',{recursive:true});fs.writeFileSync('work/auto-meta/reordenacion.json',JSON.stringify(s,null,2)+'\n');},onProgress:s=>console.log(s)});
 console.log('REORDEN_RESULTADO: '+JSON.stringify({estado:result.estado,productos_sin_cambios:result.productos_sin_cambios,registros:result.registros.map(r=>({familia:r.familia,old_id:r.old_id,new_id:r.new_id,estado:r.estado})),orden_lista_meta_coincide:result.orden_lista_meta_coincide,orden_whatsapp_verificado:false}));
}
module.exports={validate,recreate};
if(require.main===module)main().catch(e=>{console.error('REORDEN_ERROR: '+JSON.stringify({codigo:e.message.startsWith('REORDEN_')?e.message:'META_OPERACION_NO_COMPLETADA',meta:e.meta}));process.exitCode=1;});
