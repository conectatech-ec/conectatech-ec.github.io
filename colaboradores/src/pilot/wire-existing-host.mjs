import config from '../../pilot/config.json' with {type:'json'};
import {existingEventsLedger} from './existing-events-ledger.mjs';
import {fromExistingAlexCatalog,signatureFromExistingLibrary} from './existing-contracts.mjs';
import {mountInExistingHub} from './adapters.mjs';
// Call from the current host after importing its existing refreshAlexCatalog,
// authentication, seal/unseal and env.DB. Never deploy a second Worker.
export function wireExistingHost({db,readAlexCatalog,seal,unseal,authenticateExistingSession,readConfirmed593Sale=null,signatureLibrary=null,referralSecret,referenceLandingUrl=null,verifiedAlexChannels=[],ownerAuthorizedPilotWrites=false}){
 if(typeof readAlexCatalog!=='function'||typeof authenticateExistingSession!=='function')throw Error('EXISTING_HOST_READERS_REQUIRED');
 const transaction=existingEventsLedger(db,{encode:seal,decode:unseal});
 return mountInExistingHub({
  authenticateExistingSession,referralSecret,referenceLandingUrl,ownerAuthorizedPilotWrites,
  authorizedAlexChannels:verifiedAlexChannels,
  listCollaboratorSlots:async()=>config.participants.map(p=>({id:p.id,alias:p.alias,active:p.active===true,operation:p.operation})),
  collaboratorTransaction:transaction,
  readCommercialProduct:async sku=>fromExistingAlexCatalog(await readAlexCatalog(),sku),
  readConfirmed593Sale:typeof readConfirmed593Sale==='function'?readConfirmed593Sale:async()=>null,
  readSignatureApprovedAsset:async(sku,sourceDigest)=>{const product=fromExistingAlexCatalog(await readAlexCatalog(),sku);return product?signatureFromExistingLibrary(signatureLibrary,sku,sourceDigest,product.priceCents):null;}
 });
}
