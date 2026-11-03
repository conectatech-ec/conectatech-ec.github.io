// Personality overlay over the EXISTING Red Comercial member IDs, not another CRM or ledger.
const NETWORK={branch:'colaboradores/piloto-20261103',revision:'26485b6b1912be06dea5409e56fb28501436d59b',schema:'conectatech.collaborators.pilot.v2',config:'colaboradores/pilot/config.json'};
const profiles=Object.freeze({
 COL001:Object.freeze({id:'COL001',commercial_name:'Rafa Valderrama',gender:'masculine',style:'masculino, jocoso, directo y comercial',network_active:true,identity:'Soy Alex, el asistente virtual de Rafa Valderrama en CONECTATECH.',greeting:'¡Epa! Soy Alex, el asistente virtual de Rafa Valderrama en CONECTATECH. 😎',voice:'Voz masculina, jocosa y directa; humor latinoamericano natural, sin bromas forzadas. Escucha y vende con respeto, sin presionar.'}),
 COL002:Object.freeze({id:'COL002',commercial_name:'Jessy Fox',gender:'feminine',style:'femenina, amable, cercana y comercial',network_active:false,identity:'Soy Alex, la asistente virtual de Jessy Fox en CONECTATECH.',greeting:'¡Hola! Soy Alex, la asistente virtual de Jessy Fox en CONECTATECH. 😊',voice:'Voz femenina, amable y cercana; atención cálida y comercial. Sé clara, empática y práctica, sin confianza excesiva ni presión.'})
});
export const getProfile=id=>Object.hasOwn(profiles,id||'')?profiles[id]:null;
export function profilesForOwner(){return {max_collaborators:10,profiles:Object.values(profiles).map(({id,commercial_name,gender,style})=>({id,commercial_name,gender,style})),scope:'owner_simulator_only',external_enabled:false,network:NETWORK};}
export function routeSimulator(b){
 const p=getProfile(b?.collaborator_id);
 if(!p||b.channel!=='simulator'||!(/^[a-zA-Z0-9_-]{16,64}$/).test(b.session_id||'')||typeof b.message!=='string'||!b.message.trim()||b.message.length>1000)throw Error('Invalid collaborator simulation');
 if(Object.keys(b).some(k=>!['collaborator_id','channel','session_id','message','quick_reply_payload','reset','catalog_only'].includes(k)))throw Error('Untrusted attribution fields');
 return {namespace:'alex-demo-'+p.id+'-simulator-'+b.session_id,body:{message:b.message,quick_reply_payload:b.quick_reply_payload,reset:b.reset===true,catalog_only:b.catalog_only===true}};
}
export function personaForNamespace(name){const m=/^alex-demo-(COL00[1-9]|COL010)-simulator-[a-zA-Z0-9_-]{16,64}$/.exec(name||'');return m?getProfile(m[1]):null;}
export function withPersona(source,profile){const p=getProfile(profile?.id);if(!p)throw Error('Unknown collaborator');return {...source,advisor_persona:p};}
export function attributionFor(profile,action='answer'){
 const p=getProfile(profile?.id);if(!p)throw Error('Unknown collaborator');
 return {memberId:p.id,collaborator_id:p.id,commercial_name:p.commercial_name,channel:'simulator',origin_verification:'operator_authenticated',
  stage:action==='interest'?'interest_pending':action==='handoff'?'handoff_pending':'conversation',sales_confirmed:false,saleConfirmed:false,
  network_sync_status:'not_delivered_review_only',network:NETWORK};
}
// Existing wireExistingHost() supplies both collaborators network and verified channel middleware.
// Never expose this adapter as an endpoint accepting a client-supplied verification boolean.
export function createNetworkBridge({network,verifyInboundChannel}={}){
 if(typeof network?.alexContext!=='function'||typeof verifyInboundChannel!=='function')throw Error('Existing verified network host required');
 return {async resolve({token,event}){
  const proof=await verifyInboundChannel(event);
  if(!proof?.verified||!['MESSENGER_PAGE','INSTAGRAM_BUSINESS','WHATSAPP_BUSINESS'].includes(proof.channel))return null;
  const context=await network.alexContext({token,channel:proof.channel}),p=getProfile(context?.internal?.memberId);
  if(!p||!p.network_active||context.saleConfirmed!==false||context.personalMarketplaceMessages!==false)return null;
  return {profile:p,internal:context.internal,channel:proof.channel,origin_verification:'red_comercial_signed_referral',buyer_identity_verified:false,
   personal_profile_inbox_verified:false,saleConfirmed:false,external_send_enabled:false};
 }};
}
