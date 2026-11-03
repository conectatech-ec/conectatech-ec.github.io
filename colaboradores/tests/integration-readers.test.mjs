import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createExistingSignatureReader} from '../src/pilot/signature-reader.mjs';
import {createConfirmedSalesReader} from '../src/pilot/confirmed-sales-reader.mjs';
import {createNetworkPilot} from '../src/pilot/network.mjs';
import {fixture, clock, admin, rafa} from './pilot/fixture.mjs';
const sha = x => createHash('sha256').update(x).digest('hex');
function signatureFixture() {
  const bytes = new Uint8Array([137,80,78,71,13,10,26,10,0,0]), source = 'a'.repeat(64);
  const product = {sku:'TELF017', sourceDigest:source, priceCents:15990, pvpCents:19988, available:true, validUntil:'2026-11-03T22:48:22Z'};
  const p = {sku:product.sku, estado:'APROBADO', aprobacion_comercial:'APROBADO', material_vigente_verificado:true, fuente_593_sha256:source, fecha_datos:'2026-11-02', precio_contado:'159.90', pvp:'199.88', disponibilidad_comercial:true, activo:true, apto_envio:true, banner_sha256:sha(bytes), publicacion_drive:{id_drive:'UNIT_PRIVATE_ID', estado_aprobacion:'APROBADO', estado_publicacion:'VERIFICADO', sha256_fuente:source, fecha_corte:'2026-11-02', checksum_archivo:sha(bytes)}};
  const manifest = {esquema_version:2, fuente_593_sha256:source, fecha_datos:'2026-11-02', no_enviar_a_compradores:false, mensajeria_activada:true, productos:[p]};
  const meta = {id:'UNIT_PRIVATE_ID', mimeType:'image/png', parents:['UNIT_APPROVED_FOLDER'], modifiedTime:'2026-11-02T12:00:00Z', trashed:false};
  const io = {readManifest:async()=>manifest, readFileMetadata:async()=>meta, readFileBytes:async()=>bytes, approvedFolders:['UNIT_APPROVED_FOLDER'], assetUrlFor:async()=> 'https://example.test/existing-authorized-asset', clock};
  return {manifest, product, p, meta, io};
}
test('existing factory manifest is consumed without exporting private Drive references', async () => {
  const f=signatureFixture(), result=await createExistingSignatureReader(f.io).inspect(f.product);
  assert.equal(result.status.deliveryAllowed,true);assert.equal(result.status.integrityVerified,true);
  assert.equal(result.asset.priceCents,15990);assert.doesNotMatch(JSON.stringify(result),/UNIT_PRIVATE_ID|UNIT_APPROVED_FOLDER/);
});
test('actual stale-source/no-send/changed-file pattern blocks delivery even after visual approval', async () => {
  const f=signatureFixture();f.manifest.fuente_593_sha256='b'.repeat(64);f.manifest.no_enviar_a_compradores=true;f.p.banner_sha256='c'.repeat(64);f.p.publicacion_drive.checksum_archivo=f.p.banner_sha256;
  const r=await createExistingSignatureReader(f.io).inspect(f.product);
  assert.equal(r.asset,null);for(const reason of ['SOURCE_MISMATCH','FACTORY_NO_SEND','FILE_SHA_MISMATCH'])assert.ok(r.status.reasons.includes(reason));
});
test('price and availability are cross-checked against the existing commercial product', async () => {
  const f=signatureFixture();f.p.precio_contado='100.00';f.p.disponibilidad_comercial=false;
  const r=await createExistingSignatureReader(f.io).inspect(f.product);assert.equal(r.asset,null);assert.ok(r.status.reasons.includes('PRICE_MISMATCH'));assert.ok(r.status.reasons.includes('UNAVAILABLE'));
});
test('expiry is never renewed by reading or approving a banner', async () => {
  const f=signatureFixture();f.io.clock=()=>Date.parse('2026-11-03T22:48:23Z');
  const r=await createExistingSignatureReader(f.io).inspect(f.product);assert.equal(r.asset,null);assert.ok(r.status.reasons.includes('SOURCE_EXPIRED'));
});
test('an arbitrary folder, MIME or trashed asset cannot enter the library', async () => {
  for(const bad of [{parents:['UNIT_OTHER']},{mimeType:'application/pdf'},{trashed:true}]){
    const f=signatureFixture();Object.assign(f.meta,bad);const r=await createExistingSignatureReader(f.io).inspect(f.product);assert.equal(r.asset,null);assert.ok(r.status.reasons.includes('FILE_OUTSIDE_APPROVED_LIBRARY'));
  }
});
test('concurrent file replacement is rejected after download', async () => {
  const f=signatureFixture();let reads=0;f.io.readFileMetadata=async()=>({...f.meta,modifiedTime:++reads===1?'2026-11-02T12:00:00Z':'2026-11-02T12:01:00Z'});
  const r=await createExistingSignatureReader(f.io).inspect(f.product);assert.equal(r.asset,null);assert.ok(r.status.reasons.includes('FILE_CHANGED_DURING_READ'));
});
test('private Drive URLs never become a buyer-facing delivery route', async () => {
  const f=signatureFixture();f.io.assetUrlFor=async()=> 'https://drive.google.com/file/d/PRIVATE/view';
  const r=await createExistingSignatureReader(f.io).inspect(f.product);assert.equal(r.asset,null);assert.ok(r.status.reasons.includes('PRIVATE_OR_INVALID_ASSET_ROUTE'));
});
test('a new manifest is read for each operation, including approval revocation', async () => {
  const f=signatureFixture(),reader=createExistingSignatureReader(f.io);assert.ok(await reader.asset(f.product));f.p.estado='REVISAR';assert.equal(await reader.asset(f.product),null);
});
test('duplicate SKU and unverified references fail closed', async () => {
  const f=signatureFixture();f.manifest.productos.push(structuredClone(f.p));assert.ok((await createExistingSignatureReader(f.io).inspect(f.product)).status.reasons.includes('DUPLICATE_SKU'));
  f.manifest.productos.pop();f.p.publicacion_drive.checksum_archivo='other';assert.ok((await createExistingSignatureReader(f.io).inspect(f.product)).status.reasons.includes('FILE_REFERENCE_INVALID'));
});
const unitReceipt=()=>({id:'UNIT_ONLY',status:'CONFIRMADA',currency:'USD',totalCents:15990,evidenceDigest:sha('UNIT_RECEIPT_NOT_A_REAL_SALE'),lines:[{sku:'TELF017',quantity:1,amountCents:15990}],customer:'PRIVATE_CUSTOMER'});
test('593 binding must be explicitly verified and cannot be replaced with inventory data', async () => {
  const r=createConfirmedSalesReader({readConfirmed593Sale:async()=>unitReceipt()});assert.equal(r.status().connected,false);await assert.rejects(()=>r.read('UNIT_ONLY'),{code:'EXISTING_593_SALES_BINDING_NOT_VERIFIED'});
  const stock=createConfirmedSalesReader({sourceVerified:true,readConfirmed593Sale:async()=>({productos:[]})});await assert.rejects(()=>stock.read('UNIT_ONLY'),{code:'UNVERIFIED_593_SALE'});
});
test('593 read contract strips private data and exposes no sale writer', async () => {
  const r=createConfirmedSalesReader({sourceVerified:true,readConfirmed593Sale:async()=>unitReceipt()});const sale=await r.read('UNIT_ONLY');assert.equal(sale.customer,undefined);assert.equal(sale.totalCents,15990);assert.deepEqual(Object.keys(r),['status','read']);
});
test('unconfirmed, canceled, wrong-ID or missing receipt evidence cannot confirm a sale', async () => {
  for(const change of [{status:'PENDIENTE'},{status:'ANULADA'},{id:'OTHER'},{evidenceDigest:null},{totalCents:-1},{currency:'EUR'}]){
    const r=createConfirmedSalesReader({sourceVerified:true,readConfirmed593Sale:async()=>({...unitReceipt(),...change})});await assert.rejects(()=>r.read('UNIT_ONLY'),{code:'UNVERIFIED_593_SALE'});
  }
});
test('invalid line amounts and invoice over-allocation are rejected', async () => {
  for(const line of [{sku:'TELF017',quantity:0,amountCents:1},{sku:'TELF017',quantity:1,amountCents:0},{sku:'TELF017',quantity:1,amountCents:999999}]){
    const r=createConfirmedSalesReader({sourceVerified:true,readConfirmed593Sale:async()=>({...unitReceipt(),lines:[line]})});await assert.rejects(()=>r.read('UNIT_ONLY'));
  }
});
test('missing real receipt remains absent; no sale is synthesized', async () => {
  const r=createConfirmedSalesReader({sourceVerified:true,readConfirmed593Sale:async()=>null});assert.equal(await r.read('UNKNOWN'),null);
});
async function opportunityFixture() {
  const f=fixture(),p=createNetworkPilot(f.host,{mode:'VALIDATION',clock});
  const ad=await p.prepareAdvertisement(admin,{memberId:'COL001',sku:'TELF017',idempotencyKey:'UNIT_ONLY_AD',existingListing:{id:'UNIT_LISTING'}}),ref=await p.reference(rafa,ad.id);
  const o=await p.interest({token:ref.token,consent:true,consultationCode:'Q-UNIT-ONLY'});
  f.sales.set('UNIT_ONLY',unitReceipt());return {f,p,o};
}
test('attribution preview is read-only even in REVIEW_ONLY mode, with no sales or commission entries', async () => {
  const {f,o}=await opportunityFixture(),p=createNetworkPilot(f.host,{mode:'REVIEW_ONLY',clock}),before=structuredClone(f.db);
  const preview=await p.previewSaleAttribution(admin,{opportunityId:o.id,saleId:'UNIT_ONLY',attributionVerified:true});assert.equal(preview.write,false);assert.equal(preview.memberId,'COL001');assert.equal(preview.amountCents,15990);assert.equal(preview.commission,null);assert.deepEqual(f.db,before);
});
test('preview requires admin and attribution evidence; confirmation re-reads 593', async () => {
  const {f,p,o}=await opportunityFixture(),input={opportunityId:o.id,saleId:'UNIT_ONLY',attributionVerified:true};
  await assert.rejects(()=>p.previewSaleAttribution(rafa,input),{code:'FORBIDDEN'});await assert.rejects(()=>p.previewSaleAttribution(admin,{...input,attributionVerified:false}),{code:'ATTRIBUTION'});
  await p.previewSaleAttribution(admin,input);f.sales.clear();await assert.rejects(()=>p.confirmSale(admin,input),{code:'SALE'});assert.equal((await p.results(rafa)).confirmedSales,0);
});
test('revoked collaborator cannot receive attribution', async () => {
  const {f,p,o}=await opportunityFixture();f.members[0].revoked=true;await assert.rejects(()=>p.previewSaleAttribution(admin,{opportunityId:o.id,saleId:'UNIT_ONLY',attributionVerified:true}),{code:'REVOKED'});
});
