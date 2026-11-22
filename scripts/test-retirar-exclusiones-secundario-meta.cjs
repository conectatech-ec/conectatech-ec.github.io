'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {SecondaryGraph}=require('./sincronizar-secundario-meta.cjs');
const {SKUS,CATALOG,NAME,FEED_NAME,prepare,apply,digest}=require('./retirar-exclusiones-secundario-meta.cjs');
const authorized=[...SKUS],artifactId='123456';
const config={version:1,enabled:true,phone:'593964206977',catalog_id:CATALOG,catalog_name:NAME,feed_name:FEED_NAME};
const clone=x=>structuredClone(x),retirementError=e=>/^RETIRADA_/.test(e?.message||'');
function fixture(){
 const calls=[],items=authorized.map((retailer_id,i)=>({id:String(800+i),retailer_id,brand:'STEREN',price:'10.00 USD',availability:i===0?'out of stock':'in stock',product_catalog:{id:CATALOG},product_feed:{id:'700'}}));
 items.push({id:'900',retailer_id:'AUDI091',brand:'KLIP XTREME',price:'41.89 USD',availability:'in stock',product_catalog:{id:CATALOG},product_feed:{id:'700'}});
 const control={badCatalogName:false,feeds:[{id:'700',name:FEED_NAME}],uploads:[],failDelete:null,loseReply:null,successFalse:null};
 const transport=async(url,options)=>{
  assert.equal(url.origin,'https://graph.facebook.com');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer SECONDARY_FAKE');assert.equal(url.searchParams.has('access_token'),false);
  const path=url.pathname.replace('/v26.0/',''),params=options.body instanceof URLSearchParams?Object.fromEntries(options.body):{};
  calls.push({method:options.method,path,fields:url.searchParams.get('fields'),params});
  let data;
  if(options.method==='DELETE'){
   assert.equal(Object.keys(params).length,0,'DELETE no admite parámetros adicionales');
   const i=items.findIndex(p=>p.id===path);assert(i>=0,'DELETE sólo sobre un producto existente del fixture');
   if(control.failDelete===path)return new Response(JSON.stringify({error:{code:200,message:'Bearer SECONDARY_FAKE https://private.example/?token=NEVER_DISCLOSE'}}),{status:403});
   if(control.successFalse===path)return new Response(JSON.stringify({success:false}));
   items.splice(i,1);
   if(control.loseReply===path){control.loseReply=null;throw Error('RESPUESTA_PERDIDA_NO_REINTENTAR_SIN_LEER');}
   data={success:true};
  }else{
   assert.equal(options.method,'GET','Ningún POST, publicación o cambio de stock/precio en esta operación');
   if(path===CATALOG)data={id:CATALOG,name:control.badCatalogName?'CATALOGO AJENO':NAME};
   else if(path===CATALOG+'/product_feeds')data={data:clone(control.feeds)};
   else if(path===CATALOG+'/products')data={data:clone(items)};
   else if(path==='700/uploads')data={data:clone(control.uploads)};
   else{
    const p=items.find(p=>p.id===path);
    if(!p)return new Response(JSON.stringify({error:{code:100,message:'Producto no disponible'}}),{status:400});
    data=clone(p);
   }
  }
  return new Response(JSON.stringify(data));
 };
 const api=new SecondaryGraph({config,token:'SECONDARY_FAKE',version:'v26.0',transport});
 return {api,calls,items,control,deleted:()=>calls.filter(c=>c.method==='DELETE'),writes:()=>calls.filter(c=>c.method!=='GET')};
}
const applyOptions=(f,backup,extra={})=>({api:f.api,backup,artifactId,wait:async()=>{},...extra});

test('prepara respaldo sólo con los cinco SKU autorizados y no modifica Meta',async()=>{
 const f=fixture(),before=JSON.stringify(f.items),backup=await prepare({api:f.api});
 assert.equal(backup.version,1);assert.equal(backup.catalog_id,CATALOG);assert.equal(backup.feed_id,'700');assert.deepEqual([...backup.authorized_skus].sort(),[...authorized].sort());
 assert.deepEqual(backup.targets.map(p=>p.retailer_id).sort(),[...authorized].sort());assert.equal(new Set(backup.targets.map(p=>p.id)).size,5);assert.match(backup.others_sha256,/^[a-f0-9]{64}$/);assert.match(backup.backup_sha256,/^[a-f0-9]{64}$/);
 assert.equal(JSON.stringify(f.items),before);assert.equal(f.writes().length,0);assert(!JSON.stringify(backup).includes('SECONDARY_FAKE'));assert.equal(typeof digest,'function');
});
test('sin artifact confirmado no se habilita ningún DELETE',async()=>{
 const f=fixture(),backup=await prepare({api:f.api});
 await assert.rejects(apply(applyOptions(f,backup,{artifactId:null})),retirementError);assert.equal(f.deleted().length,0);assert.equal(f.items.length,6);
});
test('la ruta normal retira sólo los cinco productos y conserva el producto ajeno exacto',async()=>{
 const f=fixture(),other=clone(f.items.find(p=>p.retailer_id==='AUDI091')),backup=await prepare({api:f.api}),receipts=[];
 const result=await apply(applyOptions(f,backup,{onReceipt:r=>receipts.push(clone(r))}));
 assert.equal(result.estado,'VERIFICADO');assert.deepEqual([...result.retirados].sort(),[...authorized].sort());assert.deepEqual(result.ya_ausentes,[]);assert.equal(result.catalog_id,CATALOG);assert.equal(result.backup_sha256,backup.backup_sha256);
 assert.deepEqual(f.items,[other]);assert.equal(f.deleted().length,5);assert.ok(f.deleted().every(c=>backup.targets.some(t=>t.id===c.path)));assert.equal(f.writes().some(c=>c.method==='POST'),false);
 assert.equal(receipts.at(-1).estado,'VERIFICADO');
});
test('el adaptador real rechaza DELETE sin permiso y no admite SKU ajeno en el permiso',async()=>{
 const f=fixture();await prepare({api:f.api});
 await assert.rejects(f.api.request('DELETE','800',{}));assert.equal(f.deleted().length,0);
 await f.api.request('GET','900',{fields:'id,retailer_id,brand,price,availability,product_catalog{id},product_feed{id}'});
 await assert.rejects(Promise.resolve().then(()=>f.api.authorizeProductRetirement('900')));assert.equal(f.deleted().length,0);
});
test('el permiso acotado no habilita catálogos, fuentes, otros nodos, parámetros ni archivos',async()=>{
 const f=fixture();await prepare({api:f.api});
 await f.api.request('GET','800',{fields:'id,retailer_id,brand,price,availability,product_catalog{id},product_feed{id}'});f.api.authorizeProductRetirement('800');
 for(const [target,params,file]of [[CATALOG,{},null],['700',{},null],['1036301566100990',{},null],['800/products',{},null],['800',{allow_delete:true},null],['800',{}, {name:'archivo.csv',content:'NO_USAR'}]])await assert.rejects(f.api.request('DELETE',target,params,file));
 assert.equal(f.deleted().length,0);assert.equal(f.items.length,6);
});
test('identidad de catálogo, fuente, marca o pertenencia incorrectas no permiten ningún borrado',async()=>{
 for(const kind of ['catalog','feed','brand','parent','scheduled','duplicateFeed','pendingUpload']){
  const f=fixture();
  if(kind==='catalog')f.control.badCatalogName=true;
  if(kind==='feed')f.items.at(-2).product_feed={id:'999'};
  if(kind==='brand')f.items.at(-2).brand='OTRA MARCA';
  if(kind==='parent')f.items.at(-2).product_catalog={id:'1036301566100990'};
  if(kind==='scheduled')f.control.feeds[0].schedule={url:'https://example.test/otra-fuente.csv'};
  if(kind==='duplicateFeed')f.control.feeds.push({id:'701',name:FEED_NAME});
  if(kind==='pendingUpload')f.control.uploads.push({id:'702',end_time:null,error_count:0});
  await assert.rejects(prepare({api:f.api}),retirementError);assert.equal(f.deleted().length,0,kind);
 }
});
test('un cambio de ID o valores desde el respaldo bloquea toda la aplicación antes del primer DELETE',async()=>{
 for(const kind of ['id','price','availability','parent','feed']){
  const f=fixture(),backup=await prepare({api:f.api}),last=f.items.find(p=>p.retailer_id===authorized.at(-1));
  if(kind==='id')last.id='999';
  if(kind==='price')last.price='11.00 USD';
  if(kind==='availability')last.availability='out of stock';
  if(kind==='parent')last.product_catalog={id:'1036301566100990'};
  if(kind==='feed')last.product_feed={id:'999'};
  await assert.rejects(apply(applyOptions(f,backup)),retirementError);assert.equal(f.deleted().length,0,kind);
 }
});
test('un respaldo manipulado o con IDs duplicados no autoriza escrituras',async()=>{
 for(const kind of ['digest','duplicate','extraSku']){
  const f=fixture(),backup=await prepare({api:f.api});
  if(kind==='digest')backup.backup_sha256='0'.repeat(64);
  if(kind==='duplicate')backup.targets.at(-1).id=backup.targets[0].id;
  if(kind==='extraSku')backup.targets[0].retailer_id='AUDI091';
  if(kind!=='digest'){const {backup_sha256,...body}=backup;backup.backup_sha256=digest(body);}
  await assert.rejects(apply(applyOptions(f,backup)),retirementError);assert.equal(f.deleted().length,0,kind);
 }
});
test('cambios ajenos desde el respaldo detienen la operación antes de retirar productos',async()=>{
 const f=fixture(),backup=await prepare({api:f.api});f.items.find(p=>p.retailer_id==='AUDI091').price='42.00 USD';
 await assert.rejects(apply(applyOptions(f,backup)),retirementError);assert.equal(f.deleted().length,0);assert.equal(f.items.length,6);
});
test('si los cinco ya están ausentes se verifica la ausencia sin recrear ni borrar otros productos',async()=>{
 const f=fixture(),backup=await prepare({api:f.api}),other=clone(f.items.at(-1));f.items.splice(0,5);
 const r=await apply(applyOptions(f,backup));assert.equal(r.estado,'VERIFICADO');assert.deepEqual(r.retirados,[]);assert.deepEqual([...r.ya_ausentes].sort(),[...authorized].sort());assert.equal(f.deleted().length,0);assert.deepEqual(f.items,[other]);
});
test('la siguiente ejecución prepara un respaldo vacío cuando la exclusión ya está cumplida',async()=>{
 const f=fixture();f.items.splice(0,5);const backup=await prepare({api:f.api});assert.deepEqual(backup.targets,[]);assert.equal(f.writes().length,0);
 const r=await apply(applyOptions(f,backup));assert.equal(r.estado,'VERIFICADO');assert.deepEqual(r.retirados,[]);assert.deepEqual([...r.ya_ausentes].sort(),[...authorized].sort());assert.equal(f.deleted().length,0);
});
test('una respuesta perdida se concilia por lectura y no duplica el DELETE',async()=>{
 const f=fixture(),backup=await prepare({api:f.api});f.control.loseReply=backup.targets[0].id;
 const r=await apply(applyOptions(f,backup));assert.equal(r.estado,'VERIFICADO');assert.equal(f.items.length,1);assert.equal(f.deleted().length,5);assert.equal(new Set(f.deleted().map(c=>c.path)).size,5);
});
test('una falla parcial conserva el recibo y el reintento sólo retira los pendientes',async()=>{
 const f=fixture(),backup=await prepare({api:f.api}),receipts=[];f.control.failDelete=backup.targets[2].id;let error;
 try{await apply(applyOptions(f,backup,{onReceipt:r=>receipts.push(clone(r))}));}catch(e){error=e;}
 assert(error);assert(retirementError(error));const stopped=receipts.at(-1);assert.equal(stopped.estado,'BLOQUEADO');assert.deepEqual(stopped.retirados,backup.targets.slice(0,2).map(t=>t.retailer_id));assert.equal(f.items.length,4);
 const text=JSON.stringify(stopped);for(const s of ['SECONDARY_FAKE','NEVER_DISCLOSE','https://private.example','Bearer'])assert(!text.includes(s));
 f.control.failDelete=null;const resumed=await apply(applyOptions(f,backup));assert.equal(resumed.estado,'VERIFICADO');assert.deepEqual([...resumed.ya_ausentes].sort(),backup.targets.slice(0,2).map(t=>t.retailer_id).sort());assert.equal(resumed.retirados.length,3);assert.equal(f.items.length,1);
 assert.equal(f.deleted().filter(c=>c.path===backup.targets[0].id).length,1);assert.equal(f.deleted().filter(c=>c.path===backup.targets[1].id).length,1);
});
test('success:false nunca se acredita como retirada',async()=>{
 const f=fixture(),backup=await prepare({api:f.api}),receipts=[];f.control.successFalse=backup.targets[0].id;
 await assert.rejects(apply(applyOptions(f,backup,{onReceipt:r=>receipts.push(clone(r))})),retirementError);
 assert.equal(f.items.length,6);assert.equal(receipts.at(-1).estado,'BLOQUEADO');assert.deepEqual(receipts.at(-1).retirados,[]);
});
