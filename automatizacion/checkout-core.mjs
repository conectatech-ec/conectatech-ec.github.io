// Shared validation used by the local demonstration and the existing Data Hub adapter.
export class CheckoutError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
export const fail = (code, status) => { throw new CheckoutError(code, status); };
export const clean = (value, min, max) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max && !/[\u0000-\u001f\u007f]/.test(value);
export const only = (obj, keys) => obj && Object.getPrototypeOf(obj) === Object.prototype && Object.keys(obj).every(k => keys.includes(k));

export function calculate(items, data, orders = []) {
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
export function customer(input) {
    if (!only(input, ['name', 'phone', 'email', 'address', 'city']) ||
      !clean(input.name, 2, 100) || !clean(input.phone, 7, 25) || !/^[+\d ()-]+$/.test(input.phone) ||
      typeof input.email !== 'string' || (input.email !== '' && (!clean(input.email, 3, 150) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))) ||
      !clean(input.address, 5, 250) || !clean(input.city, 2, 80)) fail('DATOS_ENTREGA_INVALIDOS');
    return Object.fromEntries(['name', 'phone', 'email', 'address', 'city'].map(k => [k, input[k].trim()]));
  }
