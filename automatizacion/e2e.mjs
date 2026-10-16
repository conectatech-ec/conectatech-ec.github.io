// Execute the real handler with live sources; PILOT_BASE_URL tests deployed HTTPS.
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
import catalog from './generated/catalogo.json' with {type:'json'};
import {LIVE_FEED} from './live.mjs';
import {renderBanner} from './banner.mjs';
const output=new URL('./generated/fase2/',import.meta.url);await mkdir(output,{recursive:true});
const deployed=!!process.env.PILOT_BASE_URL;
const base=process.env.PILOT_BASE_URL||'https://pilot.invalid';
const token=process.env.PILOT_TOKEN||'synthetic-local-test-token';
const report={executed_at:new Date().toISOString(),mode:deployed?'deployed_https':'real_data_worker_in_process',url:deployed?base:null,real_ai:false,access_tests:[],results:[],passed:false};
async function send(path,options={}) {
 const request=new Request(base+path,{...options,signal:AbortSignal.timeout(30000)});
 return deployed?fetch(request):worker.fetch(request,{PILOT_TOKEN:token,LIVE_DATA:'true'});
}
const auth={Authorization:`Bearer ${token}`};
try {
 let healthData;
 const attempts=deployed?15:1;
 for(let attempt=1;attempt<=attempts;attempt++) {
  try {
   const health=await send('/health');const raw=await health.text();
   if(health.status===200) {
    const data=JSON.parse(raw);
    if(data.pilot===true&&(!process.env.EXPECTED_RELEASE||data.release===process.env.EXPECTED_RELEASE)) {healthData=data;break;}
   }
  } catch { /* During edge propagation a previous placeholder can be served. */ }
  console.log(JSON.stringify({check:'wait_for_pilot_release',attempt}));
  if(attempt<attempts) await new Promise(resolve=>setTimeout(resolve,2000));
 }
 assert.ok(healthData,'Expected pilot release not served after bounded propagation wait');
 if(deployed)assert.equal(healthData.seller_transport_implementation,'official_graph_v1','Actual deployed code must include seller transport');
 assert.equal(healthData.cloud_bindings,false,'No D1 in this deployment');report.health=healthData;
 for(const [path,method,headers] of [['/chat','POST',{}],['/chat','POST',{Authorization:'Bearer deliberately-invalid-test-token'}],['/ready','GET',{}],['/banners/MICR27','GET',{}],['/interesados','POST',{}]]) {
  const r=await send(path,{method,headers});assert.equal(r.status,401,`${path} must reject unauthenticated access`);report.access_tests.push({path,method,status:r.status,wrong_token:!!headers.Authorization});
 }
 const feedResponse=await fetch(LIVE_FEED,{signal:AbortSignal.timeout(15000)});assert.equal(feedResponse.status,200);const feed=await feedResponse.json();
 for(const sku of ['MICR27','POWE003','ADAP005']) {
  const r=await send('/chat',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({sku,message:'precio disponibilidad envío y opciones de compra'})});
  const body=await r.text();assert.equal(r.status,200,`${sku}: HTTP ${r.status}; ${body.slice(0,600)}`);const a=JSON.parse(body);
  const expected=feed.productos.find(p=>p.sku===sku);const media=catalog.productos.find(p=>p.sku===sku);
  assert.ok(expected);assert.equal(a.sku,sku);assert.equal(a.disponible,true);assert.equal(a.precio,expected.promo);assert.equal(a.pvp,expected.pvp);assert.equal(a.stock_referencial,expected.stock);assert.equal(a.foto,media.foto);assert.equal(a.banner,media.banner);assert.equal(a.opciones_compra.length,3);assert.ok(a.medios_verificados.length>=1);assert.equal(a.banner_comercial.sku,sku);assert.equal(a.banner_comercial.precio,a.precio);assert.equal(a.banner_comercial.foto,a.foto);
  for(const asset of a.medios_verificados) assert.equal(asset.sha256,media[asset.tipo+'_sha256']);
  if(process.env.REQUIRE_REAL_AI==='true') assert.equal(a.modo,'ia_con_datos_verificados','Actual Workers AI binding must succeed; simulation is insufficient');
  const bannerResponse=await send('/banners/'+sku,{headers:auth});assert.equal(bannerResponse.status,200);const bannerHTML=await bannerResponse.text();assert.ok(bannerHTML.includes(a.foto));assert.ok(bannerHTML.includes(a.precio.toFixed(2)));assert.ok(!bannerHTML.includes(token));
  report.results.push(a);report.real_ai=report.real_ai||a.modo==='ia_con_datos_verificados';
  await writeFile(new URL(sku+'.html',output),renderBanner(a,a.banner_comercial.nombre));
  console.log(JSON.stringify({sku,price:a.precio,stock:a.stock_referencial,assets_verified:a.medios_verificados.length,banner_http:bannerResponse.status,ai:a.modo}));
 }
 report.passed=true;
} catch(e) {report.error=String(e.message).slice(0,1000);throw e;}
finally {await writeFile(new URL('e2e.json',output),JSON.stringify(report,null,2)+'\n');}
