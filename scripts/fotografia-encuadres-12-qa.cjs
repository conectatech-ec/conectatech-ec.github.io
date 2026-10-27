// Sólo lectura: comprueba imágenes publicadas sin regenerar catálogo ni tocar datos.
const {chromium}=require('playwright'),assert=require('assert');
(async()=>{
 const origin='https://conectatech-ec.github.io',raw='https://raw.githubusercontent.com/conectatech-ec/conectatech-ec.github.io/'+process.env.PHOTO_SHA;
 const get=async u=>{const r=await fetch(u);assert(r.ok,u);return r.json();};
 const record=await get(raw+'/importacion/fotografia-publicada/direccion-20261027-12.json');
 const names=['20261026-05','20261026-06','20261026-07','20261026-08','20261027-09','20261027-10','20261027-11'];
 const prior=Object.assign({},...await Promise.all(names.map(async n=>(await get(raw+'/importacion/fotografia-publicada/direccion-'+n+'.json')).productos)));
 const all={...prior,...record.productos},results=[];
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:950}});
  for(const [sku,row] of Object.entries(record.productos)){
   await page.goto(origin+row.pagina,{waitUntil:'commit',timeout:60000});
   await page.locator('.product-frame img').waitFor();await page.locator('.product-frame').scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>{const i=document.querySelector('.product-frame img');return i?.complete&&i.naturalWidth>0;});
   for(const img of await page.locator('.gallery img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode());}
   const data=await page.evaluate(()=>({cover:new URL(document.querySelector('.product-frame img').src).pathname,count:document.querySelectorAll('.gallery img').length,broken:[...document.querySelectorAll('.product-frame img,.gallery img')].filter(i=>!i.complete||!i.naturalWidth).length,overflow:document.documentElement.scrollWidth>innerWidth}));
   assert.equal(data.cover,row.imagenProfesional.versiones['1200'].url);assert.equal(data.count,row.miniaturas_esperadas);assert(!data.broken&&!data.overflow);results.push({sku,width,...data});
  }
  await page.goto(origin+'/?foto=encuadres12',{waitUntil:'commit',timeout:60000});await page.locator('#grid article').first().waitFor();
  const catalog=await page.evaluate(({all,record})=>{
   const sorted=orderedProducts([...products]),meta=window.CONECTATECH_CATALOGO.productos;
   return {primero:sorted[0].sku,errores:Object.entries(all).filter(([s,r])=>products.find(p=>p.sku===s)?.imageUrl!==(r.imagenProfesional?.versiones['1200'].url||r.portada_anterior.url)).map(([s])=>s),fechas:record.publicacion_verificada?Object.keys(record.productos).filter(s=>Date.parse(meta[s].actualizadoEn)<Date.parse(record.fecha_primera_verificacion_publica)):[],posiciones:Object.fromEntries(Object.keys(record.productos).map(s=>[s,sorted.findIndex(p=>p.sku===s)+1]))};
  },{all,record});assert(!catalog.errores.length&&!catalog.fechas.length);
  await page.goto(origin+'/revision/fotografia-encuadres-20261027-12/',{waitUntil:'commit',timeout:60000});await page.locator('article').first().waitFor();
  for(const img of await page.locator('article img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode());}
  assert.equal(await page.locator('article').count(),Object.keys(record.productos).length);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  console.log('CATALOGO_ENCUADRES_12='+JSON.stringify({width,...catalog,galeria_casos:await page.locator('article').count()}));await page.close();
 }
 await browser.close();console.log('QA_ENCUADRES_12='+JSON.stringify(results));
})().catch(e=>{console.error(e);process.exit(1);});
