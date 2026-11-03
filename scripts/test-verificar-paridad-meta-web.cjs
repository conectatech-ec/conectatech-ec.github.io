'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'ct-meta-web-')),sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const write=(file,value)=>{const target=path.join(temp,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,typeof value==='string'?value:JSON.stringify(value)+'\n');};
function run(file){
 const cwd=process.cwd(),log=console.log,output=[];
 for(const cached of Object.keys(require.cache))if(cached.startsWith(temp+path.sep))delete require.cache[cached];
 try{process.chdir(temp);console.log=(...args)=>output.push(args.join(' '));require(path.join(temp,file));return output.join('\n');}finally{process.chdir(cwd);console.log=log;}
}
try{
 for(const file of ['scripts/exportar-canales.cjs','scripts/validar-exportacion-593.cjs','scripts/categorias-meta-web.cjs','scripts/prioridad-comercial-meta.cjs','scripts/editorial-fotografia-efectiva.cjs','scripts/fotografia-direccion.cjs','scripts/verificar-paridad-meta-web.cjs','scripts/presentacion-publica-alex.cjs','assets/editorial-titulos.js'])write(file,fs.readFileSync(path.join(project,file),'utf8'));
 const old='/imagenes/audi044/AUDI044-01.webp',next='/imagenes/audi044/AUDI044-r2026102709-01.webp',oldBytes='anterior aprobada',nextBytes='nueva aprobada';
 const p={sku:'AUDI044',name:'Audífonos anteriores',category:'Audio',stock:3,promo:10,pvp:12,imageUrl:next};
 write('index.html','const products='+JSON.stringify([p])+';\nconst categoryFamilies={"Audio":"Audio"};\n');
 write('seo-contenido.json',{AUDI044:{nombre:p.name,descripcion:'Descripción intacta',imagen:old,imagenProfesional:{original:old,sha256_original:sha(oldBytes),versiones:{'1200':{url:old,sha256:sha(oldBytes)}}},imagenPendiente:false,comercialVerificado:true}});
 write('seo-pages.json',{AUDI044:'audi044-audifonos'});
 write('datos-593/estado-ultimo-corte.json',{fecha_corte:'2026-11-02',origen_sha256:'a'.repeat(64),sku_web:1,referencia:'datos-593/corte-comercial-publico-validado.json'});
 write('datos-593/corte-comercial-publico-validado.json',{fecha_corte:'2026-11-02',sha256_original:'a'.repeat(64),productos:{AUDI044:{stock:3,promo_centavos:1000,pvp_centavos:1200}}});
 write('datos-593/inventario-publico.csv','sku,categoria\nAUDI044,AUDIO\n');
 const editorial={activo:true,productos:{AUDI044:{titulo:'Audífonos aprobados en Web',subtitulo:'',mostrarTituloEnFicha:true}}};
 write('importacion/editorial/publicados.json',editorial);
 const browserTitleData='window.CONECTATECH_TITULOS_PRO_DATOS='+JSON.stringify(editorial)+';\n';
 write('assets/editorial-titulos-datos.js',browserTitleData);
 const revisedPhoto={original:old,sha256_original:sha(oldBytes),versiones:{'1200':{url:next,sha256:sha(nextBytes)}}};
 write('importacion/fotografia-publicada/direccion-20261026-05.json',{productos:{AUDI044:{sku:'AUDI044',revisado_visual:true,portada_anterior:{url:old,sha256:sha(oldBytes)},imagenProfesional:revisedPhoto}}});
 write(old.slice(1),oldBytes);write(next.slice(1),nextBytes);
 // Baseline anterior equivalente a la Web sin consumir las aprobaciones nuevas.
 const exporter=fs.readFileSync(path.join(project,'scripts/exportar-canales.cjs'),'utf8');
 write('scripts/exportar-canales.cjs',exporter.replace('const titleFor=p=>editorialTitles.entry(p,editorial)?.titulo||content[p.sku]?.nombre||p.name;','const titleFor=p=>content[p.sku]?.nombre||p.name;').replace("const imageFor=p=>photos[p.sku]?.imagen||content[p.sku]?.imagen||p.imageUrl||'';","const imageFor=p=>content[p.sku]?.imagen||p.imageUrl||'';"));
 run('scripts/exportar-canales.cjs');write('scripts/exportar-canales.cjs',exporter);
 const result=run('scripts/verificar-paridad-meta-web.cjs');
 const report=JSON.parse(result.match(/PARIDAD_META_WEB (.*)/)[1]);assert.equal(report.meta_items_before,1);assert.equal(report.meta_items_after,1);assert.equal(report.meta_titles_changed,1);assert.equal(report.meta_images_changed,1);assert.equal(report.sha_assets_validados,2);assert.equal(report.repeated_generation_writes,0);assert.equal(report.browser_source_matches,true);
 const valid=fs.readFileSync(path.join(temp,'exportaciones/meta-catalogo-piloto.csv'));
 const drift=JSON.parse(JSON.stringify(editorial));drift.productos.AUDI044.titulo='Título diferente servido en Web';
 write('assets/editorial-titulos-datos.js','window.CONECTATECH_TITULOS_PRO_DATOS='+JSON.stringify(drift)+';\n');
 assert.throws(()=>run('scripts/verificar-paridad-meta-web.cjs'),/aprobaciones consumidas deben coincidir/);
 assert.deepEqual(fs.readFileSync(path.join(temp,'exportaciones/meta-catalogo-piloto.csv')),valid,'Un drift Web/editorial se rechaza antes de generar y conserva el feed validado');
 write('assets/editorial-titulos-datos.js','window.CONECTATECH_TITULOS_PRO_DATOS={};unexpected();\n');
 assert.throws(()=>run('scripts/verificar-paridad-meta-web.cjs'),/Formato de títulos de la Web no reconocido/);
 assert.deepEqual(fs.readFileSync(path.join(temp,'exportaciones/meta-catalogo-piloto.csv')),valid);
 write('assets/editorial-titulos-datos.js',browserTitleData);
 write(next.slice(1),'alterada sin aprobar');assert.throws(()=>run('scripts/verificar-paridad-meta-web.cjs'),/SHA-256 distinto/);assert.deepEqual(fs.readFileSync(path.join(temp,'exportaciones/meta-catalogo-piloto.csv')),valid,'Un fallo SHA anterior a generación conserva el feed validado');
 console.log('Verificador: generación real, contratos comerciales, SHA de recursos, cero escrituras al repetir y rechazo de drift Web/editorial o alteraciones antes de aceptar.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
