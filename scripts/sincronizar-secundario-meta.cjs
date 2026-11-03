'use strict';
const fs=require('node:fs');
const {Graph,synchronizeCatalog}=require('./sincronizar-conjuntos-meta.cjs');
const MASTER='1036301566100990',PHONE='593964206977';
const NAME='CONECTATECH | Catálogo WhatsApp 0964206977';
const FEED_NAME='CONECTATECH | Fuente 593 WhatsApp 0964206977';
const protectedIds=new Set([MASTER,'974449225015463','2639516313038513','291534458544743','100630632770993','105264852297951','61595580884742']);
const CHECKPOINT='reportes/integracion-whatsapp/ultima-importacion-secundario.json';
const failureObservations=new WeakMap();
function validateConfig(c){
 if(c?.version!==1||c.phone!==PHONE||c.catalog_name!==NAME||c.feed_name!==FEED_NAME||typeof c.enabled!=='boolean')throw Error('CONFIGURACION_SECUNDARIA_INVALIDA');
 if(c.catalog_id!==null&&(!/^\d+$/.test(c.catalog_id)||protectedIds.has(c.catalog_id)))throw Error('DESTINO_SECUNDARIO_NO_PERMITIDO');
 if(c.enabled&&!c.catalog_id)throw Error('FALTA_CATALOGO_SECUNDARIO');
 return c;
}
// La credencial sólo puede escribir en descendientes obtenidos desde el catálogo secundario.
// No hay DELETE, mensajes, teléfonos, páginas, ni recurso de reserva a la credencial principal.
class SecondaryGraph extends Graph{
 constructor({config,...options}){
  validateConfig(config);
  if(!config.catalog_id)throw Error('FALTA_CATALOGO_SECUNDARIO');
  super(options);this.catalogId=config.catalog_id;this.known=new Map([[config.catalog_id,'catalog']]);
 }
 register(id,type){
  if(!/^\d+$/.test(id||'')||protectedIds.has(id)||this.known.has(id)&&this.known.get(id)!==type)throw Error('DESCENDIENTE_SECUNDARIO_INVALIDO');
  this.known.set(id,type);
 }
 async request(method,path,params={},file=null){
  const [id,edge,...rest]=String(path).split('/'),type=this.known.get(id);
  const allowed=type==='catalog'?['product_feeds','product_sets','products']:
   type==='feed'?['uploads']:type==='set'?['products']:[];
  if(rest.length||!type||edge&&!allowed.includes(edge)||!['GET','POST'].includes(method))throw Error('OPERACION_SECUNDARIA_FUERA_DE_ALCANCE');
  if(method==='POST'){
   const keys=Object.keys(params).sort().join(',');
   if(type==='catalog'&&edge==='product_feeds'){
    if(keys!=='name'||params.name!==FEED_NAME||file)throw Error('FUENTE_SECUNDARIA_INVALIDA');
   }else if(type==='catalog'&&edge==='product_sets'){
    if(keys!=='filter,name,retailer_id'||file)throw Error('CONJUNTO_SECUNDARIO_INVALIDO');
   }else if(type==='feed'&&edge==='uploads'){
    if(keys!=='update_only'||params.update_only!==true||!file||!/^ct-[a-f0-9]{64}\.csv$/.test(file.name))throw Error('CARGA_SECUNDARIA_INVALIDA');
   }else if(type==='set'&&!edge){
    if(!['filter,retailer_id','ordering_info'].includes(keys)||file)throw Error('ACTUALIZACION_SECUNDARIA_INVALIDA');
   }else throw Error('ESCRITURA_SECUNDARIA_FUERA_DE_ALCANCE');
  }
  this.observedStage=type==='catalog'?(edge==='products'?'verify_catalog_products':edge==='product_sets'?'catalog_sets':edge==='product_feeds'?'catalog_feeds':'verify_catalog_identity'):
   type==='feed'?(method==='POST'?'submit_upload':'list_uploads'):type==='upload'?'poll_upload':edge==='products'?'verify_set_membership':method==='POST'?'update_set':'read_set';
  const data=await super.request(method,path,params,file);
  const childType=edge==='product_feeds'?'feed':edge==='product_sets'?'set':edge==='uploads'?'upload':null;
  if(childType){
   if(method==='GET'&&Array.isArray(data.data))for(const child of data.data)this.register(child.id,childType);
   if(method==='POST')this.register(data.id,childType);
  }
  return data;
 }
}
async function selectFeed(api,feeds){
 const found=feeds.filter(f=>f.name===FEED_NAME);
 if(found.length>1)throw Error('FUENTES_SECUNDARIAS_DUPLICADAS');
 if(found.length===1){
  if(found[0].schedule&&Object.keys(found[0].schedule).length)throw Error('FUENTE_SECUNDARIA_CON_HORARIO_NO_AUTORIZADO');
  return found[0];
 }
 // Sin horario de Meta: la misma ejecución 593 alimenta ambos catálogos.
 return api.request('POST',api.catalogId+'/product_feeds',{name:FEED_NAME});
}
async function syncSecondary({config,plan,api,...options}){
 validateConfig(config);
 if(!config.enabled)return {estado:'SECUNDARIO_PENDIENTE_CONFIGURACION',phone:PHONE,colecciones_whatsapp_verificadas:false};
 if(plan?.catalog_id!==MASTER)throw Error('FUENTE_MAESTRA_INVALIDA');
 if(!(api instanceof SecondaryGraph)||api.catalogId!==config.catalog_id)throw Error('ADAPTADOR_SECUNDARIO_INVALIDO');
 const result=await synchronizeCatalog({...options,plan:{...plan,catalog_id:config.catalog_id},api,
  target:{id:config.catalog_id,name:NAME,selectFeed}});
 const products=await api.list(config.catalog_id+'/products','id,retailer_id,availability');
 const available=p=>String(p.availability).toLowerCase().replace(/_/g,' ')==='in stock';
 const out=p=>String(p.availability).toLowerCase().replace(/_/g,' ')==='out of stock';
 const expected=plan.groups.reduce((n,g)=>n+g.sku.length,0);
 if(products.length!==plan.productos_meta||products.filter(available).length!==expected||products.some(p=>!available(p)&&!out(p)))throw Error('TOTALES_SECUNDARIOS_NO_COINCIDEN');
 return {...result,phone:PHONE,productos_verificados:products.length,disponibles:expected,agotados:products.filter(out).length};
}
function save(path,data){fs.mkdirSync('work/auto-meta',{recursive:true});fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n');}
async function main({env=process.env,transport=fetch,config,plan,csv,checkpoint,inspect=false,write=save,log=console.log}={}){
 config=validateConfig(config||JSON.parse(fs.readFileSync('integraciones/whatsapp-secundario.json','utf8')));
 let receipt={estado:'SECUNDARIO_PENDIENTE_CONFIGURACION',phone:PHONE,colecciones_whatsapp_verificadas:false};
 if(config.enabled||inspect&&config.catalog_id){
  if(!env.META_WHATSAPP_SECONDARY_TOKEN)throw Error('FALTA_CREDENCIAL_SECUNDARIA');
  const api=new SecondaryGraph({config,token:env.META_WHATSAPP_SECONDARY_TOKEN,version:'v26.0',transport});
  if(inspect){
   const identity=await api.request('GET',config.catalog_id,{fields:'id,name'});
   if(identity.id!==config.catalog_id||identity.name!==NAME)throw Error('IDENTIDAD_SECUNDARIA_NO_COINCIDE');
   receipt={estado:'CATALOGO_SECUNDARIO_ACCESIBLE_SOLO_LECTURA',phone:PHONE,catalog_id:identity.id,solo_lectura:true,colecciones_whatsapp_verificadas:false};
   const feeds=await api.list(config.catalog_id+'/product_feeds','id,name');
   const imports=[];
   for(const feed of feeds.filter(f=>f.name===FEED_NAME)){
    const uploads=await api.list(feed.id+'/uploads','id,start_time,end_time,error_count,num_invalid_items,num_persisted_items');
    imports.push({feed_id:feed.id,cargas:uploads.slice(0,3).map(u=>({id:u.id,inicio:u.start_time,fin:u.end_time||null,errores:u.error_count,invalidos:u.num_invalid_items,persistidos:u.num_persisted_items}))});
   }
   const products=await api.list(config.catalog_id+'/products','id,retailer_id,availability');
   receipt={...receipt,productos_leidos:products.length,disponibles:products.filter(p=>String(p.availability).replace(/_/g,' ')==='in stock').length,agotados:products.filter(p=>String(p.availability).replace(/_/g,' ')==='out of stock').length,importaciones:imports};
  }else{
  plan=plan||JSON.parse(fs.readFileSync('exportaciones/meta-conjuntos-web.json','utf8'));
  csv=csv??fs.readFileSync('exportaciones/meta-catalogo-piloto.csv','utf8');
  checkpoint=checkpoint??(fs.existsSync(CHECKPOINT)?JSON.parse(fs.readFileSync(CHECKPOINT,'utf8')):null);
  // Una carga pendiente se reanuda en la siguiente ejecución; no retener el flujo principal 20 minutos.
  const observed={sets_verified:0,feed_submission_attempts:0,pending_upload_polls:0};
  try{
   receipt=await syncSecondary({config,plan,csv,checkpoint,api,uploadAttempts:1,onCheckpoint:c=>write('work/auto-meta/importacion-secundario.json',c),onProgress:message=>{
    if(message==='CONJUNTO_META_VERIFICADO')observed.sets_verified++;
    if(message==='IMPORTANDO_FEED_EXISTENTE')observed.feed_submission_attempts++;
    if(/^META_IMPORTACION_EN_CURSO_ID_\d+$/.test(message))observed.pending_upload_polls++;
    log(message);
   }});
  }catch(error){if(error&&typeof error==='object')failureObservations.set(error,{...observed,stage:api.observedStage});throw error;}
  }
 }
 write('work/auto-meta/resultado-secundario.json',receipt);log('META_SECUNDARIO: '+JSON.stringify(receipt));
 if(env.GITHUB_STEP_SUMMARY)fs.appendFileSync(env.GITHUB_STEP_SUMMARY,'\nWhatsApp secundario 0964206977: '+receipt.estado+'\nVisibilidad en WhatsApp: pendiente de conexión nativa y comprobación.\n');
 return receipt;
}
function failureReceipt(e){
 const message=typeof e?.message==='string'?e.message:'',http=message.match(/^META_HTTP_(\d{3})_CODIGO_(\d+|NO_DISPONIBLE)$/);
 const safeNumber=value=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=1000000000?value:null;
 const status=http&&Number(http[1])>=100&&Number(http[1])<=599?Number(http[1]):null;
 const code=safeNumber(e?.meta?.code)??(http&&http[2]!=='NO_DISPONIBLE'?safeNumber(Number(http[2])):null),subcode=safeNumber(e?.meta?.subcode);
 const known=new Set(['META_IMPORTACION_PENDIENTE','META_IMPORTACION_PREVIA_EN_CURSO','META_IMPORTACION_CON_ERRORES_O_INCOMPLETA','META_IMPORTACION_NO_VERIFICADA','TOTALES_SECUNDARIOS_NO_COINCIDEN','CONJUNTO_SIN_ID','FUENTES_SECUNDARIAS_DUPLICADAS','FUENTE_SECUNDARIA_CON_HORARIO_NO_AUTORIZADO','IDENTIDAD_SECUNDARIA_NO_COINCIDE','FUENTE_MAESTRA_INVALIDA','FALTA_CREDENCIAL_SECUNDARIA','CONFIGURACION_SECUNDARIA_INVALIDA','DESTINO_SECUNDARIO_NO_PERMITIDO','FALTA_CATALOGO_SECUNDARIO','ADAPTADOR_SECUNDARIO_INVALIDO','OPERACION_SECUNDARIA_FUERA_DE_ALCANCE','DESCENDIENTE_SECUNDARIO_INVALIDO','META_TRANSPORTE_O_RESPUESTA_INVALIDA']);
 const safeHttp=!!http&&status!==null;
 let codigo=safeHttp?'META_HTTP_'+status+'_CODIGO_'+(code??'NO_DISPONIBLE'):known.has(message)?message:'VALIDACION_SECUNDARIA_NO_CONFIRMADA',stage;
 for(const [pattern,safe,where]of [[/^PERTENENCIA_NO_VERIFICADA_\d+$/,'PERTENENCIA_NO_VERIFICADA','verify_set_membership'],[/^CONJUNTO_NO_COINCIDE_\d+$/,'CONJUNTO_NO_COINCIDE','verify_set_identity'],[/^META_IMPORTACION_NO_COINCIDE_[A-Z0-9_-]+$/,'META_IMPORTACION_NO_COINCIDE','verify_catalog_products'],[/^META_SKU_FUERA_DE_SELECCION_[A-Z0-9_-]+$/,'META_SKU_FUERA_DE_SELECCION','verify_catalog_products']])if(pattern.test(message)){codigo=safe;stage=where;break;}
 const pending=['META_IMPORTACION_PENDIENTE','META_IMPORTACION_PREVIA_EN_CURSO'].includes(codigo);
 let category=pending?'pending_import':status===429||[4,17,32,613,80004].includes(code)?'rate_limit':[401,403].includes(status)||[10,190,200,294].includes(code)?'permission_denied':[100,2500].includes(code)?'unsupported_or_invalid_request':status>=500||codigo==='META_TRANSPORTE_O_RESPUESTA_INVALIDA'?'transport':safeHttp?'graph_api':codigo!=='VALIDACION_SECUNDARIA_NO_CONFIRMADA'?'validation':'unclassified';
 const observation=e&&typeof e==='object'?failureObservations.get(e)||{}:{};
 const stages=new Set(['verify_catalog_identity','catalog_sets','catalog_feeds','verify_catalog_products','submit_upload','list_uploads','poll_upload','verify_set_membership','update_set','read_set']);
 stage=stage||(codigo==='TOTALES_SECUNDARIOS_NO_COINCIDEN'?'verify_catalog_totals':codigo.startsWith('META_IMPORTACION_')?'verify_upload':stages.has(observation.stage)?observation.stage:'unknown');
 const count=value=>Number.isSafeInteger(value)&&value>=0&&value<=1000000?value:0;
 return {estado:pending?'SECUNDARIO_IMPORTACION_PENDIENTE':'ERROR_SECUNDARIO',codigo,diagnostico:{category,stage,http_status:status,graph_code:code,graph_subcode:subcode,sets_verified:count(observation.sets_verified),feed_submission_attempts:count(observation.feed_submission_attempts),pending_upload_polls:count(observation.pending_upload_polls)},colecciones_whatsapp_verificadas:false};
}
module.exports={MASTER,PHONE,NAME,FEED_NAME,CHECKPOINT,validateConfig,SecondaryGraph,syncSecondary,main,failureReceipt};
if(require.main===module)main({inspect:process.argv.includes('--inspect')}).catch(e=>{
 const receipt=failureReceipt(e);
 save('work/auto-meta/resultado-secundario.json',receipt);console.error('META_SECUNDARIO: '+JSON.stringify(receipt));
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'\nWhatsApp secundario: '+receipt.estado+'. Sincronización no confirmada; consultar resultado-secundario.json.\n');
 process.exitCode=1;
});
