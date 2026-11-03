#!/usr/bin/env node
// Read-only acceptance probe: host I/O only reads existing sources. The test
// consultation lives in ephemeral memory; no confirmed sale or commission is written.
import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createNetworkPilot} from '../src/pilot/network.mjs';
import {existingRafaAssociation, fromExistingAlexCatalog} from '../src/pilot/existing-contracts.mjs';
import {createConfirmedSalesReader} from '../src/pilot/confirmed-sales-reader.mjs';
import {fixture, admin, rafa} from '../tests/pilot/fixture.mjs';
import config from '../pilot/config.json' with {type:'json'};

const association = JSON.parse(readFileSync(new URL('../pilot/rafa-existing-association.json', import.meta.url)));
const args = process.argv.slice(2), moduleIndex = args.indexOf('--host-module');
const supplied = moduleIndex >= 0 && args[moduleIndex + 1];
let bindings = {};
const result = {
  mode:'READ_ONLY_INTEGRATION', observedAt:new Date().toISOString(), outcome:'BLOCKED',
  activeCollaborators:['COL001'], reservedInactive:['COL002'], maxCollaborators:10,
  productionWrites:0, externalMessages:0, externalPublications:0, salesWrittenTo593:0,
  confirmedSalesRecorded:0, realCommissionsGenerated:0, simulationSalesCreated:0,
  steps:[], blockers:[]
};
const step = (name, state, detail = {}) => result.steps.push({name, state, ...detail});
try {
bindings = supplied ? await import(pathToFileURL(resolve(supplied)).href) : {};
result.evidenceMode = bindings.recordedProviderReadbacks === true ? 'ACTUAL_PROVIDER_READBACKS_REPLAYED_LOCALLY' : 'EXISTING_HOST_READ_CALLBACKS';
if (typeof bindings.readAlexCatalog !== 'function') {
  result.blockers.push('EXISTING_HOST_READERS_REQUIRED');
} else {
  const source = await bindings.readAlexCatalog();
  const existing = existingRafaAssociation(association), product = fromExistingAlexCatalog(source, existing.sku);
  result.source = {cutDate:source.inventory_cut_date, sha256:source.source_sha256, expiresAt:source.expires_at};
  step('EXISTING_RAFA_MARKETPLACE_AD', 'OWNER_CONFIRMED_EXISTING', {sku:existing.sku, associationId:association.association_id, independentVerification:false});
  if (!product || Date.parse(product.validUntil) <= Date.now()) {
    result.blockers.push('COMMERCIAL_SOURCE_NOT_CURRENT');
  } else {
    const f = fixture();
    f.host.roster = async () => structuredClone(config.participants);
    f.host.catalogProduct = async sku => fromExistingAlexCatalog(source, sku);
    // Binding must originate in the existing authorized host, never in CLI flags
    // containing a customer's claimed receipt or a made-up 593 export.
    const sales = createConfirmedSalesReader({readConfirmed593Sale:bindings.readConfirmed593Sale, sourceVerified:bindings.salesSourceVerified === true});
    f.host.readConfirmed593Sale = sales.read;
    const pilot = createNetworkPilot(f.host, {mode:'VALIDATION'});
    const ad = await pilot.prepareAdvertisement(admin, {...existing, idempotencyKey:association.association_id});
    const ref = await pilot.reference(rafa, ad.id);
    const interest = await pilot.interest({token:ref.token, consent:true, consultationCode:'Q-LOCAL-INTEGRATION-RAFA'});
    step('CONSULTATION_AND_COLLABORATOR', 'LOCAL_REHEARSAL_PASSED', {memberId:interest.memberId, signedReferenceVerified:true, customerContacted:false});
    if (bindings.signatureReader) {
      const checked = await bindings.signatureReader.inspect(product);
      result.signature = checked.status;
      step('EXISTING_SIGNATURE_LIBRARY', checked.status.deliveryAllowed ? 'APPROVED_FOR_DELIVERY' : 'READ_CONNECTED_DELIVERY_BLOCKED');
      result.blockers.push(...checked.status.reasons.map(x => 'SIGNATURE_' + x));
    } else result.blockers.push('SIGNATURE_READER_NOT_BOUND');
    // ALEX's existing engine is exercised locally only. This does not grant
    // App Live, external messaging access or a personal Marketplace inbox API.
    if (typeof bindings.alexReply === 'function') {
      const channelVerified = bindings.channelAssessment?.tester_ready === true;
      let context;
      if (channelVerified) {
        f.host.authorizedAlexChannels = ['MESSENGER_PAGE'];
        context = await pilot.alexContext({token:ref.token, channel:'MESSENGER_PAGE'});
      } else {
        await pilot.resolve(ref.token);
        context = {internal:{memberId:interest.memberId,sku:interest.sku}, channelAuthorized:false};
      }
      const reply = await bindings.alexReply(source, context);
      step('ALEX_MESSENGER_PAGE', typeof reply?.text === 'string' && reply.text.length > 0 ? 'EXISTING_ENGINE_LOCAL_REPLY' : 'FAILED', {externalSend:false, channelAuthorizationVerified:channelVerified, generative:reply?.generative === true, memberId:context.internal.memberId});
      if (!reply?.text) result.blockers.push('ALEX_LOCAL_REPLY_FAILED');
      if (!channelVerified) result.blockers.push('CURRENT_ALEX_TESTER_PERMISSION_NOT_READ_BACK');
    } else {
      step('ALEX_MESSENGER_PAGE', 'PERMISSION_OR_BINDING_NOT_VERIFIED', {externalSend:false});
      result.blockers.push('ALEX_TESTER_BINDING_NOT_VERIFIED');
    }
    result.channelAssessment = bindings.channelAssessment || null;
    result.salesReader = sales.status();
    if (!sales.status().connected) {
      step('CONFIRMED_593_SALE_AND_ATTRIBUTION', 'BLOCKED_NO_VERIFIED_SALES_SOURCE');
      result.blockers.push(sales.status().reason);
    } else if (!bindings.receiptForRafa?.saleId || bindings.receiptForRafa?.attributionEvidenceVerified !== true || bindings.receiptForRafa?.memberId !== 'COL001' || bindings.receiptForRafa?.associationId !== association.association_id || !/^[a-f0-9]{64}$/.test(bindings.receiptForRafa?.attributionEvidenceDigest || '')) {
      step('CONFIRMED_593_SALE_AND_ATTRIBUTION', 'BLOCKED_NO_CORRELATED_REAL_RECEIPT');
      result.blockers.push('REAL_593_RECEIPT_WITH_RAFA_ATTRIBUTION_REQUIRED');
    } else {
      const preview = await pilot.previewSaleAttribution(admin, {opportunityId:interest.id, saleId:bindings.receiptForRafa.saleId, attributionVerified:true});
      step('CONFIRMED_593_SALE_AND_ATTRIBUTION', 'READ_ONLY_PREVIEW_PASSED', {memberId:preview.memberId, sku:preview.sku, written:false, commission:null});
    }
    const totals = await pilot.results(rafa);
    if (totals.confirmedSales || totals.commissions.paidCents !== null || f.sales.size) throw Error('UNEXPECTED_SALE_OR_COMMISSION_WRITE');
  }
}
} catch (error) {
  result.blockers.push('INTEGRATION_READ_OR_VALIDATION_FAILED');
  // Exceptions can contain private paths or URLs. Keep them out of the report.
  if (/^[A-Z_]{3,80}$/.test(error.code || '')) result.errorCode = error.code;
}
result.blockers = [...new Set(result.blockers)];
// Never claim live end-to-end success from a local callback rehearsal.
result.outcome = result.blockers.length ? 'BLOCKED_WITH_VERIFIED_REASONS' : 'LOCAL_READ_ONLY_REHEARSAL_PASSED_NOT_ACTIVATED';
writeFileSync(new URL('../pilot/integration-result.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (args.includes('--require-ready') && result.blockers.length) process.exitCode = 2;
