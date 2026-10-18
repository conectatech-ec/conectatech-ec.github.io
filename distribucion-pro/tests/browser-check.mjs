// Only local files. Does not navigate to or automate Meta.
import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';import {mkdirSync} from 'node:fs';import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright');const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BINARY||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-crashpad-for-testing','--disable-dev-shm-usage']});
const path=new URL('../paquete/index.html',import.meta.url).href;const errors=[];const page=await browser.newPage({viewport:{width:1440,height:1100}});page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(path,{waitUntil:'load'});await page.locator('.card').first().waitFor();assert.equal(await page.locator('.card').count(),30);
 assert.equal(await page.locator('.photo').evaluateAll(imgs=>imgs.every(img=>img.complete&&img.naturalWidth>0)),true);
 await page.getByRole('button',{name:'Revisar anuncio →'}).first().click();await page.locator('#detail').waitFor({state:'visible'});assert.ok((await page.locator('#copy').inputValue()).includes('Precio de contado: $145.90'));assert.ok(!(await page.locator('#copy').inputValue()).includes('Ficha:'));
 await page.locator('#channel').selectOption('FACEBOOK_PAGINA');assert.ok((await page.locator('#copy').inputValue()).includes('Ficha: https://conectatech-ec.github.io/'));
 await page.locator('#reviewCheck').check();await page.getByRole('button',{name:'Cerrar',exact:true}).click();assert.ok((await page.locator('#reviewed').textContent()).includes('1.'));
 await page.locator('#search').fill('Philco');assert.equal(await page.locator('.card').count(),1);await page.locator('#search').fill('');
 const dir=new URL('../galeria/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});await page.screenshot({path:dir+'bandeja-escritorio.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:dir+'bandeja-movil.png',fullPage:true});
 await page.clock.install({time:new Date('2026-10-20T12:00:00Z')});await page.reload();await page.getByRole('button',{name:'Revisar anuncio →'}).first().click();assert.equal(await page.locator('#copyText').isDisabled(),true);assert.equal(await page.locator('#downloadText').isDisabled(),true);assert.deepEqual(errors,[]);
 console.log('PASS Chromium: 30 imágenes locales, textos por canal, búsqueda, revisión local, escritorio, móvil sin desbordamiento y bloqueo por caducidad. Ninguna publicación externa.');
}finally{await browser.close();}
