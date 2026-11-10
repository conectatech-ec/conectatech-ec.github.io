// Lectura aislada del mismo controlador de portadas que utiliza la web. No escribe.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const root=fs.realpathSync(process.argv[2]);process.chdir(root);
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const digest=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const direction=require(path.join(root,'scripts/fotografia-direccion.cjs'));
const products=JSON.parse(fs.readFileSync('index.html','utf8').match(/const products=(\[[\s\S]*?\]);\s*\n/)[1]);
const seo=read('seo-contenido.json'),selected=direction.capture();
const files=fs.readdirSync('importacion/fotografia-publicada').filter(f=>/^direccion-.*\.json$/.test(f)).sort().map(f=>'importacion/fotografia-publicada/'+f);
const registries=files.map(f=>[f,read(f)]),out={};
for(const p of products){
 const original=seo[p.sku];if(!original)continue;
 const custom={...original};direction.overlay(p,custom,selected);
 const receipts=[];
 if(custom.imagen!==original.imagen){
  for(const [file,data]of registries){
   const row=data.productos?.[p.sku],photo=row?.imagenProfesional||row?.portada_conservada_profesional;
   if(row?.sku===p.sku&&row.revisado_visual===true&&photo?.versiones?.['1200']?.url===custom.imagen)
    receipts.push({archivo:file,sha256:digest(file)});
  }
  if(!selected.has(p.sku)||!receipts.length)throw Error('PORTADA_SIN_TRAZABILIDAD:'+p.sku);
 }
 // Excepción exacta, ya presente en generar-seo. No se extiende a otros SKU.
 if(p.sku==='PROT003'){
  const file='importacion/fotografia-publicada/PROT003.json',a=read(file),photo=a.imagenProfesional;
  if(a.sku==='PROT003'&&a.aprobado_por_propietario===true&&
     a.maestro_aprobado_sha256==='ec2a21e15462f82bed2c87963ee69e46fc961ad998613a9176be5341f3393f53'&&
     photo?.versiones?.['1200']?.url==='/imagenes/prot003/PROT003-r20261024-01.webp'&&
     [a.imagen_anterior,photo.versiones['1200'].url].includes(custom.imagen)){
   if(digest('.'+photo.original)!==photo.sha256_original||Object.values(photo.versiones).some(v=>digest('.'+v.url)!==v.sha256))throw Error('PROT003_HASH');
   custom.imagen=photo.versiones['1200'].url;custom.imagenProfesional=photo;
   receipts.push({archivo:file,sha256:digest(file)});
  }
 }
 out[p.sku]={imagen:custom.imagen,imagenProfesional:custom.imagenProfesional,nombre:custom.nombre,fuentes:receipts};
}
process.stdout.write(JSON.stringify({source_commit:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),productos:out}));
