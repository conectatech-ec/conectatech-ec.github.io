import {test} from 'node:test';
import assert from 'node:assert/strict';
import {central,sourceToAlex} from '../central-source.mjs';
import {readSharedHub} from '../shared-hub.mjs';
import {alexBaseline,quoteCurrent,refreshAlexCatalog} from '../alex-catalog.mjs';
const sha='265843da6b15038d055535ecdd9ed0b421c947caad27e52c584f16e8bbc6fc80';
const time=Date.parse('2026-11-02T23:00:00Z');
function fixture(){return [{fecha_corte:'2026-11-02',origen_sha256:sha,referencia:'datos-593/corte-comercial-publico-validado.json'},
 {fecha_corte:'2026-11-02',sha256_original:sha,fuente:'synthetic transport fixture',cantidad_sku_web:1,productos:{TELF017:{stock:1,promo_centavos:15990,pvp_centavos:19988}}}];}
const getter=(pair,check=()=>{})=>async(url,options)=>{check(url,options);return Response.json(url.endsWith('estado-ultimo-corte.json')?pair[0]:url.endsWith('corte-comercial-publico-validado.json')?pair[1]:{});};
test('A split publication retries once without cache; coherent prices keep original expiry',async()=>{
 const f=structuredClone(central),pair=fixture();let count=0;
 const data=await readSharedHub(f,getter(pair,(_url,opt)=>{if(count<2){count++;if(count===2)pair[0].origen_sha256=sha;}else if(count<4){assert.equal(opt.cache,'no-store');count++;}}),time);
 assert.equal(data.source.sha256,sha);assert.equal(data.expires_at,'2026-11-03T22:48:22.000Z');
 // Explicit mismatch sequence rather than a fixture that becomes coherent before parsing.
 let reads=0;const broken={...pair[0],origen_sha256:'a'.repeat(64)};
 const fetcher=async(url,opt)=>{if(url.endsWith('catalogo-ventas.json'))return Response.json({});reads++;if(reads>2)assert.equal(opt.cache,'no-store');return Response.json(url.endsWith('estado-ultimo-corte.json')?(reads===1?broken:pair[0]):pair[1]);};
 const retry=await readSharedHub(structuredClone(central),fetcher,time);assert.equal(reads,4);assert.equal(retry.shared_hub_status.state,'verified');
});
test('An outage retains the last validated cut, never renews expiry, and does not leak mutations or errors',async()=>{
 const f=structuredClone(central),pair=fixture();const good=await readSharedHub(f,getter(pair),time);
 good.products.find(p=>p.sku==='TELF017').prices.promo_cash_cents=1;
 const expired=Date.parse(good.expires_at)+1;
 const retained=await readSharedHub(f,async()=>{throw Error('secret-like transport detail must not escape');},expired);
 assert.equal(retained.shared_hub_status.state,'last_valid_in_isolate');assert.equal(retained.shared_hub_status.error_code,'SHARED_HUB_READ_FAILED');
 assert.equal(retained.products.find(p=>p.sku==='TELF017').prices.promo_cash_cents,15990);
 assert.equal(retained.source.generated_at,good.source.generated_at);assert.equal(retained.expires_at,good.expires_at);assert.equal(retained.normalized_at,good.normalized_at);
 const source=sourceToAlex(alexBaseline,retained,null,expired);assert.equal(quoteCurrent(source,source.productos.find(p=>p.sku==='TELF017'),expired),false);
 assert.equal(source.source_error_code,'CENTRAL_REPORT_STALE');
 await assert.rejects(readSharedHub(structuredClone(central),async()=>{throw Error('no transport');},time));
});
test('No-cache mismatch cannot replace a good cut; rollback and missing identity are guarded',async()=>{
 const f=structuredClone(central),pair=fixture();await readSharedHub(f,getter(pair),time);
 const split=structuredClone(pair);split[0].origen_sha256='a'.repeat(64);
 const old=await readSharedHub(f,getter(split),time+1000);assert.equal(old.source.sha256,sha);assert.equal(old.shared_hub_status.error_code,'SHARED_HUB_VERSION_MISMATCH');
 const prior=fixture();prior[0].fecha_corte=prior[1].fecha_corte='2026-10-26';prior[0].origen_sha256=prior[1].sha256_original='f37f364dfb30f005bf07f5fb0d7052e8f1dad7e1ae73a9baeacc2ce88aa5eadc';
 const rollback=await readSharedHub(f,getter(prior),time);assert.equal(rollback.source.sha256,sha);assert.equal(rollback.shared_hub_status.error_code,'SHARED_HUB_OLDER_THAN_LAST_VALID');
 const unknown=fixture();unknown[0].origen_sha256=unknown[1].sha256_original='b'.repeat(64);
 const guarded=await readSharedHub(structuredClone(central),getter(unknown),time);
 assert.equal(guarded.products.find(p=>p.sku==='TELF017').prices,null);
});
test('A first failed refresh reports compiled fallback without concealing the old source date',async()=>{
 const source=await refreshAlexCatalog(alexBaseline,async()=>{throw Error('private transport error');},time,{sharedHub:true,input:'Redmi 15C 128 GB'},structuredClone(central));
 assert.deepEqual(source.shared_hub_status,{state:'compiled_fallback',error_code:'SHARED_HUB_READ_FAILED'});
 assert.equal(source.inventory_cut_date,'2026-10-21');assert.equal(source.source_error_code,'CENTRAL_REPORT_STALE');
});
