const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('crypto');
const {chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'','playwright'));
const base=process.env.BASE_PILOTO||'http://127.0.0.1:8819',folder='revision/titulos-pro-20',cfg=JSON.parse(fs.readFileSync('importacion/pilotos/titulos-pro-20.json')),skus=Object.keys(cfg.productos);
(async()=>{const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()}),report={fecha:new Date().toISOString(),base:cfg.base,grupos:{},vistas:[],errores:[]};for(const e of Object.values(cfg.productos))report.grupos[e.grupo]=(report.grupos[e.grupo]||0)+1;try{
 const ctx=await browser.newContext({locale:'es-EC',reducedMotion:'reduce'});await ctx.route('https://conectatech-ec.github.io/**',r=>{const u=new URL(r.request().url());return ctx.request.get(base+u.pathname+u.search).then(response=>r.fulfill({response}));});const page=await ctx.newPage();page.on('pageerror',e=>report.errores.push(e.message));
 for(const width of [360,390,520,1280]){
  await page.setViewportSize({width,height:1000});await page.goto(base+'/'+folder+'/catalogo-despues.html',{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
  await page.locator('#grid .ct-compact-card').first().waitFor();
  const cards=await page.locator('#grid .ct-compact-card').evaluateAll(cs=>cs.map(c=>{const t=c.querySelector('.name'),s=c.querySelector('.ct-pro-subtitle'),r=t.getBoundingClientRect(),style=getComputedStyle(t),im=c.querySelector('img');return {sku:c.dataset.sku,categoria:c.querySelector('.cat').textContent,titulo:t.textContent,subtitulo:s?.textContent,alto:c.getBoundingClientRect().height,lineas:r.height/parseFloat(style.lineHeight),corte:t.scrollHeight>t.clientHeight+1,subcorte:s.scrollWidth>s.clientWidth+1,href:t.getAttribute('href'),promo:c.querySelector('.promo').textContent,pvp:c.querySelector('.pvp').textContent,foto:im.getAttribute('src'),columnas:getComputedStyle(c.parentElement).gridTemplateColumns.split(' ').length};}));
  assert.equal(cards.length,20);assert.equal(new Set(cards.map(c=>c.sku)).size,20);
  for(const c of cards){const e=cfg.productos[c.sku];assert.equal(c.titulo,e.titulo);assert.equal(c.subtitulo,e.subtitulo);assert.equal(c.categoria.includes('De terceros'),e.condicionTarjeta==='De terceros');assert(!/producto gen[eé]rico|compatible\s*\(AAA\)/i.test(c.titulo+' '+c.subtitulo));assert(!c.corte,JSON.stringify(c));assert(!c.subcorte,JSON.stringify(c));assert(c.lineas<=2.05,JSON.stringify(c));assert(c.alto<=(width===1280?520:410),JSON.stringify(c));assert.equal(c.columnas,width===1280?3:2);assert.equal(new URL(c.href,'https://conectatech-ec.github.io').href,e.url);}
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(const im of await page.locator('#grid img').all()){await im.scrollIntoViewIfNeeded();await im.evaluate(im=>im.decode());assert(await im.evaluate(im=>im.complete&&im.naturalWidth>0));}
  if([390,1280].includes(width)){await page.locator('#grid').screenshot({path:folder+'/despues-'+width+'.png'});await page.goto(base+'/'+folder+'/catalogo-antes.html',{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);for(const im of await page.locator('#grid img').all()){await im.scrollIntoViewIfNeeded();await im.evaluate(im=>im.decode());}await page.locator('#grid').screenshot({path:folder+'/antes-'+width+'.png'});}
  report.vistas.push({ancho:width,columnas:width===1280?3:2,productos:20,sin_cortes:true,sin_desbordamiento:true,fotos_cargadas:20,altura_maxima:Math.max(...cards.map(c=>c.alto)),tarjetas:cards});
 }
 // La página completa sigue conteniendo1170SKU. La diferencia DOM debe limitarse a20.
 const maps=[];
 for(const suffix of ['?titulos=original','']){await page.setViewportSize({width:1280,height:1000});await page.goto(base+'/'+suffix,{waitUntil:'load'});const all={};const pages=await page.locator('#ct-pages select[data-page-select] option').count();for(let n=1;n<=pages;n++){if(n>1)await page.locator('#ct-pages select[data-page-select]').selectOption(String(n));Object.assign(all,await page.locator('#grid .ct-compact-card').evaluateAll(cs=>Object.fromEntries(cs.map(c=>[c.dataset.sku,c.outerHTML]))));}assert.equal(Object.keys(all).length,1170);maps.push(all);}
 const changed=Object.keys(maps[0]).filter(s=>maps[0][s]!==maps[1][s]);assert.deepEqual(changed.sort(),skus.slice().sort());report.no_piloto_dom_identico=1150;report.piloto_dom_modificado=20;report.total_sku_sin_duplicados=1170;
 for(const [sku,e] of Object.entries(cfg.productos)){
  for(const query of [sku,e.tituloAnterior,e.nombre593,...(e.modelo?[e.modelo]:[])]){await page.locator('#q').fill(query);let found=(await page.locator('#grid .ct-compact-card').evaluateAll(cs=>cs.map(c=>c.dataset.sku))).includes(sku);const pages=await page.locator('#ct-pages select[data-page-select] option').count();for(let n=2;!found&&n<=pages;n++){await page.locator('#ct-pages select[data-page-select]').selectOption(String(n));found=(await page.locator('#grid .ct-compact-card').evaluateAll(cs=>cs.map(c=>c.dataset.sku))).includes(sku);}assert(found,'No encuentra '+sku+' por '+query);}
 }
 report.busqueda_por_sku_nombre_actual_593_y_modelo=true;
 report.condicion_real_antes_de_compra=[];
 for(const [sku,e] of Object.entries(cfg.productos).filter(([s,e])=>e.condicionTarjeta)){
  await page.goto(base+new URL(e.url).pathname,{waitUntil:'load'});
  const label=page.getByText('Producto compatible (AAA)',{exact:false}).first();assert(await label.isVisible(),sku+' condición no visible');
  const result=await page.evaluate(()=>{const a=[...document.querySelectorAll('.sku')].find(x=>x.textContent.includes('Producto compatible (AAA)'));const c=document.querySelector('a[href*="wa.me"],a[href*="api.whatsapp"]');return {etiqueta:a?.textContent,etiquetaY:a?.getBoundingClientRect().top,compraY:c?.getBoundingClientRect().top};});
  assert(result.etiqueta,sku);if(result.compraY!==undefined)assert(result.etiquetaY<result.compraY,sku+' condición posterior a compra');report.condicion_real_antes_de_compra.push({sku,...result});
 }
 report.aaa_no_protagonista_en_tarjetas=true;report.terceros_identificados_sin_atribucion_de_marca=true;

 assert.deepEqual(report.errores,[]);report.estado='APROBADO';fs.writeFileSync(folder+'/pruebas.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({estado:report.estado,vistas:report.vistas.map(x=>({ancho:x.ancho,altura:x.altura_maxima})),no_piloto:report.no_piloto_dom_identico,busqueda:report.busqueda_por_sku_nombre_actual_593_y_modelo}));
}finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
