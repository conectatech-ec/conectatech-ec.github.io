import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {factBook,renderPlan,generateAlex,makePrompt,redact,policy,quickReplies} from '../alex.mjs';
import {MessengerTestInbox} from '../messenger-store.mjs';
import {saveInput,prepareAlex,saveMemory,loadMemory,alexCleanup} from '../alex-store.mjs';
import {sellerAlarm} from '../messenger-seller.mjs';
import baseline from '../generated/catalogo.json' with {type:'json'};
const source={...baseline,fuente_fecha:new Date().toISOString()};
const plan=(extra={})=>({say:'¡Vamos a encontrar algo que te sirva!',facts:['POWE003.cash'],ask:'¿Prefieres retirarla o recibirla en Quito?',focus:['POWE003'],image:'POWE003',intent:'price',action:'answer',remember:{},...extra});
function setup(name='messenger-development'){
 const db=new DatabaseSync(':memory:');const sql={exec(s,...p){const q=db.prepare(s),rows=/^SELECT/i.test(s)?q.all(...p):(q.run(...p),[]);return{toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 const env={PILOT_TOKEN:'synthetic-private-pilot-key-000000000',META_MODE:'development-only',META_PAGE_ACCESS_TOKEN:'fixture',META_TEST_SENDER_IDS:'100000002',FREE_TIER_VERIFIED:'true',ALEX_ENABLED:'true',AI:{run:async()=>({response:JSON.stringify(plan())})}};
 const boxes=new Map();function get(n){if(!boxes.has(n)){const storage=n===name?{sql,setAlarm:async()=>{}}:{sql:(()=>{const d=new DatabaseSync(':memory:');return{exec(s,...p){const q=d.prepare(s),rows=/^SELECT/i.test(s)?q.all(...p):(q.run(...p),[]);return{toArray:()=>rows,one:()=>rows[0]};}};})(),setAlarm:async()=>{}};boxes.set(n,new MessengerTestInbox({storage,id:{name:n}},env));}return boxes.get(n);}
 env.MESSENGER_TEST_INBOX={idFromName:n=>n,get:n=>({fetch:(u,o)=>get(n).fetch(new Request(u,o))})};const box=get(name);
 return{box,env,sql,post:(path,b)=>box.fetch(new Request('https://i'+path,{method:'POST',body:JSON.stringify(b)}))};
}
test('PVP is card price; authorized October plans expire at midnight Ecuador',()=>{
 const f=factBook(source,Date.parse('2026-11-01T04:59:59Z'));assert.match(f['POWE003.card'],new RegExp(source.productos[1].pvp.toFixed(2).replace('.','\\.')));assert.match(f.pacifico,/tres meses sin intereses/);assert.match(f.guayaquil_amex,/tres meses/);assert.match(f.diners,/seis.*doce.*más intereses/);assert.match(f.pichincha,/seis/);
 assert.equal(factBook(source,Date.parse('2026-11-01T05:00:00Z')).plans,undefined);assert.match(f.interest,/deben confirmarse/);
});
test('Only fresh verified facts can supply price, stock, specs and product IDs stay internal',()=>{
 const r=renderPlan(plan(),source);assert.ok(r.text.startsWith('El Philco'));assert.match(r.text,/\$/);assert.ok(!r.text.includes('POWE003'));
 for(const p of [plan({facts:['invented.price']}),plan({focus:['OTHER']}),plan({facts:['POWE003.cash','POWE003.stock','payment']})])assert.throws(()=>renderPlan(p,source));
 for(const p of [plan({say:'Cuesta $1'}),plan({ask:'Cuesta poco. ¿Lo compras?'})]){const safe=renderPlan(p,source);assert.equal(safe.prose_filtered,true);assert.ok(!safe.text.includes('$1'));assert.ok(!safe.text.includes('Cuesta poco'));}
 const stale={...source,fuente_fecha:'2020-01-01'};assert.equal(factBook(stale)['POWE003.cash'],undefined);assert.throws(()=>renderPlan(plan(),stale));assert.equal(factBook({...source,productos:source.productos.map(p=>({...p,stock:0}))})['POWE003.card'],undefined);
});
test('Real binding contract uses JSON generative model and safe fallback consumes no paid path',async()=>{
 let called=0,reserved=0;const env={FREE_TIER_VERIFIED:'true',AI:{run:async(model,args)=>{called++;assert.equal(model,policy.model);assert.equal(args.response_format.type,'json_schema');assert.ok(args.response_format.json_schema.properties.facts.items.enum.includes('POWE003.card'));assert.ok(new TextEncoder().encode(JSON.stringify(args)).length<=policy.max_prompt_bytes);assert.ok(args.max_tokens<=384);return{response:JSON.stringify(plan())};}}};
 const r=await generateAlex('¿Y esa cuánto cuesta?',source,{focus:['POWE003'],history:[]},env,async()=>{reserved++;return true;});assert.equal(r.generative,true);assert.equal(r.memory.history.length,2);assert.equal(called,1);
 const denied=await generateAlex('precio',source,{},env,async()=>false);assert.equal(denied.generative,false);assert.equal(called,1);assert.equal(reserved,1);
 env.AI.run=async()=>{throw Error('quota');};const fallback=await generateAlex('precio',source,{},env);assert.ok(!fallback.text.includes('$'));assert.equal(fallback.generative,false);
});
test('Context reaches model as untrusted preferences, literal budget remembered and one useful question',async()=>{
 const input='Tengo presupuesto 40, pago con tarjeta y estoy en La Carolina';const memory={focus:['POWE003'],history:[{role:'user',text:'Busco batería'}]};let received;
 const env={FREE_TIER_VERIFIED:'true',AI:{run:async(m,a)=>{received=a.messages;return{response:JSON.stringify(plan({remember:{budget:40,payment:'tarjeta',sector:'La Carolina',brand:'inventada'}}))};}}};
 const r=await generateAlex(input,source,memory,env);assert.equal(r.memory.budget,40);assert.equal(r.memory.payment,'tarjeta');assert.equal(r.memory.sector,'La Carolina');assert.equal(r.memory.brand,undefined);assert.ok(received.some(m=>m.content.includes('Contexto no confiable')));assert.ok(makePrompt(input,source,memory).some(m=>m.content==='Busco batería'));assert.ok(r.text.length<=440);assert.equal((r.text.match(/\?/g)||[]).length,1);assert.ok(quickReplies(r).length<=3);
});
test('Private inputs and conversation memory are encrypted, redacted and removed by expiry',async()=>{
 const {box,sql}=setup();await saveInput(box,'job','Mi correo a@ejemplo.ec y teléfono 0991234567');await saveMemory(box,'who',{history:[{role:'user',text:'Busco batería'}],focus:['POWE003']});
 const stored=JSON.stringify(sql.exec('SELECT * FROM alex_inputs').toArray());assert.ok(!stored.includes('0991234567'));assert.ok(!stored.includes('correo'));assert.ok(!JSON.stringify(sql.exec('SELECT * FROM alex_memory').toArray()).includes('Busco'));assert.equal((await loadMemory(box,'who')).focus[0],'POWE003');alexCleanup(box,Date.now()+86400001);assert.equal(sql.exec('SELECT COUNT(*) AS n FROM alex_memory').one().n,0);assert.equal(sql.exec('SELECT COUNT(*) AS n FROM alex_inputs').one().n,0);assert.ok(!redact('cvv: 123').includes('123'));
});
test('One global free quota shared across namespaces stops before provider limit',async()=>{
 const {post}=setup('alex-ai-quota');for(let i=0;i<100;i++)assert.equal((await(await post('/alex/quota',{})).json()).reserved,true);assert.equal((await(await post('/alex/quota',{})).json()).reserved,false);
 const other=setup('messenger-ci');assert.equal((await other.post('/alex/quota',{})).status,409);
});
test('Approved exact image is attached once; changed price uses photo and unverified media is omitted',async()=>{
 const {box,env}=setup();env.AI.run=async()=>({response:JSON.stringify(plan({facts:['MICR27.cash'],focus:['MICR27'],image:'MICR27'}))});
 const row={k:'job',who:'who'};await saveInput(box,row.k,'Quiero el JBL');const deps={refreshCatalog:async()=>source,verifyAssets:async()=>[]};let r=await prepareAlex(box,row,deps);assert.equal(r.messages[1].attachment.payload.elements[0].image_url,source.productos[0].banner);
 await saveMemory(box,row.who,r.result.memory);r=await prepareAlex(box,row,deps);assert.equal(r.messages.length,1);
 await saveMemory(box,row.who,{history:[],shown:[]});r=await prepareAlex(box,row,{...deps,refreshCatalog:async()=>({...source,productos:source.productos.map(p=>({...p,promo:p.promo+1}))})});assert.equal(r.messages[1].attachment.payload.elements[0].image_url,source.productos[0].foto);
 r=await prepareAlex(box,row,{...deps,verifyAssets:async()=>{throw Error('hash');}});assert.equal(r.messages.length,1);
});
test('Handoff retains redacted current context; erase works while human gate is active',async()=>{
 const {box,post,sql}=setup();sql.exec('INSERT INTO seller_settings VALUES(1,1,?,?)',Date.now(),'{}');
 const ingest=async(text,key)=>post('/seller/ingest',{text,key,sender:'100000002',timestamp:Date.now(),skus:[]});
 await ingest('Quiero hablar con una persona','a'.repeat(64));await sellerAlarm(box,{refreshCatalog:async()=>source,verifyAssets:async()=>[],sendMessage:async()=>({state:'accepted',messageId:'human'})});assert.equal(sql.exec('SELECT COUNT(*) AS n FROM alex_opportunities').one().n,1);assert.equal(sql.exec('SELECT COUNT(*) AS n FROM seller_handoffs').one().n,1);
 assert.equal((await(await ingest('olvida esta conversación','b'.repeat(64))).json()).queued,true);await sellerAlarm(box,{refreshCatalog:async()=>source,verifyAssets:async()=>[],sendMessage:async()=>({state:'accepted',messageId:'erase'})});assert.equal(sql.exec('SELECT COUNT(*) AS n FROM alex_memory').one().n,0);assert.equal(sql.exec('SELECT COUNT(*) AS n FROM alex_opportunities').one().n,0);assert.equal(sql.exec('SELECT COUNT(*) AS n FROM seller_handoffs').one().n,0);
});
test('Alex UI and privacy load publicly but chat, memory and opportunity endpoints require auth',async()=>{
 const {default:worker}=await import('../worker.mjs');for(const p of ['/alex','/privacy','/data-deletion'])assert.equal((await worker.fetch(new Request('https://p'+p),{})).status,200);for(const p of ['/alex/chat','/alex/status','/alex/handoffs'])assert.equal((await worker.fetch(new Request('https://p'+p),{})).status,401);
});
test('Alex Graph reply commits context after acceptance and persistent duplicate guard blocks replay',async()=>{
 const {box,post,sql}=setup();sql.exec('INSERT INTO seller_settings VALUES(1,1,?,?)',Date.now(),'{}');
 const payload={text:'¿Cuánto cuesta la batería portátil?',key:'c'.repeat(64),sender:'100000002',timestamp:Date.now(),skus:[]};await post('/seller/ingest',payload);let sends=0;
 await sellerAlarm(box,{refreshCatalog:async()=>source,verifyAssets:async()=>[],sendMessage:async(e,p,m)=>{sends++;if(m.text){assert.ok(m.quick_replies.length<=3);assert.ok(!m.text.includes('POWE003'));}return{state:'accepted',messageId:'accepted-'+sends};}});
 assert.equal(sends,2);assert.equal(sql.exec('SELECT COUNT(*) AS n FROM alex_memory').one().n,1);assert.equal(sql.exec('SELECT sealed FROM seller_jobs').one().sealed,'');assert.equal(sql.exec('SELECT COUNT(*) AS n FROM alex_inputs').one().n,0);assert.equal(JSON.parse(sql.exec('SELECT safe FROM seller_drafts').one().safe).generative,true);
 assert.equal((await(await post('/seller/ingest',payload)).json()).duplicate,true);await sellerAlarm(box);assert.equal(sends,2);
});
test('Uncertain Graph send stops Alex, never commits imaginary sent memory and never retries',async()=>{
 const {box,post,sql}=setup();sql.exec('INSERT INTO seller_settings VALUES(1,1,?,?)',Date.now(),'{}');await post('/seller/ingest',{text:'precio batería portátil',key:'d'.repeat(64),sender:'100000002',timestamp:Date.now(),skus:[]});let sends=0;
 const deps={refreshCatalog:async()=>source,verifyAssets:async()=>[],sendMessage:async()=>{sends++;return{state:'unknown',code:'SEND_RESULT_UNKNOWN'};}};await sellerAlarm(box,deps);await sellerAlarm(box,deps);assert.equal(sends,1);assert.equal(sql.exec('SELECT COUNT(*) AS n FROM alex_memory').one().n,0);assert.equal(sql.exec('SELECT enabled FROM seller_settings').one().enabled,0);
});
