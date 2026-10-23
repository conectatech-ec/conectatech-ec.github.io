'use strict';
// PLAYWRIGHT_MODULE permite usar la instalación existente, sin añadir dependencias al sitio.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=fs.readFileSync('index.html','utf8'),products=JSON.parse(root.match(/const products=(\[[\s\S]*?\]);\s*\n/)[1]);
const slugs=JSON.parse(fs.readFileSync('seo-pages.json'));
const core=require('../assets/disponibilidad-core.js'),state=JSON.parse(fs.readFileSync('datos-593/estado-ultimo-corte.json'));
const mainCount=products.filter(p=>core.forProduct(p).main_catalog).length,total=products.length;
const displayDate=state.fecha_corte.split('-').reverse().join('/');
const targets=products.filter(p=>!core.forProduct(p).commercial_eligible),sampleOut=(targets.find(p=>core.forProduct(p).replenishment)||products[0]),sampleReview=targets.find(p=>core.forProduct(p).status==='review_required');
const isPublic=process.argv.includes('--public'),base=isPublic?'https://conectatech-ec.github.io':(process.env.QA_BASE_URL||'http://127.0.0.1:8767');
const output=process.env.QA_OUTPUT||'/tmp/conectatech-disponibilidad-qa';fs.mkdirSync(output,{recursive:true});
(async()=>{
 const launch={executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']};
 if(isPublic&&(process.env.HTTPS_PROXY||process.env.https_proxy))launch.proxy={server:process.env.HTTPS_PROXY||process.env.https_proxy};
 const browser=await chromium.launch(launch),results=[];
 try{for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:900}}),errors=[];
  // El enlace se abre realmente en una pestaña; la prueba no envía mensajes ni requiere sesión de WhatsApp.
  await context.route('https://wa.me/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<title>Destino WhatsApp verificado</title>'}));
  if(!isPublic)await context.route('https://conectatech-ec.github.io/**',async route=>{const url=new URL(route.request().url());let file=path.resolve('.','.'+decodeURIComponent(url.pathname));if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');if(fs.existsSync(file))await route.fulfill({path:file});else await route.abort();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/',{waitUntil:'networkidle'});
  assert.equal(await page.locator('#grid .card').count(),24);assert((await page.locator('#count').innerText()).startsWith(mainCount+' productos'));
  assert.equal(await page.locator('#showOutOfStock').isChecked(),false);
  assert.equal(await page.locator('#ct-inventory-date').innerText(),displayDate);
  const seen=new Set();
  const collect=async()=>{for(const sku of await page.locator('#grid .card').evaluateAll(nodes=>nodes.map(x=>x.dataset.sku))){assert(!seen.has(sku),'SKU repetido');seen.add(sku);}};
  for(let i=1;i<=Math.ceil(mainCount/24);i++){if(i>1)await page.locator('[data-page-select]').selectOption(String(i));await collect();}
  assert.equal(seen.size,mainCount);assert([...seen].every(s=>core.forProduct(products.find(p=>p.sku===s)).main_catalog));
  await page.locator('#showOutOfStock').check();assert((await page.locator('#count').innerText()).startsWith(total+' productos'));
  seen.clear();for(let i=1;i<=Math.ceil(total/24);i++){if(i>1)await page.locator('[data-page-select]').selectOption(String(i));await collect();}assert.equal(seen.size,total);
  await page.locator('#showOutOfStock').uncheck();
  let clicks=0;
  for(const p of targets){
   await page.locator('#q').fill(p.sku);const card=page.locator('#grid .card[data-sku="'+p.sku+'"]');await card.waitFor();
   assert.equal(await card.locator('[data-availability]').getAttribute('data-availability'),core.forProduct(p).status);
   assert.equal(await card.locator('.promo').count(),0);
   const [popup]=await Promise.all([context.waitForEvent('page'),card.locator('a.wa').click()]);await popup.waitForLoadState();
   const url=new URL(popup.url());assert.equal(url.hostname,'wa.me');assert.equal(url.pathname,'/593998576759');assert(url.searchParams.get('text').includes(p.name));assert(url.searchParams.get('text').includes(p.sku));if(core.forProduct(p).replenishment)assert(url.searchParams.get('text').includes('reposición'));await popup.close();clicks++;
  }
  // Consulta por nombre/modelo, prioridades, navegación normal y ausencia de desbordamiento.
  await page.locator('#q').fill('Infinix');const statuses=await page.locator('#grid [data-availability]').evaluateAll(es=>es.map(x=>x.dataset.availability));const firstOut=statuses.findIndex(s=>s!=='available');if(firstOut>=0)assert(statuses.slice(firstOut).every(s=>s!=='available'));
  await page.locator('#q').fill(sampleOut.sku);await page.screenshot({path:path.join(output,'catalogo-agotado-'+width+'.png'),fullPage:true});
  await page.locator('#grid .detail').click();assert(page.url().includes('/productos/'+slugs[sampleOut.sku]+'/'));
  const ficheTargets=isPublic?[[sampleOut,sampleReview].filter(Boolean),products.filter(p=>core.forProduct(p).commercial_eligible).slice(0,5)].flat():[...targets,...products.filter(p=>core.forProduct(p).commercial_eligible).slice(0,5)];
  for(const p of ficheTargets){
   const response=await page.goto(base+'/productos/'+slugs[p.sku]+'/',{waitUntil:'networkidle'});assert.equal(response.status(),200);
   assert.equal(await page.locator('body').getAttribute('data-availability-web'),core.forProduct(p).status);
   assert(await page.locator('[data-availability]').isVisible());
   for(const image of await page.locator('img.photo').all())assert(await image.evaluate(el=>el.complete&&el.naturalWidth>0),p.sku+' fotografía pública cargada');
   if(!core.forProduct(p).commercial_eligible){assert.equal(await page.locator('[data-availability-historical-price]').isVisible(),false);const cta=page.locator('a').filter({hasText:core.forProduct(p).replenishment?'Consultar reposición':core.forProduct(p).status==='discontinued'?'Consultar alternativas':'Consultar disponibilidad'}).first();const [popup]=await Promise.all([context.waitForEvent('page'),cta.click()]);await popup.waitForLoadState();const msg=new URL(popup.url()).searchParams.get('text');assert(msg.includes(p.sku));assert(msg.includes(await page.locator('h1').innerText()));await popup.close();clicks++;}
   else assert.equal(await page.locator('.price').first().isVisible(),true);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),p.sku+' desbordamiento móvil');
   if([sampleOut?.sku,sampleReview?.sku].includes(p.sku))await page.screenshot({path:path.join(output,'ficha-'+p.sku+'-'+width+'.png'),fullPage:true});
  }
  if(!isPublic){
   const fixture=products[0],url=base+'/?availability-test=isolated';
   for(const stock of [5,0,3]){
    const cloned=products.map(p=>p.sku===fixture.sku?{...p,stock}:p);
    const html=root.replace(/const products=(\[[\s\S]*?\]);\s*\n/,'const products='+JSON.stringify(cloned)+';\n');
    await page.route(url,route=>route.fulfill({status:200,contentType:'text/html',body:html}));
    await page.goto(url,{waitUntil:'networkidle'});
    const found=await page.evaluate(sku=>orderedProducts(products.filter(p=>availabilityFor(p).main_catalog)).some(p=>p.sku===sku),fixture.sku);assert.equal(found,stock>0);
    await page.locator('#q').fill(fixture.sku);const card=page.locator('#grid .card[data-sku="'+fixture.sku+'"]');assert.equal(await card.locator('[data-availability]').getAttribute('data-availability'),stock>0?'available':'out_of_stock');
    assert.equal(await card.locator('.name').innerText(),fixture.name);await page.unroute(url);
   }
  }
  assert.deepEqual(errors,[]);results.push({ancho:width,paginacionDisponibles:mainCount,paginacionFiltro:total,busquedasAgotados:targets.length,fichas:ficheTargets.length,clicksWhatsApp:clicks,errores:errors});await context.close();
 }
 console.log(JSON.stringify({resultado:'OK',base,corte:state.fecha_corte,verificacionPublica:isPublic,resultados:results},null,2));fs.writeFileSync(path.join(output,isPublic?'qa-publica.json':'qa-local.json'),JSON.stringify(results,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
