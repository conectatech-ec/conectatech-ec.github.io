// Browser-script contract tests with synthetic HTTP responses. No provider, account or network calls.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {alexPage} from '../alex-ui.mjs';

class Element {
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.style={};this.attributes={};this.value='';this.hidden=false;this.disabled=false;this._text='';this.listeners={};this.classList={add(){},remove(){},toggle(){}};}
 set textContent(value){this._text=String(value);this.children=[];}
 get textContent(){return this._text+this.children.map(c=>c.textContent||'').join('');}
 get childNodes(){return this.children;}
 append(...nodes){for(let n of nodes){if(typeof n==='string'){const t=new Element();t.textContent=n;n=t;}n.parent=this;this.children.push(n);}}
 appendChild(node){this.append(node);return node;}
 replaceChildren(...nodes){this._text='';this.children=[];this.append(...nodes);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
 setAttribute(k,v){this.attributes[k]=String(v);if(k==='disabled')this.disabled=true;}
 getAttribute(k){return this.attributes[k]??null;}
 removeAttribute(k){delete this.attributes[k];if(k==='disabled')this.disabled=false;}
 addEventListener(k,fn){this.listeners[k]=fn;}
 focus(){} scrollIntoView(){} scrollTo(){}
 querySelectorAll(selector){return descendants(this).filter(n=>selector==='[data-choice]'?Object.hasOwn(n.dataset,'choice'):selector==='button'?n.tagName==='BUTTON':false);}
}
function descendants(el){return el.children.flatMap(c=>[c,...descendants(c)]);}
const answer=(extra={})=>({text:'Respuesta HTTP sintética para verificar la interfaz.',generative:true,response_mode:'generative',image:null,quick_replies:[],source_fresh:true,inventory_cut_date:'2026-11-03',source_sha256:'a'.repeat(64),memory:{turn_count:1},...extra});
const event=()=>({preventDefault(){},key:'Enter',shiftKey:false,isComposing:false});
const settle=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
const registryFixture=()=>({max_collaborators:10,scope:'owner_simulator_only',external_enabled:false,profiles:[
 {id:'COL001',commercial_name:'Rafa Valderrama',gender:'masculine',style:'jocoso,directo'},
 {id:'COL002',commercial_name:'Jessy Fox',gender:'feminine',style:'amable,cercana'}
]});
async function harness({chat=()=>Response.json(answer()),status=200,registry=registryFixture()}={}){
 const response=alexPage(),html=await response.text(),script=html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];assert.ok(script);
 const nodes=new Map();for(const match of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)){const n=new Element(match[1]);n.id=match[2];n.disabled=/\bdisabled\b/.test(match[0]);nodes.set(n.id,n);}
 const calls=[],timers=new Map(),windowEvents={};let uuid=0,timerId=0;
 const document={getElementById:id=>{assert.ok(nodes.has(id),'Unknown DOM id '+id);return nodes.get(id);},createElement:tag=>new Element(tag),createTextNode:text=>{const n=new Element();n.textContent=text;return n;},querySelectorAll:()=>[],addEventListener(){}};
 const fetch=async(url,options={})=>{
  const call={url,options,body:options.body?JSON.parse(options.body):null};calls.push(call);
  if(url==='/alex/status')return Response.json({name:'Alex, tu asesor de CONECTATECH',generative:true,free_only:true,memory_hours:24},{status});
  if(url==='/alex/collaborators')return Response.json(registry);
  if(url==='/alex/quota')return Response.json({remaining_calls:20,reset_at:'2026-11-04T00:00:00Z'});
  if(url==='/alex/chat')return /olvida.*conversaci[oó]n/i.test(call.body.message)?Response.json(answer({action:'erase'})):chat(call);
  throw Error('Unapproved request in UI test');
 };
 const context=vm.createContext({document,fetch,Response,Request,Headers,URL,AbortController,DOMException,Date,Intl,Promise,console,
  crypto:{randomUUID:()=>`01234567-89ab-4cde-8000-${String(++uuid).padStart(12,'0')}`},
  setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
  requestAnimationFrame:fn=>fn(),window:{addEventListener:(name,fn)=>windowEvents[name]=fn},location:{origin:'https://pilot.test'}});
 vm.runInContext(script,context,{timeout:1000});
 async function click(id){const n=nodes.get(id);assert.ok(n);if(!n.disabled)await n.onclick?.(event());await settle();}
 async function connect(){nodes.get('key').value='synthetic-private-operator-key-for-browser-tests';await click('connect');}
 async function switchProfile(id){nodes.get('collaborator').value=id;await nodes.get('collaborator').onchange?.(event());await settle();}
 async function send(text){nodes.get('message').value=text;await nodes.get('form').onsubmit?.(event());await settle();}
 return {response,html,nodes,calls,timers,windowEvents,click,connect,send,switchProfile,text:()=>[...nodes.values()].map(n=>n.textContent).join('\n')};
}

test('The HTML is a protected same-origin client, without credentials, local persistence or executable reply markup',async()=>{
 const h=await harness();assert.match(h.response.headers.get('content-security-policy'),/connect-src 'self'/);assert.match(h.response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 assert.equal(h.response.headers.get('cache-control'),'no-store');assert.ok(!/localStorage|sessionStorage|document\.cookie|indexedDB/.test(h.html));
 assert.ok(!h.html.includes('synthetic-private-operator-key'));assert.ok(!/\.innerHTML\s*=/.test(h.html));assert.ok(h.nodes.has('reset'));assert.ok(h.nodes.has('collaborator'));
 assert.ok(!/Rafa Valderrama|Jessy Fox/.test(h.html),'Identity options must come from the authenticated registry, not public HTML');
});
test('Connection validates the private endpoint, clears the visible key and uses one session for actual chat requests',async()=>{
 const h=await harness();await h.connect();assert.ok(h.calls.some(c=>c.url==='/alex/status'));assert.equal(h.nodes.get('key').value,'');
 assert.ok(h.calls.findIndex(c=>c.url==='/alex/status')<h.calls.findIndex(c=>c.url==='/alex/collaborators'));assert.match(h.nodes.get('advisor-title').textContent,/Rafa Valderrama/);
 await h.send('Busco un Redmi 15C de 128 GB');await h.send('¿Y con tarjeta?');
 const chats=h.calls.filter(c=>c.url==='/alex/chat');assert.equal(chats.length,2);assert.equal(chats[0].body.session_id,chats[1].body.session_id);
 for(const c of chats){assert.notEqual(c.body.catalog_only,true,'Ordinary messages must use the real Alex mode');assert.equal(c.body.collaborator_id,'COL001');assert.equal(c.body.channel,'simulator');assert.ok(!JSON.stringify(c.body).includes('synthetic-private-operator-key'));assert.equal(c.options.headers.Authorization,'Bearer synthetic-private-operator-key-for-browser-tests');}
 assert.ok(h.calls.every(c=>c.url.startsWith('/')&&!c.url.includes('?')),'Credentials never enter a URL');
 assert.match(h.nodes.get('chat').textContent,/Respuesta HTTP sintética/);
});
test('New conversation erases the current cloud context without spending AI and uses a different session afterward',async()=>{
 const h=await harness();await h.connect();await h.send('Primera conversación');
 const first=h.calls.find(c=>c.url==='/alex/chat').body.session_id;await h.click('reset');
 const erase=h.calls.filter(c=>c.url==='/alex/chat').find(c=>/olvida.*conversaci[oó]n/i.test(c.body.message));
 assert.ok(erase);assert.equal(erase.body.session_id,first);assert.equal(erase.body.catalog_only,true);assert.ok(!h.nodes.get('chat').textContent.includes('Primera conversación'));
 assert.equal(erase.body.collaborator_id,'COL001');assert.equal(erase.body.channel,'simulator');
 await h.send('Segunda conversación');const last=h.calls.filter(c=>c.url==='/alex/chat').at(-1);assert.notEqual(last.body.session_id,first);
});
test('Owner-authorized profiles retain independent RAM histories and sessions, and reset only erases the active profile',async()=>{
 const h=await harness({chat:c=>Response.json(answer({text:'Respuesta sintética '+c.body.collaborator_id+': '+c.body.message}))});
 await h.connect();await h.send('Consulta de Rafa');const rafaFirst=h.calls.filter(c=>c.url==='/alex/chat').at(-1).body;
 await h.switchProfile('COL002');assert.match(h.nodes.get('advisor-title').textContent,/Jessy Fox/);assert.ok(!h.nodes.get('chat').textContent.includes('Consulta de Rafa'));
 await h.send('Consulta de Jessy');const jessyFirst=h.calls.filter(c=>c.url==='/alex/chat').at(-1).body;
 assert.equal(jessyFirst.collaborator_id,'COL002');assert.equal(jessyFirst.channel,'simulator');assert.notEqual(jessyFirst.session_id,rafaFirst.session_id);
 await h.switchProfile('COL001');assert.match(h.nodes.get('chat').textContent,/Consulta de Rafa/);assert.ok(!h.nodes.get('chat').textContent.includes('Consulta de Jessy'));
 await h.send('Seguimiento de Rafa');assert.equal(h.calls.filter(c=>c.url==='/alex/chat').at(-1).body.session_id,rafaFirst.session_id);
 await h.click('reset');assert.ok(!h.nodes.get('chat').textContent.includes('Consulta de Rafa'));
 const erase=h.calls.filter(c=>c.url==='/alex/chat'&&/olvida.*conversaci[oó]n/i.test(c.body.message));assert.equal(erase.length,1);assert.equal(erase[0].body.collaborator_id,'COL001');assert.equal(erase[0].body.session_id,rafaFirst.session_id);
 await h.send('Nueva consulta de Rafa');assert.notEqual(h.calls.filter(c=>c.url==='/alex/chat').at(-1).body.session_id,rafaFirst.session_id);
 await h.switchProfile('COL002');assert.match(h.nodes.get('chat').textContent,/Consulta de Jessy/);assert.ok(!h.nodes.get('chat').textContent.includes('Nueva consulta de Rafa'));
 await h.send('Seguimiento de Jessy');assert.equal(h.calls.filter(c=>c.url==='/alex/chat').at(-1).body.session_id,jessyFirst.session_id);
});
test('Switching profiles aborts the pending transport and prevents a late reply from leaking into either other profile',async()=>{
 let release;const deferred=new Promise(resolve=>release=resolve);
 const h=await harness({chat:c=>c.body.message==='Consulta pendiente de Rafa'?deferred:Response.json(answer({text:'RESPUESTA_DE_JESSY'}))});
 await h.connect();const pending=h.send('Consulta pendiente de Rafa');await settle();const oldRequest=h.calls.find(c=>c.url==='/alex/chat');
 await h.switchProfile('COL002');assert.equal(oldRequest.options.signal.aborted,true);await h.send('Consulta de Jessy');
 release(Response.json(answer({text:'RESPUESTA_TARDIA_DE_RAFA'})));await pending;await settle();
 assert.match(h.nodes.get('chat').textContent,/RESPUESTA_DE_JESSY/);assert.ok(!h.nodes.get('chat').textContent.includes('RESPUESTA_TARDIA_DE_RAFA'));
 await h.switchProfile('COL001');assert.match(h.nodes.get('chat').textContent,/Consulta pendiente de Rafa/);assert.ok(!h.nodes.get('chat').textContent.includes('RESPUESTA_TARDIA_DE_RAFA'));assert.ok(!h.nodes.get('chat').textContent.includes('RESPUESTA_DE_JESSY'));
 assert.match(h.nodes.get('status').textContent,/no se confirm[oó]|no se reenvi[oó]/i);
 assert.equal(h.calls.filter(c=>c.url==='/alex/chat'&&c.body.message==='Consulta pendiente de Rafa').length,1);
});
test('A registry that enables external operation or invents duplicate profiles does not authorize a conversation',async()=>{
 const variants=[{...registryFixture(),external_enabled:true},{...registryFixture(),scope:'public_customers'},
  {...registryFixture(),profiles:[registryFixture().profiles[0],registryFixture().profiles[0]]},{...registryFixture(),max_collaborators:11}];
 for(const registry of variants){const h=await harness({registry});await h.connect();await h.send('No debe salir');assert.equal(h.calls.filter(c=>c.url==='/alex/chat').length,0);assert.match(h.nodes.get('error').textContent,/perfiles.*autorizados/i);}
 const h=await harness();await h.connect();await h.switchProfile('COL999');await h.send('Perfil no registrado');
 assert.equal(h.calls.filter(c=>c.url==='/alex/chat').at(-1).body.collaborator_id,'COL001','An arbitrary selector value must not grant a new collaborator');
});
test('Authentication and service failures become readable errors and never display raw private bodies',async()=>{
 const denied=await harness({status:401});await denied.connect();assert.match(denied.text(),/clave|acceso|sesi[oó]n/i);await denied.send('Hola');assert.equal(denied.calls.filter(c=>c.url==='/alex/chat').length,0);
 for(const code of [401,429,503]){
  const h=await harness({chat:()=>Response.json({error:'PRIVATE_RESPONSE_SHOULD_NOT_BE_PRINTED'},{status:code})});await h.connect();await h.send('Hola');
  assert.ok(h.nodes.get('error').textContent||h.nodes.get('mode').textContent);assert.ok(!h.text().includes('PRIVATE_RESPONSE_SHOULD_NOT_BE_PRINTED'));assert.ok(!/TypeError|stack trace|undefined/.test(h.nodes.get('error').textContent));
 }
});
test('Concurrent sends are bounded, and a response arriving after logout cannot restore the old conversation',async()=>{
 let release;const deferred=new Promise(resolve=>release=resolve),h=await harness({chat:()=>deferred});await h.connect();
 const pending=h.send('Mensaje pendiente');await settle();const concurrent=h.send('No duplicar');await settle();assert.equal(h.calls.filter(c=>c.url==='/alex/chat').length,1);
 await h.click('leave');release(Response.json(answer({text:'OLD_RESPONSE_AFTER_LOGOUT'})));await Promise.all([pending,concurrent]);await settle();
 assert.ok(!h.nodes.get('chat').textContent.includes('OLD_RESPONSE_AFTER_LOGOUT'));assert.ok(!h.nodes.get('chat').textContent.includes('Mensaje pendiente'));assert.equal(h.nodes.get('key').value,'');
});
test('Only approved catalogue image origins render, and old quick replies do not remain active',async()=>{
 let count=0;const h=await harness({chat:()=>Response.json(answer(++count===1?{image:'https://conectatech-ec.github.io/imagenes/TELF017-01.webp',quick_replies:[{title:'Ver fotografía',payload:'ALEX:photo:TELF017'}]}:{image:'https://conectatech-ec.github.io.evil.test/imagenes/incorrect.png'}))});
 await h.connect();await h.send('Primera');let images=descendants(h.nodes.get('chat')).filter(n=>n.tagName==='IMG');assert.equal(images.length,1);assert.match(images[0].src,/^https:\/\/conectatech-ec\.github\.io\/imagenes\//);
 await h.send('Segunda');images=descendants(h.nodes.get('chat')).filter(n=>n.tagName==='IMG');assert.equal(images.length,1,'An unapproved origin must not insert a new image');
 assert.equal(h.nodes.get('chat').querySelectorAll('[data-choice]').filter(n=>!n.disabled).length,0,'Old choices cannot remain active');
});
