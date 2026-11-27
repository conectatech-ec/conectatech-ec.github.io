import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runPrivateCheckout, handleCheckoutAdmin, handleCheckoutPublic} from '../checkout-entry.mjs';
import {seal, unseal} from '../messenger-control.mjs';
import {CHECKOUT_CONFIG} from '../checkout-config.mjs';

async function fixture(t) {
  const folder = await mkdtemp(join(tmpdir(), 'checkout-private-new-'));
  let db;
  const box = {name: 'messenger-development', env: {
    FREE_TIER_VERIFIED: 'true', PILOT_TOKEN: 'synthetic-local-only-never-deployed'
  }, state: {storage: {}}};
  function open() {
    db = new DatabaseSync(join(folder, 'test.sqlite'));
    box.sql = {exec(sql, ...args) {const rows = db.prepare(sql).all(...args); return {toArray: () => rows};}};
    box.state.storage.transactionSync = fn => {
      db.exec('BEGIN IMMEDIATE');
      try {const value = fn(); db.exec('COMMIT'); return value;}
      catch (error) {db.exec('ROLLBACK'); throw error;}
    };
  }
  open();
  t.after(async () => {db.close(); await rm(folder, {recursive: true});});
  const deps = {clock: () => Date.parse('2026-11-19T04:00:00Z'), seal, unseal,
    sourceProvider: async () => ({sourceHash: 'a'.repeat(64), version: 'b'.repeat(64),
      cutDate: '2026-11-18', sourceGeneratedAt: '2026-11-19T03:00:00Z',
      sourceTimestampBasis: 'original_workbook_core', products: [{sku: 'ADAP004', name: 'Producto sintético',
        stock: 3, priceCents: 350, pvpCents: 402, url: 'https://conectatech-ec.github.io/productos/prueba/',
        image: 'https://conectatech-ec.github.io/imagenes/prueba.webp'}]})};
  const call = action => runPrivateCheckout('/web-checkout/private-test/' + action,
    new Request('https://inbox/', {method: 'POST'}), box, deps);
  return {box, deps, call, rows: sql => db.prepare(sql).all(), restart() {db.close(); open();}};
}

test('nueva ruta privada exige autenticación y compra pública conserva cierre', async () => {
  assert.equal(CHECKOUT_CONFIG.enabled, false);
  assert.deepEqual(CHECKOUT_CONFIG.deliveries, []);
  const privateResponse = await handleCheckoutAdmin(new Request('https://example.test/api/compra/admin/prueba', {method: 'POST'}), {});
  assert.equal(privateResponse.status, 401);
  const publicResponse = await handleCheckoutPublic(new Request('https://example.test/api/compra/catalogo', {
    headers: {Origin: 'https://conectatech-ec.github.io'}}), {});
  assert.equal(publicResponse.status, 503);
});

test('nuevo recorrido privado crea exactamente un sintético, cancela y verifica tras otra solicitud/reinicio', async t => {
  const s = await fixture(t);
  const response = await s.call('run');
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.quote, 200);
  assert.equal(result.confirm, 201);
  assert.equal(result.totalCents, 850);
  assert.equal(result.allocation, 'cancelled');
  assert.equal(result.duplicatePrevented, true);
  const stored = s.rows('SELECT receipt, customer_sealed FROM checkout_orders')[0];
  assert.equal(JSON.parse(stored.receipt).liveOrder, false);
  assert.equal(JSON.parse(stored.receipt).syntheticTest, true);
  assert.ok(!stored.customer_sealed.includes('Cliente sintético'));
  s.restart();
  const verification = await s.call('verify');
  assert.equal(verification.status, 200, JSON.stringify(await verification.clone().json()));
  assert.equal((await verification.json()).verifiedInSeparateRequest, true);
  assert.equal((await s.call('run')).status, 409);
  assert.equal(s.rows('SELECT count(*) AS n FROM checkout_orders')[0].n, 1);
});

test('fuente caducada bloquea antes de crear tablas y no se sustituye por fixture remoto', async t => {
  const s = await fixture(t);
  const getSource = s.deps.sourceProvider;
  s.deps.sourceProvider = async () => ({...await getSource(), sourceGeneratedAt: '2026-11-17T03:00:00Z'});
  const response = await s.call('run');
  assert.equal((await response.json()).error, 'FUENTE_PRUEBA_NO_VIGENTE');
  assert.equal(s.rows("SELECT name FROM sqlite_master WHERE name LIKE 'checkout_%'").length, 0);
});

test('caducidad del acceso privado cierra el ensayo sin escribir', async t => {
  const s = await fixture(t);
  s.deps.clock = () => Date.parse('2026-11-26T04:27:09Z');
  assert.equal((await s.call('run')).status, 503);
  assert.equal(s.rows("SELECT name FROM sqlite_master WHERE name LIKE 'checkout_%'").length, 0);
});
