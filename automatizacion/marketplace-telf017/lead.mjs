import association from './association.json' with {type:'json'};
export {association};
export function handoff(){
 const message='Vengo de Marketplace por el Redmi 15C de 128 GB. Anuncio: '+association.listing_url+' Quiero confirmar precio, disponibilidad y entrega.';
 return {message,url:'https://wa.me/593998576759?text='+encodeURIComponent(message),requires_customer_send:true,automatic_history_transfer:false,Alex_connected_to_WhatsApp:false};
}
export function resolveLead(text){
 const urls=String(text||'').match(/https:\/\/[^\s<>"']+/g)||[];
 if(!urls.some(raw=>{try{const u=new URL(raw.replace(/[),.!]+$/,'')),a=new URL(association.listing_url);return ['facebook.com','www.facebook.com'].includes(u.hostname)&&u.protocol==='https:'&&u.pathname.replace(/\/$/,'')===a.pathname.replace(/\/$/,'');}catch{return false;}}))return null;
 const capacity=String(text).match(/\b(\d+)\s*GB\b/i),changed=capacity&&Number(capacity[1])!==association.storage_gb;
 return {association_id:association.association_id,listing_sku:association.sku,requested_sku:changed?null:association.sku,needs_variant_clarification:!!changed,attribution_only:true,grants_sender_authorization:false};
}
