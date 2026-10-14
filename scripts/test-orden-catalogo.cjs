// Ejecuta el comparador real: una edición reciente no queda detrás de novedades antiguas.
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const code=html.slice(html.indexOf('const updatedAt='),html.indexOf('function productImage('));
const meta={OLD:{tipoCambio:'nuevo',actualizadoEn:'2026-10-01'},EDIT:{tipoCambio:'actualizado',actualizadoEn:'2026-10-14'},NEW:{tipoCambio:'nuevo',actualizadoEn:'2026-10-14'},BASE:{tipoCambio:'catalogo',actualizadoEn:'2026-10-15'}};
const ctx={catalogMeta:meta,sortSelector:{value:'recientes'},seoPages:{},rows:['OLD','BASE','EDIT','NEW'].map(sku=>({sku,imageUrl:'foto',promo:1,name:sku}))};
vm.createContext(ctx);vm.runInContext(code,ctx);
assert.deepEqual(Array.from(vm.runInContext('orderedProducts(rows.slice()).map(p=>p.sku)',ctx)),['NEW','EDIT','OLD','BASE']);
ctx.sortSelector.value='catalogo';assert.deepEqual(Array.from(vm.runInContext('orderedProducts(rows.slice()).map(p=>p.sku)',ctx)),['OLD','BASE','EDIT','NEW']);
console.log('Orden real: edición reciente primero; empate nuevos primero; catálogo original conservado.');
