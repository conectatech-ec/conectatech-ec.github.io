import association from './association.json' with {type:'json'};
export {association};
export function publicationState(pointer,cut,candidate){
 const reference_compatible=pointer.referencia==='datos-593/corte-comercial-publico-validado.json';
 const pointer_matches_candidate=pointer.origen_sha256===candidate.source.sha256&&pointer.fecha_corte===candidate.source.cut_date;
 const snapshot_matches_candidate=cut.sha256_original===candidate.source.sha256&&cut.fecha_corte===candidate.source.cut_date;
 return {pointer_cut:pointer.fecha_corte,pointer_sha256:pointer.origen_sha256,snapshot_cut:cut.fecha_corte,snapshot_sha256:cut.sha256_original,reference_compatible,pointer_matches_candidate,snapshot_matches_candidate,version_consistent:pointer_matches_candidate&&snapshot_matches_candidate&&reference_compatible};
}
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
