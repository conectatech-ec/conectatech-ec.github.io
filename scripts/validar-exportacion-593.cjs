'use strict';
// No aplica inventario: comprueba que el catálogo publicado coincide con su corte.
function validar({products,inventoryState,cut}){
 const state=inventoryState;
 if(!state||!/^\d{4}-\d{2}-\d{2}$/.test(state.fecha_corte)||!/^[a-f0-9]{64}$/.test(state.origen_sha256))throw Error('Estado de inventario 593 inválido');
 const commercial=!!cut?.productos;
 const hash=commercial?cut.sha256_original:cut?.sha256;
 if(cut?.fecha_corte!==state.fecha_corte||hash!==state.origen_sha256)throw Error('Corte y estado 593 no coinciden');
 if(products.length!==state.sku_web)throw Error('Cobertura web distinta del estado 593');
 const source=commercial?cut.productos:cut.stock_por_sku;
 const seen=new Set();
 for(const p of products){
  if(!/^[A-Z0-9_-]{1,40}$/.test(p.sku)||seen.has(p.sku))throw Error('SKU inválido o duplicado: '+p.sku);
  seen.add(p.sku);
  if(!source||!Object.prototype.hasOwnProperty.call(source,p.sku))throw Error('Falta SKU en corte 593: '+p.sku);
  const stock=commercial?source[p.sku].stock:source[p.sku];
  if(!Number.isInteger(p.stock)||p.stock!==stock)throw Error('Stock distinto del corte 593: '+p.sku);
  if(!Number.isFinite(p.promo)||!Number.isFinite(p.pvp)||p.promo<0||p.pvp<0)throw Error('Precio público inválido: '+p.sku);
  if(commercial&&(Math.round(p.promo*100)!==source[p.sku].promo_centavos||Math.round(p.pvp*100)!==source[p.sku].pvp_centavos))throw Error('Precio distinto del corte 593: '+p.sku);
 }
 if(commercial&&Object.keys(source).length!==products.length)throw Error('Cobertura incompleta del corte comercial 593');
 return true;
}
module.exports={validar};
