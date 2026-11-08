import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {checkoutInit, checkoutFetch} from '../servidor/checkout-store.mjs';
import {checkoutPublic, checkoutAdmin} from '../servidor/checkout-edge.mjs';
import {readCheckoutSource} from '../servidor/checkout-shared-source.mjs';
import {CHECKOUT_CONFIG} from '../servidor/checkout-config.mjs';

const hex = c => c.repeat(64);
const source = () => ({sourceHash: hex('a'), version: hex('b'), cutDate: '2026-11-02', sourceGeneratedAt: '2026-11-02T14:00:00Z', sourceTimestampBasis: 'original_workbook_core', products: [{sku: 'ADAP005', name: 'Adaptador', image: 'https://conectatech-ec.github.io/imagenes/adap005.webp', url: 'https://conectatech-ec.github.io/productos/adap005/', priceCents: 250, pvpCents: 287, stock: 3}]});
const contact = {name: 'Cliente Ficticio', phone: '0000000000', email: '', city: 'Quito', address: 'Dirección de prueba 123', postalCode: '170135'};
const quoteBody = {items: [{sku: 'ADAP005', quantity: 2}], deliveryId: 'fixture-quito', payment: 'cod', postalCode: '170135'};
const configForTest = () => ({...structuredClone(CHECKOUT_CONFIG), enabled: true, deliveries: [{id: 'fixture-quito', label: 'Zona ficticia, no comercial', kind: 'quito_cod', city: 'Quito', approved: true, approvalReference: 'PRUEBA_NO_APROBACION_COMERCIAL', costCents: 290,
  postalCodes: ['170135'], allowedSkus: ['ADAP005'], payments: ['cod'], minBusinessDays: 1, maxBusinessDays: 2, calendarApproved: true, calendarApprovalReference: 'PRUEBA_CALENDARIO', deliveryWeekdays: [1,2,3,4,5], holidays: []}]});
// Real AES-GCM, matching the existing messenger-control seal/unseal contract.
const cryptoKey = secret => crypto.subtle.digest('SHA-256', new TextEncoder().encode('conectatech:tester-psid:' + secret)).then(raw => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']));
const seal = async (text, secret) => { const iv = crypto.getRandomValues(new Uint8Array(12)); return JSON.stringify({iv: [...iv], cipher: [...new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, await cryptoKey(secret), new TextEncoder().encode(text)))]}); };
const unseal = async (raw, secret) => { const x = JSON.parse(raw); return new TextDecoder().decode(await crypto.subtle.decrypt({name: 'AES-GCM', iv: new Uint8Array(x.iv)}, await cryptoKey(secret), new Uint8Array(x.cipher))); };

async function setup(t) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ct-datahub-sqlite-'));
  const file = path.join(temp, 'existing-object.sqlite');
  const config = configForTest(), data = source(); let db, now = Date.parse('2026-11-03T16:00:00Z');
  const box = {name: 'messenger-development', env: {FREE_TIER_VERIFIED: 'true', PILOT_TOKEN: 'synthetic-test-token-never-deployed'}, state: {storage: {}}};
  const open = () => {
    db = new DatabaseSync(file); db.exec('PRAGMA journal_mode=WAL');
    box.sql = {exec(sql, ...args) { const stmt = db.prepare(sql); const rows = stmt.all(...args); return {toArray: () => rows, one: () => rows[0]}; }};
    box.state.storage.transactionSync = fn => { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } };
    checkoutInit(box, config);
  };
  open();
  t.after(async () => { db.close(); await fs.rm(temp, {recursive: true, force: true}); });
  const deps = {config, sourceProvider: async () => structuredClone(data), seal, unseal, clock: () => now};
  const call = async (path, body = null, key = null) => {
    const response = await checkoutFetch('/web-checkout/' + path, new Request('https://inbox/web-checkout/' + path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({body, key, client: hex('c')})}), box, deps);
    return {status: response.status, body: await response.json()};
  };
  const quote = async body => { const r = await call('cotizacion', body || quoteBody); assert.equal(r.status, 200, JSON.stringify(r)); return r.body; };
  const order = (q, key = 'datahub-test-key-0001', customer = contact) => call('pedidos', {quoteId: q.quoteId, customer, consent: true}, key);
  return {box, config, data, deps, call, quote, order, setNow(value) { now = Date.parse(value); }, rows: sql => db.prepare(sql).all(), restart() { db.close(); open(); }};
}

test('SQLite real guarda pedido durable cifrado y conserva recibo al reiniciar', async t => {
  const s = await setup(t), q = await s.quote();
  const r = await s.order(q);
  assert.equal(r.status, 201); assert.equal(r.body.totalCents, 790);
  assert.equal(r.body.mode, 'datahub'); assert.equal(r.body.liveOrder, true);
  assert.equal(r.body.paid, false); assert.equal(r.body.stockReservedIn593, false);
  assert.equal(r.body.status, 'pedido_recibido_contraentrega'); assert.equal(r.body.paymentStatus, 'pending_cod');
  assert.equal(r.body.quoteId, q.quoteId); assert.equal(r.body.customer, undefined);
  assert.equal(r.body.delivery.earliest, '2026-11-04');
  const saved = s.rows('SELECT * FROM checkout_orders')[0];
  assert.ok(!saved.customer_sealed.includes(contact.name)); assert.ok(!saved.receipt.includes(contact.address));
  s.restart(); const again = await s.order(q); assert.deepEqual(again.body, r.body);
  const admin = await s.call('admin/pedidos'); assert.deepEqual(admin.body.orders[0].customer, contact);
});

test('la limpieza conserva pedidos abiertos y elimina contacto de cerrados después del plazo', async t => {
  const s = await setup(t);
  const closed = (await s.order(await s.quote())).body;
  assert.equal((await s.call('admin/actualizar', {
    id: closed.id, action: 'cancelar', reference: 'prueba-de-retencion'
  })).status, 200);
  const open = (await s.order(await s.quote(), 'datahub-test-key-open')).body;

  s.setNow('2026-12-02T16:00:00Z');
  const before = (await s.call('admin/pedidos')).body.orders;
  assert.deepEqual(before.find(order => order.id === closed.id).customer, contact);

  s.setNow('2026-12-04T16:00:00Z');
  const after = (await s.call('admin/pedidos')).body.orders;
  const retained = after.find(order => order.id === closed.id);
  assert.equal(retained.customer, null);
  assert.equal(retained.totalCents, closed.totalCents);
  assert.deepEqual(after.find(order => order.id === open.id).customer, contact);
  assert.equal(s.rows('SELECT id FROM checkout_quotes').length, 0);
});

test('concurrencia y replay usan claves únicas reales en SQLite', async t => {
  const s = await setup(t); const q = await s.quote();
  const results = await Promise.all([s.order(q), s.order(q)]);
  assert.deepEqual(results[0].body, results[1].body); assert.equal(s.rows('SELECT id FROM checkout_orders').length, 1);
  assert.equal((await s.order(q, 'datahub-test-key-0002')).body.error, 'COTIZACION_YA_CONFIRMADA');
  assert.equal((await s.order(q, 'datahub-test-key-0001', {...contact, name: 'Otro Cliente'})).body.error, 'CLAVE_REINTENTO_CONFLICTO');
});

test('dos compradores no confirman cantidades por encima del corte y órdenes web pendientes', async t => {
  const s = await setup(t); s.data.products[0].stock = 1;
  const [a, b] = await Promise.all([s.quote({...quoteBody, items: [{sku: 'ADAP005', quantity: 1}]}), s.quote({...quoteBody, items: [{sku: 'ADAP005', quantity: 1}]})]);
  const results = await Promise.all([s.order(a, 'datahub-test-key-0003'), s.order(b, 'datahub-test-key-0004')]);
  assert.equal(results.filter(r => r.status === 201).length, 1);
  assert.equal(results.find(r => r.status !== 201).body.error, 'CANTIDAD_NO_DISPONIBLE');
});

test('corte nuevo conserva cantidades web; conciliación explícita evita descontarlas dos veces', async t => {
  const s = await setup(t), q = await s.quote(); const order = (await s.order(q)).body;
  // New 593 cut already reflects these two units. Never reset pending orders implicitly.
  s.data.sourceHash = hex('d'); s.data.version = hex('e'); s.data.cutDate = '2026-11-03'; s.data.sourceGeneratedAt = '2026-11-03T16:30:00Z'; s.setNow('2026-11-03T17:00:00Z'); s.data.products[0].stock = 1;
  assert.equal((await s.call('catalogo')).body.products[0].stock, 0);
  assert.equal((await s.call('admin/actualizar', {id: order.id, action: 'conciliar_593', sourceHash: hex('f'), reference: 'fixture-registro-593'})).status, 409);
  assert.equal((await s.call('admin/actualizar', {id: order.id, action: 'conciliar_593', sourceHash: hex('d'), reference: 'fixture-registro-593'})).status, 200);
  assert.equal((await s.call('catalogo')).body.products[0].stock, 1);
  assert.equal(s.rows('SELECT allocation FROM checkout_orders')[0].allocation, 'accounted_in_593');
  assert.equal(s.rows('SELECT name FROM sqlite_master WHERE type=\'table\' AND name LIKE \'%invent%\'').length, 0);
});

test('rechaza rollback de una fuente anterior ya observada y cambio de precio antes de confirmar', async t => {
  const s = await setup(t), q = await s.quote(); const old = structuredClone(s.data);
  s.data.sourceHash = hex('d'); s.data.version = hex('e'); s.data.cutDate = '2026-11-03'; s.data.sourceGeneratedAt = '2026-11-03T15:30:00Z';
  assert.equal((await s.order(q)).body.error, 'CATALOGO_CAMBIO_COTIZAR_NUEVAMENTE');
  await s.call('catalogo'); Object.assign(s.data, old);
  assert.equal((await s.call('catalogo')).body.error, 'FUENTE_ANTERIOR_RECHAZADA');
});

test('cobertura postal, ciudad, tarifa aprobada y método COD se exigen', async t => {
  const s = await setup(t);
  assert.equal((await s.call('cotizacion', {...quoteBody, postalCode: '090101'})).body.error, 'CODIGO_POSTAL_FUERA_COBERTURA');
  assert.equal((await s.call('cotizacion', {...quoteBody, payment: 'transfer'})).status, 409);
  const q = await s.quote();
  assert.equal((await s.order(q, 'datahub-test-key-0005', {...contact, postalCode: '170136'})).body.error, 'DESTINO_NO_COTIZADO');
  assert.equal((await s.order(q, 'datahub-test-key-0005', {...contact, city: 'Guayaquil'})).body.error, 'DESTINO_NO_COTIZADO');
  s.config.deliveries[0].approved = false;
  assert.equal((await s.call('catalogo')).status, 503);
});

test('datos comerciales inyectados y fuente caída no generan recibo', async t => {
  const s = await setup(t);
  assert.equal((await s.call('cotizacion', {...quoteBody, totalCents: 1})).status, 400);
  const q = await s.quote(); s.deps.sourceProvider = async () => { throw Error('secret-not-public'); };
  const r = await s.order(q); assert.equal(r.status, 503); assert.equal(r.body.error, 'PEDIDO_NO_PROCESADO');
  assert.equal(s.rows('SELECT id FROM checkout_orders').length, 0);
});

test('fallo del INSERT real hace rollback y no devuelve éxito', async t => {
  const s = await setup(t), q = await s.quote();
  s.box.sql.exec("CREATE TRIGGER fail_checkout BEFORE INSERT ON checkout_orders BEGIN SELECT RAISE(ABORT, 'storage unavailable'); END");
  const r = await s.order(q); assert.equal(r.status, 503); assert.equal(s.rows('SELECT id FROM checkout_orders').length, 0);
});

test('cuotas acotan solicitudes y no existen lecturas públicas de pedidos', async t => {
  const s = await setup(t); s.config.maxRequestsPerClientHour = 1;
  assert.equal((await s.call('catalogo')).status, 200);
  assert.equal((await s.call('catalogo')).status, 429);
  const env = {...s.box.env, MESSENGER_TEST_INBOX: {idFromName: x => x, get: () => ({fetch: () => { throw Error('must not call'); }})}};
  const req = new Request('https://worker.example/api/compra/pedidos', {headers: {Origin: CHECKOUT_CONFIG.storefrontOrigin}});
  const r = await checkoutPublic(req, env, s.config); assert.equal(r.status, 405);
  assert.equal(await checkoutPublic(new Request('https://worker.example/api/compra/admin/pedidos'), env, s.config), null);
  assert.equal((await checkoutAdmin(new Request('https://worker.example/api/compra/admin/pedidos'), env, s.config)).status, 401);
});

test('edge HTTPS, CORS exacto y gate Free/default cerrado antes del DO', async t => {
  const s = await setup(t); let calls = 0;
  const env = {...s.box.env, MESSENGER_TEST_INBOX: {idFromName: x => { assert.equal(x, 'messenger-development'); return x; }, get: () => ({fetch: async (url, init) => { calls++; return checkoutFetch(new URL(url).pathname, new Request(url, init), s.box, s.deps); }})}};
  const req = (origin = CHECKOUT_CONFIG.storefrontOrigin, protocol = 'https:') => new Request(protocol + '//worker.example/api/compra/catalogo', {headers: {Origin: origin, 'CF-Connecting-IP': '192.0.2.1'}});
  assert.equal((await checkoutPublic(req(), env, CHECKOUT_CONFIG)).status, 503);
  assert.equal((await checkoutPublic(req('https://attacker.example'), env, s.config)).status, 403);
  assert.equal((await checkoutPublic(req(undefined, 'http:'), env, s.config)).status, 403);
  assert.equal(calls, 0);
  const r = await checkoutPublic(req(), env, s.config); assert.equal(r.status, 200);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), CHECKOUT_CONFIG.storefrontOrigin);
  assert.equal((await r.json()).enabled, true); assert.equal(calls, 1);
});

test('disabled adapter creates no tables in existing SQLite', async t => {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  checkoutInit({name: 'messenger-development', sql: {exec: sql => db.exec(sql)}}, CHECKOUT_CONFIG);
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().length, 0);
});

test('Data Hub source adapter joins matching published cut and rejects mixed versions', async () => {
  const data = source(), product = data.products[0];
  const hub = {shared_hub_status: {state: 'verified'}, source: {sha256: data.sourceHash, cut_date: data.cutDate, generated_at: data.sourceGeneratedAt, timestamp_basis: data.sourceTimestampBasis}, products: [{sku: product.sku, name: product.name, availability: 'in_stock', blocked_reasons: [], prices: {promo_cash_cents: 250, pvp_card_cents: 287}, web: {price_matches: true, url: product.url, image_url: product.image}}]};
  const pointer = {referencia: 'datos-593/corte-comercial-publico-validado.json', origen_sha256: data.sourceHash, fecha_corte: data.cutDate, sku_web: 1};
  const cut = {sha256_original: data.sourceHash, fecha_corte: data.cutDate, cantidad_sku_web: 1, productos: {ADAP005: {stock: 3, promo_centavos: 250, pvp_centavos: 287}}};
  const options = {central: {}, readSharedHub: async () => hub, fetcher: async url => Response.json(url.includes('estado-ultimo') ? pointer : cut)};
  const result = await readCheckoutSource(options); assert.equal(result.products[0].stock, 3); assert.equal(result.sourceHash, data.sourceHash);
  cut.sha256_original = hex('f'); await assert.rejects(readCheckoutSource(options), /VERSION_MISMATCH/);
});

test('conciliación rechaza el mismo corte y otro corte generado antes del pedido', async t => {
  const s = await setup(t), q = await s.quote(), receipt = (await s.order(q)).body;
  const update = () => s.call('admin/actualizar', {id: receipt.id, action: 'conciliar_593', sourceHash: s.data.sourceHash, reference: 'fixture-referencia-autenticada'});
  assert.equal((await update()).body.error, 'CONCILIACION_REQUIERE_CORTE_POSTERIOR');
  s.data.sourceHash = hex('d'); s.data.version = hex('e'); s.data.cutDate = '2026-11-03';
  s.data.sourceGeneratedAt = '2026-11-03T15:00:00Z'; s.data.products[0].stock = 1;
  assert.equal((await update()).body.error, 'CONCILIACION_REQUIERE_CORTE_POSTERIOR');
  assert.equal(s.rows('SELECT allocation FROM checkout_orders')[0].allocation, 'pending_web');
  s.setNow('2026-11-03T17:00:00Z'); s.data.sourceGeneratedAt = '2026-11-03T16:30:00Z';
  assert.equal((await update()).status, 200);
  assert.equal((await s.call('catalogo')).body.products[0].stock, 1);
});

test('respuesta antigua no vista del mismo día no sobrescribe una fuente más nueva en carrera', async t => {
  const s = await setup(t); s.setNow('2026-11-03T17:00:00Z');
  const older = {...source(), sourceHash: hex('d'), version: hex('e'), cutDate: '2026-11-03', sourceGeneratedAt: '2026-11-03T13:00:00Z'};
  const newer = {...source(), sourceHash: hex('f'), version: hex('0'), cutDate: '2026-11-03', sourceGeneratedAt: '2026-11-03T16:30:00Z'};
  let release, signal, calls = 0;
  const waiting = new Promise(resolve => { signal = resolve; });
  s.deps.sourceProvider = () => ++calls === 1 ? new Promise(resolve => { release = () => resolve(older); signal(); }) : Promise.resolve(newer);
  const delayed = s.call('catalogo'); await waiting;
  assert.equal((await s.call('catalogo')).status, 200);
  release(); const rejected = await delayed;
  assert.equal(rejected.status, 409); assert.equal(rejected.body.error, 'FUENTE_ANTERIOR_O_AMBIGUA');
  assert.equal(s.rows('SELECT source_sha FROM checkout_sources WHERE latest=1')[0].source_sha, newer.sourceHash);
});

test('dos versiones del mismo día sin orden temporal acreditado quedan bloqueadas', async t => {
  const s = await setup(t);
  s.data.cutDate = '2026-11-03'; s.data.sourceGeneratedAt = '2026-11-03T05:00:00Z'; s.data.sourceTimestampBasis = 'conservative_Quito_day_start';
  assert.equal((await s.call('catalogo')).status, 200);
  s.data.sourceHash = hex('d'); s.data.version = hex('e'); s.data.sourceGeneratedAt = '2026-11-03T15:00:00Z'; s.data.sourceTimestampBasis = 'original_workbook_core';
  assert.equal((await s.call('catalogo')).body.error, 'FUENTE_ANTERIOR_O_AMBIGUA');
});

test('calendario debe estar aprobado explícitamente y puede incluir días distintos de lunes a viernes', async t => {
  const s = await setup(t), d = s.config.deliveries[0];
  delete d.deliveryWeekdays;
  assert.equal((await s.call('catalogo')).body.error, 'ENVIO_NO_CONFIGURADO');
  d.deliveryWeekdays = [0]; d.calendarApproved = false;
  assert.equal((await s.call('catalogo')).body.error, 'ENVIO_NO_CONFIGURADO');
  d.calendarApproved = true;
  let q = await s.quote(); assert.equal(q.delivery.earliest, '2026-11-08'); assert.equal(q.delivery.latest, '2026-11-15');
  d.holidays = ['2026-11-08']; q = await s.quote();
  assert.equal(q.delivery.earliest, '2026-11-15'); assert.equal(q.delivery.latest, '2026-11-22');
});
