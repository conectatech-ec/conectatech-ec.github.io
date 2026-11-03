// One media resolver for every Alex channel. This module cannot release a library
// asset: it only consumes already approved, source-bound metadata and verifies bytes.
import {verifyAssets} from './live.mjs';
import {quoteCurrent} from './alex-catalog.mjs';

const ORIGIN='https://conectatech-ec.github.io';
const SHA=/^[a-f0-9]{64}$/;
const SKU=/^[A-Z0-9_-]{3,40}$/;

export function publicAlexImage(value){
 if(typeof value!=='string')return false;
 try{
  const u=new URL(value);
  return u.origin===ORIGIN&&u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&
   u.href===value&&/\.(?:png|jpe?g|webp|avif|gif|svg)$/i.test(u.pathname);
 }catch{return false;}
}

function signatureAllowed(product,source,library,now){
 const entry=library?.products?.[product.sku];
 return library?.schema==='conectatech.approved_library.handoff.v1'&&
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
 const images=[],usedAssets=new Set();
 if(!result||['erase','handoff'].includes(result.action)||!Array.isArray(source?.productos))return {images,shown:[...shown],shown_media:[...shownMedia]};
 const focus=new Set((result.focus||[]).filter(x=>typeof x==='string'&&SKU.test(x)));
 const requested=[...(Array.isArray(result.images)?result.images:[]),result.image].filter(x=>typeof x==='string'&&SKU.test(x));
 const repeat=result.intent==='photo';
 for(const sku of [...new Set(requested)]){
  if(images.length>=limit)break;
  if(!focus.has(sku)||shown.has(sku)&&!repeat)continue;
  const matches=source.productos.filter(p=>p.sku===sku);if(matches.length!==1)continue;
  const product=matches[0];
  // Invalid identity can never inherit old media. An explicitly requested photo
  // of a sold-out product may remain useful, but it is never offered automatically.
  if(product.central_availability==='blocked'||product.central_availability==='absent'||
     (product.blocked_reasons||[]).some(x=>/IDENTITY|VARIANT/i.test(x)))continue;
  if(!repeat&&(product.central_availability==='out_of_stock'||product.disponible===false||product.stock<=0))continue;
  const allowBanner=signatureAllowed(product,source,options.signatureLibrary,now);
  const photo=publicAlexImage(product.foto)&&SHA.test(product.foto_sha256||'')?product.foto:null;
  let candidates=[];
  if(allowBanner)candidates.push({url:product.banner,sha:product.banner_sha256,kind:'approved_banner'});
  if(photo)candidates.push({url:photo,sha:product.foto_sha256,kind:'approved_photo'});
  if(options.chooseImage){
   try{
    const restricted={...product,banner:allowBanner?product.banner:null,banner_sha256:allowBanner?product.banner_sha256:null};
    const choice=await options.chooseImage(restricted,{allowBanner,source,now});
    if(typeof choice==='string'){
     const chosen=candidates.find(c=>c.url===choice);
     if(!chosen)continue; // A private URL or another SKU's asset is never accepted.
     candidates=[chosen,...candidates.filter(c=>c!==chosen)];
    }
   }catch{continue;}
  }
  for(const candidate of candidates){
   const assetKey=candidate.url+'|'+candidate.sha;
   if(usedAssets.has(assetKey)||shownMedia.has(assetKey)&&!repeat)continue;
   try{
    // Pass only the chosen asset to the existing verifier. An unavailable banner
    // must not prevent its independent, exact product photo from being verified.
    const media=candidate.kind==='approved_banner'
     ?{...product,foto:null,foto_sha256:null,banner:candidate.url,banner_sha256:candidate.sha}
     :{...product,foto:candidate.url,foto_sha256:candidate.sha,banner:null,banner_sha256:null};
    await verify(media);
    images.push({sku,url:candidate.url,kind:candidate.kind});
    shown.add(sku);shownMedia.add(assetKey);usedAssets.add(assetKey);break;
   }catch{/* Preserve the useful factual response and try the exact photo. */}
  }
 }
 return {images,shown:[...shown],shown_media:[...shownMedia].slice(-100)};
}
