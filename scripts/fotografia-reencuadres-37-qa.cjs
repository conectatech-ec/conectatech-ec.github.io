// Sólo lectura: presentación de las treinta versiones normalizadas y sus originales.
const fs=require('fs'),path=require('path'),assert=require('assert'),{chromium}=require('playwright');
async function decodePhoto(img){for(let attempt=0;attempt<3;attempt++){await img.scrollIntoViewIfNeeded();try{await img.evaluate(i=>i.decode());assert(await img.evaluate(i=>i.complete&&i.naturalWidth>0));return;}catch(e){if(attempt===2)throw Error('Imagen no decodificable: '+await img.getAttribute('src')+'; '+String(e));await img.evaluate(i=>{const s=i.getAttribute('src');i.removeAttribute('src');i.setAttribute('src',s);});await new Promise(r=>setTimeout(r,1000*(attempt+1)));}}}
(async()=>{
 const pub=process.env.PHOTO_PUBLIC==='1',root=process.env.CATALOG_ROOT||process.cwd(),origin=pub?'https://conectatech-ec.github.io':'http://fotografia.local';
 const manifest=pub?await(await fetch('https://raw.githubusercontent.com/conectatech-ec/conectatech-ec.github.io/'+process.env.PHOTO_SHA+'/importacion/fotografia-publicada/direccion-20261031-37.json')).json():JSON.parse(fs.readFileSync(path.join(root,'importacion/fotografia-publicada/direccion-20261031-37.json')));
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||(process.env.GITHUB_ACTIONS?'/usr/bin/google-chrome':'/usr/bin/chromium'),headless:true,args:['--no-sandbox'],...(process.env.PHOTO_PROXY==='1'?{proxy:{server:process.env.HTTPS_PROXY}}:{})}),results=[];
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:950}});
  if(!pub)await page.route('**/*',async route=>{let f=path.join(root,decodeURIComponent(new URL(route.request().url()).pathname));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');if(!fs.existsSync(f))f=path.join('/workspace/conectatech-ec.github.io',new URL(route.request().url()).pathname);if(fs.existsSync(f)&&fs.statSync(f).isFile())await route.fulfill({path:f});else await route.abort();});
  for(const [sku,row]of Object.entries(manifest.productos)){
   await page.goto(origin+row.pagina,{waitUntil:'commit',timeout:60000});await page.locator('.product-frame img').waitFor();await page.locator('.product-frame').scrollIntoViewIfNeeded();await decodePhoto(page.locator('.product-frame img'));
   for(const img of await page.locator('.gallery img').all()){await img.scrollIntoViewIfNeeded();await decodePhoto(img);}
   const data=await page.evaluate(()=>({cover:new URL(document.querySelector('.product-frame img').src).pathname,current:new URL(document.querySelector('.product-frame img').currentSrc).pathname,fit:getComputedStyle(document.querySelector('.product-frame img')).objectFit,count:document.querySelectorAll('.gallery img').length,broken:[...document.querySelectorAll('.product-frame img,.gallery img')].filter(i=>!i.complete||!i.naturalWidth).length,overflow:document.documentElement.scrollWidth>innerWidth}));
   assert.equal(data.cover,row.imagenProfesional.versiones['1200'].url);assert(Object.values(row.imagenProfesional.versiones).some(v=>v.url===data.current));assert.equal(data.fit,'contain');assert.equal(data.count,row.miniaturas_esperadas);assert(!data.broken&&!data.overflow);results.push({sku,width,...data});
  }
  await page.goto(origin+'/revision/fotografia-lote-100-20261031-37/',{waitUntil:'commit',timeout:60000});await page.locator('article').first().waitFor();
  for(const img of await page.locator('article img').all()){await img.scrollIntoViewIfNeeded();await decodePhoto(img);}
  assert.equal(await page.locator('article').count(),Object.keys(manifest.productos).length);assert.equal(await page.locator('article img').count(),Object.keys(manifest.productos).length*2);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(process.env.QA_SAVE_DIR)await page.screenshot({path:path.join(process.env.QA_SAVE_DIR,'galeria-'+(pub?'publica':'local')+'-'+width+'.png')});
  await page.locator('#conservados').evaluate(d=>d.open=true);for(const img of await page.locator('[data-conservado] img').all())await decodePhoto(img);assert.equal(await page.locator('[data-conservado]').count(),manifest.conservados_en_lote.length);await page.locator('#buscar').fill('CUBO021');assert.equal(await page.locator('article:visible').count(),1);assert.equal(await page.locator('article:visible').getAttribute('data-sku'),'CUBO021');await page.locator('#buscar').fill('');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(pub){
   await page.goto(origin+'/',{waitUntil:'commit',timeout:60000});await page.locator('#grid article').first().waitFor();
   const catalog=await page.evaluate(rows=>{const a=orderedProducts([...products]),m=window.CONECTATECH_CATALOGO.productos;return Object.fromEntries(Object.keys(rows).map(s=>[s,{position:a.findIndex(p=>p.sku===s)+1,image:products.find(p=>p.sku===s).imageUrl,metaImage:m[s].imagen.src,date:m[s].actualizadoEn}]));},manifest.productos);
   for(const [s,row]of Object.entries(manifest.productos)){assert.equal(catalog[s].image,row.imagenProfesional.versiones['1200'].url);assert.equal(catalog[s].metaImage,catalog[s].image);assert(catalog[s].position>0);if(manifest.publicacion_verificada)assert(Date.parse(catalog[s].date)>=Date.parse(manifest.fecha_primera_verificacion_publica));}
   console.log('CATALOGO_REENCUADRES37='+JSON.stringify({width,productos:catalog}));
  }
  await page.close();
 }
 await browser.close();if(process.env.QA_SAVE_DIR)fs.writeFileSync(path.join(process.env.QA_SAVE_DIR,pub?'qa-publica-37.json':'qa-local-37.json'),JSON.stringify(results,null,2)+'\n');console.log('QA_REENCUADRES37='+JSON.stringify({publico:pub,fecha:new Date().toISOString(),casos:results.length,resultados:results}));
})().catch(e=>{console.error(e);process.exit(1)});
