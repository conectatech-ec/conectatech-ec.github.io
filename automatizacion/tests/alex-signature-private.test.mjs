// Private media authorization tests only. Availability markers are synthetic.
// No PNG is read from or published to the repository; no external HTTP, Graph,
// service activation, or approval changes occur. Asset readiness is injected as
// the trusted server callback after authenticated upload and SHA verification.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import release from '../alex-signature-release.json' with {type:'json'};
import {privateAlexSignature,privateAlexSignatureUrl,collectAlexMedia} from '../alex-media.mjs';
import {verifyAssets} from '../live.mjs';

const NOW=Date.parse('2026-11-03T18:00:00Z'),SOURCE='a'.repeat(64),SHA='b'.repeat(64);
const BASE='https://conectatech-comercial-piloto.conectatech-ecu.workers.dev';
const url=(sku='TELF011',sha=SHA)=>`${BASE}/alex/signature/${sku}/${sha}.png`;
const photoBytes=Buffer.from('synthetic exact photo bytes'),photoSha=createHash('sha256').update(photoBytes).digest('hex');
function fixture(sku='TELF011'){
 const identity='SYNTHETIC '+sku+' exact identity';
 const product={sku,source_name:identity,catalog_identity:identity,price_verified:true,promo:185.90,pvp:232.38,
  stock:1,stock_is_availability_marker:true,disponible:true,central_availability:'in_stock',blocked_reasons:[],
  foto:`https://conectatech-ec.github.io/imagenes/${sku}.webp`,foto_sha256:photoSha,banner:null,banner_sha256:null};
 const source={fuente_fecha:new Date(NOW-3600000).toISOString(),source_sha256:SOURCE,inventory_cut_date:'2026-11-03',productos:[product]};
 const manifest={schema:'conectatech.alex.signature.private.v1',scope:'private_simulator',owner_approved:true,
  products:{[sku]:{sha256:SHA,url:url(sku),promo_cash_cents:18590,pvp_card_cents:23238,identity,approved_scope:'private_simulator',owner_approved:true,promotion_status:'not_confirmed'}}};
 return {product,source,manifest};
}
const select=({product,source,manifest},deliveryScope='private_simulator')=>privateAlexSignature(product,source,{deliveryScope,now:NOW,manifest});

test('Private SIGNATURE URLs require the exact authenticated Worker route, SKU and approved hash',()=>{
 assert.equal(privateAlexSignatureUrl(url(),'TELF011',SHA),true);
 for(const bad of [url().replace('/alex/signature/','/public/'),url('TELF012'),url().replace(SHA,'d'.repeat(64)),
  url()+'?token=private',url()+'#fragment',url()+'\n',url().replace('https://','http://'),
  url().replace('conectatech-ecu.workers.dev','conectatech-ecu.workers.dev.evil.test'),
  url().replace('/TELF011/','/%54ELF011/'),url().replace('https://','https://user:password@'),
  `https://raw.githubusercontent.com/conectatech-ec/conectatech-ec.github.io/${'c'.repeat(40)}/automatizacion/approved-signature/TELF011/${SHA}.png`,
  `https://conectatech-ec.github.io/banners/${SHA}.png`]){
  assert.equal(privateAlexSignatureUrl(bad,'TELF011',SHA),false,bad);
 }
});

test('Only the three approved SKU can select private candidates; metadata alone does not assert verified bytes',()=>{
 for(const sku of ['TELF011','TELF012','REL046']){
  const f=fixture(sku),candidate=select(f);assert.equal(candidate.url,url(sku));assert.equal(candidate.sha,SHA);
  assert.equal(candidate.kind,'approved_banner');assert.equal(candidate.owner_approved,true);assert.notEqual(candidate.signature_verified,true);
  assert.equal(candidate.private_scope,true);assert.equal(candidate.scope,'private_simulator');
  if(sku.startsWith('TELF'))assert.equal(candidate.promotion_status,'not_confirmed');
  for(const scope of ['messenger','whatsapp','private',''])assert.equal(select(f,scope),null);
 }
 assert.equal(select(fixture('TELF017')),null);
});

test('Identity, owner approval, exact current prices, availability and freshness cannot be bypassed',()=>{
 const f=fixture();
 for(const mutate of [x=>x.manifest.owner_approved=false,x=>x.manifest.scope='messenger',x=>x.manifest.schema='other',
  x=>x.manifest.products.TELF011.owner_approved=false,x=>x.manifest.products.TELF011.approved_scope='messenger',
  x=>x.manifest.products.TELF011.identity='another variant',x=>x.product.price_verified=false,
  x=>x.product.stock=0,x=>x.product.disponible=false,x=>x.product.central_availability='out_of_stock',
  x=>x.product.blocked_reasons=['IDENTITY_VARIANT_REVIEW'],x=>x.product.promo+=0.01,x=>x.product.pvp+=0.01,
  x=>x.product.promo+=0.001,x=>x.manifest.products.TELF011.promo_cash_cents=-1,
  x=>x.manifest.products.TELF011.pvp_card_cents=23238.1,
  x=>x.source.fuente_fecha=new Date(NOW-48*3600000).toISOString(),x=>x.source.fuente_fecha=new Date(NOW+3600000).toISOString(),
  x=>x.manifest.products.TELF011.url=url('TELF012')]){
  const changed=structuredClone(f);mutate(changed);assert.equal(select(changed),null);
 }
 const onlyCatalog=structuredClone(f);delete onlyCatalog.product.source_name;assert.ok(select(onlyCatalog));
 assert.equal(JSON.stringify(f),JSON.stringify(fixture()),'Selection is read-only and cannot release a global library');
});

function activeReleaseFixture(){
 assert.equal(release.schema,'conectatech.alex.signature.private.v1');assert.equal(release.scope,'private_simulator');assert.equal(release.owner_approved,true);
 const sku='TELF011',row=release.products[sku];assert.ok(row&&row.owner_approved===true);
 const f=fixture(sku);Object.assign(f.product,{source_name:row.identity,catalog_identity:row.identity,promo:row.promo_cash_cents/100,pvp:row.pvp_card_cents/100});
 assert.equal(privateAlexSignatureUrl(row.url,sku,row.sha256),true);
 return {...f,row,result:{action:'recommend',intent:'recommend',focus:[sku],images:[sku]}};
}

test('A private SIGNATURE after an old photo requires authenticated stored-asset readiness and deduplicates by its own SHA asset',async()=>{
 const f=activeReleaseFixture();let proofs=0;
 const options={deliveryScope:'private_simulator',now:NOW,privateAssetReady:async({sku,sha256})=>{proofs++;assert.equal(sku,f.product.sku);assert.equal(sha256,f.row.sha256);return {ready:true,sku,sha256};},
  verify:async()=>assert.fail('Protected private bytes must not be fetched through the public verifier')};
 const first=await collectAlexMedia(f.result,f.source,{shown:[f.product.sku],shown_media:[f.product.foto+'|'+photoSha]},options);
 assert.equal(first.images.length,1);assert.equal(proofs,1);const image=first.images[0];
 assert.equal(image.url,f.row.url);assert.equal(image.sha256,f.row.sha256);assert.equal(image.signature_verified,true);assert.equal(image.private_scope,true);assert.equal(image.scope,'private_simulator');assert.equal(image.promotion_status,'not_confirmed');
 assert.ok(first.shown_media.includes(f.row.url+'|'+f.row.sha256));
 const again=await collectAlexMedia(f.result,f.source,first,options);assert.equal(again.images.length,0);assert.equal(proofs,1);
 const explicit=await collectAlexMedia({...f.result,media_requested:true,intent:'compare'},f.source,first,options);assert.equal(explicit.images.length,1);assert.equal(proofs,2);
});

test('Missing, unavailable or mismatched private readiness falls back only to the exact public photo',async()=>{
 const f=activeReleaseFixture();
 for(const readiness of [undefined,async()=>false,async()=>{throw Error('Private asset missing');},
  async()=>({ready:true,sku:'TELF012',sha256:f.row.sha256}),async()=>({ready:true,sku:f.product.sku,sha256:SHA})]){
  const fetched=[],media=await collectAlexMedia({...f.result,media_requested:true},f.source,{}, {deliveryScope:'private_simulator',now:NOW,privateAssetReady:readiness,
   verify:p=>verifyAssets(p,async requested=>{fetched.push(requested);assert.equal(requested,f.product.foto);return new Response(photoBytes);})});
  assert.equal(media.images[0].url,f.product.foto);assert.equal(media.images[0].kind,'approved_photo');assert.notEqual(media.images[0].signature_verified,true);assert.deepEqual(fetched,[f.product.foto]);
 }
 const fakes=[],media=await collectAlexMedia({...f.result,media_requested:true},f.source,{}, {deliveryScope:'messenger',now:NOW,
  privateAssetReady:async()=>assert.fail('Messenger never checks or releases a private asset'),
  verify:p=>verifyAssets(p,async requested=>{fakes.push(requested);assert.equal(requested,f.product.foto);return new Response(photoBytes);})});
 assert.equal(media.images[0].kind,'approved_photo');assert.deepEqual(fakes,[f.product.foto]);
 const privateReady=await collectAlexMedia(f.result,f.source,{}, {deliveryScope:'private_simulator',now:NOW,privateAssetReady:async()=>true,
  verify:async()=>assert.fail('A trusted authenticated upload proof already verifies private bytes')});
 assert.equal(privateReady.images[0].signature_verified,true);
});
