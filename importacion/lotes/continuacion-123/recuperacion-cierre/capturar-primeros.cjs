const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});
 const folder='reportes/continuacion-123/prioridad-publica';
 try{
  for(const width of [390,1280]){
   const page=await browser.newPage({locale:'es-EC',viewport:{width,height:1000},reducedMotion:'reduce'});
   await page.goto('https://conectatech-ec.github.io/',{waitUntil:'load'});
   await page.evaluate(()=>document.fonts.ready);
   await page.locator('#catalogSort').selectOption('recientes');
   const first=await page.locator('#grid article[data-sku]').evaluateAll(x=>x.slice(0,3).map(y=>y.dataset.sku).sort());
   assert.deepEqual(first,['CHIP001','CHIP002','CHIP004']);
   await page.locator('#grid article[data-sku]').first().scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>[...document.querySelectorAll('#grid article[data-sku]')].slice(0,3).every(card=>{const img=card.querySelector('img');return img&&img.complete&&img.naturalWidth>100&&img.currentSrc.includes('/imagenes/chip');}));
   await page.locator('#grid article img').evaluateAll(async imgs=>{await Promise.all(imgs.slice(0,3).map(img=>img.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
   await page.screenshot({path:folder+'/'+width+'-tarjetas-primeras.png',animations:'disabled'});
   await page.locator('#q').fill('CHIP003');
   const card=page.locator('#grid article[data-sku="CHIP003"]');
   assert.equal(await card.locator('.name').innerText(),'Chip SIM Tigo');
   assert(/Agotado|No disponible/i.test(await card.innerText()));
   await card.scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>{const img=document.querySelector('#grid article[data-sku="CHIP003"] img');return img&&img.complete&&img.naturalWidth>100&&img.currentSrc.includes('/imagenes/chip003');});
   await card.locator('img').evaluate(async img=>{await img.decode();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
   await page.screenshot({path:folder+'/'+width+'-tarjeta-tigo-agotado.png',animations:'disabled'});
   await page.close();
  }
  console.log('Cuatro capturas centradas en tarjetas reales, móvil y escritorio.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
