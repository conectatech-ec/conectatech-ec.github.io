const base=process.env.BANNERS_PRO_QA_URL;if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base||''))throw Error('BANNERS_PRO_QA_URL local requerido');
const {chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const checks={};
 try{
 const c=await b.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,acceptDownloads:true});
 const denied=await c.request.get(base+'/api/getLibrary');assert.equal(denied.status(),403);checks.sin_sesion_bloqueado=true;
 await c.request.get(base+'/__qa_login');const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install();await p.goto(base);await p.waitForFunction(()=>state.library?.products?.length===5);
 await p.locator('.visual img').first().waitFor();await p.waitForTimeout(800);
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks.sin_desbordamiento_movil=true;
 await p.locator('.card').last().scrollIntoViewIfNeeded();await p.waitForFunction(()=>[...document.querySelectorAll('.visual img')].every(i=>i.naturalWidth===1200));await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:__dirname+'/movil-galeria.png',fullPage:true});
 await p.locator('#search').fill('TELF001');assert.equal(await p.locator('.card').count(),1);checks.busqueda_sku=true;
 await p.locator('#search').fill('zte');assert.equal(await p.locator('.card').count(),1);checks.busqueda_marca=true;
 await p.locator('#search').fill('A56');assert.equal(await p.locator('.card').count(),1);checks.busqueda_modelo=true;
 await p.locator('.visual').click();await p.waitForFunction(()=>document.querySelector('#previewImage').naturalWidth===1200);checks.banner_real_1200=true;
 const download=await Promise.all([p.waitForEvent('download'),p.locator('#modalDownload').click()]);const file=download[0];await file.saveAs(__dirname+'/descarga-real.png');const expected=JSON.parse(fs.readFileSync(__dirname+'/fixtures.json')).find(x=>x.sku==='TELF001').sha256;
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(__dirname+'/descarga-real.png')).digest('hex'),expected);checks.descarga_bytes_originales=true;
 await p.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.sharedFixture=data.files.map(f=>({name:f.name,type:f.type,size:f.size}))}})});
 await p.locator('#modalShare').click();await p.waitForFunction(()=>window.sharedFixture?.length===1);checks.compartir_file_api_simulada=await p.evaluate(()=>sharedFixture[0]);
 await p.screenshot({path:__dirname+'/movil-banner.png',fullPage:true});await p.locator('#close').click();
 await p.waitForFunction(()=>state.busy===false);const automaticOld=await p.evaluate(()=>state.library.products[0].version);await c.request.post(base+'/__qa_change_version',{data:[]});await p.clock.fastForward(60001);await p.waitForFunction(v=>state.library.products[0].version>v,automaticOld);checks.actualizacion_automatica_en_pantalla_simulada=true;
 const old=await p.evaluate(()=>state.library.products[0].version);await c.request.post(base+'/__qa_change_version',{data:[]});let staleDownloads=0;const staleListener=()=>staleDownloads++;p.on('download',staleListener);await p.locator('.actions button').filter({hasText:'Descargar'}).first().click();await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('El material cambió'));assert.equal(staleDownloads,0);p.off('download',staleListener);checks.revalidacion_cache_antes_descargar=true;await p.locator('#refresh').click();await p.waitForFunction(v=>state.library.products[0].version>v,old);checks.cambio_version_local=true;
 const stale=await c.request.post(base+'/api/getAsset',{data:[JSON.parse(fs.readFileSync(__dirname+'/fixtures.json'))[0].driveId,old]});assert.equal(stale.status(),409);checks.version_anterior_bloqueada=true;
 const bad=await c.request.post(base+'/api/getAsset',{data:['NO-AUTORIZADO',2]});assert.equal(bad.status(),403);checks.archivo_arbitrario_bloqueado=true;
 await p.locator('#search').fill('');await p.locator('#category').selectOption('Smartwatch');assert.equal(await p.locator('.card').count(),1);checks.filtro_categoria=true;
 await p.locator('#category').selectOption('');await p.locator('#pdfs').click();assert.equal(await p.locator('.card').count(),1);checks.catalogos_pdf=true;
 const down=await Promise.all([p.waitForEvent('download'),p.locator('.actions button').filter({hasText:'Descargar'}).first().click()]);await down[0].saveAs(__dirname+'/catalogo-descargado.pdf');assert(fs.readFileSync(__dirname+'/catalogo-descargado.pdf').subarray(0,4).toString()==='%PDF');checks.pdf_real_descargado=true;
 await p.screenshot({path:__dirname+'/movil-catalogos.png',fullPage:true});assert.deepEqual(errors,[]);checks.javascript_sin_errores=true;
 checks.android_fisico='NO_VERIFICADO';checks.google_autenticacion_real='NO_VERIFICADO';checks.drive_runtime_en_nube='NO_VERIFICADO';checks.whatsapp_envio_real='NO_VERIFICADO';
 fs.writeFileSync(__dirname+'/resultado.json',JSON.stringify(checks,null,2));console.log(JSON.stringify(checks));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
