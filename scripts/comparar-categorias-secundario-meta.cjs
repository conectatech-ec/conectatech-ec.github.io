'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const {Graph}=require('./sincronizar-conjuntos-meta.cjs');
const MASTER='1036301566100990',SECONDARY='1668633188201887';
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const stable=x=>JSON.stringify(canonical(x));
const hash=x=>crypto.createHash('sha256').update(stable(x)).digest('hex');
const filter=x=>typeof x==='string'?JSON.parse(x):x;
const commercial=sets=>sets.filter(s=>String(s.retailer_id||'').startsWith('conectatech-web:'));
function compare(master,secondary){
 const desired=commercial(master.sets),actual=commercial(secondary.sets);
 if(!desired.length||new Set(desired.map(s=>s.retailer_id)).size!==desired.length||new Set(actual.map(s=>s.retailer_id)).size!==actual.length)throw Error('CATEGORIAS_VACIAS_O_DUPLICADAS');
 const mp=new Map(master.products.map(p=>[p.retailer_id,p])),sp=new Map(secondary.products.map(p=>[p.retailer_id,p]));
 const sameProducts=mp.size===master.products.length&&sp.size===secondary.products.length&&mp.size===sp.size&&[...mp].every(([sku,p])=>{const q=sp.get(sku);return q&&p.price===q.price&&p.availability===q.availability;});
 const categories=desired.map((m,index)=>{const s=actual.find(s=>s.retailer_id===m.retailer_id);return {posicion:index+1,retailer_id:m.retailer_id,nombre_maestro:m.name,nombre_secundario:s?.name||null,id_maestro:m.id,id_secundario:s?.id||null,filtro_igual:!!s&&stable(filter(m.filter))===stable(filter(s.filter)),nombre_igual:s?.name===m.name};});
 return {estado:'COMPARACION_CATEGORIAS_SOLO_LECTURA',solo_lectura:true,catalogo_maestro:MASTER,catalogo_secundario:SECONDARY,productos_maestro:master.products.length,productos_secundario:secondary.products.length,sku_precio_disponibilidad_iguales:sameProducts,
  categorias:categories,orden_maestro:desired.map(s=>s.retailer_id),orden_secundario:actual.map(s=>s.retailer_id),orden_igual:stable(desired.map(s=>s.retailer_id))===stable(actual.map(s=>s.retailer_id)),
  categorias_extra_secundario:actual.filter(s=>!desired.some(m=>m.retailer_id===s.retailer_id)).map(s=>s.retailer_id),
  maestro_productos_sha256:hash([...master.products].sort((a,b)=>a.id.localeCompare(b.id))),secundario_productos_sha256:hash([...secondary.products].sort((a,b)=>a.id.localeCompare(b.id))),
  orden_visible_en_whatsapp_verificado:false};
}
async function readBoth({token,transport=fetch}){
 if(!token)return {estado:'SIN_CREDENCIAL_SECUNDARIA',solo_lectura:true};
 const paths=new Set([MASTER,SECONDARY,...[MASTER,SECONDARY].flatMap(id=>[id+'/product_sets',id+'/products'])]);
 const api=new Graph({token,version:'v26.0',transport:async(url,options)=>{
  const path=url.pathname.replace('/v26.0/','');
  if(options.method!=='GET'||url.origin!=='https://graph.facebook.com'||!paths.has(path))throw Error('LECTURA_FUERA_DE_ALCANCE');
  return transport(url,options);
 }});
 const read=async(id,name)=>{const c=await api.request('GET',id,{fields:'id,name'});if(c.id!==id||c.name!==name)throw Error('IDENTIDAD_CATALOGO_DISTINTA');
  return {catalog:c,sets:await api.list(id+'/product_sets','id,name,retailer_id,filter,ordering_info,product_count'),products:await api.list(id+'/products','id,retailer_id,price,availability')};};
 const master=await read(MASTER,'CONECTATECH | Catálogo Maestro'),secondary=await read(SECONDARY,'CONECTATECH | Catálogo WhatsApp 0964206977');
 return {comparison:compare(master,secondary),snapshot:{version:1,master,secondary}};
}
async function main({env=process.env,transport=fetch,log=console.log}={}){
 const result=await readBoth({token:env.META_WHATSAPP_SECONDARY_TOKEN,transport});
 if(result.snapshot){fs.mkdirSync('work/auto-meta',{recursive:true});fs.writeFileSync('work/auto-meta/respaldo-categorias-secundario.json',JSON.stringify(result.snapshot,null,2)+'\n');}
 log('CATEGORIAS_SECUNDARIO_META: '+JSON.stringify(result.comparison||result));
 if(result.snapshot)log('CATEGORIAS_SECUNDARIO_SNAPSHOT: '+JSON.stringify({master:{catalog:result.snapshot.master.catalog,sets:result.snapshot.master.sets},secondary:{catalog:result.snapshot.secondary.catalog,sets:result.snapshot.secondary.sets}}));
 return result;
}
module.exports={MASTER,SECONDARY,compare,readBoth,main,hash,stable};
if(require.main===module)main().catch(()=>{console.error('CATEGORIAS_SECUNDARIO_META: LECTURA_NO_COMPLETADA');process.exitCode=1;});
