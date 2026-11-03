// Mount into the EXISTING Hub. No database, catalog, scheduled job or Worker is created.
import {createNetworkPilot} from './network.mjs';
export function existingHubAdapter(s){
 for(const name of ['readCommercialProduct','listCollaboratorSlots','collaboratorTransaction','readConfirmed593Sale'])if(typeof s?.[name]!=='function')throw Error('Conectar servicio existente: '+name);
 return {catalogProduct:s.readCommercialProduct,roster:s.listCollaboratorSlots,transaction:s.collaboratorTransaction,readConfirmed593Sale:s.readConfirmed593Sale,signatureAsset:s.readSignatureApprovedAsset,authorizedAlexChannels:s.authorizedAlexChannels||[],referralSecret:s.referralSecret,referenceLandingUrl:s.referenceLandingUrl,existingInfrastructure:true,productionWritesAuthorized:s.ownerAuthorizedPilotWrites===true};
}
export function mountInExistingHub(services){
 if(typeof services?.authenticateExistingSession!=='function')throw Error('Falta autenticación individual del Hub existente');
 const pilot=createNetworkPilot(existingHubAdapter(services),{mode:services.ownerAuthorizedPilotWrites===true?'CONNECTED':'REVIEW_ONLY'});
 return {pilot,async dispatch(request){
  const url=new URL(request.url),actor=await services.authenticateExistingSession(request);if(!actor?.verified)return Response.json({error:'AUTH'},{status:401});
  if(request.method==='GET'&&url.pathname.endsWith('/results'))return Response.json(await pilot.results(actor),{headers:{'Cache-Control':'no-store'}});
  if(request.method!=='POST')return Response.json({error:'NOT_FOUND'},{status:404});
  if(request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.startsWith('application/json'))return Response.json({error:'ORIGIN'},{status:403});
  const raw=await request.text();if(raw.length>8192)return Response.json({error:'TOO_LARGE'},{status:413});let body;try{body=JSON.parse(raw);}catch{return Response.json({error:'JSON'},{status:400});}
  const methods={advertisements:()=>pilot.prepareAdvertisement(actor,body),material:()=>pilot.material(actor,body.adId),references:()=>pilot.reference(actor,body.adId),'confirm-sale':()=>pilot.confirmSale(actor,body),opportunity:()=>pilot.advanceOpportunity(actor,body)};const action=methods[url.pathname.split('/').pop()];if(!action)return Response.json({error:'NOT_FOUND'},{status:404});
  try{return Response.json(await action(),{headers:{'Cache-Control':'no-store'}});}catch(e){return Response.json({error:e.code||'INTERNAL',message:e.code?e.message:'Error interno'},{status:e.code==='REVIEW_ONLY'?409:e.code==='FORBIDDEN'?403:400,headers:{'Cache-Control':'no-store'}});}
 }};
}
// Public export is a read-only source, not a second Hub.
export function publicExportProduct(exported,sku,{description='',fulfillment='',validUntil}={}){
 const p=exported.productos?.find(p=>p.sku===sku),v=exported.presentation?.products?.[sku];if(!p||!v?.approved_media||exported.presentation_status!=='PRESENTATION_READY'||exported.presentation.schema!=='conectatech.alex.presentation.v1'||exported.presentation.source_sha256!==exported.fuente_sha256)return null;
 return {sku,title:v.display_title||p.nombre,description,priceCents:Math.round(p.promo*100),pvpCents:Math.round(p.pvp*100),available:Number(p.stock)>0,url:p.url,approvedMedia:v.approved_media,sourceDigest:exported.fuente_sha256,validUntil,fulfillment};
}
