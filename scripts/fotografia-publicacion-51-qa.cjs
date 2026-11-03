// Sólo lectura: fidelidad de las referencias activas, imágenes y presentación responsive del lote51.
const fs=require('fs'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
(async()=>{
 const pub=process.env.PHOTO_PUBLIC==='1',root=process.env.CATALOG_ROOT||process.cwd(),origin=pub?'https://conectatech-ec.github.io':'http://fotografia.local';
 const file='importacion/fotografia-publicada/direccion-20261103-51.json';
 const manifest=pub?await(await fetch('https://raw.githubusercontent.com/conectatech-ec/conectatech-ec.github.io/'+process.env.PHOTO_SHA+'/'+file)).json():JSON.parse(fs.readFileSync(path.join(root,file)));
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||(process.env.GITHUB_ACTIONS?'/usr/bin/google-chrome':'/usr/bin/chromium'),headless:true,args:['--no-sandbox'],...(process.env.PHOTO_PROXY==='1'?{proxy:{server:process.env.HTTPS_PROXY,bypass:'127.0.0.1,localhost'}}:{})}),results=[];
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:950}});
  if(!pub)await page.route('**/*',async route=>{let f=path.join(root,decodeURIComponent(new URL(route.request().url()).pathname));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f))f=path.join('/workspace/conectatech-ec.github.io',new URL(route.request().url()).pathname);if(fs.existsSync(f)&&fs.statSync(f).isFile())await route.fulfill({path:f});else await route.abort();});
  for(const [sku,row]of Object.entries(manifest.productos)){
   await page.goto(origin+row.pagina,{waitUntil:'commit',timeout:60000});const cover=page.locator('.product-frame img');await cover.waitFor();await cover.scrollIntoViewIfNeeded();await cover.evaluate(i=>i.decode());
   for(const img of await page.locator('.gallery img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode());}
   const data=await page.evaluate(()=>({cover:new URL(document.querySelector('.product-frame img').src).pathname,current:new URL(document.querySelector('.product-frame img').currentSrc).pathname,fit:getComputedStyle(document.querySelector('.product-frame img')).objectFit,count:document.querySelectorAll('.gallery img').length,broken:[...document.querySelectorAll('.product-frame img,.gallery img')].filter(i=>!i.complete||!i.naturalWidth).length,overflow:document.documentElement.scrollWidth>innerWidth}));
   const expected=row.imagenProfesional?.versiones||row.versiones_anteriores;assert.equal(data.cover,expected['1200'].url,sku);assert(Object.values(expected).some(v=>v.url===data.current),sku);assert.equal(data.fit,'contain',sku);assert.equal(data.count,row.miniaturas_esperadas,sku);assert(!data.broken&&!data.overflow,sku);
   for(const v of [...(row.vistas||[]),...(row.mantener_vistas||[])])assert(await page.locator('.gallery img').evaluateAll((a,u)=>a.some(i=>new URL(i.src).pathname===u),v.versiones['300'].url),sku);
   results.push({sku,width,...data});
  }
  await page.goto(origin+'/revision/fotografia-publicacion-20261103-51/',{waitUntil:'commit',timeout:60000});await page.locator('article').first().waitFor();for(const img of await page.locator('article img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode());}assert.equal(await page.locator('article').count(),21);assert.equal(await page.locator('article img').count(),42);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(process.env.QA_SAVE_DIR)await page.screenshot({path:path.join(process.env.QA_SAVE_DIR,`galeria-${pub?'publica':'local'}-${width}.png`),fullPage:false});
  await page.goto(origin+'/?foto=51',{waitUntil:'commit',timeout:60000});await page.locator('#grid article').first().waitFor();await page.waitForFunction(()=>window.CONECTATECH_CATALOGO?.productos);
  const catalog=await page.evaluate(skus=>Object.fromEntries(skus.map(s=>{const p=products.find(p=>p.sku===s),m=window.CONECTATECH_CATALOGO.productos[s];return [s,{cover:p.imageUrl,meta:m.imagen.src,date:m.actualizadoEn,position:orderedProducts([...products]).findIndex(p=>p.sku===s)+1}]})),Object.keys(manifest.productos));
  for(const[s,r]of Object.entries(manifest.productos)){const e=r.imagenProfesional?.versiones['1200'].url||r.portada_anterior.url;assert.equal(catalog[s].cover,e,s);assert.equal(catalog[s].meta,e,s);if(manifest.publicacion_verificada)assert(Date.parse(catalog[s].date)>=Date.parse(manifest.fecha_primera_verificacion_publica),s);}
  console.log('CATALOGO51='+JSON.stringify({width,productos:catalog}));await page.close();
 }
 await browser.close();if(process.env.QA_SAVE_DIR)fs.writeFileSync(path.join(process.env.QA_SAVE_DIR,pub?'qa-publica51.json':'qa-local51.json'),JSON.stringify(results,null,2)+'\n');console.log('QA51='+JSON.stringify({publico:pub,casos:results.length,correctos:true}));
})().catch(e=>{console.error(e);process.exit(1)});
