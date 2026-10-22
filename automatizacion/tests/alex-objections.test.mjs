import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {generateAlex,commercialFallback,quickReplies,makePrompt,renderPlan,paymentContext} from '../alex.mjs';
import {bankIntent,mergePreferences} from '../alex-context.mjs';
import {alexBaseline} from '../alex-catalog.mjs';
import {normalizeAlexAction} from '../channels.mjs';
import {objectionConversation,assertCommercialTurn} from '../alex-objections-scenarios.mjs';
const source={...alexBaseline,fuente_fecha:null},plan={say:'Claro, revisemos juntos.',facts:['pacifico'],ask:'¿Quieres pagar con Pacífico?',focus:['TELF011'],image:null,intent:'payment',action:'answer',remember:{}};
test('Bank denial, mixed correction and pronouns distinguish ownership from hypothetical queries',()=>{
 for(const input of ['Pero no tengo tarjeta Pacífico','Pacífico no tengo','No uso la tarjeta Pacífico','No tengo Pacífico ni Guayaquil']){const b=bankIntent(input,{bank:'pacifico'});assert.ok(b.denied.includes('pacifico'));assert.equal(paymentContext(input,{bank:'pacifico',months:3}).requires_interest,false);}
 for(const input of ['No tengo esa tarjeta','Esa no la tengo','Esa tarjeta no'])assert.deepEqual(bankIntent(input,{last_bank_mentioned:'pacifico'}).denied,['pacifico']);
 const m=mergePreferences('No tengo Pacífico, pero sí tengo Pichincha',{}, {bank:'pacifico',months:3,payment:'tarjeta'});assert.equal(m.bank,'pichincha');assert.equal(m.months,undefined);assert.deepEqual(m.rejected_banks,['pacifico']);
 assert.equal(mergePreferences('Tengo Pichincha, no Pacífico',{},{}).bank,'pichincha');
 assert.equal(mergePreferences('¿Y si uso Pichincha?',{}, {bank:'diners'}).bank,'diners');
 assert.equal(mergePreferences('¿Aceptan Pichincha?',{}, {bank:'diners'}).bank,'diners');
 const cash=mergePreferences('No tengo ninguna tarjeta',{}, {bank:'pacifico',payment:'tarjeta',months:3});assert.equal(cash.bank,undefined);assert.equal(cash.payment,undefined);assert.equal(cash.card_declined,true);
 assert.equal(paymentContext('No a doce meses',{bank:'diners',months:12}).requires_interest,false);
 const preferred=commercialFallback('No quiero comprar con tarjeta, prefiero contado',source,{focus:['TELF011'],bank:'diners',payment:'tarjeta'});assert.equal(preferred.memory.payment,'contado');assert.ok(preferred.facts.includes('TELF011.cash_pending'));assert.ok(!preferred.text.includes('?'));assert.equal(preferred.memory.purchase_deferred||false,false);
});
test('A rejected bank is excluded from model context and final rendering even after the short history expires',async()=>{
 const m={focus:['TELF011'],bank:'pichincha',rejected_banks:['pacifico'],budget:200,history:[]};
 const prompt=makePrompt('¿Qué batería tiene ese?',source,m)[0].content;assert.ok(!prompt.includes('"pacifico":'));assert.ok(!prompt.includes('"pichincha":'));assert.ok(prompt.includes('rejected_banks'));
 const r=renderPlan({...plan,say:'Claro, revisemos juntos.',ask:'',facts:['pacifico','TELF011.battery']},source,m);assert.ok(!/Pacífico/.test(r.text));assert.match(r.text,/5000 mAh/);
 let calls=0;const a=await generateAlex('Pero no tengo tarjeta Pacífico',source,{focus:['TELF011'],bank:'pacifico',months:3},{FREE_TIER_VERIFIED:'true',AI:{run:async()=>{calls++;return{response:plan};}}});assert.equal(calls,1);assert.equal(a.generative,true);assert.ok(!/Pacífico|sin intereses/.test(a.text));assert.match(a.text,/otra|otro/);
 const old=await generateAlex('Pero no tengo tarjeta Pacífico',source,{focus:['TELF011'],bank:'pacifico',months:3},{CATALOG_FIRST:'true'});assert.ok(!old.text.includes('Pacífico'));assert.equal(old.memory.bank,undefined);assert.equal(old.memory.months,undefined);
 const unknown=await generateAlex('Tengo tarjeta Produbanco, ¿y a seis meses?',source,{focus:['TELF011'],bank:'diners',months:12},{CATALOG_FIRST:'true'});assert.match(unknown.text,/condiciones.*requieren confirmación/);assert.ok(!/Diners|sin intereses/.test(unknown.text));assert.equal(unknown.memory.bank,undefined);assert.equal(unknown.memory.months,undefined);
});
test('Native other-card selection keeps exact variant, asks for the new bank and does not quote a rejected plan',async()=>{
 const m={focus:['TELF011'],payment:'tarjeta',bank:'pacifico'};const a=commercialFallback('Pero no tengo tarjeta Pacífico',source,m);const button=quickReplies(a).find(q=>q.title==='Otra tarjeta');assert.ok(button);const next=await generateAlex(normalizeAlexAction(button.payload),source,a.memory,{CATALOG_FIRST:'true'});assert.match(next.text,/qu[eé] banco/i);assert.deepEqual(next.focus,['TELF011']);assert.ok(!/Pacífico|sin intereses/.test(next.text));
 const none=commercialFallback('No tengo tarjeta',source,m);assert.ok(!quickReplies(none).some(q=>/card|anothercard/.test(q.payload)));assert.match(none.text,/contado/);
});
test('Complete 21-turn conversations remain useful for quota exhaustion, provider failure and adversarial model output',async()=>{
 const reports=[];
 for(const mode of ['quota_exhausted','provider_unavailable','synthetic_model_contract','synthetic_verified_fresh_catalog']){
  let memory={},calls=0;const turns=[];
  const env={FREE_TIER_VERIFIED:'true',CATALOG_FIRST:'true',AI:{run:async()=>{calls++;if(mode==='provider_unavailable')throw Error('provider unavailable');return{response:{...plan,facts:['pacifico','TELF011.screen']}};}}};
  for(const [i,input]of objectionConversation.entries()){
   const fresh=mode==='synthetic_verified_fresh_catalog',current=fresh?{...source,fuente_fecha:new Date().toISOString()}:source;
   const previous=memory,a=await generateAlex(input,current,memory,fresh?{CATALOG_FIRST:'true'}:env,async()=>mode!=='quota_exhausted');a.quick_replies=quickReplies(a);const p=current.productos.find(p=>p.sku==='TELF011');assertCommercialTurn(i,a,previous,{quotesCurrent:fresh,cash:'$'+p.promo.toFixed(2),card:'$'+p.pvp.toFixed(2)});memory=a.memory;
   turns.push({input,text:a.text,generative:a.generative,facts:a.facts,focus:a.focus,error_code:a.error_code,buttons:a.quick_replies.map(q=>q.title),context:{budget:memory.budget,bank:memory.bank||null,rejected_banks:memory.rejected_banks,months:memory.months||null,payment:memory.payment,delivery:memory.delivery,sector:memory.sector,stage:memory.stage}});
  }
  if(mode==='quota_exhausted')assert.equal(calls,0);assert.ok(memory.history.length<=12);assert.equal(memory.budget,200);assert.equal(memory.rejected_banks.includes('pacifico'),true);reports.push({mode,simulated:true,real_AI:false,messages_sent:0,turns});
 }
 const dir=new URL('../generated/fase2/',import.meta.url);await mkdir(dir,{recursive:true});await writeFile(new URL('alex-objeciones-simuladas.json',dir),JSON.stringify({passed:true,conversations:reports},null,2)+'\n');
});
