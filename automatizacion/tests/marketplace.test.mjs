import {test} from 'node:test';import assert from 'node:assert/strict';
import {central,sourceToAlex} from '../central-source.mjs';import {adaptSharedHub} from '../shared-hub.mjs';
import {alexBaseline,refreshAlexCatalog,quoteCurrent,catalogMatches} from '../alex-catalog.mjs';import {generateAlex,quickReplies,candidates} from '../alex.mjs';
import {marketplaceContext,marketplacePage} from '../marketplace-pilot.mjs';import {normalizeAlexAction,normalizeEvents} from '../channels.mjs';import worker from '../worker.mjs';
const sha='f37f364dfb30f005bf07f5fb0d7052e8f1dad7e1ae73a9baeacc2ce88aa5eadc',date='2026-10-26',reference='datos-593/corte-comercial-publico-validado.json';
function fixture(){const rows={TELF017:{stock:1,promo_centavos:15990,pvp_centavos:19988},TELF018:{stock:1,promo_centavos:17590,pvp_centavos:21988},TELF019:{stock:0,promo_centavos:20590,pvp_centavos:25738},TELF001:{stock:1,promo_centavos:9890,pvp_centavos:12363},REL046:{stock:1,promo_centavos:3900,pvp_centavos:4485}};return [{fecha_corte:date,origen_sha256:sha,referencia:reference},{fecha_corte:date,sha256_original:sha,fuente:'Synthetic source transport fixture; not production evidence',cantidad_sku_web:5,productos:rows}];}
test('Shared Hub retains original report time, exact cents and per-SKU identity; internal quantities never propagate',()=>{
 const [p,c]=fixture(),d=adaptSharedHub(p,c,central,Date.parse('2026-10-27T22:00:00Z'));
 assert.equal(d.source.generated_at,'2026-10-26T16:15:47.000Z');assert.equal(d.expires_at,'2026-10-27T16:15:47.000Z');
 assert.equal(d.products.find(x=>x.sku==='TELF017').prices.promo_cash_cents,15990);assert.equal(d.products.find(x=>x.sku==='TELF019').availability,'out_of_stock');
 assert.ok(!d.products.some(x=>Object.hasOwn(x,'stock')));
 const b=structuredClone(c);b.productos.TELF017.pvp_centavos=1;const blocked=adaptSharedHub(p,b,central).products.find(x=>x.sku==='TELF017');assert.equal(blocked.availability,'blocked');
 assert.throws(()=>adaptSharedHub({...p,origen_sha256:'a'.repeat(64)},c,central));
 const unknown=adaptSharedHub({...p,origen_sha256:'b'.repeat(64)}, {...c,sha256_original:'b'.repeat(64)},central);assert.equal(unknown.products.find(x=>x.sku==='TELF017').availability,'blocked');
});
test('Future cuts need consistent dates and verified identity rather than silently relabeling prices',()=>{
 const [p,c]=fixture();assert.throws(()=>adaptSharedHub({...p,fecha_corte:'2026-10-27'},{...c,fecha_corte:'2026-10-27'},central));
 assert.throws(()=>adaptSharedHub({...p,fecha_corte:'2099-01-01',origen_sha256:'b'.repeat(64)},{...c,fecha_corte:'2099-01-01',sha256_original:'b'.repeat(64)},central));
 assert.throws(()=>adaptSharedHub(p,{...c,cantidad_sku_web:6},central));
});
test('Complete fallback conversation keeps Redmi variant through payment, delivery and deferred purchase; expired facts never quote',async()=>{
 const [p,c]=fixture(),data=adaptSharedHub(p,c,central),source=await refreshAlexCatalog(alexBaseline,fetch,Date.now(),{input:'Redmi 15C 128 GB'},data);let memory={history:[],focus:[],shown:[]};
 for(const input of ['Busco un Redmi 15C de 128 GB','¿Y de contado?','¿Y con tarjeta?','Pero no tengo tarjeta Pacífico','Tengo Pichincha','Quiero contraentrega en Quito','¿Y envíos nacionales?','No voy a comprar todavía','Quiero continuar después']){
  const a=await generateAlex(input,source,memory,{CATALOG_FIRST:'true'});memory=a.memory;assert.ok(a.focus.includes('TELF017'));assert.ok(!a.text.includes('$'));assert.ok(!/en stock|hay existencias|ya.*reservad/i.test(a.text));assert.ok(!a.text.includes('En octubre, Pacífico'));assert.notEqual(a.action,'handoff');
  for(const q of quickReplies(a)){assert.ok(q.title&&q.title.length<=20);assert.ok(normalizeAlexAction(q.payload));}
 }
 const current=sourceToAlex(source,data,null,Date.parse(data.source.generated_at)+1000),phone=current.productos.find(x=>x.sku==='TELF017');assert.equal(quoteCurrent(current,phone,Date.parse(data.source.generated_at)+1000),true);
});
test('Exact approved photos/specs are linked by SKU; a rejected identity cannot inherit them',async()=>{
 const source=await refreshAlexCatalog();const p=source.productos.find(p=>p.sku==='TELF017');assert.ok(p.foto.endsWith('/TELF017-01.webp'));assert.equal(p.caracteristicas.Almacenamiento,'128 GB');assert.equal(p.caracteristicas['RAM física'],'4 GB');
 const b=structuredClone(central);const target=b.products.find(p=>p.sku==='TELF017');target.source_name='Different product 256 GB';target.variant_gb=[256];
 const wrong=sourceToAlex({productos:[{sku:'TELF017',nombre:'Unknown',caracteristicas:{},foto:null}]},b).productos[0];assert.equal(wrong.foto,null);
});
test('A smartwatch and its charger sharing H4 never become the same requested product',async()=>{
 const s=await refreshAlexCatalog(undefined,fetch,Date.now(),{input:'Busco un Infinix XWATCH H4'});
 assert.deepEqual(candidates('Busco un Infinix XWATCH H4',{},s),['REL046']);
 const all=central.products.map(p=>({sku:p.sku,nombre:p.name,catalog_identity:p.source_name}));
 assert.deepEqual(catalogMatches('Busco un Infinix XWATCH H4',all).map(p=>p.sku),['REL046']);
 assert.deepEqual(catalogMatches('Busco un cable de carga para Infinix H4',all).map(p=>p.sku),['CARG061']);
});
test('Marketplace, Page and WhatsApp have distinct transports; approved but unreleased banners never become deliverable',()=>{
 const reply={focus:['TELF017'],source_sha256:sha,source_fresh:true};
 const contexts=['marketplace_personal','messenger_page','whatsapp_business'].map(c=>marketplaceContext(c,reply));assert.equal(new Set(contexts.map(c=>c.transport)).size,3);
 for(const c of contexts){assert.equal(c.outbound_enabled,false);assert.equal(c.banners[0].visual_approved,true);assert.equal(c.banners[0].delivery_enabled,false);assert.ok(c.banners[0].block_reasons.includes('LIBRARY_DELIVERY_NOT_RELEASED'));assert.ok(!c.native_reply_draft.includes('$'));assert.equal(c.handoff.automatic_chat_history_transfer,false);assert.ok(decodeURIComponent(c.handoff.whatsapp).includes('Redmi 15C 128 GB'));}
 assert.equal(contexts[2].whatsapp_AI_connected,false);assert.throws(()=>marketplaceContext('unofficial_bot',reply));
 assert.ok(marketplaceContext('marketplace_personal',{...reply,source_fresh:false}).banners[0].block_reasons.includes('COMMERCIAL_SOURCE_EXPIRED'));
});
test('Private preview does not accept customer webhooks or expose secrets; existing Page webhook cannot impersonate personal Marketplace',async()=>{
 const r=await worker.fetch(new Request('https://pilot/marketplace/preview',{method:'POST',body:'{}'}),{});assert.equal(r.status,401);
 const html=await marketplacePage().text();assert.ok(!html.includes('localStorage'));assert.ok(!html.includes('drive.google.com'));new Function(html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1]);
 assert.deepEqual(normalizeEvents({object:'user',entry:[{id:'1',messaging:[{message:{mid:'m',text:'Redmi'},sender:{id:'2'}}]}]},{META_PAGE_ID:'1'}),[]);
 const unauthorized=await worker.fetch(new Request('https://pilot/marketplace/preview',{method:'POST',headers:{Authorization:'Bearer synthetic'},body:JSON.stringify({channel:'personal_graph_api',session_id:'synthetic-session-001',message:'Hola'})}),{PILOT_TOKEN:'synthetic'});assert.equal(unauthorized.status,400);
});
