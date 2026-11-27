// Copied by the verified integration patch beside the existing Worker modules.
// These imports deliberately resolve to the existing Data Hub, not a second source.
import {central} from './central-source.mjs';
import {readSharedHub} from './shared-hub.mjs';
import {seal, unseal} from './messenger-control.mjs';
import {CHECKOUT_CONFIG as config} from './checkout-config.mjs';
import {readCheckoutSource} from './checkout-shared-source.mjs';
import {checkoutPublic, checkoutAdmin, checkoutDigest} from './checkout-edge.mjs';
import {checkoutInit, checkoutFetch} from './checkout-store.mjs';
const sourceProvider = () => readCheckoutSource({readSharedHub, central});
export const handleCheckoutPublic = (req, env) => checkoutPublic(req, env, config);
const privatePath = '/api/compra/admin/prueba';
const privateStorePath = '/web-checkout/private-test/';
const testKey = 'CT_PRIVATE_TEST_20261119_V1';
const testUntil = Date.parse('2026-11-27T02:26:39Z');
const json = (value, status = 200) => Response.json(value, {status, headers: {'Cache-Control': 'no-store'}});
const contact = Object.freeze({name: 'Cliente sintético prueba privada', phone: '0000000000', email: '',
  city: 'Quito', address: 'Dirección sintética sin entrega', postalCode: '000000'});
// This fixture is reachable only through the owner's authenticated route.
// The exported public configuration and delivery list remain disabled/empty.
const privateConfig = Object.freeze({...config, enabled: true, privateTest: true, deliveries: [{
  id: 'private-test-only', label: 'Entrega sintética sin despacho', kind: 'quito_cod', city: 'Quito',
  approved: true, approvalReference: 'DG_PRUEBA_PRIVADA_NO_COMERCIAL', costCents: 500,
  postalCodes: ['000000'], allowedSkus: ['ADAP004'], payments: ['cod'],
  minBusinessDays: 1, maxBusinessDays: 1, calendarApproved: true,
  calendarApprovalReference: 'CALENDARIO_SINTETICO_NO_COMERCIAL', deliveryWeekdays: [0,1,2,3,4,5,6], holidays: []
}]});

export async function handleCheckoutAdmin(req, env) {
  if (new URL(req.url).pathname !== privatePath) return checkoutAdmin(req, env, config);
  if (new URL(req.url).protocol !== 'https:' || !env.PILOT_TOKEN ||
      req.headers.get('Authorization') !== 'Bearer ' + env.PILOT_TOKEN) return json({error: 'Unauthorized'}, 401);
  if (!['GET', 'POST'].includes(req.method)) return json({error: 'METODO_NO_DISPONIBLE'}, 405);
  if (config.enabled || config.deliveries.length || Date.now() >= testUntil ||
      env.FREE_TIER_VERIFIED !== 'true' || !env.MESSENGER_TEST_INBOX) return json({error: 'PRUEBA_PRIVADA_CERRADA'}, 503);
  const action = req.method === 'POST' ? 'run' : 'verify';
  const stub = env.MESSENGER_TEST_INBOX.get(env.MESSENGER_TEST_INBOX.idFromName(config.objectName));
  return stub.fetch('https://inbox' + privateStorePath + action, {method: 'POST'});
}
export const initCheckoutStore = box => checkoutInit(box, config);
export function handleCheckoutStore(path, req, box) {
  if (path.startsWith(privateStorePath)) return runPrivateCheckout(path, req, box, {sourceProvider, seal, unseal});
  return checkoutFetch(path, req, box, {config, sourceProvider, seal, unseal});
}

// Reuses checkoutFetch, the existing SQLite tables, encryption and cancellation.
// No sender, payment API or 593 write is invoked by this route.
export async function runPrivateCheckout(path, req, box, deps) {
  const clock = deps.clock || Date.now;
  const action = path.slice(privateStorePath.length);
  if (req.method !== 'POST' || !['run', 'verify'].includes(action)) return json({error: 'RUTA_NO_DISPONIBLE'}, 404);
  if (clock() >= testUntil || config.enabled || config.deliveries.length || box.name !== config.objectName ||
      box.env.FREE_TIER_VERIFIED !== 'true' || !box.env.PILOT_TOKEN) return json({error: 'PRUEBA_PRIVADA_CERRADA'}, 503);
  const currentSource = async () => {
    const source = await deps.sourceProvider();
    const generated = Date.parse(source.sourceGeneratedAt), now = clock();
    if (!Number.isFinite(generated) || generated > now || now - generated > 86400000) throw Error('FUENTE_PRUEBA_NO_VIGENTE');
    return source;
  };
  const lookup = () => box.sql.exec('SELECT id,quote_id,receipt,allocation FROM checkout_orders WHERE request_key=?', testKey).toArray()[0];
  const call = async (suffix, body = null, key = null) => {
    const client = await checkoutDigest(testKey, box.env.PILOT_TOKEN);
    const response = await checkoutFetch('/web-checkout/' + suffix,
      new Request('https://inbox/web-checkout/' + suffix, {method: 'POST',
        headers: {'Content-Type': 'application/json'}, body: JSON.stringify({body, key, client})}), box,
      {...deps, sourceProvider: currentSource, config: privateConfig, clock});
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'PRUEBA_PRIVADA_FALLIDA');
    return {status: response.status, data};
  };
  const checkStored = async () => {
    const stored = lookup();
    if (!stored) throw Error('PEDIDO_PRUEBA_NO_ENCONTRADO');
    const receipt = JSON.parse(stored.receipt);
    if (receipt.syntheticTest !== true || receipt.liveOrder !== false) throw Error('IDENTIDAD_PRUEBA_INVALIDA');
    const admin = await call('admin/pedidos');
    const order = admin.data.orders.find(item => item.id === stored.id);
    if (!order || Object.entries(contact).some(([key, value]) => order.customer?.[key] !== value)) throw Error('CONSULTA_PRUEBA_FALLIDA');
    const replay = await call('pedidos', {quoteId: stored.quote_id, customer: contact, consent: true}, testKey);
    const count = box.sql.exec('SELECT count(*) AS n FROM checkout_orders WHERE request_key=?', testKey).toArray()[0].n;
    if (JSON.stringify(replay.data) !== stored.receipt || count !== 1) throw Error('DEDUPLICACION_PRUEBA_FALLIDA');
    return {id: stored.id, admin: admin.status, duplicatePrevented: true, orderCount: count,
      allocation: stored.allocation, sourceHash: receipt.sourceHash, totalCents: receipt.totalCents};
  };
  try {
    // Read-only preflight preserves the source's identity, price, stock and expiry checks.
    // An expired/mismatched source fails before any test table or order is created.
    await currentSource();
    checkoutInit(box, privateConfig);
    if (action === 'verify') {
      const result = await checkStored();
      if (result.allocation !== 'cancelled') throw Error('CIERRE_PRUEBA_PENDIENTE');
      return json({syntheticTest: true, verifiedInSeparateRequest: true, ...result});
    }
    const claimed = box.state.storage.transactionSync(() => {
      const scope = 'private-test:' + testKey;
      if (box.sql.exec('SELECT scope FROM checkout_rate WHERE scope=?', scope).toArray().length) return false;
      box.sql.exec('INSERT INTO checkout_rate VALUES (?,1,?)', scope, testUntil);
      return true;
    });
    if (!claimed) return json({error: 'PRUEBA_PRIVADA_YA_CONSUMIDA'}, 409);
    let result;
    try {
      const quote = await call('cotizacion', {items: [{sku: 'ADAP004', quantity: 1}],
        deliveryId: 'private-test-only', payment: 'cod', postalCode: '000000'});
      const order = await call('pedidos', {quoteId: quote.data.quoteId, customer: contact, consent: true}, testKey);
      result = {quote: quote.status, confirm: order.status, ...await checkStored()};
    } finally {
      const stored = lookup();
      if (stored && stored.allocation === 'pending_web') {
        const receipt = JSON.parse(stored.receipt);
        if (receipt.syntheticTest !== true || receipt.liveOrder !== false) throw Error('IDENTIDAD_PRUEBA_INVALIDA');
        await call('admin/actualizar', {id: stored.id, action: 'cancelar', reference: testKey});
      }
    }
    return json({syntheticTest: true, ...result, allocation: lookup().allocation});
  } catch (error) {
    const code = /^[A-Z0-9_]{1,80}$/.test(error.message || '') ? error.message : 'PRUEBA_PRIVADA_FALLIDA';
    return json({error: code, syntheticTest: true}, 503);
  }
}
