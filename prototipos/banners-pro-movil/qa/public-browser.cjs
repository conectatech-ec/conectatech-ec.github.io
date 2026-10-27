const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const base=process.env.BANNERS_PRO_QA_URL;if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base||''))throw Error('Local QA URL required');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,acceptDownloads:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForFunction(()=>state.library?.products.length===5);
 assert.equal(await page.locator('#loginPanel').isVisible(),false);assert.equal(await page.locator('#pdfs').isVisible(),false);assert.equal((await context.cookies()).length,0);
 await page.locator('#search').fill('ZTE');assert.equal(await page.locator('.card').count(),1);await page.locator('.visual').click();await page.waitForFunction(()=>document.querySelector('#previewImage').naturalWidth===1200);
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#modalDownload').click()]);const target=__dirname+'/public-download.png';await download.saveAs(target);
 const row=JSON.parse(fs.readFileSync(__dirname+'/fixtures.json')).find(p=>p.sku==='TELF001');assert.equal(crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'),row.sha256);
 const pdf=JSON.parse(fs.readFileSync(__dirname+'/pdf-fixtures.json'))[0];assert.equal((await context.request.post(base+'/api/getAsset',{data:[pdf.driveId,1]})).status(),403);assert.equal((await context.request.post(base+'/api/getAsset',{data:['arbitrary',1]})).status(),403);
 await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async d=>{window.sharedCount=d.files.length}})});await page.locator('#modalShare').click();await page.waitForFunction(()=>window.sharedCount===1);assert.deepEqual(errors,[]);
 const report={public_without_google:true,no_cookies:true,five_real_banners:true,search:true,full_view:true,download_sha_original:true,webshare_simulated:true,private_pdf_blocked:true,arbitrary_id_blocked:true,google_oauth_required:false,android_physical:'NOT_VERIFIED',deployed:false};fs.writeFileSync(__dirname+'/public-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
