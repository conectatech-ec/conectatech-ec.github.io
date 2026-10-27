// Official Meta webhook receiver. No outbound HTTP calls or Marketplace bots.
export function verifyMetaWebhook(req,env) {
 const q=new URL(req.url).searchParams;
 if(!env.META_VERIFY_TOKEN||q.get('hub.mode')!=='subscribe'||q.get('hub.verify_token')!==env.META_VERIFY_TOKEN) return new Response('Forbidden',{status:403,headers:{'Cache-Control':'no-store'}});
 const challenge=q.get('hub.challenge');
 return challenge&&challenge.length<=200?new Response(challenge,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}}):new Response('Bad challenge',{status:400});
}
export async function verifyMetaSignature(raw,signature,secret) {
 if(!secret||!/^sha256=[a-f0-9]{64}$/i.test(signature||'')) return false;
 const bytes=Uint8Array.from(signature.slice(7).match(/../g),x=>parseInt(x,16));
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 return crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(raw));
}
export function normalizeAlexAction(payload){
 const m=/^ALEX:(photo|cash|card|specs|choose|buy|payment|anothercard|human|retiro|quito|nacional|microphone|battery)(?::(MICR27|POWE003|ADAP005|TELF011|TELF012|TELF017|TELF018|TELF019|TELF001|REL046))?$/.exec(payload||'');
 if(!m)return null;
 const actions={photo:'Quiero ver una fotografía',cash:'Quiero saber el precio de contado',card:'¿Cuál es el precio con tarjeta?',specs:'Quiero conocer las características',choose:'Elijo este producto',buy:'Quiero comprar este producto',payment:'Quiero conocer las formas de pago',human:'Quiero hablar con una persona',retiro:'Quiero retirar en tienda',quito:'Quiero entrega en Quito',nacional:'Quiero envío nacional',microphone:'Busco un micrófono para grabar mi voz',battery:'Busco una batería portátil'};
 return (m[1]==='anothercard'?'Quiero usar otra tarjeta':actions[m[1]])+(m[2]?' del producto '+m[2]:'');
}
const quickText=message=>normalizeAlexAction(message.quick_reply?.payload)||message.text;
export function normalizeEvents(payload,env) {
 const events=[];
 for(const entry of payload.entry||[]) {
  if(payload.object==='page' && env.META_PAGE_ID && String(entry.id)===env.META_PAGE_ID) {
   for(const e of entry.messaging||[]) if(e.message?.mid&&!e.message.is_echo&&typeof e.message.text==='string') events.push({id:'messenger:'+e.message.mid,canal:'messenger',sender:e.sender?.id,recipient:e.recipient?.id,text:quickText(e.message).slice(0,64000),timestamp:e.timestamp});
  }
  if(payload.object==='whatsapp_business_account' && env.META_WABA_ID && String(entry.id)===env.META_WABA_ID) {
   for(const change of entry.changes||[]) {
    if(change.value?.metadata?.phone_number_id!==env.META_PHONE_NUMBER_ID) continue;
    for(const e of change.value?.messages||[]) if(e.type==='text'&&e.id) events.push({id:'whatsapp:'+e.id,canal:'whatsapp',sender:e.from,text:String(e.text?.body||'').slice(0,2000),timestamp:Number(e.timestamp)*1000});
   }
  }
 }
 if(events.length>100) throw Error('event_limit');
 return events;
}
export function prepareOfficialReply(event,response,now=Date.now()) {
 if(!Number.isFinite(event.timestamp)||event.timestamp>now+300000||now-event.timestamp>86400000) throw Error('outside_service_window');
 if(!response.text||response.error) throw Error('no_verified_response');
 if(event.canal==='messenger') return {canal:'messenger',send_enabled:false,body:{recipient:{id:event.sender},messaging_type:'RESPONSE',message:{text:response.text.slice(0,1900)}}};
 if(event.canal==='whatsapp') return {canal:'whatsapp',send_enabled:false,blocked_reason:'Verificar gratuidad efectiva en la cuenta antes de habilitar cualquier envío',body:{messaging_product:'whatsapp',to:event.sender,type:'text',text:{body:response.text.slice(0,4000)}}};
 throw Error('unsupported_channel');
}
