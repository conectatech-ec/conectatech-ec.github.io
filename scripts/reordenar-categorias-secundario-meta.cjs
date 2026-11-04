'use strict';
const fs=require('fs'),crypto=require('node:crypto');
const {Graph,parseGraphData}=require('./sincronizar-conjuntos-meta.cjs');
const CATALOG='1668633188201887';
const CATALOG_NAME='CONECTATECH | Catálogo WhatsApp 0964206977';
const FAMILIES=['Celulares y Smartphones','Tablets','Televisores','Monitores','Smartwatches y Wearables','Almacenamiento'];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const stable=x=>JSON.stringify(canonical(typeof x==='string'?JSON.parse(x):x));
const hash=x=>crypto.createHash('sha256').update(stable(x)).digest('hex');
const filter=x=>typeof x==='string'?JSON.parse(x):x;
const sorted=rows=>[...rows].sort((a,b)=>a.id.localeCompare(b.id));
const recoveryNeeded=s=>!!s&&s.catalog_id===CATALOG&&s.estado!=='ORDEN_SECUNDARIO_META_VERIFICADO'&&!!s.resultado;
const creationPending=s=>['CREANDO','RESTAURACION_PENDIENTE'].includes(s);
function creationParams(s){
 const p={name:s.name,filter:filter(s.filter),retailer_id:s.retailer_id};
 if(s.ordering_info?.length)p.ordering_info='['+s.ordering_info.map(String).join(',')+']';
 return p;
}
function validate(request,backup){
 const copy={...backup};delete copy.respaldo_sha256;
 const digest=crypto.createHash('sha256').update(JSON.stringify(copy)).digest('hex');
 if(!request.autorizado||request.catalog_id!==CATALOG||(!request.targets?.length||request.targets.length>21)||digest!==request.respaldo_sha256||digest!==backup.respaldo_sha256)throw Error('REORDEN_AUTORIZACION_O_RESPALDO_INVALIDO');
 const ids=new Set();
 for(const [i,t] of request.targets.entries()){
  const family=t.familia,b=backup.colecciones.find(c=>c.familia===family)?.conjunto_original;
  if(!require('./prioridad-comercial-meta.cjs').priority.includes(family)||(i<6&&family!==FAMILIES[i]))throw Error('REORDEN_FAMILIA_FUERA_DE_ALCANCE');
  if(t.familia!==family||t.prioridad!==i+1||!b||t.old_id!==b.id||t.retailer_id!==b.retailer_id||!/^[0-9]+$/.test(t.old_id)||t.old_id===CATALOG||ids.has(t.old_id))throw Error('REORDEN_ALCANCE_INVALIDO');
  ids.add(t.old_id);
 }
 return hash(request);
}
async function recreate({request,backup,plan,api,state=null,onState=()=>{},onProgress=()=>{},wait=pause,attempts=40}){
 const requestHash=validate(request,backup);
 if(state?.estado==='RECREACION_META_VERIFICADA'&&state.request_sha256===requestHash)return {...state,reejecucion:'SIN_CAMBIOS'};
 if(state&&state.request_sha256!==requestHash)throw Error('REORDEN_ESTADO_DE_OTRA_SOLICITUD');
 if(state&&(state.registros?.length!==request.targets.length||new Set(state.registros.map(r=>r.old_id)).size!==request.targets.length))throw Error('REORDEN_ESTADO_INVALIDO');
 const catalog=await api.request('GET',CATALOG,{fields:'id,name'});
 if(catalog.id!==CATALOG||catalog.name!==CATALOG_NAME||plan.catalog_id!==CATALOG)throw Error('REORDEN_CATALOGO_DISTINTO');
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
  if(!s&&!['ELIMINANDO','ELIMINADO','CREANDO','RESTAURACION_PENDIENTE'].includes(previous?.estado))throw Error('REORDEN_IDENTIDAD_AUSENTE');
  if(s&&s.id!==t.old_id&&s.id!==previous?.new_id&&!creationPending(previous?.estado))throw Error('REORDEN_IDENTIDAD_NO_RECONOCIDA');
  if(s){
   const original=backup.colecciones.find(c=>c.familia===t.familia)?.conjunto_original;
   if(s.id===t.old_id&&(!original||s.name!==original.name||stable(s.filter)!==stable(original.filter)||stable((s.ordering_info||[]).map(String))!==stable((original.ordering_info||[]).map(String))))throw Error('REORDEN_RESPALDO_DESACTUALIZADO');
   if(stable(s.filter)!==stable(g.filter))throw Error('REORDEN_FILTRO_DISTINTO');
   const members=await api.list(s.id+'/products','id,retailer_id');
   if(stable(members.map(p=>p.retailer_id).sort())!==stable([...g.sku].sort()))throw Error('REORDEN_MIEMBROS_DISTINTOS');
  }
  records.push(previous||{...t,estado:'PREPARADO',snapshot:s,sku:[...g.sku]});
 }
 // Validar también cada solicitud de creación antes de eliminar cualquier contenedor.
 for(const r of records)api.validateCreation?.(creationParams(r.snapshot));
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
   if(!r.new_id&&creationPending(r.estado))r.new_id=current[0].id;
   else if(current[0].id!==r.new_id)throw Error('REORDEN_IDENTIDAD_CAMBIO');
  }
  if(!r.new_id){
   r.estado='CREANDO';save();
   const params=creationParams(r.snapshot);
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
  if(finalSets.length===request.targets.length+all.filter(s=>!retailers.has(s.retailer_id)).length&&hash(sorted(finalSets.filter(s=>!retailers.has(s.retailer_id))))===others)break;
  if(i===attempts-1)throw Error('REORDEN_OTROS_CONJUNTOS_CAMBIARON');
  await wait(3000);
 }
 const finalProducts=await api.list(CATALOG+'/products',productFields);
 if(hash(sorted(finalProducts))!==baseline)throw Error('REORDEN_PRODUCTOS_CAMBIARON');
 const desired=[...request.targets].sort((a,b)=>a.prioridad-b.prioridad).map(t=>t.retailer_id);
 state.estado='RECREACION_META_VERIFICADA';state.orden_solicitado=request.targets.map(t=>t.familia);
 // Meta antepone el conjunto general All Products; no es una colección comercial.
 state.orden_lista_meta=finalSets.filter(s=>String(s.retailer_id||'').startsWith('conectatech-web:')).slice(0,request.targets.length).map(s=>s.retailer_id);
 state.orden_lista_meta_coincide=stable(state.orden_lista_meta)===stable(desired);
 state.productos_sin_cambios=finalProducts.length;state.finalizado_utc=new Date().toISOString();save();return state;
}

// Adaptador exclusivo de esta operación. La sincronización normal conserva su prohibición de DELETE.
class ReorderGraph extends Graph{
 constructor({token,request=null,backup=null,names,transport=fetch}){
  if(request)validate(request,backup);
  super({token,version:'v26.0',transport,deletableProductSetIds:request?.targets.map(t=>t.old_id)||[]});
  this.names=new Map(names.map(n=>[n.retailer_id,n.name]));this.sets=new Map();this.parents=new Set();this.catalogVerified=false;
  this.creations=new Map((request?.targets||[]).map(t=>[t.retailer_id,backup.colecciones.find(c=>c.familia===t.familia).conjunto_original]));
 }
 validateCreation(params){
  const expected=this.creations.get(params.retailer_id),keys=Object.keys(params).sort().join(',');
  if(!expected||!['filter,name,retailer_id','filter,name,ordering_info,retailer_id'].includes(keys)||params.name!==expected.name||stable(params.filter)!==stable(expected.filter)||stable(parseGraphData('{"ordering_info":'+(params.ordering_info||'[]')+'}').ordering_info.map(String))!==stable((expected.ordering_info||[]).map(String)))throw Error('REORDEN_CREACION_FUERA_DE_ALCANCE');
 }
 async request(method,path,params={},file=null){
  const [id,edge,...rest]=String(path).split('/'),root=id===CATALOG,known=this.sets.get(id);
  if(rest.length||file||(!root&&!known)||edge&&!(root?['product_sets','products']:['products']).includes(edge))throw Error('REORDEN_SECUNDARIO_FUERA_DE_ALCANCE');
  if(method!=='GET'){
   if(!this.catalogVerified)throw Error('REORDEN_IDENTIDAD_NO_VERIFICADA');
   const keys=Object.keys(params).sort().join(',');
   if(method==='DELETE'){
    if(edge||!this.parents.has(id)||!this.deletableProductSetIds.has(id)||keys!=='allow_live_product_set_deletion'||params.allow_live_product_set_deletion!==false)throw Error('REORDEN_ELIMINACION_FUERA_DE_ALCANCE');
    this.parents.delete(id);
   }else if(method==='POST'&&root&&edge==='product_sets'){
    this.validateCreation(params);
   }else if(method==='POST'&&known&&!edge){
    if(!this.parents.has(id)||keys!=='name'||params.name!==this.names.get(known.retailer_id))throw Error('REORDEN_NOMBRE_FUERA_DE_ALCANCE');
    this.parents.delete(id);
   }else throw Error('REORDEN_ESCRITURA_FUERA_DE_ALCANCE');
  }
  const data=await super.request(method,path,params);
  if(method==='GET'&&root&&!edge){
   if(data.id!==CATALOG||data.name!==CATALOG_NAME)throw Error('REORDEN_IDENTIDAD_DISTINTA');this.catalogVerified=true;
  }
  if(method==='GET'&&root&&edge==='product_sets')for(const s of data.data||[]){if(!/^\d+$/.test(s.id||'')||s.id===CATALOG||s.id==='1036301566100990')throw Error('REORDEN_CONJUNTO_INVALIDO');this.sets.set(s.id,s);}
  if(method==='POST'&&root&&edge==='product_sets')this.sets.set(data.id,{id:data.id,...params});
  if(method==='GET'&&known&&!edge&&params.fields?.includes('product_catalog')){
   const parent=typeof data.product_catalog==='object'?data.product_catalog?.id:data.product_catalog;
   if(parent!==CATALOG)throw Error('REORDEN_PADRE_DISTINTO');this.parents.add(id);
  }
  return data;
 }
}
function prepare(snapshot,plan,state=null){
 const {compare}=require('./comparar-categorias-secundario-meta.cjs');
 const c=compare(snapshot.master,snapshot.secondary);
 const names=c.categorias.map(g=>({retailer_id:g.retailer_id,name:g.nombre_maestro}));
 if(!c.sku_precio_disponibilidad_iguales||c.categorias_extra_secundario.length||c.categorias.length!==plan.groups.length)throw Error('REORDEN_COMPARACION_NO_COINCIDE');
 if(state){
  validate(state.request,state.backup);
  if(stable(names)!==stable(state.names)||state.catalog_id!==CATALOG)throw Error('REORDEN_REFERENCIA_DE_RECUPERACION_DISTINTA');
  return {comparison:{...c,orden_igual:false},names,targets:state.request.targets.map(t=>plan.groups.find(g=>g.retailer_id===t.retailer_id))};
 }
 if(c.categorias.some(g=>!g.filtro_igual)||c.categorias.slice(0,6).some((g,i)=>plan.groups.find(p=>p.retailer_id===g.retailer_id)?.family!==FAMILIES[i]))throw Error('REORDEN_CATEGORIAS_DISTINTAS');
 let count=0;
 for(;count<=c.orden_maestro.length;count++){
  const prefix=c.orden_maestro.slice(0,count);
  if(stable([...prefix,...c.orden_secundario.filter(r=>!prefix.includes(r))])===stable(c.orden_maestro))break;
 }
 const targets=c.categorias.slice(0,count).map(c=>plan.groups.find(g=>g.retailer_id===c.retailer_id));
 if(targets.some(g=>!g))throw Error('REORDEN_CATEGORIA_SIN_PLAN');
 return {comparison:c,names,targets};
}
async function execute({snapshot,plan,api,state=null,onState=()=>{},onProgress=()=>{},wait=pause,attempts=40}){
 const {readBoth,compare}=require('./comparar-categorias-secundario-meta.cjs');
 // Captura y preparación previas a cualquier cambio; el Maestro nunca se escribe.
 const prepared=prepare(snapshot,plan,state);let bundle=state;
 await api.request('GET',CATALOG,{fields:'id,name'});
 const sets=await api.list(CATALOG+'/product_sets','id,name,retailer_id,filter,ordering_info');
 for(const wanted of state?[]:prepared.names){
  const actual=sets.find(s=>s.retailer_id===wanted.retailer_id);
  if(!actual)throw Error('REORDEN_CATEGORIA_AUSENTE');
  if(actual.name!==wanted.name){
   await api.request('GET',actual.id,{fields:'id,name,retailer_id,filter,product_catalog'});
   await api.request('POST',actual.id,{name:wanted.name});
   const updated=await api.request('GET',actual.id,{fields:'id,name'});if(updated.name!==wanted.name)throw Error('REORDEN_NOMBRE_NO_CONFIRMADO');actual.name=wanted.name;
  }
 }
 if(!bundle){
  const collections=prepared.targets.map(g=>({familia:g.family,conjunto_original:sets.find(s=>s.retailer_id===g.retailer_id)}));
  const backup={catalogo:{id:CATALOG},colecciones:collections};backup.respaldo_sha256=crypto.createHash('sha256').update(JSON.stringify(backup)).digest('hex');
  const request={id:'direccion-2026-11-04-secundario-igual-al-maestro',autorizado:true,catalog_id:CATALOG,respaldo_sha256:backup.respaldo_sha256,targets:collections.map((c,i)=>({prioridad:i+1,familia:c.familia,old_id:c.conjunto_original.id,retailer_id:c.conjunto_original.retailer_id}))};
  bundle={version:1,catalog_id:CATALOG,request,backup,names:prepared.names,resultado:null};onState(structuredClone(bundle));
 }
 if(!prepared.comparison.orden_igual||bundle.resultado){
  // Otro adaptador recibe únicamente los IDs autorizados y respaldados.
  const apply=api.forRequest?api.forRequest(bundle.request,bundle.backup):api;
  bundle.resultado=await recreate({request:bundle.request,backup:bundle.backup,plan:{...plan,catalog_id:CATALOG},api:apply,state:bundle.resultado,wait,attempts,onProgress,onState:s=>{bundle.resultado=s;onState(structuredClone(bundle));}});
 }
 const finalSets=await api.list(CATALOG+'/product_sets','id,name,retailer_id,filter,ordering_info');
 const finalProducts=await api.list(CATALOG+'/products','id,retailer_id,price,availability');
 const after=compare(snapshot.master,{sets:finalSets,products:finalProducts});
 if(!after.orden_igual||after.categorias.some(g=>!g.nombre_igual||!g.filtro_igual)||!after.sku_precio_disponibilidad_iguales)throw Error('REORDEN_FINAL_NO_COINCIDE');
 bundle.estado='ORDEN_SECUNDARIO_META_VERIFICADO';bundle.orden=after.categorias.map(g=>g.nombre_maestro);bundle.productos=finalProducts.length;bundle.orden_whatsapp_verificado=false;
 onState(structuredClone(bundle));return bundle;
}
async function main({env=process.env,scope,apply=process.argv.includes('--apply')}={}){
 scope=scope||JSON.parse(fs.readFileSync('integraciones/orden-categorias-secundario.json','utf8'));
 if(scope.autorizado!==true){console.log('ORDEN_SECUNDARIO_PENDIENTE_AUTORIZACION');return {estado:'PENDIENTE_AUTORIZACION'};}
 if(scope.catalog_id!==CATALOG||scope.reference_catalog_id!=='1036301566100990')throw Error('REORDEN_SOLICITUD_FUERA_DE_ALCANCE');
 const saved='reportes/integracion-whatsapp/resultado-orden-secundario.json';
 const state=fs.existsSync(saved)?JSON.parse(fs.readFileSync(saved,'utf8')):null;
 if(state?.estado==='ORDEN_SECUNDARIO_META_VERIFICADO'&&state.catalog_id===CATALOG){if(state.request)validate(state.request,state.backup);console.log('ORDEN_SECUNDARIO_YA_EJECUTADO_SIN_CAMBIOS');return state;}
 if(env.META_ORDER_SECONDARY_ENABLED!=='true'||!apply)throw Error('REORDEN_SECUNDARIO_NO_HABILITADO');
 if(!env.META_WHATSAPP_SECONDARY_TOKEN)throw Error('REORDEN_FALTA_SECRETO_SECUNDARIO');
 const {readBoth}=require('./comparar-categorias-secundario-meta.cjs');
 const {snapshot}=await readBoth({token:env.META_WHATSAPP_SECONDARY_TOKEN});
 const plan=JSON.parse(fs.readFileSync('exportaciones/meta-conjuntos-web.json','utf8'));
 const prepared=prepare(snapshot,plan,state);
 if(stable(prepared.names)!==stable(scope.orden_maestro))throw Error('REORDEN_REFERENCIA_MAESTRO_CAMBIO');
 const expected=state?.request.targets||prepared.targets.map(g=>({retailer_id:g.retailer_id,old_id:snapshot.secondary.sets.find(s=>s.retailer_id===g.retailer_id)?.id}));
 if(stable(expected.map(t=>({retailer_id:t.retailer_id,old_id:t.old_id})))!==stable(scope.targets.map(t=>({retailer_id:t.retailer_id,old_id:t.old_id}))))throw Error('REORDEN_IDS_AUTORIZADOS_CAMBIARON');
 const make=(request,backup)=>new ReorderGraph({token:env.META_WHATSAPP_SECONDARY_TOKEN,request,backup,names:prepared.names});
 const api=make();api.forRequest=make;
 const result=await execute({snapshot,plan,api,state,onState:s=>{fs.mkdirSync('work/auto-meta',{recursive:true});fs.writeFileSync('work/auto-meta/orden-secundario.json',JSON.stringify(s,null,2)+'\n');},onProgress:console.log});
 console.log('ORDEN_SECUNDARIO_RESULTADO: '+JSON.stringify({estado:result.estado,catalog_id:CATALOG,productos:result.productos,orden:result.orden,orden_whatsapp_verificado:false}));return result;
}
module.exports={CATALOG,FAMILIES,validate,recreate,ReorderGraph,prepare,execute,main,recoveryNeeded};
if(require.main===module)main().catch(e=>{const code=e.message.startsWith('REORDEN_')?e.message:'REORDEN_META_NO_COMPLETADO';console.error('ORDEN_SECUNDARIO_ERROR: '+JSON.stringify({codigo:code,...(e.meta?{meta:e.meta}:{})}));process.exitCode=1;});

