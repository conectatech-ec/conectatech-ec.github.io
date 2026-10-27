// Acquisition policy only. Commercial facts and conversation remain in Alex and the shared Data Hub.
import library from './marketplace-library.json' with {type:'json'};
const channels=['marketplace_personal','messenger_page','whatsapp_business'];
const products={TELF017:'Redmi 15C 128 GB / 4 GB RAM',TELF018:'Redmi 15C 256 GB / 4 GB RAM',TELF019:'Redmi 15C 256 GB / 8 GB RAM',TELF001:'ZTE Blade A56 Pro 128 GB',REL046:'Infinix XWATCH H4'};
export function marketplaceContext(channel,reply){
 if(!channels.includes(channel))throw Error('UNSUPPORTED_ACQUISITION_CHANNEL');
 const focus=reply.focus||[],name=focus.length===1?products[focus[0]]||'un producto de CONECTATECH':focus.some(s=>/^TELF01[789]$/.test(s))?'Redmi 15C (versión por confirmar)':'un producto de CONECTATECH';
 const message='Vengo de Marketplace. Me interesa '+name+'. Quiero confirmar precio, disponibilidad y opciones de entrega.';
 const whatsapp='https://wa.me/593998576759?text='+encodeURIComponent(message);
 const messenger='https://m.me/105549695770538';
 const banners=focus.map(sku=>{
  const p=library.products[sku],reasons=[];
  if(!p?.visual_approved||!p.publication_verified)reasons.push('NO_VERIFIED_APPROVED_BANNER');
  if(!reply.source_fresh)reasons.push('COMMERCIAL_SOURCE_EXPIRED');
  if(p&&p.source_sha256!==reply.source_sha256)reasons.push('BANNER_SOURCE_VERSION_MISMATCH');
  if(library.no_send_to_buyers||!p?.delivery_allowed||!library.messaging_enabled)reasons.push('LIBRARY_DELIVERY_NOT_RELEASED');
  if(!library.live_registry_connection_verified)reasons.push('LIVE_LIBRARY_READBACK_REQUIRED');
  return {sku,visual_approved:p?.visual_approved===true,delivery_enabled:false,block_reasons:reasons};
 });
 return {acquisition_channel:channel,preview_only:true,external_customers_enabled:false,outbound_enabled:false,
  transport:channel==='marketplace_personal'?'native_or_manual_handoff_only':channel==='messenger_page'?'existing_official_messenger_authorized_testers_only':'click_to_chat_only_no_API_send',
  automatic_marketplace_API:false,whatsapp_AI_connected:false,banners,
  handoff:{whatsapp,messenger,prefilled_message:message,automatic_chat_history_transfer:false,customer_must_send_message:true},
  native_reply_draft:'¡Gracias por consultar! Para confirmar precio y disponibilidad de '+name+', puedes escribir a CONECTATECH aquí: '+whatsapp,
  native_automation:{provider:'Meta native Marketplace auto replies',availability_in_this_account_verified:false,enabled_by_this_pilot:false,warning:'Preview only: verify current listing facts and account availability before enabling; native Meta AI is separate from Alex.'}};
}
export function marketplacePage(){
 const nonce=crypto.randomUUID();
 return new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CONECTATECH · Alex y Marketplace</title><style>body{font:17px system-ui;max-width:850px;margin:2rem auto;padding:1rem;color:#173e50}input,select,button,textarea{font:inherit;margin:.6rem 0;padding:.7rem;box-sizing:border-box;max-width:100%}input,textarea{width:100%}img{max-width:280px;max-height:280px;object-fit:contain}pre{white-space:pre-wrap;font:14px system-ui;background:#f3f6f7;padding:1rem}#reply{white-space:pre-line}a{display:inline-block;margin:.5rem}</style><h1>Alex · Oportunidades de Marketplace</h1><p>Piloto privado: Redmi 15C 128 GB, ZTE A56 Pro e Infinix XWATCH H4. No lee chats personales ni envía mensajes a clientes. Las conversaciones oficiales de probadores siguen en Messenger.</p><label>Clave privada del piloto<input id="key" type="password" autocomplete="off"></label><label>Origen <select id="channel"><option value="marketplace_personal">Marketplace personal</option><option value="messenger_page">Messenger de Página</option><option value="whatsapp_business">WhatsApp Business</option></select></label><div id="examples"></div><label>Consulta<textarea id="message" rows="3">Busco un Redmi 15C de 128 GB</textarea></label><button id="send">Consultar a Alex</button><button id="reset">Nueva conversación</button><p id="reply" role="status"></p><div id="options"></div><img id="photo" hidden alt="Fotografía aprobada del modelo"><div id="handoff"></div><details><summary>Verificación del piloto</summary><pre id="evidence"></pre></details><script nonce="${nonce}">
 const el=id=>document.getElementById(id);let session=crypto.randomUUID();
 for(const text of ['Busco un Redmi 15C de 128 GB','Quiero el ZTE A56 Pro','Busco el Infinix XWATCH H4']){const b=document.createElement('button');b.textContent=text;b.onclick=()=>{el('message').value=text;};el('examples').append(b);}
 async function send(payload){const button=el('send');button.disabled=true;try{const r=await fetch('/marketplace/preview',{method:'POST',headers:{Authorization:'Bearer '+el('key').value,'Content-Type':'application/json'},body:JSON.stringify({channel:el('channel').value,session_id:session,message:el('message').value,...payload})});const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo consultar.');el('reply').textContent=d.text;el('photo').hidden=!d.image;if(d.image)el('photo').src=d.image;else el('photo').removeAttribute('src');el('evidence').textContent=JSON.stringify({source:d.source_kind,cut:d.inventory_cut_date,current:d.source_fresh,version:d.source_sha256,banners:d.acquisition.banners,transport:d.acquisition.transport,outbound:false},null,2);el('options').replaceChildren();for(const q of d.quick_replies||[]){const b=document.createElement('button');b.textContent=q.title;b.onclick=()=>send({message:q.title,quick_reply_payload:q.payload});el('options').append(b);}el('handoff').replaceChildren();for(const [label,url] of [['Abrir WhatsApp Business',d.acquisition.handoff.whatsapp],['Abrir Messenger de Página',d.acquisition.handoff.messenger]]){const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';el('handoff').append(a);}}catch(e){el('reply').textContent=e.message;}finally{button.disabled=false;}}
 el('send').onclick=()=>send({});el('reset').onclick=()=>{session=crypto.randomUUID();el('reply').textContent='Nueva conversación preparada.';el('options').replaceChildren();el('handoff').replaceChildren();el('photo').hidden=true;el('photo').removeAttribute('src');};setTimeout(()=>el('key').value='',600000);
 </script></html>`,{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-"+nonce+"'; connect-src 'self'; img-src https://conectatech-ec.github.io; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"}});
}
