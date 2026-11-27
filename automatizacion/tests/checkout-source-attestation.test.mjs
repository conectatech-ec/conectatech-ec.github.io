import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {publishedSourceEvidence,adaptSharedHub,readSharedHub} from '../shared-hub.mjs';
import {readCheckoutSource} from '../checkout-shared-source.mjs';
const hex=c=>c.repeat(64),hash=s=>createHash('sha256').update(s).digest('hex');
const stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const modules={'report_identity.py':'d023d449cb7cec2bddfbfdbea89ad47881f9a765578e947bbfa191adcb3d955b','inventory_completeness.py':'fbe6f014868364f224fa2c7ac1189762375299feebff6c2c25e48714259bed6e','normalizar_593.py':'8cac386759763e357100bbb683c2e6008528fcad517ee5b1ec4d4aa15d656a86','data_hub_593.py':'4072336099a31a81a64685b1e2c60b7354246721a815a3d73b1688e6bf0bb50d'};
const identity=p=>hash('{"source_name": '+JSON.stringify(p.source_name)+', "variant_gb": ['+p.variant_gb.join(', ')+']}');
const generated='2026-11-25T04:27:09.000Z',now=Date.parse(generated)+60000;
function product(sku,blocked=[]){return {sku,source_name:'Identidad sintética '+sku+' 128GB',variant_gb:[128],name:'Nombre público '+sku,availability:blocked.length?'blocked':'in_stock',blocked_reasons:blocked,prices:blocked.length?null:{currency:'USD',promo_cash_cents:350,pvp_card_cents:402},web:{price_matches:true,url:'https://conectatech-ec.github.io/productos/'+sku.toLowerCase()+'/',image_url:'https://conectatech-ec.github.io/imagenes/'+sku.toLowerCase()+'.webp'}};}
function fixture(){
 const products=[product('ADAP004'),product('ZERO001'),...Array.from({length:36},(_,i)=>product('ISO'+String(i).padStart(3,'0'),['ABSENT_LATEST_REPORT'])),product('ENCH003')];
 const fallback={schema:'conectatech.commercial.v1',source:{sha256:hex('a'),cut_date:'2026-11-23',generated_at:'2026-11-24T04:27:09.000Z'},expires_at:'2026-11-25T04:27:09.000Z',products};
 const cut={fecha_corte:'2026-11-24',sha256_original:hex('b'),fuente:'Reporte-Inventario.xlsx',cantidad_sku_web:products.length,productos:Object.fromEntries(products.map(p=>[p.sku,{stock:p.sku==='ZERO001'?0:11,promo_centavos:350,pvp_centavos:402}])),revision_fuente:{version:1,anterior_sha256:hex('a'),secuencia:5,generado_en:generated,recibido_en:generated,evidencia:'XLSX_CORE_CREATED_EQUALS_MODIFIED'}};
 const pointer={fecha_corte:cut.fecha_corte,origen_sha256:cut.sha256_original,referencia:'datos-593/corte-comercial-publico-validado.json',sku_web:products.length,revision_fuente:structuredClone(cut.revision_fuente)};
 sign(cut,products);return {fallback,cut,pointer};
}
function sign(cut,products){
 const e={schema:'conectatech.checkout-source-attestation.v1',source_sha256:cut.sha256_original,cut_date:cut.fecha_corte,generated_at:new Date(cut.revision_fuente.generado_en).toISOString(),expires_at:new Date(Date.parse(cut.revision_fuente.generado_en)+86400000).toISOString(),revision_sequence:cut.revision_fuente.secuencia,validator_commit:'79f4e4fb77e30fd3a8a7ebac009cd8204a3b4c95',validator_modules_sha256:modules,projection_sha256:hash(JSON.stringify(Object.keys(cut.productos).sort().map(s=>[s,cut.productos[s].stock,cut.productos[s].promo_centavos,cut.productos[s].pvp_centavos]))),identity_signatures:Object.fromEntries(products.map(p=>[p.sku,identity(p)]))};
 e.attestation_sha256=hash(stable(e));cut.evidencia_checkout=e;
}
function fetcher(f){return async url=>{const path=new URL(url).pathname;return Response.json(path.endsWith('/estado-ultimo-corte.json')?f.pointer:path.endsWith('/corte-comercial-publico-validado.json')?f.cut:{fuente_sha256:f.cut.sha256_original,fecha_corte:f.cut.fecha_corte,presentation:{products:{}},productos:f.fallback.products.filter(p=>p.sku!=='ENCH003').map(p=>({sku:p.sku,stock:f.cut.productos[p.sku].stock,promo:f.cut.productos[p.sku].promo_centavos/100,pvp:f.cut.productos[p.sku].pvp_centavos/100}))});};}
const resolve=f=>publishedSourceEvidence(f.pointer,f.cut,f.fallback,now);
test('dos cortes siguientes se reconocen sin añadir SHA al registro histórico',async()=>{
 const f=fixture();const a=await readSharedHub(f.fallback,fetcher(f),now);
 assert.equal(a.source.generated_at,generated);assert.equal(a.source.timestamp_basis,'original_workbook_core');
 f.cut.sha256_original=hex('c');f.cut.revision_fuente={...f.cut.revision_fuente,anterior_sha256:hex('b'),secuencia:6,generado_en:new Date(now+60000).toISOString(),recibido_en:new Date(now+60000).toISOString()};
 f.pointer={...f.pointer,origen_sha256:hex('c'),revision_fuente:structuredClone(f.cut.revision_fuente)};sign(f.cut,f.fallback.products);
 const b=await readSharedHub(f.fallback,fetcher(f),now+120000);assert.equal(b.source.sha256,hex('c'));assert.equal(b.source.revision_sequence,6);
});
test('ADAP004 conserva precio y stock; 36 aislados y STEREN siguen bloqueados',async()=>{
 const f=fixture();const source=await readCheckoutSource({central:f.fallback,readSharedHub:(b,g)=>readSharedHub(b,g,now),fetcher:fetcher(f)});
 assert.equal(source.products.find(p=>p.sku==='ADAP004').stock,11);assert.equal(source.products.find(p=>p.sku==='ADAP004').priceCents,350);
 assert.equal(source.products.find(p=>p.sku==='ZERO001').stock,0);assert.equal(source.products.filter(p=>p.sku.startsWith('ISO')||p.sku==='ENCH003').length,0);
 const hub=await readSharedHub(f.fallback,fetcher(f),now);assert.equal(hub.products.filter(p=>p.sku.startsWith('ISO')&&p.availability==='blocked').length,36);
});
test('cambio de nombre o variante no hereda la identidad anterior ni se autoriza por source_name público',async()=>{
 for(const field of ['source_name','variant_gb']){const f=fixture(),next=structuredClone(f.fallback.products);next[0][field]=field==='source_name'?'Otro equipo':[256];sign(f.cut,next);f.cut.productos.ADAP004.source_name=f.fallback.products[0].source_name;const e=await resolve(f);const out=adaptSharedHub(f.pointer,f.cut,f.fallback,now,e);assert.ok(out.products[0].blocked_reasons.includes('SHARED_IDENTITY_NOT_VERIFIED'));}
});
for(const [label,change,code] of [
 ['SHA de fuente',f=>f.pointer.origen_sha256=hex('c'),'SOURCE'],
 ['secuencia',f=>f.pointer.revision_fuente.secuencia++,'RECEIPT'],
 ['hora de recepción futura',f=>{f.pointer.revision_fuente.recibido_en=f.cut.revision_fuente.recibido_en=new Date(now+180000).toISOString();},'DATE'],
 ['validador desconocido',f=>f.cut.evidencia_checkout.validator_modules_sha256={...modules,'normalizar_593.py':hex('c')},'SCHEMA'],
 ['precio alterado',f=>f.cut.productos.ADAP004.promo_centavos++,'INTEGRITY'],
 ['stock alterado',f=>f.cut.productos.ADAP004.stock++,'INTEGRITY'],
 ['firma alterada',f=>f.cut.evidencia_checkout.identity_signatures.ADAP004=hex('c'),'INTEGRITY'],
 ['SKU sin prueba',f=>delete f.cut.evidencia_checkout.identity_signatures.ADAP004,'COVERAGE'],
 ['SKU adicional',f=>f.cut.evidencia_checkout.identity_signatures.NEW001=hex('c'),'COVERAGE'],
 ['fecha redefinida',f=>f.cut.evidencia_checkout.generated_at='2026-11-24T05:00:00.000Z','DATE']
])test('rechaza '+label,async()=>{const f=fixture();change(f);await assert.rejects(resolve(f),new RegExp('SHARED_HUB_ATTESTATION_'+code));});
test('no usa la fecha de subida ni amplía las 24 horas; límite exacto cerrado',async()=>{
 const f=fixture();await resolve(f);await assert.rejects(publishedSourceEvidence(f.pointer,f.cut,f.fallback,Date.parse(generated)+86400000),/ATTESTATION_DATE/);
 await assert.rejects(publishedSourceEvidence(f.pointer,f.cut,f.fallback,Date.parse(generated)-1),/ATTESTATION_DATE/);
});
test('corte sin evidencia no recibe aprobación automática aunque aporte nombres',async()=>{const f=fixture();delete f.cut.evidencia_checkout;f.cut.productos.ADAP004.source_name=f.fallback.products[0].source_name;await assert.rejects(resolve(f),/ATTESTATION_REQUIRED/);});
test('una retirada comercial se respeta incluso con identidad y stock válidos',async()=>{const f=fixture();const out=await readSharedHub(f.fallback,fetcher(f),now);const p=out.products.find(p=>p.sku==='ENCH003');assert.equal(p.availability,'blocked');assert.ok(p.blocked_reasons.includes('NOT_IN_SHARED_PUBLIC_CATALOG'));});
test('exportación comercial ausente no permite comprar ni renueva la fuente',async()=>{const f=fixture(),fetch=fetcher(f);const out=await readSharedHub(f.fallback,async url=>url.endsWith('/catalogo-ventas.json')?new Response('',{status:503}):fetch(url),now);assert.equal(out.shared_hub_status.state,'commercial_scope_unverified');assert.equal(out.expires_at,f.cut.evidencia_checkout.expires_at);});
test('un precio público inconsistente bloquea el SKU sin recalcularlo',async()=>{const f=fixture(),fetch=fetcher(f);const out=await readSharedHub(f.fallback,async url=>{const r=await fetch(url);if(!url.endsWith('/catalogo-ventas.json'))return r;const d=await r.json();d.productos[0].promo=99;return Response.json(d);},now);const p=out.products[0];assert.equal(p.availability,'blocked');assert.ok(p.blocked_reasons.includes('SHARED_PUBLIC_COMMERCIAL_MISMATCH'));});
test('mutación durante la comprobación criptográfica se rechaza',async()=>{const f=fixture();const p=resolve(f);f.fallback.products[0].source_name='Mutación';await assert.rejects(p,/ATTESTATION_CHANGED/);});
test('un fallo de actualización conserva la fuente anterior sin renovar su vencimiento',async()=>{const f=fixture();const first=await readSharedHub(f.fallback,fetcher(f),now);f.cut.productos.ADAP004.stock++;const next=await readSharedHub(f.fallback,fetcher(f),now+1000);assert.equal(next.shared_hub_status.state,'last_valid_in_isolate');assert.equal(next.expires_at,first.expires_at);});
test('el mismo timestamp no autoriza otro SHA y una secuencia anterior no sustituye al último válido',async()=>{const f=fixture();await readSharedHub(f.fallback,fetcher(f),now);f.cut.sha256_original=hex('c');f.pointer.origen_sha256=hex('c');sign(f.cut,f.fallback.products);const d=await readSharedHub(f.fallback,fetcher(f),now+1000);assert.equal(d.source.sha256,hex('b'));assert.equal(d.shared_hub_status.state,'last_valid_in_isolate');});
test('una revisión con secuencia anterior y hora posterior no sustituye al último corte',async()=>{const f=fixture();await readSharedHub(f.fallback,fetcher(f),now);f.cut.sha256_original=hex('c');f.cut.revision_fuente={...f.cut.revision_fuente,secuencia:4,generado_en:new Date(now+1000).toISOString(),recibido_en:new Date(now+1000).toISOString()};f.pointer={...f.pointer,origen_sha256:hex('c'),revision_fuente:structuredClone(f.cut.revision_fuente)};sign(f.cut,f.fallback.products);const d=await readSharedHub(f.fallback,fetcher(f),now+2000);assert.equal(d.source.sha256,hex('b'));assert.equal(d.shared_hub_status.state,'last_valid_in_isolate');});
test('evidencia generada por el normalizador Python original alimenta el lector real de checkout',async()=>{
 assert.ok(process.env.CHECKOUT_593_CROSS_FIXTURE,'Se requiere fixture sintético del productor original');
 const f=JSON.parse(fs.readFileSync(process.env.CHECKOUT_593_CROSS_FIXTURE,'utf8'));
 const data=await readCheckoutSource({central:f.fallback,readSharedHub:(b,g)=>readSharedHub(b,g,f.now),fetcher:fetcher(f)});
 assert.equal(data.sourceGeneratedAt,f.cut.evidencia_checkout.generated_at);assert.equal(data.products.find(p=>p.sku==='TEST0000').priceCents,1100);assert.equal(data.products.filter(p=>p.sku!=='TEST0000').length,0);
});
