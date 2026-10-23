'use strict';
// Presentación web únicamente. La única clasificación comercial vive en el core compartido.
const core=require('../assets/disponibilidad-core.js');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function statusHTML(availability,date){return '<div class="ct-availability ct-availability-'+availability.status+'" data-availability="'+availability.status+'"><span>'+esc(availability.label)+'</span>'+(availability.replenishment?'<strong>Temporalmente agotado</strong>':'')+(date?'<small>Inventario actualizado al '+esc(date)+'</small>':'')+'</div>';}
function renderCatalogDate(html,state){
 if(!state||!/^\d{4}-\d{2}-\d{2}$/.test(state.fecha_corte))return html;
 const date=state.fecha_corte.split('-').reverse().join('/');
 const value='Inventario actualizado al <time id="ct-inventory-date" datetime="'+state.fecha_corte+'">'+date+'</time>';
 if(/Inventario actualizado al <time id="ct-inventory-date"[^>]*>[^<]*<\/time>/.test(html))return html.replace(/Inventario actualizado al <time id="ct-inventory-date"[^>]*>[^<]*<\/time>/,value);
 return html.replace(/Las existencias corresponden a una actualización del \d{2}-\d{2}-\d{4}/,value);
}
function renderPage(html,product,date){
 const a=core.forProduct(product);
 if(html.includes('data-availability-web="'+a.status+'"'))return html;
 if(html.includes('data-availability-web='))throw Error('Regenerar ficha desde plantilla vigente antes de cambiar su disponibilidad: '+product.sku);
 let out=html.replace('</head>','<link rel="stylesheet" href="/assets/disponibilidad-web.css?v=1"></head>');
 const status=/<(div|p) class="(?:status\s*(?:unavailable)?|stock-unavailable)"[^>]*>[\s\S]*?<\/\1>/;
 if(status.test(out))out=out.replace(status,statusHTML(a,date));
 else {const anchor=/<p class="muted">SKU [^<]*<\/p>/;if(!anchor.test(out))throw Error('No se reconoce la ficha '+product.sku);out=out.replace(anchor,m=>m+statusHTML(a,date));}
 // La plantilla genérica histórica repite la fecha/stock junto a "Consulta y compra".
 out=out.replace(/<p class="muted">(?:Inventario actualizado al |Stock: 0 · No disponible · Corte: )\d{2}\/\d{2}\/\d{4} · confirma disponibilidad<\/p>/g,'');
 if(!a.commercial_eligible){
  const pricing=/<div class="pricing">[\s\S]*?<div class="pvp">[\s\S]*?<\/div><\/div>/;
  const generic=/<p>⚡ PROMO CONTADO<\/p><div class="price">[^<]*<\/div><p class="muted">PVP [^<]*<\/p>/;
  const region=pricing.test(out)?pricing:generic;if(!region.test(out))throw Error('No se reconocen los precios '+product.sku);
  out=out.replace(region,original=>'<div hidden data-availability-historical-price>'+original+'</div><div class="ct-av-price-note">'+(a.replenishment?'Consulta cuándo estará disponible nuevamente':'Consulta disponibilidad y condiciones actuales.')+'</div>');
  const schemaText=out.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);const schema=schemaText?JSON.parse(schemaText[1]):null;
  const identity={sku:product.sku,name:schema?.name||product.name};const url=esc(core.whatsappURL(identity,a));
  out=out.replace(/(<a\b[^>]*href=")https:\/\/wa\.me\/593998576759\?text=[^"]*("[^>]*>)[\s\S]*?(<\/a>)/g,(_,start,end,close)=>start+url+end+(a.replenishment?'Consultar reposición':a.status==='discontinued'?'Consultar alternativas':'Consultar disponibilidad')+close);
 }
 out=out.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/,(_,raw)=>{const schema=JSON.parse(raw);if(schema.sku!==product.sku)throw Error('SKU de schema distinto');if(schema.offers){if(a.status==='unknown')delete schema.offers.availability;else schema.offers.availability='https://schema.org/'+(a.commercial_eligible?'InStock':a.status==='discontinued'?'Discontinued':'OutOfStock');}return '<script type="application/ld+json">'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script>';});
 return out.replace('<body>','<body data-availability-web="'+a.status+'">');
}
module.exports={statusHTML,renderCatalogDate,renderPage};
