// Synthetic fixtures: conversation behavior, never inventory evidence.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateAlex,simulatorConversation,simulatorAction,quickReplies} from '../alex.mjs';
import {getProfile,withPersona} from '../alex-collaborators.mjs';
import {normalizeAlexAction} from '../channels.mjs';
const NOW=Date.parse('2026-11-03T18:00:00Z');
function fixture(id='COL001'){
 const productos=[['TELF011',128,4,185.90,232.38],['TELF012',256,8,239.90,299.88]].map(([sku,gb,ram,promo,pvp])=>({
  sku,nombre:`TELEFONO SAMSUNG A17 ${gb}GB ${ram}GB 4G`,source_name:`TELEFONO SAMSUNG A17 ${gb}GB ${ram}GB 4G`,catalog_identity:`TELEFONO SAMSUNG A17 ${gb}GB ${ram}GB 4G`,public_name:`Samsung Galaxy A17 ${gb} GB`,category:'TELEFONOS',categoria:'TELEFONOS',promo,pvp,price_verified:true,stock:1,central_availability:'in_stock',blocked_reasons:[],url:'https://conectatech-ec.github.io/productos/'+sku.toLowerCase()+'/',caracteristicas:{Almacenamiento:gb+' GB','RAM física':ram+' GB','Cámara principal':'50 MP','Batería':'5000 mAh'}}));
 return withPersona({productos,fuente_fecha:'2026-11-03T17:00:00Z',expires_at:'2026-11-04T17:00:00Z',inventory_cut_date:'2026-11-03',source_sha256:'e'.repeat(64)},getProfile(id));
}
const images=['TELF011','TELF012'].map(sku=>({sku,kind:'approved_banner',signature_verified:true,private_scope:true}));
const ids=a=>a.quick_replies.map(q=>q.payload);
async function turn(input,source,memory={},payload=null,media=[]){
 const text=simulatorAction(payload,memory)||normalizeAlexAction(payload)||input;
 const a=await generateAlex(text,source,memory,{CATALOG_FIRST:'true'});
 return {...a,...simulatorConversation(a,source,{input:text,payload,images:media})};
}
test('both personas progress through variants, card, installments, camera and delivery without resetting the product',async t=>{
 t.mock.timers.enable({apis:['Date'],now:NOW});
 for(const id of ['COL001','COL002']){
  const source=fixture(id),a=await turn('Busco un Samsung A17',source,{},null,images);
  assert.equal(a.quick_replies.length,4);assert.ok(ids(a).includes('ALEX:sim:compare'));assert.ok(ids(a).includes('ALEX:card'));
  assert.ok(a.presentation?.only_after_all_images_loaded);assert.ok(!/\$|\bRAM\b|\bGB\b/.test(a.presentation.with_banner));assert.match(a.presentation.fallback,/185\.90/);
  assert.match(a.presentation.with_banner,id==='COL002'?/Te muestro/:/Aquí van/);
  const b=await turn('',source,a.memory,'ALEX:card');
  assert.equal(b.presentation,null);assert.match(b.text,/232\.38/);assert.match(b.text,/299\.88/);
  assert.ok(ids(b).includes('ALEX:sim:installments'));assert.ok(!ids(b).includes('ALEX:card'));assert.ok(!ids(b).some(p=>/search|TELF017/.test(p)));
  const c=await turn('',source,b.memory,'ALEX:sim:installments');
  assert.match(c.text,/banco|confirm/i);assert.ok(!ids(c).includes('ALEX:sim:installments'));assert.ok(!/sin intereses/.test(c.text));
  const d=await turn('¿Qué cámara tienen?',source,c.memory);
  assert.match(d.text,/50 MP/);assert.equal(d.presentation,null);assert.ok(!ids(d).includes('ALEX:sim:camera_compare'));
  assert.ok(ids(d).includes('ALEX:sim:photo_need'));assert.ok(!ids(d).includes('ALEX:sim:installments'));
  const e=await turn('Quiero contraentrega en Quito',source,d.memory);
  assert.equal(e.memory.delivery,'quito');assert.ok(ids(e).includes('ALEX:sim:delivery_terms'));assert.ok(!ids(e).includes('ALEX:sim:camera_compare'));
  assert.deepEqual(e.memory.focus,['TELF011','TELF012']);assert.ok(!/te llega hoy|envío gratis|compra confirmada|reservado/i.test(e.text));
  for(const result of [a,b,c,d,e])for(const q of result.quick_replies){assert.ok(q.title.length<=20);assert.ok(q.payload.startsWith('ALEX:'));}
 }
});
test('explicit questions retain factual text and absent or incomplete banners cannot hide it',async t=>{
 t.mock.timers.enable({apis:['Date'],now:NOW});const source=fixture();
 const a=await turn('Busco un Samsung A17',source);assert.equal(a.presentation,null);
 const b=await turn('Busco un Samsung A17',source,{},null,images.slice(0,1));assert.equal(b.presentation,null);
 for(const query of ['¿Cuánto cuesta el Samsung A17?','Samsung A17: ¿cuánta RAM tiene?','Samsung A17: ¿qué cámara tiene?']){
  const c=await turn(query,source,{},null,images);assert.equal(c.presentation,null);assert.ok(c.text.length>0);
 }
});
test('memory preserves budget, rejects unwanted actions and remembers an explicitly chosen variant',async t=>{
 t.mock.timers.enable({apis:['Date'],now:NOW});const source=fixture();
 let a=await turn('Busco un Samsung A17, mi presupuesto es de 200 dólares',source,{},null,images);
 assert.equal(a.memory.budget,200);assert.match(a.presentation.with_banner,/presupuesto/);assert.ok(!ids(a).includes('ALEX:choose:TELF012'));
 a=await turn('No quiero comparar, no quiero entrega',source,a.memory);
 assert.ok(!ids(a).some(p=>p==='ALEX:sim:compare'||p==='ALEX:sim:delivery_check'));
 a=await turn('',source,a.memory,'ALEX:choose:TELF011');
 a=await turn('Prefiero pagar de contado, no tengo tarjetas',source,a.memory);
 assert.ok(!ids(a).some(p=>/card|installments|terms$/.test(p)));assert.deepEqual(a.memory.focus,['TELF011']);
 a=await turn('¿Qué batería tiene ese?',source,a.memory);assert.deepEqual(a.memory.focus,['TELF011']);assert.equal(a.memory.budget,200);
 a=await turn('No voy a comprar todavía',source,a.memory);assert.ok(!ids(a).some(p=>/:buy/.test(p)));
});
test('out-of-stock or expired variants never become purchase buttons; legacy Messenger suggestions remain unchanged',async t=>{
 t.mock.timers.enable({apis:['Date'],now:NOW});const source=fixture();source.productos[1].stock=0;
 const a=await turn('Busco un Samsung A17',source);assert.ok(!ids(a).includes('ALEX:choose:TELF012'));
 source.expires_at='2026-11-02T17:00:00Z';source.fuente_fecha='2026-11-01T17:00:00Z';
 const stale=await turn('Busco un Samsung A17',source);assert.ok(!ids(stale).some(q=>/^ALEX:(?:choose|buy):/.test(q)));
 const legacy={variant_options:[{sku:'TELF011',storage_gb:128,ram_physical_gb:4},{sku:'TELF012',storage_gb:256,ram_physical_gb:8}]};
 assert.deepEqual(quickReplies(legacy).map(q=>q.payload),['ALEX:choose:TELF011','ALEX:choose:TELF012']);
 assert.equal(simulatorAction('ALEX:sim:arbitrary'),null);assert.match(simulatorAction('ALEX:sim:delivery_terms',{delivery:'nacional'}),/nacional/);
});
test('partial camera facts remain specific to their exact variant without copying a sibling specification',async t=>{
 t.mock.timers.enable({apis:['Date'],now:NOW});const source=fixture();delete source.productos[1].caracteristicas['Cámara principal'];
 const a=await turn('Busco un Samsung A17',source),b=await turn('¿Qué cámara tienen ambos?',source,a.memory);
 assert.match(b.text,/128 GB.*50 MP/);assert.match(b.text,/256 GB.*confirmar/);assert.ok(!ids(b).includes('ALEX:sim:camera_compare'));
 assert.ok(!/256 GB.*50 MP/.test(b.text));
});
