'use strict';
const merchandising=require('./prioridad-comercial-meta.cjs');
// Misma clasificación que aplica index.html; no mantiene una taxonomía alternativa.
function familiesFromHTML(html){
 const m=html.match(/const categoryFamilies=({[^\n]*});/);
 if(!m)throw Error('No se encontró la clasificación publicada de la web');
 return JSON.parse(m[1]);
}
const key=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const aprobacionesTelefonos27Oct=new Set(['TELF001','TELF012','TELF015']);
function classify(products,content,families){
 const bySKU=new Map(),groups=new Map();
 for(const p of products){
  if(bySKU.has(p.sku))throw Error('SKU duplicado: '+p.sku);
  const family=p.categoriaComercial||families[p.category]||'Hogar y Accesorios';
  if(typeof family!=='string'||!family.trim())throw Error('Categoría comercial inválida');
  const presentation=merchandising.presentationFamily(p,family);
  const label='ct-web:'+key(presentation),c=content[p.sku]||{};
  // Dirección aprobó TODOS los teléfonos del catálogo vigente el 27/10/2026.
  // Estos son los tres SKU aún sin comercialVerificado; los demás ya estaban aprobados.
  // Lista cerrada: un teléfono futuro seguirá requiriendo autorización editorial.
  // Nunca se omite una imagen expresamente pendiente ni se altera disponibilidad.
  const approved=c.imagenPendiente!==true&&(c.comercialVerificado===true||(p.category==='Telefonos'&&aprobacionesTelefonos27Oct.has(p.sku)));
  const row={sku:p.sku,categoria_web:p.category,familia_web:family,familia_whatsapp:presentation,stock:p.stock,price:p.promo,label:approved?label:'',aprobado:approved};
  bySKU.set(p.sku,row);
  if(!groups.has(label))groups.set(label,{label,retailer_id:'conectatech-web:'+key(presentation),name:'CONECTATECH | '+presentation.toUpperCase(),family:presentation,
   aliases:family==='Celulares y Smartphones'?['CONECTATECH | CELULARES','Conectatech | Celulares']:[],
   filter:{and:[{custom_label_0:{eq:label}},{availability:{eq:'in stock'}}]},sku:[]});
 }
 return {bySKU,groups};
}
function planFromFeed(classification,meta,inventoryState){
 const groups=new Map([...classification.groups].map(([k,v])=>[k,{...v,sku:[]}]));
 const exclusions=[];
 for(const p of meta){
  const c=classification.bySKU.get(p.id);if(!c)throw Error('SKU Meta no pertenece a la web: '+p.id);
  if(c.label!==p.custom_label_0)throw Error('Etiqueta no coincide con la web: '+p.id);
  if(p.custom_label_0&&p.availability==='in stock')groups.get(p.custom_label_0).sku.push(p.id);
  else exclusions.push({sku:p.id,motivo:p.availability!=='in stock'?'AGOTADO':'PENDIENTE_APROBACIÓN'});
 }
 for(const g of groups.values())g.sku.sort();
 return {version:1,catalog_id:'1036301566100990',fecha_corte:inventoryState.fecha_corte,fuente_sha256:inventoryState.origen_sha256,
  fuente_categorias:'index.html: categoriaComercial || categoryFamilies[category] || Hogar y Accesorios',
  groups:merchandising.decorate([...groups.values()],classification.bySKU),exclusions,
  prioridad_colecciones_whatsapp_verificada:false,
  criterio_destacados:'Selección comercial por SKU, aprobación y disponibilidad del corte; sustitución automática al agotarse. No presupone ventas ni altera títulos o precios.',
  productos_meta:meta.length,colecciones_whatsapp_verificadas:false};
}
module.exports={familiesFromHTML,classify,planFromFeed};
