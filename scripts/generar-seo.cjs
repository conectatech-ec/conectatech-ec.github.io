const photoDirection=require('./fotografia-direccion.cjs');
const photoSelection=photoDirection.capture();
require('./aplicar-reglas-medios.cjs')();
photoDirection.restore(photoSelection);
const frameFs=require('fs');
const frameFile='importacion/encuadres-producto.json';
if(frameFs.existsSync(frameFile)){const frames=JSON.parse(frameFs.readFileSync(frameFile)).productos;let page=frameFs.readFileSync('index.html','utf8');const line='const productFrames='+JSON.stringify(frames)+';\n';page=/const productFrames=.*?;\n/.test(page)?page.replace(/const productFrames=.*?;\n/,()=>line):page.replace('const products=',line+'const products=');frameFs.writeFileSync('index.html',page);}

const fs=require('fs'),path=require('path');
const estadoStock=fs.existsSync('datos-593/estado-ultimo-corte.json')?JSON.parse(fs.readFileSync('datos-593/estado-ultimo-corte.json','utf8')):null;
const fechaPublicada=estadoStock&&/^\d{4}-\d{2}-\d{2}$/.test(estadoStock.fecha_corte)?estadoStock.fecha_corte.split('-').reverse().join('/'):null;
const fichaComercial=require('./ficha-comercial.cjs');
const formatoPotencia=require('../assets/formato-potencia.js');
const condicionFicha=require('./condicion-ficha.cjs');
const ventaCruzada=require('./venta-cruzada.cjs');
const disponibilidadWeb=require('./disponibilidad-web.cjs');
const sourceHTML=fs.readFileSync('index.html','utf8');
const html=disponibilidadWeb.renderCatalogDate(sourceHTML,estadoStock);
const m=html.match(/const products=(\[[\s\S]*?\]);\s*\n/);
if(!m)throw Error('No se encontró la base de productos');
const products=JSON.parse(m[1]), origin='https://conectatech-ec.github.io';
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const slug=p=>p.sku.toLowerCase()+'-'+p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,78);
const overrides=JSON.parse(fs.readFileSync('seo-contenido.json','utf8'));
const stable=fs.existsSync('seo-pages.json')?JSON.parse(fs.readFileSync('seo-pages.json','utf8')):{};
const out=path.join('productos');fs.mkdirSync(out,{recursive:true});
const links={};const urls=[origin+'/'];
const skuIndex=process.argv.indexOf('--sku');
const selected=skuIndex<0?null:new Set(process.argv.slice(skuIndex+1));
for(const p of products){
 if(!(p.promo>0))continue;
 const id=stable[p.sku]||slug(p),url=origin+'/productos/'+id+'/';
 links[p.sku]=id;urls.push(url);
 if(selected&&!selected.has(p.sku))continue;
 const custom={...(overrides[p.sku]||{}),...(fechaPublicada?{fechaInventario:fechaPublicada}:{})};
 // Referencia fotográfica expresamente aprobada; limitada a PROT003.
 if(p.sku==='PROT003'){
  const photoFile=path.join('importacion','fotografia-publicada','PROT003.json');
  if(fs.existsSync(photoFile)){
   const approved=JSON.parse(fs.readFileSync(photoFile,'utf8'));
   const photo=approved.imagenProfesional;
   if(approved.sku==='PROT003'&&approved.aprobado_por_propietario===true&&
      approved.maestro_aprobado_sha256==='ec2a21e15462f82bed2c87963ee69e46fc961ad998613a9176be5341f3393f53'&&
      photo?.versiones?.['1200']?.url==='/imagenes/prot003/PROT003-r20261024-01.webp'&&
      [approved.imagen_anterior,photo.versiones['1200'].url].includes(custom.imagen)){
    custom.imagen=photo.versiones['1200'].url;
    custom.imagenProfesional=photo;
    custom.galeria=[photo];
    custom.imagenPendiente=false;
   }
  }
 }

 // Secundarias verificadas: añadir vistas sin sustituir portadas vigentes.
 if(['HUB011', 'AUDI095', 'ADAP063', 'MOUS003', 'AUDI057', 'AUDI036', 'AUDI053', 'AUDI034', 'AUDI025', 'AUDI026', 'AUDI082', 'AUDI073', 'AUDI018'].includes(p.sku)){
  const secondaryFile=path.join('importacion','fotografia-publicada',['AUDI036', 'AUDI053', 'AUDI034', 'AUDI025', 'AUDI026', 'AUDI082', 'AUDI073', 'AUDI018'].includes(p.sku)?'secundarias-rapido-20261026-04.json':['MOUS003','AUDI057'].includes(p.sku)?'secundarias-audio-computacion-20261026-03.json':p.sku==='ADAP063'?'secundarias-conexiones-20261026-02.json':'secundarias-20261026.json');
  if(fs.existsSync(secondaryFile)){
   const row=JSON.parse(fs.readFileSync(secondaryFile,'utf8')).productos?.[p.sku];
   const coverHash=custom.imagenProfesional?.versiones?.['1200']?.sha256;
   if(row?.sku===p.sku&&row.revisado_visual===true&&row.portada_sha256===coverHash){
    const existing=custom.galeria||[];
    const urls=new Set(existing.map(i=>i.versiones?.['1200']?.url));
    custom.galeria=[...existing,...row.vistas.filter(i=>!urls.has(i.versiones['1200'].url))];
   }
  }
 }

 photoDirection.overlay(p,custom,photoSelection);
 const displayName=custom.nombre||p.name;
 const productImage=custom.imagen||p.imageUrl||'';
 const title=custom.tituloSeo||displayName+' en Quito | ConectaTech';
 const desc=custom.descripcionSeo||displayName+' en ConectaTech Quito. Precio promo contado USD '+p.promo.toFixed(2)+'. Factura, garantía y entregas. Confirma stock por WhatsApp.';
 const schema={'@context':'https://schema.org','@type':'Product',name:displayName,sku:p.sku,description:desc,...(productImage?{image:[productImage]}:{}),offers:{'@type':'Offer',url,priceCurrency:'USD',price:p.promo.toFixed(2),availability:p.stock>0?'https://schema.org/InStock':'https://schema.org/OutOfStock',itemCondition:'https://schema.org/NewCondition',seller:{'@type':'Organization',name:'ConectaTech'}}};
 const verifiedSpecs=custom.caracteristicas||p.specs;
 const specs=verifiedSpecs?Object.entries(verifiedSpecs).map(([k,v])=>'<div class="spec"><b>'+esc(k)+'</b><span>'+esc(v)+'</span></div>').join(''):'';
 const wa='https://wa.me/593998576759?text='+encodeURIComponent('Hola ConectaTech, me interesa '+displayName+' ('+p.sku+'). ¿Está disponible?');
 const content=custom.comercialVerificado ? fichaComercial(p,custom,url) : '<!doctype html><html lang="es-EC"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><meta name="description" content="'+esc(desc)+'"><link rel="canonical" href="'+url+'"><link rel="icon" href="/logo-conectatech.png"><script type="application/ld+json">'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script><style>body{margin:0;background:#f4f7fc;font:16px system-ui;color:#14263c}header{background:linear-gradient(115deg,#0b1c35,#0b56d6,#64b83f);padding:15px}header a{color:white;text-decoration:none;font-weight:bold}header img{height:60px;vertical-align:middle}main{max-width:820px;margin:25px auto;padding:0 15px}article{background:white;border-radius:20px;padding:25px;box-shadow:0 8px 30px #15283c18}.photo{width:100%;height:320px;object-fit:contain}.price{font-size:34px;color:#08774e;font-weight:900}.muted{color:#63758a}.wa{display:block;background:#138d58;color:white;text-decoration:none;text-align:center;font-weight:800;padding:15px;border-radius:12px;margin:20px 0}.specs{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.spec{background:#f0f5fa;border-radius:10px;padding:12px}.spec b{display:block;font-size:12px;color:#53657a}</style></head><body><header><a href="/"><img src="/logo-conectatech.png" alt="ConectaTech"> CONECTATECH · Catálogo oficial</a></header><main><article><a href="/">← Volver al catálogo</a><h1>'+esc(displayName)+'</h1>'+(productImage?'<img class="photo" src="'+esc(productImage)+'" alt="'+esc(displayName)+'" loading="lazy">':'')+'<p class="muted">SKU '+esc(p.sku)+' · Quito, Ecuador</p>'+(p.stock>0?'':'<p class="stock-unavailable" style="font-weight:800;color:#991b1b;background:#fef2f2;border:1px solid #fecaca;padding:8px 12px;border-radius:8px">Stock: 0 · No disponible</p>')+'<p>⚡ PROMO CONTADO</p><div class="price">$'+p.promo.toFixed(2)+'</div><p class="muted">PVP $'+p.pvp.toFixed(2)+'</p>'+(specs?'<h2>Características principales</h2><div class="specs">'+specs+'</div>':'')+(custom.descripcion?'<h2>Descripción</h2><p>'+esc(custom.descripcion)+'</p>':'') +(custom.fuenteOficial&&/^https:\/\//.test(custom.fuenteOficial)?'<p><a href="'+esc(custom.fuenteOficial)+'" target="_blank" rel="noopener noreferrer">Consultar ficha técnica oficial del fabricante ↗</a></p>':'')+'<h2>Consulta y compra</h2><p>Local físico en Quito, factura, garantía y opciones de entrega. Consulta las características y compatibilidad antes de comprar.</p><a class="wa" href="'+wa+'" target="_blank" rel="noopener">Consultar por WhatsApp</a><p class="muted">Precios y disponibilidad sujetos a confirmación.</p></article></main></body></html>';
 const publicContent=!custom.comercialVerificado&&custom.tipo==='generico'
  ? content.replace('<p>⚡ PROMO CONTADO</p>','<p class="muted"><strong>Condición: '+esc(condicionFicha.label(p,custom))+'</strong></p><p>⚡ PROMO CONTADO</p>')
  : content;
 const visibleContent=publicContent.slice(0,publicContent.indexOf('</head>'))+condicionFicha.visible(p,custom,publicContent.slice(publicContent.indexOf('</head>')));
 const contentFecha=fechaPublicada&&!custom.comercialVerificado?visibleContent.replace('<h2>Consulta y compra</h2>','<p class="muted">'+(p.stock>0?'Inventario actualizado al ':'Stock: 0 · No disponible · Corte: ')+fechaPublicada+' · confirma disponibilidad</p><h2>Consulta y compra</h2>'):visibleContent;
 const dir=path.join(out,id);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'index.html'),formatoPotencia.html(disponibilidadWeb.renderPage(ventaCruzada.inyectar(contentFecha,p,products,stable).replace(/^[ \t]+$/gm,''),p,fechaPublicada)));
}
const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(u=>'  <url><loc>'+u+'</loc></url>').join('\n')+'\n</urlset>\n';
fs.writeFileSync('sitemap.xml',xml);
fs.writeFileSync('seo-pages.json',JSON.stringify(links,null,2)+'\n');
const mapLine='const seoPages='+JSON.stringify(links)+';';
const seoPagesPattern=/const seoPages=Object.fromEntries\([^\n]*\);|const seoPages=\{[^\n]*\};/;
if(!seoPagesPattern.test(html))throw Error('No se encontró el mapeo SEO en index.html');
const updated=html.replace(seoPagesPattern,mapLine);
if(updated!==sourceHTML)fs.writeFileSync('index.html',updated);
console.log('Generadas '+Object.keys(links).length+' fichas y '+urls.length+' URLs.');
