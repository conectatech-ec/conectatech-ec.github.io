'use strict';
const assert=require('assert/strict');
const fs=require('fs');
const {sugerencias,inyectar}=require('./venta-cruzada.cjs');
const html=fs.readFileSync('index.html','utf8');
const match=html.match(/const products=(\[[\s\S]*?\]);\s*\n/);
assert(match,'Catálogo publicado no encontrado');
const products=JSON.parse(match[1]);
const slugs=JSON.parse(fs.readFileSync('seo-pages.json','utf8'));
const bySku=new Map(products.map(p=>[p.sku,p]));
let phones=0, recommendations=0;
for(const phone of products){
 const items=sugerencias(phone,products,slugs);
 if(items.length)phones++;
 assert(items.length<=4,'Máximo 4 accesorios por teléfono');
 for(const item of items){
  recommendations++;
  const p=bySku.get(item.sku);
  assert(p,'SKU inexistente '+item.sku);
  assert(p.stock>0,'Stock no disponible '+item.sku);
  assert.equal(item.promo,p.promo,'Precio contado ajeno a 593');
  assert.equal(item.pvp,p.pvp,'PVP ajeno a 593');
  assert(item.href.startsWith('/productos/'),'URL inválida');
  assert(item.warning&&item.warning.toLowerCase().includes('confirmar'),'Advertencia ausente');
 }
 if(!(phone.stock>0))assert.equal(items.length,0,'Teléfono agotado con recomendación');
}
const a17=bySku.get('TELF011');
assert(a17,'TELF011 no existe');
const preview=inyectar('<html><head></head><body><main><article><h1>A17</h1></article></main></body></html>',a17,products,slugs);
assert(preview.includes('Completa tu compra'),'Falta módulo en ficha');
assert(preview.includes('data-ct-vc-action'),'Falta interacción de selección');
assert(!inyectar('<html></html>',bySku.get('ESTU050'),products,slugs).includes('Completa tu compra'),'Agregó venta cruzada a estuche');
console.log(JSON.stringify({skuCatalogo:products.length,telefonos:phones,recomendaciones,resultado:'OK'},null,2));
