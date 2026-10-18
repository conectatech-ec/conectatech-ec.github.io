import {assertFresh} from './engine.mjs';
// A future scheduled endpoint must call this guard, never serve a cached CSV blindly.
export function approvedFeed(batch,rows,{approval,verification,now=Date.now()}={}){
 assertFresh(batch,now);
 if(!approval||approval.kind!=='OWNER_APPROVAL'||approval.channel!=='META_CATALOGO'||approval.batch_id!==batch.batch_id||approval.inventory_sha256!==batch.inventory_sha256||approval.allow_external_sync!==true||approval.account_capability_verified!==true||!approval.reference)throw Error('Sin aprobación explícita y capacidad comprobada: sincronización inactiva');
 if(!verification?.checked_at||now-Date.parse(verification.checked_at)>86400000)throw Error('Revalidar fichas e imágenes antes de sincronizar');
 const verified=new Set(verification.results.filter(r=>r.ready_for_feed_review).map(r=>r.sku));const items=new Map(batch.items.map(p=>[p.sku,p]));
 const seen=new Set();
 for(const row of rows){const item=items.get(row.id);if(!item||seen.has(row.id)||!verified.has(row.id)||row.price!==item.price+' USD'||row.image_link!==item.image_url||row.link!==item.product_url||row.title!==item.title||!row.brand||!['in stock','out of stock'].includes(row.availability)||row.availability!==(item.available?'in stock':'out of stock'))throw Error('Feed no coincide con el lote y la evidencia');seen.add(row.id);}
 return rows;
}
