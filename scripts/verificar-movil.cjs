#!/usr/bin/env node
'use strict';

// Renderiza la ficha real. No modifica contratos, catálogo, precios ni publicación.
// Dependencia: playwright y su Chromium (npx playwright install chromium).
// Ejemplo: node scripts/verificar-movil.cjs --sku MICR27 --base http://127.0.0.1:8765
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = 'https://conectatech-ec.github.io';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');

function safe(file) {
  const resolved = path.resolve(ROOT, file);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) throw new Error('Ruta fuera del repositorio: ' + file);
  return resolved;
}
function relative(file) { return path.relative(ROOT, safe(file)).split(path.sep).join('/'); }
function write(file, data) {
  const dest = safe(file); fs.mkdirSync(path.dirname(dest), {recursive: true});
  const temp = dest + '.tmp-' + process.pid; fs.writeFileSync(temp, data); fs.renameSync(temp, dest);
}
function args(argv) {
  const opt = {sku: [], base: PUBLIC, salida: 'reportes/movil-lote.json', capturas: 'reportes/movil', desktop: false};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--sku') {
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) opt.sku.push(...argv[++i].split(',').filter(Boolean));
    } else if (['--base', '--salida', '--capturas'].includes(key)) {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('Falta valor: ' + key);
      opt[key.slice(2)] = argv[++i];
    } else if (key === '--desktop') opt.desktop = true;
    else if (key === '--help') { console.log('Uso: verificar-movil.cjs --sku SKU1 SKU2 --base URL [--salida reportes/movil-lote.json] [--capturas reportes/movil] [--desktop]'); return null; }
    else throw new Error('Argumento desconocido: ' + key);
  }
  if (!opt.sku.length) throw new Error('Especifica únicamente los SKU del lote mediante --sku.');
  const base = new URL(opt.base);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('--base debe ser una URL HTTP(S) sin credenciales, consulta ni fragmento.');
  opt.base = base.href.replace(/\/$/, '');
  safe(opt.salida); safe(opt.capturas);
  return opt;
}
function playwright() {
  const explicit = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  if (explicit) {
    try { return require(path.join(explicit, 'playwright')); }
    catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  return require('playwright');
}
function money(text) {
  const match = String(text || '').match(/\$\s*([\d.,]+)/);
  if (!match) return null;
  let amount = match[1];
  const lastDot = amount.lastIndexOf('.'), lastComma = amount.lastIndexOf(',');
  if (lastComma > lastDot) amount = amount.replace(/\./g, '').replace(',', '.');
  else amount = amount.replace(/,/g, '');
  return Number.isFinite(Number(amount)) ? Math.round(Number(amount) * 100) : null;
}

async function main() {
  const opt = args(process.argv.slice(2)); if (!opt) return;
  const htmlIndex = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const match = htmlIndex.match(/const products=(\[[\s\S]*?\]);\s*\n/);
  if (!match) throw new Error('No se encontró el catálogo existente.');
  const products = new Map(JSON.parse(match[1]).map(p => [p.sku, p]));
  const load = name => JSON.parse(fs.readFileSync(path.join(ROOT, name), 'utf8'));
  const slugs = load('seo-pages.json'), seo = load('seo-contenido.json'), aliases = load('importacion/alias-sku.json');
  const report = {version: 1, fecha: new Date().toISOString(), base: opt.base,
    alcance: 'Validación técnica de navegador y captura. No certifica fidelidad fotográfica, derechos ni publicación.',
    resultados: [], errores_herramienta: []};
  let browser;
  try {
    const {chromium} = playwright();
    const executable = chromium.executablePath();
    report.motor = {nombre: 'Chromium', playwright: 'playwright', ejecutable_instalado: fs.existsSync(executable)};
    if (!fs.existsSync(executable)) throw new Error('Chromium no está instalado. Ejecutar playwright install chromium en el entorno de esta herramienta.');
    browser = await chromium.launch({headless: true, executablePath: executable});
    report.motor.version = browser.version();
    const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 1, locale: 'es-EC', reducedMotion: 'reduce'});
    context.setDefaultTimeout(15000);
    // Las fichas estáticas mantienen canonical y algunas imágenes absolutas de Pages.
    // En prueba local se renderizan esos recursos del servidor local, sin reescribir HTML.
    if (opt.base !== PUBLIC) {
      await context.route(PUBLIC + '/**', route => {
        const url = new URL(route.request().url());
        return route.continue({url: opt.base + url.pathname + url.search});
      });
    }
    const linkCache = new Map();
    async function internalStatus(url) {
      if (!linkCache.has(url)) linkCache.set(url, (async () => {
        try {
          let response = await context.request.head(url, {timeout: 15000, maxRedirects: 5});
          if ([405, 501].includes(response.status())) { await response.dispose(); response = await context.request.get(url, {timeout: 15000, maxRedirects: 5}); }
          const result = {url, http: response.status(), ok: response.ok()}; await response.dispose(); return result;
        } catch (error) { return {url, ok: false, error: error.message}; }
      })());
      return linkCache.get(url);
    }
    const seen = new Set();
    for (const raw of opt.sku) {
      const sku = aliases[raw] || raw;
      const row = {solicitado: raw, sku, estado: 'REVISAR', fecha: new Date().toISOString(), errores: [], verificaciones: {}, revision_visual_producto: 'NO_REALIZADA_POR_ESTA_HERRAMIENTA'};
      report.resultados.push(row);
      let page;
      try {
        if (!products.has(sku) || !slugs[sku]) throw new Error('SKU desconocido o sin URL estable.');
        if (seen.has(sku)) throw new Error('SKU repetido en esta ejecución.'); seen.add(sku);
        const p = products.get(sku), content = seo[sku] || {};
        const slug = slugs[sku], expectedName = content.nombre || p.name;
        const canonical = PUBLIC + '/productos/' + slug + '/';
        row.url = canonical; row.url_comprobada = opt.base + '/productos/' + slug + '/';
        row.archivo_html = relative('productos/' + slug + '/index.html');
        page = await context.newPage();
        const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
        const response = await page.goto(row.url_comprobada, {waitUntil: 'load', timeout: 45000});
        if (!response) throw new Error('La navegación no devolvió respuesta HTTP.');
        row.http = response.status(); row.sha256_html = sha(await response.body());
        row.sha256_html_local = sha(fs.readFileSync(safe(row.archivo_html)));
        try { await page.locator('img.photo').waitFor({state: 'visible', timeout: 10000}); } catch (_) { /* Se registra como error por SKU. */ }
        await page.evaluate(async () => {
          if (document.fonts && document.fonts.ready) await document.fonts.ready;
          await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => {})));
        });
        const inspect = () => page.evaluate(() => {
          const text = selector => document.querySelector(selector)?.textContent.trim() || '';
          const visible = selector => { const el = document.querySelector(selector); if (!el) return false; const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) !== 0; };
          const photo = document.querySelector('img.photo');
          const product = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).flatMap(el => { try { const value = JSON.parse(el.textContent); return Array.isArray(value) ? value : value['@graph'] || [value]; } catch (_) { return []; } }).find(x => x['@type'] === 'Product');
          const price = document.querySelector('.price'), pvp = document.querySelector('.pvp');
          return {ancho_viewport: window.innerWidth, ancho_documento: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
            titulo: text('h1'), titulo_visible: visible('h1'), sku_visible: text('.sku'), precio: text('.price'), pvp: text('.pvp'),
            precio_visible: visible('.price'), pvp_visible: visible('.pvp'), etiqueta_contado: text('.promo-label'),
            promo_tamano: price ? parseFloat(getComputedStyle(price).fontSize) : 0, pvp_tamano: pvp ? parseFloat(getComputedStyle(pvp).fontSize) : 0,
            pvp_tachado: pvp ? [pvp, ...pvp.querySelectorAll('*')].some(el => getComputedStyle(el).textDecorationLine.includes('line-through') || ['S', 'DEL', 'STRIKE'].includes(el.tagName)) : null,
            canonical: document.querySelector('link[rel="canonical"]')?.href || '', schema: product || null,
            imagen: photo ? {src: photo.getAttribute('src'), url_cargada: photo.currentSrc, naturalWidth: photo.naturalWidth, naturalHeight: photo.naturalHeight, completa: photo.complete, visible: visible('img.photo')} : null,
            enlaces: Array.from(document.querySelectorAll('a[href],link[href]')).map(el => el.getAttribute('href')),
            imagenes_fallidas: Array.from(document.images).filter(im => !im.complete || im.naturalWidth === 0).map(im => im.getAttribute('src'))};
        });
        const data = await inspect(); Object.assign(row, {ancho_viewport: data.ancho_viewport, ancho_documento: data.ancho_documento, alto_viewport: 844, imagen: data.imagen});
        const check = (key, ok, detail) => { row.verificaciones[key] = Boolean(ok); if (!ok) row.errores.push(detail); };
        check('http', row.http === 200, 'Ficha HTTP ' + row.http);
        check('html_coincide_local', row.sha256_html === row.sha256_html_local, 'HTML servido distinto del archivo local de revisión.');
        check('sin_desbordamiento_horizontal', data.ancho_documento <= data.ancho_viewport, 'Desbordamiento horizontal: ' + data.ancho_documento + '/' + data.ancho_viewport);
        check('titulo', data.titulo_visible && data.titulo === expectedName && data.schema?.name === expectedName, 'Título visible/schema distinto de la ficha local.');
        check('sku', new RegExp('(^|[^A-Z0-9])' + sku + '([^A-Z0-9]|$)').test(data.sku_visible) && data.schema?.sku === sku, 'SKU visible/schema incorrecto.');
        check('canonical', data.canonical === canonical, 'Canonical distinto de la URL estable.');
        check('promo_contado', data.precio_visible && money(data.precio) === Math.round(p.promo * 100) && Math.round(Number(data.schema?.offers?.price) * 100) === Math.round(p.promo * 100) && data.schema?.offers?.priceCurrency === 'USD', 'Promo contado visible/schema distinta del catálogo.');
        check('pvp', data.pvp_visible && money(data.pvp) === Math.round(p.pvp * 100), 'PVP visible distinto del catálogo.');
        check('jerarquia_precio', /PROMO\s+CONTADO/i.test(data.etiqueta_contado) && data.promo_tamano > data.pvp_tamano && data.pvp_tachado === false, 'Promo contado sin jerarquía o PVP tachado.');
        check('disponibilidad', data.schema?.offers?.availability === 'https://schema.org/' + (p.stock > 0 ? 'InStock' : 'OutOfStock'), 'Disponibilidad schema distinta del último catálogo local.');
        const expectedImage = content.imagen || p.imageUrl;
        const sameImage = expectedImage && data.imagen?.src && new URL(data.imagen.src, canonical).href === new URL(expectedImage, PUBLIC).href;
        check('imagen_principal', sameImage && data.imagen?.completa && data.imagen.naturalWidth > 0 && data.imagen.naturalHeight > 0 && data.imagen.visible, 'Portada ausente, incorrecta o no cargada.');
        check('imagenes_cargadas', data.imagenes_fallidas.length === 0, 'Imágenes sin cargar: ' + data.imagenes_fallidas.join(', '));
        check('javascript', pageErrors.length === 0, 'Errores JavaScript: ' + pageErrors.join('; '));
        if (content.beneficios?.length) {
          const actual = await page.locator('.benefit').evaluateAll(els => els.map(e => ({valor:e.querySelector('strong')?.textContent,titulo:e.querySelector('span')?.textContent,descripcion:e.querySelector('p')?.textContent})));
          check('beneficios_verificados', JSON.stringify(actual) === JSON.stringify(content.beneficios), 'Beneficios no coinciden con el contenido revisado.');
          const accordion = page.locator('#especificaciones');
          check('detalles_cerrados', await accordion.getAttribute('open') === null, 'Especificaciones deben comenzar recogidas.');
          await accordion.locator('summary').focus(); await page.keyboard.press('Enter');
          check('detalles_accesibles', await accordion.getAttribute('open') !== null && await accordion.locator('dl').isVisible(), 'Especificaciones no se abren con teclado.');
          await page.keyboard.press('Enter');
          await page.evaluate(() => window.scrollTo(0,0));
        }
        const internal = new Set(); const syntaxErrors = [];
        for (const href of data.enlaces) {
          if (!href || href.startsWith('#') || /^(mailto:|tel:)/i.test(href)) continue;
          try {
            const u = new URL(href, canonical);
            if (!['http:', 'https:'].includes(u.protocol)) { syntaxErrors.push(href); continue; }
            if ([new URL(PUBLIC).origin, new URL(opt.base).origin].includes(u.origin)) internal.add(opt.base + u.pathname + u.search);
            if (u.hostname === 'wa.me' && !/^\/[1-9][0-9]{7,14}$/.test(u.pathname)) syntaxErrors.push(href);
          } catch (_) { syntaxErrors.push(href); }
        }
        row.enlaces_internos = [];
        for (const url of internal) row.enlaces_internos.push(await internalStatus(url));
        check('enlaces_internos', syntaxErrors.length === 0 && row.enlaces_internos.every(link => link.ok), 'Enlaces inválidos o internos no disponibles: ' + [...syntaxErrors, ...row.enlaces_internos.filter(x => !x.ok).map(x => x.url)].join(', '));
        row.archivo = relative(path.join(opt.capturas, sku + '-390.png'));
        fs.mkdirSync(path.dirname(safe(row.archivo)), {recursive: true});
        row.sha256 = sha(await page.screenshot({path: safe(row.archivo), fullPage: true, animations: 'disabled'}));
        if (opt.desktop) {
          await page.setViewportSize({width: 1280, height: 900});
          await page.evaluate(async () => { await Promise.all(Array.from(document.images).map(im => im.decode().catch(() => {}))); });
          const desk = await inspect(), file = relative(path.join(opt.capturas, sku + '-1280.png'));
          row.escritorio = {ancho_viewport: 1280, ancho_documento: desk.ancho_documento, archivo: file,
            sha256: sha(await page.screenshot({path: safe(file), fullPage: true, animations: 'disabled'})),
            sin_desbordamiento_horizontal: desk.ancho_documento <= 1280, imagen_cargada: Boolean(desk.imagen?.completa && desk.imagen?.naturalWidth > 0)};
          check('escritorio', row.escritorio.sin_desbordamiento_horizontal && row.escritorio.imagen_cargada, 'Verificación de escritorio fallida.');
        }
        row.estado = row.errores.length ? 'REVISAR' : 'VERIFICADO';
      } catch (error) { row.errores.push(error.message); }
      finally { if (page) await page.close(); }
    }
    await context.close();
  } catch (error) { report.errores_herramienta.push(error.message); }
  finally { if (browser) await browser.close(); }
  report.resumen = {solicitados: opt.sku.length, comprobados: report.resultados.length,
    sin_comprobar: opt.sku.length - report.resultados.length,
    verificados: report.resultados.filter(row => row.estado === 'VERIFICADO').length,
    revisar: report.resultados.filter(row => row.estado !== 'VERIFICADO').length, errores_herramienta: report.errores_herramienta.length};
  write(opt.salida, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({...report.resumen, reporte: relative(opt.salida),
    diagnostico: report.errores_herramienta.map(message => message.split('\n').filter(line => /Operation not permitted|not installed|no está instalado/.test(line)).slice(0, 2).join(' ') || message.split('\n')[0])}));
  if (report.resumen.revisar || report.errores_herramienta.length) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
