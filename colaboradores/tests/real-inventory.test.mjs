import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture} from './fixture.mjs';
const validation=JSON.parse(readFileSync(new URL('../data/inventario-validacion.json',import.meta.url)));
test('uploaded 593 pilot inventory drives real prices, signed links and opportunity flow',async()=>{
 const f=fixture({clock:validation.verified_until-86400});
 f.sql.exec(readFileSync(new URL('../data/piloto-inventario.sql',import.meta.url),'utf8'));
 for(const p of validation.products){
  const result=await f.request('/api/material',{method:'POST',data:{sku:p.sku,channel:'Marketplace'}});
  assert.equal(result.status,200);assert.ok(result.data.copy.includes('$'+p.contado.toFixed(2)));
  const url=new URL(result.data.link);const ref=await f.request('/api/reference'+url.search,{as:''});
  assert.equal(ref.data.producto.promo,p.contado);assert.equal(ref.data.producto.pvp,p.pvp);assert.ok(!JSON.stringify(ref.data).includes('stock'));
  const interest=await f.request('/api/interest',{method:'POST',as:'',headers:{'CF-Connecting-IP':'192.0.2.1'},data:{token:url.searchParams.get('t'),consent:true}});assert.equal(interest.status,201);
 }
 const report=await f.request('/api/reports');assert.equal(report.data.resumen[0].consultas,3);assert.equal(report.data.resumen[0].ventas_confirmadas,0);
});
