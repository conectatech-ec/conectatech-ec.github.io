// Synthetic regression evidence only: real renderer/media resolver, no HTTP,
// provider calls, inventory claims, Messenger sends, or approval changes.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveAlexMedia} from '../alex-store.mjs';
import {generateAlex} from '../alex.mjs';

const NOW=Date.parse('2026-11-03T18:00:00Z');
const ORIGIN='https://conectatech-ec.github.io';
function fixture(t,{shared=false}={}){
 t.mock.timers.enable({apis:['Date'],now:NOW});
 const products=[['TELF011',128,4],['TELF012',256,8]].map(([sku,storage,ram])=>({
  sku,nombre:`Samsung A17 ${storage} GB ${ram} GB RAM`,public_name:`Samsung A17 ${storage} GB · ${ram} GB RAM`,
  source_name:`TELEFONO SAMSUNG A17 ${storage}GB ${ram}GB+${ram}GB 4G`,
  promo:storage===128?185.90:239.90,pvp:storage===128?232.38:299.88,
  foto:`${ORIGIN}/imagenes/${shared?'a17-shared':sku}.webp`,foto_sha256:'b'.repeat(64),
  banner:`${ORIGIN}/banners/${sku}.png`,banner_sha256:'c'.repeat(64),stock:1,stock_is_availability_marker:true,
  disponible:true,price_verified:true,central_availability:'in_stock',blocked_reasons:[]
 }));
 const source={fuente_fecha:new Date(NOW-3600000).toISOString(),source_sha256:'a'.repeat(64),inventory_cut_date:'2026-11-03',productos:products};
 const options=products.map((p,i)=>({sku:p.sku,label:i?'256 GB · RAM física 8 GB':'128 GB · RAM física 4 GB'}));
 const reply=({explicit=false}={})=>({action:'compare',intent:'compare',media_requested:explicit,focus:products.map(p=>p.sku),
  images:products.map(p=>p.sku),variant_options:options,memory:{focus:products.map(p=>p.sku)}});
 return {products,source,reply};
}

test('Explicit image plus comparison delivers the exact photos again after automatic delivery',async t=>{
 const f=fixture(t),verified=[];
 const first=f.reply(),automatic=await resolveAlexMedia(first,f.source,{}, {deliveryScope:'private_simulator',verify:async p=>verified.push(p)});
 assert.equal(automatic.images.length,2);assert.equal(verified.length,2);
 const explicit=f.reply({explicit:true}),again=await resolveAlexMedia(explicit,f.source,first.memory,{deliveryScope:'private_simulator',verify:async p=>verified.push(p)});
 assert.equal(explicit.intent,'compare','A photo request need not discard comparison intent');
 assert.equal(again.images.length,2,'An explicit request is not blocked as an unsolicited duplicate');
 assert.equal(verified.length,4);assert.equal(again.image,again.images[0].url);
 assert.deepEqual(again.images.map(i=>i.url),f.products.map(p=>p.foto));
 assert.ok(verified.every(p=>p.banner===null),'Held banners do not reach byte verification');
 const routine=f.reply(),dedup=await resolveAlexMedia(routine,f.source,explicit.memory,{deliveryScope:'private_simulator',verify:async()=>assert.fail('Unrequested repeat')});
 assert.equal(dedup.images.length,0);assert.equal(dedup.image,null);
});

test('A shared approved A17 photo is delivered once and attributed openly to both exact configurations',async t=>{
 const f=fixture(t,{shared:true}),result=f.reply({explicit:true});let verifies=0;
 const media=await resolveAlexMedia(result,f.source,{shown:['TELF011','TELF012']},{deliveryScope:'private_simulator',verify:async()=>verifies++});
 assert.equal(media.images.length,1);assert.equal(verifies,1);
 assert.equal(media.images[0].url,f.products[0].foto);assert.deepEqual(media.images[0].skus,['TELF011','TELF012']);
 assert.match(media.images[0].label,/128 GB.*4 GB.*256 GB.*8 GB/);assert.ok(!/TELF|SKU|exclusiv/i.test(media.images[0].label));
 assert.deepEqual(result.memory.shown,['TELF011','TELF012']);
 assert.equal(result.memory.shown_media.length,1);
});

test('A private-only banner registry cannot be reused by Messenger even when supplied accidentally',async t=>{
 const f=fixture(t),library={schema:'conectatech.approved_library.handoff.v1',delivery_scope:'private_simulator',
  live_registry_connection_verified:true,no_send_to_buyers:false,messaging_enabled:true,
  products:Object.fromEntries(f.products.map(p=>[p.sku,{visual_approved:true,publication_verified:true,delivery_allowed:true,
   source_sha256:f.source.source_sha256,cut_date:f.source.inventory_cut_date,banner_sha256:p.banner_sha256,banner_url:p.banner}]))};
 const privateResult=f.reply(),preview=await resolveAlexMedia(privateResult,f.source,{}, {deliveryScope:'private_simulator',library,verify:async()=>{}});
 assert.ok(preview.images.every(i=>i.kind==='approved_banner'));
 const messengerResult=f.reply(),messages=await resolveAlexMedia(messengerResult,f.source,{}, {deliveryScope:'messenger',library,verify:async()=>{}});
 assert.ok(messages.images.every(i=>i.kind==='approved_photo'));
 await assert.rejects(()=>resolveAlexMedia(f.reply(),f.source,{}, {deliveryScope:'customer_supplied'}),/INVALID_MEDIA_SCOPE/);
});

test('The requested three-turn conversation really re-delivers images after the initial automatic photo',async t=>{
 const f=fixture(t);let memory={},verified=0;const outputs=[];
 for(const input of ['Busco un Samsung A17','¿Cuánto cuesta con tarjeta?','Muéstrame una imagen y compárame las versiones']){
  const result=await generateAlex(input,f.source,memory,{CATALOG_FIRST:'true'});
  const media=await resolveAlexMedia(result,f.source,memory,{deliveryScope:'private_simulator',verify:async p=>{assert.equal(p.banner,null);verified++;}});
  memory=result.memory;outputs.push({result,media});
 }
 assert.equal(outputs[0].media.images.length,2);
 assert.equal(outputs[1].media.images.length,0,'A factual follow-up does not repeat unsolicited images');
 assert.equal(outputs[2].result.media_requested,true,'The engine preserves an explicit image request combined with a comparison');
 assert.equal(outputs[2].media.images.length,2,'Actual verified image URLs accompany the comparison, not just an offer to send them');
 assert.equal(outputs[2].media.image,f.products[0].foto);
 assert.deepEqual(outputs[2].result.variant_options.map(o=>o.sku).sort(),['TELF011','TELF012']);
 assert.equal(verified,4);
});
