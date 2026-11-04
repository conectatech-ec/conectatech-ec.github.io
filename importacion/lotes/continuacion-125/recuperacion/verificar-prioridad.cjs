const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));
const base=process.env.BASE_PRIORIDAD||'https://conectatech-ec.github.io',folder=process.env.REPORTE_PRIORIDAD||'reportes/continuacion-125/prioridad-publica';
const h=JSON.parse(fs.readFileSync('reportes/continuacion-125/http-publicacion.json'));
(async()=>{fs.mkdirSync(folder,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});const report={fecha:new Date().toISOString(),base,fechaPrimaria:h.fecha,vistas:[]};try{
 for(const width of [390,1280]){
  const page=await browser.newPage({locale:'es-EC',viewport:{width,height:1000},reducedMotion:'reduce'});
  await page.goto(base+'/',{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
  const modoInicial=await page.locator('#catalogSort').inputValue();assert(['recientes','recomendados'].includes(modoInicial));
  const inicialIDs=await page.locator('#grid article[data-sku]').evaluateAll(rows=>rows.map(r=>r.dataset.sku));
  const inicialOrder=await page.evaluate(()=>orderedProducts(products.filter(p=>availabilityFor(p).main_catalog)).map(p=>p.sku));
  assert.deepEqual(inicialIDs,inicialOrder.slice(0,inicialIDs.length));
  await page.locator('#grid article[data-sku]').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:folder+'/'+width+'-entrada-'+modoInicial+'.png',animations:'disabled'});
  await page.locator('#catalogSort').selectOption('recientes');
  assert.equal(await page.locator('#catalogSort').inputValue(),'recientes');
  const ids=await page.locator('#grid article[data-sku]').evaluateAll(rows=>rows.map(r=>r.dataset.sku));
  const order=await page.evaluate(()=>orderedProducts(products.filter(p=>availabilityFor(p).main_catalog)).map(p=>p.sku));
  assert.deepEqual(ids,order.slice(0,ids.length));assert(order.includes('TECL028'));
  const date=await page.evaluate(()=>window.CONECTATECH_CATALOGO.productos.TECL028.actualizadoEn);assert.equal(date,h.fecha);
  await page.locator('#grid article[data-sku]').first().scrollIntoViewIfNeeded();
  await page.locator('#grid article img').evaluateAll(async imgs=>{await Promise.all(imgs.slice(0,2).map(i=>i.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  await page.screenshot({path:folder+'/'+width+'-primeros.png',animations:'disabled'});
  await page.locator('#q').fill('TECL028');const card=page.locator('#grid article[data-sku="TECL028"]');assert.equal(await card.count(),1);
  assert.equal(await card.locator('.name').innerText(),'Teclado ergonómico Klipxtreme');assert.equal(await card.locator('.ct-pro-subtitle').innerText(),'KBK-530S');
  await card.scrollIntoViewIfNeeded();await page.waitForFunction(()=>{const i=document.querySelector('#grid article[data-sku="TECL028"] img');return i&&i.complete&&i.naturalWidth>100&&i.currentSrc.includes('TECL028-r125-01');});
  await card.locator('img').evaluate(async i=>{await i.decode();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  await page.screenshot({path:folder+'/'+width+'-tecl028.png',animations:'disabled'});
  report.vistas.push({ancho:width,presentacionInicial:{modo:modoInicial,posicion:inicialOrder.indexOf('TECL028')+1,primeraPagina:inicialIDs},modoVerificado:'recientes',primeraPagina:ids,posicionReal:order.indexOf('TECL028')+1,primero:order[0]==='TECL028',enPrimeraPagina:ids.includes('TECL028'),fechaPrimariaConservada:true,tituloModeloImagenVerificados:true,ordenRealVerificado:true});await page.close();
 }
 report.estado='ORDEN_REAL_Y_FICHA_VERIFICADOS';fs.writeFileSync(folder+'/resultado.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.vistas.map(x=>({ancho:x.ancho,posicion:x.posicionReal,primero:x.primero}))));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
