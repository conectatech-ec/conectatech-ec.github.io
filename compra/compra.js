'use strict';
import {checkoutMode,checkoutApiBase,verifiedReceipt} from './cliente-contrato.mjs';
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(n/100);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const errors={CODIGO_POSTAL_FUERA_COBERTURA:'No hay entrega habilitada para ese código postal. Revisa tu dirección.',ENVIO_O_PAGO_NO_DISPONIBLE:'La entrega seleccionada no está disponible. Revisa las opciones.',ENVIO_NO_APROBADO_PARA_PRODUCTO:'Uno de los productos no tiene entrega habilitada en esa zona.',CONDICIONES_CAMBIARON_COTIZAR_NUEVAMENTE:'Cambió la fecha o el costo de entrega. Revisa nuevamente el total.',LIMITE_TEMPORAL_ALCANZADO:'La compra está temporalmente ocupada. Reintenta más tarde; no se ha confirmado un pedido nuevo.',COMPRA_NO_HABILITADA:'La compra todavía no está habilitada.',CANTIDAD_INVALIDA:'Indica una cantidad entera válida.',CANTIDAD_NO_DISPONIBLE:'La cantidad ya no está disponible. Revisa tu compra.',PRODUCTO_NO_COMPRABLE:'Este producto todavía no puede comprarse desde la web.',ENVIO_NO_CONFIGURADO:'Falta una tarifa aprobada para esta entrega.',PAGO_NO_DISPONIBLE:'El método de pago no está disponible para esta entrega.',DATOS_ENTREGA_INVALIDOS:'Revisa nombre, teléfono, correo y dirección.',DESTINO_NO_COTIZADO:'La dirección no corresponde a la zona cotizada.',COTIZACION_VENCIDA:'El resumen venció. Revisa nuevamente el total.',CATALOGO_CAMBIO_COTIZAR_NUEVAMENTE:'Cambió el catálogo. Revisa nuevamente precio y disponibilidad.',REGISTRO_OCUPADO_REINTENTAR:'El registro está ocupado. Reintenta con el mismo pedido.',CLAVE_REINTENTO_CONFLICTO:'El intento anterior contiene otros datos. Revisa nuevamente tu compra.'};
let apiBase='',data,cart=new Map(),quote=null,key=null,busy=false;
const requestKey=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
async function api(path,body,idem){
  let response;
  try{response=await fetch(apiBase+'/api/compra/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json',...(idem?{'Idempotency-Key':idem}:{})}:{},body:body?JSON.stringify(body):undefined,cache:'no-store',credentials:'omit'});}catch{throw Error('No se pudo conectar. No se ha confirmado el pedido. Reintenta con los mismos datos.');}
  let result;try{result=await response.json();}catch{throw Error('La compra todavía no está habilitada.');}
  if(!response.ok)throw Error(errors[result.error]||'No se pudo guardar el pedido. Reintenta; la misma solicitud no se duplicará.');
  return result;
}
function invalidate(){quote=null;key=null;$('revision').hidden=true;$('error').textContent='';$('datos').querySelectorAll('input,textarea,button').forEach(e=>e.disabled=false);}
function product(sku){return data.products.find(p=>p.sku===sku);}
function render(){
  $('carrito').innerHTML=cart.size?'':'<p class="muted">Todavía no has añadido productos.</p>';
  $('resumen-lineas').innerHTML='';let subtotal=0;
  for(const [sku,quantity] of cart){const p=product(sku);subtotal+=p.priceCents*quantity;
    const row=document.createElement('div');row.className='cart-line';
    row.innerHTML=`<img src="${esc(p.image)}" alt=""><div><strong>${esc(p.name)}</strong><span class="small">${esc(sku)} · ${money(p.priceCents)} c/u</span><br><button class="text-button" type="button">Quitar</button></div><div class="qty"><label for="qty-${esc(sku)}">Cantidad</label><input id="qty-${esc(sku)}" type="number" min="1" max="${Math.min(99,p.stock)}" step="1" value="${quantity}" aria-label="Cantidad ${esc(sku)}"></div>`;
    row.querySelector('button').onclick=()=>{if(busy)return;cart.delete(sku);invalidate();render();};
    row.querySelector('input').oninput=e=>{if(busy)return;const v=Number(e.target.value);if(Number.isInteger(v)&&v>=1&&v<=Math.min(99,p.stock)){cart.set(sku,v);invalidate();}};
    row.querySelector('input').onchange=e=>{if(busy)return;const v=Number(e.target.value);if(!Number.isInteger(v)||v<1||v>Math.min(99,p.stock)){e.target.value=cart.get(sku);$('error').textContent='La cantidad supera la disponibilidad del corte o no es válida.';return;}cart.set(sku,v);invalidate();render();};
    $('carrito').append(row);
    $('resumen-lineas').insertAdjacentHTML('beforeend',`<div class="summary-line"><span>${quantity} × ${esc(p.name)}</span><strong>${money(p.priceCents*quantity)}</strong></div>`);
  }
  const d=data.deliveries.find(d=>d.id===$('entrega').value);
  $('subtotal').textContent=money(subtotal);$('envio').textContent=d?money(d.costCents):'Por seleccionar';$('total').textContent=cart.size&&d?money(subtotal+d.costCents):'—';
  $('revisar').disabled=!cart.size||!d||busy;
}
function search(){
  const q=$('buscar').value.toLocaleLowerCase('es').trim();$('resultados').replaceChildren();if(!q)return;
  const rows=data.products.filter(p=>p.stock>0&&p.image&&p.priceCents>0&&(p.name+' '+p.sku).toLocaleLowerCase('es').includes(q)).slice(0,12);
  for(const p of rows){const row=document.createElement('div');row.className='result';row.innerHTML=`<img src="${esc(p.image)}" alt="" loading="lazy"><div><strong>${esc(p.name)}</strong><small>${esc(p.sku)} · ${money(p.priceCents)}</small></div><button class="add" type="button" aria-label="Añadir ${esc(p.sku)}">Añadir</button>`;row.querySelector('button').onclick=()=>{if(busy)return;const n=(cart.get(p.sku)||0)+1;if(n>Math.min(99,p.stock)){$('error').textContent='Has alcanzado la disponibilidad del corte.';return;}cart.set(p.sku,n);invalidate();render();};$('resultados').append(row);}
  if(!rows.length)$('resultados').textContent='No encontramos productos disponibles con esa búsqueda.';
}
function delivery(){const d=data.deliveries.find(d=>d.id===$('entrega').value);$('pago').innerHTML='<option value="">Selecciona un método</option>';for(const p of d?.payments||[]){const o=new Option(p==='cod'?'Efectivo contraentrega':'Transferencia bancaria',p);$('pago').add(o);}if(d?.payments.length===1)$('pago').value=d.payments[0];$('entrega-detalle').textContent=d?`${money(d.costCents)} · ${d.eta}`:'Selecciona una entrega con costo definido.';invalidate();render();}
function customer(){return Object.fromEntries(new FormData($('datos')).entries());}
function showReceipt(r,contact){
  const test=verifiedReceipt(r,quote,data)==='test';
  $('checkout').hidden=true;$('global-status').textContent=test?'Prueba completada: pedido guardado sin cobro.':'Pedido recibido. El pago se realiza contraentrega.';
  $('confirmacion').innerHTML=`<p class="eyebrow">${test?'COMPROBANTE DE PRUEBA':'COMPROBANTE DEL PEDIDO'}</p><h2>${test?'Tu pedido de prueba quedó registrado.':'Hemos recibido tu pedido.'}</h2><p>${test?'No genera una compra, un cobro ni una reserva real en 593.':'Paga el importe indicado al recibirlo. Conserva el número de pedido para cualquier consulta.'}</p><p class="receipt-id">${esc(r.id)}</p>${r.items.map(i=>`<div class="summary-line"><span>${i.quantity} × ${esc(i.name)}</span><strong>${money(i.lineTotalCents)}</strong></div>`).join('')}<dl class="totals"><div><dt>Productos</dt><dd>${money(r.subtotalCents)}</dd></div><div><dt>${test?'Envío de prueba':'Envío'}</dt><dd>${money(r.shippingCents)}</dd></div><div class="grand"><dt>Total USD</dt><dd>${money(r.totalCents)}</dd></div></dl><p><strong>Pago:</strong> efectivo contraentrega · sin cobro realizado.</p><p><strong>Entrega:</strong> ${esc(r.delivery.eta)}</p><p>${esc(contact.name)} · ${esc(contact.city)}<br>${esc(contact.address)}</p><p class="small">Conserva este comprobante. WhatsApp sigue disponible como canal de ayuda.</p><button id="imprimir" class="primary">Imprimir comprobante</button><p><a href="/compra/">${test?'Preparar otra compra de prueba':'Volver a comprar'}</a> · <a href="/cambios-devoluciones-garantias/">Devoluciones y garantías</a></p>`;
  $('confirmacion').hidden=false;$('imprimir').onclick=()=>window.print();$('confirmacion').scrollIntoView({block:'start',behavior:'smooth'});
}
$('buscar').oninput=search;$('entrega').onchange=delivery;$('pago').onchange=()=>{invalidate();render();};
$('datos').addEventListener('input',()=>{if(quote)invalidate();});
$('datos-prueba').onclick=()=>{if(busy)return;invalidate();for(const [id,value] of Object.entries({nombre:'Cliente de prueba',telefono:'0990000000',correo:'prueba@example.invalid',ciudad:'Quito',direccion:'Dirección ficticia para prueba, sin despacho'}))$(id).value=value;};
$('datos').onsubmit=async e=>{e.preventDefault();if(busy)return;$('error').textContent='';busy=true;$('checkout').inert=true;$('revisar').disabled=true;
  try{quote=await api('cotizacion',{items:[...cart].map(([sku,quantity])=>({sku,quantity})),deliveryId:$('entrega').value,payment:$('pago').value,...(data.mode==='datahub'?{postalCode:$('codigo-postal').value.trim()}:{})});key=requestKey();$('subtotal').textContent=money(quote.subtotalCents);$('envio').textContent=money(quote.shippingCents);$('total').textContent=money(quote.totalCents);$('revision-detalle').textContent=`Total verificado: ${money(quote.totalCents)}. Efectivo contraentrega. ${quote.delivery.eta}`;$('revision').hidden=false;$('total-nota').textContent=data.mode==='test'?'Este es el total que quedará registrado en la prueba. Revisa los datos y confirma.':'Este es el importe que pagarás al recibir el pedido. Revisa dirección y fecha de entrega antes de confirmar.';$('datos').querySelectorAll('input,textarea,button').forEach(el=>el.disabled=true);$('revision').scrollIntoView({behavior:'smooth',block:'center'});}catch(error){quote=null;key=null;$('error').textContent=error.message;}finally{busy=false;$('checkout').inert=false;$('revisar').disabled=!!quote;}
};
$('editar').onclick=()=>{invalidate();render();};
$('confirmar').onclick=async()=>{if(!quote||busy)return;busy=true;$('checkout').inert=true;$('confirmar').disabled=true;$('editar').disabled=true;$('error').textContent='';
  // Read disabled controls explicitly; FormData intentionally omits them.
  const c={name:$('nombre').value,phone:$('telefono').value,email:$('correo').value,city:$('ciudad').value,address:$('direccion').value,...(data.mode==='datahub'?{postalCode:$('codigo-postal').value.trim()}:{})};
  try{const result=await api('pedidos',{quoteId:quote.quoteId,customer:c,consent:$('consentimiento').checked},key);showReceipt(result,c);}catch(error){$('error').textContent=error.message;}finally{busy=false;$('checkout').inert=false;$('confirmar').disabled=false;$('editar').disabled=false;}
};
(async()=>{try{apiBase=checkoutApiBase(document.querySelector('meta[name=conectatech-compra-api]')?.content||'',location.origin);data=await api('catalogo');const mode=checkoutMode(data);const test=mode==='test';$('checkout').hidden=false;$('aviso-entorno').hidden=!test;$('datos-prueba').hidden=!test;$('campo-postal').hidden=test;$('codigo-postal').required=!test;$('confirmar').textContent=test?'Registrar pedido de prueba':'Confirmar pedido contraentrega';$('pago-nota').innerHTML=test?'Esta demostración no solicita pagos. <a href="/compra/envios-pagos.html">Condiciones de envío y pago</a>.':'Paga en efectivo al recibir tu pedido en Quito. <a href="/compra/envios-pagos.html">Condiciones de envío y pago</a>.';$('global-status').textContent=test?'Entorno de prueba: catálogo real, entrega ficticia, sin cobros.':'Contraentrega en Quito · sin registro de cuenta · total antes de confirmar.';$('corte').textContent=`Precios y disponibilidad del corte ${data.cutDate} de 593. No representa stock en tiempo real.`;$('entrega').add(new Option('Selecciona una entrega',''));for(const d of data.deliveries)$('entrega').add(new Option(d.label,d.id));const sku=new URLSearchParams(location.search).get('sku');const p=product(sku);if(p?.stock>0&&p.image){cart.set(p.sku,1);$('buscar').value=p.sku;search();}delivery();}catch(error){$('global-status').textContent=error.message;}})();
