const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),path=require('node:path');
const ROOT=__dirname,clone=x=>JSON.parse(JSON.stringify(x)),sha='a'.repeat(64),day='2026-11-02';
function fixture(){
 const png=Buffer.from('synthetic-approved-banner'),pdf=Buffer.from('synthetic-approved-pdf'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 const status={fecha_corte:day,origen_sha256:sha},prices={fecha_corte:day,sha256_original:sha,cantidad_sku_web:1,productos:{TELF001:{stock:4,promo_centavos:1990,pvp_centavos:2488}}};
 const stamp=(id,bytes)=>({id_drive:id,fecha_corte:day,sha256_fuente:sha,checksum_archivo:hash(bytes),checksum_descargado:hash(bytes),estado_publicacion:'VERIFICADO',estado_aprobacion:'APROBADO',fecha_generacion:'2026-11-03T10:00:00Z'});
 const p={sku:'TELF001',titulo:'Synthetic approved product',coleccion:'TELEFONOS_TABLETS',estado:'APROBADO',material_vigente_verificado:true,disponibilidad_comercial:true,
  precio_contado:'19.90',pvp:'24.88',fecha_datos:day,fecha_datos_banner:day,fuente_593_sha256:sha,banner_sha256:hash(png),publicacion_drive:stamp('synthetic_banner',png)};
 const c={estado:'APROBADO_DRIVE_VERIFICADO',fecha_datos:day,fuente_593_sha256:sha,sku:['TELF001'],archivos_privados:[{version:'ligero',url:'https://drive.google.com/file/d/synthetic_pdf/view',sha256:hash(pdf)}],publicacion_drive:{ligero:{...stamp('synthetic_pdf',pdf),SKU:['TELF001']}}};
 return {png,pdf,status,prices,p,manifest:{fecha_datos:day,fuente_593_sha256:sha,productos:[p],catalogos:{TEST:c}}};
}
function runtime({publicMode=true,script=null}={}){
 const f=fixture(),reads=[],network=[],writes=[],cacheMap=new Map(),files=new Map([['synthetic_banner',{bytes:f.png,mime:'image/png'}],['synthetic_pdf',{bytes:f.pdf,mime:'application/pdf'}]]);
 const control={version:1793700000000,pricesStatus:200};
 const config={users:['seller@example.test'],manifestId:'synthetic_manifest',rootId:'synthetic_private_root',approvedFolders:['synthetic_approved_folder'],hubUrl:'https://conectatech-ec.github.io/datos-593/estado-ultimo-corte.json'};
 const props=new Map([['BANNERS_PRO_CONFIG',JSON.stringify(config)],['BANNERS_PRO_PUBLIC_BANNERS',String(publicMode)]]),token='c'.repeat(64);
 cacheMap.set('bp:auth:v2:session:'+crypto.createHash('sha256').update(token).digest('hex'),JSON.stringify({expires:Date.now()+60000,epoch:'1',email:'seller@example.test'}));
 const cache={get:k=>cacheMap.get(k)||null,put:(k,v)=>cacheMap.set(k,v),remove:k=>cacheMap.delete(k)};
 const context=vm.createContext({console,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null})},
  CacheService:{getScriptCache:()=>cache,getUserCache:()=>cache},
  Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,v)=>Array.from(crypto.createHash('sha256').update(typeof v==='string'?v:Buffer.from(v)).digest()),base64Encode:v=>Buffer.from(v).toString('base64')},
  Session:new Proxy({},{get:()=>{throw Error('Session identity must not be used')}}),
  HtmlService:{createHtmlOutput:s=>s,createHtmlOutputFromFile:()=>({setTitle(){return this},addMetaTag(){return this}})},
  DriveApp:{getFileById:id=>{
   reads.push(id);if(id===vm.runInContext('SETTINGS.manifestId',context))return{getBlob:()=>({getDataAsString:()=>JSON.stringify(f.manifest)})};
   if(!files.has(id))throw Error('Unknown synthetic asset');const entry=files.get(id);
   return{isTrashed:()=>false,getMimeType:()=>entry.mime,getLastUpdated:()=>new Date(control.version),getName:()=>id+(entry.mime==='image/png'?'.png':'.pdf'),getBlob:()=>({getBytes:()=>Array.from(entry.bytes)}),
    getParents:()=>{let n=0;return{hasNext:()=>n===0,next:()=>{n++;return{getId:()=>vm.runInContext('SETTINGS.approvedFolders[0]',context)};}};}};
  },createFile:()=>{writes.push('create');throw Error('No writes allowed')}},
  UrlFetchApp:{fetch:(url,options)=>{network.push({url,options});assert.equal(options.payload,undefined);if(url==='https://conectatech-ec.github.io/datos-593/estado-ultimo-corte.json')return{getResponseCode:()=>200,getContentText:()=>JSON.stringify(f.status)};
   assert.equal(url,'https://conectatech-ec.github.io/datos-593/corte-comercial-publico-validado.json');return{getResponseCode:()=>control.pricesStatus,getContentText:()=>JSON.stringify(f.prices)};}}
 });
 vm.runInContext(fs.readFileSync(path.join(ROOT,'Guardas.gs'),'utf8'),context);
 vm.runInContext(script||fs.readFileSync(path.join(ROOT,'Code.gs'),'utf8')+'\n'+fs.readFileSync(path.join(ROOT,'Auth.gs'),'utf8'),context);
 const call=code=>vm.runInContext(code,context);return{f,reads,network,writes,files,control,context,call,token,props,cacheMap};
}
test('public mode remains public, hides PDF/root folder and never reads OAuth credentials',()=>{
 const r=runtime(),result=r.call('getLibrary()');assert.equal(result.products.length,1);assert.equal(result.pdfs.length,0);assert.equal(result.sourceUrl,null);assert.equal(r.call('getAccessMode().publicBanners'),true);
 assert.equal(r.network.length,2);assert.equal(r.writes.length,0);assert.equal(result.products[0].dataDate,day);assert.equal(result.products[0].renderedAt,'2026-11-03T10:00:00Z');assert.notEqual(result.products[0].updatedAt,day);
 assert.ok(!JSON.stringify(result).includes('synthetic_private_root'));assert.ok(!JSON.stringify(r.network).includes('Bearer'));
});
test('private mode still rejects missing/forged sessions before Drive or public HTTP',()=>{
 const r=runtime({publicMode:false});assert.equal(r.call('getAccessMode().publicBanners'),false);
 for(const token of [undefined,'seller@example.test','invalid'])for(const method of ['getLibrary('+JSON.stringify(token)+')',"getAsset('synthetic_banner',1,"+JSON.stringify(token)+')'])assert.throws(()=>r.call(method),/ACCESO_DENEGADO/);
 assert.equal(r.reads.length,0);assert.equal(r.network.length,0);assert.equal(r.writes.length,0);
});
test('authorized private session retains PDF access with per-version receipt',()=>{
 const r=runtime({publicMode:false}),result=r.call('getLibrary('+JSON.stringify(r.token)+')');assert.equal(result.products.length,1);assert.equal(result.pdfs.length,1);assert.match(result.sourceUrl,/synthetic_private_root/);
 const bytes=r.call("getAsset('synthetic_pdf',"+r.control.version+','+JSON.stringify(r.token)+')');assert.equal(bytes.mime,'application/pdf');assert.ok(bytes.base64);
});
test('public mode cannot download private PDF by guessed asset ID',()=>{
 const r=runtime();assert.throws(()=>r.call("getAsset('synthetic_pdf',"+r.control.version+")"),/no está aprobado/);assert.ok(!r.reads.includes('synthetic_pdf'));
});
test('both cash/PVP and report/source/asset date must match exactly',()=>{
 for(const mutate of [r=>r.f.p.precio_contado='19.91',r=>r.f.p.pvp='24.89',r=>r.f.p.fecha_datos_banner='2026-10-26',r=>r.f.p.publicacion_drive.sha256_fuente='d'.repeat(64),r=>r.f.p.publicacion_drive.fecha_corte='2026-10-26']){
  const r=runtime();mutate(r);assert.equal(r.call('getLibrary().products.length'),0);assert.equal(r.writes.length,0);
 }
});
test('new global date never relabels an old asset; render/upload time are not inventory date',()=>{
 const r=runtime();r.f.p.actualizada_al='2099-01-01';r.f.p.publicacion_drive.fecha_generacion='2099-01-01';assert.equal(r.call('getLibrary().products[0].dataDate'),day);
 r.f.p.publicacion_drive.fecha_corte='2026-10-26';assert.equal(r.call('getLibrary().products.length'),0);
});
test('price changes after gallery list are checked again when downloading',()=>{
 const r=runtime(),list=r.call('getLibrary()'),before=JSON.stringify(r.f.manifest);assert.equal(list.products.length,1);
 assert.ok(r.call("getAsset('synthetic_banner',"+r.control.version+")").base64);r.f.prices.productos.TELF001.promo_centavos++;
 assert.throws(()=>r.call("getAsset('synthetic_banner',"+r.control.version+")"),/no está aprobado/);assert.equal(JSON.stringify(r.f.manifest),before);assert.equal(r.writes.length,0);
});
test('unavailable/mixed public source or invalid prices fail before any asset download',()=>{
 for(const mutate of [r=>r.control.pricesStatus=503,r=>r.f.prices.sha256_original='d'.repeat(64),r=>r.f.prices.productos.TELF001.stock=true]){
  const r=runtime();mutate(r);assert.throws(()=>r.call('getLibrary()'),/precios|corte/);assert.ok(!r.reads.includes('synthetic_banner'));
 }
});
test('same asset ID updated after list cannot use the old version or checksum cache',()=>{
 const r=runtime();r.call('getLibrary()');const version=r.control.version;r.control.version++;
 assert.throws(()=>r.call("getAsset('synthetic_banner',"+version+")"),/VERSION_CAMBIO/);
 r.control.version=version;r.files.get('synthetic_banner').bytes=Buffer.from('tampered bytes');
 assert.throws(()=>r.call("getAsset('synthetic_banner',"+version+")"),/VERIFICACION_PENDIENTE/);
});
test('a fresh PDF does not authorize another stale per-version PDF',()=>{
 const r=runtime({publicMode:false}),other=clone(r.f.manifest.catalogos.TEST);other.publicacion_drive.ligero.fecha_corte='2026-10-26';r.f.manifest.catalogos.OLD=other;
 assert.equal(r.call('getLibrary('+JSON.stringify(r.token)+').pdfs.length'),1);
});
test('approval negative/absent, out-of-stock and non-pilot/private SKU cannot appear publicly',()=>{
 for(const mutate of [r=>r.f.p.publicacion_drive.estado_aprobacion='NO_APROBADO',r=>delete r.f.p.publicacion_drive.checksum_descargado,r=>r.f.prices.productos.TELF001.stock=0,r=>r.f.p.sku='PRIVATE001']){
  const r=runtime();mutate(r);assert.equal(r.call('getLibrary().products.length'),0);
 }
});
test('read-only library keeps the original manifest/history/financial fields unchanged',()=>{
 const r=runtime(),before=JSON.stringify(r.f.manifest);r.call('getLibrary()');r.call("getAsset('synthetic_banner',"+r.control.version+")");assert.equal(JSON.stringify(r.f.manifest),before);assert.equal(r.writes.length,0);
});
module.exports={runtime};
