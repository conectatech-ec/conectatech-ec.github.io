'use strict';
// Corta stock validado de Sistema 593. El XLSX privado no se publica.
// Modo predeterminado: comprobar sin cambiar archivos; --apply aplica solo cambios auditados.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const SNAPSHOT='datos-593/corte-disponibilidad-2026-10-21.json';
const INDEX='index.html';
const REPORT='reportes/disponibilidad-corte-2026-10-21.json';
const REQUIRED_SHA='84568d5865cb0f09380d200e6d08172a8820d4aaec5c970c0f7be53e3c68ffc8';
const apply=process.argv.includes('--apply');
const source=JSON.parse(fs.readFileSync(path.join(ROOT,SNAPSHOT),'utf8'));
assert.equal(source.schema,'conectatech.593.stock-cut.v1');
assert.equal(source.cutoff_at,'2026-10-21');
assert.equal(source.source_sha256,REQUIRED_SHA,'Archivo 593 distinto al validado: no actualizar fecha');
assert.equal(source.source_rows,1554);
assert.equal(source.catalog_rows,1170);
assert.equal(source.changes.length,96);
const html=fs.readFileSync(path.join(ROOT,INDEX),'utf8');
const match=html.match(/const products=(\[[\s\S]*?\]);\s*\n/);
assert(match,'Catálogo web no encontrado');
const products=JSON.parse(match[1]),by=new Map(products.map(p=>[p.sku,p]));
assert.equal(by.size,products.length,'SKU duplicado');
assert.equal(products.length,1170);
let changed=0,unchanged=0;
const seen=new Set();
for(const ch of source.changes){
 assert(/^[A-Z0-9_-]+$/.test(ch.sku));
 assert(!seen.has(ch.sku),'SKU duplicado en corte: '+ch.sku);
 seen.add(ch.sku);
 assert(Number.isInteger(ch.nuevo)&&Number.isInteger(ch.anterior),'Stock no entero');
 const p=by.get(ch.sku);
 assert(p,'SKU inexistente en catálogo: '+ch.sku);
 if(p.stock===ch.nuevo) {unchanged++;continue;}
 assert.equal(p.stock,ch.anterior,'Cambios simultáneos en stock '+ch.sku+'; detener, no sobrescribir');
 p.stock=ch.nuevo;changed++;
}
const totals={total:products.length,disponibles:products.filter(p=>p.stock>0).length,agotados:products.filter(p=>p.stock===0).length,revisar:products.filter(p=>p.stock<0).length};
assert.deepEqual(totals,source.expected_totals,'Corte/total no conciliado: fecha no autorizada');
if(apply){
 const next=html.replace(match[0],'const products='+JSON.stringify(products)+';\n');
 if(changed)fs.writeFileSync(path.join(ROOT,INDEX),next);
 const report={fuente:SNAPSHOT,corte:source.cutoff_at,sha256_fuente:REQUIRED_SHA,fecha_conciliada:source.cutoff_at,actualizados:changed,ya_coincidentes:unchanged,totales:totals,precios_modificados:0,titulos_modificados:0,estado:'CORTE_VALIDADO_APLICADO_A_CATALOGO'};
 fs.mkdirSync(path.dirname(path.join(ROOT,REPORT)),{recursive:true});
 fs.writeFileSync(path.join(ROOT,REPORT),JSON.stringify(report,null,2)+'\n');
}
process.stdout.write(JSON.stringify({modo:apply?'APLICAR':'VERIFICAR',actualizados:changed,ya_coincidentes:unchanged,totales,fecha:source.cutoff_at})+'\n');
