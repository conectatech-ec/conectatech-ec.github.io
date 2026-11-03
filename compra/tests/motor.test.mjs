import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createCheckout, createFileLedger, TEST_DELIVERIES} from '../servidor/motor.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const customer = {name: 'Cliente Prueba', phone: '0000000000', email: 'compra@example.test', address: 'Dirección ficticia 123', city: 'Quito'};
const base = () => ({cutDate: '2026-11-02', sourceHash: 'a'.repeat(64), version: 'v1',
  products: [{sku: 'VENT009', name: 'Ventilador', image: '/imagenes/vent009.webp', url: '/productos/vent009/', stock: 3, priceCents: 3748}]});
const request = {items: [{sku: 'VENT009', quantity: 2}], deliveryId: 'quito-prueba', payment: 'cod'};
async function setup(t, options = {}) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ct-order-unit-'));
  t.after(() => fs.rm(temp, {recursive: true, force: true}));
  const filename = path.join(temp, 'orders.json');
  const data = base();
  const ledger = createFileLedger(filename, {repoRoot: root});
  const engine = createCheckout({catalogProvider: () => data, ledger, deliveries: TEST_DELIVERIES, mode: 'test', ...options});
  return {engine, data, ledger, filename};
}
const confirm = q => ({quoteId: q.quoteId, customer, consent: true});
const code = expected => error => error.code === expected;

test('total exacto en centavos y registro durable identificados como prueba', async t => {
  const {engine, filename} = await setup(t);
  const q = await engine.quote(request);
  assert.equal(q.subtotalCents, 7496);
  assert.equal(q.shippingCents, 290);
  assert.equal(q.totalCents, 7786);
  const r = await engine.confirm(confirm(q), 'test-key-00000001');
  assert.match(r.id, /^PRUEBA-/);
  assert.equal(r.mode, 'test');
  assert.equal(r.liveOrder, false);
  assert.equal(r.paid, false);
  assert.equal(r.stockReservedIn593, false);
  assert.match(r.estimatedDelivery, /PRUEBA/);
  const saved = JSON.parse(await fs.readFile(filename));
  assert.deepEqual(saved.orders[0].receipt, r);
  assert.equal((await fs.stat(filename)).mode & 0o777, 0o600);
});

test('rechaza precio y envío inyectados por el cliente', async t => {
  const {engine} = await setup(t);
  await assert.rejects(engine.quote({...request, totalCents: 1}), code('COTIZACION_INVALIDA'));
  await assert.rejects(engine.quote({...request, items: [{sku: 'VENT009', quantity: 1, priceCents: 1}]}), code('CANTIDAD_INVALIDA'));
});

test('rechaza cantidades negativas, fraccionarias, cero, texto y SKU duplicado', async t => {
  const {engine} = await setup(t);
  for (const quantity of [-1, 0, 0.5, '2', 100]) {
    await assert.rejects(engine.quote({...request, items: [{sku: 'VENT009', quantity}]}), code('CANTIDAD_INVALIDA'));
  }
  await assert.rejects(engine.quote({...request, items: [{sku: 'VENT009', quantity: 1}, {sku: 'VENT009', quantity: 1}]}), code('CANTIDAD_INVALIDA'));
});

test('rechaza SKU desconocido, agotado y cantidad superior al corte', async t => {
  const {engine, data} = await setup(t);
  await assert.rejects(engine.quote({...request, items: [{sku: 'FALSO', quantity: 1}]}), code('PRODUCTO_DESCONOCIDO'));
  await assert.rejects(engine.quote({...request, items: [{sku: 'VENT009', quantity: 4}]}), code('CANTIDAD_NO_DISPONIBLE'));
  data.products[0].stock = 0;
  await assert.rejects(engine.quote(request), code('CANTIDAD_NO_DISPONIBLE'));
});

test('envío desconocido no se convierte en envío gratis', async t => {
  const {engine} = await setup(t);
  await assert.rejects(engine.quote({...request, deliveryId: 'envio-nacional'}), code('ENVIO_NO_CONFIGURADO'));
  await assert.rejects(engine.quote({...request, deliveryId: ''}), code('ENVIO_NO_CONFIGURADO'));
});

test('envío sin tarifa, ciudad o plazo se bloquea', async t => {
  for (const change of [{costCents: null}, {eta: ''}, {city: null}]) {
    const {engine} = await setup(t, {deliveries: [{...TEST_DELIVERIES[0], ...change}]});
    await assert.rejects(engine.quote(request), code('ENVIO_NO_CONFIGURADO'));
  }
});

test('transferencia bancaria no se habilita por cambiar un campo', async t => {
  const {engine} = await setup(t, {deliveries: [{...TEST_DELIVERIES[0], payments: ['cod', 'transfer']}]});
  await assert.rejects(engine.quote({...request, payment: 'transfer'}), code('TRANSFERENCIA_PENDIENTE_CONFIGURACION'));
});

test('revalida stock y precio al confirmar, sin aceptar cambio silencioso', async t => {
  const {engine, data} = await setup(t);
  const q = await engine.quote(request);
  data.products[0].stock = 1;
  await assert.rejects(engine.confirm(confirm(q), 'test-key-00000002'), code('CANTIDAD_NO_DISPONIBLE'));
  data.products[0].stock = 3;
  data.products[0].priceCents = 3800;
  await assert.rejects(engine.confirm(confirm(q), 'test-key-00000002'), code('PRECIO_CAMBIO_COTIZAR_NUEVAMENTE'));
});

test('un corte nuevo obliga a mostrar y aceptar una cotización nueva', async t => {
  const {engine, data} = await setup(t);
  const q = await engine.quote(request);
  data.sourceHash = 'b'.repeat(64);
  await assert.rejects(engine.confirm(confirm(q), 'test-key-00000003'), code('CATALOGO_CAMBIO_COTIZAR_NUEVAMENTE'));
});

test('consentimiento, cliente, clave y destino se validan antes de registrar', async t => {
  const {engine} = await setup(t);
  const q = await engine.quote(request);
  await assert.rejects(engine.confirm({...confirm(q), consent: false}, 'test-key-00000004'), code('CONFIRMACION_INVALIDA'));
  await assert.rejects(engine.confirm({...confirm(q), customer: {...customer, address: ''}}, 'test-key-00000004'), code('DATOS_ENTREGA_INVALIDOS'));
  await assert.rejects(engine.confirm({...confirm(q), customer: {...customer, city: 'Guayaquil'}}, 'test-key-00000004'), code('DESTINO_NO_COTIZADO'));
  await assert.rejects(engine.confirm(confirm(q), 'short'), code('CLAVE_REINTENTO_INVALIDA'));
});

test('reintentos concurrentes con una clave generan exactamente un pedido', async t => {
  const {engine, filename} = await setup(t);
  const q = await engine.quote(request);
  const results = await Promise.all([engine.confirm(confirm(q), 'test-key-00000005'), engine.confirm(confirm(q), 'test-key-00000005')]);
  assert.deepEqual(results[0], results[1]);
  assert.equal(JSON.parse(await fs.readFile(filename)).orders.length, 1);
  await assert.rejects(engine.confirm({...confirm(q), customer: {...customer, name: 'Otro Cliente'}}, 'test-key-00000005'), code('CLAVE_REINTENTO_CONFLICTO'));
  await assert.rejects(engine.confirm(confirm(q), 'test-key-00000006'), code('COTIZACION_YA_CONFIRMADA'));
});

test('dos compradores concurrentes no consumen dos veces el stock de prueba', async t => {
  const {engine, data, filename} = await setup(t);
  data.products[0].stock = 1;
  const input = {...request, items: [{sku: 'VENT009', quantity: 1}]};
  const [q1, q2] = await Promise.all([engine.quote(input), engine.quote(input)]);
  const results = await Promise.allSettled([engine.confirm(confirm(q1), 'test-key-00000007'), engine.confirm(confirm(q2), 'test-key-00000008')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'CANTIDAD_NO_DISPONIBLE');
  assert.equal(JSON.parse(await fs.readFile(filename)).orders.length, 1);
});

test('el reintento tras reiniciar recupera el mismo recibo durable', async t => {
  const {engine, data, filename} = await setup(t);
  const q = await engine.quote(request);
  const original = await engine.confirm(confirm(q), 'test-key-00000009');
  const restarted = createCheckout({catalogProvider: () => data, ledger: createFileLedger(filename, {repoRoot: root}), deliveries: TEST_DELIVERIES, mode: 'test'});
  assert.deepEqual(await restarted.confirm(confirm(q), 'test-key-00000009'), original);
});

test('una cotización vencida nunca se confirma', async t => {
  let now = Date.now();
  const {engine} = await setup(t, {clock: () => now, quoteTtlMs: 1000});
  const q = await engine.quote(request);
  now += 1001;
  await assert.rejects(engine.confirm(confirm(q), 'test-key-00000010'), code('COTIZACION_VENCIDA'));
});

test('fallo de persistencia no devuelve pedido exitoso', async t => {
  const {engine} = await setup(t, {ledger: {mode: 'test', transaction: async () => { throw Error('DISCO_NO_DISPONIBLE'); }}});
  const q = await engine.quote(request);
  await assert.rejects(engine.confirm(confirm(q), 'test-key-00000011'), /DISCO_NO_DISPONIBLE/);
});

test('registro bajo repositorio o a través de symlink se bloquea', async t => {
  assert.throws(() => createFileLedger(path.join(root, 'compra/orders.json'), {repoRoot: root}), /REGISTRO_NO_PUEDE_ESTAR/);
  const {filename} = await setup(t);
  const link = path.join(path.dirname(filename), 'repo-link');
  await fs.symlink(root, link);
  const ledger = createFileLedger(path.join(link, 'orders.json'), {repoRoot: root});
  await assert.rejects(ledger.transaction(() => {}), /REGISTRO_NO_PUEDE_ESTAR/);
});

test('producción y configuración ausente permanecen cerradas', async t => {
  for (const mode of ['disabled', 'production']) {
    const {engine} = await setup(t, {mode});
    assert.deepEqual((await engine.catalog()).deliveries, []);
    await assert.rejects(engine.quote(request), code('COMPRA_NO_HABILITADA'));
  }
  const {engine} = await setup(t, {ledger: undefined});
  await assert.rejects(engine.quote(request), code('COMPRA_NO_HABILITADA'));
});

test('el cliente no modifica una cotización cambiando la respuesta recibida', async t => {
  const {engine} = await setup(t);
  const q = await engine.quote(request);
  q.items[0].quantity = 1; q.totalCents = 1; q.shippingCents = 0;
  const r = await engine.confirm(confirm(q), 'test-key-00000012');
  assert.equal(r.totalCents, 7786);
  assert.equal(r.items[0].quantity, 2);
});

test('lista explícita de envíos limita los SKU elegibles sin inferir peso', async t => {
  const {engine} = await setup(t, {deliveries: [{...TEST_DELIVERIES[0], allowedSkus: []}]});
  await assert.rejects(engine.quote(request), code('ENVIO_NO_APROBADO_PARA_PRODUCTO'));
});

test('correo opcional: vacío válido; si se proporciona debe tener formato válido', async t => {
  const {engine} = await setup(t);
  const q = await engine.quote(request);
  await assert.rejects(engine.confirm({...confirm(q), customer: {...customer, email: 'invalido'}}, 'test-key-00000013'), code('DATOS_ENTREGA_INVALIDOS'));
  const r = await engine.confirm({...confirm(q), customer: {...customer, email: ''}}, 'test-key-00000013');
  assert.equal(r.customer.email, '');
});
