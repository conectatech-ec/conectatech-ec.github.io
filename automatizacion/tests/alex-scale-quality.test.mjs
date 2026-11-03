import {test} from 'node:test';import assert from 'node:assert/strict';
import {central,sourceToAlex} from '../central-source.mjs';import {alexBaseline} from '../alex-catalog.mjs';
import {generateAlex,quickReplies} from '../alex.mjs';
test('A complete November conversation keeps model, payment objection, photo and deferred purchase useful without AI',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-03T06:00:00Z')});
 const source=sourceToAlex(alexBaseline,central,p=>p.filter(x=>['TELF017','TELF018'].includes(x.sku)));
 let memory={history:[],focus:[],shown:[]};
 const inputs=['Busco un Redmi 15C de 128 GB','¿Y de contado?','¿Y con tarjeta?','Pero no tengo tarjeta Pacífico','Tengo Pichincha','¿Y a seis meses?','Quiero contraentrega en Quito','¿Y envíos nacionales?','Muéstrame la fotografía','No compraré todavía','Quiero continuar después','Sigamos con ese celular'];
 for(const input of inputs){
  const r=await generateAlex(input,source,memory,{CATALOG_FIRST:'true'});memory=r.memory;
  assert.deepEqual(r.focus,['TELF017']);assert.notEqual(r.action,'handoff');assert.ok(!r.text.includes('$'),'Expired fixture cannot quote');assert.ok(!/En octubre|sin intereses/.test(r.text));
  if(input==='Tengo Pichincha'||input==='¿Y a seis meses?'){assert.equal(r.intent,'payment');assert.match(r.text,/condiciones.*requieren confirmación/);assert.equal(memory.bank,'pichincha');assert.ok(memory.rejected_banks.includes('pacifico'));}
  if(input==='Muéstrame la fotografía'){assert.equal(r.intent,'photo');assert.equal(r.image,'TELF017');assert.ok(!r.facts.includes('TELF017.memory'));}
  if(input==='No compraré todavía'){assert.equal(memory.purchase_deferred,true);assert.ok(!/pagar|entrega|retir|\?/.test(r.text));assert.ok(!quickReplies(r).some(q=>/:buy/.test(q.payload)));}
  if(input==='Sigamos con ese celular')assert.equal(memory.purchase_deferred,false);
 }
});
test('Comparisons provide two verified characteristics instead of merely enumerating phones in fallback and model paths',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-03T06:00:00Z')});
 const source=sourceToAlex(alexBaseline,central,p=>p.filter(x=>x.sku==='TELF017'));
 const input='Compara la batería del Samsung A17 128 GB con el Redmi 15C 128 GB';
 const model={FREE_TIER_VERIFIED:'true',AI:{run:async()=>({response:{say:'Claro, revisemos.',facts:['TELF011.name','TELF017.name'],ask:'¿Cuál prefieres?',focus:['TELF011','TELF017'],intent:'recommend',action:'answer',image:null,remember:{}}})}};
 for(const env of [{},model]){
  const r=await generateAlex(input,source,{},env);assert.equal(r.action,'compare');assert.equal(r.intent,'compare');assert.deepEqual(new Set(r.facts),new Set(['TELF011.battery','TELF017.battery']));
  assert.match(r.text,/5000 mAh/);assert.match(r.text,/6000 mAh/);assert.equal((r.text.match(/\?/g)||[]).length,1);assert.ok(!r.text.includes('$'));
 }
});
