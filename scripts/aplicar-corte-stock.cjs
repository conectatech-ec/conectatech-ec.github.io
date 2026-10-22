'use strict';
// Publica exclusivamente cantidades y fecha del ultimo corte validado del Sistema 593.
// Nunca modifica precio contado, PVP, costo, imagenes, nombres, URLs ni otros atributos.
const fs=require('fs');
const input='datos-593/corte-stock-validado.json';
const output='datos-593/estado-ultimo-corte.json';
const catalog='index.html';
function planificar(html,source,prior){
 const rx=/const products=(\[[\s\S]*?\]);\s*\n/;
 const match=html.match(rx);
 if(!match)throw Error('No se encuentra el catálogo web');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(source.fecha_corte))throw Error('Fecha de corte inválida');
 if(!/^[a-f0-9]{64}$/.test(source.sha256))throw Error('Huella de origen inválida');
 if(prior && prior.fecha_corte>source.fecha_corte)throw Error('Corte anterior al ya publicado: se evita retroceso');
 const inventory=source.stock_por_sku||{};
 const sku=Object.keys(inventory);
 if(sku.length!==source.cantidad_sku||sku.length<1000)throw Error('Corte parcial o incompleto');
 if(sku.some(s=>!/^[A-Z0-9_-]{3,40}$/.test(s)||!Number.isInteger(inventory[s])||inventory[s]<-10000||inventory[s]>1000000))throw Error('SKU o stock inválidos');
 const products=JSON.parse(match[1]);
 const expected=source.validacion_web||{};
 if(expected.sku_web_esperados && products.length!==expected.sku_web_esperados)throw Error('Cantidad web no coincide con corte');
 const seen=new Set();
 const beforeStock=new Map();
 const updated=products.map(p=>{
  if(seen.has(p.sku))throw Error('SKU duplicado '+p.sku);
  seen.add(p.sku);
  if(!Object.prototype.hasOwnProperty.call(inventory,p.sku))throw Error('Falta SKU web en corte: '+p.sku);
  beforeStock.set(p.sku,p.stock);
  return Object.assign({},p,{stock:inventory[p.sku]});
 });
 const changes=updated.filter(p=>p.stock!==beforeStock.get(p.sku));
 const availability=changes.filter(p=>(p.stock>0)!==(beforeStock.get(p.sku)>0));
 const positives=updated.filter(p=>p.stock>0).length;
 const zeros=updated.filter(p=>p.stock===0).length;
 const negatives=updated.filter(p=>p.stock<0).length;
 const checks=[['cambios_stock_esperados',changes.length],['cambios_disponibilidad_esperados',availability.length],['disponibles_esperados',positives],['agotados_esperados',zeros],['negativos_esperados',negatives]];
 for(const [key,value] of checks)if(expected[key]!==undefined&&expected[key]!==value)throw Error('No coincide la validación '+key+': '+value+' vs '+expected[key]);
 // Descartar incluso cambios accidentales fuera de .stock
 const original=JSON.parse(match[1]);
 for(let i=0;i<original.length;i++){
  const a=Object.assign({},original[i]),b=Object.assign({},updated[i]);delete a.stock;delete b.stock;
  if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Cambio no autorizado: '+original[i].sku);
 }
 const summary={fecha_corte:source.fecha_corte,origen_sha256:source.sha256,sku_fuente:sku.length,sku_web:updated.length,cambios_stock:changes.length,cambios_disponibilidad:availability.length,con_stock:positives,stock_cero:zeros,stock_negativo:negatives,precios_y_demas_atributos_intactos:true};
 const rendered=html.replace(match[0],'const products='+JSON.stringify(updated)+';\n');
 return {summary,rendered,changes};
}
function run(){
 const source=JSON.parse(fs.readFileSync(input,'utf8'));
 const prior=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):null;
 const html=fs.readFileSync(catalog,'utf8');
 const result=planificar(html,source,prior);
 const apply=process.env.APLICAR_STOCK_593==='SI';
 if(apply){
  if(result.rendered!==html)fs.writeFileSync(catalog,result.rendered);
  fs.writeFileSync(output,JSON.stringify(result.summary,null,2)+'\n');
 }
 console.log(JSON.stringify({modo:apply?'APLICADO':'SIMULADO',...result.summary},null,2));
 return result;
}
module.exports={planificar,run};
if(require.main===module)run();
