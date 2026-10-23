'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const core=require('../assets/disponibilidad-core.js'),web=require('./disponibilidad-web.cjs');
const root=fs.readFileSync('index.html','utf8');
const products=JSON.parse(root.match(/const products=(\[[\s\S]*?\]);\s*\n/)[1]);
const slugs=JSON.parse(fs.readFileSync('seo-pages.json'));
const source=JSON.parse(fs.readFileSync('datos-593/corte-stock-validado.json'));
const prior=JSON.parse(fs.readFileSync('datos-593/estado-ultimo-corte.json'));
const base=process.argv.find(x=>x.startsWith('--base='))?.slice(7);
const old=path=>cp.execFileSync('git',['show',base+':'+path],{encoding:'utf8',maxBuffer:8e6});
const schemas=h=>JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
const tags=(h,re)=>h.match(re)||[];
if(base){assert.deepEqual(products,JSON.parse(old('index.html').match(/const products=(\[[\s\S]*?\]);\s*\n/)[1]));assert.deepEqual(slugs,JSON.parse(old('seo-pages.json')));}
const counts={available:0,out_of_stock:0,review_required:0,unknown:0};
for(const p of products){
 assert.equal(p.stock,source.stock_por_sku[p.sku],p.sku+' vinculación 593');
 const a=core.forProduct(p);counts[a.status]++;
 const path='productos/'+slugs[p.sku]+'/index.html',html=fs.readFileSync(path,'utf8'),schema=schemas(html);
 assert(html.includes('data-availability-web="'+a.status+'"'),p.sku+' estado ficha');
 assert.equal(schema.offers.availability,'https://schema.org/'+(a.commercial_eligible?'InStock':'OutOfStock'));
 assert(html.includes('Inventario actualizado al 21/10/2026'),p.sku+' fecha');
 assert(!html.includes('Stock: 0'),p.sku+' no cantidades internas');
 if(!a.commercial_eligible)assert(html.includes('data-availability-historical-price'),p.sku+' precios históricos ocultos');
 if(a.replenishment){
  assert(html.includes('Temporalmente agotado'));assert(html.includes('Consulta cuándo estará disponible nuevamente'));
  const url=new URL(html.match(/href="(https:\/\/wa.me\/593998576759\?text=[^"]+)"[^>]*>Consultar reposición/)[1]);
  assert.equal(url.searchParams.get('text'),'Hola, quisiera consultar la reposición de '+schema.name+', código '+p.sku+'.');
 }
 if(base){
  const before=old(path),bs=schemas(before);delete bs.offers.availability;delete schema.offers.availability;assert.deepEqual(schema,bs,p.sku+' SEO/precios intactos');
  for(const re of [/<title>[\s\S]*?<\/title>/g,/<h[12]\b[^>]*>[\s\S]*?<\/h[12]>/g,/<img\b[^>]*>/g,/<meta\b[^>]*>/g,/<link rel="canonical"[^>]*>/g,/<div class="pvp">[^<]*<\/div>/g])assert.deepEqual(tags(html,re),tags(before,re),p.sku+' contenido protegido');
 }
}
assert.deepEqual(counts,{available:1130,out_of_stock:39,review_required:1,unknown:0});
const plan=require('./aplicar-corte-stock.cjs').planificar(root,source,prior);assert.equal(plan.changes.length,0,'No reaplicar corte #89');
for(const [stock,status] of [[5,'available'],[0,'out_of_stock'],[-1,'review_required'],[null,'unknown'],[undefined,'unknown'],[3,'available']])assert.equal(core.forProduct({stock}).status,status);
assert.equal(core.forProduct({stock:5,synced_at:'2000-01-01'}).commercial_eligible,true,'Un reporte antiguo no bloquea ventas');
assert.equal(core.forProduct({stock:5,discontinued:true,evidence:'Acta oficial'}).status,'discontinued');
assert.equal(web.renderCatalogDate(root,null),root,'Fallo de sincronización conserva última fecha');
const template=stock=>'<html><head></head><body><p class="muted">SKU DEMO001</p><p>⚡ PROMO CONTADO</p><div class="price">$10</div><p class="muted">PVP $12</p><script type="application/ld+json">'+JSON.stringify({sku:'DEMO001',name:'Ejemplo',offers:{price:'10'}})+'</script><a href="https://wa.me/593998576759?text=prueba">Consultar</a></body></html>';
for(const stock of [5,0,3]){const p={stock,sku:'DEMO001',name:'Ejemplo'},a=core.forProduct(p),h=web.renderPage(template(stock),p,'21/10/2026');assert(h.includes('data-availability-web="'+a.status+'"'));assert.equal(h.includes('data-availability-historical-price'),stock===0);assert.equal(web.renderPage(h,p,'21/10/2026'),h);}
// Cortes completos de prueba en memoria: ningún fichero de inventario real se modifica.
const importer=require('./aplicar-corte-stock.cjs');let simulated=root,previous=prior;
const target=products[0].sku;
for(const [i,stock] of [5,0,3].entries()){
 const next={...source,fecha_corte:'2026-10-22',sha256:String(i+1).repeat(64),validacion_web:{sku_web_esperados:1170},stock_por_sku:{...source.stock_por_sku,[target]:stock}};
 const result=importer.planificar(simulated,next,previous);assert.equal(result.changes.length,1);assert.equal(result.changes[0].sku,target);
 const item=JSON.parse(result.rendered.match(/const products=(\[[\s\S]*?\]);\s*\n/)[1]).find(p=>p.sku===target);
 assert.equal(core.forProduct(item).main_catalog,stock>0);simulated=result.rendered;previous=result.summary;
}
for(const invalid of [{...source,fecha_corte:'2026-01-01'},{...source,stock_por_sku:{}},{...source,stock_por_sku:{...source.stock_por_sku,[target]:'error'}}])assert.throws(()=>importer.planificar(root,invalid,prior));
assert.equal(fs.readFileSync('index.html','utf8'),root,'Última versión intacta después de cortes inválidos');
console.log(JSON.stringify({resultado:'OK',sku:products.length,corte:source.fecha_corte,counts,cambiosInventario:plan.changes.length,preservacionContra:base||null,reactivacion:'5 → 0 → 3',sincronizacionFallida:'último estado conservado'},null,2));
