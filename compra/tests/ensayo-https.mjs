// Local smoke test using a read-only source snapshot and a disposable SQLite file.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer, request} from 'node:https';
import {once} from 'node:events';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {checkoutPublic, checkoutAdmin} from '../servidor/checkout-edge.mjs';
import {checkoutFetch, checkoutInit} from '../servidor/checkout-store.mjs';
import {CHECKOUT_CONFIG} from '../servidor/checkout-config.mjs';

const [snapshot, keyFile, certFile, cipherModule, sku] = process.argv.slice(2);
if (!sku) throw Error('Uso: node ensayo-https.mjs SNAPSHOT LLAVE_TLS CERT_TLS MODULO_CIFRADO SKU');
const data = JSON.parse(await readFile(snapshot, 'utf8'));
const {seal, unseal} = await import(pathToFileURL(cipherModule).href);
const product = data.products.find(item => item.sku === sku && item.stock > 0);
assert.ok(product, 'El SKU debe estar disponible en la fuente ensayada');
const [key, cert] = await Promise.all([readFile(keyFile), readFile(certFile)]);
const temp = await mkdtemp(join(tmpdir(), 'ct-checkout-https-'));
const config = {...CHECKOUT_CONFIG, enabled: true, deliveries: [{
  id: 'fixture-https', label: 'Entrega sintética', kind: 'quito_cod', city: 'Quito',
  approved: true, approvalReference: 'ENSAYO_NO_COMERCIAL', costCents: 290,
  postalCodes: ['000000'], allowedSkus: [sku], payments: ['cod'],
  minBusinessDays: 1, maxBusinessDays: 2, calendarApproved: true,
  calendarApprovalReference: 'ENSAYO_NO_COMERCIAL', deliveryWeekdays: [1,2,3,4,5], holidays: []
}]};
const token = randomUUID();
const env = {FREE_TIER_VERIFIED: 'true', PILOT_TOKEN: token};
const box = {name: config.objectName, env, state: {storage: {}}};
let db;
function openDb() {
  db = new DatabaseSync(join(temp, 'orders.sqlite'));
  box.sql = {exec(sql, ...args) {
    const rows = db.prepare(sql).all(...args);
    return {toArray: () => rows, one: () => rows[0]};
  }};
  box.state.storage.transactionSync = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  checkoutInit(box, config);
}
const deps = {config, sourceProvider: async () => structuredClone(data), seal, unseal,
  clock: () => Date.parse(data.sourceGeneratedAt) + 3600000};
env.MESSENGER_TEST_INBOX = {
  idFromName: name => name,
  get(name) {
    assert.equal(name, box.name);
    return {fetch: (url, options) => checkoutFetch(new URL(url).pathname, new Request(url, options), box, deps)};
  }
};
const server = createServer({key, cert}, async (incoming, outgoing) => {
  try {
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const req = new Request('https://127.0.0.1' + incoming.url, {
      method: incoming.method, headers: incoming.headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined
    });
    const res = await checkoutPublic(req, env, config) ?? await checkoutAdmin(req, env, config);
    outgoing.writeHead(res?.status ?? 404, res ? Object.fromEntries(res.headers) : {});
    outgoing.end(res ? await res.text() : '');
  } catch { outgoing.writeHead(500).end(); }
});
function call(path, {body, authorization, idempotency} = {}) {
  return new Promise((resolve, reject) => {
    const req = request({hostname: '127.0.0.1', port: server.address().port, path: '/api/compra/' + path,
      ca: cert, method: body ? 'POST' : 'GET', headers: {
        Origin: config.storefrontOrigin, 'CF-Connecting-IP': '192.0.2.1',
        ...(body ? {'Content-Type': 'application/json'} : {}),
        ...(authorization ? {Authorization: 'Bearer ' + token} : {}),
        ...(idempotency ? {'Idempotency-Key': idempotency} : {})
      }}, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        try { resolve({status: res.statusCode, body: JSON.parse(text)}); } catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
}
try {
  openDb();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  assert.equal((await call('catalogo')).status, 200);
  const quote = await call('cotizacion', {body: {items: [{sku, quantity: 1}],
    deliveryId: 'fixture-https', payment: 'cod', postalCode: '000000'}});
  assert.equal(quote.status, 200);
  assert.equal(quote.body.totalCents, product.priceCents + 290);
  const customer = {name: 'Cliente Sintético', phone: '0000000000', email: '',
    city: 'Quito', address: 'Dirección sintética de prueba', postalCode: '000000'};
  const options = {body: {quoteId: quote.body.quoteId, customer, consent: true}, idempotency: randomUUID()};
  const order = await call('pedidos', options);
  assert.equal(order.status, 201);
  assert.equal(order.body.customer, undefined);
  assert.equal(order.body.paid, false);
  assert.equal(order.body.stockReservedIn593, false);
  assert.ok(order.body.estimatedDelivery);
  assert.equal((await call('admin/pedidos')).status, 401);
  db.close();
  openDb();
  const admin = await call('admin/pedidos', {authorization: true});
  assert.equal(admin.status, 200);
  assert.equal(admin.body.orders.length, 1);
  assert.deepEqual(admin.body.orders[0].customer, customer);
  assert.deepEqual((await call('pedidos', options)).body, order.body);
  assert.equal(db.prepare('SELECT count(*) AS n FROM checkout_orders').get().n, 1);
  console.log(JSON.stringify({https: true, sku, cut: data.cutDate, quote: quote.status,
    confirm: order.status, admin: admin.status, unauthorized: 401, durableAfterRestart: true,
    idempotent: true, amountCents: order.body.totalCents, fixtureShippingCents: 290}));
} finally {
  if (server.listening) await new Promise(resolve => server.close(resolve));
  db?.close();
  await rm(temp, {recursive: true, force: true});
}
