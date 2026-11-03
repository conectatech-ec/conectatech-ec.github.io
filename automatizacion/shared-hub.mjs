// Read-only adapter to the existing, shared Data Hub. No new price calculation or stock source.
import attestations from './central/source-attestations.json' with {type:'json'};
import {validateCentral} from './central-source.mjs';
const base='https://conectatech-ec.github.io/';
const isoDate=/^\d{4}-\d{2}-\d{2}$/;
// Isolate-local continuity only: a restart still uses the compiled fallback.
// Weak keys keep different commercial baselines/test sources strictly separate.
const lastValid=new WeakMap();
export function adaptSharedHub(pointer,cut,fallback,now=Date.now()){
 const date=cut?.fecha_corte,sha=cut?.sha256_original;
 if(!isoDate.test(date||'')||!/^[a-f0-9]{64}$/.test(sha||'')||pointer?.fecha_corte!==date||pointer?.origen_sha256!==sha||pointer?.referencia!=='datos-593/corte-comercial-publico-validado.json')throw Error('SHARED_HUB_VERSION_MISMATCH');
 if(sha===fallback.source.sha256){if(date!==fallback.source.cut_date)throw Error('SHARED_HUB_RELABELED_REPORT');return fallback;}
 const evidence=attestations[sha];
 if(evidence&&evidence.cut_date!==date)throw Error('SHARED_HUB_RELABELED_REPORT');
 // When the shared contract supplies only a date, start of that Quito day is a conservative bound.
 const generated=evidence?.generated_at||date+'T00:00:00-05:00',time=Date.parse(generated);
 if(!Number.isFinite(time)||new Date(time-5*3600000).toISOString().slice(0,10)!==date||time>now+300000)throw Error('SHARED_HUB_DATE');
 if(time<Date.parse(fallback.source.generated_at))return fallback;
 const rows=cut.productos;
 if(!rows||Array.isArray(rows)||typeof rows!=='object'||Object.keys(rows).length<1||Object.keys(rows).length>5000||Object.keys(rows).length!==cut.cantidad_sku_web)throw Error('SHARED_HUB_SCHEMA');
 const verifiedIdentity=new Set(evidence?.identity_verified_skus||[]);
 const products=fallback.products.map(old=>{
  const row=rows[old.sku];
  if(!row)return {...old,availability:'blocked',prices:null,blocked_reasons:[...new Set([...old.blocked_reasons,'NOT_IN_SHARED_PUBLISHED_CUT'])]};
  const prices={currency:'USD',promo_cash_cents:row.promo_centavos,pvp_card_cents:row.pvp_centavos};
  const reasons=old.blocked_reasons.filter(r=>!['ABSENT_LATEST_REPORT','NOT_IN_SHARED_PUBLISHED_CUT','NEGATIVE_STOCK','INVALID_STOCK','ZERO_OR_INVERTED_PRICE','INVALID_PRICE'].includes(r));
  if(sha!==fallback.source.sha256&&!verifiedIdentity.has(old.sku)&&row.source_name!==old.source_name)reasons.push('SHARED_IDENTITY_NOT_VERIFIED');
  if(!Number.isSafeInteger(row.stock)||row.stock<0)reasons.push('SHARED_STOCK_INVALID');
  if(![prices.promo_cash_cents,prices.pvp_card_cents].every(n=>Number.isSafeInteger(n)&&n>0)||prices.pvp_card_cents<prices.promo_cash_cents)reasons.push('SHARED_PRICE_INVALID');
  return {...old,prices:reasons.length?null:prices,availability:reasons.length?'blocked':row.stock>0?'in_stock':'out_of_stock',blocked_reasons:reasons,provenance:{source:'shared_validated_593_cut',source_sha256:sha,price_fields:['promo_centavos','pvp_centavos']}};
 });
 return {...fallback,source:{file_name:cut.fuente,sha256:sha,cut_date:date,generated_at:new Date(time).toISOString(),timestamp_basis:evidence?'original_workbook_core':'conservative_Quito_day_start',published_reference:base+pointer.referencia},normalized_at:new Date(now).toISOString(),published_at:null,expires_at:new Date(time+86400000).toISOString(),products};
}
export async function readSharedHub(fallback,fetcher=fetch,now=Date.now()){
 async function get(path,revalidate=false){const r=await fetcher(base+path,{signal:AbortSignal.timeout(10000),redirect:'error',...(revalidate?{headers:{'Cache-Control':'no-cache'},cache:'no-store'}:{cf:{cacheTtl:60,cacheEverything:true}})});if(!r.ok)throw Error('SHARED_HUB_UNAVAILABLE');const t=await r.text();if(t.length>1500000)throw Error('SHARED_HUB_SIZE');return JSON.parse(t);}
 let effective;
 try{
  // Two independently cached files can straddle a publication. Retry the pair
  // once without the edge cache; never combine prices from different versions.
  for(let attempt=0;attempt<2;attempt++){
   try{
    const pointer=await get('datos-593/estado-ultimo-corte.json',attempt>0);
    const cut=await get('datos-593/corte-comercial-publico-validado.json',attempt>0);
    effective=validateCentral(adaptSharedHub(pointer,cut,fallback,now),now);
    break;
   }catch(error){if(attempt===1||error.message!=='SHARED_HUB_VERSION_MISMATCH')throw error;}
  }
  const prior=lastValid.get(fallback);
  if(prior&&Date.parse(effective.source.generated_at)<Date.parse(prior.source.generated_at))throw Error('SHARED_HUB_OLDER_THAN_LAST_VALID');
  lastValid.set(fallback,structuredClone(effective));
  effective={...effective,shared_hub_status:{state:'verified',error_code:null}};
 }catch(error){
  const prior=lastValid.get(fallback);
  if(!prior)throw error;
  // Do not move generated_at, normalized_at or expires_at on a failed refresh.
  const code=/^SHARED_HUB_[A-Z_]+$/.test(error.message)?error.message:'SHARED_HUB_READ_FAILED';
  effective={...structuredClone(prior),shared_hub_status:{state:'last_valid_in_isolate',error_code:code}};
 }
 // Read the public presentation from the existing export, after resolving the effective 593 cut.
 // A presentation outage never discards a valid newer commercial source or renews its expiry.
 try{
  const sales=await get('exportaciones/catalogo-ventas.json');
  if(sales?.fuente_sha256!==effective.source.sha256||sales?.fecha_corte!==effective.source.cut_date||!sales.presentation)throw Error('PRESENTATION_SOURCE_MISMATCH');
  return {...effective,presentation:sales.presentation,presentation_transport_error:null};
 }catch{return {...effective,presentation_transport_error:'PUBLIC_PRESENTATION_UNAVAILABLE'};}
}
