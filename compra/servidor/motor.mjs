import {createHash, randomUUID} from 'node:crypto';
export {loadCatalog, createCatalogProvider} from './catalogo.mjs';
export {createFileLedger} from './registro-prueba.mjs';

export class CheckoutError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
const fail = (code, status) => { throw new CheckoutError(code, status); };
const copy = value => structuredClone(value);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clean = (value, min, max) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const only = (obj, keys) => obj && Object.getPrototypeOf(obj) === Object.prototype && Object.keys(obj).every(k => keys.includes(k));

export const TEST_DELIVERIES = Object.freeze([Object.freeze({
  id: 'quito-prueba', label: 'Quito · entrega de prueba (zona ficticia)', costCents: 290,
  city: 'Quito', eta: 'PRUEBA: 1–4 días hábiles. No es una promesa de entrega.',
  payments: Object.freeze(['cod']), testOnly: true
})]);

/** Default is closed. This implementation can record test orders only.
 * Production must implement the existing Data Hub's atomic reservation/order contract;
 * an offline snapshot or /interesados must never be treated as that contract.
 */
export function createCheckout({catalogProvider, ledger, deliveries = [], mode = 'disabled', clock = Date.now, quoteTtlMs = 900_000} = {}) {
  if (typeof catalogProvider !== 'function') throw Error('CATALOG_PROVIDER_REQUERIDO');
  if (!Number.isSafeInteger(quoteTtlMs) || quoteTtlMs < 1000 || quoteTtlMs > 900_000) throw Error('TTL_INVALIDO');
  const configured = copy(deliveries);
  const quotes = new Map();
  function enabled() {
    if (mode !== 'test' || ledger?.mode !== 'test' || typeof ledger.transaction !== 'function') fail('COMPRA_NO_HABILITADA', 503);
  }
  function route(id, payment, items) {
    const d = configured.find(v => v.id === id);
    if (!d || d.testOnly !== true || !Number.isSafeInteger(d.costCents) || d.costCents < 0 || !clean(d.eta, 3, 300) || !clean(d.city, 2, 80)) fail('ENVIO_NO_CONFIGURADO', 409);
    if (!['cod', 'transfer'].includes(payment) || !d.payments?.includes(payment)) fail('PAGO_NO_DISPONIBLE', 409);
    // No real account or invented bank instruction can be exposed by this test module.
    if (payment === 'transfer') fail('TRANSFERENCIA_PENDIENTE_CONFIGURACION', 409);
    if (d.allowedSkus && items.some(i => !d.allowedSkus.includes(i.sku))) fail('ENVIO_NO_APROBADO_PARA_PRODUCTO', 409);
    return copy(d);
  }
  async function current() {
    const c = await catalogProvider();
    if (!c || !Array.isArray(c.products) || !c.version || !c.sourceHash) fail('CATALOGO_NO_DISPONIBLE', 503);
    return c;
  }
  function calculate(items, data, orders = []) {
    if (!Array.isArray(items) || !items.length || items.length > 20) fail('PRODUCTOS_INVALIDOS');
    const seen = new Set();
    return items.map(i => {
      if (!only(i, ['sku', 'quantity']) || typeof i.sku !== 'string' || seen.has(i.sku) || !Number.isSafeInteger(i.quantity) || i.quantity < 1 || i.quantity > 99) fail('CANTIDAD_INVALIDA');
      seen.add(i.sku);
      const p = data.products.find(p => p.sku === i.sku);
      if (!p) fail('PRODUCTO_DESCONOCIDO');
      if (!Number.isSafeInteger(p.priceCents) || p.priceCents <= 0 || !Number.isSafeInteger(p.stock) || p.stock < 0 || !p.url || !p.image) fail('PRODUCTO_NO_COMPRABLE', 409);
      const pending = orders.reduce((sum, order) => sum + order.receipt.items.filter(line => line.sku === p.sku).reduce((n, line) => n + line.quantity, 0), 0);
      if (i.quantity > p.stock - pending) fail('CANTIDAD_NO_DISPONIBLE', 409);
      return {sku: p.sku, name: p.name, image: p.image, url: p.url, quantity: i.quantity, unitPriceCents: p.priceCents, lineTotalCents: p.priceCents * i.quantity};
    });
  }
  function customer(input) {
    if (!only(input, ['name', 'phone', 'email', 'address', 'city']) ||
      !clean(input.name, 2, 100) || !clean(input.phone, 7, 25) || !/^[+\d ()-]+$/.test(input.phone) ||
      typeof input.email !== 'string' || (input.email !== '' && (!clean(input.email, 3, 150) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))) ||
      !clean(input.address, 5, 250) || !clean(input.city, 2, 80)) fail('DATOS_ENTREGA_INVALIDOS');
    return Object.fromEntries(['name', 'phone', 'email', 'address', 'city'].map(k => [k, input[k].trim()]));
  }
  return {
    async catalog() {
      const c = await current();
      return {mode, cutDate: c.cutDate, source: c.source, products: c.products.map(p => ({...p})),
        deliveries: mode === 'test' ? copy(configured) : [], notice: 'Preparación: pedidos de prueba, sin cobros ni reservas en 593.'};
    },
    async quote(input) {
      enabled();
      if (!only(input, ['items', 'deliveryId', 'payment'])) fail('COTIZACION_INVALIDA');
      const data = await current();
      const items = calculate(input.items, data);
      const delivery = route(input.deliveryId, input.payment, items);
      const subtotalCents = items.reduce((n, p) => n + p.lineTotalCents, 0);
      const totalCents = subtotalCents + delivery.costCents;
      if (!Number.isSafeInteger(totalCents) || totalCents <= 0) fail('IMPORTE_INVALIDO');
      const now = clock();
      for (const [key, q] of quotes) if (Date.parse(q.expiresAt) <= now) quotes.delete(key);
      if (quotes.size >= 1000) fail('COTIZACIONES_OCUPADAS', 429);
      const quote = {quoteId: randomUUID(), mode: 'test', items, subtotalCents,
        shippingCents: delivery.costCents, totalCents, currency: 'USD', delivery, payment: input.payment,
        expiresAt: new Date(now + quoteTtlMs).toISOString(), sourceHash: data.sourceHash, version: data.version, cutDate: data.cutDate};
      quotes.set(quote.quoteId, copy(quote));
      return copy(quote);
    },
    async confirm(input, key) {
      enabled();
      if (!only(input, ['quoteId', 'customer', 'consent']) || input.consent !== true || typeof input.quoteId !== 'string') fail('CONFIRMACION_INVALIDA');
      if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(key)) fail('CLAVE_REINTENTO_INVALIDA');
      const contact = customer(input.customer);
      const digest = hash({quoteId: input.quoteId, customer: contact, consent: true});
      return ledger.transaction(async orders => {
        const previous = orders.find(order => order.key === key);
        if (previous) {
          if (previous.digest !== digest) fail('CLAVE_REINTENTO_CONFLICTO', 409);
          return copy(previous.receipt);
        }
        if (orders.some(order => order.receipt.quoteId === input.quoteId)) fail('COTIZACION_YA_CONFIRMADA', 409);
        const quote = quotes.get(input.quoteId);
        if (!quote || Date.parse(quote.expiresAt) <= clock()) fail('COTIZACION_VENCIDA', 409);
        if (contact.city.toLocaleLowerCase('es') !== quote.delivery.city.toLocaleLowerCase('es')) fail('DESTINO_NO_COTIZADO', 409);
        const data = await current();
        if (data.sourceHash !== quote.sourceHash || data.version !== quote.version) fail('CATALOGO_CAMBIO_COTIZAR_NUEVAMENTE', 409);
        const items = calculate(quote.items.map(i => ({sku: i.sku, quantity: i.quantity})), data, orders);
        const delivery = route(quote.delivery.id, quote.payment, items);
        const subtotal = items.reduce((n, i) => n + i.lineTotalCents, 0);
        if (subtotal !== quote.subtotalCents || delivery.costCents !== quote.shippingCents) fail('PRECIO_CAMBIO_COTIZAR_NUEVAMENTE', 409);
        const receipt = {...copy(quote), id: 'PRUEBA-' + randomUUID(), createdAt: new Date(clock()).toISOString(),
          status: 'pedido_de_prueba_contraentrega', paymentStatus: 'pending_cod',
          customer: contact, estimatedDelivery: delivery.eta, liveOrder: false, paid: false,
          stockReservedIn593: false, notice: 'Pedido guardado solo en el entorno de prueba. No genera una compra ni una reserva real.'};
        orders.push({key, digest, receipt});
        return copy(receipt);
      });
    }
  };
}
