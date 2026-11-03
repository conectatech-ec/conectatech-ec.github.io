import config from '../../pilot/config.json' with {type:'json'};
import {existingEventsLedger} from './existing-events-ledger.mjs';
import {fromExistingAlexCatalog,signatureFromExistingLibrary} from './existing-contracts.mjs';
import {mountInExistingHub} from './adapters.mjs';
import {createExistingSignatureReader} from './signature-reader.mjs';
import {createConfirmedSalesReader} from './confirmed-sales-reader.mjs';
// Call from the current host after importing its existing refreshAlexCatalog,
// authentication, seal/unseal and env.DB. Never deploy a second Worker.
export function wireExistingHost({db,readAlexCatalog,seal,unseal,authenticateExistingSession,readConfirmed593Sale=null,salesSourceVerified=false,signatureLibrary=null,signatureLibraryReaders=null,referralSecret,referenceLandingUrl=null,verifiedAlexChannels=[],ownerAuthorizedPilotWrites=false}){
 if(typeof readAlexCatalog!=='function'||typeof authenticateExistingSession!=='function')throw Error('EXISTING_HOST_READERS_REQUIRED');
 const transaction=existingEventsLedger(db,{encode:seal,decode:unseal});
 const sales=createConfirmedSalesReader({readConfirmed593Sale,sourceVerified:salesSourceVerified});
 const signature=signatureLibraryReaders?createExistingSignatureReader(signatureLibraryReaders):null;
 const mounted=mountInExistingHub({
  authenticateExistingSession,referralSecret,referenceLandingUrl,ownerAuthorizedPilotWrites,
  authorizedAlexChannels:verifiedAlexChannels,
  listCollaboratorSlots:async()=>config.participants.map(p=>({id:p.id,alias:p.alias,active:p.active===true,operation:p.operation})),
  collaboratorTransaction:transaction,
  readCommercialProduct:async sku=>fromExistingAlexCatalog(await readAlexCatalog(),sku),
  readConfirmed593Sale:sales.read,
  readSignatureApprovedAsset:async(sku,sourceDigest)=>{const product=fromExistingAlexCatalog(await readAlexCatalog(),sku);return product&&product.sourceDigest===sourceDigest?(signature?signature.asset(product):signatureFromExistingLibrary(signatureLibrary,sku,sourceDigest,product.priceCents)):null;},
  readSignatureReview:async sku=>{const product=fromExistingAlexCatalog(await readAlexCatalog(),sku);return signature&&product?(await signature.inspect(product)).status:null;}
 });
 return {...mounted,integrations:{sales:sales.status,signatureReaderConnected:!!signature}};
}
