#!/usr/bin/env node
'use strict';

// QA de catálogo real; solo produce evidencia. No publica ni modifica datos.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = 'https://conectatech-ec.github.io';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const safe = file => { const p = path.resolve(ROOT, file); if (!p.startsWith(ROOT + path.sep)) throw new Error('Ruta fuera del repositorio'); return p; };
const rel = file => path.relative(ROOT, safe(file)).split(path.sep).join('/');
const write = (file, content) => { const p = safe(file); fs.mkdirSync(path.dirname(p), {recursive: true}); fs.writeFileSync(p, content); };
const equals = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function options(argv) {
  const opt = {sku: [], base: 'http://127.0.0.1:8765', salida: 'reportes/catalogo-lote-activo.json', capturas: 'reportes/catalogo'};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--sku') while (argv[i + 1] && !argv[i + 1].startsWith('--')) opt.sku.push(...argv[++i].split(',').filter(Boolean));
    else if (['--base', '--salida', '--capturas'].includes(key)) {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('Falta valor de ' + key);
      opt[key.slice(2)] = argv[++i];
    } else if (key === '--help') { console.log('Uso: verificar-catalogo.cjs --sku SKU1 SKU2 --base URL [--salida reporte.json] [--capturas reportes/catalogo]'); return null; }
    else throw new Error('Argumento desconocido: ' + key);
  }
  const base = new URL(opt.base);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('Base HTTP(S) inválida.');
  opt.base = base.href.replace(/\/$/, '');
  if (!opt.sku.length || opt.sku.some(sku => !/^[A-Z0-9]+$/.test(sku))) throw new Error('Indicar SKU exactos mediante --sku.');
  safe(opt.salida); safe(opt.capturas); return opt;
}
function money(value) {
  const match = String(value).match(/\$\s*([\d.,]+)/); if (!match) return null;
  let amount = match[1];
  amount = amount.lastIndexOf(',') > amount.lastIndexOf('.') ? amount.replace(/\./g, '').replace(',', '.') : amount.replace(/,/g, '');
  return Math.round(Number(amount) * 100);
}
function variants(value, base) {
  return String(value || '').split(',').filter(Boolean).map(part => {
    const [url, width] = part.trim().split(/\s+/); return {url: new URL(url, base).href, ancho: Number((width || '').replace(/w$/, ''))};
  }).sort((a, b) => a.ancho - b.ancho);
}

async function main() {
  const opt = options(process.argv.slice(2)); if (!opt) return;
  const index = fs.readFileSync(safe('index.html'), 'utf8');
  const products = JSON.parse(index.match(/const products=(\[[\s\S]*?\]);\s*\n/)[1]);
  const bySku = new Map(products.map(p => [p.sku, p]));
  const aliases = JSON.parse(fs.readFileSync(safe('importacion/alias-sku.json')));
  const skus = [...new Set(opt.sku.map(sku => aliases[sku] || sku))];
  const slugs = JSON.parse(fs.readFileSync(safe('seo-pages.json')));
  const enriched = JSON.parse(fs.readFileSync(safe('seo-contenido.json')));
  const familyMatch = index.match(/const categoryFamilies=(\{[^\n]+\});/);
  const families = familyMatch ? JSON.parse(familyMatch[1]) : {};
  const category = p => p.categoriaComercial || families[p.category] || 'Hogar y Accesorios';
  const inStock = products.filter(p => p.stock > 0);
  const pageSize = Number(index.match(/(?:const|let) pageSize\s*=\s*(\d+)/)?.[1] || 24);
  const report = {version: 1, fecha: new Date().toISOString(), base: opt.base, sku_solicitados: skus,
    alcance: 'Renderizado real, navegación y datos del catálogo; no certifica fidelidad visual del producto ni publicación.',
    resultados: [], recursos: [], advertencias_ajenas_al_lote: [], errores_herramienta: []};
  let browser;
  try {
    let pw;
    try { pw = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '', 'playwright')); }
    catch (_) { pw = require('playwright'); }
    const executablePath = pw.chromium.executablePath();
    if (!fs.existsSync(executablePath)) throw new Error('Chromium no instalado.');
    browser = await pw.chromium.launch({headless: true, executablePath});
    report.motor = {nombre: 'Chromium', version: browser.version()};
    const context = await browser.newContext({locale: 'es-EC', deviceScaleFactor: 1, reducedMotion: 'reduce'});
    context.setDefaultTimeout(15000);
    if (opt.base !== PUBLIC) await context.route(PUBLIC + '/**', route => { const u = new URL(route.request().url()); return route.continue({url: opt.base + u.pathname + u.search}); });
    const fetched = new Map();
    async function resource(url, relativeFile) {
      const key = url + '\0' + relativeFile;
      if (!fetched.has(key)) fetched.set(key, (async () => {
        const record = {url, archivo_local: relativeFile, ok: false};
        try {
          const response = await context.request.get(url, {timeout: 30000});
          const body = await response.body(); record.http = response.status(); record.sha256 = sha(body);
          record.sha256_local = sha(fs.readFileSync(safe(relativeFile)));
          record.ok = response.status() === 200 && record.sha256 === record.sha256_local;
          await response.dispose();
        } catch (error) { record.error = error.message; }
        report.recursos.push(record); return record;
      })());
      return fetched.get(key);
    }
    for (const width of [1280, 390]) {
      const row = {ancho_viewport: width, alto_viewport: 900, estado: 'REVISAR', verificaciones: {}, errores: [], productos: []};
      report.resultados.push(row);
      const check = (name, ok, detail) => { row.verificaciones[name] = Boolean(ok); if (!ok) row.errores.push(detail); };
      const page = await context.newPage(); await page.setViewportSize({width, height: 900});
      try {
        const response = await page.goto(opt.base + '/', {waitUntil: 'load', timeout: 45000});
        row.http = response?.status(); row.sha256_html = response ? sha(await response.body()) : null;
        check('html_exacto', row.http === 200 && row.sha256_html === sha(Buffer.from(index)), 'HTML servido no corresponde al candidato local.');
        await page.locator('#grid .ct-compact-card').first().waitFor();
        await page.locator('#catalogSort').waitFor();
        const payload = await page.evaluate(() => window.CONECTATECH_CATALOGO || null);
        check('metadatos_publicados', Boolean(payload && payload.productos), 'Falta payload de productos publicados.');
        if (!payload?.productos) throw new Error('No se pueden comprobar novedades sin metadatos.');
        const assets = await page.evaluate(() => Array.from(document.querySelectorAll('script[src],link[rel="stylesheet"]')).map(el => el.getAttribute('src') || el.getAttribute('href')));
        for (const value of assets) {
          const u = new URL(value, PUBLIC);
          if (u.origin !== PUBLIC) continue;
          const file = decodeURIComponent(u.pathname).replace(/^\//, '');
          const result = await resource(opt.base + u.pathname + u.search, file);
          check('recurso:' + file, result.ok, 'Recurso servido distinto o inaccesible: ' + file);
        }
        check('payload_enlazado', assets.some(value => new URL(value, PUBLIC).pathname === '/assets/catalogo-publicado.js'), 'No se carga assets/catalogo-publicado.js.');
        const ids = () => page.locator('#grid .ct-compact-card').evaluateAll(cards => cards.map(card => card.dataset.sku));
        const snapshot = () => page.locator('#grid').evaluate(grid => {
          const cs = getComputedStyle(grid), bounds = grid.getBoundingClientRect();
          return {columnas: cs.gridTemplateColumns.trim().split(/\s+/).length, ancho: bounds.width, scrollWidth: grid.scrollWidth,
            ancho_documento: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
            tarjetas: Array.from(grid.querySelectorAll('.ct-compact-card')).map(card => {
              const r = card.getBoundingClientRect(), image = card.querySelector('.product-img img'), promo = card.querySelector('.promo'), pvp = card.querySelector('.pvp'), title = card.querySelector('.name');
              const anchor = element => element?.closest('a')?.getAttribute('href') || element?.querySelector('a')?.getAttribute('href') || null;
              const detail = Array.from(card.querySelectorAll('a')).find(a => /Ver detalles/i.test(a.textContent));
              return {sku: card.dataset.sku, actualizado: card.dataset.actualizado || '', altura: r.height, ancho: r.width,
                titulo: title?.textContent.trim(), categoria: card.querySelector('.cat')?.textContent.trim(),
                promo: promo?.textContent, pvp: pvp?.textContent, promo_px: promo ? parseFloat(getComputedStyle(promo).fontSize) : 0,
                pvp_px: pvp ? parseFloat(getComputedStyle(pvp).fontSize) : 0,
                pvp_tachado: pvp ? [pvp, ...pvp.querySelectorAll('*')].some(el => getComputedStyle(el).textDecorationLine.includes('line-through') || ['DEL', 'S', 'STRIKE'].includes(el.tagName)) : null,
                contenido_largo: Array.from(card.querySelectorAll('.specs,.spec,.stock,.description,.descripcion,.desc,ul,ol,dl')).map(el => el.className || el.tagName),
                enlaces: {imagen: anchor(image || card.querySelector('.product-img')), titulo: anchor(title), detalles: detail?.getAttribute('href') || null},
                imagen: image ? {src: image.getAttribute('src'), srcset: image.getAttribute('srcset'), cargada: image.complete && image.naturalWidth > 0,
                  naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, actual: image.currentSrc, ajuste: getComputedStyle(image).objectFit} : null};
            })};
        });
        const order = mode => {
          const list = inStock.slice();
          if (mode === 'recientes') list.sort((a, b) => (Date.parse(payload.productos[b.sku]?.actualizadoEn || '') || 0) - (Date.parse(payload.productos[a.sku]?.actualizadoEn || '') || 0));
          if (mode === 'nombre') list.sort((a, b) => a.name.localeCompare(b.name, 'es', {sensitivity: 'base', numeric: true}));
          if (mode === 'precio-asc') list.sort((a, b) => a.promo - b.promo);
          if (mode === 'precio-desc') list.sort((a, b) => b.promo - a.promo);
          return list;
        };
        const defaultMode = payload.ordenPredeterminado || 'recientes';
        check('orden_inicial', await page.locator('#catalogSort').inputValue() === defaultMode && equals(await ids(), order(defaultMode).slice(0, pageSize).map(p => p.sku)), 'Orden inicial distinto de las novedades publicadas.');
        row.ordenes = {};
        for (const mode of ['recientes', 'catalogo', 'nombre', 'precio-asc', 'precio-desc']) {
          await page.locator('#catalogSort').selectOption(mode);
          const actual = await ids(), expected = order(mode).slice(0, pageSize).map(p => p.sku);
          row.ordenes[mode] = actual; check('orden:' + mode, equals(actual, expected), 'Orden incorrecto: ' + mode);
        }
        await page.locator('#catalogSort').selectOption('recientes');
        const initial = await snapshot(); row.diseno = initial;
        check('columnas', initial.columnas === (width === 1280 ? 5 : 2), 'Número de columnas incorrecto: ' + initial.columnas);
        check('sin_desbordamiento_catalogo', initial.scrollWidth <= Math.ceil(initial.ancho) + 1, 'El grid presenta desbordamiento horizontal.');
        check('tarjetas_compactas', initial.tarjetas.every(card => card.altura <= 410 && card.altura > 0 && !card.contenido_largo.length), 'Tarjeta supera410px o contiene ficha técnica/stock/descripción extensa.');
        check('precios_tarjetas', initial.tarjetas.every(card => { const p = bySku.get(card.sku); return p && money(card.promo) === Math.round(p.promo * 100) && money(card.pvp) === Math.round(p.pvp * 100) && card.promo_px > card.pvp_px && card.pvp_tachado === false; }), 'Precios o jerarquía incorrectos en tarjetas.');
        check('enlaces_tarjetas', initial.tarjetas.every(card => Object.values(card.enlaces).every(href => href && new URL(href, PUBLIC).href === PUBLIC + '/productos/' + slugs[card.sku] + '/')), 'Imagen, título o Ver detalles no enlazan a ficha estable.');
        if (initial.ancho_documento > width) report.advertencias_ajenas_al_lote.push({ancho: width, motivo: 'Ancho total del documento supera viewport; revisar zonas ajenas al grid.', ancho_documento: initial.ancho_documento});
        // Captura recortada real del grid, sin montar tarjetas ni dibujar una simulación.
        await page.locator('#grid').evaluate(grid => {
          grid.scrollIntoView({block: 'start'});
          const header = document.querySelector('header');
          const position = header ? getComputedStyle(header).position : '';
          const clearance = ['sticky', 'fixed'].includes(position) ? header.getBoundingClientRect().height + 12 : 0;
          if (clearance) window.scrollBy(0, grid.getBoundingClientRect().top - clearance);
        });
        await page.waitForFunction(() => Array.from(document.querySelectorAll('#grid img')).filter(im => { const r = im.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }).every(im => im.complete), null, {timeout: 15000}).catch(() => {});
        const box = await page.locator('#grid').boundingBox();
        const clip = {x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(box.width, width - Math.max(0, box.x)), height: Math.min(box.height, 880 - Math.max(0, box.y))};
        const file = rel(path.join(opt.capturas, 'catalogo-' + width + '.png')); fs.mkdirSync(path.dirname(safe(file)), {recursive: true});
        row.captura = {archivo: file, sha256: sha(await page.screenshot({path: safe(file), clip, animations: 'disabled'})), recorte: clip};
        if (inStock.length > pageSize) {
          await page.locator('#ct-pages button[data-page="next"]').click();
          check('paginacion_siguiente', equals(await ids(), order('recientes').slice(pageSize, pageSize * 2).map(p => p.sku)), 'Página2 no conserva orden de novedades.');
          await page.locator('#ct-pages button[data-page="prev"]').click();
          check('paginacion_anterior', equals(await ids(), order('recientes').slice(0, pageSize).map(p => p.sku)), 'Página anterior no restaura resultados.');
        }
        const categoryName = [...new Set(inStock.map(category))].find(name => inStock.filter(p => category(p) === name).length > pageSize) || category(inStock[0]);
        const chip = page.locator('#chips .chip').filter({hasText: categoryName});
        await chip.first().click();
        const expectedCategory = order('recientes').filter(p => category(p) === categoryName).slice(0, pageSize).map(p => p.sku);
        check('categoria', equals(await ids(), expectedCategory), 'Filtro de categoría no corresponde a los productos de ' + categoryName);
        await page.locator('#chips .chip[data-cat="TODOS"]').click();
        for (const sku of skus) {
          const product = {sku, errores: []}; row.productos.push(product);
          const ensure = (ok, message) => { if (!ok) product.errores.push(message); };
          const p = bySku.get(sku), published = payload.productos[sku];
          const sourceVersions = enriched[sku]?.imagenProfesional?.versiones || {};
          const sourceImage = {srcset: [300, 600, 1200].map(size => sourceVersions[String(size)]?.url ? `${sourceVersions[String(size)].url} ${size}w` : '').filter(Boolean).join(', ')};
          if (!p || (!published && opt.base === PUBLIC)) { product.errores.push('SKU ausente del catálogo o de los metadatos exigidos en Pages.'); continue; }
          if (p.stock <= 0) { product.estado = 'EXCLUIDO_SIN_EXISTENCIAS'; continue; }
          await page.locator('#q').fill(sku);
          ensure(equals(await ids(), [sku]), 'La búsqueda porSKU no devuelve solamente el producto esperado.');
          const card = page.locator('#grid .ct-compact-card').first(); await card.scrollIntoViewIfNeeded();
          await card.locator('img').evaluate(async im => { await im.decode().catch(() => {}); }).catch(() => {});
          const current = (await snapshot()).tarjetas.find(item => item.sku === sku);
          if (!current) { product.errores.push('Tarjeta deSKU no localizada.'); continue; }
          product.tarjeta = current;
          if (published) {
            ensure(Number.isFinite(Date.parse(published.actualizadoEn)) && /^[a-f0-9]{64}$/.test(published.huella || ''), 'Metadatos publicados sin fecha o huella válidas.');
            ensure(current.actualizado === published.actualizadoEn, 'Fecha de actualización no coincide con metadatos.');
          } else {
            ensure(current.actualizado === '', 'El candidato nuevo tiene una fecha de publicación artificial.');
            product.metadatos = 'CANDIDATO_LOCAL_SIN_FECHA_PUBLICA';
          }
          ensure(current.altura <= 410 && !current.contenido_largo.length, 'Tarjeta del producto pierde diseño compacto.');
          ensure(current.imagen?.cargada && current.imagen?.ajuste === 'contain', 'Imagen no carga o usa ajuste diferente decontain.');
          ensure(money(current.promo) === Math.round(p.promo * 100) && money(current.pvp) === Math.round(p.pvp * 100) && current.promo_px > current.pvp_px && current.pvp_tachado === false, 'Datos o jerarquía de precios modificados.');
          const expectedVariants = variants((published?.imagen || sourceImage).srcset, PUBLIC), actualVariants = variants(current.imagen?.srcset, PUBLIC);
          ensure(equals(expectedVariants, actualVariants) && equals(expectedVariants.map(v => v.ancho), [300, 600, 1200]), 'Srcset no coincide con versiones300/600/1200 aprobadas.');
          ensure(current.imagen?.src && expectedVariants.some(variant => variant.url === new URL(current.imagen.src, PUBLIC).href), 'Portada ajena a las versiones aprobadas.');
          product.miniaturas = [];
          for (const variant of expectedVariants) {
            const u = new URL(variant.url), result = await resource(opt.base + u.pathname, decodeURIComponent(u.pathname).replace(/^\//, ''));
            product.miniaturas.push({ancho: variant.ancho, ...result}); ensure(result.ok, 'Miniatura no coincide con archivo aprobado: ' + variant.ancho);
          }
          const canonical = PUBLIC + '/productos/' + slugs[sku] + '/';
          ensure(Object.values(current.enlaces).every(href => href && new URL(href, PUBLIC).href === canonical), 'Enlaces del producto no llevan a su ficha estable.');
          const detail = await resource(opt.base + '/productos/' + slugs[sku] + '/', 'productos/' + slugs[sku] + '/index.html');
          ensure(detail.ok, 'Ficha enriquecida inaccesible o diferente del candidato local.');
          product.ficha = {url: canonical, ...detail}; product.estado = product.errores.length ? 'REVISAR' : 'VERIFICADO';
        }
        check('productos_del_lote', row.productos.every(p => !p.errores.length), 'Una o más tarjetas aprobadas fallan carga, enlaces, miniaturas o datos.');
        await page.locator('#q').fill('CONECTATECH-SKU-INEXISTENTE-000000');
        check('busqueda_sin_resultados', (await ids()).length === 0 && await page.locator('#empty').isVisible(), 'Búsqueda inexistente no muestra estado vacío.');
        await page.locator('#q').fill('');
        check('restaurar_busqueda', equals(await ids(), order('recientes').slice(0, pageSize).map(p => p.sku)), 'Borrar búsqueda no restaura ordenreciente.');
        const legacy = await page.evaluate(() => Array.from(document.querySelectorAll('#featured img,.ct-promo-stage img')).filter(im => im.complete && im.naturalWidth === 0).map(im => ({src: im.getAttribute('src'), motivo: 'Imagen heredada de destacado/campaña no cargada; fuera del lote del grid.'})));
        report.advertencias_ajenas_al_lote.push(...legacy);
        row.estado = row.errores.length ? 'REVISAR' : 'VERIFICADO';
      } catch (error) { row.errores.push(error.message); }
      finally { await page.close(); }
    }
    await context.close();
  } catch (error) { report.errores_herramienta.push(error.message); }
  finally { if (browser) await browser.close(); }
  report.resumen = {vistas_comprobadas: report.resultados.length, vistas_verificadas: report.resultados.filter(row => row.estado === 'VERIFICADO').length,
    sku_solicitados: skus.length, errores: report.errores_herramienta.length + report.resultados.reduce((sum, row) => sum + row.errores.length, 0)};
  write(opt.salida, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({...report.resumen, reporte: rel(opt.salida)}));
  if (report.resumen.errores || report.resumen.vistas_verificadas !== 2) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
