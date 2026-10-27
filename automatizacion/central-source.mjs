import central from './central/current.json' with {type:'json'};
import enrichment from './central/enrichment.json' with {type:'json'};
export {central};
export function validateCentral(data,now=Date.now(),requireFresh=false){
 if(data?.schema!=='conectatech.commercial.v1'||!Array.isArray(data.products)||data.products.length>5000||!/^[a-f0-9]{64}$/.test(data.source?.sha256||''))throw Error('CENTRAL_SCHEMA');
 const generated=Date.parse(data.source.generated_at),expires=Date.parse(data.expires_at);
 if(!Number.isFinite(generated)||generated>now+300000||expires!==generated+86400000||requireFresh&&expires<now)throw Error('CENTRAL_DATE');
 const seen=new Set();for(const p of data.products){
  if(!/^[A-Z0-9_-]{3,40}$/.test(p.sku)||seen.has(p.sku)||!['in_stock','out_of_stock','blocked'].includes(p.availability)||!Array.isArray(p.blocked_reasons))throw Error('CENTRAL_PRODUCT');seen.add(p.sku);
  if(p.availability!=='blocked'&&(!p.prices||p.prices.currency!=='USD'||![p.prices.promo_cash_cents,p.prices.pvp_card_cents].every(n=>Number.isSafeInteger(n)&&n>0)||p.prices.pvp_card_cents<p.prices.promo_cash_cents))throw Error('CENTRAL_PRICE');
  if(Object.hasOwn(p,'stock')||Object.hasOwn(p,'cost')||Object.hasOwn(p,'quantity'))throw Error('CENTRAL_PRIVATE_FIELD');
 }
 return data;
}
export function sourceToAlex(seed,data,selectExtra,now=Date.now()){
 validateCentral(data,now);const all=data.products.map(p=>({sku:p.sku,nombre:p.name,catalog_identity:p.source_name})),selected=selectExtra?selectExtra(all).filter(p=>!seed.productos.some(s=>s.sku===p.sku)):[];
 const products=[...seed.productos,...selected.map(p=>({...p,descripcion:'',caracteristicas:{},foto:null,foto_sha256:null,banner:null,banner_sha256:null}))].map(old=>{
  const p=data.products.find(p=>p.sku===old.sku),valid=p&&p.availability!=='blocked'&&!p.blocked_reasons.length;
  if(!p||!valid)return {...old,stock:0,central_availability:p?.availability||'absent',disponible:false,price_verified:false,banner:null,banner_sha256:null,foto:p?.blocked_reasons.some(r=>/IDENTITY|VARIANT/.test(r))?null:old.foto,caracteristicas:p?.blocked_reasons.some(r=>/IDENTITY|VARIANT/.test(r))?{}:old.caracteristicas};
  // stock is an internal boolean compatibility marker, never a quantity from the ERP.
  const e=enrichment.products?.[p.sku],matches=e&&e.source_name===p.source_name&&JSON.stringify(e.variant_gb)===JSON.stringify(p.variant_gb);
  const media=matches?{foto:e.photo_url||old.foto,foto_sha256:e.photo_sha256||old.foto_sha256,descripcion:e.description||old.descripcion,caracteristicas:e.specifications||old.caracteristicas}:{};
  // Private SIGNATURE library banners are not exposed through this public-photo enrichment.
  return {...old,...media,nombre:p.name,catalog_identity:p.source_name,public_name:matches&&e.display_name||old.public_name||p.name,promo:p.prices.promo_cash_cents/100,pvp:p.prices.pvp_card_cents/100,stock:p.availability==='in_stock'?1:0,stock_is_availability_marker:true,central_availability:p.availability,disponible:p.availability==='in_stock',price_verified:true,url:p.web?.url||old.url||null,sale_unit:p.sale_unit||null};
 });
 return {...seed,productos:products,fuente_fecha:data.source.generated_at,feed_published_at:data.published_at||null,normalized_at:data.normalized_at,inventory_cut_date:data.source.cut_date,inventory_updated_at:data.source.generated_at,inventory_source:'owner_validated_593_report',inventory_commit:null,source_sha256:data.source.sha256,source_kind:data.source.published_reference?'shared_validated_central_593':'validated_central_593',expires_at:data.expires_at,prices_cross_checked:true,source_error_code:Date.parse(data.expires_at)<now?'CENTRAL_REPORT_STALE':null};
}
