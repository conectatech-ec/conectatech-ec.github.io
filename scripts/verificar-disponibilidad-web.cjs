'use strict';
// PLAYWRIGHT_MODULE permite usar la instalación existente, sin añadir dependencias al sitio.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=fs.readFileSync('index.html','utf8'),products=JSON.parse(root.match(/const products=(\[[\s\S]*?\]);\s*\n/)[1]);
const slugs=JSON.parse(fs.readFileSync('seo-pages.json'));
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
  assert.equal(await page.locator('#grid .card').count(),24);assert.match(await page.locator('#count').innerText(),/^1130 productos/);
  assert.equal(await page.locator('#showOutOfStock').isChecked(),false);
  assert.equal(await page.locator('#ct-inventory-date').innerText(),'21/10/2026');
  const seen=new Set();
  const collect=async()=>{for(const sku of await page.locator('#grid .card').evaluateAll(nodes=>nodes.map(x=>x.dataset.sku))){assert(!seen.has(sku),'SKU repetido');seen.add(sku);}};
  for(let i=1;i<=48;i++){if(i>1)await page.locator('[data-page-select]').selectOption(String(i));await collect();}
  assert.equal(seen.size,1130);assert([...seen].every(s=>products.find(p=>p.sku===s).stock>0));
  await page.locator('#showOutOfStock').check();assert.match(await page.locator('#count').innerText(),/^1170 productos/);
  seen.clear();for(let i=1;i<=49;i++){if(i>1)await page.locator('[data-page-select]').selectOption(String(i));await collect();}assert.equal(seen.size,1170);
  await page.locator('#showOutOfStock').uncheck();
  const targets=products.filter(p=>p.stock<=0);let clicks=0;
  for(const p of targets){
   await page.locator('#q').fill(p.sku);const card=page.locator('#grid .card[data-sku="'+p.sku+'"]');await card.waitFor();
   assert.equal(await card.locator('[data-availability]').getAttribute('data-availability'),p.stock===0?'out_of_stock':'review_required');
   assert.equal(await card.locator('.promo').count(),0);
   const [popup]=await Promise.all([context.waitForEvent('page'),card.locator('a.wa').click()]);await popup.waitForLoadState();
   const url=new URL(popup.url());assert.equal(url.hostname,'wa.me');assert.equal(url.pathname,'/593998576759');assert(url.searchParams.get('text').includes(p.name));assert(url.searchParams.get('text').includes(p.sku));if(p.stock===0)assert(url.searchParams.get('text').includes('reposición'));await popup.close();clicks++;
  }
  // Consulta por nombre/modelo, prioridades, navegación normal y ausencia de desbordamiento.
  await page.locator('#q').fill('Infinix');const statuses=await page.locator('#grid [data-availability]').evaluateAll(es=>es.map(x=>x.dataset.availability));const firstOut=statuses.findIndex(s=>s!=='available');if(firstOut>=0)assert(statuses.slice(firstOut).every(s=>s!=='available'));
  await page.locator('#q').fill('TELF005');await page.screenshot({path:path.join(output,'catalogo-agotado-'+width+'.png'),fullPage:true});
  await page.locator('#grid .detail').click();assert(page.url().includes('/productos/'+slugs.TELF005+'/'));
  const ficheTargets=isPublic?[...targets.filter(p=>['TELF005','POWE014'].includes(p.sku)),...products.filter(p=>p.stock>0).slice(0,5)]:[...targets,...products.filter(p=>p.stock>0).slice(0,5)];
  for(const p of ficheTargets){
   const response=await page.goto(base+'/productos/'+slugs[p.sku]+'/',{waitUntil:'networkidle'});assert.equal(response.status(),200);
   assert.equal(await page.locator('body').getAttribute('data-availability-web'),p.stock>0?'available':p.stock===0?'out_of_stock':'review_required');
   assert(await page.locator('[data-availability]').isVisible());
   if(p.stock<=0){assert.equal(await page.locator('[data-availability-historical-price]').isVisible(),false);const cta=page.locator('a').filter({hasText:p.stock===0?'Consultar reposición':'Consultar disponibilidad'}).first();const [popup]=await Promise.all([context.waitForEvent('page'),cta.click()]);await popup.waitForLoadState();const msg=new URL(popup.url()).searchParams.get('text');assert(msg.includes(p.sku));assert(msg.includes(await page.locator('h1').innerText()));await popup.close();clicks++;}
   else assert.equal(await page.locator('.price').first().isVisible(),true);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),p.sku+' desbordamiento móvil');
   if(['TELF005','POWE014'].includes(p.sku))await page.screenshot({path:path.join(output,'ficha-'+p.sku+'-'+width+'.png'),fullPage:true});
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
  assert.deepEqual(errors,[]);results.push({ancho:width,paginacionDisponibles:1130,paginacionFiltro:1170,busquedasAgotados:40,fichas:ficheTargets.length,clicksWhatsApp:clicks,errores:errors});await context.close();
 }
 console.log(JSON.stringify({resultado:'OK',base,verificacionPublica:isPublic,resultados:results},null,2));fs.writeFileSync(path.join(output,isPublic?'qa-publica.json':'qa-local.json'),JSON.stringify(results,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
