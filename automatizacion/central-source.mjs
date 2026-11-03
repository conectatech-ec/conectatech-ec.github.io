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

const PRESENTATION_SCHEMA='conectatech.alex.presentation.v1';
const presentationBindings=new WeakMap(),lastPresentations=new Map();
const hex=/^[a-f0-9]{64}$/,own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const sourceKey=data=>[data.source.sha256,data.source.cut_date,data.source.generated_at].join('|');
const stable=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
// Private comparison stays in memory. No identity fingerprint is emitted or persisted.
const sourceFingerprint=data=>stable({source:{sha256:data.source.sha256,cut_date:data.source.cut_date,generated_at:data.source.generated_at},expires_at:data.expires_at,products:data.products.map(p=>({sku:p.sku,source_name:p.source_name,variant_gb:p.variant_gb,name:p.name,category:p.category,prices:p.prices,availability:p.availability,blocked_reasons:p.blocked_reasons,web:p.web,sale_unit:p.sale_unit})).sort((a,b)=>a.sku.localeCompare(b.sku))});
function freezeTree(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freezeTree(child);Object.freeze(value);}return value;}
function snapshotSource(data){const serialized=JSON.stringify(data);return {serialized,snapshot:JSON.parse(serialized)};}
function onlyKeys(value,keys,code){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).some(k=>!keys.includes(k)))throw Error(code);
}
function presentationShape(document,data,now){
 onlyKeys(document,['schema','source_sha256','cut_date','published_at','inputs','products','version'],'PRESENTATION_SCHEMA');
 if(document.schema!==PRESENTATION_SCHEMA||document.source_sha256!==data.source.sha256||document.cut_date!==data.source.cut_date||!/^\d{4}-\d{2}-\d{2}$/.test(document.cut_date||'')||!hex.test(document.source_sha256||''))throw Error('PRESENTATION_SOURCE_MISMATCH');
 const published=Date.parse(document.published_at);
 if(typeof document.published_at!=='string'||!Number.isFinite(published)||published>now+300000)throw Error('PRESENTATION_DATE');
 onlyKeys(document.inputs,['multichannel_sha256','meta_sha256'],'PRESENTATION_INPUTS');
 if(!hex.test(document.inputs.multichannel_sha256||'')||!hex.test(document.inputs.meta_sha256||''))throw Error('PRESENTATION_INPUTS');
 if(!/^alex-presentation-v1-[a-f0-9]{64}$/.test(document.version||''))throw Error('PRESENTATION_VERSION');
 onlyKeys(document.products,Object.keys(document.products||{}),'PRESENTATION_PRODUCTS');
 const keys=Object.keys(document.products);
 if(!keys.length||keys.length>5000)throw Error('PRESENTATION_PRODUCTS');
 for(const sku of keys){
  if(!/^[A-Z0-9_-]{3,40}$/.test(sku))throw Error('PRESENTATION_INVALID_SKU');
  const entry=document.products[sku];onlyKeys(entry,['display_title','approved_media'],'PRESENTATION_FIELDS');
  if(typeof entry.display_title!=='string'||!entry.display_title.trim()||entry.display_title.length>300||/[\u0000-\u001f\u007f]/.test(entry.display_title))throw Error('PRESENTATION_TITLE');
  if(!own(entry,'approved_media'))throw Error('PRESENTATION_MEDIA');
  if(entry.approved_media!==null){
   const media=entry.approved_media;onlyKeys(media,['url','sha256'],'PRESENTATION_MEDIA');
   let url;try{url=new URL(media.url);}catch{throw Error('PRESENTATION_MEDIA');}
   if(url.origin!=='https://conectatech-ec.github.io'||!url.pathname.startsWith('/imagenes/')||url.search||url.hash||url.username||url.password||url.href!==media.url||!hex.test(media.sha256||''))throw Error('PRESENTATION_MEDIA');
  }
 }
}
export async function bindPresentation(data,document,now=Date.now()){
 // Capture the complete source before yielding. The returned binding never shares mutable
 // source/product references with its caller, including after successful validation.
 const {serialized,snapshot}=snapshotSource(data);validateCentral(snapshot,now);
 const key=sourceKey(snapshot),fingerprint=sourceFingerprint(snapshot);
 const copy=JSON.parse(JSON.stringify(document));presentationShape(copy,snapshot,now);
 const {version,...body}=copy,digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stable(body))))].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(version!=='alex-presentation-v1-'+digest)throw Error('PRESENTATION_SHA_MISMATCH');
 // Recheck before either cache or WeakMap writes: a SHA/date/product mutation during
 // digest cannot turn presentation A into an approval for source B.
 if(JSON.stringify(data)!==serialized)throw Error('PRESENTATION_SOURCE_CHANGED_DURING_BIND');
 validateCentral(data,now);
 if(sourceKey(data)!==key||sourceFingerprint(data)!==fingerprint)throw Error('PRESENTATION_SOURCE_CHANGED_DURING_BIND');
 // Verify the ENTIRE public document first. Public additions do not authorize new
 // ERP identities, rows, prices or media: only existing canonical SKU can be joined.
 const known=new Set(snapshot.products.map(p=>p.sku)),usable=Object.fromEntries(Object.entries(copy.products).filter(([sku])=>known.has(sku)));
 const ignoredUnknownCount=Object.keys(copy.products).length-Object.keys(usable).length;
 if(!Object.keys(usable).length)throw Error('PRESENTATION_NO_MATCHING_SKU');
 const previous=lastPresentations.get(key),previousDocument=previous?.document,time=Date.parse(copy.published_at);
 if(previous&&previous.source_fingerprint!==fingerprint)throw Error('PRESENTATION_SOURCE_CHANGED');
 if(previousDocument&&(time<Date.parse(previousDocument.published_at)||time===Date.parse(previousDocument.published_at)&&version!==previousDocument.version))throw Error('PRESENTATION_REGRESSION');
 // This state is a bounded, in-memory read cache, never a delivery/persistence receipt.
 const unchanged=previousDocument?.version===version,chosen=unchanged?previousDocument:copy,media={...previous?.media};
 for(const [sku,entry]of Object.entries(usable))if(entry.approved_media)media[sku]=entry.approved_media;
 const cached={document:chosen,products:usable,media,source_fingerprint:fingerprint,ignored_unknown_count:ignoredUnknownCount};lastPresentations.delete(key);lastPresentations.set(key,cached);
 while(lastPresentations.size>2)lastPresentations.delete(lastPresentations.keys().next().value);
 const bound=freezeTree(snapshot);presentationBindings.set(bound,{...cached,state:unchanged?'unchanged':'verified'});return bound;
}
export function lastValidPresentation(data){
 const {snapshot}=snapshotSource(data),cached=lastPresentations.get(sourceKey(snapshot));
 if(!cached||cached.source_fingerprint!==sourceFingerprint(snapshot))return data;
 const bound=freezeTree(snapshot);presentationBindings.set(bound,{...cached,state:'last_valid'});return bound;
}

export function sourceToAlex(seed,data,selectExtra,now=Date.now()){
 validateCentral(data,now);const presentation=presentationBindings.get(data),all=data.products.map(p=>({sku:p.sku,nombre:p.name,catalog_identity:p.source_name,...(p.availability!=='blocked'&&!p.blocked_reasons.length&&presentation?.products[p.sku]?{public_name:presentation.products[p.sku].display_title}:{})})),selected=selectExtra?selectExtra(all).filter(p=>!seed.productos.some(s=>s.sku===p.sku)):[];
 const products=[...seed.productos,...selected.map(p=>({...p,descripcion:'',caracteristicas:{},foto:null,foto_sha256:null,banner:null,banner_sha256:null}))].map(old=>{
  const p=data.products.find(p=>p.sku===old.sku),valid=p&&p.availability!=='blocked'&&!p.blocked_reasons.length;
  if(!p||!valid)return {...old,stock:0,central_availability:p?.availability||'absent',disponible:false,price_verified:false,banner:null,banner_sha256:null,foto:p?.blocked_reasons.some(r=>/IDENTITY|VARIANT/.test(r))?null:old.foto,caracteristicas:p?.blocked_reasons.some(r=>/IDENTITY|VARIANT/.test(r))?{}:old.caracteristicas};
  // stock is an internal boolean compatibility marker, never a quantity from the ERP.
  const e=enrichment.products?.[p.sku],matches=e&&e.source_name===p.source_name&&JSON.stringify(e.variant_gb)===JSON.stringify(p.variant_gb);
  const view=presentation?.products[p.sku],approved=view&&(view.approved_media||presentation.media[p.sku]);
  const media=matches?{foto:e.photo_url||old.foto,foto_sha256:e.photo_sha256||old.foto_sha256,descripcion:e.description||old.descripcion,caracteristicas:e.specifications||old.caracteristicas}:{};
  // Private SIGNATURE library banners are not exposed through this public-photo enrichment.
  return {...old,...media,...(approved?{foto:approved.url,foto_sha256:approved.sha256,presentation_photo:true,presentation_media_state:view.approved_media?'current':'retained_last_valid'}:{}),nombre:p.name,catalog_identity:p.source_name,public_name:view?.display_title||matches&&e.display_name||old.public_name||p.name,promo:p.prices.promo_cash_cents/100,pvp:p.prices.pvp_card_cents/100,stock:p.availability==='in_stock'?1:0,stock_is_availability_marker:true,central_availability:p.availability,disponible:p.availability==='in_stock',price_verified:true,url:p.web?.url||old.url||null,sale_unit:p.sale_unit||null};
 });
 return {...seed,productos:products,presentation_version:presentation?.document.version||null,presentation_state:presentation?.state||'unavailable',presentation_ignored_unknown_count:presentation?.ignored_unknown_count||0,fuente_fecha:data.source.generated_at,feed_published_at:data.published_at||null,normalized_at:data.normalized_at,inventory_cut_date:data.source.cut_date,inventory_updated_at:data.source.generated_at,inventory_source:'owner_validated_593_report',inventory_commit:null,source_sha256:data.source.sha256,source_kind:data.source.published_reference?'shared_validated_central_593':'validated_central_593',expires_at:data.expires_at,prices_cross_checked:true,source_error_code:Date.parse(data.expires_at)<now?'CENTRAL_REPORT_STALE':null};
}
