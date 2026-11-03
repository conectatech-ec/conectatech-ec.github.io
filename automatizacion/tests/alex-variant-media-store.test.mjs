// Synthetic integration only: encrypted Alex input -> engine -> Messenger media.
// These amounts/assets are fixtures, never evidence of real inventory or delivery.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {MessengerTestInbox} from '../messenger-store.mjs';
import {prepareAlex,saveInput,saveMemory} from '../alex-store.mjs';

const NOW=Date.parse('2026-11-03T18:00:00Z');
const ORIGIN='https://conectatech-ec.github.io';
function product(sku,storage,ram,promo,pvp){
 const identity=`TELEFONO SAMSUNG A17 ${storage}GB ${ram}GB+${ram}GB 4G`;
 return {sku,nombre:identity,source_name:identity,catalog_identity:identity,
  public_name:`Samsung Galaxy A17 ${storage} GB · ${ram} GB RAM · 4G`,categoria:'TELEFONOS',
  promo,pvp,price_verified:true,stock:1,stock_is_availability_marker:true,
  disponible:true,central_availability:'in_stock',blocked_reasons:[],
  foto:`${ORIGIN}/imagenes/${sku}.webp`,foto_sha256:'b'.repeat(64),
  banner:`${ORIGIN}/banners/${sku}.png`,banner_sha256:'c'.repeat(64),
  url:`${ORIGIN}/productos/${sku.toLowerCase()}/`,
  caracteristicas:{Almacenamiento:`${storage} GB`,'RAM física':`${ram} GB`,'RAM virtual':`${ram} GB`,'Red móvil':'4G'}};
}
function fixture(t){
 t.mock.timers.enable({apis:['Date'],now:NOW});
 const source={fuente_fecha:new Date(NOW-3600000).toISOString(),source_sha256:'a'.repeat(64),inventory_cut_date:'2026-11-03',
  productos:[product('TELF011',128,4,185.90,232.38),product('TELF012',256,8,239.90,299.88)]};
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 const sql={exec(query,...params){const statement=db.prepare(query),rows=/^SELECT/i.test(query)?statement.all(...params):(statement.run(...params),[]);
  return {toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 const env={PILOT_TOKEN:'synthetic-encryption-key-only-not-real',CATALOG_FIRST:'true',META_MODE:'development-only'};
 const box=new MessengerTestInbox({id:{name:'messenger-development'},storage:{sql,setAlarm:async()=>{}}},env);
 let serial=0;
 const turn=async(text,verifyAssets=async()=>[])=>{
  const row={k:'synthetic-job-'+(++serial),who:'synthetic-tester'};
  await saveInput(box,row.k,text);
  return prepareAlex(box,row,{refreshCatalog:async()=>source,verifyAssets});
 };
 const commit=prepared=>saveMemory(box,'synthetic-tester',prepared.result.memory);
 const cards=prepared=>prepared.messages.slice(1).map(message=>message.attachment.payload.elements[0]);
 return {source,turn,commit,cards};
}

test('A named A17 variant keeps its selection while both exact, independently verified photos reach Messenger',async t=>{
 const f=fixture(t),checked=[];
 const prepared=await f.turn('Quiero Samsung A17 256 GB',async p=>{checked.push(p);});
 assert.deepEqual(prepared.result.focus,['TELF012']);
 assert.equal(prepared.result.variant_options.length,2);
 assert.equal(prepared.messages.length,3);
 assert.equal(checked.length,2);
 assert.ok(checked.every(p=>p.banner===null),'An unreleased SIGNATURE must never enter byte verification');
 const cards=f.cards(prepared);
 assert.deepEqual(cards.map(c=>c.image_url),[f.source.productos[1].foto,f.source.productos[0].foto]);
 for(const card of cards){
  assert.match(card.title,/Samsung Galaxy A17/);
  assert.doesNotMatch(card.title,/TELF\d+|SKU/,'Consumer-facing captions exclude internal identifiers');
  const product=f.source.productos.find(p=>p.foto===card.image_url);
  assert.equal(card.buttons[0].url,product.url,'Each picture links to its own exact product variant');
 }
 assert.deepEqual(new Set(prepared.result.memory.shown),new Set(['TELF011','TELF012']));
 assert.equal(prepared.result.memory.shown_media.length,2);
});

test('A follow-up family question preserves the conversation and does not verify or send already shown photos',async t=>{
 const f=fixture(t),first=await f.turn('Busco Samsung A17');
 await f.commit(first);
 const next=await f.turn('¿Qué variantes tienen del Samsung A17?',async()=>{assert.fail('Already shown media should not be verified again');});
 assert.equal(next.messages.length,1);
 assert.equal(next.result.variant_options.length,2);
 assert.equal(next.result.memory.history.length,4);
 assert.deepEqual(new Set(next.result.memory.shown),new Set(['TELF011','TELF012']));
 assert.notEqual(next.result.action,'handoff');
});

test('A failed photo never becomes shown and can recover on the next turn without resending its successful sibling',async t=>{
 const f=fixture(t),first=await f.turn('Busco Samsung A17',async p=>{if(p.sku==='TELF011')throw Error('SYNTHETIC_ASSET_UNAVAILABLE');});
 assert.deepEqual(f.cards(first).map(c=>c.image_url),[f.source.productos[1].foto]);
 assert.deepEqual(first.result.memory.shown,['TELF012']);
 assert.ok(first.result.text.includes('$185.90')&&first.result.text.includes('$239.90'),'A media failure must preserve verified commercial information');
 await f.commit(first);
 const recovered=await f.turn('¿Qué opciones del Samsung A17 hay?',async p=>{assert.equal(p.sku,'TELF011');});
 assert.deepEqual(f.cards(recovered).map(c=>c.image_url),[f.source.productos[0].foto]);
 assert.deepEqual(new Set(recovered.result.memory.shown),new Set(['TELF011','TELF012']));
});
