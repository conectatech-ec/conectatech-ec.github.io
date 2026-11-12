// Lectura de las mismas portadas aprobadas que usa generar-seo; no escribe archivos.
const fs=require('fs'),crypto=require('crypto'),direction=require('./fotografia-direccion.cjs');
// Reconocer únicamente una portada PNG que YA está publicada y aprobada.
// No promueve propuestas ni cambia la imagen del producto o su observación de fidelidad.
function premiumPublicado(product,registry,hash=url=>{const p='.'+url;return fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;}){
 const r=registry?.productos?.[product.sku];
 if(r?.aprobacion_visual?.aprobado_por_propietario!==true||r.ruta_publicada!==product.imageUrl||
    product.imageUrl!==`/imagenes/${product.sku.toLowerCase()}/${product.sku}-premium-v1.png`||
    !/^[a-f0-9]{64}$/.test(r.sha256_maestro||''))return null;
 return hash(r.ruta_publicada)===r.sha256_maestro?r.ruta_publicada:null;
}
function effectivePhotos(products,seo,options={}){
 const selected=direction.capture(),out={};
 const premium=fs.existsSync('importacion/premium-activo.json')?JSON.parse(fs.readFileSync('importacion/premium-activo.json')):{};
 for(const p of products){
  if(!seo[p.sku])continue;
  const custom={...seo[p.sku]};
  // overlay comprueba SKU autorizado, revisión visual, maestro, anterior y versiones por SHA256.
  direction.overlay(p,custom,selected);
  if(options.conservarPremiumPublicado===true&&custom.imagen!==p.imageUrl){const actual=premiumPublicado(p,premium);if(actual)custom.imagen=actual;}
  out[p.sku]={imagen:custom.imagen,imagenProfesional:custom.imagenProfesional};
 }
 return out;
}
module.exports=effectivePhotos;
module.exports.premiumPublicado=premiumPublicado;
if(require.main===module){
 const products=JSON.parse(fs.readFileSync('index.html','utf8').match(/const products=(\[[\s\S]*?\]);\s*\n/)[1]);
 const seo=JSON.parse(fs.readFileSync('seo-contenido.json','utf8'));
 process.stdout.write(JSON.stringify(effectivePhotos(products,seo,{conservarPremiumPublicado:process.argv.includes('--conservar-premium-publicado')})));
}
