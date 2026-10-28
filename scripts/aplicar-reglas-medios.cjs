const fs=require('fs');
const titleCommercial=require('./titulo-comercial.cjs');
const compatibleRevision=require('./regla-medios-compatible.cjs');
module.exports=function(){
 const registry=JSON.parse(fs.readFileSync('importacion/reglas-sku.json','utf8'));
 const media=fs.existsSync('importacion/medios.json')?JSON.parse(fs.readFileSync('importacion/medios.json','utf8')):{};
 const editorial=fs.existsSync('importacion/editorial/publicados.json')?JSON.parse(fs.readFileSync('importacion/editorial/publicados.json','utf8')):null;
 let html=fs.readFileSync('index.html','utf8');const rx=/const products=(\[[\s\S]*?\]);\s*\n/;
 const products=JSON.parse(html.match(rx)[1]);const seo=JSON.parse(fs.readFileSync('seo-contenido.json','utf8'));
 for(const p of products){
  const r=registry.productos[p.sku];if(!r)throw Error('Falta registro de reglas para '+p.sku);
  if(registry.politica_general?.presentacion_obligatoria==='sin caja')r.presentacion='sin caja';
  const c=seo[p.sku]||(seo[p.sku]={});
  c.reglaSKU=r;
  if(registry.politica_general?.titulos_comerciales?.condicion_en_titulo===false){
    // La presentación editorial conserva el nombre base, la URL y el SEO originales.
    // La condición se muestra mediante su etiqueta, sin reescribir esos nombres.
    if(!(editorial?.activo&&(editorial.productos?.[p.sku]||editorial.actualizacionesFicha?.[p.sku]))){
      p.name=titleCommercial(p.name,p.sku,r.autenticidad);
      if(c.nombre)c.nombre=titleCommercial(c.nombre,p.sku,r.autenticidad);
      if(c.tituloSeo)c.tituloSeo=titleCommercial(c.tituloSeo,p.sku,r.autenticidad);
    }
    c.tipo=r.autenticidad==='genérico/compatible'?'generico':'original';
    c.clasificacionComercial=c.tipo==='generico'?'AAA / genérico':'Producto original';
  }
  const m=media[p.sku];if(!m)continue; // Un nuevo registro no invalida imágenes heredadas por mera ausencia de metadatos.
  const approvedRevision=compatibleRevision(m,r);
  const photos=approvedRevision?m.imagenes.filter(i=>
   (r.presentacion!=='sin caja'||i.contiene_caja===false)&&
   (r.marcas_excluidas_imagen||[]).every(brand=>{
    const v=i.revision_marcas?.[brand];
    return v?.sin_texto===true&&v?.sin_logotipo===true&&v?.evidencia&&v.sha256_maestro===i.sha256_original;
   })):[];
  const cover=photos.find(i=>i.posicion===1&&(r.presentacion!=='con caja'||i.contiene_caja===true));
  const premium={MOUS039:'MOUS039',SOPO009:'SOPO009',SOPO023:'SOPO023',SOPO058:'SOPO058'};
  const premiumPath=premium[p.sku]?`/imagenes/${p.sku.toLowerCase()}/${p.sku}-premium-v1.png`:null;
  const premiumReady=!!premiumPath&&fs.existsSync('.'+premiumPath);
  p.imageUrl=premiumReady?premiumPath:(cover?.versiones['1200'].url||'');
  c.imagen=p.imageUrl;c.imagenPendiente=!premiumReady&&!cover;c.reglaSKU=r;c.galeria=photos;
  if(cover)c.imagenProfesional=cover;else delete c.imagenProfesional;
  if(approvedRevision&&m?.banner?.revision_regla===m.revision_regla&&cover)c.banner=m.banner;else delete c.banner;
 }
 const changed=html.replace(rx,'const products='+JSON.stringify(products).replace(/</g,'\\u003c')+';\n');
 if(changed!==html)fs.writeFileSync('index.html',changed);
 const encoded=JSON.stringify(seo,null,2)+'\n';if(encoded!==fs.readFileSync('seo-contenido.json','utf8'))fs.writeFileSync('seo-contenido.json',encoded);
};
if(require.main===module)module.exports();
