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
function generate(master){
 const input={'datos-593/estado-ultimo-corte.json':JSON.stringify({fecha_corte:'2026-10-22',origen_sha256:'a'.repeat(64)}),'index.html':'const products='+JSON.stringify(products)+';\n','seo-contenido.json':'{}','seo-pages.json':JSON.stringify(Object.fromEntries(products.map(p=>[p.sku,p.sku.toLowerCase()]))),'datos-593/inventario-publico.csv':master};
 const output=new Map();
 const fakeFS={existsSync:p=>p in input,readFileSync:p=>{assert(p in input,p);return input[p];},mkdirSync:()=>{},writeFileSync:(p,v)=>output.set(p,v)};
 vm.runInNewContext(source,{require:n=>n==='fs'?fakeFS:n==='./colecciones-whatsapp.cjs'?require(n):assert.fail(n),URL,console:{log:()=>{}}});
 return output;
}
const files=generate(inventory),lines=files.get('exportaciones/meta-catalogo-piloto.csv').trimEnd().split('\n');
assert.equal(lines[0],'id,title,description,availability,condition,price,link,image_link,brand,product_type');
const base='https://conectatech-ec.github.io';
assert.equal(lines[1],`"TELF001","Teléfono","Teléfono","in stock","new","100.00 USD","${base}/productos/telf001/","${base}/a.webp","ZTE","Celulares"`);
assert.equal(lines[2],`"TELF200","Accesorio","Accesorio","in stock","new","2.00 USD","${base}/productos/telf200/","${base}/b.webp","","ADAPTADORES"`);
assert.equal(lines[3],`"AUDI999","Audio","Audio","in stock","new","5.00 USD","${base}/productos/audi999/","${base}/c.webp","","Audio, ""premium"""`);
assert(lines[5].endsWith(',"",""'));
assert(lines[4].includes('"FIN001","Agotado","Agotado","out of stock"'));
assert(!files.get('exportaciones/contenido-multicanal.csv').includes('FIN001'));
assert.equal(JSON.parse(files.get('exportaciones/resumen-canales.json')).meta_out_of_stock,1);
assert.deepEqual(JSON.parse(files.get('exportaciones/resumen-canales.json')).without_master_category,['OTRO001']);
assert.throws(()=>generate(inventory+'TELF001,OTRA\r\n'),/duplicado/);
assert.throws(()=>generate(inventory.replace('TELF200,ADAPTADORES\r\n','')),/ausente/);
console.log('Meta: categorías maestras, TELF teléfono/accesorio, CSV citado y ausencia de categoría verificados; columnas anteriores intactas.');
