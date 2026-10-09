const fs=require('fs');
module.exports=function(){
 const registry=JSON.parse(fs.readFileSync('importacion/reglas-sku.json','utf8'));
 const media=fs.existsSync('importacion/medios.json')?JSON.parse(fs.readFileSync('importacion/medios.json','utf8')):{};
 let html=fs.readFileSync('index.html','utf8');const rx=/const products=(\[[\s\S]*?\]);\s*\n/;
 const products=JSON.parse(html.match(rx)[1]);const seo=JSON.parse(fs.readFileSync('seo-contenido.json','utf8'));
 for(const p of products){
  const r=registry.productos[p.sku];if(!r)throw Error('Falta registro de reglas para '+p.sku);
  const m=media[p.sku];if(!m&&!r.revision)continue;
  const photos=m?.revision_regla===r.revision?m.imagenes.filter(i=>(r.presentacion!=='sin caja'||i.contiene_caja===false)):[];
  const cover=photos.find(i=>i.posicion===1&&(r.presentacion!=='con caja'||i.contiene_caja===true));
  p.imageUrl=cover?.versiones['1200'].url||'';
  const c=seo[p.sku];if(!c)continue;
  c.imagen=p.imageUrl;c.imagenPendiente=!cover;c.reglaSKU=r;c.galeria=photos;
  if(cover)c.imagenProfesional=cover;else delete c.imagenProfesional;
  if(m?.banner?.revision_regla===r.revision&&cover)c.banner=m.banner;else delete c.banner;
 }
 const changed=html.replace(rx,'const products='+JSON.stringify(products).replace(/</g,'\\u003c')+';\n');
 if(changed!==html)fs.writeFileSync('index.html',changed);
 const encoded=JSON.stringify(seo,null,2)+'\n';if(encoded!==fs.readFileSync('seo-contenido.json','utf8'))fs.writeFileSync('seo-contenido.json',encoded);
};
if(require.main===module)module.exports();
