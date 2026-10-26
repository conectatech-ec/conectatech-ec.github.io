// Exportación de sólo lectura: títulos e imágenes se aprueban en sus proyectos.
const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const m=html.match(/const products=(\[[\s\S]*?\]);\s*\n/);
if(!m)throw Error('No se encontró el catálogo');
const products=JSON.parse(m[1]);
const content=JSON.parse(fs.readFileSync('seo-contenido.json','utf8'));
const urls=JSON.parse(fs.readFileSync('seo-pages.json','utf8'));
const base='https://conectatech-ec.github.io';
const categoriesWeb=require('./categorias-meta-web.cjs');
const classificationWeb=categoriesWeb.classify(products,content,categoriesWeb.familiesFromHTML(html));
const inventoryState=typeof fs.existsSync==='function'&&fs.existsSync('datos-593/estado-ultimo-corte.json')?JSON.parse(fs.readFileSync('datos-593/estado-ultimo-corte.json','utf8')):null;
const {validar}=require('./validar-exportacion-593.cjs');
const cutPaths={comercial:'datos-593/corte-comercial-publico-validado.json',stock:'datos-593/corte-stock-validado.json'};
const cutPath=inventoryState?.referencia||(inventoryState?.precios_y_demas_atributos_intactos===true?cutPaths.stock:null);
if(!Object.values(cutPaths).includes(cutPath))throw Error('Falta referencia al corte validado 593');
const cut=JSON.parse(fs.readFileSync(cutPath,'utf8'));
validar({products,inventoryState,cut});
// Preparar todo antes de escribir: un fallo no deja un lote parcial.
const outputs=new Map();
// Categorías del mismo inventario público593; no inferirlas del título o del SKU.
function parseMasterCSV(str){
 const records=[];let record=[],cell='',quoted=false;
 for(let i=0;i<str.length;i++){
  const c=str[i];
  if(c==='"'){if(quoted&&str[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){record.push(cell);cell='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&str[i+1]==='\n')i++;record.push(cell);cell='';if(record.some(x=>x!==''))records.push(record);record=[];}
  else cell+=c;
 }
 if(quoted)throw Error('Inventario593: comillas sin cerrar');
 if(record.length||cell){record.push(cell);records.push(record);}
 const headers=(records.shift()||[]).map(h=>h.replace(/^\uFEFF/,'').trim());
 if(!headers.includes('sku')||!headers.includes('categoria'))throw Error('Inventario593 sin SKU/categoría');
 return records.map((r,i)=>{if(r.length!==headers.length)throw Error('Inventario593: columnas inconsistentes en fila '+(i+2));return Object.fromEntries(headers.map((h,j)=>[h,r[j].trim()]));});
}
const masterCategories=new Map();
for(const row of parseMasterCSV(fs.readFileSync('datos-593/inventario-publico.csv','utf8'))){
 if(masterCategories.has(row.sku))throw Error('SKU duplicado en inventario593: '+row.sku);
 masterCategories.set(row.sku,row.categoria);
}
const productType=sku=>{
 if(!masterCategories.has(sku))throw Error('SKU ausente en inventario593: '+sku);
 const category=masterCategories.get(sku);
 return sku.startsWith('TELF')&&category==='TELEFONOS'?'Celulares':category;
};
const csvField=x=>'"'+String(x??'').replace(/"/g,'""').replace(/\r?\n/g,' ').trim()+'"';
const csv=(columns,rows)=>[columns.join(','),...rows.map(row=>columns.map(key=>csvField(row[key])).join(','))].join('\n')+'\n';
const rows=products.filter(p=>p.stock>0&&p.promo>0).map(p=>{
  const o=content[p.sku]||{};
  return {sku:p.sku,title:o.nombre||p.name,description:o.descripcion||o.descripcionSeo||p.name,
    price:p.promo.toFixed(2)+' USD',pvp:p.pvp.toFixed(2)+' USD',availability:'in stock',condition:'new',
    link:base+'/productos/'+urls[p.sku]+'/',image_link:(o.imagen||p.imageUrl)?new URL(o.imagen||p.imageUrl,base).href:'',
    category:p.category,stock:p.stock,
    facebook_title:(o.nombre||p.name).slice(0,150),
    facebook_copy:(o.descripcion||o.descripcionSeo||p.name)+'\nPROMO CONTADO $'+p.promo.toFixed(2)+' · PVP $'+p.pvp.toFixed(2)+'\nConsulta disponibilidad en Quito. '+base+'/productos/'+urls[p.sku]+'/'};
});
const salesProducts=products.filter(p=>p.stock>0&&p.promo>0).map(p=>({sku:p.sku,nombre:p.name,categoria:p.category,stock:p.stock,promo:p.promo,pvp:p.pvp,url:base+'/productos/'+urls[p.sku]+'/'}));
outputs.set('exportaciones/catalogo-ventas.json',JSON.stringify({fechaCatalogo:new Date().toISOString(),fecha_corte:inventoryState?.fecha_corte||null,fuente_sha256:inventoryState?.origen_sha256||null,fuente:'Sistema 593: disponibilidad y precios sujetos a confirmación',productos:salesProducts})+'\n');
outputs.set('exportaciones/contenido-multicanal.csv',csv(['sku','title','description','price','pvp','availability','link','image_link','category','stock','facebook_title','facebook_copy'],rows));
const ready=rows.filter(p=>/^https?:\/\//.test(p.image_link));
const knownBrand=sku=>{
  const product=products.find(p=>p.sku===sku);
  const brand=content[sku]?.caracteristicas?.Marca||product?.specs?.Marca;
  if(brand)return brand;
  if(['TELF001'].includes(sku))return 'ZTE';
  if(['TELF017','TELF018','TELF019'].includes(sku))return 'Xiaomi';
  if(['TELF011','TELF012'].includes(sku))return 'Samsung';
  return '';
};
// Los agotados conservan su ID: omitirlos puede dejar disponibilidad anterior en Meta.
const meta=products.filter(p=>p.promo>0).map(p=>{
 const o=content[p.sku]||{},image=o.imagen||p.imageUrl;
 if(!image)return null;
 const image_link=new URL(image,base).href;
 if(!/^https?:\/\//.test(image_link))return null;
 return {id:p.sku,title:o.nombre||p.name,description:o.descripcion||o.descripcionSeo||p.name,
 availability:p.stock>0?'in stock':'out of stock',condition:'new',price:p.promo.toFixed(2)+' USD',
 link:base+'/productos/'+urls[p.sku]+'/',image_link,brand:knownBrand(p.sku),product_type:productType(p.sku),custom_label_0:classificationWeb.bySKU.get(p.sku).label};
}).filter(Boolean);
outputs.set('exportaciones/meta-catalogo-piloto.csv',csv(['id','title','description','availability','condition','price','link','image_link','brand','product_type','custom_label_0'],meta));
outputs.set('exportaciones/resumen-canales.json',JSON.stringify({
 generated_at:new Date().toISOString(),fecha_corte:inventoryState?.fecha_corte||null,fuente_sha256:inventoryState?.origen_sha256||null,total_products:rows.length,
 with_image_url:ready.length,without_image_url:rows.length-ready.length,
 meta_pilot_items:meta.length,
 meta_out_of_stock:meta.filter(p=>p.availability==='out of stock').length,
 with_recognized_brand:meta.filter(p=>p.brand).length,
 with_product_type:meta.filter(p=>p.product_type).length,
 without_master_category:meta.filter(p=>!p.product_type).map(p=>p.id),
 note:'Archivo piloto para revisión en Commerce Manager; publicación, elegibilidad, fotografía y políticas requieren validación. No publica anuncios en Marketplace.'
},null,2)+'\n');

const webPlan=categoriesWeb.planFromFeed(classificationWeb,meta,inventoryState);
outputs.set('exportaciones/meta-conjuntos-web.json',JSON.stringify(webPlan,null,2)+'\n');
outputs.set('exportaciones/whatsapp-organizacion-pendiente.json',JSON.stringify({
 catalogo_id:webPlan.catalog_id,fecha_corte:webPlan.fecha_corte,fuente_sha256:webPlan.fuente_sha256,
 fuente_categorias:webPlan.fuente_categorias,publicacion_habilitada:false,colecciones_automaticas_verificadas:false,
 colecciones:Object.fromEntries(webPlan.groups.filter(g=>g.sku.length).map(g=>[g.family,g.sku])),
 registros:products.map(p=>{const c=classificationWeb.bySKU.get(p.sku),o=content[p.sku]||{};
  const estados=[];if(!(p.stock>0))estados.push('AGOTADO');
  if(o.imagenPendiente===true||!(o.imagen||p.imageUrl))estados.push('PENDIENTE_IMAGEN');
  estados.push('PENDIENTE_APROBACIÓN');
  return {sku:p.sku,categoria_web:c.categoria_web,familia_web:c.familia_web,aprobacion_editorial:c.aprobado,
   estados,verificacion_meta_pendiente:true,visible_whatsapp:null};})
},null,2)+'\n');
fs.mkdirSync('exportaciones',{recursive:true});
for(const [path,value] of outputs)fs.writeFileSync(path,value);
console.log('Exportaciones preparadas: '+rows.length+' disponibles; Meta '+meta.length+' SKU, incluidos '+meta.filter(p=>p.availability==='out of stock').length+' agotados. Importación y visibilidad pendientes de Meta.');
