// Readers of existing contracts. No secondary catalog, import endpoint or image factory.
export function fromSharedCommercialSource(source,sku){
 if(source?.schema!=='conectatech.commercial.v1'||source.presentation?.source_sha256!==source.source?.sha256)throw Error('EXISTING_HUB_VERSION');
 const row=source.products?.find(p=>p.sku===sku),display=source.presentation.products?.[sku];
 if(!row||row.availability!=='in_stock'||row.blocked_reasons?.length||!display?.approved_media)return null;
 return {sku,title:display.display_title||row.name,description:row.description||'',priceCents:row.prices?.promo_cash_cents,pvpCents:row.prices?.pvp_card_cents,available:true,url:row.web?.url||row.web?.product_url,approvedMedia:display.approved_media,sourceDigest:source.source.sha256,validUntil:source.expires_at};
}
export function existingRafaAssociation(association){
 if(association?.schema!=='conectatech.marketplace_association.v1'||association.publication_evidence!=='owner_confirmed_real_listing')throw Error('RAFA_EXISTING_ASSOCIATION');
 const url=new URL(association.listing_url);if(url.protocol!=='https:'||!['facebook.com','www.facebook.com'].includes(url.hostname)||!/^\/(?:share\/[A-Za-z0-9]+|marketplace\/item\/\d+)\/?$/.test(url.pathname))throw Error('RAFA_EXISTING_URL');
 return {memberId:'COL001',sku:association.sku,existingListing:{id:association.association_id,url:url.href,verifiedByOwner:true,canonicalListingId:association.canonical_listing_id||null,independentlyVerified:association.independent_public_verification==='verified'}};
}
export function signatureFromExistingLibrary(library,sku,sourceDigest,priceCents){
 const p=library?.products?.[sku];
 if(library?.schema!=='conectatech.approved_library.handoff.v1'||library.live_registry_connection_verified!==true||library.no_send_to_buyers!==false||library.messaging_enabled!==true||!p?.visual_approved||!p.publication_verified||!p.delivery_allowed)return null;
 if(p.source_sha256!==sourceDigest||p.price_cents!==priceCents||!p.url||!p.sha256)return null;
 return {productSku:sku,sourceDigest,priceCents,url:p.url,sha256:p.sha256,approved:true,containsBox:false};
}
export function fromExistingAlexCatalog(source,sku){
 const p=source?.productos?.find(p=>p.sku===sku);if(!source.prices_cross_checked||!p?.price_verified||!p.disponible||p.central_availability!=='in_stock'||!p.foto||!p.foto_sha256)return null;
 return {sku,title:p.public_name||p.nombre,description:p.descripcion||'',priceCents:Math.round(p.promo*100),pvpCents:Math.round(p.pvp*100),available:true,url:p.url,approvedMedia:{url:p.foto,sha256:p.foto_sha256},sourceDigest:source.source_sha256,validUntil:source.expires_at};
}
