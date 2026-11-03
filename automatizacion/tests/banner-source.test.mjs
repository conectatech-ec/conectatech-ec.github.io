import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {renderBanner,renderValidatedBanner} from '../banner.mjs';
import {bindPresentation,sourceToAlex} from '../central-source.mjs';

const NOW=Date.parse('2026-11-03T17:00:00Z');
function fixture(){
 const p={sku:'PUBLIC001',nombre:'PRIVATE_ERP_NAME',public_name:'Producto público aprobado',stock:1,stock_is_availability_marker:true,
  promo:159.90,pvp:199.88,price_verified:true,presentation_photo:true,presentation_media_state:'current',
  foto:'https://conectatech-ec.github.io/imagenes/public001/foto.webp',foto_sha256:'b'.repeat(64),
  url:'https://conectatech-ec.github.io/productos/public001/'};
 const source={source_kind:'shared_validated_central_593',prices_cross_checked:true,source_error_code:null,
  fuente_fecha:'2026-11-02T22:48:22Z',expires_at:'2026-11-03T22:48:22Z',inventory_cut_date:'2026-11-02',source_sha256:'a'.repeat(64),
  feed_published_at:'2026-11-03T16:59:00Z',presentation_state:'verified',presentation_error_code:null,
  presentation_version:'alex-presentation-v1-'+'c'.repeat(64),productos:[p]};
 const response={sku:p.sku,disponible:true,precio:p.promo,pvp:p.pvp,foto:p.foto,url:p.url,
  fuente_fecha:source.fuente_fecha,stock_referencial:1,
  banner_comercial:{foto:p.foto,precio:p.promo,pvp:p.pvp,url_compra:p.url}};
 return {source,response,p,render(now=NOW){return renderValidatedBanner(response,p.public_name,source,now);}};
}
test('confirmed original cut is shown with exact cash/PVP and current public title/photo',()=>{
 const f=fixture(),html=f.render();
 assert.match(html,/Corte 593 confirmado: 2026-11-02/);assert.match(html,/PROMO CONTADO \$159\.90/);assert.match(html,/PVP \$199\.88/);
 assert.ok(html.includes(f.p.foto));assert.ok(html.includes(f.p.public_name));
 assert.ok(!html.includes('PRIVATE_ERP_NAME'));assert.ok(!html.includes('2026-11-03T16:59'));
 assert.ok(!html.includes('Disponibilidad referencial: 1'));assert.ok(html.includes('Disponible, sujeto a confirmación'));
});
test('recent publication cannot renew an expired original report; legacy canary reproduces the bad date',()=>{
 const f=fixture();f.response.fuente_fecha=f.source.feed_published_at;
 assert.ok(renderBanner(f.response,f.p.public_name).includes(f.source.feed_published_at));
 assert.throws(()=>f.render(Date.parse(f.source.expires_at)+1),/BANNER_SOURCE_UNAVAILABLE/);
 assert.match(f.render(),/Corte 593 confirmado: 2026-11-02/);
});
test('render and publication retries do not relabel the cut or alter prices',()=>{
 const f=fixture(),before=structuredClone({source:f.source,response:f.response}),html=f.render();
 f.source.feed_published_at='2026-11-03T17:30:00Z';
 assert.equal(f.render(NOW+3_600_000),html);
 assert.equal(f.source.fuente_fecha,before.source.fuente_fecha);assert.equal(f.source.expires_at,before.source.expires_at);
 assert.equal(f.response.precio,before.response.precio);assert.equal(f.response.pvp,before.response.pvp);
});
test('new validated cut changes both prices and confirmed date without retaining old values',()=>{
 const f=fixture();Object.assign(f.source,{fuente_fecha:'2026-11-03T16:00:00Z',expires_at:'2026-11-04T16:00:00Z',inventory_cut_date:'2026-11-03',source_sha256:'d'.repeat(64),presentation_version:'alex-presentation-v1-'+'e'.repeat(64)});
 Object.assign(f.p,{promo:161.25,pvp:201.56});Object.assign(f.response,{precio:f.p.promo,pvp:f.p.pvp});Object.assign(f.response.banner_comercial,{precio:f.p.promo,pvp:f.p.pvp});
 const html=f.render();assert.match(html,/Corte 593 confirmado: 2026-11-03/);assert.match(html,/\$161\.25/);assert.match(html,/PVP \$201\.56/);assert.ok(!html.includes('$159.90'));
});
test('unknown date, mismatched Quito date, renewed expiry and future originals fail closed',()=>{
 for(const change of [s=>delete s.inventory_cut_date,s=>s.inventory_cut_date='2026-11-03',s=>s.expires_at='2026-11-04T22:48:22Z',s=>s.fuente_fecha='2099-11-02T22:48:22Z',s=>delete s.source_sha256]){
  const f=fixture();change(f.source);assert.throws(()=>f.render(),/BANNER_SOURCE_UNAVAILABLE/);
 }
});
test('private canonical SKU with legacy approved photo but no bound current public presentation never renders',()=>{
 for(const change of [f=>delete f.p.presentation_photo,f=>f.p.presentation_photo=false,f=>f.p.presentation_media_state='retained_last_valid',f=>f.source.presentation_state='last_valid',f=>delete f.source.presentation_version,f=>f.source.presentation_error_code='PUBLIC_PRESENTATION_UNAVAILABLE']){
  const f=fixture();f.p.sku='PRIVATE001';f.response.sku=f.p.sku;f.p.nombre='SYNTHETIC_PRIVATE_NAME';change(f);
  assert.throws(()=>f.render(),/BANNER_SOURCE_UNAVAILABLE/);
 }
});
test('the four protected identity cases, unavailable and duplicate identities never produce a banner',()=>{
 for(const sku of ['CABL166','HUB017','FLAS024','MOUS010']){
  const f=fixture();f.p.sku=sku;f.response.sku=sku;f.p.price_verified=false;assert.throws(()=>f.render(),/BANNER_SOURCE_UNAVAILABLE/);
 }
 for(const change of [f=>f.p.stock=0,f=>f.response.disponible=false,f=>f.source.productos.push(structuredClone(f.p)),f=>f.response.sku='UNKNOWN']){
  const f=fixture();change(f);assert.throws(()=>f.render(),/BANNER_SOURCE_UNAVAILABLE/);
 }
});
test('a cent mismatch, private/raw title, missing media or external photo cannot pass by renderer formatting',()=>{
 for(const change of [f=>f.response.precio+=0.01,f=>f.response.banner_comercial.pvp+=0.01,f=>f.p.foto_sha256=null,f=>{f.p.foto=f.response.foto=f.response.banner_comercial.foto='https://example.invalid/photo.webp';}]){
  const f=fixture();change(f);assert.throws(()=>f.render(),/BANNER_SOURCE_UNAVAILABLE/);
 }
 const f=fixture();assert.throws(()=>renderValidatedBanner(f.response,f.p.nombre,f.source,NOW),/BANNER_SOURCE_UNAVAILABLE/);
});
test('real cryptographic public binding authorizes only its public SKU, never another canonical SKU with legacy approved media',async()=>{
 const ids=['PUBLIC001','PRIVATE001'],photo=sku=>'https://conectatech-ec.github.io/imagenes/'+sku.toLowerCase()+'/photo.webp';
 const data={schema:'conectatech.commercial.v1',source:{sha256:'f'.repeat(64),cut_date:'2026-11-02',generated_at:'2026-11-02T22:48:22Z'},normalized_at:'2026-11-02T22:48:22Z',expires_at:'2026-11-03T22:48:22Z',products:ids.map(sku=>({sku,name:'SYNTHETIC RAW '+sku,source_name:'SYNTHETIC IDENTITY '+sku,variant_gb:[],availability:'in_stock',blocked_reasons:[],prices:{currency:'USD',promo_cash_cents:1234,pvp_card_cents:1567},web:{url:'https://conectatech-ec.github.io/productos/'+sku.toLowerCase()+'/'}}))};
 const seed={productos:ids.map(sku=>({sku,nombre:'Legacy '+sku,public_name:'Legacy '+sku,foto:photo(sku),foto_sha256:'b'.repeat(64),descripcion:'',caracteristicas:{},stock:1}))};
 const document={schema:'conectatech.alex.presentation.v1',source_sha256:data.source.sha256,cut_date:data.source.cut_date,published_at:'2026-11-03T16:00:00Z',inputs:{multichannel_sha256:'a'.repeat(64),meta_sha256:'b'.repeat(64)},products:{PUBLIC001:{display_title:'Título público exacto',approved_media:{url:photo('PUBLIC001'),sha256:'b'.repeat(64)}}}};
 const stable=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 document.version='alex-presentation-v1-'+createHash('sha256').update(stable(document)).digest('hex');
 const bound=await bindPresentation(data,document,NOW),source=sourceToAlex(seed,bound,null,NOW);
 const response=p=>({sku:p.sku,disponible:true,precio:p.promo,pvp:p.pvp,foto:p.foto,url:p.url,stock_referencial:p.stock,banner_comercial:{foto:p.foto,precio:p.promo,pvp:p.pvp,url_compra:p.url}});
 const publicProduct=source.productos.find(p=>p.sku==='PUBLIC001'),privateProduct=source.productos.find(p=>p.sku==='PRIVATE001');
 assert.equal(source.presentation_state,'verified');assert.equal(publicProduct.presentation_photo,true);
 assert.match(renderValidatedBanner(response(publicProduct),publicProduct.public_name,source,NOW),/Título público exacto/);
 assert.equal(privateProduct.price_verified,true);assert.equal(privateProduct.foto,photo('PRIVATE001'));assert.equal(privateProduct.foto_sha256,'b'.repeat(64));
 assert.throws(()=>renderValidatedBanner(response(privateProduct),privateProduct.public_name,source,NOW),/BANNER_SOURCE_UNAVAILABLE/);
});
