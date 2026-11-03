'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{promisify}=require('node:util'),execFile=promisify(require('node:child_process').execFile);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'../..'),origin='https://conectatech-ec.github.io';
const out=process.env.PW_QA_OUTPUT||path.join(__dirname,'black-month-publica-20261103');fs.mkdirSync(out,{recursive:true});
const changed=new Set(['/index.html','/assets/presentacion-web/config.js','/assets/presentacion-web/estilos.css','/assets/presentacion-web/portada.js']),cache=new Map(),checks=[];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function check(label,actual,expected){assert.deepEqual(actual,expected,label);checks.push({prueba:label,correcto:true});}
async function published(url){if(!cache.has(url))cache.set(url,execFile('curl',['--fail','--silent','--show-error','--max-time','45',url],{encoding:'buffer',maxBuffer:40*1024*1024}).then(r=>r.stdout));return cache.get(url);}
async function gitFile(ref,name){const key=ref+':'+name.slice(1);if(!cache.has(key))cache.set(key,execFile('git',['show',key],{cwd:root,encoding:'buffer',maxBuffer:40*1024*1024}).then(r=>r.stdout));return cache.get(key);}
async function bytes(u,before,publicMode){
 const name=decodeURIComponent(u.pathname)+(u.pathname.endsWith('/')?'index.html':'');
 if(publicMode)return published(u.href);
 if(before&&changed.has(name))return gitFile('ad17100151687c6bf4d47152f7dca1c081c3f486',name);
 const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw Error('Ruta no permitida');
 if(fs.existsSync(file)&&fs.statSync(file).isFile())return fs.readFileSync(file);
 try{return await published(origin+u.pathname+u.search)}catch(_){return gitFile('HEAD',name)}
}
async function session(browser,width,before,publicMode,motion='no-preference'){
 const ctx=await browser.newContext({viewport:{width,height:1500},locale:'es-EC',reducedMotion:motion,isMobile:width<=390,hasTouch:width<=390}),p=await ctx.newPage();
 await ctx.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='conectatech-ec.github.io')return r.abort();try{const body=await bytes(u,before,publicMode),name=u.pathname.endsWith('/')?'index.html':u.pathname;await r.fulfill({body,contentType:({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.ttf':'font/ttf'})[path.extname(name)]||'text/plain'})}catch(_){await r.abort()}});
 await p.clock.install({time:new Date('2026-11-03T17:00:00Z')});await p.clock.pauseAt(new Date('2026-11-03T17:00:00Z'));await p.goto(origin+'/?black-friday-qa='+Date.now());
 await p.locator('.pw-slide.is-active').waitFor({timeout:90000});
 await p.evaluate(async()=>{await document.fonts.ready;const ims=[...document.querySelectorAll('.pw-slide-photo img,#featured img,#grid img,.pw-banner-open img')];ims.forEach(im=>im.loading='eager');await Promise.all(ims.map(im=>im.decode().catch(()=>{})));});
 if(!before)await p.evaluate(async()=>{const im=new Image();im.src="/assets/presentacion-web/black-month-escenario-premium-20261103.webp";await im.decode()});await p.clock.runFor(100);
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
 featuredBackground:getComputedStyle(document.querySelector('#destacados')).backgroundImage,photoStyles:[...document.querySelectorAll('.pw-slide-photo img')].map(im=>({src:im.getAttribute('src'),fit:getComputedStyle(im).objectFit,transform:getComputedStyle(im).transform})),h1:document.querySelector('.ct-hero-copy h1').textContent,headingCount:document.querySelectorAll('.ct-hero-copy h1').length
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
 check(prefix+width+' Black Month se retira en diciembre',await p.locator('[data-pw-season-name]').count(),0);check(prefix+width+' titular original vuelve en Navidad',await p.locator('.ct-hero-copy h1').textContent(),'Tu mundo más conectado');
}
(async()=>{
 const sourceRows=[];
 for(const name of ['/assets/presentacion-web/config.js?v=11','/assets/presentacion-web/estilos.css?v=22','/assets/presentacion-web/portada.js?v=17','/assets/presentacion-web/black-month-escenario-premium-20261103.webp']){
  const publicBytes=await published(origin+name),expected=fs.readFileSync(path.join(root,name.split('?')[0]));check('HTTP SHA '+name,sha(publicBytes),sha(expected));sourceRows.push({url:origin+name,sha256:sha(publicBytes),bytes:publicBytes.length});
 }
 const rootBytes=await published(origin+'/?black-month-publica='+Date.now()),html=rootBytes.toString();
 for(const ref of ['estilos.css?v=22','config.js?v=11','portada.js?v=17'])check('Recurso actual '+ref,html.includes('/assets/presentacion-web/'+ref),true);
 const parse=s=>JSON.parse(s.match(/const products=(\[[\s\S]*?\]);\s*\n/)[1]);
 sourceRows.push({url:origin+'/',sha256:sha(rootBytes),bytes:rootBytes.length});
 const expectedProducts=parse(fs.readFileSync(path.join(root,'index.html'),'utf8'));
 check('1198 objetos comerciales públicos intactos',parse(html),expectedProducts);
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});const results=[];
 try{
  for(const width of [1440,768,390,320]){
   const baseline=await session(browser,width,false,false);let approved;try{approved=await snapshot(baseline.p)}finally{await baseline.ctx.close()}
   const {ctx,p}=await session(browser,width,false,true);
   try{
    const row=await snapshot(p);check(width+' Black Month público',row.theme,'black-month');check(width+' H1 campaña',row.h1,'Black Month');check(width+' H1 único',row.headingCount,1);check(width+' sin desbordamiento',row.overflow,false);check(width+' columnas catálogo',row.columns,width>=1200?5:width>=601?3:2);check(width+' imágenes reales cargadas',row.photos.every(x=>x.loaded),true);check(width+' datos y normalización públicos idénticos a fuente aprobada',row.products,approved.products);for(const key of ['catalog','featured','brand','logoWidth','gift','giftImage','giftWA','photoStyles'])check(width+' renderizado público aprobado '+key,row[key],approved[key]);check(width+' escenario premium',row.heroBackground.includes('black-month-escenario-premium-20261103.webp'),true);
    check(width+' encabezado azul original público',await p.locator('header').evaluate(e=>getComputedStyle(e).backgroundImage),"radial-gradient(at 100% 100%, rgb(7, 58, 78), rgba(0, 0, 0, 0) 60%), linear-gradient(105deg, rgb(3, 17, 30), rgb(6, 28, 48))");check(width+' regalo Black Month visible',await p.locator('.pw-brand-campaign').isVisible(),true);check(width+' tamaño original del logo',await p.locator('header .brandlogo').evaluate(e=>e.getBoundingClientRect().width),width===1440?112:width===768?100:width===390?88:84);await p.locator('header').screenshot({path:path.join(out,'publica-'+width+'-encabezado.jpg'),type:'jpeg',quality:90});await captures(p,'publica',width);await interactions(p,width,'Pública ');check(width+' regalo se retira en diciembre',await p.locator('.pw-brand-campaign').isVisible(),false);results.push({width,theme:row.theme,heading:row.h1,columns:row.columns,products:JSON.parse(row.products).length});
   }finally{await ctx.close()}
  }
  const reduced=await session(browser,390,false,true,'reduce');try{check('Movimiento reducido público',await reduced.p.locator('.pw-slide.is-active .pw-slide-photo').evaluate(e=>getComputedStyle(e).transform),'none');}finally{await reduced.ctx.close()}
  const report={estado:'CORRECTO',publicacionVerificada:true,desplieguePages:41737837297,commitPublicacion:'cabcaeb2a2117036f2fc6dfd9c1eb44373c2ff09',commitCorreccion:'ed49298488b5f8e590ac7c789e9d8f85fa0d1911',fecha:new Date().toISOString(),motor:await browser.version(),fuentesPublicas:sourceRows,comprobaciones:checks,resultados:results};fs.writeFileSync(path.join(out,'resultado.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({estado:report.estado,checks:checks.length,out}));
 }finally{await browser.close()}
})().catch(e=>{console.error(String(e).slice(0,1500));process.exit(1)});
