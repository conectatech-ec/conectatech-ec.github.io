import {hmac,checkHmac} from '../worker.mjs';
const MAX=10;const ROLES=['ADMINISTRADOR','COLABORADOR','SUPERVISOR'];
const error=(code,message)=>{throw Object.assign(new Error(message),{code});};
const stable=x=>JSON.stringify(x,Object.keys(x).sort());
const hash=async x=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x))),b=>b.toString(16).padStart(2,'0')).join('');
export function createNetworkPilot(host,{mode='REVIEW_ONLY',clock=()=>Date.now()}={}){
 for(const name of ['catalogProduct','roster','transaction','readConfirmed593Sale'])if(typeof host[name]!=='function')error('MISSING_BINDING','Falta adaptador del Hub existente: '+name);
 if(mode==='VALIDATION'&&host.validationOnly!==true)error('UNSAFE_VALIDATION','Validación requiere almacenamiento efímero de prueba');
 if(!['REVIEW_ONLY','VALIDATION','CONNECTED'].includes(mode))error('MODE','Modo inválido');
 const writable=()=>{if(mode!=='VALIDATION'&&!(mode==='CONNECTED'&&host.existingInfrastructure===true&&host.productionWritesAuthorized===true))error('REVIEW_ONLY','Sin autorización de escritura en la infraestructura existente');};
 const actor=a=>{if(!a?.verified||!ROLES.includes(a.role)||!a.id)error('AUTH','Identidad no verificada por el servidor');return a;};
 const admin=a=>{actor(a);if(a.role!=='ADMINISTRADOR')error('FORBIDDEN','Solo administrador');};
 const roster=async()=>{const members=await host.roster();if(members.length>MAX||new Set(members.map(m=>m.id)).size!==members.length||members.some(m=>!/^COL00[1-9]$|^COL010$/.test(m.id)))error('ROSTER','Máximo 10 identificadores únicos');return members;};
 const member=async id=>{const m=(await roster()).find(m=>m.id===id);if(!m)error('MEMBER','Colaborador no registrado');return m;};
 const access=(a,id)=>{actor(a);if(a.role==='COLABORADOR'&&a.memberId!==id||a.role==='SUPERVISOR'&&!a.supervisedMembers?.includes(id))error('FORBIDDEN','Información de otro colaborador');};
 const product=async sku=>{const p=await host.catalogProduct(sku);if(!p||p.sku!==sku||!p.available||!Number.isSafeInteger(p.priceCents)||p.priceCents<=0||!p.sourceDigest||!Number.isFinite(Date.parse(p.validUntil))||Date.parse(p.validUntil)<=clock()||!p.approvedMedia?.url||!p.approvedMedia.sha256)error('PRODUCT','Producto no vigente o sin imagen aprobada');return p;};
 const fingerprint=async p=>hash(JSON.stringify([p.sku,p.title,p.description,p.priceCents,p.available,p.approvedMedia,p.signature||null]));
 const validateMember=m=>{if(m.revoked===true)error('REVOKED','Acceso revocado');if(mode!=='VALIDATION'&&!m.active)error('INACTIVE','Plaza reservada; cuenta no activada');};
 async function prepareAdvertisement(a,{memberId,sku,idempotencyKey,existingListing=null}){
  actor(a);access(a,memberId);writable();const m=await member(memberId);if(a.role!=='ADMINISTRADOR')validateMember(m);
  if(!/^[A-Za-z0-9_-]{8,80}$/.test(idempotencyKey||''))error('IDEMPOTENCY','Clave de anuncio inválida');
  if(m.operation==='EXISTING_RAFA_WORK'&&!existingListing)error('RAFA_EXISTING','Rafa: asociar un anuncio existente de Work, no generar otro operativo');
  if(existingListing&&mode!=='VALIDATION'){
   let u;try{u=new URL(existingListing.url);}catch{error('LISTING','Falta enlace de anuncio existente');}
   if(u.protocol!=='https:'||!['facebook.com','www.facebook.com'].includes(u.hostname)||!/^\/(?:share\/[A-Za-z0-9]+|marketplace\/item\/\d+)\/?$/.test(u.pathname)||!existingListing.verifiedByOwner)error('LISTING','Verificar anuncio existente por el propietario');
  }
  const p=await product(sku);const contentFingerprint=await fingerprint(p);
  const id='CT-AD-'+memberId+'-'+sku+'-'+(await hash(idempotencyKey)).slice(0,10).toUpperCase();
  return host.transaction(async tx=>{
   const prior=await tx.get('ads',id);if(prior){if(prior.sku!==sku||prior.memberId!==memberId)error('CONFLICT','Clave reutilizada');return {...prior,requiresRefresh:prior.fingerprint!==contentFingerprint};}
   const ads=await tx.list('ads');if(existingListing&&ads.some(ad=>ad.existingListing?.id===existingListing.id))error('DUPLICATE','Anuncio ya vinculado');
   const ad={id,memberId,sku,state:existingListing?'EXISTENTE_GESTIONADO_POR_RAFA_WORK':'PREPARADO_PARA_REVISION',existingListing,fingerprint:contentFingerprint,sourceDigest:p.sourceDigest,createdAt:new Date(clock()).toISOString(),publishedByPilot:false,validationOnly:mode==='VALIDATION'};
   await tx.put('ads',id,ad);await tx.audit({actor:a.id,action:'ADVERTISEMENT_IDENTIFIED',entity:id});return ad;
  });
 }
 async function material(a,adId){actor(a);const ad=await host.transaction(tx=>tx.get('ads',adId));if(!ad)error('NOT_FOUND','Anuncio no encontrado');access(a,ad.memberId);const p=await product(ad.sku);if(ad.fingerprint!==await fingerprint(p))error('STALE','Material cambió: revisar el anuncio');
  let signature=null;if(typeof host.signatureAsset==='function')signature=await host.signatureAsset(p.sku,p.sourceDigest);
  if(signature&&(!signature.approved||signature.containsBox!==false||signature.productSku!==p.sku||signature.sourceDigest!==p.sourceDigest||signature.priceCents!==p.priceCents||!signature.url||!signature.sha256))error('SIGNATURE','Banner SIGNATURE no vigente o no aprobado');
  return {adId:ad.id,memberId:ad.memberId,sku:p.sku,title:p.title,image:p.approvedMedia,signature,signatureStatus:signature?'REUTILIZADO_APROBADO':'PENDIENTE_MANIFIESTO_EXISTENTE',copy:[p.title,'Contado: $'+(p.priceCents/100).toFixed(2),p.description,p.fulfillment,'Referencia del anuncio: '+ad.id].filter(Boolean).join('\n'),productUrl:p.url,copySource:'EXISTING_WEB_AND_593',publish:false,validationOnly:mode==='VALIDATION'};
 }
 async function reference(a,adId){actor(a);writable();const ad=await host.transaction(tx=>tx.get('ads',adId));if(!ad)error('NOT_FOUND','Anuncio no encontrado');access(a,ad.memberId);validateMember(await member(ad.memberId));const p=await product(ad.sku);if(ad.fingerprint!==await fingerprint(p))error('STALE','Anuncio desactualizado');
  const expires=Math.min(Math.floor((clock()+7*86400000)/1000),Math.floor(Date.parse(p.validUntil)/1000));
  const id='CT-R-'+crypto.randomUUID();const text=id+'.'+expires;const token=text+'.'+await hmac(host.referralSecret,text);
  await host.transaction(async tx=>{await tx.put('references',id,{id,adId,memberId:ad.memberId,sku:ad.sku,expires});await tx.audit({actor:a.id,action:'REFERENCE_PREPARED',entity:id});});
  // The deployment URL is supplied by the existing host, never invented from the product URL.
  return {id,adId,token,expires,link:mode==='CONNECTED'&&host.referenceLandingUrl?host.referenceLandingUrl+'?t='+encodeURIComponent(token):null,activation:mode==='CONNECTED'&&host.referenceLandingUrl?'EXISTING_HOST_CONFIGURED':'PENDING_HOST_AND_OWNER_APPROVAL',live:mode==='CONNECTED'&&!!host.referenceLandingUrl,validationOnly:mode==='VALIDATION'};
 }
 async function resolve(token){
  if(typeof token!=='string'||token.length>500)error('REFERENCE','Referencia inválida');const [id,exp,sig,extra]=token.split('.');
  if(extra||!/^\d+$/.test(exp)||Number(exp)<=clock()/1000||!await checkHmac(host.referralSecret,id+'.'+exp,sig||''))error('REFERENCE','Firma o vigencia inválida');
  const ref=await host.transaction(tx=>tx.get('references',id));if(!ref||ref.expires!==Number(exp))error('REFERENCE','Referencia desconocida');validateMember(await member(ref.memberId));const p=await product(ref.sku);const ad=await host.transaction(tx=>tx.get('ads',ref.adId));if(ad?.fingerprint!==await fingerprint(p))error('STALE','Referencia de material desactualizado');return {ref,product:p};
 }
 async function interest({token,consent,consultationCode}){writable();if(consent!==true||!/^Q-[A-Z0-9_-]{1,30}$/.test(consultationCode||''))error('CONSENT','Consentimiento y código comercial, sin datos personales, requeridos');const {ref}=await resolve(token);const dedupe=ref.id+':'+consultationCode;
  return host.transaction(async tx=>{const prior=(await tx.list('opportunities')).find(o=>o.dedupe===dedupe);if(prior)return prior;const id='CT-OP-'+crypto.randomUUID();const o={id,adId:ref.adId,referenceId:ref.id,memberId:ref.memberId,sku:ref.sku,dedupe,state:'NUEVA CONSULTA',attribution:'SIGNED_REFERENCE_CONFIRMED',saleId:null,commission:{policy:null,amountCents:null,state:'SIN_POLITICA'},validationOnly:mode==='VALIDATION'};await tx.put('opportunities',id,o);await tx.audit({actor:'CONSENTED_CUSTOMER',action:'CONSULTATION_REGISTERED',entity:id});return o;});
 }
 async function confirmedSale(saleId) {
  const sale = await host.readConfirmed593Sale(saleId);
  if (!sale || sale.id !== saleId || sale.status !== 'CONFIRMADA' || sale.currency !== 'USD' || !Number.isSafeInteger(sale.totalCents) || sale.totalCents <= 0 || !sale.evidenceDigest) error('SALE','Venta no confirmada por la fuente 593 existente');
  return sale;
 }
 async function saleProjection(tx, opportunityId, sale) {
  const o = await tx.get('opportunities', opportunityId);
  if (!o) error('NOT_FOUND','Consulta no encontrada');
  validateMember(await member(o.memberId));
  if (o.saleId && o.saleId !== sale.id) error('SALE_CONFLICT','Consulta ya confirmada');
  if (o.state === 'CANCELADA') error('SALE_STATE','Consulta cancelada');
  if (!(sale.lines || []).some(l => l.sku === o.sku && l.quantity > 0)) error('SALE_PRODUCT','La venta no contiene el producto atribuido');
  const used = (await tx.list('opportunities')).find(x => x.saleId === sale.id && x.id !== o.id);
  if (used) error('SALE_DUPLICATE','Venta ya atribuida a otra consulta');
  const matching = sale.lines.filter(l => l.sku === o.sku);
  if (matching.some(l => !Number.isFinite(l.quantity) || l.quantity <= 0 || !Number.isSafeInteger(l.amountCents) || l.amountCents <= 0)) error('SALE_AMOUNT','Falta importe verificado de la línea atribuida');
  const attributed = matching.reduce((n,l) => n + l.amountCents, 0);
  if (attributed > sale.totalCents) error('SALE_AMOUNT','Importe atribuido supera comprobante');
  return {o, attributed};
 }
 async function previewSaleAttribution(a,{opportunityId,saleId,attributionVerified}) {
  admin(a);
  if (attributionVerified !== true) error('ATTRIBUTION','Confirmar la atribución con evidencia, no solo clic o mensaje');
  const sale = await confirmedSale(saleId);
  return host.transaction(async tx => {
   const {o,attributed} = await saleProjection(tx, opportunityId, sale);
   return {write:false, attributionReady:true, opportunityId:o.id, memberId:o.memberId, sku:o.sku, saleId:sale.id, amountCents:attributed, evidenceDigest:sale.evidenceDigest, alreadyAttributed:o.saleId === sale.id, commission:null};
  });
 }
 async function confirmSale(a,{opportunityId,saleId,attributionVerified}) {
  admin(a); writable();
  if (attributionVerified !== true) error('ATTRIBUTION','Confirmar la atribución con evidencia, no solo clic o mensaje');
  // Re-read the source at confirmation; never promote a stored preview into a sale.
  const sale = await confirmedSale(saleId);
  return host.transaction(async tx => {
   const {o,attributed} = await saleProjection(tx, opportunityId, sale);
   if (o.saleId === sale.id) return o;
   const saved = {...o,state:'VENTA CONFIRMADA',saleId:sale.id,amountCents:attributed,sourceEvidence:sale.evidenceDigest};
   await tx.put('opportunities',o.id,saved);
   await tx.audit({actor:a.id,action:'EXISTING_593_SALE_LINKED',entity:o.id});
   return saved;
  });
 }
 async function advanceOpportunity(a,{id,state}){actor(a);writable();return host.transaction(async tx=>{const o=await tx.get('opportunities',id);if(!o)error('NOT_FOUND','Consulta no encontrada');access(a,o.memberId);const stages=['NUEVA CONSULTA','CONTACTADO','INTERESADO','RESERVA PENDIENTE'];if(!stages.includes(o.state)||state!=='CANCELADA'&&state!==stages[stages.indexOf(o.state)+1])error('STATE','Transición no permitida; venta solo con comprobante 593');const updated={...o,state};await tx.put('opportunities',id,updated);await tx.audit({actor:a.id,action:'OPPORTUNITY_'+state,entity:id});return updated;});}
 async function results(a){actor(a);return host.transaction(async tx=>{const opportunities=(await tx.list('opportunities')).filter(o=>a.role==='ADMINISTRADOR'||a.role==='COLABORADOR'&&o.memberId===a.memberId||a.role==='SUPERVISOR'&&a.supervisedMembers?.includes(o.memberId));return {consultations:opportunities.length,confirmedSales:opportunities.filter(o=>o.saleId).length,amountCents:opportunities.reduce((n,o)=>n+(o.amountCents||0),0),commissions:{policy:null,pendingCents:null,approvedCents:null,paidCents:null},opportunities};});}
 async function alexContext({token,channel}){if(!['MESSENGER_PAGE','INSTAGRAM_BUSINESS','WHATSAPP_BUSINESS'].includes(channel)||!host.authorizedAlexChannels?.includes(channel))error('ALEX_CHANNEL','Canal no autorizado; Marketplace personal permanece separado');const {ref,product:p}=await resolve(token);return {internal:{adId:ref.adId,memberId:ref.memberId,referenceId:ref.id,sku:ref.sku},buyer:{title:p.title,description:p.description,priceCents:p.priceCents,image:p.approvedMedia,url:p.url},saleConfirmed:false,humanHandoff:true,personalMarketplaceMessages:false};}
 return {roster,prepareAdvertisement,material,reference,resolve,interest,previewSaleAttribution,confirmSale,advanceOpportunity,results,alexContext,mode,maxCollaborators:MAX,externalPublicationEnabled:false};
}
