'use strict';
const fs=require('fs'),crypto=require('node:crypto');
const {Graph}=require('./sincronizar-conjuntos-meta.cjs');
(async()=>{
 const catalogId='1036301566100990';
 const plan=JSON.parse(fs.readFileSync('exportaciones/meta-conjuntos-web.json','utf8'));
 if(plan.catalog_id!==catalogId)throw Error('Catálogo fuera de alcance');
 const api=new Graph({token:process.env.META_ACCESS_TOKEN,version:'v26.0'});
 const catalog=await api.request('GET',catalogId,{fields:'id,name'});
 if(catalog.id!==catalogId||catalog.name!=='CONECTATECH | Catálogo Maestro')throw Error('Identidad de catálogo distinta');
 const sets=await api.list(catalogId+'/product_sets','id,name,retailer_id,filter,ordering_info');
 const required=['Celulares y Smartphones','Tablets','Televisores','Monitores','Smartwatches y Wearables','Almacenamiento'];
 const snapshots=[];
 for(const [i,family] of required.entries()){
  const g=plan.groups.find(g=>g.family===family);
  if(!g||!g.sku.length)throw Error('Familia prioritaria ausente: '+family);
  const found=sets.filter(s=>s.retailer_id===g.retailer_id);
  if(found.length!==1)throw Error('Conjunto ausente o duplicado: '+family);
  const s=found[0],members=await api.list(s.id+'/products','id,retailer_id');
  if(JSON.stringify(members.map(p=>p.retailer_id).sort())!==JSON.stringify([...g.sku].sort()))throw Error('Miembros distintos del plan: '+family);
  snapshots.push({posicion_solicitada:i+1,familia:family,conjunto_original:s,miembros:members});
 }
 const result={estado:'RESPALDO_REAL_SIN_MODIFICACIONES',catalogo:catalog,fecha_corte:plan.fecha_corte,fuente_sha256:plan.fuente_sha256,colecciones:snapshots,
  propuesta:{accion:'Recrear exclusivamente estos seis conjuntos, conservando nombre, filtro, retailer_id y orden de productos; nuevo identificador de conjunto',secuencia:snapshots.slice().reverse().map(s=>s.familia),no_autorizada_todavia:true,orden_visual_resultante_verificado:false,nota:'La secuencia visual observada es compatible con creación más reciente primero. No constituye garantía de comportamiento de WhatsApp.'}};
 result.respaldo_sha256=crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex');
 fs.mkdirSync('work/auto-meta',{recursive:true});
 fs.writeFileSync('work/auto-meta/respaldo-orden-colecciones.json',JSON.stringify(result,null,2)+'\n');
 console.log('RESPALDO_ORDEN_REAL: '+JSON.stringify(result));
})().catch(e=>{console.error('RESPALDO_NO_COMPLETADO: '+(e.meta?.reason||e.message));process.exitCode=1});
