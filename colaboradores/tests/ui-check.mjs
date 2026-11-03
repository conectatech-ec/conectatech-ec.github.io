// Controlled browser integration: real Worker + in-memory SQLite; never a deployed service.
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
import {readFileSync,mkdirSync} from 'node:fs';
import {fixture} from './fixture.mjs';
import assert from 'node:assert/strict';
const f=fixture();
f.env.ASSETS.fetch=async req=>{let path=new URL(req.url).pathname;if(path==='/')path='/index.html';if(!['/index.html','/ref.html','/app.js','/reference.js','/style.css'].includes(path))return new Response('Not found',{status:404});return new Response(readFileSync(new URL('../public'+path,import.meta.url)),{headers:{'Content-Type':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html'}});};
const {createServer}=await import('node:http');
let local;
const server=createServer(async (req,res)=>{try{
 if(req.url.startsWith('/test-images/')){res.setHeader('Content-Type','image/webp');res.end(readFileSync((process.env.CONECTATECH_SOURCE_DIR||'/workspace/conectatech-ec.github.io')+'/imagenes/'+req.url.slice(13)));return;}
 const parts=[];for await(const part of req)parts.push(part);const body=Buffer.concat(parts);
 const headers={...req.headers,'Test-Subject':'C1','CF-Connecting-IP':'192.0.2.1'};if(headers.origin===local)headers.origin='https://pilot.example';
 const response=await f.app.fetch(new Request('https://pilot.example'+req.url,{method:req.method,headers,body:body.length?body:undefined}),f.env);
 res.statusCode=response.status;for(const [k,v] of response.headers){res.setHeader(k,k==='content-security-policy'?v.replace('https://conectatech-ec.github.io',local):v);}
 let output=Buffer.from(await response.arrayBuffer());if(response.headers.get('content-type')?.includes('application/json'))output=Buffer.from(output.toString().replaceAll('https://conectatech-ec.github.io/imagenes/',local+'/test-images/').replaceAll('https://pilot.example/r?',local+'/r?'));
 res.end(output);
 }catch(e){res.statusCode=500;res.end(e.message);}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));local='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_BINARY||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-crashpad-for-testing','--disable-dev-shm-usage']});
const errors=[];const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(local,{waitUntil:'domcontentloaded',timeout:15000});await page.getByRole('button',{name:'Preparar anuncio'}).first().waitFor();assert.equal(await page.locator('.card').count(),3);
 await page.getByRole('button',{name:'Preparar anuncio'}).first().click();await page.locator('#reference').waitFor({state:'visible'});assert.ok((await page.locator('#copy').inputValue()).includes('Philco'));
 const link=await page.locator('#reference').getAttribute('href');await page.locator('#alias').fill('Consulta controlada');await page.getByRole('button',{name:'Registrar consulta',exact:true}).click();await page.getByRole('button',{name:'CONTACTADO',exact:true}).waitFor();await page.getByRole('button',{name:'CONTACTADO',exact:true}).click();await page.getByRole('button',{name:'INTERESADO',exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 mkdirSync('/workspace/work/verification',{recursive:true});await page.screenshot({path:'/workspace/work/verification/panel-movil.png',fullPage:true});
 await page.goto(link);await page.locator('#interest').waitFor({state:'visible'});await page.locator('#consent').check();await page.getByRole('button',{name:'Registrar mi interés'}).click();await page.getByText(/Código:/).waitFor();assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM opportunities').get().n,2);assert.deepEqual(errors,[]);console.log('PASS Chromium: catálogo 3 productos, anuncio, oportunidad, transición, móvil, referencia y consentimiento. Datos controlados, no desplegado.');
} finally {await browser.close();server.close();}
