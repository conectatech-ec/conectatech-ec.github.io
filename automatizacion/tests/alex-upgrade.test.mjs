import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {MessengerTestInbox} from '../messenger-store.mjs';
import {sellerAlarm,sellerNext} from '../messenger-seller.mjs';
import {statedBudget,mergePreferences,redundantQuestion,asksHuman} from '../alex-context.mjs';
import {generateAlex,renderPlan,candidates,quickReplies} from '../alex.mjs';
import {reviewPage} from '../alex-review.mjs';
import {normalizeEvents} from '../channels.mjs';
import baseline from '../generated/catalogo.json' with {type:'json'};
const source={...baseline,fuente_fecha:new Date().toISOString()},sender='100000002';
const plan=()=>({say:'¡Vamos a encontrar algo que te sirva!',facts:['POWE003.cash'],ask:'¿Prefieres retirarla o recibirla en Quito?',focus:['POWE003'],image:'POWE003',intent:'price',action:'answer',remember:{}});
function setup(name='messenger-development'){
 const boxes=new Map(),env={PILOT_TOKEN:'private-test-pilot-key-00000000000000',META_MODE:'development-only',META_PAGE_ACCESS_TOKEN:'fixture',META_TEST_SENDER_IDS:sender,FREE_TIER_VERIFIED:'true',ALEX_ENABLED:'true'};let ai=0,sends=0,serial=0;
 env.AI={run:async()=>{ai++;return{response:JSON.stringify(plan())};}};
 const dbbox=n=>{if(!boxes.has(n)){const db=new DatabaseSync(':memory:'),sql={exec(s,...p){const q=db.prepare(s),rows=/^SELECT/i.test(s)?q.all(...p):(q.run(...p),[]);return{toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};boxes.set(n,new MessengerTestInbox({id:{name:n},storage:{sql,setAlarm:async()=>{}}},env));}return boxes.get(n);};
 env.MESSENGER_TEST_INBOX={idFromName:n=>n,get:n=>({fetch:(u,o)=>dbbox(n).fetch(new Request(u,o))})};const box=dbbox(name),q=box.sql;
 q.exec('INSERT INTO seller_settings VALUES(1,1,?,?)',Date.now(),'{}');
 const post=async(path,b)=>box.fetch(new Request('https://i'+path,{method:'POST',body:JSON.stringify(b)}));
 const get=async path=>(await box.fetch(new Request('https://i'+path))).json();
 const ingest=async(text='Busco una batería portátil')=>{const key=(++serial).toString(16).padStart(64,'0');await post('/seller/ingest',{key,text,sender,timestamp:Date.now(),skus:[]});return key;};
 const deps={refreshCatalog:async()=>source,verifyAssets:async()=>[],sendMessage:async()=>({state:'accepted',http:200,messageId:'accepted-'+(++sends)})};
 const pending=async()=>{await post('/alex/review/mode',{required:true});const key=await ingest();await sellerAlarm(box,deps);return{key,draft:(await get('/alex/review/queue')).drafts[0]};};
 return{box,env,q,post,get,ingest,deps,pending,ai:()=>ai,sends:()=>sends};
}
test('Budget is anchored to user text including words, decimals and corrections, not substrings or old model choices',()=>{
 for(const [text,n]of [['presupuesto 140',140],['Mi presupuesto es de cuarenta dólares',40],['Puedo gastar 40,50',40.5],['presupuesto 40, pago con tarjeta',40],['Presupuesto 40; mi presupuesto ahora 30',30]])assert.equal(statedBudget(text),n);
 assert.equal(statedBudget('El teléfono 0991234567'),null);const m=mergePreferences('Mi presupuesto ahora 30, mejor al contado',{budget:40,payment:'tarjeta'},{budget:40,payment:'tarjeta'});assert.equal(m.budget,30);assert.equal(m.payment,'contado');
 assert.equal(mergePreferences('¿Ese cuánto cuesta?',{sector:'La Carolina'},{history:[{role:'user',text:'La Carolina'}]}).sector,undefined);
 assert.equal(mergePreferences('¿Y con tarjeta cuánto cuesta?',{payment:'tarjeta'},{payment:'contado'}).payment,'contado');
 assert.equal(mergePreferences('Busco batería para mi celular',{sector:'celular',brand:'celular'},{}).sector,undefined);
 assert.equal(mergePreferences('Estoy en Quito',{sector:'Quito'},{}).sector,undefined);
 assert.equal(mergePreferences('Estoy en La Carolina, Quito',{sector:'La Carolina'},{}).sector,'La Carolina');
 assert.equal(mergePreferences('La Carolina',{sector:'La Carolina'},{history:[{role:'assistant',text:'¿En qué sector estás?'}]}).sector,'La Carolina');
 assert.equal(mergePreferences('Quiero entrega en Quito.',{},{}).delivery,'quito');
 assert.equal(mergePreferences('Mejor retiro en tienda.',{delivery:'quito'},{delivery:'quito'}).delivery,'retiro');
 assert.equal(mergePreferences('¿Entregan en Quito?',{delivery:'quito'},{}).delivery,undefined);
});
test('A negated human request does not pause the conversation; explicit requests and sensitive claims still transfer',async()=>{
 assert.equal(asksHuman('No quiero hablar con una persona, sigamos aquí'),false);assert.equal(asksHuman('No quiero un bot; pásame una persona'),true);assert.equal(asksHuman('No quiero una persona, pero tengo un reclamo'),true);
 const env={FREE_TIER_VERIFIED:'true',AI:{run:async()=>({response:JSON.stringify({...plan(),say:'',facts:['human'],action:'handoff'})})}};
 const r=await generateAlex('No quiero una persona todavía, sigo aquí',source,{focus:['POWE003']},env);assert.equal(r.action,'answer');assert.equal(r.generative,true);assert.ok(!r.text.includes('pendiente de atención'));
});
test('Already known preferences remove repeated questions and optional prose never forces a long factual answer to fail',()=>{
 for(const [ask,m]of [['¿Cuál es tu presupuesto?',{budget:40}],['¿En qué sector estás?',{sector:'La Carolina'}],['¿Prefieres contado o tarjeta?',{payment:'tarjeta'}],['¿Qué banco usarías?',{bank:'pichincha'}],['¿Prefieres retirarla o recibirla en Quito?',{delivery:'quito'}]]){assert.equal(redundantQuestion(ask,m),true);assert.equal(renderPlan({...plan(),ask},source,m).text.includes('?'),false);}
 const r=renderPlan({...plan(),say:'',facts:['plans','payment'],ask:'¿Quieres que revisemos juntos las opciones que podríamos considerar para decidir qué alternativa te conviene según lo que buscas hoy?'},source);assert.ok(r.text.length<=440);assert.match(r.text,/Pacífico/);assert.match(r.text,/Aceptamos/);
});
test('Named product wins over an ambiguous feature and native quick replies preserve exact product context',()=>{
 assert.deepEqual(candidates('¿Qué batería tiene el JBL Quantum Stream?'),['MICR27']);assert.deepEqual(candidates('Compara Philco y JBL'),['MICR27','POWE003']);
 const buttons=quickReplies({...plan(),intent:'photo'});assert.ok(buttons.every(b=>b.title.length<=20));assert.ok(buttons.some(b=>b.payload==='ALEX:cash:POWE003'));
 const body={object:'page',entry:[{id:'100000001',messaging:[{sender:{id:sender},recipient:{id:'100000001'},timestamp:Date.now(),message:{mid:'fixture-native',text:'Precio de contado',quick_reply:{payload:'ALEX:cash:POWE003'}}}]}]};assert.match(normalizeEvents(body,{META_PAGE_ID:'100000001'})[0].text,/contado.*POWE003/);
});
test('Quota status is private, shows remaining reservations and never consumes an AI call',async()=>{
 const {post,get,ai}=setup('alex-ai-quota');assert.equal((await get('/alex/quota/status')).remaining_calls,100);await post('/alex/quota',{});const state=await get('/alex/quota/status');assert.equal(state.remaining_calls,99);assert.equal(state.estimation_only_not_provider_meter,true);assert.equal(ai(),0);
 const {post:outside}=setup();assert.equal((await outside('/alex/quota',{})).status,409);
});
test('A real prepared reply stays encrypted and unsent until exact human approval; approval never reruns AI',async()=>{
 const f=setup(),{key,draft}=await f.pending();assert.equal(f.sends(),0);assert.equal(f.ai(),1);assert.equal(f.q.exec('SELECT status FROM seller_jobs WHERE k=?',key).one().status,'awaiting_review');assert.equal(f.q.exec('SELECT COUNT(*) AS n FROM alex_memory').one().n,0);
 const stored=JSON.stringify(f.q.exec('SELECT * FROM alex_reviews').toArray());assert.ok(!stored.includes('Busco'));assert.ok(!stored.includes(sender));assert.ok(draft.messages[0].text.includes('$'));
 const command={job:key,digest:draft.digest,decision:'approve'};assert.equal((await f.post('/alex/review/decision',command)).status,200);assert.equal((await f.post('/alex/review/decision',command)).status,409);
 await sellerAlarm(f.box,f.deps);assert.equal(f.sends(),2);assert.equal(f.ai(),1);assert.equal(f.q.exec('SELECT COUNT(*) AS n FROM alex_memory').one().n,1);assert.equal(f.q.exec('SELECT sealed FROM alex_reviews').one().sealed,'');assert.equal(JSON.parse(f.q.exec('SELECT safe FROM seller_drafts').one().safe).human_approved,true);await sellerAlarm(f.box,f.deps);assert.equal(f.sends(),2);
});
test('Rejection, wrong digest, expiry and CI scope cannot send or approve a reply',async()=>{
 const f=setup(),{key,draft}=await f.pending();assert.equal((await f.post('/alex/review/decision',{job:key,digest:'0'.repeat(64),decision:'approve'})).status,409);
 await f.post('/alex/review/decision',{job:key,digest:draft.digest,decision:'reject'});await sellerAlarm(f.box,f.deps);assert.equal(f.sends(),0);assert.equal(f.q.exec('SELECT sealed FROM alex_reviews').one().sealed,'');
 const expired=setup(),p=await expired.pending();expired.q.exec('UPDATE alex_reviews SET expires=?',Date.now()-1);assert.equal((await expired.post('/alex/review/decision',{job:p.key,digest:p.draft.digest,decision:'approve'})).status,409);assert.equal(expired.q.exec('SELECT COUNT(*) AS n FROM alex_inputs').one().n,0);
 assert.equal((await setup('messenger-ci').post('/alex/review/mode',{required:true})).status,409);
});
test('A changed quote blocks the send, and regenerating still needs approval even with automatic mode selected',async()=>{
 const f=setup(),{key,draft}=await f.pending();await f.post('/alex/review/decision',{job:key,digest:draft.digest,decision:'approve'});
 const changed={...source,productos:source.productos.map(p=>({...p,promo:p.promo+1}))},deps={...f.deps,refreshCatalog:async()=>changed};await sellerAlarm(f.box,deps);assert.equal(f.sends(),0);assert.equal(f.q.exec('SELECT status FROM seller_jobs').one().status,'review_invalidated');
 await f.post('/alex/review/mode',{required:false});assert.equal((await f.post('/alex/review/regenerate',{job:key})).status,200);await sellerAlarm(f.box,deps);assert.equal(f.sends(),0);const fresh=(await f.get('/alex/review/queue')).drafts[0];assert.notEqual(fresh.digest,draft.digest);assert.equal(fresh.status,'awaiting_review');
});
test('The operator stop defeats approval, and later messages wait without busy alarms for the earlier review',async()=>{
 const f=setup(),{key,draft}=await f.pending();await f.ingest('¿Y con tarjeta cuánto cuesta?');await sellerAlarm(f.box,f.deps);assert.equal(f.ai(),1);assert.ok(sellerNext(f.box)>Date.now()+60000);
 await f.post('/seller/disable',{});assert.equal((await f.post('/alex/review/decision',{job:key,digest:draft.digest,decision:'approve'})).status,409);await sellerAlarm(f.box,f.deps);assert.equal(f.sends(),0);
});
test('Erasing memory or asking for a person revokes pending commercial approval immediately',async()=>{
 for(const text of ['olvida esta conversación','Quiero hablar con una persona']){
  const f=setup(),{key,draft}=await f.pending();await f.ingest(text);await sellerAlarm(f.box,f.deps);assert.equal(f.sends(),1);assert.equal(f.q.exec('SELECT decision FROM alex_reviews').one().decision,'revoked');assert.equal(f.q.exec('SELECT sealed FROM alex_reviews').one().sealed,'');assert.equal((await f.post('/alex/review/decision',{job:key,digest:draft.digest,decision:'approve'})).status,409);
 }
});
test('Review expiration, messaging window and recipient revocation prevent a delayed send',async()=>{
 const f=setup(),{key,draft}=await f.pending();f.q.exec('UPDATE seller_jobs SET inbound=?',Date.now()-86400001);assert.equal((await f.post('/alex/review/decision',{job:key,digest:draft.digest,decision:'approve'})).status,409);
 const revoked=setup(),p=await revoked.pending();await revoked.post('/alex/review/decision',{job:p.key,digest:p.draft.digest,decision:'approve'});revoked.env.META_TEST_SENDER_IDS='';await sellerAlarm(revoked.box,revoked.deps);assert.equal(revoked.sends(),0);assert.equal(revoked.q.exec('SELECT status FROM seller_jobs').one().status,'review_invalidated');
});
test('Review browser code parses and private review routes reject absent credentials',async()=>{
 const page=reviewPage(),html=await page.text();new Function(html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1]);assert.ok(page.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
 const {default:worker}=await import('../worker.mjs');for(const p of ['/alex/quota','/alex/review/queue','/alex/review/mode','/alex/review/decision','/alex/review/regenerate'])assert.equal((await worker.fetch(new Request('https://p'+p),{})).status,401);
});
