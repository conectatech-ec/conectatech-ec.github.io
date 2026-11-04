'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{promisify}=require('node:util'),execFile=promisify(require('node:child_process').execFile);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'../..'),origin='https://conectatech-ec.github.io';
const out=process.env.PW_QA_OUTPUT||path.join(__dirname,'prioridad-comercial-publica-20261103');fs.mkdirSync(out,{recursive:true});
const changed=new Set(['/index.html','/assets/presentacion-web/config.js','/assets/presentacion-web/estilos.css','/assets/presentacion-web/portada.js','/assets/presentacion-web/rotacion.js']),cache=new Map(),checks=[];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function check(label,actual,expected){assert.deepEqual(actual,expected,label);checks.push({prueba:label,correcto:true});}
async function published(url){if(!cache.has(url))cache.set(url,execFile('curl',['--fail','--silent','--show-error','--max-time','45',url],{encoding:'buffer',maxBuffer:40*1024*1024}).then(r=>r.stdout));return cache.get(url);}
async function gitFile(ref,name){const key=ref+':'+name.slice(1);if(!cache.has(key))cache.set(key,execFile('git',['show',key],{cwd:root,encoding:'buffer',maxBuffer:40*1024*1024}).then(r=>r.stdout));return cache.get(key);}
async function bytes(u,before,publicMode){
 const name=decodeURIComponent(u.pathname)+(u.pathname.endsWith('/')?'index.html':'');
 if(publicMode)return published(u.href);
 if(before&&changed.has(name))return gitFile('fd38e24a866a81809202f31b72d7b0b1836ccb22',name);
 const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw Error('Ruta no permitida');
 if(fs.existsSync(file)&&fs.statSync(file).isFile())return fs.readFileSync(file);
 try{return await published(origin+u.pathname+u.search)}catch(_){return gitFile('HEAD',name)}
}
async function session(browser,width,before,publicMode,motion='no-preference'){
 const ctx=await browser.newContext({viewport:{width,height:1500},locale:'es-EC',reducedMotion:motion,isMobile:width<=390,hasTouch:width<=390}),p=await ctx.newPage();
 await ctx.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='conectatech-ec.github.io')return r.abort();try{const body=await bytes(u,before,publicMode),name=u.pathname.endsWith('/')?'index.html':u.pathname;await r.fulfill({body,contentType:({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.ttf':'font/ttf'})[path.extname(name)]||'text/plain'})}catch(_){await r.abort()}});
 await p.clock.install({time:new Date('2026-11-03T17:00:00Z')});await p.clock.pauseAt(new Date('2026-11-03T17:00:00Z'));await p.goto(origin+'/?black-friday-qa='+Date.now());
 await p.locator('.pw-slide.is-active').waitFor({timeout:90000});
 await p.evaluate(async()=>{await document.fonts.ready;const ims=[...document.querySelectorAll('.pw-slide-photo img,#featured img,#grid img,.pw-banner-open img,.pw-brand-campaign img')];ims.forEach(im=>im.loading='eager');await Promise.all(ims.map(im=>im.decode().catch(()=>{})));});
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
async function read(p){return p.evaluate(()=>({products:JSON.stringify(products),meta:JSON.stringify(catalogMeta),brand:document.querySelector('header .brandrow').outerHTML,background:getComputedStyle(document.querySelector('header')).backgroundImage,logoWidth:getComputedStyle(document.querySelector('header .brandlogo')).width,columns:getComputedStyle(document.querySelector('#grid')).gridTemplateColumns.split(/\s+/).length,overflow:document.documentElement.scrollWidth>innerWidth,lema:document.querySelector('.pw-brand-values').textContent,colorLema:getComputedStyle(document.querySelector('.pw-brand-values')).color,sizeLema:parseFloat(getComputedStyle(document.querySelector('.pw-brand-values')).fontSize),mode:document.querySelector('#catalogSort').value,plan:{vitrina:CONECTATECH_PRESENTACION_ESTADO.productos,destacados:CONECTATECH_PRESENTACION_ESTADO.destacados},families:typeof CONECTATECH_COMERCIAL==='undefined'?null:products.map(p=>({sku:p.sku,family:CONECTATECH_COMERCIAL.familia(p)}))}))}
async function decodeGrid(p){await p.evaluate(async()=>{await Promise.all([...document.querySelectorAll('#grid img')].map(im=>{im.loading='eager';return im.decode().catch(()=>{})}))})}
async function catalogShot(p,mode,width,page){if(![1440,390].includes(width))return;await p.setViewportSize({width,height:1000});await p.locator('#catalogo').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));if(mode==='publica'&&width>600)check('Página '+page+' encabezado del catálogo visible',await p.evaluate(()=>document.querySelector('#catalogo').getBoundingClientRect().top>=document.querySelector('header').getBoundingClientRect().bottom),true);await p.screenshot({path:path.join(out,mode+'-'+width+'-pagina-'+page+'.jpg'),type:'jpeg',quality:88});}
(async()=>{
 const sources=[];for(const name of ['/assets/presentacion-web/estilos.css?v=24','/assets/presentacion-web/config.js?v=12','/assets/presentacion-web/rotacion.js?v=10','/assets/presentacion-web/comercial.js?v=1','/assets/presentacion-web/portada.js?v=19','/assets/presentacion-web/marca-trazos-originales.svg','/logo-conectatech.png']){const b=await published(origin+name);check('HTTP SHA '+name,sha(b),sha(fs.readFileSync(path.join(root,name.split('?')[0]))));sources.push({url:origin+name,sha256:sha(b),bytes:b.length})}
 const html=await published(origin+'/?prioridad-comercial-publica='+Date.now());const parse=s=>JSON.parse(s.match(/const products=(\[[\s\S]*?\]);\s*\n/)[1]);check('Todos los objetos comerciales públicos intactos',parse(html.toString()),parse(fs.readFileSync(path.join(root,'index.html'),'utf8')));sources.push({url:origin+'/',sha256:sha(html),bytes:html.length});
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']}),results=[];
 try{for(const width of [1440,768,390,320]){
  const rows={};for(const mode of ['aprobado','publica']){const {ctx,p}=await session(browser,width,false,mode==='publica');try{
   rows[mode]=await read(p);const pages=[];
   if(mode==='publica'&&[1440,390].includes(width))for(const [tag,selector] of [['encabezado','header'],['vitrina','.pw-hero'],['destacados','#destacados']])await p.locator(selector).screenshot({path:path.join(out,mode+'-'+width+'-'+tag+'.jpg'),type:'jpeg',quality:90});
   for(let page=1;page<=3;page++){await p.evaluate(n=>goToPage(n),page);await decodeGrid(p);const items=await p.evaluate(()=>[...document.querySelectorAll('#grid [data-sku]')].map(e=>{const a=products.find(p=>p.sku===e.dataset.sku);return {sku:a.sku,category:a.category,eligible:availabilityFor(a).commercial_eligible,loaded:[...e.querySelectorAll('img')].every(im=>im.complete&&im.naturalWidth>0)}}));pages.push(items);if(mode==='publica'&&(page===1||width===1440))await catalogShot(p,mode,width,page)}rows[mode].pages=pages;
   const sorts={};for(const value of ['recientes','fotos','catalogo','nombre','precio-asc','precio-desc']){await p.selectOption('#catalogSort',value);sorts[value]=await p.evaluate(()=>orderedProducts(products.slice()).map(p=>p.sku))}rows[mode].sorts=sorts;
   await p.selectOption('#catalogSort','recomendados');const queries={};for(const q of ['TELF017','Redmi','cable Andowl']){await p.locator('#q').fill(q);queries[q]=await p.evaluate(()=>orderedProducts(products.filter(p=>matchesSearch(p,searchBox.value))).map(p=>p.sku))}rows[mode].queries=queries;await p.locator('#q').fill('');
   if(mode==='publica'){
    const row=rows[mode],family=new Map(row.families.map(x=>[x.sku,x.family]));check(width+' Recomendados público',row.mode,'recomendados');check(width+' lema blanco',row.colorLema,'rgb(255, 255, 255)');check(width+' sin desbordamiento',row.overflow,false);check(width+' cinco/tres/dos columnas',row.columns,width>=1200?5:width>=601?3:2);check(width+' diez destacados únicos',new Set([...row.plan.vitrina,...row.plan.destacados]).size,10);
    for(const area of ['vitrina','destacados']){check(width+' teléfono inicial '+area,family.get(row.plan[area][0]),'celulares');check(width+' productos estratégicos '+area,row.plan[area].every(s=>['celulares','tablets','pantallas','almacenamiento','smartwatch','audio'].includes(family.get(s))),true)}
    check(width+' 72 SKU diferentes',new Set(pages.flat().map(p=>p.sku)).size,72);for(let i=0;i<3;i++){check(width+' página '+(i+1)+' disponibles y fotografías cargadas',pages[i].every(p=>p.eligible&&p.loaded),true);check(width+' página '+(i+1)+' teléfonos',pages[i].some(p=>p.category==='Telefonos'),true);check(width+' página '+(i+1)+' sin marginales',pages[i].some(p=>['Chips','Pilas','Juguetes','Cables','Adaptadores'].includes(p.category)),false)}
    await p.locator('#categorySelect').selectOption('Telefonos');check(width+' categoría preservada',await p.locator('#grid [data-sku]').evaluateAll(es=>es.every(e=>products.find(p=>p.sku===e.dataset.sku).category==='Telefonos')),true);await p.locator('#categorySelect').selectOption({index:0});
    check(width+' WhatsApp vitrina',await p.locator('.pw-slide.is-active .pw-slide-buy').getAttribute('href').then(x=>x.startsWith('https://wa.me/')),true);check(width+' ficha vitrina',await p.locator('.pw-slide.is-active .pw-slide-link').getAttribute('href').then(x=>x.startsWith('/productos/')),true);
    if(width===1440){await p.clock.setSystemTime(new Date('2026-11-04T17:00:00Z'));await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));const next=await read(p);check('Rotación diaria pública',JSON.stringify(next.plan)!==JSON.stringify(row.plan),true);check('Teléfono sigue primero al día siguiente',next.families.find(x=>x.sku===next.plan.vitrina[0]).family,'celulares')}
   }
  }finally{await ctx.close()}}
  for(const key of ['products','meta','brand','background','logoWidth','lema','mode','plan','sorts','queries','pages'])check(width+' público idéntico a aprobado '+key,rows.publica[key],rows.aprobado[key]);results.push({width,mode:rows.publica.mode,plan:rows.publica.plan,pages:rows.publica.pages});
 }
 const report={estado:'CORRECTO',publicacionVerificada:true,fecha:new Date().toISOString(),motor:await browser.version(),commitCorreccion:'742a91ac4fe2bc0e9238513ca9e70ca85b45ae50',commitPublicacion:process.env.PW_DEPLOY_SHA,desplieguePages:process.env.PW_PAGES_RUN,fuentesPublicas:sources,comprobaciones:checks,resultados:results};fs.writeFileSync(path.join(out,'resultado.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({estado:report.estado,checks:checks.length,out}));
 }finally{await browser.close()}
})().catch(e=>{console.error(String(e).slice(0,2000));process.exit(1)});
