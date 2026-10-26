'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {familiesFromHTML,classify,planFromFeed}=require('./categorias-meta-web.cjs');
const {Graph,reconcile,checkRemote,synchronize}=require('./sincronizar-conjuntos-meta.cjs');
const products=[{sku:'TELF001',category:'Telefonos'},{sku:'LUZ001',category:'Audifonos',categoriaComercial:'Fotografía'},{sku:'AUDI001',category:'Audifonos'},{sku:'CERO001',category:'Audifonos'},{sku:'NOVER001',category:'Audifonos'}];
const content=Object.fromEntries(products.filter(p=>p.sku!=='NOVER001').map(p=>[p.sku,{comercialVerificado:true}]));
const families=familiesFromHTML('const categoryFamilies={"Telefonos":"Celulares y Smartphones","Audifonos":"Audio"};');
const classification=classify(products,content,families);
assert.equal(classification.bySKU.get('LUZ001').familia_web,'Fotografía');
assert.equal(classification.bySKU.get('NOVER001').label,'');
assert.throws(()=>classify([products[0],products[0]],content,families),/duplicado/);
const meta=products.map(p=>({id:p.sku,custom_label_0:classification.bySKU.get(p.sku).label,availability:p.sku==='CERO001'?'out of stock':'in stock'}));
const plan=planFromFeed(classification,meta,{fecha_corte:'2026-10-22',origen_sha256:'a'.repeat(64)});
assert.equal(plan.groups.flatMap(g=>g.sku).length,3);assert.equal(plan.groups.find(g=>g.family==='Audio').sku.length,1);
assert.deepEqual(plan.groups.find(g=>g.family==='Audio').filter,{and:[{custom_label_0:{eq:'ct-web:audio'}},{availability:{eq:'in stock'}}]});
const catalog='1036301566100990';
const existingPhone={id:'200',name:'CONECTATECH | CELULARES',filter:{product_type:{i_contains:'celulares'}}};
function fake({duplicate=false,badImport=false,badMembers=false,pendingAtStart=false,unnamedUpload=false}={}){
 const sets=[{id:'999',name:'All Products',filter:{}},structuredClone(existingPhone)];
 if(duplicate)sets.push({...existingPhone,id:'201'});
 const posts=[],remote=meta.map(p=>({id:'9'+p.id,retailer_id:p.id,custom_label_0:p.custom_label_0,availability:p.availability}));
 let uploaded=pendingAtStart?{id:'101',filename:unnamedUpload?'file.csv':'ct-'+crypto.createHash('sha256').update('data').digest('hex')+'.csv',error_count:0,num_invalid_items:0,num_persisted_items:meta.length}:null,seq=300;
 return {posts,sets,async request(method,path,params={},file){
  if(method==='POST')posts.push({path,params});
  if(path===catalog&&method==='GET')return {id:catalog,name:'CONECTATECH | Catálogo Maestro'};
  if(path==='100/uploads'&&method==='POST'){uploaded={id:'101',filename:file.name,end_time:'done',error_count:badImport?1:0,num_invalid_items:0,num_persisted_items:meta.length};return {id:'101'};}
  if(path==='101'&&method==='GET'){if(pendingAtStart)uploaded.end_time='done';return uploaded;}
  if(path===catalog+'/product_sets'&&method==='POST'){const s={id:String(seq++),...structuredClone(params)};sets.push(s);return {id:s.id};}
  const set=sets.find(s=>s.id===path);if(!set)throw Error('Petición inesperada '+path);
  if(method==='POST'){Object.assign(set,structuredClone(params));return {success:true};}
  return structuredClone(set);
 },async list(path){
  if(path===catalog+'/product_feeds')return [{id:'100',schedule:{url:'https://conectatech-ec.github.io/exportaciones/meta-catalogo-piloto.csv'}}];
  if(path==='100/uploads')return uploaded?[uploaded]:[];
  if(path===catalog+'/product_sets')return structuredClone(sets);
  if(path===catalog+'/products')return structuredClone(remote);
  const id=path.split('/')[0],s=sets.find(s=>s.id===id);if(!s)throw Error('Lista inesperada '+path);
  if(badMembers)return [];
  const label=s.filter.and[0].custom_label_0.eq;
  return remote.filter(p=>p.custom_label_0===label&&p.availability==='in stock');
 }};
}
(async()=>{
 const api=fake();let r=await synchronize({plan,csv:'data',api,wait:async()=>{},attempts:1});
 assert.equal(r.estado,'META_SINCRONIZADO');assert.equal(r.colecciones_whatsapp_verificadas,false);
 assert.equal(r.conjuntos.find(g=>g.familia==='Celulares y Smartphones').id,'200');
 assert.equal(api.sets.find(s=>s.id==='200').name,'CONECTATECH | CELULARES');
 assert.equal(api.posts.filter(p=>p.path===catalog+'/product_sets').length,2);
 assert(!api.posts.some(p=>p.path==='999'));assert(!api.posts.some(p=>/\/(ads|messages|phone_numbers)(\/|$)/.test(p.path)));
 const count=api.posts.length;await synchronize({plan,csv:'data',api,wait:async()=>{},attempts:1});assert.equal(api.posts.length,count,'Reejecutar no crea duplicados ni reimporta el mismo hash');
 const pending=fake({pendingAtStart:true});await synchronize({plan,csv:'data',api:pending,wait:async()=>{},attempts:1});assert(!pending.posts.some(p=>p.path==='100/uploads'),'Reutilizar importación en curso sin enviar otro archivo');
 const unnamed=fake({pendingAtStart:true,unnamedUpload:true});await synchronize({plan,csv:'data',api:unnamed,checkpoint:{catalog_id:catalog,feed_id:'100',feed_sha256:crypto.createHash('sha256').update('data').digest('hex'),upload_id:'101'},wait:async()=>{},attempts:1});assert(!unnamed.posts.some(p=>p.path==='100/uploads'),'El checkpoint evita duplicar una carga cuyo nombre cambió en Meta');
 const dup=fake({duplicate:true});await assert.rejects(()=>synchronize({plan,csv:'data',api:dup,attempts:1}),/DUPLICADOS/);assert.equal(dup.posts.length,0);
 const bad=fake({badImport:true});await assert.rejects(()=>synchronize({plan,csv:'data',api:bad,attempts:1}),/IMPORTACION_CON_ERRORES/);assert.equal(bad.posts.length,1);
 await assert.rejects(()=>synchronize({plan:{...plan,catalog_id:'999'},csv:'data',api}),/Plan Meta inválido/);
 const missing=fake({badMembers:true});await assert.rejects(()=>synchronize({plan,csv:'data',api:missing,wait:async()=>{},attempts:1}),/PERTENENCIA_NO_VERIFICADA/);
 assert.throws(()=>checkRemote(plan,[]),/IMPORTACION_NO_COINCIDE/);
 const calls=[];const graph=new Graph({token:'secret-test',version:'v25.0',transport:async(url,opts)=>{calls.push({url:String(url),opts});return {ok:true,json:async()=>({data:[],paging:{next:'https://evil.example/?access_token=secret-test'}})};}});
 await assert.rejects(()=>graph.list(catalog+'/products','id'),/PAGINACION/);assert.equal(calls.length,1);
 assert(!calls[0].url.includes('secret-test'));assert.equal(calls[0].opts.headers.Authorization,'Bearer secret-test');
 await assert.rejects(()=>graph.request('DELETE','999'),/fuera de alcance/);
 const errorGraph=new Graph({token:'secret-test',version:'v25.0',transport:async()=>({ok:false,status:403,json:async()=>({error:{code:200,message:'secret-test'}})})});
 await assert.rejects(()=>errorGraph.request('GET',catalog),e=>!e.message.includes('secret-test')&&e.message.includes('403'));
 console.log('Meta web: categorías/excepciones, agotados, aprobación, reutilización Celulares, idempotencia, importación, pertenencia, duplicados, paginación y secretos comprobados.');
})().catch(e=>{console.error(e);process.exitCode=1;});
