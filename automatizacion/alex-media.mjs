// One media resolver for every Alex channel. This module cannot release a library
// asset: it only consumes already approved, source-bound metadata and verifies bytes.
import {verifyAssets} from './live.mjs';
import {quoteCurrent} from './alex-catalog.mjs';
import release from './alex-signature-release.json' with {type:'json'};

const ORIGIN='https://conectatech-ec.github.io';
const SHA=/^[a-f0-9]{64}$/;
const SKU=/^[A-Z0-9_-]{3,40}$/;
const PRIVATE_SKUS=new Set(['TELF011','TELF012','REL046']);

export function privateAlexSignatureUrl(value,sku,sha){
 if(typeof value!=='string'||!SKU.test(sku||'')||!SHA.test(sha||''))return false;
 const match=/^https:\/\/conectatech-comercial-piloto\.conectatech-ecu\.workers\.dev\/alex\/signature\/([A-Z0-9_-]{3,40})\/([a-f0-9]{64})\.png$/.exec(value);
 if(!match||match[1]!==sku||match[2]!==sha)return false;
 try{const u=new URL(value);return u.href===value&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{return false;}
}
const exactCents=amount=>{
 if(typeof amount!=='number'||!Number.isFinite(amount)||amount<=0)return null;
 const cents=Math.round(amount*100);return Number.isSafeInteger(cents)&&Math.abs(amount*100-cents)<0.000001?cents:null;
};
export function privateAlexSignature(product,source,{deliveryScope='messenger',now=Date.now(),manifest=release}={}){
 const entry=manifest?.products?.[product?.sku];
 if(deliveryScope!=='private_simulator'||manifest?.schema!=='conectatech.alex.signature.private.v1'||
    manifest.scope!=='private_simulator'||manifest.owner_approved!==true||!PRIVATE_SKUS.has(product?.sku)||
    entry?.owner_approved!==true||entry.approved_scope!=='private_simulator'||
    typeof entry.identity!=='string'||!entry.identity||![product.source_name,product.catalog_identity].includes(entry.identity)||
    product.price_verified!==true||!quoteCurrent(source,product,now)||!(product.stock>0)||product.disponible===false||
    product.central_availability&&product.central_availability!=='in_stock'||(product.blocked_reasons||[]).length||
    !Number.isSafeInteger(entry.promo_cash_cents)||!Number.isSafeInteger(entry.pvp_card_cents)||entry.promo_cash_cents<=0||entry.pvp_card_cents<entry.promo_cash_cents||
    exactCents(product.promo)!==entry.promo_cash_cents||exactCents(product.pvp)!==entry.pvp_card_cents||
    !privateAlexSignatureUrl(entry.url,product.sku,entry.sha256))return null;
 return {url:entry.url,sha:entry.sha256,kind:'approved_banner',owner_approved:true,private_scope:true,scope:'private_simulator',
  promotion_status:['TELF011','TELF012'].includes(product.sku)?'not_confirmed':entry.promotion_status};
}

export function publicAlexImage(value){
 if(typeof value!=='string')return false;
 try{
  const u=new URL(value);
  return u.origin===ORIGIN&&u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&
   u.href===value&&/\.(?:png|jpe?g|webp|avif|gif|svg)$/i.test(u.pathname);
 }catch{return false;}
}

function signatureAllowed(product,source,library,now,deliveryScope){
 const entry=library?.products?.[product.sku];
 return library?.schema==='conectatech.approved_library.handoff.v1'&&
  (!library.delivery_scope||library.delivery_scope===deliveryScope)&&
  library.live_registry_connection_verified===true&&library.no_send_to_buyers===false&&library.messaging_enabled===true&&
  entry?.visual_approved===true&&entry.publication_verified===true&&entry.delivery_allowed===true&&
  SHA.test(source?.source_sha256||'')&&entry.source_sha256===source.source_sha256&&
  entry.cut_date===source.inventory_cut_date&&quoteCurrent(source,product,now)&&product.stock>0&&
  publicAlexImage(product.banner)&&SHA.test(product.banner_sha256||'')&&entry.banner_sha256===product.banner_sha256&&
  (!entry.banner_url||entry.banner_url===product.banner);
}

/**
 * result.images contains internal SKU requests; result.image remains supported.
 * The caller stores returned shown/shown_media in the same encrypted conversation.
 * chooseImage, if provided, only selects a URL; it never bypasses byte verification.
 */
export async function collectAlexMedia(result,source,memory={},options={}){
 const verify=options.verify||verifyAssets,now=options.now??Date.now();
 // Match the chat's two-image display limit. Remaining variants are not marked
 // as shown and can receive their media in the next relevant reply.
 const limit=Number.isInteger(options.maxImages)?Math.max(0,Math.min(2,options.maxImages)):2;
 const shown=new Set((memory.shown||[]).filter(x=>typeof x==='string'&&SKU.test(x)));
 const shownMedia=new Set((memory.shown_media||[]).filter(x=>typeof x==='string'));
 const images=[],usedAssets=new Map(),usedUrls=new Map();
 if(!result||['erase','handoff'].includes(result.action)||!Array.isArray(source?.productos))return {images,shown:[...shown],shown_media:[...shownMedia]};
 const focus=new Set((result.focus||[]).filter(x=>typeof x==='string'&&SKU.test(x)));
 const requested=[...(Array.isArray(result.images)?result.images:[]),result.image].filter(x=>typeof x==='string'&&SKU.test(x));
 // An explicit image request can accompany a comparison. Its sales intent does
 // not turn the image into an unsolicited repeat.
 const repeat=result.media_requested===true||result.intent==='photo';
 for(const sku of [...new Set(requested)]){
  if(!focus.has(sku))continue;
  const matches=source.productos.filter(p=>p.sku===sku);if(matches.length!==1)continue;
  const product=matches[0];
  // Invalid identity can never inherit old media. An explicitly requested photo
  // of a sold-out product may remain useful, but it is never offered automatically.
  if(product.central_availability==='blocked'||product.central_availability==='absent'||
     (product.blocked_reasons||[]).some(x=>/IDENTITY|VARIANT/i.test(x)))continue;
  if(!repeat&&(product.central_availability==='out_of_stock'||product.disponible===false||product.stock<=0))continue;
  const allowBanner=signatureAllowed(product,source,options.signatureLibrary,now,options.deliveryScope||'messenger');
  let privateBanner=privateAlexSignature(product,source,{deliveryScope:options.deliveryScope,now});
  if(privateBanner){
   // Private bytes never go through an unauthenticated external HTTP fetch.
   // The trusted server callback checks the uploaded, encrypted asset and its
   // verified SHA. Public manifest metadata alone cannot release an image.
   if(!repeat&&shownMedia.has(privateBanner.url+'|'+privateBanner.sha))privateBanner=null;
   else{
    let proof;try{if(typeof options.privateAssetReady==='function')proof=await options.privateAssetReady({sku,sha256:privateBanner.sha});}catch{}
    const ready=proof===true||proof?.ready===true&&proof.sku===sku&&proof.sha256===privateBanner.sha;
    privateBanner=ready?{...privateBanner,signature_verified:true}:null;
   }
  }
  const photo=publicAlexImage(product.foto)&&SHA.test(product.foto_sha256||'')?product.foto:null;
  let candidates=[];
  if(privateBanner)candidates.push(privateBanner);
  if(allowBanner)candidates.push({url:product.banner,sha:product.banner_sha256,kind:'approved_banner'});
  if(photo)candidates.push({url:photo,sha:product.foto_sha256,kind:'approved_photo'});
  if(options.chooseImage){
   try{
    const restricted={...product,banner:privateBanner?.url||(allowBanner?product.banner:null),banner_sha256:privateBanner?.sha||(allowBanner?product.banner_sha256:null)};
    const choice=await options.chooseImage(restricted,{allowBanner:!!privateBanner||allowBanner,source,now});
    if(typeof choice==='string'){
     const chosen=candidates.find(c=>c.url===choice);
     if(!chosen)continue; // A private URL or another SKU's asset is never accepted.
     candidates=[chosen,...candidates.filter(c=>c!==chosen)];
    }
   }catch{continue;}
  }
  for(const candidate of candidates){
   // A newly approved private SIGNATURE is a new asset even if this SKU's old
   // photo was shown. Existing photo/other-channel repeat policy stays intact.
   if(shown.has(sku)&&!repeat&&candidate.private_scope!==true)continue;
   const assetKey=candidate.url+'|'+candidate.sha;
   const shared=usedAssets.get(assetKey);
   if(shared){
    // Some exact variants legitimately reference the same approved model photo.
    // Deliver one verified file and explicitly retain every SKU it represents.
    if(shared.kind===candidate.kind&&!shared.skus.includes(sku)){shared.skus.push(sku);shown.add(sku);}
    break;
   }
   if(images.length>=limit||usedUrls.has(candidate.url)||shownMedia.has(assetKey)&&!repeat)continue;
   try{
    // Pass only the chosen asset to the existing verifier. An unavailable banner
    // must not prevent its independent, exact product photo from being verified.
    const media=candidate.kind==='approved_banner'
     ?{...product,foto:null,foto_sha256:null,banner:candidate.url,banner_sha256:candidate.sha}
     :{...product,foto:candidate.url,foto_sha256:candidate.sha,banner:null,banner_sha256:null};
    if(candidate.private_scope!==true)await verify(media);
    const image={sku,skus:[sku],url:candidate.url,kind:candidate.kind,sha256:candidate.sha,
     ...(candidate.signature_verified===true?{signature_verified:true,private_scope:true,scope:'private_simulator',promotion_status:candidate.promotion_status}:{} )};
    images.push(image);
    shown.add(sku);shownMedia.add(assetKey);usedAssets.set(assetKey,image);usedUrls.set(candidate.url,assetKey);break;
   }catch{/* Preserve the useful factual response and try the exact photo. */}
  }
 }
 return {images,shown:[...shown],shown_media:[...shownMedia].slice(-100)};
}
