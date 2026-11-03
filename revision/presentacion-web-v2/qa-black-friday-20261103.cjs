'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{promisify}=require('node:util'),execFile=promisify(require('node:child_process').execFile);
const {chromium}=require(process.env.BF_PLAYWRIGHT_PATH),root=path.resolve(__dirname,'../..'),origin='https://conectatech-ec.github.io';
const out=path.join(__dirname,'qa-black-friday-20261103/evidencia/r'+(process.env.GITHUB_RUN_ATTEMPT||'1'));fs.mkdirSync(out,{recursive:true});
const changed=new Set(['/index.html','/assets/presentacion-web/config.js','/assets/presentacion-web/estilos.css','/assets/presentacion-web/portada.js']),cache=new Map(),checks=[];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function check(label,actual,expected){assert.deepEqual(actual,expected,label);checks.push({prueba:label,correcto:true});}
async function published(url){if(!cache.has(url))cache.set(url,fetch(url,{signal:AbortSignal.timeout(45000)}).then(async r=>{if(!r.ok)throw Error('HTTP '+r.status+' '+url);return Buffer.from(await r.arrayBuffer())}));return cache.get(url);}
async function gitFile(ref,name){const key=ref+':'+name.slice(1);if(!cache.has(key))cache.set(key,execFile('git',['show',key],{cwd:root,encoding:'buffer',maxBuffer:40*1024*1024}).then(r=>r.stdout));return cache.get(key);}
async function bytes(u,before,publicMode){
 const name=decodeURIComponent(u.pathname)+(u.pathname.endsWith('/')?'index.html':'');
 if(publicMode)return published(u.href);
 if(before&&changed.has(name))return gitFile('66172c0bf2c0ee8da52f16f51052403686e0f728',name);
 const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw Error('Ruta no permitida');
 if(fs.existsSync(file)&&fs.statSync(file).isFile())return fs.readFileSync(file);
 try{return await published(origin+u.pathname+u.search)}catch(_){return gitFile('HEAD',name)}
}
async function session(browser,width,before,publicMode){
 const ctx=await browser.newContext({viewport:{width,height:1500},locale:'es-EC',reducedMotion:'reduce',isMobile:width<=390,hasTouch:width<=390}),p=await ctx.newPage();
 await ctx.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='conectatech-ec.github.io')return r.abort();try{const body=await bytes(u,before,publicMode),name=u.pathname.endsWith('/')?'index.html':u.pathname;await r.fulfill({body,contentType:({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.ttf':'font/ttf'})[path.extname(name)]||'text/plain'})}catch(_){await r.abort()}});
 await p.clock.install({time:new Date('2026-11-03T17:00:00Z')});await p.clock.pauseAt(new Date('2026-11-03T17:00:00Z'));await p.goto(origin+'/?black-friday-qa='+Date.now());
 await p.locator('.pw-slide.is-active').waitFor({timeout:90000});
 await p.evaluate(async()=>{await document.fonts.ready;const ims=[...document.querySelectorAll('.pw-slide-photo img,#featured img,#grid img,.pw-banner-open img')];ims.forEach(im=>im.loading='eager');await Promise.all(ims.map(im=>im.decode().catch(()=>{})));});
 return {ctx,p};
}
async function snapshot(p){return p.evaluate(()=>({
 theme:document.body.dataset.ctTemporada,label:document.querySelector('[data-pw-season-name]')?.textContent||'',
 products:JSON.stringify(products),catalog:document.querySelector('#grid').outerHTML,featured:document.querySelector('#featured').outerHTML,
 photos:[...document.querySelectorAll('.pw-slide-photo img,#featured img,#grid img')].map(e=>({url:e.getAttribute('src'),loaded:e.complete&&e.naturalWidth>0})),
 brand:document.querySelector('header .brandrow').outerHTML,logoWidth:getComputedStyle(document.querySelector('header .brandlogo')).width,
 columns:getComputedStyle(document.querySelector('#grid')).gridTemplateColumns.split(/\s+/).length,
 overflow:document.documentElement.scrollWidth>innerWidth,
 gift:document.querySelector('.pw-campaign').innerText,giftImage:document.querySelector('.pw-banner-open img').getAttribute('src'),
 giftWA:document.querySelector('.pw-campaign [data-pw-contact] a').href,
 halloween:[...document.querySelectorAll('.pw-logo-season,.pw-bats,.pw-web,.pw-luna-iluminada')].every(e=>!e.getClientRects().length||getComputedStyle(e).display==='none'),
 reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,
 heroBackground:getComputedStyle(document.querySelector('.pw-hero')).backgroundImage,
 featuredBackground:getComputedStyle(document.querySelector('#destacados')).backgroundImage
}));}
async function captures(p,mode,width){
 if(![1440,390].includes(width))return;
 for(const [tag,sel] of [['vitrina','.pw-hero'],['destacados','#destacados'],['regalos','.pw-campaign']]){
   await p.locator(sel).screenshot({path:path.join(out,mode+'-'+width+'-'+tag+'.jpg'),type:'jpeg',quality:88,animations:'disabled'});
 }
}
async function interactions(p,width,prefix){
 await p.evaluate(()=>{document.dispatchEvent(new Event('visibilitychange'));document.dispatchEvent(new Event('visibilitychange'));});
 check(prefix+width+' rótulo único',await p.locator('[data-pw-season-name]').count(),1);
 check(prefix+width+' rótulo realmente visible',await p.locator('[data-pw-season-name]').isVisible(),true);
 await p.locator('.pw-campaign summary').click();check(prefix+width+' condiciones abren',await p.locator('.pw-campaign details').evaluate(e=>e.open),true);
 await p.locator('.pw-campaign summary').click();await p.locator('.pw-banner-open').click();check(prefix+width+' banner ampliable',await p.locator('.pw-banner-dialog').evaluate(e=>e.open),true);await p.locator('.pw-banner-dialog form button').click();
 const sku=await p.locator('#grid [data-sku]').first().getAttribute('data-sku');await p.locator('#q').fill(sku);
 await p.waitForFunction(s=>[...document.querySelectorAll('#grid [data-sku]')].some(e=>e.dataset.sku===s),sku);
 const found=p.locator('#grid [data-sku="'+sku+'"]');check(prefix+width+' búsqueda conserva SKU',await found.count(),1);
 const hrefs=await found.locator('a').evaluateAll(es=>es.map(e=>e.getAttribute('href')));check(prefix+width+' compra por WhatsApp',hrefs.some(h=>h&&h.startsWith('https://wa.me/')),true);check(prefix+width+' acceso a ficha',hrefs.some(h=>h&&h.startsWith('/productos/')),true);
 await p.clock.setSystemTime(new Date('2026-12-01T17:00:00Z'));await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 check(prefix+width+' Navidad automática',await p.locator('body').getAttribute('data-ct-temporada'),'navidad');
 check(prefix+width+' Black Friday se retira en diciembre',await p.locator('[data-pw-season-name]').count(),0);
}
(async()=>{
 const executablePath=[process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].filter(Boolean).find(p=>fs.existsSync(p));assert.ok(executablePath,'Chrome instalado en el ejecutor de CI');
 const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']}),results=[];
 try{
  for(const width of [1440,768,390,320]){
   const rows={};for(const mode of ['antes','despues']){const {ctx,p}=await session(browser,width,mode==='antes',false);try{rows[mode]=await snapshot(p);await captures(p,mode,width);if(mode==='despues')await interactions(p,width,'Local ');}finally{await ctx.close()}}
   check(width+' Black Month anterior',rows.antes.theme,'black-month');check(width+' Black Friday activo',rows.despues.theme,'black-friday');check(width+' rótulo comercial',rows.despues.label,'Black Friday');
   for(const key of ['products','catalog','featured','brand','logoWidth','gift','giftImage','giftWA'])check(width+' conserva '+key,rows.despues[key],rows.antes[key]);
   check(width+' mismas fotografías',rows.despues.photos.map(x=>x.url),rows.antes.photos.map(x=>x.url));check(width+' fotografías cargadas',rows.despues.photos.every(x=>x.loaded),true);
   check(width+' columnas compactas',rows.despues.columns,width>=1200?5:width>=601?3:2);check(width+' sin desbordamiento',rows.despues.overflow,false);check(width+' Halloween oculto',rows.despues.halloween,true);check(width+' movimiento reducido',rows.despues.reduced,true);
   results.push({width,antes:{theme:rows.antes.theme},despues:{theme:rows.despues.theme,label:rows.despues.label,columns:rows.despues.columns,products:JSON.parse(rows.despues.products).length},backgrounds:{hero:rows.despues.heroBackground,destacados:rows.despues.featuredBackground}});
  }
  const expectedIndex=fs.readFileSync(path.join(root,'index.html'),'utf8');let publicReady=false,publicSources=[];
  try{
   const html=(await published(origin+'/?black-friday-verificacion='+Date.now())).toString();
   for(const name of ['estilos.css','config.js','portada.js']){
    const re=new RegExp('/assets/presentacion-web/'+name.replace('.','\\.')+'\\?v=[^"\\s]+'),ref=expectedIndex.match(re)?.[0];assert.ok(ref);assert.ok(html.includes(ref),'Versión pública '+name);
    const data=await published(origin+ref);assert.equal(sha(data),sha(fs.readFileSync(path.join(root,'assets/presentacion-web',name))));publicSources.push({archivo:ref,sha256:sha(data)});
   }publicReady=true;
  }catch(e){console.log('PUBLICACION_PENDIENTE='+e.message)}
  if(process.env.BF_REQUIRE_PUBLIC==='true')check('Publicación real disponible',publicReady,true);
  if(publicReady)for(const width of [1440,768,390,320]){
   const {ctx,p}=await session(browser,width,false,true);try{const row=await snapshot(p);check('Público '+width+' Black Friday',row.theme,'black-friday');check('Público '+width+' rótulo',row.label,'Black Friday');check('Público '+width+' columnas',row.columns,width>=1200?5:width>=601?3:2);check('Público '+width+' sin desbordamiento',row.overflow,false);check('Público '+width+' fotos reales cargadas',row.photos.every(x=>x.loaded),true);await captures(p,'publico',width);await interactions(p,width,'Público ');}finally{await ctx.close()}
  }
  const report={estado:'CORRECTO',sha:process.env.GITHUB_SHA,fecha:new Date().toISOString(),motor:await browser.version(),publicacionVerificada:publicReady,fuentesPublicas:publicSources,comprobaciones:checks,resultados:results};
  fs.writeFileSync(path.join(out,'resultado.json'),JSON.stringify(report,null,2));console.log('BLACK_FRIDAY_QA='+JSON.stringify({estado:report.estado,checks:checks.length,publicacionVerificada:publicReady,evidencia:out}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
