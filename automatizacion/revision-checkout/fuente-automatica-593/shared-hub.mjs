// Read-only adapter to the existing, shared Data Hub. No new price calculation or stock source.
import attestations from './source-attestations.mjs';
import {validateCentral} from './central-source.mjs';
const base='https://conectatech-ec.github.io/';
const isoDate=/^\d{4}-\d{2}-\d{2}$/;
// Isolate-local continuity only: a restart still uses the compiled fallback.
// Weak keys keep different commercial baselines/test sources strictly separate.
const lastValid=new WeakMap();
const validatorCommit='79f4e4fb77e30fd3a8a7ebac009cd8204a3b4c95';
const validatorModules=Object.freeze({
 'report_identity.py':'d023d449cb7cec2bddfbfdbea89ad47881f9a765578e947bbfa191adcb3d955b',
 'inventory_completeness.py':'fbe6f014868364f224fa2c7ac1189762375299feebff6c2c25e48714259bed6e',
 'normalizar_593.py':'8cac386759763e357100bbb683c2e6008528fcad517ee5b1ec4d4aa15d656a86',
 'data_hub_593.py':'4072336099a31a81a64685b1e2c60b7354246721a815a3d73b1688e6bf0bb50d'
});
const stable=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const digest=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');
const identityCache=new WeakMap();
async function identityOf(product){
 if(typeof product.source_name!=='string'||!Array.isArray(product.variant_gb)||product.variant_gb.some(v=>!Number.isSafeInteger(v)||v<0))throw Error('SHARED_HUB_IDENTITY_SCHEMA');
 // Exact serialization of the existing data_hub_593.identity; no raw ERP name is exported.
 const value='{"source_name": '+JSON.stringify(product.source_name)+', "variant_gb": ['+product.variant_gb.join(', ')+']}';
 const cached=identityCache.get(product);if(cached?.value===value)return cached.hash;
 const hash=await digest(value);identityCache.set(product,{value,hash});return hash;
}
export async function publishedSourceEvidence(pointer,cut,fallback,now=Date.now()){
 if(!Object.hasOwn(cut,'evidencia_checkout')){
  if(cut.sha256_original!==fallback.source.sha256&&!attestations[cut.sha256_original])throw Error('SHARED_HUB_ATTESTATION_REQUIRED');
  return undefined;
 }
 const original=stable([pointer,cut,fallback.source,fallback.products.map(p=>[p.sku,p.source_name,p.variant_gb,p.blocked_reasons])]);
 const e=structuredClone(cut.evidencia_checkout),r=cut.revision_fuente,p=pointer.revision_fuente;
 const keys=['schema','source_sha256','cut_date','generated_at','expires_at','revision_sequence','validator_commit','validator_modules_sha256','projection_sha256','identity_signatures','attestation_sha256'];
 if(!e||Object.keys(e).sort().join('|')!==keys.sort().join('|')||e.schema!=='conectatech.checkout-source-attestation.v1'||e.validator_commit!==validatorCommit||stable(e.validator_modules_sha256)!==stable(validatorModules))throw Error('SHARED_HUB_ATTESTATION_SCHEMA');
 const hex=/^[a-f0-9]{64}$/;
 if(!hex.test(e.source_sha256||'')||e.source_sha256!==cut.sha256_original||e.source_sha256!==pointer.origen_sha256||e.cut_date!==cut.fecha_corte||e.cut_date!==pointer.fecha_corte||pointer.referencia!=='datos-593/corte-comercial-publico-validado.json')throw Error('SHARED_HUB_ATTESTATION_SOURCE');
 const receiptKeys=['version','anterior_sha256','secuencia','generado_en','recibido_en','evidencia'];
 if(!r||!p||receiptKeys.some(k=>r[k]!==p[k])||r.version!==1||r.evidencia!=='XLSX_CORE_CREATED_EQUALS_MODIFIED'||!hex.test(r.anterior_sha256||'')||r.anterior_sha256===e.source_sha256||!Number.isSafeInteger(r.secuencia)||r.secuencia<1||e.revision_sequence!==r.secuencia)throw Error('SHARED_HUB_ATTESTATION_RECEIPT');
 const generated=Date.parse(e.generated_at),expires=Date.parse(e.expires_at),received=Date.parse(r.recibido_en);
 if(!Number.isFinite(generated)||new Date(generated).toISOString()!==e.generated_at||generated!==Date.parse(r.generado_en)||new Date(generated-5*3600000).toISOString().slice(0,10)!==e.cut_date||expires!==generated+86400000||new Date(expires).toISOString()!==e.expires_at||!Number.isFinite(received)||received<generated||received>now+120000||generated>now||now>=expires)throw Error('SHARED_HUB_ATTESTATION_DATE');
 if(e.source_sha256===fallback.source.sha256&&generated!==Date.parse(fallback.source.generated_at))throw Error('SHARED_HUB_RELABELED_REPORT');
 const rows=cut.productos,ids=e.identity_signatures;
 if(!rows||Array.isArray(rows)||!ids||Array.isArray(ids))throw Error('SHARED_HUB_ATTESTATION_COVERAGE');
 const skus=Object.keys(rows).sort();
 if(!skus.length||skus.length>5000||skus.length!==cut.cantidad_sku_web||skus.length!==pointer.sku_web||skus.join('|')!==Object.keys(ids).sort().join('|'))throw Error('SHARED_HUB_ATTESTATION_COVERAGE');
 const projection=skus.map(sku=>{const q=rows[sku];if(!/^[A-Z0-9_-]{3,40}$/.test(sku)||!hex.test(ids[sku]||'')||!q||!Number.isSafeInteger(q.stock)||q.stock<0||![q.promo_centavos,q.pvp_centavos].every(n=>Number.isSafeInteger(n)&&n>0)||q.pvp_centavos<q.promo_centavos)throw Error('SHARED_HUB_ATTESTATION_PRODUCT');return [sku,q.stock,q.promo_centavos,q.pvp_centavos];});
 const {attestation_sha256,...body}=e;
 if(!hex.test(e.projection_sha256||'')||await digest(JSON.stringify(projection))!==e.projection_sha256||!hex.test(attestation_sha256||'')||await digest(stable(body))!==attestation_sha256)throw Error('SHARED_HUB_ATTESTATION_INTEGRITY');
 const verified=[];
 await Promise.all(fallback.products.filter(q=>Object.hasOwn(ids,q.sku)).map(async q=>{if(await identityOf(q)===ids[q.sku])verified.push(q.sku);}));
 if(stable([pointer,cut,fallback.source,fallback.products.map(q=>[q.sku,q.source_name,q.variant_gb,q.blocked_reasons])])!==original)throw Error('SHARED_HUB_ATTESTATION_CHANGED');
 return {cut_date:e.cut_date,generated_at:e.generated_at,identity_verified_skus:verified,preserve_blocks:true,revision_sequence:e.revision_sequence,attestation_sha256};
}
export function adaptSharedHub(pointer,cut,fallback,now=Date.now(),publishedEvidence){
 const date=cut?.fecha_corte,sha=cut?.sha256_original;
 if(!isoDate.test(date||'')||!/^[a-f0-9]{64}$/.test(sha||'')||pointer?.fecha_corte!==date||pointer?.origen_sha256!==sha||pointer?.referencia!=='datos-593/corte-comercial-publico-validado.json')throw Error('SHARED_HUB_VERSION_MISMATCH');
 if(sha===fallback.source.sha256){if(date!==fallback.source.cut_date)throw Error('SHARED_HUB_RELABELED_REPORT');return fallback;}
 const evidence=publishedEvidence||attestations[sha];
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
  const reasons=evidence?.preserve_blocks?[...old.blocked_reasons]:old.blocked_reasons.filter(r=>!['ABSENT_LATEST_REPORT','NOT_IN_SHARED_PUBLISHED_CUT','NEGATIVE_STOCK','INVALID_STOCK','ZERO_OR_INVERTED_PRICE','INVALID_PRICE'].includes(r));
  if(evidence?.preserve_blocks?!verifiedIdentity.has(old.sku):sha!==fallback.source.sha256&&!verifiedIdentity.has(old.sku)&&row.source_name!==old.source_name)reasons.push('SHARED_IDENTITY_NOT_VERIFIED');
  if(!Number.isSafeInteger(row.stock)||row.stock<0)reasons.push('SHARED_STOCK_INVALID');
  if(![prices.promo_cash_cents,prices.pvp_card_cents].every(n=>Number.isSafeInteger(n)&&n>0)||prices.pvp_card_cents<prices.promo_cash_cents)reasons.push('SHARED_PRICE_INVALID');
  return {...old,prices:reasons.length?null:prices,availability:reasons.length?'blocked':row.stock>0?'in_stock':'out_of_stock',blocked_reasons:reasons,provenance:{source:'shared_validated_593_cut',source_sha256:sha,price_fields:['promo_centavos','pvp_centavos']}};
 });
 return {...fallback,source:{file_name:cut.fuente,sha256:sha,cut_date:date,generated_at:new Date(time).toISOString(),timestamp_basis:evidence?'original_workbook_core':'conservative_Quito_day_start',published_reference:base+pointer.referencia,...(evidence?.attestation_sha256?{revision_sequence:evidence.revision_sequence,attestation_sha256:evidence.attestation_sha256}:{})},normalized_at:new Date(now).toISOString(),published_at:null,expires_at:new Date(time+86400000).toISOString(),products};
}
export async function readSharedHub(fallback,fetcher=fetch,now=Date.now()){
 async function get(path,revalidate=false){const r=await fetcher(base+path,{signal:AbortSignal.timeout(10000),redirect:'manual',...(revalidate?{headers:{'Cache-Control':'no-cache'},cache:'no-store'}:{cf:{cacheTtl:60,cacheEverything:true}})});if(!r.ok)throw Error('SHARED_HUB_UNAVAILABLE');const t=await r.text();if(t.length>1500000)throw Error('SHARED_HUB_SIZE');return JSON.parse(t);}
 let effective,publishedRows;
 try{
  // Two independently cached files can straddle a publication. Retry the pair
  // once without the edge cache; never combine prices from different versions.
  for(let attempt=0;attempt<2;attempt++){
   try{
    const pointer=await get('datos-593/estado-ultimo-corte.json',attempt>0);
    const cut=await get('datos-593/corte-comercial-publico-validado.json',attempt>0);
    const evidence=await publishedSourceEvidence(pointer,cut,fallback,now);
    effective=validateCentral(adaptSharedHub(pointer,cut,fallback,now,evidence),now);
    publishedRows=cut.productos;
    break;
   }catch(error){if(attempt===1||error.message!=='SHARED_HUB_VERSION_MISMATCH')throw error;}
  }
  const prior=lastValid.get(fallback);
  if(prior&&Date.parse(effective.source.generated_at)<Date.parse(prior.source.generated_at))throw Error('SHARED_HUB_OLDER_THAN_LAST_VALID');
  if(prior&&effective.source.sha256!==prior.source.sha256&&(Date.parse(effective.source.generated_at)===Date.parse(prior.source.generated_at)||effective.source.revision_sequence&&prior.source.revision_sequence&&effective.source.revision_sequence<=prior.source.revision_sequence))throw Error('SHARED_HUB_OLDER_THAN_LAST_VALID');
  if(prior&&effective.source.sha256===prior.source.sha256&&prior.source.attestation_sha256!==effective.source.attestation_sha256)throw Error('SHARED_HUB_ATTESTATION_CHANGED');
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
  if(effective.source.attestation_sha256){
   // Current public scope carries the existing business exclusions, including STEREN.
   // Proof of ERP identity never overrides a withdrawal or an unresolved baseline block.
   if(!Array.isArray(sales.productos)||!sales.productos.length||sales.productos.length>5000)throw Error('PUBLIC_SCOPE_INVALID');
   const visible=new Map();
   for(const p of sales.productos){if(!/^[A-Z0-9_-]{3,40}$/.test(p?.sku||'')||visible.has(p.sku))throw Error('PUBLIC_SCOPE_INVALID');visible.set(p.sku,p);}
   effective={...effective,products:effective.products.map(p=>{
    const row=visible.get(p.sku);
    const allowed=row&&Number.isSafeInteger(row.stock)&&row.stock>=0&&Number.isFinite(row.promo)&&Number.isFinite(row.pvp)&&row.promo>0&&row.pvp>=row.promo;
    const matches=allowed&&p.prices&&row.stock===publishedRows?.[p.sku]?.stock&&Math.round(row.promo*100)===p.prices.promo_cash_cents&&Math.round(row.pvp*100)===p.prices.pvp_card_cents&&(row.stock>0)===(p.availability==='in_stock');
    if(matches||p.availability==='blocked')return p;
    return {...p,availability:'blocked',prices:null,blocked_reasons:[...new Set([...p.blocked_reasons,row?'SHARED_PUBLIC_COMMERCIAL_MISMATCH':'NOT_IN_SHARED_PUBLIC_CATALOG'])],web:{...p.web,price_matches:false}};
   })};
  }
  return {...effective,presentation:sales.presentation,presentation_transport_error:null};
 }catch{return {...effective,...(effective.source.attestation_sha256&&effective.shared_hub_status?.state==='verified'?{shared_hub_status:{state:'commercial_scope_unverified',error_code:'SHARED_PUBLIC_SCOPE_UNVERIFIED'}}:{}),presentation_transport_error:'PUBLIC_PRESENTATION_UNAVAILABLE'};}
}
