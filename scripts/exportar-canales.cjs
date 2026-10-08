const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const m=html.match(/const products=(\[[\s\S]*?\]);\s*\n/);
if(!m)throw Error('No se encontró el catálogo');
const products=JSON.parse(m[1]);
const content=JSON.parse(fs.readFileSync('seo-contenido.json','utf8'));
const urls=JSON.parse(fs.readFileSync('seo-pages.json','utf8'));
const base='https://conectatech-ec.github.io';
const csvField=x=>'"'+String(x??'').replace(/"/g,'""').replace(/\r?\n/g,' ').trim()+'"';
const csv=(columns,rows)=>[columns.join(','),...rows.map(row=>columns.map(key=>csvField(row[key])).join(','))].join('\n')+'\n';
const rows=products.filter(p=>p.stock>0&&p.promo>0).map(p=>{
  const o=content[p.sku]||{};
  return {sku:p.sku,title:o.nombre||p.name,description:o.descripcion||o.descripcionSeo||p.name,
    price:p.promo.toFixed(2)+' USD',pvp:p.pvp.toFixed(2)+' USD',availability:'in stock',condition:'new',
    link:base+'/productos/'+urls[p.sku]+'/',image_link:o.imagen||p.imageUrl||'',
    category:p.category,stock:p.stock,
    facebook_title:(o.nombre||p.name).slice(0,150),
    facebook_copy:(o.descripcion||o.descripcionSeo||p.name)+'\nPROMO CONTADO $'+p.promo.toFixed(2)+' · PVP $'+p.pvp.toFixed(2)+'\nConsulta disponibilidad en Quito. '+base+'/productos/'+urls[p.sku]+'/'};
});
fs.mkdirSync('exportaciones',{recursive:true});
fs.writeFileSync('exportaciones/contenido-multicanal.csv',csv(['sku','title','description','price','pvp','availability','link','image_link','category','stock','facebook_title','facebook_copy'],rows));
const ready=rows.filter(p=>/^https?:\/\//.test(p.image_link));
const knownBrand=sku=>{
  if(['TELF001'].includes(sku))return 'ZTE';
  if(['TELF017','TELF018','TELF019'].includes(sku))return 'Xiaomi';
  if(['TELF011','TELF012'].includes(sku))return 'Samsung';
  return '';
};
const meta=ready.map(p=>({id:p.sku,title:p.title,description:p.description,availability:p.availability,condition:p.condition,price:p.price,link:p.link,image_link:p.image_link,brand:knownBrand(p.sku)}));
fs.writeFileSync('exportaciones/meta-catalogo-piloto.csv',csv(['id','title','description','availability','condition','price','link','image_link','brand'],meta));
fs.writeFileSync('exportaciones/resumen-canales.json',JSON.stringify({
 generated_at:new Date().toISOString(),total_products:rows.length,
 with_image_url:ready.length,without_image_url:rows.length-ready.length,
 meta_pilot_items:ready.length,
 with_recognized_brand:meta.filter(p=>p.brand).length,
 note:'Archivo piloto para revisión en Commerce Manager; publicación, elegibilidad, fotografía y políticas requieren validación. No publica anuncios en Marketplace.'
},null,2)+'\n');
console.log('Exportaciones creadas: '+rows.length+' productos, '+ready.length+' con URL de imagen.');
