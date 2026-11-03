// Synthetic commercial scenarios only. No provider calls, webhooks or real customers.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {central,sourceToAlex} from '../central-source.mjs';
import {alexBaseline,quoteCurrent} from '../alex-catalog.mjs';
import {generateAlex,quickReplies} from '../alex.mjs';
import {phoneVariant} from '../phone-variants.mjs';
const NOW=Date.parse('2026-11-03T06:00:00Z');
function clock(t){t.mock.timers.enable({apis:['Date'],now:NOW});}
function fixture(stale=false){
 const data=structuredClone(central);
 data.source={...data.source,file_name:'SYNTHETIC_ULTRA_SCENARIO_NOT_A_REPORT.xlsx',sha256:'d'.repeat(64),cut_date:stale?'2026-11-01':'2026-11-03',generated_at:new Date(NOW-(stale?48:1)*3600000).toISOString(),synthetic_fixture:true};
 data.normalized_at=new Date(NOW).toISOString();data.expires_at=new Date(Date.parse(data.source.generated_at)+86400000).toISOString();
 return sourceToAlex(alexBaseline,data,all=>all.filter(p=>['TELF017','TELF018','TELF019'].includes(p.sku)),NOW);
}
const fallback={CATALOG_FIRST:'true'};
function safe(r,source,{stale=false}={}){
 assert.ok(r.text&&r.text.length<=((r.variant_options?.length||0)>=3?700:440),'Response should stay brief and useful');
 assert.ok((r.text.match(/\?/g)||[]).length<=1,'Only one principal question');
 assert.ok(!/\b(?:TELF\d+|SKU)\b|stock referencial|\b\d+\s+unidades\b/i.test(r.text),'No internal identifiers or quantities');
 const values=[...r.text.matchAll(/\$(\d+(?:\.\d{2})?)/g)].map(m=>Math.round(Number(m[1])*100));
 // A selected version may include verified sibling offers while conversational
 // focus remains on that selected version. Every advertised amount must still
 // come from a fresh, purchasable source record, never from model output.
 const ids=new Set([...(r.focus||[]),...(r.variant_options||[]).map(v=>v.sku)]);
 for(const option of r.variant_options||[]){
  const product=source.productos.find(p=>p.sku===option.sku);
  assert.ok(product,'Each proposed variant must exist in the source');
  const identity=phoneVariant(product);
  assert.ok(identity?.verified_identity,'Each variant identity must come from verified source fields');
  for(const field of ['storage_gb','ram_physical_gb','ram_virtual_gb','connectivity'])assert.equal(option[field],identity[field],'Variant '+field+' must match its own verified SKU');
  if(!stale){
   assert.ok(quoteCurrent(source,product)&&product.price_verified!==false&&product.stock>0&&(!product.central_availability||product.central_availability==='in_stock')&&!(product.blocked_reasons||[]).length,'Every current variant offer must be verified and available');
   assert.equal(option.cash,product.promo,'Variant cash quote must match its own source SKU');
   assert.equal(option.card,product.pvp,'Variant card quote must match its own source SKU');
   if(product.variant_gb)assert.equal(option.storage_gb,product.variant_gb,'Variant storage recommendation must match its own source SKU');
  }
 }
 const allowed=new Set([...ids].flatMap(id=>{const p=source.productos.find(p=>p.sku===id);return p&&quoteCurrent(source,p)&&p.price_verified!==false&&p.stock>0&&(!p.central_availability||p.central_availability==='in_stock')&&!(p.blocked_reasons||[]).length?[Math.round(p.promo*100),Math.round(p.pvp*100)]:[];}));
 assert.ok(stale?values.length===0:values.every(v=>allowed.has(v)),'Only exact fixture prices, and none when stale');
 assert.ok(!/ya (?:est[aá]|queda).{0,20}reservad|pago confirmado|te llega hoy|env[ií]o gratis/i.test(r.text),'No invented confirmation or delivery');
 for(const q of quickReplies(r)){assert.ok(q.title&&q.title.length<=20);assert.ok(q.payload?.startsWith('ALEX:'));}
}
test('Colloquial budget limits a natural phone search to verified affordable options',async t=>{
 clock(t);const source=fixture(),r=await generateAlex('Tengo 180 dólares para un celular',source,{},fallback);
 safe(r,source);assert.equal(r.memory.budget,180);assert.ok(r.focus.length>0);
 for(const id of r.focus){const p=source.productos.find(p=>p.sku===id);assert.ok(p&&p.stock>0&&p.price_verified!==false&&p.promo<=180,'Recommendation must fit the stated cash budget');}
 assert.notEqual(r.action,'handoff');
});
test('A rejected brand does not reappear as the recommendation or survive as the chosen preference',async t=>{
 clock(t);const source=fixture(),r=await generateAlex('Prefiero Samsung, no Redmi',source,{focus:['TELF017'],brand:'Redmi'},fallback);
 safe(r,source);assert.ok(r.focus.length>0);assert.ok(r.focus.every(id=>/^TELF01[12]$/.test(id)));assert.match(r.memory.brand||'',/samsung/i);
 assert.ok(!/Redmi/i.test(r.text));assert.notEqual(r.action,'handoff');
});
test('A follow-up requesting 256 GB cannot silently retain the 128 GB phone',async t=>{
 clock(t);const source=fixture(),r=await generateAlex('¿Y el de 256 GB?',source,{focus:['TELF017']},fallback);
 safe(r,source);assert.ok(r.focus.length>0);assert.ok(r.focus.every(id=>['TELF018','TELF019'].includes(id)));assert.ok(!r.focus.includes('TELF017'));
 assert.match(r.text,/256 GB/);assert.notEqual(r.action,'handoff');
});
test('Taking photos describes a buyer need, while an explicit image request remains an image request',async t=>{
 clock(t);const source=fixture();
 const use=await generateAlex('Lo necesito para trabajar, tomar fotos y WhatsApp',source,{focus:['TELF017']},fallback);
 safe(use,source);assert.notEqual(use.intent,'photo');assert.match(use.memory.need||'',/trabajar|tomar fotos|WhatsApp/i);assert.notEqual(use.action,'handoff');
 const photo=await generateAlex('Muéstrame la fotografía de ese',source,use.memory,fallback);safe(photo,source);assert.equal(photo.intent,'photo');assert.equal(photo.image,'TELF017');
});
test('Safe fallback negotiates within policy and advances an explicit fresh purchase without repeating known preferences',async t=>{
 clock(t);const source=fixture(),memory={focus:['TELF017'],budget:180,payment:'contado',delivery:'retiro'};
 const bargain=await generateAlex('¿Me haces una rebajita? 😂',source,memory,fallback);safe(bargain,source);
 assert.ok(bargain.facts.includes('discount'));assert.notEqual(bargain.action,'handoff');assert.ok(!/te (?:hago|doy).{0,15}(?:rebaja|descuento)|te (?:lo|la) dejo/i.test(bargain.text));
 const buy=await generateAlex('Me lo llevo',source,bargain.memory,fallback);safe(buy,source);
 assert.equal(buy.action,'interest');assert.match(buy.text,/confirm|pendiente/i);assert.ok(!/prefieres|forma de pago|retir|entrega|\?/.test(buy.text));
 assert.equal(buy.memory.payment,'contado');assert.equal(buy.memory.delivery,'retiro');
 const stale=fixture(true),held=await generateAlex('Me lo llevo',stale,memory,fallback);safe(held,stale,{stale:true});assert.notEqual(held.action,'interest');
});
test('Generative voice is retained while repeated greetings and invented prose are removed',async t=>{
 clock(t);const source=fixture();let calls=0;
 const env={FREE_TIER_VERIFIED:'true',AI:{run:async()=>{calls++;return {response:{say:calls===1?'¡Epa! Soy Alex, tu asesor de CONECTATECH.':'Hola, ¡te lo dejo en $1 y con envío gratis!',facts:['TELF017.memory'],ask:calls===1?'¿Para qué lo vas a usar?':'¿Y qué uso le vas a dar?',focus:['TELF017'],image:null,intent:'other',action:'answer',remember:{}}};}}};
 // A direct model query now prioritizes verified variants over introductory
 // prose. Exercise generative identity with an actual greeting instead.
 const a=await generateAlex('Hola buenas',source,{},env);safe(a,source);assert.equal(a.generative,true);assert.match(a.text,/Alex/);
 const selected=await generateAlex('Busco un Redmi 15C de 128 GB',source,a.memory,fallback);safe(selected,source);assert.deepEqual(selected.memory.focus,['TELF017']);
 const b=await generateAlex('Ya sé el modelo, cuéntame algo útil',source,selected.memory,env);safe(b,source);assert.equal(b.generative,true);assert.ok(!/hola|env[ií]o gratis|\$1\b/i.test(b.text));assert.ok(b.facts.some(k=>k.startsWith('TELF017.')));assert.equal(calls,2);
});
test('A generative recommendation does not rush to delivery and malformed humor still keeps a safe warm reply',async t=>{
 clock(t);const source=fixture();
 const env={FREE_TIER_VERIFIED:'true',AI:{run:async()=>({response:{say:'Claro, revisemos.',facts:['TELF017.cash'],ask:'¿Tienes alguna preferencia para la entrega, como retiro en tienda o envío a domicilio?',focus:['TELF017'],image:null,intent:'recommend',action:'recommend',remember:{}}})}};
 const first=await generateAlex('Busco un Redmi 15C de 128 GB para trabajar, presupuesto 180. ¿Qué me aconsejas?',source,{},env);safe(first,source);assert.ok(!/retiro|entrega/i.test(first.text));assert.ok(first.facts.includes('TELF017.cash'));
 const verifiedVariantReason=(first.variant_options||[]).some(v=>v.storage_gb&&first.text.includes(v.storage_gb+' GB'))&&/te recomiendo|te conviene|uso diario|m[aá]s espacio|multitarea/i.test(first.text);
 assert.ok(first.facts.some(k=>/\.(?:benefit|memory|battery)$/.test(k))||verifiedVariantReason,'Recommendation must include a verified reason, not just a price');
 env.AI.run=async()=>({response:{say:'Jajaja, ¿y tú qué dices?',facts:['discount'],ask:'',focus:['TELF017'],image:null,intent:'other',action:'answer',remember:{}}});
 const joke=await generateAlex('¿Me haces una rebajita? 😂',source,first.memory,env);safe(joke,source);assert.match(joke.text,/Jajaja|presupuesto/);assert.ok(joke.facts.includes('discount'));
});
test('A complete 24-turn conversation keeps commercial context and ends with requested human handoff',async t=>{
 clock(t);const source=fixture(),script=[
  'Hola buenas 😊','Busco un Redmi 15C de 128 GB','Mi presupuesto es de 180 dólares',
  'Lo necesito para trabajar, tomar fotos y WhatsApp','¿Qué batería tiene ese?',
  '¿Y cuánto cuesta de contado?','¿Y con tarjeta?','Pero no tengo tarjeta Pacífico',
  'Tengo Pichincha','¿A seis meses?','Mejor pago al contado','Quiero entrega en Quito',
  'Estoy en La Carolina, Quito','¿Y si fuera envío nacional?','Muéstrame la fotografía',
  '¿Me haces una rebajita? 😂','No compraré todavía','Quiero continuar después',
  'Sigamos con ese celular','¿Y el de 256 GB?','Prefiero el Redmi 15C de 256 GB con 4 GB de RAM',
  '¿Y con tarjeta el de 256 GB?','Quiero comprar ese, prefiero retiro en tienda','Necesito hablar con una persona'
 ];
 let memory={},turns=[];
 for(const [i,input]of script.entries()){
  const r=await generateAlex(input,source,memory,fallback);safe(r,source);memory=r.memory;
  if(i===0)assert.match(r.text,/hola|epa|buenas|bienvenid|Alex/i,'A greeting should receive a warm greeting');
  if(i>1&&i<19)assert.deepEqual(r.focus,['TELF017'],'Selected 128 GB model survives factual and social follow-ups');
  if(i>=2)assert.equal(memory.budget,180,'Budget outlives transcript trimming');
  if(i>=3)assert.match(memory.need||'',/trabajar|tomar fotos|WhatsApp/i,'Use remains a preference');
  if(i>0)assert.ok(!/\b(?:hola|epa|bienvenid[oa]|soy alex)\b/i.test(r.text),'No repeated greeting');
  if(i===7){assert.ok(!/Pac[ií]fico|sin intereses/i.test(r.text));assert.ok(memory.rejected_banks.includes('pacifico'));}
  if(i>7)assert.ok(!/Pac[ií]fico/i.test(r.text),'A rejected bank is not sold again');
  if(i===8)assert.equal(memory.bank,'pichincha');
  if(i===9){assert.equal(r.intent,'payment');assert.match(r.text,/confirmaci[oó]n|confirmar/i,'November terms are not invented from October');}
  if(i>=10){assert.equal(memory.payment,'contado');assert.ok(!memory.bank);}
  if(i>=12)assert.equal(memory.sector,'La Carolina');
  if(i===13)assert.equal(memory.delivery,'quito','A shipping question does not replace a chosen delivery');
  if(i===14){assert.equal(r.intent,'photo');assert.equal(r.image,'TELF017');}
  if(i===15)assert.ok(r.facts.includes('discount'));
  if(i===16||i===17){assert.equal(memory.purchase_deferred,true);assert.ok(!/pagar|entrega|retir|\?/.test(r.text));}
  if(i===18)assert.equal(memory.purchase_deferred,false);
  if(i===19)assert.ok(r.focus.length&&r.focus.every(id=>['TELF018','TELF019'].includes(id)));
  if(i===20||i===21||i===22)assert.deepEqual(r.focus,['TELF018']);
  if(i===21){assert.ok(r.facts.includes('TELF018.card'));assert.ok(r.text.includes('$219.88'),'Card base price must not be displaced by an old bank discussion');}
  if(i===22){assert.equal(r.action,'interest');assert.equal(memory.delivery,'retiro');}
  if(i===23)assert.equal(r.action,'handoff');else assert.notEqual(r.action,'handoff');
  turns.push({input,text:r.text,focus:r.focus,intent:r.intent,action:r.action,facts:r.facts,buttons:quickReplies(r).map(q=>q.title),memory:{budget:memory.budget,need:memory.need,payment:memory.payment,bank:memory.bank||null,delivery:memory.delivery,sector:memory.sector,purchase_deferred:memory.purchase_deferred===true}});
 }
 const dir=new URL('../generated/fase2/',import.meta.url);await mkdir(dir,{recursive:true});
 await writeFile(new URL('alex-ultra-simulada.json',dir),JSON.stringify({schema:'conectatech.alex.ultra.synthetic.v1',passed:true,synthetic:true,real_AI:false,real_customer_conversation:false,provider_calls:0,messages_sent:0,turns},null,2)+'\n');
});
