// Lectura de las mismas portadas aprobadas que usa generar-seo; no escribe archivos.
const fs=require('fs'),direction=require('./fotografia-direccion.cjs');
function effectivePhotos(products,seo){
 const selected=direction.capture(),out={};
 for(const p of products){
  if(!seo[p.sku])continue;
  const custom={...seo[p.sku]};
  // overlay comprueba SKU autorizado, revisión visual, maestro, anterior y versiones por SHA256.
  direction.overlay(p,custom,selected);
  out[p.sku]={imagen:custom.imagen,imagenProfesional:custom.imagenProfesional};
 }
 return out;
}
module.exports=effectivePhotos;
if(require.main===module){
 const products=JSON.parse(fs.readFileSync('index.html','utf8').match(/const products=(\[[\s\S]*?\]);\s*\n/)[1]);
 const seo=JSON.parse(fs.readFileSync('seo-contenido.json','utf8'));
 process.stdout.write(JSON.stringify(effectivePhotos(products,seo)));
}
