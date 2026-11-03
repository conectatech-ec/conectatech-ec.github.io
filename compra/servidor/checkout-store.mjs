import {CheckoutError, fail, only, clean, calculate, customer} from './checkout-core.mjs';
import {checkoutDigest} from './checkout-edge.mjs';
const json = (data, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer'}});
const row = (box, sql, ...args) => box.sql.exec(sql, ...args).toArray()[0];
const clone = value => structuredClone(value);
const pending = box => box.sql.exec("SELECT receipt FROM checkout_orders WHERE allocation='pending_web'").toArray().map(r => ({receipt: JSON.parse(r.receipt)}));

export function checkoutInit(box, config) {
  // Reuses the existing singleton and its SQLite binding. Nothing is allocated
  // in other objects, and the prepared/default-disabled integration writes nothing.
  if (!config.enabled || box.name !== 'messenger-development') return;
  box.sql.exec('CREATE TABLE IF NOT EXISTS checkout_quotes (id TEXT PRIMARY KEY, payload TEXT NOT NULL, expires INTEGER NOT NULL)');
  box.sql.exec('CREATE TABLE IF NOT EXISTS checkout_orders (id TEXT PRIMARY KEY, request_key TEXT UNIQUE NOT NULL, digest TEXT NOT NULL, quote_id TEXT UNIQUE NOT NULL, receipt TEXT NOT NULL, customer_sealed TEXT, created INTEGER NOT NULL, allocation TEXT NOT NULL, reconciled_sha TEXT, reconciliation_ref TEXT, closed INTEGER)');
  box.sql.exec('CREATE INDEX IF NOT EXISTS checkout_orders_allocation ON checkout_orders(allocation)');
  box.sql.exec('CREATE TABLE IF NOT EXISTS checkout_rate (scope TEXT PRIMARY KEY, n INTEGER NOT NULL, expires INTEGER NOT NULL)');
  box.sql.exec('CREATE TABLE IF NOT EXISTS checkout_sources (version TEXT PRIMARY KEY, source_sha TEXT NOT NULL, cut_date TEXT NOT NULL, generated_ms INTEGER NOT NULL, timestamp_basis TEXT NOT NULL, latest INTEGER NOT NULL)');
}
function settings(box, config) {
  if (!config.enabled || box.name !== 'messenger-development' || config.objectName !== box.name || box.env.FREE_TIER_VERIFIED !== 'true' || !box.env.PILOT_TOKEN) fail('COMPRA_NO_HABILITADA', 503);
  const bounds = [['maxRequestsPerDay', 1, 1000], ['maxRequestsPerClientHour', 1, 100], ['maxOrdersPerDay', 1, 100], ['maxOpenOrders', 1, 1000], ['quoteTtlMs', 1000, 900000], ['customerRetentionDays', 1, 90]];
  if (bounds.some(([k, min, max]) => !Number.isInteger(config[k]) || config[k] < min || config[k] > max) || config.nationalShippingEnabled !== false) fail('CONFIGURACION_NO_APROBADA', 503);
  if (!config.deliveries.length || config.deliveries.some(d => !validDelivery(d))) fail('ENVIO_NO_CONFIGURADO', 503);
}
function validDelivery(d) {
  return d?.approved === true && clean(d.approvalReference, 3, 200) && d.kind === 'quito_cod' && d.city === 'Quito' &&
    clean(d.id, 3, 60) && clean(d.label, 3, 150) && Number.isSafeInteger(d.costCents) && d.costCents >= 0 &&
    Array.isArray(d.postalCodes) && d.postalCodes.length > 0 && d.postalCodes.every(p => /^\d{6}$/.test(p)) &&
    Array.isArray(d.allowedSkus) && d.allowedSkus.length > 0 && d.allowedSkus.every(s => /^[A-Z0-9_-]{3,40}$/.test(s)) &&
    d.payments?.length === 1 && d.payments[0] === 'cod' &&
    Number.isInteger(d.minBusinessDays) && d.minBusinessDays >= 1 && Number.isInteger(d.maxBusinessDays) &&
    d.maxBusinessDays >= d.minBusinessDays && d.maxBusinessDays <= 30 &&
    d.calendarApproved === true && clean(d.calendarApprovalReference, 3, 200) &&
    Array.isArray(d.deliveryWeekdays) && d.deliveryWeekdays.length > 0 && new Set(d.deliveryWeekdays).size === d.deliveryWeekdays.length && d.deliveryWeekdays.every(v => Number.isInteger(v) && v >= 0 && v <= 6) &&
    Array.isArray(d.holidays) && d.holidays.length <= 366 && d.holidays.every(v => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
}
function estimate(d, now) {
  function advance(days) {
    const date = new Date(new Date(now - 5 * 3600000).toISOString().slice(0, 10) + 'T12:00:00Z');
    let scanned = 0;
    while (days > 0) { date.setUTCDate(date.getUTCDate() + 1); if (++scanned > 600) fail('CALENDARIO_NO_DISPONIBLE', 503); if (d.deliveryWeekdays.includes(date.getUTCDay()) && !d.holidays.includes(date.toISOString().slice(0, 10))) days--; }
    return date.toISOString().slice(0, 10);
  }
  const earliest = advance(d.minBusinessDays), latest = advance(d.maxBusinessDays);
  return {earliest, latest, eta: 'Entrega estimada: ' + earliest + (earliest === latest ? '' : ' a ' + latest)};
}
function delivery(config, id, payment, postalCode, items, now) {
  const d = config.deliveries.find(d => d.id === id);
  if (!validDelivery(d) || payment !== 'cod') fail('ENVIO_O_PAGO_NO_DISPONIBLE', 409);
  if (!/^\d{6}$/.test(postalCode || '') || !d.postalCodes.includes(postalCode)) fail('CODIGO_POSTAL_FUERA_COBERTURA', 409);
  if (!Array.isArray(d.allowedSkus) || !d.allowedSkus.length || items.some(i => !d.allowedSkus.includes(i.sku))) fail('ENVIO_NO_APROBADO_PARA_PRODUCTO', 409);
  return {id: d.id, label: d.label, city: d.city, costCents: d.costCents, postalCode,
    postalCodes: clone(d.postalCodes), payments: ['cod'], ...estimate(d, now)};
}
function sourceTime(data) {
  const time = Date.parse(data?.sourceGeneratedAt);
  if (!Number.isFinite(time) || !['original_workbook_core', 'validated_central_source', 'conservative_Quito_day_start'].includes(data.sourceTimestampBasis) ||
    new Date(time - 5 * 3600000).toISOString().slice(0, 10) !== data.cutDate) fail('FECHA_FUENTE_NO_VERIFICADA', 503);
  return time;
}
function sourceFence(box, data, now) {
  if (!/^[a-f0-9]{64}$/.test(data?.sourceHash || '') || !/^[a-f0-9]{64}$/.test(data?.version || '') || !/^\d{4}-\d{2}-\d{2}$/.test(data?.cutDate || '')) fail('FUENTE_NO_VERIFICADA', 503);
  const generated = sourceTime(data);
  if (generated > now) fail('FECHA_FUENTE_NO_VERIFICADA', 503);
  const last = row(box, 'SELECT version,source_sha,cut_date,generated_ms,timestamp_basis FROM checkout_sources WHERE latest=1');
  const seen = row(box, 'SELECT latest FROM checkout_sources WHERE version=?', data.version);
  if (last && (data.cutDate < last.cut_date || (seen && seen.latest !== 1))) fail('FUENTE_ANTERIOR_RECHAZADA', 409);
  if (last && last.version !== data.version) {
    // Report hashes are identities, never sortable version numbers. Without two
    // exact timestamps, different reports on the same Quito day are unordered.
    if (last.source_sha === data.sourceHash || generated <= last.generated_ms ||
      (data.cutDate === last.cut_date && [data.sourceTimestampBasis, last.timestamp_basis].includes('conservative_Quito_day_start'))) fail('FUENTE_ANTERIOR_O_AMBIGUA', 409);
  }
  if (last?.version === data.version && (last.generated_ms !== generated || last.timestamp_basis !== data.sourceTimestampBasis)) fail('FECHA_FUENTE_CAMBIADA', 409);
  if (!seen) { box.sql.exec('UPDATE checkout_sources SET latest=0'); box.sql.exec('INSERT INTO checkout_sources VALUES (?,?,?,?,?,1)', data.version, data.sourceHash, data.cutDate, generated, data.sourceTimestampBasis); }
}
function limit(box, config, client, now) {
  if (!/^[a-f0-9]{64}$/.test(client || '')) fail('INGRESO_NO_VERIFICADO', 503);
  const scopes = [['day:' + Math.floor(now / 86400000), config.maxRequestsPerDay], ['client:' + client + ':' + Math.floor(now / 3600000), config.maxRequestsPerClientHour]];
  box.state.storage.transactionSync(() => {
    box.sql.exec('DELETE FROM checkout_rate WHERE expires<=?', now);
    for (const [scope, max] of scopes) if ((row(box, 'SELECT n FROM checkout_rate WHERE scope=?', scope)?.n || 0) >= max) fail('LIMITE_TEMPORAL_ALCANZADO', 429);
    for (const [scope] of scopes) box.sql.exec('INSERT INTO checkout_rate VALUES (?,1,?) ON CONFLICT(scope) DO UPDATE SET n=n+1', scope, now + 2 * 86400000);
  });
}
function checkoutCustomer(input) {
  if (!only(input, ['name', 'phone', 'email', 'address', 'city', 'postalCode']) || !/^\d{6}$/.test(input.postalCode || '')) fail('DATOS_ENTREGA_INVALIDOS');
  const {postalCode, ...rest} = input;
  return {...customer(rest), postalCode};
}

export async function checkoutFetch(path, req, box, {config, sourceProvider, seal, unseal, clock = Date.now}) {
  if (!path.startsWith('/web-checkout/')) return null;
  try {
    settings(box, config);
    if (req.method !== 'POST') fail('METODO_NO_DISPONIBLE', 405);
    const envelope = await req.json(), now = clock();
    if (!path.startsWith('/web-checkout/admin/')) limit(box, config, envelope.client, now);
    // Cleanup never releases active order quantities implicitly, even after a new cut.
    box.sql.exec('DELETE FROM checkout_quotes WHERE expires<=?', now);
    box.sql.exec('UPDATE checkout_orders SET customer_sealed=NULL WHERE closed IS NOT NULL AND closed<?', now - config.customerRetentionDays * 86400000);
    if (path === '/web-checkout/catalogo') {
      const data = await sourceProvider();
      box.state.storage.transactionSync(() => sourceFence(box, data, clock()));
      const pendingOrders = pending(box);
      const products = data.products.map(p => ({...p, stock: Math.max(0, p.stock - pendingOrders.reduce((n, o) => n + o.receipt.items.filter(i => i.sku === p.sku).reduce((m, i) => m + i.quantity, 0), 0))}));
      return json({mode: 'datahub', enabled: true, cutDate: data.cutDate, products,
        deliveries: config.deliveries.map(d => ({id: d.id, label: d.label, costCents: d.costCents, postalCodes: d.postalCodes, payments: ['cod'], ...estimate(d, now)}))});
    }
    if (path === '/web-checkout/cotizacion') {
      const b = envelope.body;
      if (!only(b, ['items', 'deliveryId', 'payment', 'postalCode'])) fail('COTIZACION_INVALIDA');
      const data = await sourceProvider();
      const quote = box.state.storage.transactionSync(() => {
        sourceFence(box, data, clock());
        const items = calculate(b.items, data, pending(box));
        const shipping = delivery(config, b.deliveryId, b.payment, b.postalCode, items, now);
        const subtotalCents = items.reduce((n, i) => n + i.lineTotalCents, 0);
        const totalCents = subtotalCents + shipping.costCents;
        if (!Number.isSafeInteger(totalCents) || totalCents <= 0) fail('IMPORTE_INVALIDO');
        if (row(box, 'SELECT COUNT(*) AS n FROM checkout_quotes').n >= 1000) fail('LIMITE_TEMPORAL_ALCANZADO', 429);
        const q = {quoteId: crypto.randomUUID(), mode: 'datahub', items, delivery: shipping, payment: 'cod',
          subtotalCents, shippingCents: shipping.costCents, totalCents, currency: 'USD',
          sourceHash: data.sourceHash, version: data.version, cutDate: data.cutDate,
          sourceGeneratedAt: data.sourceGeneratedAt, sourceTimestampBasis: data.sourceTimestampBasis,
          expiresAt: new Date(now + config.quoteTtlMs).toISOString()};
        box.sql.exec('INSERT INTO checkout_quotes VALUES (?,?,?)', q.quoteId, JSON.stringify(q), now + config.quoteTtlMs);
        return q;
      });
      return json(quote);
    }
    if (path === '/web-checkout/pedidos') {
      const b = envelope.body, key = envelope.key;
      if (!only(b, ['quoteId', 'customer', 'consent']) || b.consent !== true || !clean(b.quoteId, 16, 80) || !/^[A-Za-z0-9_-]{16,80}$/.test(key || '')) fail('CONFIRMACION_INVALIDA');
      const contact = checkoutCustomer(b.customer);
      const digest = await checkoutDigest(JSON.stringify({quoteId: b.quoteId, customer: contact, consent: true}), box.env.PILOT_TOKEN);
      const replay = row(box, 'SELECT digest,receipt FROM checkout_orders WHERE request_key=?', key);
      if (replay) { if (replay.digest !== digest) fail('CLAVE_REINTENTO_CONFLICTO', 409); return json(JSON.parse(replay.receipt)); }
      const data = await sourceProvider();
      const sealed = await seal(JSON.stringify(contact), box.env.PILOT_TOKEN);
      const receipt = box.state.storage.transactionSync(() => {
        const commitNow = clock();
        const again = row(box, 'SELECT digest,receipt FROM checkout_orders WHERE request_key=?', key);
        if (again) { if (again.digest !== digest) fail('CLAVE_REINTENTO_CONFLICTO', 409); return JSON.parse(again.receipt); }
        sourceFence(box, data, commitNow);
        if (row(box, 'SELECT id FROM checkout_orders WHERE quote_id=?', b.quoteId)) fail('COTIZACION_YA_CONFIRMADA', 409);
        const stored = row(box, 'SELECT payload,expires FROM checkout_quotes WHERE id=?', b.quoteId);
        if (!stored || stored.expires <= commitNow) fail('COTIZACION_VENCIDA', 409);
        const q = JSON.parse(stored.payload);
        if (q.sourceHash !== data.sourceHash || q.version !== data.version) fail('CATALOGO_CAMBIO_COTIZAR_NUEVAMENTE', 409);
        if (contact.city.toLocaleLowerCase('es') !== 'quito' || contact.postalCode !== q.delivery.postalCode) fail('DESTINO_NO_COTIZADO', 409);
        const items = calculate(q.items.map(i => ({sku: i.sku, quantity: i.quantity})), data, pending(box));
        const shipping = delivery(config, q.delivery.id, q.payment, contact.postalCode, items, commitNow);
        const subtotal = items.reduce((n, i) => n + i.lineTotalCents, 0);
        if (subtotal !== q.subtotalCents || shipping.costCents !== q.shippingCents || shipping.earliest !== q.delivery.earliest || shipping.latest !== q.delivery.latest) fail('CONDICIONES_CAMBIARON_COTIZAR_NUEVAMENTE', 409);
        if (row(box, 'SELECT COUNT(*) AS n FROM checkout_orders WHERE created>=?', Math.floor(commitNow / 86400000) * 86400000).n >= config.maxOrdersPerDay || row(box, "SELECT COUNT(*) AS n FROM checkout_orders WHERE allocation='pending_web'").n >= config.maxOpenOrders) fail('LIMITE_TEMPORAL_ALCANZADO', 429);
        const r = {...q, id: 'CT-' + crypto.randomUUID(), createdAt: new Date(commitNow).toISOString(), status: 'pedido_recibido_contraentrega',
          paymentStatus: 'pending_cod', liveOrder: true, paid: false, stockReservedIn593: false, estimatedDelivery: q.delivery.eta};
        box.sql.exec('INSERT INTO checkout_orders (id,request_key,digest,quote_id,receipt,customer_sealed,created,allocation) VALUES (?,?,?,?,?,?,?,?)', r.id, key, digest, q.quoteId, JSON.stringify(r), sealed, commitNow, 'pending_web');
        return r;
      });
      return json(receipt, 201);
    }
    if (path === '/web-checkout/admin/pedidos') {
      const orders = box.sql.exec('SELECT id,receipt,customer_sealed,allocation,reconciled_sha,reconciliation_ref FROM checkout_orders ORDER BY created DESC LIMIT 50').toArray();
      return json({orders: await Promise.all(orders.map(async r => ({...JSON.parse(r.receipt), allocation: r.allocation,
        reconciledSourceHash: r.reconciled_sha, reconciliationReference: r.reconciliation_ref,
        customer: r.customer_sealed ? JSON.parse(await unseal(r.customer_sealed, box.env.PILOT_TOKEN)) : null})))});
    }
    if (path === '/web-checkout/admin/actualizar') {
      const b = envelope.body;
      if (!only(b, ['id', 'action', 'sourceHash', 'reference']) || !clean(b.id, 16, 80) || !clean(b.reference, 3, 150) || !['cancelar', 'conciliar_593', 'entregado'].includes(b.action)) fail('ACTUALIZACION_INVALIDA');
      const data = b.action === 'conciliar_593' ? await sourceProvider() : null;
      const result = box.state.storage.transactionSync(() => {
        const order = row(box, 'SELECT receipt,allocation,created FROM checkout_orders WHERE id=?', b.id);
        if (!order) fail('PEDIDO_NO_ENCONTRADO', 404);
        if (b.action === 'conciliar_593') {
          sourceFence(box, data, clock());
          if (b.sourceHash !== data.sourceHash || order.allocation !== 'pending_web') fail('CONCILIACION_INVALIDA', 409);
          if (data.sourceHash === JSON.parse(order.receipt).sourceHash || sourceTime(data) <= order.created) fail('CONCILIACION_REQUIERE_CORTE_POSTERIOR', 409);
          box.sql.exec("UPDATE checkout_orders SET allocation='accounted_in_593',reconciled_sha=?,reconciliation_ref=? WHERE id=?", data.sourceHash, b.reference, b.id);
        } else {
          if (order.allocation === 'cancelled' || order.allocation === 'delivered') fail('PEDIDO_YA_CERRADO', 409);
          if (b.action === 'entregado' && order.allocation !== 'accounted_in_593') fail('CONCILIAR_593_ANTES_DE_CERRAR', 409);
          box.sql.exec('UPDATE checkout_orders SET allocation=?,reconciliation_ref=?,closed=? WHERE id=?', b.action === 'cancelar' ? 'cancelled' : 'delivered', b.reference, now, b.id);
        }
        return {id: b.id, operationRecorded: true};
      });
      return json(result);
    }
    return json({error: 'RUTA_NO_DISPONIBLE'}, 404);
  } catch (error) {
    // No customer body, token, address, phone or private provider exception is logged or returned.
    return json({error: error instanceof CheckoutError ? error.code : 'PEDIDO_NO_PROCESADO'}, error instanceof CheckoutError ? error.status : 503);
  }
}
