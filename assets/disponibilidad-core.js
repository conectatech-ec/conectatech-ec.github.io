/* CONECTATECH: motor compartido de disponibilidad v1. Derivado del motor validado.
 * Consume exclusivamente stock del catálogo validado; sin caducidad comercial automática. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CONECTATECH_AVAILABILITY=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const STATES=Object.freeze(["available","out_of_stock","review_required","unknown","discontinued"]);
const invariant=(ok,message)=>{if(!ok)throw Error(message);};
const validSKU=s=>typeof s==='string'&&/^[A-Z0-9_-]{3,40}$/.test(s);
function stockStatus(row) {
  if (row.discontinued===true) { invariant(typeof row.evidence==='string' && row.evidence.trim(), 'Discontinued requires explicit evidence'); return 'discontinued'; }
  if (row.stock===null) return 'unknown';
  invariant(typeof row.stock==='number' && Number.isFinite(row.stock) && Math.abs(row.stock)<=1e9, 'Invalid stock');
  return row.stock>0?'available':row.stock===0?'out_of_stock':'review_required';
}
function publicAvailability(item) {
  const status=item?.status || 'unknown';
  invariant(STATES.includes(status),'Unknown state');
  return {status,label:({available:'Disponible',out_of_stock:'Agotado',review_required:'No disponible',unknown:'Consultar disponibilidad',discontinued:'Descontinuado'})[status],
    message:({available:'Confirma existencias antes de acordar la entrega.',out_of_stock:'Temporalmente agotado',review_required:'No disponible',unknown:'Consultar disponibilidad',discontinued:'Producto descontinuado'})[status],
    main_catalog:status==='available' || status==='unknown',commercial_eligible:status==='available',
    immediate_purchase:false,requires_stock_confirmation:true,replenishment:status==='out_of_stock'};
}
function whatsappURL(product, item) {
  invariant(validSKU(product.sku) && typeof product.name==='string','Product identity required');
  const status=publicAvailability(item).status;
  const message=status==='out_of_stock'?`Hola, quisiera consultar la reposición de ${product.name}, código ${product.sku}.`:
    `Hola, quisiera consultar la disponibilidad de ${product.name}, código ${product.sku}.`;
  return 'https://wa.me/593998576759?text='+encodeURIComponent(message);
}
function forProduct(product){try{return publicAvailability({status:stockStatus(product)});}catch{return publicAvailability();}}
return Object.freeze({STATES,stockStatus,publicAvailability,whatsappURL,forProduct});
});
