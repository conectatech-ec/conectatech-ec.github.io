const FEED='https://raw.githubusercontent.com/conectatech-ec/conectatech-ec.github.io/main/exportaciones/catalogo-ventas.json';
export const LIVE_FEED=FEED;
export async function refreshCatalog(baseline,fetcher=fetch,now=Date.now()) {
 const source=await readCatalogSnapshot(baseline,fetcher,now);
 if(now-Date.parse(source.fuente_fecha)>86400000)throw Error('feed_expired_or_invalid');
 return source;
}
// Old published data can identify products, never authorize a current quote by itself.
export async function readCatalogSnapshot(baseline,fetcher=fetch,now=Date.now(),selectExtra=null,allowIdentityRefresh=false) {
 const response=await fetcher(FEED,{headers:{'Accept':'application/json'},signal:AbortSignal.timeout(10000),cf:{cacheTtl:60,cacheEverything:true}});
 if(!response.ok) throw Error('feed_unavailable');
 const text=await response.text(); if(text.length>1500000) throw Error('feed_size');
 const feed=JSON.parse(text),stamp=Date.parse(feed.fechaCatalogo);
 if(!Number.isFinite(stamp)||stamp>now+300000) throw Error('feed_expired_or_invalid');
 if(!Array.isArray(feed.productos)) throw Error('feed_invalid');
 const extras=selectExtra?selectExtra(feed.productos).filter(p=>!baseline.productos.some(b=>b.sku===p.sku)).map(p=>({...p,descripcion:'',caracteristicas:{},foto:null,foto_sha256:null,banner:null,banner_sha256:null})):[];
 const products=[...baseline.productos,...extras].map(old=>{
  const matches=feed.productos.filter(p=>p.sku===old.sku);
  // Exporter excludes zero stock: missing SKU is unavailable, never baseline stock.
  if(matches.length===0) return {...old,stock:0,disponible:false,anuncio:`${old.nombre}\nSKU ${old.sku}: sin disponibilidad confirmada.\n${old.url}`};
  if(matches.length!==1) throw Error('duplicate_sku');
  const p=matches[0];
  if(!Number.isFinite(p.promo)||p.promo<=0||!Number.isFinite(p.pvp)||p.pvp<=0||!Number.isInteger(p.stock)||p.stock<0||(!allowIdentityRefresh&&p.url!==old.url)||!p.url?.startsWith('https://conectatech-ec.github.io/productos/')) throw Error('invalid_commercial_data');
  // Changed product identity requires an explicit bundle refresh, not inferred compatibility.
  if(p.nombre!==old.nombre||p.url!==old.url){
   if(!allowIdentityRefresh)throw Error('product_changed_refresh_required');
   // New published identity is usable, but old specs and media cannot follow it blindly.
   return {...old,...p,public_name:p.nombre,descripcion:'',caracteristicas:{},foto:null,foto_sha256:null,banner:null,banner_sha256:null};
  }
  const anuncio=`${old.nombre}\n${old.descripcion}\nPROMO CONTADO $${p.promo.toFixed(2)} · PVP $${p.pvp.toFixed(2)}\nSKU ${p.sku} · Stock referencial: ${p.stock}. Sujeto a confirmación.\n${p.url}`;
  return {...old,promo:p.promo,pvp:p.pvp,stock:p.stock,disponible:p.stock>0,anuncio};
 });
 return {...baseline,fuente_fecha:feed.fechaCatalogo,consultado_en:new Date(now).toISOString(),fuente_url:FEED,productos:products};
}
export async function verifyAssets(product,fetcher=fetch) {
 const evidence=[];
 for(const kind of ['foto','banner']) {
  if(!product[kind]) continue;
  const r=await fetcher(product[kind],{signal:AbortSignal.timeout(10000),cf:{cacheTtl:60,cacheEverything:true}});
  if(!r.ok) throw Error('asset_unavailable');
  const bytes=await r.arrayBuffer(); if(bytes.byteLength>2000000) throw Error('asset_size');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==product[kind+'_sha256']) throw Error('asset_changed_refresh_required');
  evidence.push({tipo:kind,sha256:digest,bytes:bytes.byteLength});
 }
 return evidence;
}
