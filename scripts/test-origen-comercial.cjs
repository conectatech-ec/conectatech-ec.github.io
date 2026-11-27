'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process');
const origin=require('../assets/origen-comercial.js');
const ROOT=path.resolve(__dirname,'..'),base='https://conectatech-ec.github.io';
const query='?utm_source=google_maps&utm_medium=organic&utm_campaign=black_month_2026&utm_content=rescate_3_telefonos_20261126&ref=GM-RESCATE-20261126';
const landing=base+'/'+query;
const product='/productos/telf018-telefono-redmi-15c-256gb-4gb-4gb/';
const original='Hola, quisiera consultar la disponibilidad, código TELF018.';
const wa='https://wa.me/593998576759?text='+encodeURIComponent(original);
const text=url=>new URL(url).searchParams.get('text');
let checks=0;
function check(label,fn){fn();checks++;console.log('OK '+label);}
check('catálogo → ficha conserva UTM/ref y URL canónica estable',()=>{
 const target=origin.internalURL(product,landing);
 assert.equal(new URL(target,base).pathname,product);
 assert.deepEqual([...new URL(target,base).searchParams],[...new URL(landing).searchParams]);
 assert.equal(origin.pageSKU(base+target),'TELF018');
});
check('WhatsApp conserva mensaje y agrega canal/SKU/pieza sin preguntar al cliente',()=>{
 const result=origin.whatsappURL(wa,'',landing);
 assert.equal(text(result),original+'\n\n[CT360 Ref: GM-TELF018 | GM-RESCATE-20261126 | black_month_2026 | rescate_3_telefonos_20261126]');
 assert.equal(origin.whatsappURL(result,'',landing),result);
 assert.match(text(origin.whatsappURL(result,'',base+'/?utm_source=youtube&ref=YT-PERFIL')),/YT-TELF018 \| YT-PERFIL\]$/);
 assert.equal((text(origin.whatsappURL(result,'',base+'/?utm_source=youtube')).match(/CT360 Ref:/g)||[]).length,1);
});
check('fuente ausente o desconocida no inventa origen, referrer ni geografía',()=>{
 for(const value of ['','?utm_source=google','?utm_source=unknown','?utm_source=__proto__','?utm_source=constructor','?ref=GM-RESCATE','?utm_source=google_maps&utm_source=tiktok']){
  assert.equal(origin.internalURL(product,base+'/'+value),product);
  assert.equal(origin.whatsappURL(wa,'TELF018',base+'/'+value),wa);
 }
});
check('solo seis plataformas y referencias consistentes; Rafa/Jessy no se infieren',()=>{
 for(const [source,code] of Object.entries({google_maps:'GM',facebook:'FB',instagram:'IG',tiktok:'TT',youtube:'YT',whatsapp:'WA'})){
  assert.match(text(origin.whatsappURL(wa,'TELF018',base+'/?utm_source='+source)),new RegExp(code+'-TELF018\\]$'));
 }
 const ctx=origin.context(base+'/?utm_source=facebook&ref=GM-RESCATE');
 assert.equal(ctx.values.ref,undefined);
});
check('no traslada parámetros arbitrarios, emails ni entradas maliciosas',()=>{
 const bad=origin.context(base+'/?utm_source=google_maps&utm_campaign=ana%40example.com&utm_content=%3Cscript%3E&ref=GM-'+('X'.repeat(80))+'&telefono=0999999999');
 assert.deepEqual(bad.values,{utm_source:'google_maps'});
 assert.equal(origin.context(base+'/?utm_source=google_maps&utm_content='+('x'.repeat(97))).values.utm_content,undefined);
 assert.equal(origin.context(base+'/?utm_source=google_maps&utm_campaign=one&utm_campaign=two').values.utm_campaign,undefined);
});
check('canal WhatsApp, terceros, checkout, imágenes y esquemas no se alteran',()=>{
 for(const raw of ['https://www.whatsapp.com/channel/0029VbCxbjl7j6g1Ix9uwj2k/','https://wa.me/123456789?text=hola','https://wa.me.evil.test/593998576759?text=hola','http://wa.me/593998576759?text=hola','https://fake@wa.me/593998576759?text=hola','https://manufacturer.test/producto/','/ventas/','/imagenes/telf018/TELF018-01.webp','javascript:alert(1)']){
  assert.equal(origin.whatsappURL(raw,'TELF018',landing),raw);
  assert.equal(origin.internalURL(raw,landing),raw);
 }
});
check('enlace con contexto propio conserva su campaña; consultas generales sin SKU inventado',()=>{
 const own=product+'?utm_source=tiktok';assert.equal(origin.internalURL(own,landing),own);
 const result=origin.whatsappURL('https://wa.me/593964206977?text=Hola','',landing);
 assert.match(text(result),/\[CT360 Ref: GM \|/);assert(!text(result).includes('CATALOGO'));
 assert.equal(text(origin.whatsappURL('https://wa.me/593998576759','',landing)),
  'Hola CONECTATECH, deseo consultar.\n\n[CT360 Ref: GM | GM-RESCATE-20261126 | black_month_2026 | rescate_3_telefonos_20261126]');
 assert(!text(origin.whatsappURL('https://wa.me/593998576759','',base+product+query)).includes('TELF018'));
});
check('base comercial, SEO y exclusiones no se modifican por atribución',()=>{
 const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
 assert(html.includes('src="/assets/origen-comercial.js?v=1"'));
 assert(!fs.readFileSync(path.join(ROOT,'assets/origen-comercial.js'),'utf8').match(/fetch\(|sendBeacon|localStorage|sessionStorage|gtag\(|dataLayer|document\.cookie/));
 const generator=fs.readFileSync(path.join(ROOT,'scripts/generar-seo.cjs'),'utf8');
 assert(generator.includes('defer src="/assets/origen-comercial.js?v=1"'));
 assert(generator.includes('disponibilidadWeb.renderPage'));
});

function generatedPreservation(){
 const parse=html=>JSON.parse(html.match(/const products=(\[[\s\S]*?\]);\s*\n/)[1]);
 const items=parse(fs.readFileSync(path.join(ROOT,'index.html'),'utf8'));
 const slugs=JSON.parse(fs.readFileSync(path.join(ROOT,'seo-pages.json'),'utf8'));
 function fingerprint(html){
  const attributes=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
  return {
   title:html.match(/<title>([\s\S]*?)<\/title>/)?.[1],
   seo:[...html.matchAll(/<(?:meta|link)\b[^>]*>/g)].map(m=>attributes(m[0])).filter(a=>a.rel==='canonical'||a.name==='description'||a.property?.startsWith('og:')),
   schema:[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1])),
   images:[...html.matchAll(/<img\b[^>]*>/g)].map(m=>attributes(m[0])),
   prices:[...html.matchAll(/<[^>]*class="[^"]*(?:price|promo|pvp)[^"]*"[^>]*>([^<]*)</g)].map(m=>m[1])
  };
 }
 const before=new Map(items.map(p=>[p.sku,fingerprint(fs.readFileSync(path.join(ROOT,'productos',slugs[p.sku],'index.html'),'utf8'))]));
 cp.execFileSync(process.execPath,['scripts/generar-seo.cjs'],{cwd:ROOT,stdio:'inherit'});
 assert.deepEqual(parse(fs.readFileSync(path.join(ROOT,'index.html'),'utf8')),items,'Catálogo: todos los campos comerciales y fotos deben conservarse');
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(ROOT,'seo-pages.json'),'utf8')),slugs,'URLs estables conservadas');
 for(const p of items){
  const html=fs.readFileSync(path.join(ROOT,'productos',slugs[p.sku],'index.html'),'utf8');
  assert.deepEqual(fingerprint(html),before.get(p.sku),'SEO, fotos, precios y schema conservados: '+p.sku);
  assert.equal((html.match(/src="\/assets\/origen-comercial\.js\?v=1"/g)||[]).length,1,'Loader único en '+p.sku);
 }
 checks++;console.log('OK generación oficial completa: '+items.length+' fichas, datos/fotos/SEO/precios conservados y loader único');
}

async function browserFlow(){
 const {chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'', 'playwright'));
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const target=path.resolve(ROOT,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if(!target.startsWith(ROOT+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(target,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':'text/html');res.end(data);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const local='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{})});
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  await page.route(base+'/**',r=>{const url=new URL(r.request().url());return r.continue({url:local+url.pathname+url.search});});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(local+'/'+query);
  await page.evaluate(()=>{const a=document.createElement('a');a.id='qa-header-contact';a.href='https://wa.me/593998576759';document.querySelector('header').appendChild(a);});
  await page.waitForFunction(()=>document.querySelector('#qa-header-contact')?.href.includes('CT360'));
  assert.match(text(await page.locator('#qa-header-contact').getAttribute('href')),/^Hola CONECTATECH, deseo consultar\.\n\n\[CT360 Ref: GM \|/);
  await page.locator('#q').fill('TELF018');
  const detail=page.locator('#grid a.detail').first();
  await page.waitForFunction(()=>document.querySelector('#grid a.wa')?.href.includes('CT360'));
  assert.equal(new URL(await detail.getAttribute('href'),local).searchParams.get('ref'),'GM-RESCATE-20261126');
  assert.match(text(await page.locator('#grid a.wa').first().getAttribute('href')),/GM-TELF018/);
  await page.locator('#categorySelect').selectOption({label:'Celulares'});
  assert.equal(new URL(page.url()).searchParams.get('utm_source'),'google_maps');
  assert.equal(new URL(await page.locator('#categoryLink').getAttribute('href'),local).searchParams.get('ref'),'GM-RESCATE-20261126');
  await page.locator('#q').fill('TELF018');
  // El href está preparado antes de click: copiar o abrir en otra pestaña conserva origen.
  const copied=await detail.getAttribute('href');
  await page.goto(new URL(copied,local).href);
  await page.waitForFunction(()=>document.querySelector('a.cta')?.href.includes('CT360'));
  const nativeSchema=await page.locator('script[type="application/ld+json"]').textContent();
  assert.equal(JSON.parse(nativeSchema).sku,'TELF018');
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),base+product);
  const quoted=await page.locator('a.cta').getAttribute('href');assert.match(text(quoted),/GM-TELF018/);
  await page.evaluate(()=>{window.open=(url)=>{window.__opened=url;return null;};});
  const select=page.locator('input[data-vc-sku]').first();
  if(await select.count()){
   await select.check();await page.locator('[data-ct-vc-action]').click();
   const combined=await page.evaluate(()=>window.__opened);
   assert.match(text(combined),/GM-TELF018/);
   assert(text(combined).includes(await select.getAttribute('data-vc-sku')));
  }else throw Error('TELF018 sin venta cruzada para probar');
  // Una visita directa nueva no hereda la campaña anterior (no se usa almacenamiento).
  await page.goto(local+product);
  assert(!text(await page.locator('a.cta').getAttribute('href')).includes('CT360'));
  await page.goto(local+product+'?utm_source=tiktok&ref=TT-PIEZA-1');
  await page.waitForFunction(()=>document.querySelector('a.cta')?.href.includes('CT360'));
  assert.match(text(await page.locator('a.cta').getAttribute('href')),/TT-TELF018 \| TT-PIEZA-1/);
  assert.deepEqual(errors,[]);
  checks++;console.log('OK Chromium móvil: catálogo/categoría/ficha/WA/venta cruzada/directo/nuevo canal, sin errores');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
if(process.argv.includes('--generate'))generatedPreservation();
if(process.argv.includes('--browser'))browserFlow().then(()=>console.log(checks+' controles aprobados')).catch(error=>{console.error(error);process.exitCode=1;});
else console.log(checks+' controles aprobados; --browser ejecuta el flujo real tras generar TELF018.');
