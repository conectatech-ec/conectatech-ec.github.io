// Client-side acknowledgement checks. The Data Hub remains the authority.
export function checkoutMode(catalog) {
  if(catalog?.mode==='test') return 'test';
  if(catalog?.mode==='datahub' && catalog.enabled===true) return 'datahub';
  throw Error('La compra todavía no está habilitada.');
}

export function checkoutApiBase(value, pageOrigin) {
  if(!value) return '';
  const url=new URL(value);
  if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash || url.pathname!=='/') throw Error('El servicio de compra todavía no está configurado.');
  return url.origin===pageOrigin?'':url.origin;
}

export function verifiedReceipt(r, quote, catalog) {
  const mode=checkoutMode(catalog);
  if(!r || r.mode!==mode || typeof r.id!=='string' || !r.id || !quote) throw Error('No se recibió un comprobante válido. Reintenta con el mismo pedido.');
  if(mode==='test' && r.liveOrder!==false) throw Error('La prueba no acredita un registro de prueba.');
  if(mode==='datahub' && (r.liveOrder!==true || r.paid!==false || r.paymentStatus!=='pending_cod' || r.status!=='pedido_recibido_contraentrega' || r.stockReservedIn593!==false || r.quoteId!==quote.quoteId)) throw Error('No se recibió la confirmación del pedido contraentrega.');
  if(r.subtotalCents!==quote.subtotalCents || r.shippingCents!==quote.shippingCents || r.totalCents!==quote.totalCents || !Array.isArray(r.items) || r.items.length!==quote.items.length ||
    r.items.some((line,i)=>['sku','quantity','unitPriceCents','lineTotalCents'].some(k=>line[k]!==quote.items[i][k]))) throw Error('El comprobante no coincide con el total aceptado. Conserva la referencia y solicita revisión.');
  return mode;
}
