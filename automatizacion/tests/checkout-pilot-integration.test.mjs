// Only synthetic, local fixtures. No Cloudflare or GitHub request is permitted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {execFileSync} from 'node:child_process';
import {createServer, request} from 'node:https';
import {once} from 'node:events';
import {mkdtemp, readdir, readFile, writeFile, cp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import worker, {MessengerTestInbox} from '../worker.mjs';
import {CHECKOUT_CONFIG} from '../checkout-config.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await readFile(join(root, 'checkout-integration.json')));

function sqliteObject(file, ObjectClass, env) {
  const db = new DatabaseSync(file);
  const storage = {sql: {exec(sql, ...args) {
    const rows = db.prepare(sql).all(...args);
    return {toArray: () => rows, one: () => rows[0]};
  }}, setAlarm: async () => {}, transactionSync(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }};
  const box = new ObjectClass({id: {name: 'messenger-development'}, storage}, env);
  return {db, box};
}

test('integration hashes match PR313 artifacts; inverse hooks restore the exact pilot base', async () => {
  assert.equal(manifest.source_commit, 'e088cac0e316a768604c7fcd9e8d5cb6e52b99c9');
  assert.equal(manifest.pilot_base, '53827d778c7731273d29ccc2891d6a06d41456f1');
  assert.equal(manifest.runtime_modules.length, 8);
  for (const item of [...manifest.runtime_modules, ...manifest.development_only]) {
    const bytes = await readFile(join(root, '..', item.path));
    assert.equal(digest(bytes), item.after_sha256, item.path);
    if (!item.replacements) continue;
    let original = bytes.toString();
    for (const change of [...item.replacements].reverse()) {
      assert.equal(original.split(change.after).length - 1, 1, item.path);
      original = original.replace(change.after, change.before);
    }
    assert.equal(digest(original), item.before_sha256, item.path);
  }
  for (const item of manifest.protected_paths) {
    assert.equal(digest(await readFile(join(root, '..', item.path))), item.sha256, item.path);
  }
});

test('checked-in Worker closes public/admin checkout and creates no checkout tables', async () => {
  assert.equal(CHECKOUT_CONFIG.enabled, false);
  assert.deepEqual(CHECKOUT_CONFIG.deliveries, []);
  const flags = JSON.parse(await readFile(join(root, 'activar-cloud.json')));
  assert.equal(flags.activar, false);
  assert.equal(flags.datahub_scoped_content_enabled, false);
  const env = {PILOT_TOKEN: randomUUID(), FREE_TIER_VERIFIED: 'true',
    MESSENGER_TEST_INBOX: {idFromName() { throw Error('Disabled route reached storage'); }}};
  for (const [path, method] of [['catalogo', 'GET'], ['cotizacion', 'POST'], ['pedidos', 'POST']]) {
    const res = await worker.fetch(new Request('https://pilot/api/compra/' + path,
      {method, headers: {Origin: CHECKOUT_CONFIG.storefrontOrigin}}), env);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error, 'COMPRA_NO_HABILITADA');
  }
  const admin = 'https://pilot/api/compra/admin/pedidos';
  assert.equal((await worker.fetch(new Request(admin), env)).status, 401);
  assert.equal((await worker.fetch(new Request(admin, {headers: {
    Authorization: 'Bearer ' + env.PILOT_TOKEN}}), env)).status, 503);
  assert.equal((await worker.fetch(new Request('https://pilot/health'), env)).status, 200);
  assert.equal((await worker.fetch(new Request('https://pilot/commercial/catalog/status'), env)).status, 401);
  const local = sqliteObject(':memory:', MessengerTestInbox, env);
  try {
    assert.deepEqual(local.db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'checkout_%'").all(), []);
    const denied = await local.box.fetch(new Request('https://inbox/web-checkout/catalogo', {method: 'POST', body: '{}'}));
    assert.equal(denied.status, 503);
    assert.deepEqual(local.db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'checkout_%'").all(), []);
  } finally { local.db.close(); }
});

test('private loopback HTTPS traverses actual Worker, existing DO, Data Hub, AES and SQLite restart', async t => {
  const temp = await mkdtemp(join(tmpdir(), 'ct-checkout-pilot-'));
  t.after(() => rm(temp, {recursive: true, force: true}));
  // Isolated module graph: enable ONLY this disposable copy, never the repository.
  for (const name of await readdir(root)) {
    if (/\.(mjs|json)$/.test(name)) await cp(join(root, name), join(temp, name));
  }
  for (const name of ['central', 'generated']) await cp(join(root, name), join(temp, name), {recursive: true});
  const sku = 'SYNTHETIC001', isolatedSku = 'ISOLATED001', hash = 'a'.repeat(64);
  const generated = new Date(Date.now() - 60000).toISOString();
  const cutDate = new Date(Date.parse(generated) - 5 * 3600000).toISOString().slice(0, 10);
  const fixture = {schema: 'conectatech.commercial.v1', source: {
    sha256: hash, cut_date: cutDate, generated_at: generated, timestamp_basis: 'original_workbook_core'
  }, expires_at: new Date(Date.parse(generated) + 86400000).toISOString(), products: [
    {sku, name: 'Artículo sintético', source_name: 'Artículo sintético', availability: 'in_stock',
      blocked_reasons: [], prices: {currency: 'USD', promo_cash_cents: 250, pvp_card_cents: 287},
      web: {price_matches: true, url: 'https://conectatech-ec.github.io/productos/synthetic001/',
        image_url: 'https://conectatech-ec.github.io/imagenes/synthetic001.webp'}},
    {sku: isolatedSku, name: 'Aislado sintético', availability: 'blocked',
      blocked_reasons: ['IDENTITY_NOT_VERIFIED'], prices: null, web: {price_matches: false}}
  ]};
  // Existing Alex imports expect these identities; all remain blocked fixtures.
  for (const id of ['TELF017','TELF018','TELF019','TELF001','REL046']) fixture.products.push({
    sku: id, name: 'Identidad sintética bloqueada', availability: 'blocked',
    blocked_reasons: ['IDENTITY_NOT_VERIFIED'], prices: null, web: {price_matches: false}
  });
  await writeFile(join(temp, 'central/current.json'), JSON.stringify(fixture));
  const pointer = {referencia: 'datos-593/corte-comercial-publico-validado.json',
    origen_sha256: hash, fecha_corte: cutDate, sku_web: 2};
  const cut = {sha256_original: hash, fecha_corte: cutDate, cantidad_sku_web: 2,
    productos: {[sku]: {stock: 3, promo_centavos: 250, pvp_centavos: 287},
      [isolatedSku]: {stock: 50, promo_centavos: 1, pvp_centavos: 2}}};
  const delivery = {id: 'fixture-local', label: 'Entrega sintética', kind: 'quito_cod', city: 'Quito',
    approved: true, approvalReference: 'LOCAL_SYNTHETIC_ONLY', costCents: 290,
    postalCodes: ['000000'], allowedSkus: [sku], payments: ['cod'], minBusinessDays: 1, maxBusinessDays: 2,
    calendarApproved: true, calendarApprovalReference: 'LOCAL_SYNTHETIC_ONLY', deliveryWeekdays: [1,2,3,4,5], holidays: []};
  const configPath = join(temp, 'checkout-config.mjs');
  const configText = await readFile(configPath, 'utf8');
  assert.equal(configText.split('enabled: false').length - 1, 1);
  await writeFile(configPath, configText.replace('enabled: false', 'enabled: true')
    .replace('deliveries: []', 'deliveries: ' + JSON.stringify([delivery])));
  const originalFetch = globalThis.fetch;
  const reads = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).origin, 'https://conectatech-ec.github.io');
    assert.equal(options?.method ?? 'GET', 'GET');
    const path = new URL(url).pathname;
    reads.push(path);
    if (path === '/datos-593/estado-ultimo-corte.json') return Response.json(pointer);
    if (path === '/datos-593/corte-comercial-publico-validado.json') return Response.json(cut);
    if (path === '/exportaciones/catalogo-ventas.json') return new Response('', {status: 503});
    throw Error('Unexpected network request: ' + path);
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const actual = await import(pathToFileURL(join(temp, 'worker.mjs')).href);
  const env = {PILOT_TOKEN: randomUUID(), FREE_TIER_VERIFIED: 'true'};
  let local = sqliteObject(join(temp, 'orders.sqlite'), actual.MessengerTestInbox, env);
  t.after(() => local.db.close());
  local.db.prepare('INSERT INTO commercial_inbox VALUES (1,?,?,?,?,?,?,?)')
    .run('b'.repeat(64), 'synthetic-preserved.xlsx', 'synthetic-sealed', 'processed', Date.now(), Date.now() + 86400000, null);
  const receiverBefore = local.db.prepare('SELECT * FROM commercial_inbox').all();
  env.MESSENGER_TEST_INBOX = {idFromName: name => name, get(name) {
    assert.equal(name, 'messenger-development');
    return {fetch: (url, options) => local.box.fetch(new Request(url, options))};
  }};
  const key = join(temp, 'loopback.key'), cert = join(temp, 'loopback.crt');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', key, '-out', cert], {stdio: 'ignore'});
  const certificate = await readFile(cert);
  const server = createServer({key: await readFile(key), cert: certificate}, async (incoming, outgoing) => {
    try {
      const chunks = []; for await (const chunk of incoming) chunks.push(chunk);
      const req = new Request('https://127.0.0.1' + incoming.url, {method: incoming.method,
        headers: incoming.headers, ...(chunks.length ? {body: Buffer.concat(chunks)} : {})});
      const res = await actual.default.fetch(req, env, {});
      outgoing.writeHead(res.status, Object.fromEntries(res.headers)); outgoing.end(await res.text());
    } catch { outgoing.writeHead(500).end(); }
  });
  t.after(async () => { if (server.listening) await new Promise(resolve => server.close(resolve)); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const call = (path, {body, auth, idempotency} = {}) => new Promise((resolve, reject) => {
    const req = request({hostname: '127.0.0.1', port: server.address().port, path: '/api/compra/' + path,
      ca: certificate, method: body ? 'POST' : 'GET', headers: {Origin: CHECKOUT_CONFIG.storefrontOrigin,
        'CF-Connecting-IP': '192.0.2.1', ...(body ? {'Content-Type': 'application/json'} : {}),
        ...(auth ? {Authorization: 'Bearer ' + env.PILOT_TOKEN} : {}),
        ...(idempotency ? {'Idempotency-Key': idempotency} : {})}}, res => {
      let text = ''; res.setEncoding('utf8'); res.on('data', chunk => { text += chunk; });
      res.on('end', () => { try { resolve({status: res.statusCode, body: JSON.parse(text)}); } catch (e) { reject(e); } });
    }); req.on('error', reject); req.end(body ? JSON.stringify(body) : undefined);
  });
  const catalog = await call('catalogo');
  assert.equal(catalog.status, 200);
  assert.deepEqual(catalog.body.products.map(p => p.sku), [sku]);
  const quote = await call('cotizacion', {body: {items: [{sku, quantity: 2}], deliveryId: delivery.id, payment: 'cod', postalCode: '000000'}});
  assert.equal(quote.status, 200, JSON.stringify(quote)); assert.equal(quote.body.totalCents, 790);
  const customer = {name: 'Cliente Sintético', phone: '0000000000', email: '', city: 'Quito',
    address: 'Dirección sintética local', postalCode: '000000'};
  const options = {body: {quoteId: quote.body.quoteId, customer, consent: true}, idempotency: randomUUID()};
  const order = await call('pedidos', options);
  assert.equal(order.status, 201, JSON.stringify(order)); assert.equal(order.body.totalCents, 790);
  assert.equal(order.body.paid, false); assert.equal(order.body.stockReservedIn593, false);
  assert.equal(order.body.customer, undefined);
  const stored = local.db.prepare('SELECT * FROM checkout_orders').get();
  assert.ok(!stored.customer_sealed.includes(customer.name));
  assert.equal((await call('admin/pedidos')).status, 401);
  local.db.close(); local = sqliteObject(join(temp, 'orders.sqlite'), actual.MessengerTestInbox, env);
  const admin = await call('admin/pedidos', {auth: true});
  assert.equal(admin.status, 200); assert.equal(admin.body.orders.length, 1);
  assert.deepEqual(admin.body.orders[0].customer, customer);
  assert.deepEqual((await call('pedidos', options)).body, order.body);
  assert.equal(local.db.prepare('SELECT count(*) AS n FROM checkout_orders').get().n, 1);
  assert.deepEqual(local.db.prepare('SELECT * FROM commercial_inbox').all(), receiverBefore);
  assert.ok(reads.length > 0);
  assert.equal(CHECKOUT_CONFIG.enabled, false);
  assert.equal(digest(await readFile(join(root, 'checkout-config.mjs'))), manifest.runtime_modules[0].after_sha256);
  console.log(JSON.stringify({test: 'synthetic-local-only', https: true, actualWorker: true,
    actualExistingDO: true, actualDataHubAdapter: true, actualCipher: true,
    quote: 200, confirmation: 201, unauthorized: 401, privateQuery: 200,
    durableAfterRestart: true, deduplicated: true, isolatedSkuExcluded: true,
    receiverRowPreserved: true, remoteWrites: 0, repositoryCheckoutEnabled: false}));
});
