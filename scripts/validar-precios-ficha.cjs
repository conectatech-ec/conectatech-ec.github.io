'use strict';
// Valida también el precio archivado por la presentación oficial de un SKU agotado.
// Los importes y el schema deben seguir coincidiendo con el catálogo en ambos estados.
module.exports=function priceChecks(p,d,money){
 const out=d.schema?.offers;
 const archived=p.stock===0&&d.precio_archivado===true&&!d.precio_visible&&!d.pvp_visible&&d.agotado_visible===true&&out?.availability==='https://schema.org/OutOfStock';
 const shown=p.stock>0&&d.precio_visible===true&&d.pvp_visible===true;
 return {archived,promo:(shown||archived)&&money(d.precio)===Math.round(p.promo*100)&&Math.round(Number(out?.price)*100)===Math.round(p.promo*100)&&out?.priceCurrency==='USD',pvp:(shown||archived)&&money(d.pvp)===Math.round(p.pvp*100),stockCeroVisible:p.stock!==0||d.agotado_visible===true};
};
