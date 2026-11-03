// Verificación local de un cambio de consumidor: sin Graph, red, publicación ni credenciales.
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict');
const root=process.cwd(),hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const read=p=>fs.readFileSync(p,'utf8');
function parseCSV(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}
 assert(!quoted,'CSV sin cerrar');if(row.length||cell){row.push(cell);rows.push(row);}
 const columns=rows.shift();assert(columns?.length,'CSV vacío');
 return {columns,rows:rows.map(row=>{assert.equal(row.length,columns.length,'Columnas CSV inconsistentes');return Object.fromEntries(columns.map((c,i)=>[c,row[i]]));})};
}
const protectedFiles=['index.html','seo-contenido.json','seo-pages.json','datos-593/estado-ultimo-corte.json','datos-593/inventario-publico.csv','importacion/editorial/publicados.json','assets/editorial-titulos-datos.js'];
const state=JSON.parse(read('datos-593/estado-ultimo-corte.json'));protectedFiles.push(state.referencia);
const directionSource=read('scripts/fotografia-direccion.cjs'),manifestFiles=[...directionSource.matchAll(/'(importacion\/fotografia-publicada\/direccion-[^']+\.json)'/g)].map(m=>m[1]).filter(f=>fs.existsSync(f));
protectedFiles.push(...manifestFiles);
const assetSHA=new Map();
function asset(url,sha){
 if(typeof url!=='string'||!url.startsWith('/')||!/^[a-f0-9]{64}$/.test(sha||''))return;
 const local=path.resolve(root,'.'+url);assert(local.startsWith(root+path.sep),'Referencia fuera del proyecto');
 assert(!assetSHA.has(local)||assetSHA.get(local)===sha,'Un mismo archivo tiene aprobaciones SHA contradictorias');assetSHA.set(local,sha);
}
function collect(value){
 if(Array.isArray(value)){for(const item of value)collect(item);return;}
 if(!value||typeof value!=='object')return;
 asset(value.url,value.sha256);asset(value.original,value.sha256_original);
 for(const child of Object.values(value))collect(child);
}
for(const file of manifestFiles)collect(JSON.parse(read(file)));
for(const [file,sha]of assetSHA)assert.equal(hash(fs.readFileSync(file)),sha,'SHA-256 distinto en un recurso fotográfico aprobado');
const sourceDigests=new Map(protectedFiles.map(file=>[file,hash(fs.readFileSync(file))]));
const assetStats=new Map([...assetSHA.keys()].map(file=>[file,fs.statSync(file,{bigint:true})]));
const products=JSON.parse(read('index.html').match(/const products=(\[[\s\S]*?\]);\s*\n/)[1]);
const seo=JSON.parse(read('seo-contenido.json')),editorial=JSON.parse(read('importacion/editorial/publicados.json'));
const browser=read('assets/editorial-titulos-datos.js').match(/^\s*window\.CONECTATECH_TITULOS_PRO_DATOS=(\{[\s\S]*\});\s*$/);
assert(browser,'Formato de títulos de la Web no reconocido');
assert.deepEqual(JSON.parse(browser[1]),editorial,'Las aprobaciones consumidas deben coincidir con los títulos publicados en Web');
const browserSourceMatches=true;
const titleEntry=require('../assets/editorial-titulos.js').entry,photos=require('./editorial-fotografia-efectiva.cjs')(products,seo);
const expected=new Map(products.map(p=>[p.sku,{title:titleEntry(p,editorial)?.titulo||seo[p.sku]?.nombre||p.name,image_link:(photos[p.sku]?.imagen||seo[p.sku]?.imagen||p.imageUrl)?new URL(photos[p.sku]?.imagen||seo[p.sku]?.imagen||p.imageUrl,'https://conectatech-ec.github.io').href:''}]));
const files=fs.readdirSync('exportaciones').map(n=>'exportaciones/'+n).filter(f=>fs.statSync(f).isFile());
const before=new Map(files.map(f=>[f,fs.readFileSync(f)]));
function generate(){
 const exporter=path.join(__dirname,'exportar-canales.cjs');
 const write=fs.writeFileSync;let count=0;
 fs.writeFileSync=function(...args){count++;return write.apply(this,args);};
 try{delete require.cache[require.resolve(exporter)];require(exporter);}finally{fs.writeFileSync=write;}
 return count;
}
const writes=generate();
function compareCSV(file,id,allowed){
 const old=parseCSV(before.get(file).toString('utf8')),next=parseCSV(read(file));assert.deepEqual(next.columns,old.columns,'No cambiar contrato CSV');
 const oldByID=new Map(old.rows.map(r=>[r[id],r])),nextByID=new Map(next.rows.map(r=>[r[id],r]));
 assert.equal(oldByID.size,old.rows.length);assert.equal(nextByID.size,next.rows.length);
 assert.deepEqual([...nextByID.keys()].sort(),[...oldByID.keys()].sort(),'Este cambio de consumidor debe conservar los IDs del baseline; sin conteos fijos');
 const changed={title:[],image_link:[]};
 for(const [sku,row]of nextByID){const prior=oldByID.get(sku),canonical=expected.get(sku);assert(canonical,'SKU ajeno a la Web');
  assert.equal(row.title,canonical.title,'Título distinto de la Web: '+sku);assert.equal(row.image_link,canonical.image_link,'Imagen distinta de la Web: '+sku);
  for(const c of old.columns)if(!allowed.includes(c))assert.equal(row[c],prior[c],'Atributo protegido distinto: '+sku+' '+c);
  for(const c of ['title','image_link'])if(row[c]!==prior[c])changed[c].push(sku);
 }
 return {items_before:old.rows.length,items_after:next.rows.length,changed};
}
const meta=compareCSV('exportaciones/meta-catalogo-piloto.csv','id',['title','image_link']);
const shared=compareCSV('exportaciones/contenido-multicanal.csv','sku',['title','facebook_title','image_link']);
const oldSales=JSON.parse(before.get('exportaciones/catalogo-ventas.json')),sales=JSON.parse(read('exportaciones/catalogo-ventas.json'));
assert.deepEqual(sales.productos.map(p=>p.sku),oldSales.productos.map(p=>p.sku));
for(let i=0;i<sales.productos.length;i++){const p=sales.productos[i];assert.equal(p.nombre,expected.get(p.sku).title);assert.deepEqual({...p,nombre:null},{...oldSales.productos[i],nombre:null});}
delete oldSales.fechaCatalogo;delete sales.fechaCatalogo;oldSales.productos=oldSales.productos.map(p=>({...p,nombre:null}));sales.productos=sales.productos.map(p=>({...p,nombre:null}));assert.deepEqual(sales,oldSales);
for(const [file,sha]of sourceDigests)assert.equal(hash(fs.readFileSync(file)),sha,'No modificar fuentes ni inventario: '+file);
for(const [file,stat]of assetStats){const now=fs.statSync(file,{bigint:true});assert.equal(now.mtimeNs,stat.mtimeNs,'No modificar recursos fotográficos');assert.equal(now.size,stat.size);}
const first=new Map(files.map(file=>[file,fs.readFileSync(file)]));
assert.equal(generate(),0,'Repetir el mismo corte y aprobaciones debe producir cero escrituras');
for(const [file,bytes]of first)assert.deepEqual(fs.readFileSync(file),bytes,'El reintento no cambia exportaciones');
const report={solo_lectura_externa:true,sha_assets_validados:assetSHA.size,manifiestos:manifestFiles.length,browser_source_matches:browserSourceMatches,fecha_corte:state.fecha_corte,fuente_sha256:state.origen_sha256,meta_items_before:meta.items_before,meta_items_after:meta.items_after,meta_titles_changed:meta.changed.title.length,meta_images_changed:meta.changed.image_link.length,multichannel_items:shared.items_after,commercial_fields_unchanged:true,source_files_unchanged:true,first_generation_writes:writes,repeated_generation_writes:0,baseline_feed_sha256:hash(before.get('exportaciones/meta-catalogo-piloto.csv')),candidate_feed_sha256:hash(fs.readFileSync('exportaciones/meta-catalogo-piloto.csv')),examples:['AUDI044','AUDI115','REL069','CABL139'].map(sku=>({sku,title_changed:meta.changed.title.includes(sku),image_changed:meta.changed.image_link.includes(sku)}))};
console.log('PARIDAD_META_WEB '+JSON.stringify(report));
