import {test,after,mock} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {pathToFileURL,fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';import {createHash} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
const here=path.dirname(fileURLToPath(import.meta.url)),proposal=path.resolve(here,'../..'),packageRoot=path.resolve(proposal,'..');
const reference=path.resolve(process.env.ALEX_PUBLIC_TEST_REFERENCE||(fs.existsSync(path.join(packageRoot,'reference'))?path.join(packageRoot,'reference'):proposal));
// Only code is copied from this inspected baseline. All JSON/identity fixtures below are synthetic.
const baseline=path.resolve(process.env.ALEX_TEST_BASELINE||path.join(proposal,'automatizacion'));
const helpers=path.resolve(process.env.ALEX_PUBLIC_HELPERS_REFERENCE||reference);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'alex-public-presentation-'));after(()=>fs.rmSync(temp,{recursive:true,force:true}));
const runtime=path.join(temp,'runtime');fs.mkdirSync(runtime);
for(const name of fs.readdirSync(baseline))if(name.endsWith('.mjs'))fs.copyFileSync(path.join(baseline,name),path.join(runtime,name));
for(const dir of [path.join(reference,'automatizacion'),path.join(proposal,'automatizacion')])for(const name of fs.readdirSync(dir))if(name.endsWith('.mjs'))fs.copyFileSync(path.join(dir,name),path.join(runtime,name));
function write(root,file,value){const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value));}
const sha=value=>createHash('sha256').update(value).digest('hex');
const {preparePresentation,stable}=createRequire(import.meta.url)(path.join(proposal,'automatizacion/prepare-alex-presentation.cjs'));
const cutSha='a'.repeat(64),generated='2026-11-02T22:48:22.000Z',now=Date.parse('2026-11-03T02:00:00.000Z'),guards=['CABL166','HUB017','FLAS024','MOUS010'];
// Freeze only the synthetic harness clock; runtime freshness guards keep real clocks.
mock.method(Date,'now',()=>now);after(()=>mock.restoreAll());
const ids=['TELF017','TELF018','TELF019','TELF001','REL046',...guards];
const source={schema:'conectatech.commercial.v1',source:{sha256:cutSha,cut_date:'2026-11-02',generated_at:generated},normalized_at:generated,published_at:null,expires_at:'2026-11-03T22:48:22.000Z',products:ids.map(sku=>({sku,source_name:'SYNTHETIC RAW '+sku,variant_gb:[128],name:'Nombre anterior '+sku,availability:guards.includes(sku)?'blocked':'in_stock',blocked_reasons:guards.includes(sku)?['IDENTITY_VARIANT_REVIEW']:[],prices:guards.includes(sku)?null:{currency:'USD',promo_cash_cents:1234,pvp_card_cents:1567},web:{url:'https://conectatech-ec.github.io/productos/'+sku.toLowerCase()+'/'}}))};
const seed={fuente_fecha:generated,productos:ids.map(sku=>({sku,nombre:'Nombre anterior '+sku,public_name:'Nombre anterior '+sku,descripcion:'Descripción conservada',caracteristicas:{Material:'Conservado'},foto:null,foto_sha256:null,banner:null,banner_sha256:null,promo:12.34,pvp:15.67,stock:1,url:'https://conectatech-ec.github.io/productos/'+sku.toLowerCase()+'/'}))};
write(runtime,'central/current.json',source);write(runtime,'central/enrichment.json',{schema:'conectatech.enrichment.v1',products:{}});write(runtime,'central/source-attestations.json',{});write(runtime,'generated/catalogo.json',seed);write(runtime,'generated/alex-productos-extra.json',{productos:[]});fs.copyFileSync(path.join(reference,'automatizacion/alex-policy.json'),path.join(runtime,'alex-policy.json'));
const consumer=await import(pathToFileURL(path.join(runtime,'central-source.mjs'))),catalog=await import(pathToFileURL(path.join(runtime,'alex-catalog.mjs'))),alex=await import(pathToFileURL(path.join(runtime,'alex.mjs'))),store=await import(pathToFileURL(path.join(runtime,'alex-store.mjs'))),live=await import(pathToFileURL(path.join(runtime,'live.mjs')));
function csv(header,record){return header.join(',')+'\n'+header.map(k=>'"'+String(record[k]??'').replaceAll('"','""')+'"').join(',')+'\n';}
function fixture(name='web'){
 const root=path.join(temp,name);fs.mkdirSync(root,{recursive:true});
 for(const file of ['assets/editorial-titulos.js','scripts/editorial-fotografia-efectiva.cjs','scripts/fotografia-direccion.cjs'])write(root,file,fs.readFileSync(path.join(helpers,file)));
 const old=Buffer.from('SYNTHETIC old approved image'),next=Buffer.from('SYNTHETIC current approved image');
 const photo=(tag,bytes)=>({original:'/imagenes/rel046/'+tag+'-original.webp',sha256_original:sha(bytes),contiene_caja:false,revision_visual:'Synthetic fixture: explicit approved visual review',versiones:{1200:{url:'/imagenes/rel046/'+tag+'.webp',sha256:sha(bytes)}}});
 const oldPhoto=photo('old',old),newPhoto=photo('new',next);
 for(const [p,bytes]of [[oldPhoto,old],[newPhoto,next]]){write(root,'.'+p.original,bytes);write(root,'.'+p.versiones[1200].url,bytes);}
 const editorial={activo:true,productos:{REL046:{titulo:'Reloj inteligente de prueba',subtitulo:'Subtítulo confirmado'}}};
 write(root,'index.html','const products='+JSON.stringify([{sku:'REL046',name:'Nombre anterior REL046',imageUrl:oldPhoto.versiones[1200].url}])+';\n');
 write(root,'seo-contenido.json',{REL046:{nombre:'Nombre anterior REL046',imagen:oldPhoto.versiones[1200].url,imagenProfesional:oldPhoto}});
 write(root,'importacion/editorial/publicados.json',editorial);write(root,'assets/editorial-titulos-datos.js','window.CONECTATECH_TITULOS_PRO_DATOS='+JSON.stringify(editorial)+';\n');
 write(root,'importacion/fotografia-publicada/direccion-20261026-05.json',{productos:{REL046:{sku:'REL046',revisado_visual:true,portada_anterior:{url:oldPhoto.versiones[1200].url,sha256:sha(old)},imagenProfesional:newPhoto}}});
 write(root,'datos-593/estado-ultimo-corte.json',{fecha_corte:'2026-11-02',origen_sha256:cutSha,referencia:'datos-593/corte-comercial-publico-validado.json'});write(root,'datos-593/corte-comercial-publico-validado.json',{fecha_corte:'2026-11-02',sha256_original:cutSha});
 write(root,'exportaciones/resumen-canales.json',{generated_at:'2026-11-03T01:00:00.000Z',fecha_corte:'2026-11-02',fuente_sha256:cutSha});
 const record={sku:'REL046',id:'REL046',title:editorial.productos.REL046.titulo,image_link:'https://conectatech-ec.github.io'+newPhoto.versiones[1200].url,stock:987654,price:'PRIVATE_TEST_MUST_NOT_PROPAGATE'};
 write(root,'exportaciones/contenido-multicanal.csv',csv(['sku','title','image_link','stock','price'],record));write(root,'exportaciones/meta-catalogo-piloto.csv',csv(['id','title','image_link'],record));
 return {root,old,next,oldPhoto,newPhoto,record};
}
const web=fixture(),document=preparePresentation(web.root);
function signed(edit){const copy=structuredClone(document);delete copy.version;edit(copy);return {...copy,version:'alex-presentation-v1-'+sha(stable(copy))};}
const all=products=>products;
test('Official title entry and real photo overlay produce only public, versioned presentation',()=>{
 assert.equal(document.products.REL046.display_title,'Reloj inteligente de prueba');assert.equal(document.products.REL046.approved_media.sha256,sha(web.next));
 assert.equal(document.products.REL046.approved_media.url,'https://conectatech-ec.github.io/imagenes/rel046/new.webp');
 const json=JSON.stringify(document);for(const forbidden of ['source_name','variant_gb','prices','stock','PRIVATE_TEST_MUST_NOT_PROPAGATE','SYNTHETIC RAW'])assert.ok(!json.includes(forbidden));
});
test('Same inputs are a deterministic no-op with zero source file changes',()=>{
 const before=fs.statSync(path.join(web.root,'exportaciones/resumen-canales.json')).mtimeMs;
 assert.deepEqual(preparePresentation(web.root),document);assert.equal(fs.statSync(path.join(web.root,'exportaciones/resumen-canales.json')).mtimeMs,before);
});
test('Real sourceToAlex displays approved title/media and preserves canonical identity and commercial fields',async()=>{
 const before=structuredClone(source),bound=await consumer.bindPresentation(source,document,now),result=consumer.sourceToAlex(seed,bound,all,now),p=result.productos.find(p=>p.sku==='REL046');
 assert.equal(p.public_name,document.products.REL046.display_title);assert.equal(p.foto,document.products.REL046.approved_media.url);assert.equal(p.foto_sha256,sha(web.next));
 assert.equal(p.catalog_identity,'SYNTHETIC RAW REL046');assert.equal(p.nombre,'Nombre anterior REL046');assert.equal(p.descripcion,'Descripción conservada');assert.deepEqual(p.caracteristicas,{Material:'Conservado'});
 assert.equal(p.promo,12.34);assert.equal(p.pvp,15.67);assert.equal(p.stock,1);assert.equal(p.stock_is_availability_marker,true);assert.equal(result.source_sha256,cutSha);assert.equal(result.fuente_fecha,generated);assert.equal(result.inventory_cut_date,'2026-11-02');assert.equal(result.expires_at,source.expires_at);assert.deepEqual(source,before);
});
test('Public title participates in the real selector without replacing raw identity',async()=>{
 const bound=await consumer.bindPresentation(source,document,now),empty={...seed,productos:[]};
 const result=consumer.sourceToAlex(empty,bound,products=>products.filter(p=>p.public_name==='Reloj inteligente de prueba'),now);
 assert.deepEqual(result.productos.map(p=>p.sku),['REL046']);assert.equal(result.productos[0].catalog_identity,'SYNTHETIC RAW REL046');
});
test('JSON presentation without cryptographic in-memory binding cannot bypass the consumer',()=>{
 const data={...source,presentation:document};const result=consumer.sourceToAlex(seed,data,all,now);assert.equal(result.presentation_version,null);assert.equal(result.productos.find(p=>p.sku==='REL046').foto,null);
});
test('Real refreshAlexCatalog performs the binding and real commercial response uses public name and exact prices',async()=>{
 const result=await catalog.refreshAlexCatalog(seed,async()=>{throw Error('NO_NETWORK');},now,'REL046',{...source,presentation:document}),p=result.productos.find(p=>p.sku==='REL046');
 assert.equal(result.presentation_version,document.version);assert.equal(catalog.quoteCurrent(result,p,now),true);
 const response=await alex.generateAlex('Precio de contado REL046',result,{}, {CATALOG_FIRST:'true',AI:null});
 assert.ok(response.text.includes('Reloj inteligente de prueba'));assert.ok(response.text.includes('12.34'));assert.ok(response.facts.includes('REL046.cash'));
});
test('Actual prepareAlex card uses public title and approved bytes; old banner cannot replace current photo',async()=>{
 const bound=await consumer.bindPresentation(source,document,now),result=consumer.sourceToAlex(seed,bound,all,now),p=result.productos.find(p=>p.sku==='REL046');p.banner='https://conectatech-ec.github.io/imagenes/old-banner.webp';p.banner_sha256='f'.repeat(64);
 const db=new DatabaseSync(':memory:'),box={sql:{exec(sql,...args){const q=db.prepare(sql),rows=/^SELECT/i.test(sql)?q.all(...args):(q.run(...args),[]);return {toArray:()=>rows,one:()=>rows[0]};}},env:{PILOT_TOKEN:'synthetic-editorial-test-private-key-000000',CATALOG_FIRST:'true',ALEX_ENABLED:'false',AI:null}};
 store.alexInit(box);await store.saveInput(box,'synthetic-job','Precio de contado REL046');
 const requested=[];const verifier=product=>live.verifyAssets(product,async url=>{requested.push(url);return new Response(web.next);});
 const ready=await store.prepareAlex(box,{k:'synthetic-job',who:'synthetic-user'},{refreshCatalog:async()=>result,verifyAssets:verifier});
 const card=ready.messages.find(m=>m.attachment)?.attachment.payload.elements[0];assert.equal(card.title,'Reloj inteligente de prueba');assert.equal(card.image_url,p.foto);assert.ok(requested.length);assert.ok(requested.every(url=>url===p.foto));db.close();
});
test('Four official identity guards remain blocked and cannot inherit editorial media or current quotes',async()=>{
 const candidate=signed(d=>{d.published_at='2026-11-03T01:05:00.000Z';for(const sku of guards)d.products[sku]=structuredClone(d.products.REL046);}),bound=await consumer.bindPresentation(source,candidate,now),result=consumer.sourceToAlex(seed,bound,all,now);
 for(const sku of guards){const p=result.productos.find(p=>p.sku===sku);assert.equal(p.price_verified,false);assert.equal(p.stock,0);assert.equal(p.foto,null);assert.equal(catalog.quoteCurrent(result,p,now),false);assert.equal(p.public_name,'Nombre anterior '+sku);const response=await alex.generateAlex('Precio '+sku,result,{}, {CATALOG_FIRST:'true',AI:null});assert.ok(!response.text.includes('$'));}
});
test('Expired commercial source keeps its original expiry and cannot quote after presentation refresh',async()=>{
 const expired=structuredClone(source);expired.source.generated_at='2026-11-01T22:48:22.000Z';expired.expires_at='2026-11-02T22:48:22.000Z';
 const bound=await consumer.bindPresentation(expired,document,now),result=consumer.sourceToAlex(seed,bound,all,now),p=result.productos.find(p=>p.sku==='REL046');assert.equal(result.fuente_fecha,expired.source.generated_at);assert.equal(result.expires_at,expired.expires_at);assert.equal(result.source_error_code,'CENTRAL_REPORT_STALE');assert.equal(catalog.quoteCurrent(result,p,now),false);const response=await alex.generateAlex('Precio contado REL046',result,{}, {CATALOG_FIRST:'true',AI:null});assert.ok(!response.text.includes('$'));
});
test('Cross-cut SHA/date and injected commercial/identity fields are rejected',async()=>{
 for(const edit of [d=>d.source_sha256='b'.repeat(64),d=>d.cut_date='2026-11-01',d=>d.products.REL046.prices={promo_cash_cents:1},d=>d.products.REL046.source_name='Override',d=>d.products.REL046.variant_gb=[256]])await assert.rejects(consumer.bindPresentation(source,signed(edit),now),/PRESENTATION_/);
});
test('Tampered digest does not replace last valid, then recovery accepts a newer verified version',async()=>{
 const valid=signed(d=>{d.published_at='2026-11-03T01:10:00.000Z';d.products.REL046.display_title='Reloj confirmado recuperación';});await consumer.bindPresentation(source,valid,now);
 const bad=structuredClone(valid);bad.products.REL046.display_title='CORRUPT';await assert.rejects(consumer.bindPresentation(source,bad,now),/SHA_MISMATCH/);
 const last=consumer.sourceToAlex(seed,consumer.lastValidPresentation(source),all,now);assert.equal(last.productos.find(p=>p.sku==='REL046').public_name,'Reloj confirmado recuperación');assert.equal(last.presentation_state,'last_valid');
 const recovery=signed(d=>{d.published_at='2026-11-03T01:20:00.000Z';d.products.REL046.display_title='Reloj recuperado vigente';});const next=consumer.sourceToAlex(seed,await consumer.bindPresentation(source,recovery,now),all,now);assert.equal(next.presentation_version,recovery.version);
});
test('Concurrent older completion cannot roll presentation back; same version is a no-op',async()=>{
 const newer=signed(d=>{d.published_at='2026-11-03T01:40:00.000Z';d.products.REL046.display_title='Última presentación';}),older=signed(d=>{d.published_at='2026-11-03T01:30:00.000Z';});
 await Promise.allSettled([consumer.bindPresentation(source,newer,now),consumer.bindPresentation(source,older,now)]);
 const result=consumer.sourceToAlex(seed,consumer.lastValidPresentation(source),all,now);assert.equal(result.presentation_version,newer.version);assert.equal(result.productos.find(p=>p.sku==='REL046').public_name,'Última presentación');
 const repeated=consumer.sourceToAlex(seed,await consumer.bindPresentation(source,newer,now),all,now);assert.equal(repeated.presentation_state,'unchanged');
});
test('Malformed file, CSV duplicate and editorial/browser drift fail before returning a candidate',()=>{
 for(const [name,edit]of [['json',f=>write(f.root,'seo-contenido.json','{broken')],['csv',f=>{const file=path.join(f.root,'exportaciones/contenido-multicanal.csv'),text=fs.readFileSync(file,'utf8');write(f.root,'exportaciones/contenido-multicanal.csv',text+text.split('\n')[1]+'\n');}],['browser',f=>write(f.root,'assets/editorial-titulos-datos.js','window.CONECTATECH_TITULOS_PRO_DATOS={};evil();')]]){const f=fixture('bad-'+name);edit(f);assert.throws(()=>preparePresentation(f.root));}
});
test('Official photo controller rejects changed bytes and unavailable approval cannot become an approved image',()=>{
 const corrupt=fixture('bad-image');write(corrupt.root,'.'+corrupt.newPhoto.versiones[1200].url,'CORRUPT');assert.throws(()=>preparePresentation(corrupt.root),/PRESENTATION_/);
 const pending=fixture('unapproved'),seo=JSON.parse(fs.readFileSync(path.join(pending.root,'seo-contenido.json')));delete seo.REL046.imagenProfesional.revision_visual;write(pending.root,'seo-contenido.json',seo);write(pending.root,'importacion/fotografia-publicada/direccion-20261026-05.json',{productos:{}});
 const record={...pending.record,image_link:'https://conectatech-ec.github.io'+pending.oldPhoto.versiones[1200].url};write(pending.root,'exportaciones/contenido-multicanal.csv',csv(['sku','title','image_link'],record));write(pending.root,'exportaciones/meta-catalogo-piloto.csv',csv(['id','title','image_link'],record));assert.equal(preparePresentation(pending.root).products.REL046.approved_media,null);
});
test('Interrupted preparation returns no candidate, leaves inputs intact and recovers on next run',()=>{
 const file=path.join(web.root,'exportaciones/contenido-multicanal.csv'),input=fs.readFileSync(file),read=fs.readFileSync;
 try{fs.readFileSync=function(target,...args){if(String(target)===file)throw Error('SIMULATED_READ_INTERRUPTION');return read.call(this,target,...args);};assert.throws(()=>preparePresentation(web.root),/SIMULATED_READ_INTERRUPTION/);}finally{fs.readFileSync=read;}
 assert.deepEqual(fs.readFileSync(file),input);assert.deepEqual(preparePresentation(web.root),document);
});
test('Official editorial activo and prefix exclusions use the existing fallback title',()=>{
 for(const [name,config]of [['inactive',{activo:false}],['excluded',{activo:true,excluirPrefijos:['REL']}]] ){
  const f=fixture('editorial-'+name),data={...config,productos:{REL046:{titulo:'Must not apply',subtitulo:''}}};write(f.root,'importacion/editorial/publicados.json',data);write(f.root,'assets/editorial-titulos-datos.js','window.CONECTATECH_TITULOS_PRO_DATOS='+JSON.stringify(data)+';\n');
  const record={...f.record,title:'Nombre anterior REL046'};write(f.root,'exportaciones/contenido-multicanal.csv',csv(['sku','title','image_link'],record));write(f.root,'exportaciones/meta-catalogo-piloto.csv',csv(['id','title','image_link'],record));assert.equal(preparePresentation(f.root).products.REL046.display_title,'Nombre anterior REL046');
 }
});
function sharedFixture(presentation,failPresentation=false){
 const compiled=structuredClone(source);compiled.source.sha256='c'.repeat(64);compiled.source.cut_date='2026-11-01';compiled.source.generated_at='2026-11-01T22:48:22.000Z';compiled.expires_at='2026-11-02T22:48:22.000Z';
 const pointer={fecha_corte:'2026-11-02',origen_sha256:cutSha,referencia:'datos-593/corte-comercial-publico-validado.json'},cut={fecha_corte:'2026-11-02',sha256_original:cutSha,fuente:'Synthetic current report',cantidad_sku_web:source.products.length,productos:Object.fromEntries(source.products.map(p=>[p.sku,{source_name:p.source_name,promo_centavos:p.prices?.promo_cash_cents||1234,pvp_centavos:p.prices?.pvp_card_cents||1567,stock:10}]))};
 const calls=[],fetcher=async(url,options)=>{calls.push({url,cache:options.cf.cacheTtl});if(url.endsWith('estado-ultimo-corte.json'))return Response.json(pointer);if(url.endsWith('corte-comercial-publico-validado.json'))return Response.json(cut);if(url.endsWith('exportaciones/catalogo-ventas.json'))return failPresentation?new Response('',{status:503}):Response.json({fuente_sha256:cutSha,fecha_corte:'2026-11-02',presentation,productos:[{sku:'REL046',promo:0.01,stock:9999999,nombre:'MUST_NOT_OVERRIDE_CANONICAL'}]});throw Error('UNEXPECTED_NETWORK_TARGET');};
 return {compiled,fetcher,calls};
}
test('Existing shared-Hub route reads the existing sales JSON once with 60s cache after adapting current cut',async()=>{
 const presentation=signed(d=>{d.published_at='2026-11-03T01:50:00.000Z';d.products.REL046.display_title='Título vigente desde feed existente';}),f=sharedFixture(presentation);
 const result=await catalog.refreshAlexCatalog(seed,f.fetcher,now,{input:'REL046',sharedHub:true},f.compiled),p=result.productos.find(p=>p.sku==='REL046');
 assert.equal(f.calls.length,3);assert.ok(f.calls.every(c=>c.cache===60));assert.equal(f.calls[2].url,'https://conectatech-ec.github.io/exportaciones/catalogo-ventas.json');assert.equal(result.source_sha256,cutSha);assert.equal(result.inventory_cut_date,'2026-11-02');assert.equal(result.fuente_fecha,'2026-11-02T05:00:00.000Z');assert.equal(result.expires_at,'2026-11-03T05:00:00.000Z');assert.equal(p.promo,12.34);assert.equal(p.stock,1);assert.equal(p.catalog_identity,'SYNTHETIC RAW REL046');assert.equal(p.public_name,'Título vigente desde feed existente');assert.equal(result.presentation_version,presentation.version);
});
test('Presentation outage or cross-SHA cannot discard newer valid financial cut or replace last presentation',async()=>{
 for(const [candidate,failure]of [[null,true],[signed(d=>{d.source_sha256='d'.repeat(64);d.published_at='2026-11-03T01:55:00.000Z';}),false]]){
  const f=sharedFixture(candidate,failure),result=await catalog.refreshAlexCatalog(seed,f.fetcher,now,{input:'REL046',sharedHub:true},f.compiled),p=result.productos.find(p=>p.sku==='REL046');
  assert.equal(result.source_sha256,cutSha);assert.equal(result.expires_at,'2026-11-03T05:00:00.000Z');assert.equal(p.promo,12.34);assert.equal(p.public_name,'Título vigente desde feed existente');assert.equal(result.presentation_state,'last_valid');assert.ok(result.presentation_error_code);assert.equal(catalog.quoteCurrent(result,p,now),true);
 }
});
test('Missing new photo approval preserves same-cut last valid image; wrong served bytes are never attached',async()=>{
 const noApproval=signed(d=>{d.published_at='2026-11-03T01:56:00.000Z';d.products.REL046.approved_media=null;d.products.REL046.display_title='Título actualizado, foto conservada';});
 const result=consumer.sourceToAlex(seed,await consumer.bindPresentation(source,noApproval,now),all,now),p=result.productos.find(p=>p.sku==='REL046');assert.equal(p.foto,document.products.REL046.approved_media.url);assert.equal(p.foto_sha256,sha(web.next));assert.equal(p.public_name,'Título actualizado, foto conservada');assert.equal(p.presentation_media_state,'retained_last_valid');
 await assert.rejects(store.approvedImage(p,product=>live.verifyAssets(product,async()=>new Response('CORRUPT_SERVED_IMAGE'))),/asset_changed_refresh_required/);
});
async function pausedDigest(action){
 const subtle=crypto.subtle,descriptor=Object.getOwnPropertyDescriptor(subtle,'digest'),original=subtle.digest;
 let open,entered;const gate=new Promise(resolve=>{open=resolve;}),ready=new Promise(resolve=>{entered=resolve;});
 Object.defineProperty(subtle,'digest',{configurable:true,writable:true,value:async function(...args){entered();await gate;return original.apply(subtle,args);}});
 try{return await action({ready,open});}finally{open();if(descriptor)Object.defineProperty(subtle,'digest',descriptor);else delete subtle.digest;}
}
test('Controlled async SHA/cut/product mutations cannot bind source A presentation to source B or poison last valid',async()=>{
 const prior=consumer.sourceToAlex(seed,consumer.lastValidPresentation(source),all,now),priorVersion=prior.presentation_version;
 assert.ok(priorVersion);
 const mutations=[data=>{data.source.sha256='e'.repeat(64);},data=>{data.source.cut_date='2026-11-01';},data=>{data.products.find(p=>p.sku==='REL046').variant_gb[0]=256;},data=>{data.products.find(p=>p.sku==='REL046').source_name='SYNTHETIC MUTATED IDENTITY';},data=>{data.products.find(p=>p.sku==='REL046').prices.promo_cash_cents=1;},data=>{data.products=[...data.products].reverse();}];
 for(const mutate of mutations){
  const mutable=structuredClone(source),candidate=signed(d=>{d.published_at='2026-11-03T02:02:00.000Z';d.products.REL046.display_title='Must not enter cache during race';});
  await pausedDigest(async({ready,open})=>{const pending=consumer.bindPresentation(mutable,candidate,now);await ready;mutate(mutable);open();await assert.rejects(pending,/PRESENTATION_SOURCE_CHANGED_DURING_BIND/);});
  const intact=consumer.sourceToAlex(seed,consumer.lastValidPresentation(source),all,now);assert.equal(intact.presentation_version,priorVersion);assert.deepEqual(intact.productos,prior.productos);assert.equal(intact.source_sha256,prior.source_sha256);assert.equal(intact.inventory_cut_date,prior.inventory_cut_date);assert.equal(intact.expires_at,prior.expires_at);
  if(mutable.source.sha256!==source.source.sha256||mutable.source.cut_date!==source.source.cut_date||JSON.stringify(mutable.products)!==JSON.stringify(source.products)&&mutable.products[0].sku===source.products[0].sku){const rejectedFallback=consumer.sourceToAlex(seed,consumer.lastValidPresentation(mutable),all,now);assert.equal(rejectedFallback.presentation_version,null);}
 }
});
test('Successful and last-valid bindings own immutable source/product snapshots after callers mutate their inputs',async()=>{
 const mutable=structuredClone(source),candidate=signed(d=>{d.published_at='2026-11-03T02:03:00.000Z';d.products.REL046.display_title='Immutable approved presentation';}),bound=await consumer.bindPresentation(mutable,candidate,now);
 assert.notEqual(bound,mutable);assert.notEqual(bound.source,mutable.source);assert.notEqual(bound.products,mutable.products);assert.equal(Object.isFrozen(bound),true);assert.equal(Object.isFrozen(bound.source),true);assert.equal(Object.isFrozen(bound.products),true);assert.equal(Object.isFrozen(bound.products[0].variant_gb),true);
 mutable.source.sha256='f'.repeat(64);mutable.products.find(p=>p.sku==='REL046').source_name='SYNTHETIC POST-BIND CHANGE';mutable.products.find(p=>p.sku==='REL046').prices.promo_cash_cents=1;
 const result=consumer.sourceToAlex(seed,bound,all,now),p=result.productos.find(p=>p.sku==='REL046');assert.equal(result.source_sha256,cutSha);assert.equal(p.catalog_identity,'SYNTHETIC RAW REL046');assert.equal(p.promo,12.34);assert.equal(result.presentation_version,candidate.version);
 assert.throws(()=>{bound.source.sha256='b'.repeat(64);},TypeError);assert.throws(()=>{bound.products[0].variant_gb.push(512);},TypeError);
 const fallbackInput=structuredClone(source);fallbackInput.normalized_at='2026-11-03T02:04:00.000Z';const fallback=consumer.lastValidPresentation(fallbackInput);fallbackInput.source.cut_date='2026-11-01';fallbackInput.products.find(p=>p.sku==='REL046').variant_gb[0]=256;
 const restored=consumer.sourceToAlex(seed,fallback,all,now);assert.equal(restored.presentation_version,candidate.version);assert.equal(restored.inventory_cut_date,'2026-11-02');assert.equal(restored.productos.find(p=>p.sku==='REL046').catalog_identity,'SYNTHETIC RAW REL046');
});
test('Public additions are verified then quarantined without importing SKU, identity, price or media',async()=>{
 const before=structuredClone(source),candidate=signed(d=>{d.published_at='2026-11-03T02:04:00.000Z';d.products.REL046.display_title='Known canonical product stays usable';for(let i=0;i<17;i++)d.products['NEW'+String(i).padStart(3,'0')]={display_title:'Public-only product '+i,approved_media:{url:'https://conectatech-ec.github.io/imagenes/public-only/new.webp',sha256:'9'.repeat(64)}};});
 const bound=await consumer.bindPresentation(source,candidate,now),result=consumer.sourceToAlex(seed,bound,all,now);
 assert.equal(result.presentation_ignored_unknown_count,17);assert.equal(result.presentation_version,candidate.version);assert.equal(result.productos.length,seed.productos.length);assert.equal(result.productos.find(p=>p.sku==='REL046').public_name,'Known canonical product stays usable');
 assert.ok(result.productos.every(p=>!p.sku.startsWith('NEW')));assert.ok(!JSON.stringify(result).includes('public-only/new.webp'));assert.deepEqual(source,before);
 const selection=consumer.sourceToAlex({productos:[]},bound,products=>products.filter(p=>p.sku==='NEW000'),now);assert.deepEqual(selection.productos,[]);
 const response=await alex.generateAlex('Precio NEW000',result,{}, {CATALOG_FIRST:'true',AI:null});assert.ok(!response.focus.includes('NEW000'));assert.ok(!response.text.includes('$'));assert.equal(response.image,null);
 const retained=consumer.sourceToAlex(seed,consumer.lastValidPresentation(source),all,now);assert.equal(retained.presentation_ignored_unknown_count,17);assert.equal(retained.presentation_version,candidate.version);
});
test('Unknown entries still belong to full digest and schema; all-unknown document cannot replace last valid',async()=>{
 const prior=consumer.sourceToAlex(seed,consumer.lastValidPresentation(source),all,now),allUnknown=signed(d=>{d.published_at='2026-11-03T02:05:00.000Z';d.products={NEW999:{display_title:'Only public',approved_media:null}};});
 await assert.rejects(consumer.bindPresentation(source,allUnknown,now),/PRESENTATION_NO_MATCHING_SKU/);
 const tampered=signed(d=>{d.published_at='2026-11-03T02:05:00.000Z';d.products.NEW999={display_title:'Original public title',approved_media:null};});tampered.products.NEW999.display_title='Corrupt after signing';await assert.rejects(consumer.bindPresentation(source,tampered,now),/PRESENTATION_SHA_MISMATCH/);
 const injected=signed(d=>{d.published_at='2026-11-03T02:05:00.000Z';d.products.NEW999={display_title:'Injected public product',approved_media:null,source_name:'MUST_NOT_AUTHORIZE',prices:{promo_cash_cents:1}};});await assert.rejects(consumer.bindPresentation(source,injected,now),/PRESENTATION_FIELDS/);
 const after=consumer.sourceToAlex(seed,consumer.lastValidPresentation(source),all,now);assert.equal(after.presentation_version,prior.presentation_version);assert.equal(after.presentation_ignored_unknown_count,17);assert.deepEqual(after.productos,prior.productos);
});


test('Official boolean visual review and historical text both retain SHA validation; false or missing review cannot approve',()=>{
 for(const [tag,review,expected]of [['boolean',true,true],['text','Explicit approved review',true],['false',false,false],['null',null,false],['empty','',false]]){
  const f=fixture('review-format-'+tag),record=JSON.parse(fs.readFileSync(path.join(f.root,'importacion/fotografia-publicada/direccion-20261026-05.json')));
  record.productos.REL046.imagenProfesional.revision_visual=review;write(f.root,'importacion/fotografia-publicada/direccion-20261026-05.json',record);
  const doc=preparePresentation(f.root);assert.equal(!!doc.products.REL046.approved_media,expected);
  if(expected)assert.equal(doc.products.REL046.approved_media.sha256,sha(f.next));
 }
});
test('Boolean approval cannot authorize changed image bytes or substitute for official SHA evidence',()=>{
 const f=fixture('boolean-review-corruption'),record=JSON.parse(fs.readFileSync(path.join(f.root,'importacion/fotografia-publicada/direccion-20261026-05.json')));
 record.productos.REL046.imagenProfesional.revision_visual=true;write(f.root,'importacion/fotografia-publicada/direccion-20261026-05.json',record);
 write(f.root,'.'+f.newPhoto.original,Buffer.from('CORRUPTED SYNTHETIC IMAGE'));
 assert.throws(()=>preparePresentation(f.root));
});
