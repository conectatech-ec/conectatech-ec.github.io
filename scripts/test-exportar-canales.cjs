const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/exportar-canales.cjs','utf8');
const products=[
 {sku:'TELF001',name:'Teléfono',category:'Etiqueta de web distinta',stock:1,promo:100,pvp:110,imageUrl:'/a.webp'},
 {sku:'TELF200',name:'Accesorio',category:'Telefonos',stock:2,promo:2,pvp:3,imageUrl:'/b.webp'},
 {sku:'AUDI999',name:'Audio',category:'Otra etiqueta',stock:3,promo:5,pvp:6,imageUrl:'/c.webp'},
 {sku:'FIN001',name:'Agotado',category:'Pilas',stock:0,promo:1,pvp:2,imageUrl:'/agotado.webp'},
 {sku:'OTRO001',name:'Sin categoría',category:'No usar como sustituto',stock:4,promo:7,pvp:8,imageUrl:'/d.webp'}
];
const inventory='\uFEFFsku,categoria\r\nTELF001,TELEFONOS\r\nTELF200,ADAPTADORES\r\nAUDI999,"Audio, ""premium"""\r\nOTRO001,\r\nFIN001,PILAS\r\n';
function generate(master,change=()=>{}){
 const input={'datos-593/estado-ultimo-corte.json':JSON.stringify({fecha_corte:'2026-10-22',origen_sha256:'a'.repeat(64),sku_web:products.length,referencia:'datos-593/corte-comercial-publico-validado.json'}),'index.html':'const products='+JSON.stringify(products)+';\nconst categoryFamilies={"Tablets":"Tablets"};\n','seo-contenido.json':'{}','seo-pages.json':JSON.stringify(Object.fromEntries(products.map(p=>[p.sku,p.sku.toLowerCase()]))),'datos-593/inventario-publico.csv':master};
 input['datos-593/corte-comercial-publico-validado.json']=JSON.stringify({fecha_corte:'2026-10-22',sha256_original:'a'.repeat(64),productos:Object.fromEntries(products.map(p=>[p.sku,{stock:p.stock,promo_centavos:Math.round(p.promo*100),pvp_centavos:Math.round(p.pvp*100)}]))});
 change(input);
 const output=new Map();
 const fakeFS={existsSync:p=>p in input,readFileSync:p=>{assert(p in input,p);return input[p];},mkdirSync:()=>{},writeFileSync:(p,v)=>output.set(p,v)};
 const modules=new Map();
 function fixtureRequire(n){
  if(n==='fs')return fakeFS;
  if(['crypto','node:util'].includes(n))return require(n);
  if(['./editorial-fotografia-efectiva.cjs','./fotografia-direccion.cjs'].includes(n)){
   if(!modules.has(n)){const mod={exports:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/'+n,'utf8'),{module:mod,exports:mod.exports,require:fixtureRequire,console,process});modules.set(n,mod.exports);}
   return modules.get(n);
  }
  if(['./validar-exportacion-593.cjs','./categorias-meta-web.cjs','../assets/editorial-titulos.js'].includes(n))return require(n);
  assert.fail(n);
 }
 try{vm.runInNewContext(source,{require:fixtureRequire,URL,console:{log:()=>{}}});}catch(e){assert.equal(output.size,0,'Un error de validación no debe escribir un lote parcial');throw e;}
 return output;
}
const files=generate(inventory),lines=files.get('exportaciones/meta-catalogo-piloto.csv').trimEnd().split('\n');
assert.equal(lines[0],'id,title,description,availability,condition,price,link,image_link,brand,product_type,custom_label_0');
const base='https://conectatech-ec.github.io';
assert.equal(lines[1],`"TELF001","Teléfono","Teléfono","in stock","new","100.00 USD","${base}/productos/telf001/","${base}/a.webp","ZTE","Celulares",""`);
assert.equal(lines[2],`"TELF200","Accesorio","Accesorio","in stock","new","2.00 USD","${base}/productos/telf200/","${base}/b.webp","","ADAPTADORES",""`);
assert.equal(lines[3],`"AUDI999","Audio","Audio","in stock","new","5.00 USD","${base}/productos/audi999/","${base}/c.webp","","Audio, ""premium""",""`);
assert(lines[5].endsWith(',"","",""'));
assert(lines[4].includes('"FIN001","Agotado","Agotado","out of stock"'));
assert(!files.get('exportaciones/contenido-multicanal.csv').includes('FIN001'));
assert.equal(JSON.parse(files.get('exportaciones/resumen-canales.json')).meta_out_of_stock,1);
assert.deepEqual(JSON.parse(files.get('exportaciones/resumen-canales.json')).without_master_category,['OTRO001']);
assert.throws(()=>generate(inventory+'TELF001,OTRA\r\n'),/duplicado/);
assert.throws(()=>generate(inventory.replace('TELF200,ADAPTADORES\r\n','')),/ausente/);
console.log('Meta: categorías maestras, TELF teléfono/accesorio, CSV citado y ausencia de categoría verificados; columnas anteriores intactas.');

assert.throws(()=>generate(inventory,input=>{const cut=JSON.parse(input['datos-593/corte-comercial-publico-validado.json']);cut.productos.FIN001.stock=1;input['datos-593/corte-comercial-publico-validado.json']=JSON.stringify(cut);}),/Stock distinto/);
assert.throws(()=>generate(inventory,input=>delete input['datos-593/estado-ultimo-corte.json']),/referencia/);
assert.throws(()=>generate(inventory,input=>{const c=JSON.parse(input['datos-593/corte-comercial-publico-validado.json']);c.sha256_original='b'.repeat(64);input['datos-593/corte-comercial-publico-validado.json']=JSON.stringify(c);}),/no coinciden/);
assert([...files.keys()].every(p=>p.startsWith('exportaciones/')),'El exportador no modifica web ni inventario');
// Una aprobación editorial posterior cambia contenido, conservando el mismo ID.
const edited=generate(inventory,input=>{
 input['seo-contenido.json']=JSON.stringify({TELF001:{nombre:'Título aprobado',descripcion:'Descripción aprobada',imagen:'/aprobada.webp',comercialVerificado:true}});
});
const editedLines=edited.get('exportaciones/meta-catalogo-piloto.csv').trimEnd().split('\n');
assert.equal(editedLines.length,lines.length);
assert(editedLines[1].startsWith('"TELF001","Título aprobado","Descripción aprobada"'));
assert(editedLines[1].includes('/aprobada.webp'));
// Un SKU nuevo se incorpora al publicarse con corte y datos completos.
const added=generate(inventory+'NUEVO001,TABLETS\r\n',input=>{
 const nuevo={sku:'NUEVO001',name:'Tablet aprobada',category:'Tablets',stock:1,promo:50,pvp:60,imageUrl:'/nueva.webp'};
 input['index.html']='const products='+JSON.stringify([...products,nuevo])+';\nconst categoryFamilies={"Tablets":"Tablets"};\n';
 const state=JSON.parse(input['datos-593/estado-ultimo-corte.json']);state.sku_web++;input['datos-593/estado-ultimo-corte.json']=JSON.stringify(state);
 const cut=JSON.parse(input['datos-593/corte-comercial-publico-validado.json']);cut.productos[nuevo.sku]={stock:1,promo_centavos:5000,pvp_centavos:6000};input['datos-593/corte-comercial-publico-validado.json']=JSON.stringify(cut);
 input['seo-contenido.json']=JSON.stringify({NUEVO001:{comercialVerificado:true}});
 const urls=JSON.parse(input['seo-pages.json']);urls[nuevo.sku]='tablet-nueva';input['seo-pages.json']=JSON.stringify(urls);
});
assert.equal(added.get('exportaciones/meta-catalogo-piloto.csv').trimEnd().split('\n').length,lines.length+1);
const newPlan=JSON.parse(added.get('exportaciones/whatsapp-organizacion-pendiente.json'));
assert(newPlan.colecciones['Tablets'].includes('NUEVO001'));
assert.equal(newPlan.publicacion_habilitada,false);

// Consumir títulos vigentes de la Web sin tocar descripción, reglas ni finanzas.
const withTitle=(overrides={})=>generate(inventory,input=>{
 input['importacion/editorial/publicados.json']=JSON.stringify({activo:true,productos:{AUDI999:{titulo:'Audio aprobado en Web',subtitulo:'',mostrarTituloEnFicha:true}},...overrides});
});
const titled=withTitle(),metaFile='exportaciones/meta-catalogo-piloto.csv';
assert.equal(titled.get(metaFile).replace('"Audio aprobado en Web"','"Audio"'),files.get(metaFile));
assert(titled.get('exportaciones/contenido-multicanal.csv').includes('"AUDI999","Audio aprobado en Web","Audio"'));
assert.equal(JSON.parse(titled.get('exportaciones/catalogo-ventas.json')).productos.find(p=>p.sku==='AUDI999').nombre,'Audio aprobado en Web');
assert.equal(withTitle({activo:false}).get(metaFile),files.get(metaFile));
assert.equal(withTitle({excluirPrefijos:['AUDI']}).get(metaFile),files.get(metaFile));
assert.equal(withTitle().get(metaFile),titled.get(metaFile),'Mismo título aprobado: mismo feed');

// Ejecutar el controlador fotográfico oficial con SHA-256 reales y archivos aislados.
const crypto=require('crypto'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const oldImage='/imagenes/audi044/AUDI044-01.webp',newImage='/imagenes/audi044/AUDI044-r2026102709-01.webp';
const originalBytes='original aprobado',newBytes='portada revisada aprobada';
function photoFeed(change=()=>{}){
 return generate(inventory.replace('TELF001,','AUDI044,'),input=>{
  const productRows=JSON.parse(input['index.html'].match(/const products=(\[[\s\S]*?\]);/)[1]);
  productRows[0]={...productRows[0],sku:'AUDI044',imageUrl:oldImage};
  input['index.html']='const products='+JSON.stringify(productRows)+';\nconst categoryFamilies={"Tablets":"Tablets"};\n';
  const state=JSON.parse(input['datos-593/corte-comercial-publico-validado.json']);state.productos.AUDI044=state.productos.TELF001;delete state.productos.TELF001;input['datos-593/corte-comercial-publico-validado.json']=JSON.stringify(state);
  input['seo-pages.json']=JSON.stringify(Object.fromEntries(productRows.map(p=>[p.sku,p.sku.toLowerCase()])));
  const before={original:oldImage,sha256_original:sha(originalBytes),versiones:{'1200':{url:oldImage,sha256:sha(originalBytes)}}};
  const after={original:oldImage,sha256_original:sha(originalBytes),versiones:{'1200':{url:newImage,sha256:sha(newBytes)}}};
  input['seo-contenido.json']=JSON.stringify({AUDI044:{imagen:oldImage,imagenProfesional:before,imagenPendiente:false,nombre:'Título base intacto',descripcion:'Descripción aprobada intacta'}});
  input['.'+oldImage]=originalBytes;input['.'+newImage]=newBytes;
  input['importacion/fotografia-publicada/direccion-20261026-05.json']=JSON.stringify({productos:{AUDI044:{sku:'AUDI044',revisado_visual:true,portada_anterior:{url:oldImage,sha256:sha(originalBytes)},imagenProfesional:after}}});
  change(input);
 });
}
const approvedPhoto=photoFeed(),approvedFeed=approvedPhoto.get(metaFile),basePhoto=photoFeed(input=>delete input['importacion/fotografia-publicada/direccion-20261026-05.json']).get(metaFile);
assert(approvedFeed.includes(newImage));
assert.equal(approvedFeed.replace(newImage,oldImage),basePhoto,'Solo image_link cambia; IDs, descripción y todos los campos comerciales idénticos');
assert.equal(photoFeed().get(metaFile),approvedFeed,'Misma foto y SHA: feed idéntico, sin versión por tiempo');
assert.notEqual(sha(approvedFeed),sha(basePhoto),'Foto aprobada nueva: cambia SHA del feed para deduplicación existente');
assert.equal(photoFeed(input=>input['.'+newImage]='bytes distintos sin aprobación').get(metaFile),basePhoto,'SHA incorrecto: conservar portada anterior');
assert.equal(photoFeed(input=>{
 const key='importacion/fotografia-publicada/direccion-20261026-05.json',registry=JSON.parse(input[key]);registry.productos.AUDI044.revisado_visual=false;input[key]=JSON.stringify(registry);
}).get(metaFile),basePhoto,'Foto bloqueada/no revisada: conservar portada anterior');
assert.equal(photoFeed(input=>{
 const seo=JSON.parse(input['seo-contenido.json']);seo.AUDI044.imagenProfesional.versiones['1200'].sha256='f'.repeat(64);input['seo-contenido.json']=JSON.stringify(seo);
}).get(metaFile),basePhoto,'Una portada anterior sin autorización compatible no admite sustitución');
assert(approvedPhoto.get('exportaciones/contenido-multicanal.csv').includes(newImage));
assert([...approvedPhoto.keys()].every(p=>p.startsWith('exportaciones/')),'No escribir imágenes, Web, reglas ni inventario');
assert.throws(()=>photoFeed(input=>input['importacion/fotografia-publicada/direccion-20261026-05.json']='{'),/JSON|Unexpected|Expected/);
console.log('Sincronización Web: títulos oficiales, exclusiones, fotos aprobadas, repetidas, SHA incorrecto y bloqueadas; solo campos editoriales autorizados cambian.');

// Misma entrada + exportaciones previas: cero escrituras y fechas conservadas.
const noOp=generate(inventory,input=>{
 for(const [path,value] of files)input[path]=value;
 const sales=JSON.parse(input['exportaciones/catalogo-ventas.json']);sales.fechaCatalogo='2020-01-01T00:00:00.000Z';input['exportaciones/catalogo-ventas.json']=JSON.stringify(sales)+'\n';
 const summary=JSON.parse(input['exportaciones/resumen-canales.json']);summary.generated_at='2020-01-01T00:00:00.000Z';input['exportaciones/resumen-canales.json']=JSON.stringify(summary,null,2)+'\n';
});
assert.equal(noOp.size,0,'Un reintento idéntico no escribe archivos ni renueva fechas');
const changedAfterPrevious=generate(inventory,input=>{
 for(const [path,value] of files)input[path]=value;
 input['importacion/editorial/publicados.json']=JSON.stringify({activo:true,productos:{AUDI999:{titulo:'Audio aprobado en Web',subtitulo:''}}});
});
assert(changedAfterPrevious.has(metaFile));
assert(changedAfterPrevious.has('exportaciones/catalogo-ventas.json'));
assert(!changedAfterPrevious.has('exportaciones/resumen-canales.json'),'Resumen semánticamente idéntico conserva fecha');
console.log('Reintento idéntico: 0 escrituras; cambios aprobados regeneran únicamente los archivos afectados.');

