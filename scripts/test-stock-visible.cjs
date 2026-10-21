'use strict';
// Comprueba la disponibilidad visible, incluso para fichas aún sin fotografía.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'', 'playwright'));
const ROOT=path.resolve(__dirname,'..'),PUBLIC='https://conectatech-ec.github.io';
const base=(process.env.BASE_CATALOGO||'http://127.0.0.1:8817').replace(/\/$/,'');
const output=path.resolve(ROOT,process.env.REPORTE_STOCK||'work/stock-cero-visible-20261021/qa-local/stock.json');
const products=JSON.parse(fs.readFileSync(path.join(ROOT,'index.html'),'utf8').match(/const products=(\[[\s\S]*?\]);\s*\n/)[1]);
const zero=products.filter(p=>p.stock<=0),slugs=JSON.parse(fs.readFileSync(path.join(ROOT,'seo-pages.json')));
(async()=>{
 fs.mkdirSync(path.dirname(output),{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});
 const report={fecha:new Date().toISOString(),base,total:products.length,agotados:zero.map(p=>p.sku),vistas:[],fichas:[]};
 try{
 const ctx=await browser.newContext({locale:'es-EC',reducedMotion:'reduce'});
 if(base!==PUBLIC)await ctx.route(PUBLIC+'/**',r=>{const u=new URL(r.request().url());return r.continue({url:base+u.pathname+u.search});});
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ids=()=>page.locator('#grid .ct-compact-card').evaluateAll(cs=>cs.map(c=>c.dataset.sku));
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});assert.equal((await page.goto(base+'/',{waitUntil:'load'})).status(),200);
  await page.locator('#grid .ct-compact-card').first().waitFor();
  assert.match(await page.locator('#count').innerText(),new RegExp('^'+products.length+' productos'));
  const all=[...await ids()],pages=await page.locator('#ct-pages select[data-page-select] option').count();
  for(let n=2;n<=pages;n++){await page.locator('#ct-pages select[data-page-select]').selectOption(String(n));all.push(...await ids());}
  assert.deepEqual(all.sort(),products.map(p=>p.sku).sort(),'Todos los SKU accesibles por paginación');
  for(const p of zero){
   await page.locator('#q').fill(p.sku);assert.deepEqual(await ids(),[p.sku]);
   const card=page.locator('#grid .ct-compact-card'),badge=card.locator('.ct-stock-unavailable');
   await badge.scrollIntoViewIfNeeded();assert(await badge.isVisible());assert.equal(await badge.innerText(),'Stock: 0 · No disponible');
   const layout=await card.evaluate(c=>{const b=c.querySelector('.ct-stock-unavailable'),r=b.getBoundingClientRect(),price=c.querySelector('.ct-compact-prices').getBoundingClientRect();return {height:c.getBoundingClientRect().height,beforePrice:r.bottom<=price.top+1,color:getComputedStyle(b).color,background:getComputedStyle(b).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth};});
   assert(layout.beforePrice);assert(!layout.overflow);assert(layout.height<=(width===1280?520:410),JSON.stringify({sku:p.sku,width,...layout}));
   assert.equal(layout.color,'rgb(153, 27, 27)');assert.equal(layout.background,'rgb(254, 242, 242)');
   if(p.sku==='TELF005')await card.screenshot({path:path.join(path.dirname(output),'agotado-catalogo-'+width+'.png')});
  }
  await page.locator('#q').fill('POWE001');assert.deepEqual(await ids(),['POWE001']);assert.equal(await page.locator('#grid .ct-stock-unavailable').count(),0);
  await page.goto(base+'/?categoria=telefonos#catalogo',{waitUntil:'load'});await page.locator('#q').fill('TELF005');assert.deepEqual(await ids(),['TELF005']);assert(await page.locator('.ct-stock-unavailable').isVisible());
  for(const sku of ['TELF005','BILL006']){
   await page.goto(base+'/productos/'+slugs[sku]+'/',{waitUntil:'load'});
   const badge=page.locator('.status.unavailable,.stock-unavailable');assert.equal(await badge.count(),1);await badge.scrollIntoViewIfNeeded();assert(await badge.isVisible());assert.match(await badge.innerText(),/Stock: 0 · No disponible/);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(sku==='TELF005')await page.screenshot({path:path.join(path.dirname(output),'agotado-ficha-'+width+'.png')});
  }
  report.vistas.push({ancho:width,paginacion_completa_sin_duplicados:true,busqueda_11_agotados:true,aviso_rojo_antes_del_precio:true,categoria_telefonos:true,reposicion_sin_aviso:true,ficha_comercial_y_generica:true,sin_desbordamiento:true});
 }
 for(const p of zero){
  const url=base+'/productos/'+slugs[p.sku]+'/',response=await ctx.request.get(url);assert.equal(response.status(),200);const text=await response.text();
  assert.equal(text,fs.readFileSync(path.join(ROOT,'productos',slugs[p.sku],'index.html'),'utf8'),'Ficha HTTP distinta del candidato '+p.sku);
  assert.equal(text.split('Stock: 0 · No disponible').length-1,1);assert(text.indexOf('Stock: 0 · No disponible')<text.indexOf('<div class="price">'));
  const schema=JSON.parse(text.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);assert.equal(schema.offers.availability,'https://schema.org/OutOfStock');assert.equal(schema.offers.price,Number(p.promo).toFixed(2));
  report.fichas.push({sku:p.sku,url,http:200,aviso_unico:true,schema:'OutOfStock',precio_conservado:true});
 }
 assert.deepEqual(errors,[]);report.estado='APROBADO';fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({estado:report.estado,total:report.total,agotados:report.agotados,vistas:report.vistas.length,fichas:report.fichas.length}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
