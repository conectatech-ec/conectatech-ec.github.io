const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));
(async()=>{
 const base=path.resolve('revision-premium/lote-001'),file=path.join(base,'Comparativa-premium-CONECTATECH.html');
 const out=path.join(base,'qa');fs.mkdirSync(out,{recursive:true});
 const result={commit:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,publicado:false,sha256_html:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),vistas:[]};
 const browser=await chromium.launch();
 try{for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:1000}});let errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(file).href);await page.locator('figure img').evaluateAll(imgs=>imgs.forEach(i=>i.loading='eager'));
  await page.waitForFunction(()=>[...document.querySelectorAll('figure img')].every(i=>i.complete&&i.naturalWidth>0));
  const info=await page.evaluate(()=>({cards:document.querySelectorAll('article').length,images:document.querySelectorAll('figure img').length,width:document.documentElement.scrollWidth}));
  if(info.cards!==5||info.images!==10||info.width>width||errors.length)throw Error(JSON.stringify({info,errors}));
  await page.locator('figure img').first().click();if(!await page.locator('dialog').isVisible())throw Error('No abre ampliación');await page.locator('dialog button').click();
  await page.locator('article').first().scrollIntoViewIfNeeded();
  const screenshot='comparativa-'+width+'.png';await page.screenshot({path:path.join(out,screenshot)});
  result.vistas.push({ancho:width,estado:'VERIFICADO',...info,errores:errors,captura:screenshot});await page.close();
 }}finally{await browser.close();fs.writeFileSync(path.join(out,'validacion.json'),JSON.stringify(result,null,2)+'\n');}
})().catch(e=>{console.error(e);process.exitCode=1});
