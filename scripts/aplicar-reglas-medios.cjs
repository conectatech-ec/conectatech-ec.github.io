const fs=require('fs');
module.exports=function(){
 const registry=JSON.parse(fs.readFileSync('importacion/reglas-sku.json','utf8'));
 const media=fs.existsSync('importacion/medios.json')?JSON.parse(fs.readFileSync('importacion/medios.json','utf8')):{};
 let html=fs.readFileSync('index.html','utf8');const rx=/const products=(\[[\s\S]*?\]);\s*\n/;
 const products=JSON.parse(html.match(rx)[1]);const seo=JSON.parse(fs.readFileSync('seo-contenido.json','utf8'));
 for(const p of products){
  const r=registry.productos[p.sku];if(!r)throw Error('Falta registro de reglas para '+p.sku);
  if(registry.politica_general?.presentacion_obligatoria==='sin caja')r.presentacion='sin caja';
  const m=media[p.sku];if(!m)continue; // Un nuevo registro no invalida imágenes heredadas por mera ausencia de metadatos.
  const photos=m?.revision_regla===r.revision?m.imagenes.filter(i=>
   (r.presentacion!=='sin caja'||i.contiene_caja===false)&&
   (r.marcas_excluidas_imagen||[]).every(brand=>{
    const v=i.revision_marcas?.[brand];
    return v?.sin_texto===true&&v?.sin_logotipo===true&&v?.evidencia&&v.sha256_maestro===i.sha256_original;
   })):[];
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
