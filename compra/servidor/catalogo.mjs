import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

const require = createRequire(import.meta.url);
const inputs = ['index.html', 'seo-contenido.json', 'seo-pages.json',
  'importacion/editorial/publicados.json', 'datos-593/estado-ultimo-corte.json',
  'datos-593/corte-comercial-publico-validado.json'];

// Reads the existing website and its approved 593 cut. Never exports or writes inventory.
export function loadCatalog(root) {
  root = fs.realpathSync(root);
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  const html = read('index.html');
  const match = html.match(/const products=(\[[\s\S]*?\]);\s*\n/);
  if (!match) throw Error('CATALOGO_NO_DISPONIBLE');
  const products = JSON.parse(match[1]);
  const state = JSON.parse(read('datos-593/estado-ultimo-corte.json'));
  if (state.referencia !== 'datos-593/corte-comercial-publico-validado.json') throw Error('CORTE_NO_COMERCIAL');
  const cut = JSON.parse(read(state.referencia));
  require(path.join(root, 'scripts/validar-exportacion-593.cjs')).validar({products, inventoryState: state, cut});
  const seo = JSON.parse(read('seo-contenido.json'));
  const urls = JSON.parse(read('seo-pages.json'));
  const editorial = JSON.parse(read('importacion/editorial/publicados.json'));
  const titles = require(path.join(root, 'assets/editorial-titulos.js'));
  // Existing photographic reader uses cwd-relative paths. This synchronous scope
  // has no awaits and restores cwd even when its validation fails.
  const previous = process.cwd();
  let photos;
  try {
    process.chdir(root);
    photos = require(path.join(root, 'scripts/editorial-fotografia-efectiva.cjs'))(products, seo);
  } finally { process.chdir(previous); }
  const version = createHash('sha256').update(JSON.stringify({source: state.origen_sha256,
    products: products.map(p => [p.sku, p.stock, p.promo, p.pvp])})).digest('hex');
  return {cutDate: state.fecha_corte, sourceHash: state.origen_sha256, version,
    source: '593: corte publicado, no inventario en tiempo real',
    products: products.map(p => ({sku: p.sku,
      name: titles.entry(p, editorial)?.titulo || seo[p.sku]?.nombre || p.name,
      image: photos[p.sku]?.imagen || p.imageUrl || '',
      url: urls[p.sku] ? '/productos/' + urls[p.sku] + '/' : '',
      priceCents: cut.productos[p.sku].promo_centavos,
      pvpCents: cut.productos[p.sku].pvp_centavos,
      stock: cut.productos[p.sku].stock}))};
}

export function createCatalogProvider(root) {
  root = fs.realpathSync(root);
  let signature, cached;
  return () => {
    const next = inputs.map(file => { const s = fs.statSync(path.join(root, file)); return [s.size, s.mtimeMs]; });
    const key = JSON.stringify(next);
    if (key !== signature) { cached = loadCatalog(root); signature = key; }
    return structuredClone(cached);
  };
}
