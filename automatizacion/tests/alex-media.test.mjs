import {test} from 'node:test';import assert from 'node:assert/strict';
import {collectAlexMedia,publicAlexImage} from '../alex-media.mjs';
const NOW=Date.parse('2026-11-03T17:00:00Z'),SOURCE='a'.repeat(64),PHOTO='b'.repeat(64),BANNER='c'.repeat(64);
function product(sku){return {sku,stock:1,disponible:true,price_verified:true,central_availability:'in_stock',
 foto:'https://conectatech-ec.github.io/imagenes/'+sku+'.webp',foto_sha256:PHOTO,
 banner:'https://conectatech-ec.github.io/banners/'+sku+'.png',banner_sha256:BANNER};}
function fixture(){const products=['TELF011','TELF012'].map(product);return {source:{productos:products,source_sha256:SOURCE,inventory_cut_date:'2026-11-03',fuente_fecha:new Date(NOW-3600000).toISOString()},
 library:{schema:'conectatech.approved_library.handoff.v1',live_registry_connection_verified:true,no_send_to_buyers:false,messaging_enabled:true,products:Object.fromEntries(products.map(p=>[p.sku,{visual_approved:true,publication_verified:true,delivery_allowed:true,source_sha256:SOURCE,cut_date:'2026-11-03',banner_sha256:BANNER,banner_url:p.banner}]))},
 result:{action:'recommend',intent:'recommend',focus:['TELF011','TELF012'],images:['TELF011','TELF012']}};}
test('Two exact variants receive their own verified assets and the source/result/memory remain unmodified',async()=>{
 const {source,result}=fixture(),memory={shown:[]},before=JSON.stringify({source,result,memory}),verified=[];
 const r=await collectAlexMedia(result,source,memory,{now:NOW,verify:async p=>verified.push(p)});
 assert.deepEqual(r.images.map(x=>x.sku),['TELF011','TELF012']);assert.ok(r.images.every(x=>x.kind==='approved_photo'));
 assert.equal(verified.length,2);assert.ok(verified.every(x=>x.banner===null));assert.ok(r.images[0].url.includes('TELF011'));
 assert.equal(JSON.stringify({source,result,memory}),before);
 const again=await collectAlexMedia(result,source,r,{now:NOW,verify:async()=>{throw Error('Deduplicated media must not be fetched again');}});assert.deepEqual(again.images,[]);
 const explicit=await collectAlexMedia({...result,intent:'photo',images:['TELF012']},source,r,{now:NOW,verify:async()=>[]});assert.deepEqual(explicit.images.map(x=>x.sku),['TELF012']);
});
test('A SIGNATURE requires every release flag, matching current source/cut and exact asset SHA',async()=>{
 const {source,result,library}=fixture(),before=JSON.stringify(library);
 const good=await collectAlexMedia(result,source,{}, {now:NOW,signatureLibrary:library,verify:async()=>[]});assert.ok(good.images.every(x=>x.kind==='approved_banner'));
 for(const change of [l=>l.no_send_to_buyers=true,l=>l.messaging_enabled=false,l=>l.live_registry_connection_verified=false,
  l=>l.products.TELF011.delivery_allowed=false,l=>l.products.TELF011.source_sha256='d'.repeat(64),l=>l.products.TELF011.cut_date='2026-11-02',l=>l.products.TELF011.banner_sha256='d'.repeat(64),l=>l.products.TELF011.visual_approved=false]){
  const held=structuredClone(library);change(held);
  const r=await collectAlexMedia({...result,images:['TELF011']},source,{}, {now:NOW,signatureLibrary:held,verify:async()=>[]});assert.equal(r.images[0].kind,'approved_photo');
 }
 assert.equal(JSON.stringify(library),before);
 const stale={...source,fuente_fecha:new Date(NOW-48*3600000).toISOString()};
 const old=await collectAlexMedia(result,stale,{}, {now:NOW,signatureLibrary:library,verify:async()=>[]});assert.ok(old.images.every(x=>x.kind==='approved_photo'));
});
test('Changed or unavailable banner falls back only to an independently verified exact photo',async()=>{
 const {source,result,library}=fixture(),seen=[];
 const r=await collectAlexMedia({...result,images:['TELF011']},source,{}, {now:NOW,signatureLibrary:library,verify:async p=>{seen.push(p);if(p.banner)throw Error('changed banner');}});
 assert.equal(seen.length,2);assert.equal(seen[0].foto,null);assert.equal(seen[1].banner,null);assert.equal(r.images[0].kind,'approved_photo');
 const missing=await collectAlexMedia(result,source,{}, {now:NOW,signatureLibrary:library,verify:async()=>{throw Error('No verified asset');}});assert.deepEqual(missing.images,[]);assert.deepEqual(missing.shown,[]);
});
test('Private URLs, mismatched SKU assets and injected chooser results cannot bypass approval',async()=>{
 const {source,result,library}=fixture();
 for(const bad of ['https://drive.google.com/file/d/private/view','https://conectatech-ec.github.io.evil.test/x.png','https://user:password@conectatech-ec.github.io/x.png','https://conectatech-ec.github.io/x.png?secret=private','https://conectatech-ec.github.io/x.png#private'])assert.equal(publicAlexImage(bad),false);
 let called=0;
 const r=await collectAlexMedia({...result,images:['TELF011']},source,{}, {now:NOW,signatureLibrary:library,chooseImage:async()=>source.productos[1].foto,verify:async()=>{called++;}});assert.deepEqual(r.images,[]);assert.equal(called,0);
 const privateSource=structuredClone(source);privateSource.productos[0].foto='https://drive.google.com/file/d/private/view';privateSource.productos[0].banner='https://drive.google.com/file/d/another/view';
 const held=await collectAlexMedia({...result,images:['TELF011']},privateSource,{}, {now:NOW,signatureLibrary:library,verify:async()=>{called++;}});assert.deepEqual(held.images,[]);assert.equal(called,0);
});
test('Blocked identities, duplicate source SKU, foreign focus and automatic sold-out recommendations get no image',async()=>{
 const {source,result}=fixture();
 for(const change of [s=>s.productos[0].central_availability='blocked',s=>s.productos[0].blocked_reasons=['VARIANT_CONFLICT'],s=>s.productos.push(s.productos[0]),s=>{s.productos[0].stock=0;s.productos[0].central_availability='out_of_stock';}]){
  const invalid=structuredClone(source);change(invalid);const r=await collectAlexMedia({...result,images:['TELF011']},invalid,{}, {now:NOW,verify:async()=>[]});assert.deepEqual(r.images,[]);
 }
 const foreign=await collectAlexMedia({...result,focus:['TELF011'],images:['TELF012']},source,{}, {now:NOW,verify:async()=>[]});assert.deepEqual(foreign.images,[]);
 for(const action of ['handoff','erase'])assert.deepEqual((await collectAlexMedia({...result,action},source,{}, {now:NOW,verify:async()=>[]})).images,[]);
});
test('Only displayed media are marked as shown when a family has more than two variants',async()=>{
 const {source,result}=fixture();source.productos.push(product('TELF013'));
 const request={...result,focus:['TELF011','TELF012','TELF013'],images:['TELF011','TELF012','TELF013']};
 const first=await collectAlexMedia(request,source,{}, {now:NOW,verify:async()=>[]});assert.equal(first.images.length,2);assert.ok(!first.shown.includes('TELF013'));
 const next=await collectAlexMedia(request,source,first,{now:NOW,verify:async()=>[]});assert.deepEqual(next.images.map(x=>x.sku),['TELF013']);assert.ok(next.shown.includes('TELF013'));
});
