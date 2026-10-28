const assert=require('node:assert/strict'),crypto=require('node:crypto'),compatible=require('./regla-medios-compatible.cjs');
const media={revision_regla:2,regla:{revision:2,autenticidad:'original verificado',evidencia_autenticidad:'Registro previo',presentacion:'sin caja',instrucciones:''},imagenes:[{posicion:1,sha256_original:'a'.repeat(64)}]};
const rule={...media.regla,revision:3,autenticidad:'genérico/compatible',evidencia_autenticidad:'Registro AAA y confirmación del alias SAM'};
assert(compatible(media,media.regla));assert(!compatible(media,rule));
rule.conservar_medios_comercial={revision_medios:2,revision_comercial:3,sha256_medios:crypto.createHash('sha256').update(JSON.stringify(media)).digest('hex'),motivo:'Sólo cambia la condición comercial; mismos medios aprobados'};
assert(compatible(media,rule));
assert(!compatible({...media,imagenes:[{posicion:1,sha256_original:'b'.repeat(64)}]},rule));
assert(!compatible(media,{...rule,presentacion:'con caja'}));
assert(!compatible(media,{...rule,instrucciones:'Otro encuadre'}));
assert(!compatible(media,{...rule,marcas_excluidas_imagen:['YANTECH']}));
assert(!compatible(media,{...rule,revision:4}));
console.log('Medios: se conserva aprobación sólo con mismos bytes/registro y política fotográfica; cambios de foto o política requieren revisión.');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),apply=require('./aplicar-reglas-medios.cjs');
const before=process.cwd(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'conectatech-condicion-'));
try{
 process.chdir(tmp);fs.mkdirSync('importacion/editorial',{recursive:true});
 const products=[{sku:'CARG001',name:'Cargador Trio'},{sku:'CARG002',name:'Cargador simple'}];
 fs.writeFileSync('index.html','const products='+JSON.stringify(products)+';\n');
 fs.writeFileSync('importacion/reglas-sku.json',JSON.stringify({productos:Object.fromEntries(products.map(p=>[p.sku,{revision:1,autenticidad:'genérico/compatible',presentacion:'sin caja'}])),politica_general:{titulos_comerciales:{condicion_en_titulo:false}}}));
 fs.writeFileSync('importacion/editorial/publicados.json',JSON.stringify({activo:true,productos:{CARG001:{titulo:'Cargador Samsung Trio',subtitulo:''}}}));
 fs.writeFileSync('seo-contenido.json',JSON.stringify({CARG001:{nombre:'Cargador Trio',tituloSeo:'Cargador Trio en Quito'},CARG002:{nombre:'Cargador simple',tituloSeo:'Cargador simple en Quito'}}));
 apply();const result=JSON.parse(fs.readFileSync('index.html','utf8').match(/const products=(\[[\s\S]*?\]);/)[1]),seo=JSON.parse(fs.readFileSync('seo-contenido.json'));
 assert.equal(result[0].name,'Cargador Trio');assert.equal(seo.CARG001.nombre,'Cargador Trio');assert.equal(seo.CARG001.tituloSeo,'Cargador Trio en Quito');assert.equal(seo.CARG001.tipo,'generico');assert.equal(result[1].name,'Cargador simple | compatible');
 console.log('Condición AAA actualizada sin cambiar nombres base ni SEO de presentaciones editoriales.');
}finally{process.chdir(before);fs.rmSync(tmp,{recursive:true,force:true});}
