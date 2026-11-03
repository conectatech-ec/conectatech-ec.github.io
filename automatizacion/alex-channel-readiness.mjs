// Preparation/assessment only. No second assistant, inventory, token store or send transport.
// Evidence is supplied by trusted operator probes, never by a customer's webhook body.
import {handoff,association} from './marketplace-telf017/lead.mjs';
export const MAX_MARKETPLACE_SOURCES=10;
export function assessChannel(channel,e={}){
 const reasons=[];
 if(channel==='marketplace_personal')return {channel,official_Alex_inbox_API_accredited:false,external_send_enabled:false,tester_ready:false,
  blocked_by:['NO_AUTHORIZED_PERSONAL_INBOX_API'],native_Meta_AI_account_verified:e.native_account_verified===true,
  supported_now:'native_or_manual_consent_handoff',native_AI_uses_Alex_Data_Hub:false};
 if(!['messenger_page','instagram_professional','whatsapp_business'].includes(channel))throw Error('UNSUPPORTED_CHANNEL');
 const messenger=channel==='messenger_page';
 if(e.identity_verified!==true)reasons.push('ACCOUNT_IDENTITY_NOT_VERIFIED');
 if(e.messaging_permission!==true)reasons.push('MESSAGING_PERMISSION_NOT_VERIFIED');
 if(e.subscription_verified!==true)reasons.push('ACCOUNT_MESSAGES_SUBSCRIPTION_NOT_VERIFIED');
 if(!messenger&&e.transport_implemented_and_tested!==true)reasons.push('CHANNEL_TRANSPORT_NOT_IMPLEMENTED_AND_TESTED');
 if(channel==='whatsapp_business'&&e.zero_cost_service_only_verified!==true)reasons.push('ZERO_COST_ACCOUNT_AND_SERVICE_WINDOW_NOT_VERIFIED');
 const tester_ready=reasons.length===0&&e.registered_tester===true;
 if(e.advanced_access_verified!==true)reasons.push('EXTERNAL_ACCESS_NOT_VERIFIED');
 if(e.app_live_verified!==true)reasons.push('APP_LIVE_NOT_VERIFIED');
 if(e.current_commercial_source!==true)reasons.push('CURRENT_COMMERCIAL_SOURCE_REQUIRED');
 if(e.real_channel_delivery_verified!==true)reasons.push('REAL_CHANNEL_DELIVERY_REQUIRED');
 // This revision cannot activate anyone, even when a future evidence bundle is complete.
 reasons.push('EXTERNAL_ACTIVATION_REQUIRES_OWNER_APPROVAL_AND_CONTROLLED_DEPLOYMENT');
 return {channel,tester_ready,external_send_enabled:false,blocked_by:reasons};
}
export function referrals(sources=[{key:'rafa',listing_url:association.listing_url,sku:association.sku,owner_authorized:true}]){
 if(!Array.isArray(sources)||sources.length<1||sources.length>MAX_MARKETPLACE_SOURCES)throw Error('SOURCE_LIMIT');
 const keys=new Set(),urls=new Set();
 return sources.map(s=>{
  if(!/^[a-z0-9_-]{1,40}$/.test(s.key||'')||keys.has(s.key)||s.owner_authorized!==true||!/^[A-Z0-9_-]{3,40}$/.test(s.sku||''))throw Error('SOURCE_NOT_AUTHORIZED');
  const u=new URL(s.listing_url);
  if(u.protocol!=='https:'||!['www.facebook.com','facebook.com'].includes(u.hostname)||u.username||u.password||u.port||!/^\/(?:share\/[A-Za-z0-9]+|marketplace\/item\/\d+)\/?$/.test(u.pathname))throw Error('LISTING_URL');
  u.search='';u.hash='';const listing=u.href;if(urls.has(listing))throw Error('DUPLICATE_LISTING');keys.add(s.key);urls.add(listing);
  const text='Vengo de Marketplace. Anuncio: '+listing+' Me interesa el producto de este anuncio. Quiero confirmar precio, disponibilidad y entrega.';
  return {source:s.key,sku:s.sku,listing_url:listing,whatsapp_url:'https://wa.me/593998576759?text='+encodeURIComponent(text),
   messenger_url:'https://m.me/105549695770538',requires_customer_send:true,transfers_private_history:false,
   personal_inbox_access:false,attribution_grants_sender_authorization:false,whatsapp_Alex_connected:false};
 });
}
export async function conversationScope(channel,account,scopedSender,secret){
 if(!['messenger_page','instagram_professional','whatsapp_business'].includes(channel)||![account,scopedSender].every(x=>/^\d{4,40}$/.test(x))||typeof secret!=='string'||secret.length<24)throw Error('INVALID_CHANNEL_SCOPE');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(JSON.stringify([channel,account,scopedSender])));
 return 'alex-'+Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
}
export const existingRafaHandoff=handoff;
