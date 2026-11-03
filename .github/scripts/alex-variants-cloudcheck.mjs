// Owner-only HTTPS probes against the existing pilot. No Meta, customer events or deployment.
// Reports contain booleans/counts/source metadata, never tokens, transcripts or inventory quantities.
import {mkdir,writeFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import central from '../../automatizacion/central/current.json' with {type:'json'};
import enrichment from '../../automatizacion/central/enrichment.json' with {type:'json'};
import attestations from '../../automatizacion/central/source-attestations.json' with {type:'json'};
import library from '../../automatizacion/marketplace-library.json' with {type:'json'};
import policy from '../../automatizacion/alex-policy.json' with {type:'json'};
import {phoneVariant} from '../../automatizacion/phone-variants.mjs';

const ORIGIN='https://conectatech-comercial-piloto.conectatech-ecu.workers.dev',PUBLIC='https://conectatech-ec.github.io';
const report={schema:'conectatech.alex.variants.cloud.v1',at:new Date().toISOString(),passed:false,
 scope:'authenticated_owner_simulator_HTTPS_only',real_Meta_delivery:false,Graph_sends:0,customer_events:0,
 deployment_requests:0,external_customers_enabled:false,maximum_AI_attempts:2,AI_attempts:0,generative_replies:0,
 checks:{},families:[],media:{verified_photos:0,verified_banners:0,duplicate_default_images:0},source:{}};
let stage='setup',base=ORIGIN,token=process.env.PILOT_TOKEN,cut,pointer,presentation,quotaBefore,healthBefore;
const used=new Map(),verifiedAssets=new Map(),session=crypto.randomUUID();
const check=(condition,code)=>{if(!condition){const e=new Error(code);e.probeCode=code;throw e;}};
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const money=n=>'$'+(n/100).toFixed(2),amounts=s=>[...String(s||'').matchAll(/\$(\d+(?:\.\d{2})?)/g)].map(m=>Math.round(Number(m[1])*100));
async function json(url,{privateRequest=false,body}={}){
 const r=await fetch(url,{method:body?'POST':'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(60000),
  headers:privateRequest?{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})}:{Accept:'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 check(r.status===200,'HTTP_200_REQUIRED');const text=await r.text();check(text.length<=2_000_000,'JSON_SIZE_LIMIT');return JSON.parse(text);
}
const get=path=>json(base+path,{privateRequest:true});
async function publicHub(){
 const p=await json(PUBLIC+'/datos-593/estado-ultimo-corte.json'),c=await json(PUBLIC+'/datos-593/corte-comercial-publico-validado.json');
 check(p.referencia==='datos-593/corte-comercial-publico-validado.json'&&p.fecha_corte===c.fecha_corte&&p.origen_sha256===c.sha256_original,'HUB_VERSION_MISMATCH');
 check(/^[a-f0-9]{64}$/.test(c.sha256_original||'')&&c.productos&&Object.keys(c.productos).length===c.cantidad_sku_web,'HUB_SCHEMA');return {p,c};
}
function photoFor(sku){
 const view=presentation?.products?.[sku]?.approved_media;if(view?.url&&view.sha256)return view;
 const p=central.products.find(p=>p.sku===sku),e=enrichment.products?.[sku];
 return e&&p&&e.source_name===p.source_name&&JSON.stringify(e.variant_gb)===JSON.stringify(p.variant_gb)&&e.photo_url&&e.photo_sha256?{url:e.photo_url,sha256:e.photo_sha256}:null;
}
async function verifyImages(a,id,{repeat=false}={}){
 const images=Array.isArray(a.images)?a.images:a.image?[{sku:a.focus?.length===1?a.focus[0]:null,url:a.image,kind:'approved_photo'}]:[];
 check(images.length<=2,'IMAGE_COUNT_LIMIT');const local=new Set(),seen=used.get(id)||new Set();
 for(const image of images){
  const u=new URL(image.url);check(u.origin===PUBLIC&&u.protocol==='https:'&&!u.search&&!u.hash&&!u.username&&!u.password,'IMAGE_PUBLIC_ORIGIN');
  check(typeof image.sku==='string'&&(a.variant_options?.some(v=>v.sku===image.sku)||a.focus?.includes(image.sku)),'IMAGE_WRONG_SKU');
  check(!local.has(u.href),'DUPLICATE_IMAGES_IN_REPLY');local.add(u.href);
  if(!repeat){check(!seen.has(u.href),'DUPLICATE_DEFAULT_IMAGE');seen.add(u.href);}
  let expected;
  if(image.kind==='approved_photo'){expected=photoFor(image.sku);report.media.verified_photos++;}
  else{
   const entry=library.products?.[image.sku];
   check(image.kind==='approved_banner'&&library.live_registry_connection_verified===true&&library.no_send_to_buyers===false&&library.messaging_enabled===true&&entry?.delivery_allowed===true&&entry.visual_approved===true&&entry.publication_verified===true&&entry.source_sha256===cut.sha256_original&&entry.cut_date===cut.fecha_corte,'SIGNATURE_BANNER_NOT_RELEASED');
   expected={url:entry.banner_url,sha256:entry.banner_sha256};report.media.verified_banners++;
  }
  check(expected&&expected.url===u.href&&/^[a-f0-9]{64}$/.test(expected.sha256||''),'IMAGE_NOT_APPROVED_FOR_SKU');
  if(!verifiedAssets.has(u.href)){
   const r=await fetch(u.href,{redirect:'error',signal:AbortSignal.timeout(30000)});check(r.status===200&&/^image\//i.test(r.headers.get('content-type')||''),'IMAGE_HTTP_OR_MIME');
   check(Number(r.headers.get('content-length')||0)<=8*1024*1024,'IMAGE_SIZE_LIMIT');const digest=createHash('sha256');let size=0;
   for await(const bytes of r.body){size+=bytes.length;check(size<=8*1024*1024,'IMAGE_SIZE_LIMIT');digest.update(bytes);}
   check(size>0&&digest.digest('hex')===expected.sha256,'IMAGE_HASH_MISMATCH');verifiedAssets.set(u.href,true);
  }
 }
 used.set(id,seen);return images.length;
}
async function ask(id,message,{realAI=false,...extra}={}){
 if(realAI){check(report.AI_attempts<2,'AI_ATTEMPT_LIMIT');report.AI_attempts++;}
 const a=await json(base+'/alex/chat',{privateRequest:true,body:{session_id:session,collaborator_id:id,channel:'simulator',message,catalog_only:!realAI,...extra}});
 check(a.outbound_enabled===false&&a.collaborator?.id===id&&a.attribution?.collaborator_id===id&&a.attribution?.channel==='simulator'&&a.attribution?.origin_verification==='operator_authenticated'&&a.attribution?.sales_confirmed===false,'OWNER_SIMULATOR_SCOPE');
 check(a.source_sha256===cut.sha256_original&&a.inventory_cut_date===cut.fecha_corte,'ALEX_SOURCE_NOT_CURRENT_HUB');
 check(typeof a.text==='string'&&!/\b(?:TELF\d+|SKU|COL00\d)\b|stock referencial|\b\d+ unidades\b/i.test(a.text),'PRIVATE_OR_INTERNAL_COPY');
 const stamp=Date.parse(a.source_verified_at),fresh=Number.isFinite(stamp)&&stamp<=Date.now()+300000&&Date.now()-stamp<=86400000;
 check(a.source_fresh===fresh,'FRESHNESS_GUARD_MISMATCH');report.source={cut_date:a.inventory_cut_date,sha256:a.source_sha256,generated_at:a.source_verified_at,expires_at:Number.isFinite(stamp)?new Date(stamp+86400000).toISOString():null,fresh};
 if(!fresh){check(amounts(a.text).length===0,'STALE_VISIBLE_PRICE');for(const o of a.variant_options||[])check(o.current===false&&o.cash===null&&o.card===null,'STALE_PRICE_METADATA');}
 else{
  const allowed=new Set((a.variant_options?.length?a.variant_options.map(v=>v.sku):a.focus||[]).flatMap(sku=>{const r=cut.productos[sku];return r?.stock>0?[r.promo_centavos,r.pvp_centavos]:[];}));
  check(amounts(a.text).every(c=>allowed.has(c)),'PRICE_NOT_IN_VALIDATED_SOURCE');
 }
 if(a.generative===true){check(realAI,'UNREQUESTED_AI_CALL');report.generative_replies++;}
 return a;
}
function familyRows(brand,model){
 const verified=new Set(attestations[cut.sha256_original]?.identity_verified_skus||[]);
 return central.products.map(p=>({p,v:phoneVariant(p),r:cut.productos[p.sku]})).filter(({p,v,r})=>
  v?.verified_identity&&fold(v.brand)===fold(brand)&&fold(v.base_model)===fold(model)&&r&&
  (verified.has(p.sku)||r.source_name===p.source_name)&&!p.blocked_reasons.some(x=>/IDENTITY|VARIANT/.test(x))&&
  Number.isSafeInteger(r.stock)&&r.stock>=0&&[r.promo_centavos,r.pvp_centavos].every(n=>Number.isSafeInteger(n)&&n>0)&&r.pvp_centavos>=r.promo_centavos);
}
try{
 const requested=process.env.ALEX_TEST_BASE_URL||process.env.PILOT_BASE_URL||ORIGIN,u=new URL(requested);
 check(u.origin===ORIGIN&&['','/'].includes(u.pathname)&&!u.search&&!u.hash&&!u.username&&!u.password,'PILOT_ORIGIN_REQUIRED');base=u.origin;
 check(typeof token==='string'&&token.length>=32,'PILOT_SECRET_REQUIRED');
 const expected=process.env.EXPECTED_BASE_RELEASE||process.env.EXPECTED_RELEASE||'acfc00763dfbc7ac34c2c62f9ccecea4f613c870';check(/^[a-f0-9]{40}$/.test(expected),'BASE_RELEASE_INVALID');
 stage='access';healthBefore=await get('/health');check(healthBefore.ok===true&&healthBefore.release===expected&&healthBefore.meta_ingress_enabled===false,'ISOLATED_RELEASE_REQUIRED');report.release=healthBefore.release;
 const unauthed=await fetch(base+'/alex/collaborators',{redirect:'error',signal:AbortSignal.timeout(15000)});check(unauthed.status===401,'REGISTRY_NOT_PRIVATE');report.checks.registry_private=true;
 const status=await get('/alex/status');check(status.generative===true&&status.free_only===true&&status.model===policy.model&&status.live_customers_enabled===false,'FREE_MODEL_CONFIGURATION_REQUIRED');report.checks.free_model_configuration=true;
 const registry=await get('/alex/collaborators');check(registry.scope==='owner_simulator_only'&&registry.external_enabled===false&&registry.max_collaborators===10&&['COL001','COL002'].every(id=>registry.profiles.some(p=>p.id===id)),'OWNER_REGISTRY_REQUIRED');report.checks.owner_profiles=true;
 stage='source';({p:pointer,c:cut}=await publicHub());report.checks.hub_coherent=true;
 try{const sales=await json(PUBLIC+'/exportaciones/catalogo-ventas.json');if(sales.fuente_sha256===cut.sha256_original&&sales.fecha_corte===cut.fecha_corte&&sales.presentation?.source_sha256===cut.sha256_original)presentation=sales.presentation;}catch{/* Only exact preapproved enrichment is an eligible fallback. */}
 quotaBefore=await get('/alex/quota');check(quotaBefore.paid_fallback===false&&quotaBefore.reserved_limit===policy.daily_neurons_reserved,'ECONOMIC_GUARD_REQUIRED');
 stage='personas';for(const id of ['COL001','COL002']){
  const ai=status.generative===true&&quotaBefore.remaining_calls>=2,a=await ask(id,'Hola',{realAI:ai,reset:true});
  const own=registry.profiles.find(p=>p.id===id),other=registry.profiles.find(p=>p.id!==id);
  check(a.text.includes(own.commercial_name)&&/asistente virtual/i.test(a.text)&&(!other||!a.text.includes(other.commercial_name)),'PERSONA_IDENTITY_MISMATCH');
 }
 report.checks.two_personas=true;
 stage='families';const groups=[['Samsung','A17'],['Redmi','15C'],['TECNO','Spark Go 3']];let chosen=null;
 for(const [brand,model]of groups){
  const rows=familyRows(brand,model),a=await ask('COL001',`¿Qué variantes del ${brand} ${model} tienen y cuáles son sus precios?`),available=rows.filter(x=>x.r.stock>0);
  const item={family:fold(brand+'_'+model),verified_variants:rows.length,available_variants:available.length,source_fresh:a.source_fresh,returned_variants:a.variant_options?.length||0,price_validation:false};
  if(!rows.length){check(amounts(a.text).length===0,'UNVERIFIED_FAMILY_QUOTE');item.skipped_reason='NO_VERIFIED_PUBLISHED_IDENTITY';report.families.push(item);continue;}
  check(Array.isArray(a.variant_options),'VARIANT_CONTRACT_REQUIRED');const expectedRows=a.source_fresh?available:rows;
  check(a.variant_options.length===expectedRows.length&&a.variant_options.every(v=>expectedRows.some(x=>x.p.sku===v.sku)),'FAMILY_VARIANTS_MISSING_OR_MIXED');
  for(const o of a.variant_options){const x=rows.find(x=>x.p.sku===o.sku);check(o.storage_gb===x.v.storage_gb&&o.ram_physical_gb===x.v.ram_physical_gb,'VARIANT_IDENTITY_MISMATCH');if(a.source_fresh)check(Math.round(o.cash*100)===x.r.promo_centavos&&Math.round(o.card*100)===x.r.pvp_centavos&&a.text.includes(money(x.r.promo_centavos))&&a.text.includes(money(x.r.pvp_centavos)),'VARIANT_EXACT_PRICES_REQUIRED');}
  item.price_validation=true;item.images_verified=await verifyImages(a,'COL001');
  const again=await ask('COL001',`Muéstrame las variantes y precios del ${brand} ${model}`);item.next_reply_images_verified=await verifyImages(again,'COL001');
  report.families.push(item);if(brand==='Samsung')chosen=(a.source_fresh?available:rows)[0]||null;
 }
 report.checks.variant_prices_and_image_dedup=true;
 stage='memory';if(chosen){
  const label=`${chosen.v.brand} ${chosen.v.model} de ${chosen.v.storage_gb} GB con ${chosen.v.ram_physical_gb} GB de RAM`,budget=Math.ceil(chosen.r.promo_centavos/100)+20;
  await ask('COL001',`Me interesa el ${label}; mi presupuesto es de ${budget} dólares`);
  const exact=await ask('COL001','¿Y ese de contado?');check(exact.memory?.focus?.includes(chosen.p.sku)&&exact.memory.budget===budget,'EXACT_VARIANT_MEMORY_LOST');if(exact.source_fresh)check(exact.text.includes(money(chosen.r.promo_centavos)),'EXACT_CASH_QUOTE_MISSING');
  await verifyImages(exact,'COL001');
  const peers=familyRows('Redmi','15C'),peer=peers.find(x=>x.r.stock>0)||peers[0]||chosen,peerBudget=Math.ceil(peer.r.promo_centavos/100)+50;
  await ask('COL002',`Me interesa el ${peer.v.brand} ${peer.v.model} de ${peer.v.storage_gb} GB con ${peer.v.ram_physical_gb} GB de RAM; mi presupuesto es de ${peerBudget} dólares`);
  const card=await ask('COL001','¿Y ese con tarjeta?');check(card.memory?.focus?.includes(chosen.p.sku)&&card.memory.budget===budget,'PERSONA_MEMORY_LEAK');if(card.source_fresh)check(card.text.includes(money(chosen.r.pvp_centavos)),'EXACT_CARD_QUOTE_MISSING');await verifyImages(card,'COL001');
  const erased=await ask('COL001','olvida esta conversación');check(erased.action==='erase'&&erased.memory?.focus?.length===0,'RESET_NOT_CONFIRMED');used.set('COL001',new Set());
  const kept=await ask('COL002','¿Y ese con tarjeta?');check(kept.memory?.focus?.includes(peer.p.sku)&&kept.memory.budget===peerBudget,'RESET_ERASED_OTHER_PERSONA');report.checks.persona_memory_and_reset_isolated=true;
  await ask('COL002','olvida esta conversación');used.set('COL002',new Set());
 }else report.checks.persona_memory_and_reset_isolated='not_exercised_no_verified_A17';
 stage='closure';const current=await publicHub();check(current.p.origen_sha256===pointer.origen_sha256&&current.p.fecha_corte===pointer.fecha_corte,'HUB_CHANGED_DURING_PROBE');
 const quota=await get('/alex/quota'),after=await get('/health');check(quota.reserved_limit===quotaBefore.reserved_limit&&quota.paid_fallback===false,'ECONOMIC_GUARD_CHANGED');check(after.release===healthBefore.release&&after.meta_ingress_enabled===false&&after.messenger_outbound===healthBefore.messenger_outbound,'PILOT_CONTROLS_CHANGED');
 report.checks.controls_and_quota_unchanged=true;report.checks.no_Meta_or_customer_transport=true;report.checks.held_signature_banners_not_sent=report.media.verified_banners===0;report.media.distinct_public_assets_verified=verifiedAssets.size;report.passed=true;
}catch(error){report.failure={stage,code:/^[A-Z0-9_]{3,80}$/.test(error.probeCode||'')?error.probeCode:'NETWORK_OR_RUNTIME_ERROR'};}
const path='automatizacion/generated/fase2/alex-variants-cloud.json';await mkdir('automatizacion/generated/fase2',{recursive:true});await writeFile(path,JSON.stringify(report,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`Alex variants: ${report.passed?'PASS':'FAIL'} · families ${report.families.length} · AI attempts ${report.AI_attempts}/2 · Meta sends 0\n`);
console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
