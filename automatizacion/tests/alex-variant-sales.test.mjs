// Synthetic commercial fixtures only. These values/specifications are NOT inventory evidence.
// No provider calls, messages, external accounts, network, or new catalog source.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateAlex,quickReplies} from '../alex.mjs';
import {getProfile,withPersona} from '../alex-collaborators.mjs';
import {quoteCurrent} from '../alex-catalog.mjs';
import {phoneVariant} from '../phone-variants.mjs';

const NOW=Date.parse('2026-11-03T18:00:00Z');
const clock=t=>t.mock.timers.enable({apis:['Date'],now:NOW});
const cash=cents=>'$'+(cents/100).toFixed(2);
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function phone(sku,brand,model,storage,ram,virtual,cashCents,cardCents,{network='4G',available=true,blocked=false}={}){
 const sourceName=`TELEFONO ${brand.toUpperCase()} ${model.toUpperCase()} ${storage}GB ${ram}GB+${virtual}GB ${network}`;
 return {sku,nombre:`Telefono ${brand} ${model} ${storage}GB ${ram}GB+${virtual}GB`,source_name:sourceName,catalog_identity:sourceName,
  public_name:`${brand==='Samsung'?'Samsung Galaxy':brand} ${model} ${storage} GB · ${ram} GB RAM · ${network}`,
  category:'TELEFONOS',categoria:'TELEFONOS',variant_gb:[storage,ram],
  promo:cashCents/100,pvp:cardCents/100,price_verified:!blocked,stock:available&&!blocked?1:0,stock_is_availability_marker:true,
  disponible:available&&!blocked,central_availability:blocked?'blocked':available?'in_stock':'out_of_stock',
  blocked_reasons:blocked?['SYNTHETIC_IDENTITY_CONFLICT']:[],foto:null,foto_sha256:null,banner:null,banner_sha256:null,
  url:'https://conectatech-ec.github.io/productos/'+sku.toLowerCase()+'/',descripcion:'',
  caracteristicas:{Almacenamiento:storage+' GB','RAM física':ram+' GB','RAM virtual':virtual+' GB','Red móvil':network,'Batería':'5000 mAh'}};
}
function fixture({stale=false,extra=[]}={}){
 const generated=new Date(NOW-(stale?48:1)*3600000).toISOString();
 return {fuente_fecha:generated,source_sha256:'e'.repeat(64),inventory_cut_date:stale?'2026-11-01':'2026-11-03',source_kind:'synthetic_variant_fixture',
  expires_at:new Date(Date.parse(generated)+86400000).toISOString(),productos:[
   phone('TELF011','Samsung','A17',128,4,4,18590,23238),
   phone('TELF012','Samsung','A17',256,8,8,23990,29988),
   phone('TELF017','Redmi','15C',128,4,4,15990,19988),
   phone('TELF018','Redmi','15C',256,4,4,17590,21988),
   phone('TELF019','Redmi','15C',256,8,8,20590,25738),
   ...extra]};
}
const fallback={CATALOG_FIRST:'true'};
function conservativeModel(focus=['TELF011','TELF012']){
 return {FREE_TIER_VERIFIED:'true',AI:{run:async()=>({response:{
  say:'Revisemos lo que te conviene.',facts:focus.map(id=>id+'.name'),ask:'¿Cuál de estas versiones te interesa?',
  focus,image:null,intent:'recommend',action:'recommend',remember:{}
 }})}};
}
function amounts(text){return [...text.matchAll(/\$(\d+(?:\.\d{2})?)/g)].map(m=>Math.round(Number(m[1])*100));}
function assertSafe(a,source,{stale=false}={}){
 assert.ok(a.text&&a.text.length<=((a.variant_options?.length||0)>=3?700:440),'Keep variants compact and ordinary turns brief');
 assert.ok((a.text.match(/\?/g)||[]).length<=1,'Only one useful principal question');
 assert.ok(!/\b(?:TELF\d+|COL\d+|SKU)\b|stock referencial|\b\d+ unidades\b/i.test(a.text),'No internal codes or inventory quantities');
 const offered=new Set([...(a.focus||[]),...(a.variant_options||[]).map(v=>v.sku)]);
 for(const option of a.variant_options||[]){
  const product=source.productos.find(p=>p.sku===option.sku),identity=phoneVariant(product);
  assert.ok(identity?.verified_identity,'Variant must resolve to a verified source identity');
  for(const key of ['storage_gb','ram_physical_gb','ram_virtual_gb','connectivity'])assert.equal(option[key],identity[key],'Never invent a variant configuration');
  if(stale){assert.equal(option.cash,null);assert.equal(option.card,null);}
  else{assert.equal(option.cash,product.promo);assert.equal(option.card,product.pvp);assert.ok(quoteCurrent(source,product)&&product.stock>0&&product.price_verified!==false&&product.central_availability==='in_stock'&&!product.blocked_reasons.length,'Current offers must be fresh, available and unblocked');}
 }
 const allowed=new Set(source.productos.filter(p=>offered.has(p.sku)&&quoteCurrent(source,p)&&p.stock>0&&p.price_verified!==false&&p.central_availability==='in_stock'&&!p.blocked_reasons.length).flatMap(p=>[Math.round(p.promo*100),Math.round(p.pvp*100)]));
 const found=amounts(a.text);assert.ok(stale?found.length===0:found.every(n=>allowed.has(n)),'Only exact verified amounts from available fixture variants');
 assert.ok(!/ya (?:est[aá]|queda).{0,20}reservad|pago confirmado|te llega hoy|env[ií]o gratis|ya confirm[eé] tu compra/i.test(a.text));
 for(const q of quickReplies(a)){assert.ok(q.title&&q.title.length<=20);assert.ok(q.payload?.startsWith('ALEX:'));}
}
function assertCashOffers(a,source,ids){
 assertSafe(a,source,{variantReply:ids.length>2});
 for(const id of ids){const p=source.productos.find(p=>p.sku===id);assert.ok(p&&a.text.includes(cash(Math.round(p.promo*100))),`Same response must include verified price for ${id}`);}
 assert.notEqual(a.action,'handoff');
}
function hasRecommendation(text){return /recomiend|convien|encaja|se ajusta|si (?:buscas|quieres|priorizas|guardas)|para (?:guardar|m[aá]s|multitarea)|m[aá]s (?:espacio|almacenamiento)/i.test(text);}

test('A17 presents both available configurations, exact prices and a useful recommendation in fallback and model paths',async t=>{
 clock(t);const source=fixture();
 for(const env of [fallback,conservativeModel()]){
  const a=await generateAlex('Busco un Samsung A17 para guardar muchas fotos. ¿Qué opciones tienen?',source,{},env);
  assertCashOffers(a,source,['TELF011','TELF012']);
  assert.match(a.text,/128\s*GB/);assert.match(a.text,/256\s*GB/);assert.match(a.text,/RAM/i);
  assert.ok(hasRecommendation(a.text),'A list of names/prices alone is not commercial advice');
  assert.ok(!/¿(?:Qu[eé]|Cu[aá]l).{0,15}(?:marca|modelo|versi[oó]n)/i.test(a.text),'Known model and need should not restart the variant interrogation');
 }
});

test('A family containing three available Redmi variants is not silently truncated to the first two',async t=>{
 clock(t);const source=fixture(),a=await generateAlex('¿Qué versiones del Redmi 15C tienen y cuánto cuestan?',source,{},fallback);
 assertCashOffers(a,source,['TELF017','TELF018','TELF019']);
 assert.match(a.text,/128\s*GB/);assert.match(a.text,/256\s*GB/);
 assert.match(a.text,/4\s*GB/);assert.match(a.text,/8\s*GB/);
});

test('HONOR, TECNO, Infinix, ZTE and Xiaomi discover complete configurations from product identity rather than A17-specific branches',async t=>{
 clock(t);
 for(const [offset,brand,model]of [[100,'HONOR','X6c'],[110,'TECNO','Spark 30'],[120,'Infinix','Hot 50i'],[130,'ZTE','Blade A56 Pro'],[140,'Xiaomi','14C']]){
  const ids=['TELF'+(offset+1),'TELF'+(offset+2)];
  const extra=[phone(ids[0],brand,model,128,4,4,12013+offset,15017+offset),phone(ids[1],brand,model,256,8,8,14826+offset,18533+offset)];
  const source=fixture({extra}),a=await generateAlex(`Busco un ${brand} ${model}. ¿Qué variantes y precios tienen?`,source,{},fallback);
  assertCashOffers(a,source,ids);assert.ok(a.text.toLowerCase().includes(brand.toLowerCase()));
  assert.ok(!/Samsung|Galaxy A17|Redmi 15C/i.test(a.text),'A generic phone request cannot fall back to an unrelated hard-coded family');
 }
});

test('Explicit network and Pro/Plus model requests never mix a different model under the same label',async t=>{
 clock(t);const source=fixture({extra:[
  phone('TELF201','Samsung','A17',128,4,4,21121,26402,{network:'5G'}),
  phone('TELF202','Samsung','A17 Pro',256,8,8,28734,35918),
  phone('TELF203','Samsung','A17 Plus',256,8,8,29645,37056)
 ]});
 const base=await generateAlex('Samsung A17 4G: ¿qué configuraciones y precios hay?',source,{},fallback);
 assertCashOffers(base,source,['TELF011','TELF012']);
 for(const id of ['TELF201','TELF202','TELF203'])assert.ok(!base.text.includes(cash(Math.round(source.productos.find(p=>p.sku===id).promo*100))));
 assert.ok(!/A17 Pro|A17 Plus|\b5G\b/i.test(base.text));
 const pro=await generateAlex('Precio del Samsung A17 Pro 256 GB con 8 GB de RAM',source,{},fallback);
 assertSafe(pro,source);assert.ok(pro.text.includes('$287.34'));assert.ok(!pro.text.includes('$185.90'));assert.ok(!pro.text.includes('$296.45'));
});

test('Physical RAM is kept distinct from virtual expansion, and an exact requested variant answers first',async t=>{
 clock(t);const source=fixture();
 const a=await generateAlex('¿Qué versiones del Samsung A17 tienen? Me importa la RAM física.',source,{},fallback);
 assertCashOffers(a,source,['TELF011','TELF012']);assert.match(a.text,/128\s*GB.{0,55}4\s*GB/i);assert.match(a.text,/256\s*GB.{0,55}8\s*GB/i);
 assert.ok(!/16\s*GB\s*(?:de\s*)?(?:RAM\s*)?f[ií]sic/i.test(a.text),'8+8 expansion never becomes16GB physical');
 assert.ok(!/128\s*GB.{0,45}8\s*GB\s*(?:de\s*)?RAM\s*f[ií]sic/i.test(a.text),'The 4+4 option never becomes8GB physical');
 const exact=await generateAlex('Me interesa el Samsung A17 de 128 GB con 4 GB de RAM. ¿Qué precio tiene?',source,{},fallback);
 assertSafe(exact,source);assert.ok(exact.text.includes('$185.90'));assert.ok(exact.text.indexOf('128')<exact.text.indexOf('256')||!exact.text.includes('256'),'Answer the explicitly requested configuration before its alternatives');
 const card=await generateAlex('¿Y ese con tarjeta?',source,exact.memory,fallback);assertSafe(card,source);assert.ok(card.text.includes('$232.38'));assert.ok(!card.text.includes('$299.88')||card.text.indexOf('$232.38')<card.text.indexOf('$299.88'),'A sibling mention must not replace the chosen conversational product');
 // Repeating storage alone is not a request to forget the physical RAM of an
 // already selected version when two sellable versions share that storage.
 for(const env of [fallback,conservativeModel(['TELF018'])]){
  const selected=await generateAlex('Prefiero el Redmi 15C de 256 GB con 4 GB de RAM',source,{},env);
  assert.deepEqual(selected.memory.focus,['TELF018']);
  const followup=await generateAlex('¿Y con tarjeta el de 256 GB?',source,selected.memory,env);
  assertSafe(followup,source);assert.deepEqual(followup.focus,['TELF018']);assert.deepEqual(followup.memory.focus,['TELF018']);
  assert.equal(followup.generative,!!env.AI,'Exercise both generation and catalog fallback with the same selection logic');
  assert.ok(followup.text.includes('$219.88'));
  assert.ok(!followup.text.includes('$257.38')||followup.text.indexOf('$219.88')<followup.text.indexOf('$257.38'),'Same-storage alternative must not displace the selected RAM version');
 }
});

test('Out-of-stock, conflicted and expired variants never become current available offers',async t=>{
 clock(t);const source=fixture();
 source.productos.find(p=>p.sku==='TELF012').stock=0;source.productos.find(p=>p.sku==='TELF012').central_availability='out_of_stock';
 source.productos.push(phone('TELF204','Samsung','A17',512,12,12,39917,49896,{blocked:true}));
 const a=await generateAlex('¿Qué Samsung A17 disponibles tienen y a qué precio?',source,{},fallback);
 assertCashOffers(a,source,['TELF011']);assert.ok(!a.text.includes('$239.90'));assert.ok(!a.text.includes('$399.17'));
 assert.ok(a.focus.every(id=>id!=='TELF012'&&id!=='TELF204'),'An unavailable or conflicted sibling must not enter an active multi-variant selection');
 const stale=fixture({stale:true}),held=await generateAlex('Busco Samsung A17: ¿qué variantes disponibles y precios tienen?',stale,{},fallback);
 assertSafe(held,stale,{stale:true});assert.ok(!/\b(?:hay|tenemos)\s+(?:stock|existencias)|\best[aá]n?\s+disponibles?\b/i.test(held.text));assert.match(held.text,/confirm|vigente|actualiz/i);assert.notEqual(held.action,'handoff');
});

test('Rafa and Jessy complete26 conversational turns with budget, objections, exact selection and responsible closing',async t=>{
 clock(t);const base=fixture();
 const script=[
  'Hola','Busco un Samsung A17','Mi presupuesto es de 200 dólares',
  'Lo necesito para trabajar y guardar muchas fotos','¿Cuál me recomiendas?',
  'Me interesa el Samsung A17 de 128 GB con 4 GB de RAM','¿Qué batería tiene ese?',
  '¿Y de contado?','¿Y con tarjeta?','Pero no tengo tarjeta Pacífico','Tengo Pichincha',
  '¿Y a seis meses?','Mejor pago al contado','Quiero entrega en Quito','Estoy en La Carolina, Quito',
  '¿Y también hacen envíos nacionales?','Muéstrame una fotografía','¿Me haces una rebajita? 😂',
  'No compraré todavía','Quiero continuar después','Sigamos con ese Samsung',
  'Mi presupuesto ahora es de 260 dólares','Prefiero el Samsung A17 de 256 GB con 8 GB de RAM',
  '¿Y ese con tarjeta?','Quiero comprar ese, prefiero retiro en tienda','Necesito hablar con una persona'
 ];
 for(const id of ['COL001','COL002']){
  const source=withPersona(base,getProfile(id));let memory={};
  for(const [i,input]of script.entries()){
   const a=await generateAlex(input,source,memory,fallback);assertSafe(a,source,{variantReply:true});memory=a.memory;
   if(i===0){assert.ok(a.text.includes(getProfile(id).commercial_name));assert.match(a.text,/virtual/);}
   if(i>0)assert.ok(!/\b(?:hola|epa|bienvenid[oa]|soy alex)\b/i.test(a.text),'Do not restart greetings during a conversation');
   assert.ok(!a.text.includes(getProfile(id==='COL001'?'COL002':'COL001').commercial_name),'Never mix personalities');
   if(i===1)assertCashOffers(a,source,['TELF011','TELF012']);
   if(i>=2&&i<21)assert.equal(memory.budget,200);if(i>=21)assert.equal(memory.budget,260);
   if(i>=3)assert.match(memory.need||'',/trabajar|guardar muchas fotos/i);
   if(i===6)assert.match(a.text,/5000 mAh/);
   if(i===7)assert.ok(a.text.includes('$185.90'));if(i===8)assert.ok(a.text.includes('$232.38'));
   if(i===9){assert.ok(memory.rejected_banks.includes('pacifico'));assert.ok(!/Pac[ií]fico|sin intereses/.test(a.text));}
   if(i>9)assert.ok(!/Pac[ií]fico/.test(a.text),'A rejected bank never returns as an offer');
   if(i===10)assert.equal(memory.bank,'pichincha');if(i===11)assert.match(a.text,/confirmaci[oó]n|confirmar/);
   if(i>=12){assert.equal(memory.payment,'contado');assert.equal(memory.bank||null,null);}
   if(i>=14)assert.equal(memory.sector,'La Carolina');if(i===15)assert.equal(memory.delivery,'quito');
   if(i===17){assert.ok(a.facts.includes('discount'));assert.ok(!/te (?:doy|hago).{0,15}(?:rebaja|descuento)/i.test(a.text));}
   if(i===18||i===19){assert.equal(memory.purchase_deferred,true);assert.ok(!/[?¿]|pagar|entrega|retir/.test(a.text));}
   if(i===20)assert.equal(memory.purchase_deferred,false);
   if(i===23)assert.ok(a.text.includes('$299.88'),'Chosen256GB PVP must not revert to128GB or an old bank discussion');
   if(i===24){assert.equal(a.action,'interest');assert.equal(memory.delivery,'retiro');assert.match(a.text,/confirm|pendiente/i);}
   if(i===25)assert.equal(a.action,'handoff');else assert.notEqual(a.action,'handoff');
  }
 }
});

test('Absent 5G and Pro versions never fall through to prices of a different configuration',async t=>{
 clock(t);const source=fixture();
 for(const input of ['¿Cuánto cuesta el Samsung A17 5G?','Precio del Samsung A17 Pro','Quiero un Redmi 15C Plus']){
  const a=await generateAlex(input,source,{},fallback);assertSafe(a,source);
  assert.equal(amounts(a.text).length,0);assert.match(a.text,/no tengo verificada/i);assert.deepEqual(a.focus,[]);assert.equal(a.purchasable,false);
 }
});

test('Spanish se in a payment question is not an SE model suffix',async t=>{
 clock(t);const source=fixture(),a=await generateAlex('¿Se puede comprar el Samsung A17 con tarjeta?',source,{},fallback);
 assertSafe(a,source);assert.ok(a.text.includes('$232.38')&&a.text.includes('$299.88'));assert.ok(!/A17 SE|configuraci[oó]n.*no tengo/i.test(a.text));
});

test('The three requested turns progress from offers to card prices and a real media request without a repeated question',async t=>{
 clock(t);const source=fixture();
 for(const id of ['COL001','COL002'])for(const env of [fallback,conservativeModel()]){
  const s=withPersona(source,getProfile(id));let memory={},replies=[];
  for(const input of ['Busco un Samsung A17','¿Cuánto cuesta con tarjeta?','Muéstrame una imagen y compárame las versiones']){const a=await generateAlex(input,s,memory,env);assertSafe(a,s);memory=a.memory;replies.push(a);}
  const [first,card,comparison]=replies;assert.ok(first.text.includes('$185.90')&&first.text.includes('$239.90'));
  assert.ok(card.text.includes('$232.38')&&card.text.includes('$299.88'));assert.ok(!card.text.includes('$185.90')&&!card.text.includes('$239.90'));assert.ok(!card.text.includes('?'));
  assert.equal(comparison.intent,'compare');assert.equal(comparison.media_requested,true);assert.deepEqual(new Set(comparison.images),new Set(['TELF011','TELF012']));
  assert.match(comparison.text,/128 GB/);assert.match(comparison.text,/256 GB/);assert.match(comparison.text,/4 GB RAM f[ií]sica/);assert.match(comparison.text,/8 GB RAM f[ií]sica/);assert.match(comparison.text,/ahorrar|presupuesto|multitarea/);
  assert.ok(!comparison.text.includes('¿Lo usarías'));assert.equal(memory.turn_count,3);assert.deepEqual(new Set(memory.focus),new Set(['TELF011','TELF012']));
 }
});

test('Mentioning the model never overrides a buying deferral or rejected bank',async t=>{
 clock(t);const source=fixture(),memory={focus:['TELF011'],budget:200};
 for(const input of ['Samsung A17: no quiero comprar todavía','Voy a pensar lo del Samsung A17']){
  const a=await generateAlex(input,source,memory,fallback);assertSafe(a,source);assert.equal(a.memory.purchase_deferred,true);assert.equal(a.action,'answer');assert.equal(amounts(a.text).length,0);assert.ok(!a.text.includes('?'));
 }
 const a=await generateAlex('Precios del Samsung A17, pero no tengo tarjeta Pacífico',source,memory,fallback);assertSafe(a,source);assert.ok(a.memory.rejected_banks.includes('pacifico'));assert.ok(!/Pac[ií]fico|sin intereses/.test(a.text));assert.match(a.text,/otra|forma de pago/i);
});
