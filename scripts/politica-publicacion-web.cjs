'use strict';
// Orden expresa de Direccion General, 15/11/2026. Politica de exposicion,
// nunca bajas, stock cero, cambios de precios ni borrado del inventario 593.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const SKUS=new Set(['ENCH003','FLAS013','FLAS014','FLAS017','FLAS033','FOCO004']);
const BRAND=/\bSTEREN\b/i;
function excluded(p,meta={}){
 if(typeof p==='string')p={sku:p};
 return SKUS.has(p?.sku)||[p?.brand,p?.marca,p?.name,p?.nombre,p?.specs?.Marca,meta?.brand,meta?.marca,meta?.caracteristicas?.Marca,meta?.nombre].some(v=>typeof v==='string'&&BRAND.test(v));
}
let metadata;
function sourceMetadata(){
 if(metadata)return metadata;
 metadata={};
 const seo=path.join(root,'seo-contenido.json');if(fs.existsSync(seo))Object.assign(metadata,JSON.parse(fs.readFileSync(seo,'utf8')));
 const file=path.join(root,'datos-593/inventario-publico.csv');
 if(fs.existsSync(file))for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
  const match=/^"?([A-Z0-9_-]+)"?,/.exec(line);
  if(match&&BRAND.test(line))metadata[match[1]]={...metadata[match[1]],brand:'STEREN'};
 }
 return metadata;
}
function deniedSku(sku){return excluded({sku},sourceMetadata()[sku]);}
function visible(products){return products.filter(p=>!excluded(p,sourceMetadata()[p.sku]));}
function previousCut(prior,current){
 if(!prior?.origen_sha256)return null;
 if((current?.sha256_original||current?.sha256)===prior.origen_sha256)return current;
 const cp=require('child_process');
 // Git es el historico existente; no se crea otra copia maestra de inventario.
 for(const file of ['datos-593/corte-comercial-publico-validado.json','datos-593/corte-stock-validado.json']){
  const commits=cp.execFileSync('git',['log','--format=%H','--',file],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
  for(const commit of commits){let c;try{c=JSON.parse(cp.execFileSync('git',['show',commit+':'+file],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024}));}catch{continue;}
   if((c.sha256_original||c.sha256)===prior.origen_sha256)return c;
  }
 }
 throw Error('No se encontro el corte previo validado; conservar ultimo inventario');
}
function completeForValidation(products,source,baseline){
 const all=[...products],seen=new Set(all.map(p=>p.sku));
 const sourceRows=source.productos||source.stock_por_sku||{};
 const oldRows=baseline?.productos||baseline?.stock_por_sku||{};
 for(const sku of Object.keys(oldRows))if(deniedSku(sku)&&!Object.hasOwn(sourceRows,sku))throw Error('La exclusión web no permite omitir inventario conservado: '+sku);
 for(const sku of Object.keys(sourceRows))if(!seen.has(sku)&&deniedSku(sku)){
  const b=oldRows[sku];if(b===undefined)throw Error('Falta el corte previo para validar SKU excluido: '+sku);
  all.push({sku,stock:typeof b==='object'?b.stock:b,promo:typeof b==='object'?b.promo_centavos/100:undefined,pvp:typeof b==='object'?b.pvp_centavos/100:undefined});
 }
 return all;
}
const retired='<html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Producto retirado del catálogo | CONECTATECH</title></head><body><main><h1>Producto retirado del catálogo</h1><p>Esta referencia ya no está disponible en nuestra web.</p><a href="/">Volver al catálogo</a></main></body></html>\n';
function apply(){
 const web=path.join(root,'index.html'),rx=/const products=(\[[\s\S]*?\]);\s*\n/;
 let html=fs.readFileSync(web,'utf8');const m=html.match(rx);if(!m)throw Error('No se encontro catalogo para aplicar exclusion');
 const all=JSON.parse(m[1]),keep=visible(all),pagesFile=path.join(root,'seo-pages.json');
 const pages=JSON.parse(fs.readFileSync(pagesFile,'utf8'));
 for(const [sku,slug]of Object.entries(pages))if(deniedSku(sku)){
  if(!/^[a-z0-9-]+$/.test(slug))throw Error('Ruta retirada invalida');
  const dir=path.join(root,'productos',slug);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'index.html'),retired);delete pages[sku];
 }
 html=html.replace(m[0],'const products='+JSON.stringify(keep)+';\n');
 for(const key of ['productFrames','seoPages']){
  const re=new RegExp('const '+key+'=(\\{[^\\n]*\\});\\s*\\n');const found=html.match(re);if(!found)continue;
  const data=JSON.parse(found[1]);for(const sku of Object.keys(data))if(deniedSku(sku))delete data[sku];
  html=html.replace(found[0],'const '+key+'='+JSON.stringify(data)+';\n');
 }
 if(html!==fs.readFileSync(web,'utf8'))fs.writeFileSync(web,html);
 const encoded=JSON.stringify(pages,null,2)+'\n';if(encoded!==fs.readFileSync(pagesFile,'utf8'))fs.writeFileSync(pagesFile,encoded);
 return {removed:all.filter(p=>!keep.includes(p)).map(p=>p.sku),publicCount:keep.length};
}
module.exports={excluded,deniedSku,visible,previousCut,completeForValidation,apply,retired};
if(require.main===module)console.log(JSON.stringify(apply()));
