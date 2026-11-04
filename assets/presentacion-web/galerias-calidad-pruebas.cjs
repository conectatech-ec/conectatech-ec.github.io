'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const policy=require('./galerias-calidad.json'),control=require('./galerias-calidad.cjs');
const root=path.resolve(__dirname,'../..');let checks=0;
function check(label,value){assert(value,label);checks++;}
const view=row=>({posicion:2,versiones:{'1200':{...row.archivos[0]},'300':{...row.archivos[1]}}});
for(const row of policy.aprobadas){
  const candidate=view(row),before=JSON.stringify(candidate);
  check(row.sku+' archivo comercial cotejado',control.aprobada(row.sku,row.archivos[0].url,row.archivos[1].url));
  check(row.sku+' vista conservada',control.secundarias(row.sku,[candidate]).length===1);
  check(row.sku+' metadatos intactos',JSON.stringify(candidate)===before);
  check(row.sku+' hash de metadatos cambiado bloqueado',control.secundarias(row.sku,[{...candidate,versiones:{...candidate.versiones,'1200':{...candidate.versiones['1200'],sha256:'0'.repeat(64)}}}]).length===0);
  check(row.sku+' portada fuera del filtro de secundarias',control.secundarias(row.sku,[{...candidate,posicion:1}]).length===0);
}
for(const row of policy.retiradas){
  check(row.sku+' referencia retirada',!control.aprobada(row.sku,row.archivos[0].url,row.archivos[1].url));
  const copy={...row,resultado:'PRESENTACION_COMERCIAL_REVISADA'};
  check(row.sku+' rechazo prevalece sobre aprobación contradictoria',!control.crearControl({aprobadas:[copy],retiradas:[row]}).aprobada(row.sku,row.archivos[0].url,row.archivos[1].url));
}
const example=policy.aprobadas[0];
check('SKU cruzado bloqueado',!control.aprobada('OTRO001',example.archivos[0].url,example.archivos[1].url));
check('Secundaria desconocida bloqueada',control.secundarias(example.sku,[{posicion:2,versiones:{'1200':{url:'/imagenes/nueva.webp'},'300':{url:'/imagenes/nueva-300.webp'}}}]).length===0);
check('Galería vacía válida',control.secundarias('AUDI082',[]).length===0);
check('Miniatura ajena bloqueada',!control.aprobada(example.sku,example.archivos[0].url,policy.aprobadas[1].archivos[1].url));
check('Sin revisión visual no basta registrar los hashes',!control.crearControl({aprobadas:[{...example,revision_visual:null}],retiradas:[]}).aprobada(example.sku,example.archivos[0].url,example.archivos[1].url));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ct-galerias-'));
try{
  const files=['/imagenes/TEST001'.toLowerCase()+'/large.webp','/imagenes/test001/small.webp'].map((url,i)=>{
    const data=Buffer.from('imagen de prueba '+i),file=path.join(temp,url);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);
    return {url,sha256:crypto.createHash('sha256').update(data).digest('hex')};
  });
  const tested=control.crearControl({aprobadas:[{sku:'TEST001',archivos:files,resultado:'PRESENTACION_COMERCIAL_REVISADA',revision_visual:'2026-11-04'}],retiradas:[]},temp);
  check('Archivos aprobados aceptados',tested.aprobada('TEST001',files[0].url,files[1].url));
  fs.writeFileSync(path.join(temp,files[0].url),'contenido reemplazado y diferente');
  check('Sustitución de archivo sin nueva revisión bloqueada',!tested.aprobada('TEST001',files[0].url,files[1].url));
  fs.writeFileSync(path.join(temp,files[0].url),'imagen de prueba 0');
  check('Archivo original restablecido reconocido',tested.aprobada('TEST001',files[0].url,files[1].url));
  fs.unlinkSync(path.join(temp,files[1].url));
  check('Archivo ausente bloqueado',!tested.aprobada('TEST001',files[0].url,files[1].url));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
const products=JSON.parse(fs.readFileSync(path.join(root,'index.html'),'utf8').match(/const products=(\[[\s\S]*?\]);\s*\n/)[1]);
const overrides=JSON.parse(fs.readFileSync(path.join(root,'seo-contenido.json'),'utf8'));
const render=require('../../scripts/ficha-comercial.cjs');
for(const sku of ['AUDI082','AUDI095','POWE015']){
  const p=products.find(product=>product.sku===sku),c={...overrides[sku]};
  const available=policy.aprobadas.filter(row=>row.sku===sku),rejected=policy.retiradas.filter(row=>row.sku===sku);
  c.galeria=[...(c.galeria||[]),...available.map(view),...rejected.map(view)];
  const before=JSON.stringify({p,c}),html=render(p,c,'https://conectatech-ec.github.io/productos/prueba/');
  for(const row of available)check(sku+' renderer conserva secundaria revisada',html.includes(row.archivos[0].url));
  for(const row of rejected)check(sku+' renderer impide reincorporar referencia antigua',!html.includes(row.archivos[0].url));
  check(sku+' portada conservada',html.includes(c.imagen));
  check(sku+' precio conservado',html.includes('$'+p.promo.toFixed(2).replace('.',',')));
  check(sku+' objetos comerciales y fotográficos sin mutar',JSON.stringify({p,c})===before);
}
let galleries=0,secondary=0;
for(const dir of fs.readdirSync(path.join(root,'productos'),{withFileTypes:true})){
  if(!dir.isDirectory())continue;
  const file=path.join(root,'productos',dir.name,'index.html');if(!fs.existsSync(file))continue;
  const html=fs.readFileSync(file,'utf8'),sku=dir.name.split('-')[0].toUpperCase();
  check(sku+' ficha sin secundarias no aprobadas',control.filtrarHtml(sku,html)===html);
  galleries+=(html.match(/<div class="gallery">/g)||[]).length;
  for(const body of html.matchAll(/<div class="gallery">([\s\S]*?)<\/div>/g))secondary+=(body[1].match(/<a\b/g)||[]).length;
}
console.log(JSON.stringify({estado:'CORRECTO',comprobaciones:checks,fichasConGaleria:galleries,secundarias:secondary}));
