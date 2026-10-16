// Run in GitHub Actions with real public sources; PILOT_BASE_URL selects real deployment.
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
import {renderBanner} from './banner.mjs';
const output=new URL('./generated/fase2/',import.meta.url);await mkdir(output,{recursive:true});
const report={executed_at:new Date().toISOString(),mode:process.env.PILOT_BASE_URL?'deployed_https':'real_data_worker_in_process',real_ai:false,results:[]};
const token=process.env.PILOT_TOKEN||'synthetic-local-test-token';
for(const sku of ['MICR27','POWE003','ADAP005']) {
 const req=new Request((process.env.PILOT_BASE_URL||'https://pilot.invalid')+'/chat',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sku,message:'precio disponibilidad envío y opciones de compra'})});
 const r=process.env.PILOT_BASE_URL?await fetch(req):await worker.fetch(req,{PILOT_TOKEN:token,LIVE_DATA:'true'});
 const a=await r.json();assert.equal(r.status,200,JSON.stringify(a));assert.equal(a.sku,sku);assert.equal(a.disponible,true);assert.ok(a.precio>0);assert.equal(a.opciones_compra.length,3);assert.ok(a.medios_verificados.length>=1);assert.equal(a.banner_comercial.sku,sku);assert.equal(a.banner_comercial.precio,a.precio);assert.equal(a.banner_comercial.foto,a.foto);
 if(process.env.REQUIRE_REAL_AI==='true') assert.equal(a.modo,'ia_con_datos_verificados','Actual Workers AI binding must succeed; simulation is insufficient');
 report.results.push(a);report.real_ai=report.real_ai||a.modo==='ia_con_datos_verificados';
 await writeFile(new URL(sku+'.html',output),renderBanner(a,a.banner_comercial.nombre));
 console.log(JSON.stringify({sku,price:a.precio,stock:a.stock_referencial,assets_verified:a.medios_verificados.length,ai:a.modo}));
}
await writeFile(new URL('e2e.json',output),JSON.stringify(report,null,2)+'\n');
