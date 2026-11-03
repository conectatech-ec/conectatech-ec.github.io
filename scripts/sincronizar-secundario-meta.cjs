'use strict';
const fs=require('node:fs');
const {Graph,synchronizeCatalog}=require('./sincronizar-conjuntos-meta.cjs');
const MASTER='1036301566100990',PHONE='593964206977';
const NAME='CONECTATECH | Catálogo WhatsApp 0964206977';
const FEED_NAME='CONECTATECH | Fuente 593 WhatsApp 0964206977';
const protectedIds=new Set([MASTER,'974449225015463','2639516313038513','291534458544743','100630632770993','105264852297951','61595580884742']);
const CHECKPOINT='reportes/integracion-whatsapp/ultima-importacion-secundario.json';
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
 return synchronizeCatalog({...options,plan:{...plan,catalog_id:config.catalog_id},api,
  target:{id:config.catalog_id,name:NAME,selectFeed}});
}
function save(path,data){fs.mkdirSync('work/auto-meta',{recursive:true});fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n');}
async function main({env=process.env,transport=fetch,config,plan,csv,checkpoint,write=save,log=console.log}={}){
 config=validateConfig(config||JSON.parse(fs.readFileSync('integraciones/whatsapp-secundario.json','utf8')));
 let receipt={estado:'SECUNDARIO_PENDIENTE_CONFIGURACION',phone:PHONE,colecciones_whatsapp_verificadas:false};
 if(config.enabled){
  if(!env.META_WHATSAPP_SECONDARY_TOKEN)throw Error('FALTA_CREDENCIAL_SECUNDARIA');
  const api=new SecondaryGraph({config,token:env.META_WHATSAPP_SECONDARY_TOKEN,version:'v26.0',transport});
  plan=plan||JSON.parse(fs.readFileSync('exportaciones/meta-conjuntos-web.json','utf8'));
  csv=csv??fs.readFileSync('exportaciones/meta-catalogo-piloto.csv','utf8');
  checkpoint=checkpoint??(fs.existsSync(CHECKPOINT)?JSON.parse(fs.readFileSync(CHECKPOINT,'utf8')):null);
  receipt=await syncSecondary({config,plan,csv,checkpoint,api,onCheckpoint:c=>write('work/auto-meta/importacion-secundario.json',c),onProgress:log});
 }
 write('work/auto-meta/resultado-secundario.json',receipt);log('META_SECUNDARIO: '+JSON.stringify(receipt));
 if(env.GITHUB_STEP_SUMMARY)fs.appendFileSync(env.GITHUB_STEP_SUMMARY,'\nWhatsApp secundario 0964206977: '+receipt.estado+'\nVisibilidad en WhatsApp: pendiente de conexión nativa y comprobación.\n');
 return receipt;
}
module.exports={MASTER,PHONE,NAME,FEED_NAME,CHECKPOINT,validateConfig,SecondaryGraph,syncSecondary,main};
if(require.main===module)main().catch(e=>{
 const receipt={estado:'ERROR_SECUNDARIO',codigo:e.message.startsWith('META_HTTP_')?e.message:'VALIDACION_SECUNDARIA_NO_CONFIRMADA',...(e.meta?{meta:e.meta}:{}),colecciones_whatsapp_verificadas:false};
 save('work/auto-meta/resultado-secundario.json',receipt);console.error('META_SECUNDARIO: '+JSON.stringify(receipt));
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'\nWhatsApp secundario: ERROR. Sincronización no confirmada; consultar resultado-secundario.json.\n');
 process.exitCode=1;
});
