import {test} from 'node:test';
import assert from 'node:assert/strict';
import {alexBaseline,refreshAlexCatalog,quoteCurrent} from '../alex-catalog.mjs';
import {candidates,generateAlex,commercialFallback,factBook,quickReplies,policy} from '../alex.mjs';
import {approvedImage} from '../alex-store.mjs';
// Synthetic confirmed source exercises price mechanics; deployed A17s remain explicitly blocked.
const source={...alexBaseline,fuente_fecha:new Date().toISOString(),productos:alexBaseline.productos.map(p=>({...p}))},now=Date.now();
const feed={fechaCatalogo:new Date(now-2*86400000).toISOString(),productos:source.productos.map(p=>({...p}))};
const fake=data=>async()=>Response.json(data);
const modelPlan={say:'Vamos a encontrar una opción que te encaje.',facts:['TELF011.name'],ask:'¿Qué es lo que más te interesa?',focus:['TELF011'],image:null,intent:'recommend',action:'answer',remember:{}};
test('Samsung A17 variants are explicit, their context survives pronouns, and original pilot remains available',()=>{
 assert.deepEqual(candidates('Hola, busco un celular Samsung'),['TELF011','TELF012']);assert.deepEqual(candidates('Samsung A17 de 128 GB'),['TELF011']);assert.deepEqual(candidates('Samsung A17 de 256 GB'),['TELF012']);assert.deepEqual(candidates('¿Y ese con tarjeta?',{focus:['TELF011']}),['TELF011']);assert.deepEqual(candidates('Philco'),['POWE003']);assert.equal(alexBaseline.productos.length,5);
});
test('Publication age and exact 593 price/stock matches control quotes automatically per SKU',async()=>{
 const csv='sku,stock,promo_contado,pvp_final\n'+source.productos.map(p=>[p.sku,p.stock,p.promo,p.pvp].join(',')).join('\n');
 const fetcher=(data,text=csv)=>async url=>String(url).endsWith('.csv')?new Response(text):Response.json(data);
 let s=await refreshAlexCatalog(source,fetcher(feed),now);assert.equal(quoteCurrent(s,s.productos.find(p=>p.sku==='TELF011'),now),false);assert.equal(factBook(s)['TELF011.cash'],undefined);
 s=await refreshAlexCatalog(source,fetcher({...feed,fechaCatalogo:new Date(now).toISOString()}),now);assert.equal(quoteCurrent(s,s.productos.find(p=>p.sku==='TELF011'),now),true);assert.ok(factBook(s)['TELF011.cash']);
 const changed=csv.replace('TELF011,2,185.9,232.38','TELF011,2,1,2');s=await refreshAlexCatalog(source,fetcher({...feed,fechaCatalogo:new Date(now).toISOString()},changed),now);assert.equal(quoteCurrent(s,s.productos.find(p=>p.sku==='TELF011'),now),false);assert.equal(factBook(s)['TELF011.cash'],undefined);assert.ok(factBook(s)['POWE003.cash']);
 const failed=async url=>String(url).endsWith('.csv')?new Response('',{status:503}):Response.json({...feed,fechaCatalogo:new Date(now).toISOString()});s=await refreshAlexCatalog(source,failed,now);assert.equal(quoteCurrent(s,s.productos[0]),false);
});
test('AI failure and exhausted reservations retain useful verified commercial responses and context',async()=>{
 const env={FREE_TIER_VERIFIED:'true',AI:{run:async()=>{throw Error('provider unavailable');}}};let memory={};
 let a=await generateAlex('Hola, busco un celular Samsung',source,memory,env,async()=>false);assert.equal(a.generative,false);assert.equal(a.action,'answer');assert.match(a.text,/128 GB/);assert.match(a.text,/256 GB/);assert.match(a.text,/¿Cuál/);assert.ok(!/vendedor|persona/.test(a.text));assert.deepEqual(quickReplies(a).slice(0,2).map(q=>q.payload),['ALEX:choose:TELF011','ALEX:choose:TELF012']);memory=a.memory;
 a=await generateAlex('Quiero saber el precio del Samsung A17 de 128 GB al contado',source,memory,env);assert.equal(a.action,'answer');assert.ok(a.text.includes('$185.90'));assert.deepEqual(a.focus,['TELF011']);memory=a.memory;
 a=await generateAlex('¿Y ese con tarjeta cuánto cuesta?',source,memory,env);assert.ok(a.text.includes('$232.38'));assert.deepEqual(a.focus,['TELF011']);assert.equal(a.memory.turn_count,3);
 a=await generateAlex('¿Hacen contraentrega en Quito?',source,a.memory,env);assert.match(a.text,/Contraentrega en Quito/);assert.match(a.text,/cobertura/);assert.ok(!/gratis|hoy|garantiz/i.test(a.text));
 a=await generateAlex('¿Y envíos nacionales?',source,a.memory,env);assert.match(a.text,/costo adicional/);assert.equal(a.action,'answer');
});
test('Expired prices stay blocked while real photos, product facts and delivery policies remain useful',async()=>{
 const stale={...source,fuente_fecha:new Date(now-3*86400000).toISOString()};let a=commercialFallback('Samsung A17 de 128 GB precio',stale,{});assert.ok(!a.text.includes('$'));assert.match(a.text,/requiere confirmación/);assert.equal(a.purchasable,false);
 a=commercialFallback('¿Qué batería tiene el Samsung A17 de 128 GB?',stale,{});assert.match(a.text,/5000 mAh/);assert.ok(!a.text.includes('$'));assert.equal(a.action,'answer');
 const p=source.productos.find(p=>p.sku==='TELF012');await assert.rejects(()=>approvedImage(p,async()=>{}),/NO_VERIFIED_IMAGE/);
 a=commercialFallback('Foto del Samsung A17 de 256 GB',source,{});assert.equal(a.image,null);assert.match(a.text,/fotografía confirmada/);assert.ok(!quickReplies(a).some(q=>q.payload.includes(':photo:')));
});
test('An ordinary commercial inquiry cannot be paused by an unsolicited model handoff',async()=>{
 let called=0;const env={FREE_TIER_VERIFIED:'true',AI:{run:async(_m,args)=>{called++;assert.ok(new TextEncoder().encode(JSON.stringify(args)).length<=policy.max_prompt_bytes);return{response:{...modelPlan,facts:['human'],action:'handoff'}};}}};
 const a=await generateAlex('Samsung A17 de 128 GB',source,{},env);assert.equal(called,1);assert.notEqual(a.action,'handoff');assert.ok(!/pendiente de atención/.test(a.text));
 const h=await generateAlex('Quiero hablar con una persona',source,a.memory,env);assert.equal(h.action,'handoff');assert.equal(called,1);
});

test('Unambiguous catalog answers consume no AI reservation; advice retains the real generative path',async()=>{
 let calls=0,reservations=0;const env={FREE_TIER_VERIFIED:'true',CATALOG_FIRST:'true',AI:{run:async()=>{calls++;return{response:modelPlan};}}};
 const a=await generateAlex('¿Qué precio tiene el Samsung A17 de 128 GB?',source,{},env,async()=>{reservations++;return true;});assert.equal(a.response_mode,'verified_catalog');assert.equal(a.generative,false);assert.ok(a.text.includes('$185.90'));assert.equal(calls,0);assert.equal(reservations,0);
 await generateAlex('Ayúdame a elegir el Samsung A17 de 128 GB para mi mamá',source,{},env,async()=>{reservations++;return true;});assert.equal(calls,1);assert.equal(reservations,1);
});
test('Other published models resolve on demand without rebuilding the catalog or merging variants',async()=>{
 const extra={sku:'TELF999',nombre:'Samsung A16 128GB',promo:100,pvp:125,stock:1,url:'https://conectatech-ec.github.io/productos/telf999-samsung-a16/'};
 const data={fechaCatalogo:new Date(now).toISOString(),productos:[...feed.productos,extra]};const csv='sku,stock,promo_contado,pvp_final\n'+data.productos.map(p=>[p.sku,p.stock,p.promo,p.pvp].join(',')).join('\n');const fetcher=async url=>String(url).endsWith('.csv')?new Response(csv):Response.json(data);
 const s=await refreshAlexCatalog(source,fetcher,now,'Samsung A16 de 128 GB');assert.equal(s.productos.length,6);assert.deepEqual(candidates('Samsung A16 de 128 GB',{},s),['TELF999']);assert.deepEqual(candidates('¿Y ese con tarjeta?',{focus:['TELF999']},s),['TELF999']);assert.equal(factBook(s)['TELF999.card'],'💳 Samsung A16 128GB: $125.00 con tarjeta, más intereses cuando correspondan.');assert.equal(s.productos.find(p=>p.sku==='TELF999').foto,null);
});

test('Availability remains unconfirmed without current matching sources, even when a publication shows stock',async()=>{const s={...source,fuente_fecha:'2020-01-01'};const a=await generateAlex('¿Tienen disponibilidad del Samsung A17 de 128 GB?',s,{}, {CATALOG_FIRST:'true'});assert.equal(a.response_mode,'verified_catalog');assert.match(a.text,/No tengo.*disponibilidad vigentes/);assert.ok(!a.text.includes('$'));assert.equal(a.action,'answer');});
