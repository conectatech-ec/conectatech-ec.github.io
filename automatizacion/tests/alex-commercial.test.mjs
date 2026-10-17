import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateAlex,renderPlan,factBook,candidates,quickReplies,policy} from '../alex.mjs';
import {normalizeAlexAction,normalizeEvents} from '../channels.mjs';
import {alexPage} from '../alex-ui.mjs';
import baseline from '../generated/catalogo.json' with {type:'json'};
const source={...baseline,fuente_fecha:new Date().toISOString()};
const plan=extra=>({say:'',facts:['POWE003.cash'],ask:'',focus:['POWE003'],image:'POWE003',intent:'price',action:'answer',remember:{},...extra});
test('Customer copy separates facts with lines and functional emoji, never quantities or internal stock language',()=>{
 for(const p of source.productos){const a=renderPlan(plan({facts:[p.sku+'.cash',p.sku+'.stock'],focus:[p.sku],image:p.sku}),source);assert.ok(a.text.startsWith('💵'));assert.match(a.text,/\nConfirmamos disponibilidad/);assert.ok(!/stock|SKU|referencial|\b\d+\s+unidades?\b/i.test(a.text));assert.ok(a.text.includes('$'+p.promo.toFixed(2)));assert.ok(a.text.length<=440);}
 const f=factBook(source);assert.match(f.pickup,/^📍/);assert.match(f.delivery,/^🛵/);assert.match(f.warranty,/^🛡️/);
 const a=renderPlan(plan({say:'Cuesta $1 y quedan 50 unidades',facts:['POWE003.card']}),source);assert.ok(a.text.startsWith('💳'));assert.ok(!a.text.includes('$1'));assert.ok(!a.text.includes('50 unidades'));
 assert.ok(renderPlan(plan({facts:['POWE003.stock','POWE003.cash']}),source).text.startsWith('💵'));
 const duplicate=renderPlan(plan({facts:['POWE003.name','POWE003.cash']}),source);assert.ok(duplicate.text.startsWith('💵'));assert.equal((duplicate.text.match(/Philco/g)||[]).length,1);
 const stale={...source,fuente_fecha:'2020-01-01'};assert.equal(factBook(stale)['POWE003.cash'],undefined);assert.equal(quickReplies(renderPlan(plan({facts:['stale']}),stale)).some(b=>b.payload.includes(':buy:')),false);
});
test('Twenty-four generative-contract turns keep preferences beyond trimmed history and suppress late greetings',async()=>{
 let memory={},calls=0;
 const env={FREE_TIER_VERIFIED:'true',AI:{}};
 // The model is deliberately controlled here: this checks rendering/state contracts, not real inference.
 for(let i=1;i<=24;i++){
  const sku=i<=8?'POWE003':i<=16?'MICR27':'ADAP005',input=i===1?'Mi presupuesto cuarenta, pago al contado. Quiero entrega en Quito.':i===18?'Mi presupuesto ahora 35.':'¿Y ese cuánto cuesta?';
  // Include real customer text separately so preference extraction cannot depend on the fake model.
  env.AI.run=async(_m,a)=>{calls++;assert.ok(a.response_format.json_schema.properties.facts.items.enum.includes(sku+'.cash'));return{response:JSON.stringify(plan({say:i===1||i===22?'¡Epa! Bienvenido a CONECTATECH.':'',facts:[sku+'.cash'],focus:[sku],image:sku,remember:i===1?{budget:40,payment:'contado',delivery:'quito'}:{}}))};};
  const message=i===9?'Ahora quiero el JBL Quantum Stream':i===17?'Ahora quiero el adaptador Europa a Latino':input;
  const a=await generateAlex(message,source,memory,env);assert.equal(a.generative,true,a.error_code);memory=a.memory;assert.equal(memory.turn_count,i);assert.equal(memory.payment,'contado');assert.equal(memory.delivery,'quito');assert.equal(memory.budget,i>=18?35:40);assert.ok(memory.history.length<=policy.max_history_turns*2);if(i>1)assert.ok(!/epa|bienvenido|hola/i.test(a.text));
  const b=quickReplies(a);assert.ok(b.length>=2&&b.length<=3);for(const q of b){assert.ok(q.title.length<=20);assert.ok(normalizeAlexAction(q.payload));}
 }
 assert.equal(calls,24);assert.equal(memory.greeted,true);assert.deepEqual(memory.recent_products,['POWE003','MICR27','ADAP005']);
 assert.deepEqual(candidates('Compara el JBL y la batería',memory),['MICR27','POWE003']);assert.deepEqual(candidates('¿Y el otro?',memory),['MICR27','ADAP005']);
});
test('Native buttons follow product, compare choices and already expressed checkout preferences',()=>{
 const photo=quickReplies(plan({intent:'photo'}));assert.ok(photo.some(b=>b.payload==='ALEX:card:POWE003'));assert.ok(photo.some(b=>b.payload==='ALEX:specs:POWE003'));
 const compare=quickReplies(plan({focus:['MICR27','POWE003'],action:'compare',intent:'compare'}));assert.deepEqual(compare.slice(0,2).map(b=>b.payload),['ALEX:choose:MICR27','ALEX:choose:POWE003']);
 const buy=quickReplies(plan({intent:'delivery',memory:{payment:'contado',delivery:'quito'}}));assert.ok(buy.some(b=>b.payload==='ALEX:buy:POWE003'));
 const interest=quickReplies(plan({action:'interest',memory:{payment:'contado',delivery:'quito'}}));assert.ok(!interest.some(b=>/retiro|quito|card|cash/.test(b.payload)));assert.ok(interest.some(b=>b.payload==='ALEX:human:POWE003'));
 assert.deepEqual(quickReplies(plan({facts:['warranty'],memory:{payment:'contado',delivery:'quito'}})).map(b=>b.payload),['ALEX:human:POWE003']);
 for(const b of [...photo,...compare,...buy,...interest]){const payload={object:'page',entry:[{id:'1',messaging:[{sender:{id:'2'},timestamp:Date.now(),message:{mid:'test-'+b.payload,text:b.title,quick_reply:{payload:b.payload}}}]}]};assert.equal(normalizeEvents(payload,{META_PAGE_ID:'1'})[0].text,normalizeAlexAction(b.payload));}
 assert.equal(normalizeAlexAction('ALEX:buy:OTHER'),null);assert.equal(normalizeAlexAction('ALEX:arbitrary:POWE003'),null);
});
test('Unnecessary closing questions and manufactured commercial promises are removed without removing valid facts',()=>{
 for(const ask of ['¿Hay algo más que necesites?','¿Qué tipo de descuento te gustaría?','¿Quieres que te regale otro?']){const a=renderPlan(plan({ask}),source);assert.ok(!a.text.includes('?'));assert.match(a.text,/\$33\.01/);}
 const a=renderPlan(plan({facts:['POWE003.cash','POWE003.battery'],intent:'recommend'}),source);assert.ok(a.text.startsWith('💵'));assert.match(a.text,/\nLa Philco/);
 assert.ok(!renderPlan(plan({say:'Son iguales y equivalentes.'}),source).text.includes('equivalentes'));
});
test('Private demonstration uses the same validated button payloads and removes obsolete choices',async()=>{
 const html=await alexPage().text();new Function(html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1]);assert.ok(html.includes('quick_reply_payload:payload'));assert.ok(html.includes("send(q.title,q.payload)"));assert.ok(html.includes("querySelectorAll('[data-choice]')"));
});
test('An explicit purchase advances to an unconfirmed request without asking known preferences; warranty never invents terms',async()=>{
 const env={FREE_TIER_VERIFIED:'true',AI:{run:async()=>({response:JSON.stringify(plan({facts:['POWE003.cash'],action:'answer',ask:'¿Prefieres retiro o entrega?'}))})}};
 const m={focus:['POWE003'],payment:'contado',delivery:'quito',sector:'La Carolina',budget:35};
 const a=await generateAlex('Quiero comprar la batería Philco',source,m,env);assert.equal(a.action,'interest');assert.match(a.text,/todavía debe confirmarla/);assert.ok(!a.text.includes('?'));assert.equal(a.memory.stage,'compra_pendiente');
 const negative=await generateAlex('No quiero comprar todavía',source,m,env);assert.notEqual(negative.action,'interest');
 const warranty=await generateAlex('¿Qué garantía tiene?',source,m,env);assert.ok(warranty.text.startsWith('🛡️'));assert.match(warranty.text,/vendedor/);assert.ok(!/\d/.test(warranty.text));
});
