// Real Workers AI over private HTTPS. Synthetic customer script, never fabricated Meta events.
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import baseline from './generated/catalogo.json' with {type:'json'};
import {refreshCatalog} from './live.mjs';
import {factBook} from './alex.mjs';
const base=process.env.PILOT_BASE_URL,headers={Authorization:'Bearer '+process.env.PILOT_TOKEN,'Content-Type':'application/json'},session=crypto.randomUUID();
const report={mode:'real_ai_24_turn_private_https_not_Messenger',passed:false,paid_services_activated:false,messages_sent_to_Messenger:0,tests:[],validation_errors:[],native_choices_used:0};
let last,source;
const skuPrice=(sku,key)=>source.productos.find(p=>p.sku===sku)[key].toFixed(2);
async function get(path){const r=await fetch(base+path,{headers,signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r.json();}
async function ask(message,check=()=>{},payload){
 const r=await fetch(base+'/alex/chat',{method:'POST',headers,body:JSON.stringify({session_id:session,message,quick_reply_payload:payload}),signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);const a=await r.json();
 report.tests.push({turn:report.tests.length+1,input:message,via_native_payload:!!payload,text:a.text,generative:a.generative,error_code:a.error_code,focus:a.focus,facts:a.facts,image:a.image,buttons:a.quick_replies?.map(x=>x.title),memory:a.memory});
 try{assert.equal(a.outbound_enabled,false);assert.ok(a.text.length<=440);assert.ok((a.text.match(/\?/g)||[]).length<=1);assert.ok(!/\b(?:MICR27|POWE003|ADAP005|stock|SKU|referencial)\b|\b\d+\s+unidades?\b/i.test(a.text));
 if(report.tests.length>1)assert.ok(!/\b(?:hola|epa|bienvenid[oa]|soy alex)\b/i.test(a.text),'No repeated greetings beyond the short history');
 const facts=factBook(source);for(const k of a.facts||[])assert.ok(Object.hasOwn(facts,k),'Only approved live facts: '+k);
 for(const amount of a.text.match(/\$\d+(?:\.\d{2})?/g)||[])assert.ok((a.facts||[]).some(k=>facts[k]?.includes(amount)),'Price must come from its current approved fact');
 assert.ok(a.quick_replies.length<=3);for(const b of a.quick_replies){assert.ok(b.title.length<=20);assert.ok(/^ALEX:/.test(b.payload));}
 await check(a);}catch(e){report.validation_errors.push({turn:report.tests.length,error:String(e.message).slice(0,350)});}last=a;return a;
}
const real=a=>assert.equal(a.generative,true,a.error_code||'Actual generative model required');
const cash=sku=>a=>{real(a);assert.deepEqual(a.focus,[sku]);assert.ok(a.text.startsWith('💵'));assert.ok(a.text.includes('$'+skuPrice(sku,'promo')));};
async function choose(action,check){const b=last.quick_replies.find(q=>q.payload==='ALEX:'+action+(action==='choose:POWE003'?'':':'+last.focus[0]));if(!b){report.validation_errors.push({turn:report.tests.length+1,error:'Relevant native choice missing: '+action});const fallback={card:'¿Cuánto cuesta con tarjeta?',photo:'Quiero ver otra vez la foto',buy:'Quiero comprar este producto','choose:POWE003':'Elijo la batería Philco'};return ask(fallback[action],check);}report.native_choices_used++;return ask(b.title,check,b.payload);}
try{
 source=await refreshCatalog(baseline);report.quota_before=await get('/alex/quota');
 // If the existing free budget is nearly due to renew, wait for renewal instead of raising limits.
 const deadline=Math.min(Date.now()+600000,Date.parse(report.quota_before.reset_at)+30000);let quota=report.quota_before;
 while(quota.remaining_calls<22&&Date.now()<deadline){const seconds=Math.ceil((Date.parse(quota.reset_at)-Date.now())/1000);if(seconds>600)break;console.log(JSON.stringify({check:'waiting_for_existing_free_quota_reset',seconds_until_reset:Math.max(0,seconds),paid_fallback:false}));await new Promise(resolve=>setTimeout(resolve,15000));quota=await get('/alex/quota');}
 assert.ok(quota.remaining_calls>=22,'Not enough free reservations for 22 model calls; limits unchanged, no paid fallback');report.quota_at_start=quota;
 for(const p of ['/alex/chat','/alex/quota','/alex/review/queue','/messenger/seller/results'])assert.equal((await fetch(base+p)).status,401);report.private_routes_http=401;
 await ask('¡Hola! Busco una batería portátil para mi celular, mi presupuesto es de cuarenta dólares.',a=>{cash('POWE003')(a);assert.equal(a.memory.budget,40);assert.ok(a.image?.includes('/powe003/'));});
 await choose('card',a=>{real(a);assert.ok(a.text.startsWith('💳'));assert.ok(a.text.includes('$'+skuPrice('POWE003','pvp')));});
 await ask('¿Y al contado cuánto cuesta?',cash('POWE003'));
 await ask('¿Qué capacidad tiene esa batería?',a=>{real(a);assert.match(a.text,/20\.000 mAh/);});
 await ask('¿Qué conexión USB-C tiene?',a=>{real(a);assert.match(a.text,/USB-C/);});
 await choose('photo',a=>{real(a);assert.ok(a.image?.includes('/powe003/'));});
 await ask('Mi presupuesto ahora 35. Prefiero pagar al contado.',a=>{real(a);assert.equal(a.memory.budget,35);assert.equal(a.memory.payment,'contado');});
 await ask('Quiero entrega en Quito. Estoy en La Carolina, Quito.',a=>{real(a);assert.equal(a.memory.delivery,'quito');assert.match(a.memory.sector,/Carolina/i);assert.ok(!/\?[^?]*(?:sector|presupuesto)/i.test(a.text));});
 await choose('buy',a=>{real(a);assert.equal(a.action,'interest');assert.ok(!/reserva confirmada|compra confirmada|pago recibido/i.test(a.text));});
 await ask('¿Me haces una rebajita? 😂',a=>{real(a);assert.match(a.text,/aprobación/);});
 await ask('Cambio de tema: muéstrame el micrófono JBL Quantum Stream.',a=>{real(a);assert.deepEqual(a.focus,['MICR27']);assert.ok(a.image?.includes('/micr27/'));});
 await ask('¿Y ese cuánto cuesta de contado?',cash('MICR27'));
 await ask('¿Qué cambia entre cardioide y omnidireccional?',a=>{real(a);assert.match(a.text,/cardioide/i);assert.match(a.text,/omnidireccional/i);});
 await ask('¿Qué calidad de grabación permite ese micrófono?',a=>{real(a);assert.match(a.text,/96 kHz/);assert.match(a.text,/24 bits/);});
 await ask('Compara los usos del JBL Quantum Stream y la batería Philco. ¿Sirven para lo mismo?',a=>{real(a);assert.deepEqual(new Set(a.focus),new Set(['MICR27','POWE003']));assert.equal(a.action,'compare');assert.match(a.text,/streaming|podcasts/);assert.match(a.text,/energía de reserva/);assert.ok(!a.text.includes('?'));});
 await choose('choose:POWE003',a=>{real(a);assert.deepEqual(a.focus,['POWE003']);assert.equal(a.memory.budget,35);});
 await ask('Ahora necesito el adaptador de enchufe Europa a Latino. ¿Cuánto cuesta de contado?',a=>{cash('ADAP005')(a);assert.ok(a.image?.includes('/adap005/'));});
 await ask('¿Y ese con tarjeta cuánto cuesta?',a=>{real(a);assert.deepEqual(a.focus,['ADAP005']);assert.ok(a.text.startsWith('💳'));assert.ok(a.text.includes('$'+skuPrice('ADAP005','pvp')));assert.equal(a.memory.payment,'contado');});
 await ask('¿Hay disponibilidad de ese adaptador?',a=>{real(a);assert.match(a.text,/confirmamos disponibilidad|disponibilidad.*confirm/i);});
 await ask('Volvamos a la batería Philco: quiero comprarla al contado, con entrega en Quito.',a=>{real(a);assert.deepEqual(a.focus,['POWE003']);assert.equal(a.action,'interest');assert.equal(a.memory.budget,35);assert.equal(a.memory.payment,'contado');assert.equal(a.memory.delivery,'quito');assert.match(a.memory.sector,/Carolina/i);assert.ok(a.memory.turn_count>=20);assert.equal(a.image,null);});
 await ask('¿Cuál es la dirección para retirar en tienda?',a=>{real(a);assert.match(a.text,/6 de Diciembre.*La Niña.*local 3/);assert.ok(a.text.includes('📍'));});
 await ask('¿Qué garantía tiene la batería Philco?',a=>{real(a);assert.match(a.text,/garantía/);assert.match(a.text,/confirma|vendedor|persona/);assert.ok(!/\d+\s*(?:años|meses)/i.test(a.text));});
 await ask('Quiero hablar con una persona',a=>{assert.equal(a.action,'handoff');assert.equal(a.quick_replies.length,0);});
 await ask('olvida esta conversación',a=>{assert.equal(a.action,'erase');assert.equal(a.memory.turns,0);assert.equal(a.memory.budget,undefined);});
 report.quota_after=await get('/alex/quota');report.real_generative_turns=report.tests.filter(x=>x.generative).length;assert.equal(report.real_generative_turns,22);assert.ok(report.native_choices_used>=4);assert.equal(report.validation_errors.length,0,'All 24 turns and native choices must pass; recorded errors are not waived');report.passed=true;
}catch(e){report.failure=String(e.message).slice(0,350);}
const folder=new URL('./generated/fase2/',import.meta.url);await mkdir(folder,{recursive:true});await writeFile(new URL('alex-commercial-24-turn.json',folder),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
