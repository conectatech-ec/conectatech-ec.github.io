#!/usr/bin/env python3
"""Fechas efectivas por cambios de contenido publicados; nunca por importaciones o QA."""
import argparse
from collections import Counter
import copy
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
from html.parser import HTMLParser
import importlib.util
import json
from pathlib import Path
import re
import unicodedata
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://conectatech-ec.github.io'
ORDERS = ('recientes', 'catalogo', 'nombre', 'precio-asc', 'precio-desc')
_spec = importlib.util.spec_from_file_location('editorial_actualizaciones', ROOT / 'scripts/importar-productos.py')
editorial = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(editorial)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def safe(root, path):
    result = (Path(root) / path).resolve()
    if not result.is_relative_to(Path(root).resolve()):
        raise ValueError('Ruta fuera del repositorio')
    return result


def normalized(value):
    """Ignora espacios tipográficos y orden de claves; conserva valores comerciales."""
    if isinstance(value, str):
        return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', value)).strip()
    if isinstance(value, dict):
        return {k: normalized(v) for k, v in sorted(value.items())}
    if isinstance(value, list):
        return [normalized(v) for v in value]
    return value


def digest(value):
    return sha(json.dumps(normalized(value), ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode())


def set_default_order(state, order=None):
    selected = order if order is not None else state.get('ordenPredeterminado', 'recientes')
    if selected not in ORDERS:
        raise ValueError('Orden predeterminado no reconocido')
    state['ordenPredeterminado'] = selected


def stamp(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('La fecha HTTP debe incluir zona horaria')
    return result.astimezone(timezone.utc)


def equal_number(left, right):
    if isinstance(left, bool) or isinstance(right, bool): return False
    try:
        return Decimal(str(left)).is_finite() and Decimal(str(left)) == Decimal(str(right))
    except Exception:
        return False


class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.capture = False; self.schema = ''; self.canonical = None
        self.text = []; self.title = ''; self.in_title = False; self.description_meta = None; self.images = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'script' and a.get('type') == 'application/ld+json': self.capture = True
        if tag == 'link' and a.get('rel') == 'canonical': self.canonical = a.get('href')
        if tag == 'title': self.in_title = True
        if tag == 'meta' and a.get('name') == 'description': self.description_meta = a.get('content')
        if tag == 'img' and a.get('src'): self.images.append(urljoin(ORIGIN, a['src']))
    def handle_endtag(self, tag):
        if tag == 'script': self.capture = False
        if tag == 'title': self.in_title = False
    def handle_data(self, data):
        if self.capture: self.schema += data
        else: self.text.append(data)
        if self.in_title: self.title += data


def inspect_sku(root, sku, product, custom, slug, row):
    """Vincula contenido local a HTML y bytes realmente verificados por HTTP."""
    expected_url = ORIGIN + '/productos/' + slug + '/'
    if row.get('estado') != 'publicado_verificado' or row.get('http') != 200 or row.get('imagen_pendiente') is not False:
        raise ValueError('La ficha no está publicada con imagen verificada')
    if row.get('url') != expected_url:
        raise ValueError('URL HTTP no coincide con la ficha estable')
    for actual, expected in [('promo', 'promo'), ('pvp', 'pvp'), ('stock_catalogo', 'stock')]:
        if not equal_number(row.get(actual), product.get(expected)):
            raise ValueError('Dato HTTP comercial distinto del catálogo: ' + actual)
    data = safe(root, 'productos/' + slug + '/index.html').read_bytes()
    if sha(data) != row.get('sha256_ficha'):
        raise ValueError('El HTML local todavía no corresponde a la publicación comprobada')
    page = Page(); page.feed(data.decode()); schema = json.loads(page.schema)
    title = custom.get('nombre') or product['name']; description = custom.get('descripcion', '')
    if page.canonical != expected_url or schema.get('sku') != sku or schema.get('name') != title or product['name'] != title:
        raise ValueError('Identidad/título local no coincide con la ficha servida')
    if schema.get('description', '') != description:
        raise ValueError('Descripción local no corresponde al HTML publicado')
    if not equal_number(schema.get('offers', {}).get('price'), product['promo']):
        raise ValueError('Precio estructurado no coincide con el catálogo')
    if schema.get('offers', {}).get('priceCurrency') != 'USD':
        raise ValueError('Moneda publicada incorrecta')
    expected_stock = 'https://schema.org/' + ('InStock' if product['stock'] > 0 else 'OutOfStock')
    if schema.get('offers', {}).get('availability') != expected_stock:
        raise ValueError('Disponibilidad estructurada distinta del corte')
    if custom.get('imagenPendiente') or not custom.get('imagenProfesional'):
        raise ValueError('Portada profesional pendiente o no documentada')
    cover = custom['imagenProfesional']; photos = custom.get('galeria') or [cover]
    if Counter(p.get('posicion') for p in photos)[1] != 1:
        raise ValueError('Portada ausente o duplicada')
    image_url = cover['versiones']['1200']['url']
    if custom.get('imagen') != image_url or product.get('imageUrl') != image_url or row.get('imagen') != urljoin(ORIGIN, image_url):
        raise ValueError('Referencias de portada local/HTTP inconsistentes')
    if urljoin(ORIGIN, image_url) not in page.images:
        raise ValueError('La imagen principal no figura en el HTML servido')
    actual_http = row.get('versiones_verificadas', [])
    http_counts = Counter(v.get('tamano') for v in actual_http)
    if any(n != 1 for n in http_counts.values()):
        raise ValueError('Versiones HTTP duplicadas')
    verified = {(v.get('tamano'), v.get('sha256')) for v in actual_http if v.get('http') == 200}
    expected = set(); image_semantics = []
    for photo in sorted(photos, key=lambda p: p['posicion']):
        if photo.get('contiene_caja') is not False:
            raise ValueError('Medio no aprobado SIN CAJA')
        if set(photo.get('versiones', {})) != {'1200', '600', '300'}:
            raise ValueError('Faltan versiones 1200/600/300')
        version_hashes = {}
        for size in ('300', '600', '1200'):
            version = photo['versiones'][size]
            payload = safe(root, version['url'].lstrip('/')).read_bytes(); actual_hash = sha(payload)
            if actual_hash != version.get('sha256'):
                raise ValueError('Archivo de imagen cambiado sin actualizar su registro')
            expected.add((f"{photo['posicion']:02d}-{size}", actual_hash)); version_hashes[size] = actual_hash
        image_semantics.append({'posicion': photo['posicion'], 'versiones': version_hashes})
    if expected != verified:
        raise ValueError('Los archivos de imagen no son los tres tamaños verificados en Pages')
    specs = custom.get('caracteristicas') or product.get('specs') or {}
    if product.get('specs', specs) != specs:
        raise ValueError('Características de catálogo y ficha todavía no coinciden')
    public_category = custom.get('categoriaComercial') or product.get('category')
    visible = normalized(' '.join(page.text))
    # Evita fechar metadatos nuevos que aún no se regeneraron en la ficha publicada.
    for text in [public_category, custom.get('compatibilidad'), custom.get('contenidoVenta'), *specs.keys(), *specs.values()]:
        if text and normalized(str(text)) not in visible:
            raise ValueError('Campo local aún no visible en la ficha comprobada: ' + str(text))
    if custom.get('tituloSeo') and page.title != custom['tituloSeo']:
        raise ValueError('Título SEO no corresponde al HTML publicado')
    if custom.get('descripcionSeo') and page.description_meta != custom['descripcionSeo']:
        raise ValueError('Descripción SEO no corresponde al HTML publicado')
    content = normalized({'titulo': title, 'tituloSeo': page.title, 'descripcion': description,
        'descripcionSeo': page.description_meta, 'especificaciones': specs,
        'compatibilidad': custom.get('compatibilidad'), 'contenidoVenta': custom.get('contenidoVenta'),
        'garantia': custom.get('garantia'), 'categoriaPublica': public_category,
        'unidadVenta': custom.get('unidadVenta'),
        'autenticidadPublica': custom.get('reglaSKU', {}).get('autenticidad'),
        'imagenes': image_semantics})
    image = {'src': image_url, 'srcset': ', '.join(cover['versiones'][s]['url'] + '?v=' + cover['versiones'][s]['sha256'][:16] + ' ' + s + 'w' for s in ('300', '600', '1200'))}
    return content, image


def register(root, report, previous, report_path, report_sha):
    _, products = editorial.read_catalog(root)
    by_sku = {p['sku']: p for p in products}
    seo = json.loads((Path(root) / 'seo-contenido.json').read_text())
    slugs = json.loads((Path(root) / 'seo-pages.json').read_text())
    when = stamp(report['fecha']); date = when.isoformat()
    state = copy.deepcopy(previous) if previous else {'version': 1, 'criterio': 'Cambios semánticos publicados y verificados por HTTP; precios, stock, fuentes y fechas de revisión no alteran la fecha.', 'productos': {}}
    if state.get('version') != 1 or not isinstance(state.get('productos'), dict):
        raise ValueError('Registro de actualizaciones incompatible; no se sustituye')
    set_default_order(state)
    results = []; rows = report.get('resultados', []); counts = Counter(r.get('sku') for r in rows)
    for row in rows:
        sku = row.get('sku')
        try:
            if sku not in by_sku or counts[sku] != 1 or sku not in slugs:
                raise ValueError('SKU desconocido o duplicado en el reporte HTTP')
            content, image = inspect_sku(root, sku, by_sku[sku], seo.get(sku, {}), slugs[sku], row)
            fingerprint = digest(content); old = state['productos'].get(sku)
            if old and old.get('huella') == fingerprint:
                # Un traslado técnico de archivos puede renovar URLs, sin simular una novedad comercial.
                old['imagen'] = image
                results.append({'sku': sku, 'estado': 'sin_cambios', 'actualizadoEn': old['actualizadoEn']}); continue
            if old and when <= stamp(old['actualizadoEn']):
                raise ValueError('Reporte HTTP anterior o igual a una actualización diferente ya registrada')
            history = list(old.get('historial', [])) if old else []
            if old:
                history.append({k: copy.deepcopy(old[k]) for k in ('actualizadoEn', 'huella', 'imagen', 'publicacion') if k in old})
            entry = dict(old or {})
            entry.update(actualizadoEn=date, huella=fingerprint, imagen=image, contenido=content, historial=history,
                publicacion={'fecha_http': date, 'reporte': str(report_path), 'sha256_reporte': report_sha,
                             'sha256_ficha': row['sha256_ficha'], 'url': row['url']})
            state['productos'][sku] = entry
            results.append({'sku': sku, 'estado': 'actualizado' if old else 'incorporado', 'actualizadoEn': date})
        except (ValueError, OSError, KeyError, TypeError) as exc:
            results.append({'sku': sku, 'estado': 'pendiente', 'motivo': str(exc)})
    return state, results


def payload(state):
    return {'ordenPredeterminado': state.get('ordenPredeterminado', 'recientes'), 'productos': {sku: {key: row[key] for key in ('actualizadoEn', 'huella', 'imagen')}
            for sku, row in sorted(state['productos'].items())}}


def version_asset_reference(index_data, js_data):
    """Cambia solo el src real del script del catálogo; mismo JS conserva la query."""
    source = index_data.decode('utf-8')
    line_starts = [0] + [m.end() for m in re.finditer('\n', source)]
    targets = []
    asset = '/assets/catalogo-publicado.js'
    class ScriptSource(HTMLParser):
        def handle_starttag(self, tag, attrs):
            if tag != 'script': return
            sources = [value for key, value in attrs if key == 'src']
            if not any(value and value.split('?', 1)[0] == asset for value in sources): return
            if len(sources) != 1:
                raise ValueError('El script del catálogo contiene atributos src duplicados')
            raw_tag = self.get_starttag_text()
            matches = list(re.finditer(r'''\bsrc\s*=\s*(["'])(/assets/catalogo-publicado\.js(?:\?v=[a-f0-9]+)?)\1''', raw_tag, re.I))
            if len(matches) != 1:
                raise ValueError('Referencia del script no reconocida; no se modifica otro HTML')
            line, column = self.getpos(); offset = line_starts[line - 1] + column
            targets.append((offset + matches[0].start(2), offset + matches[0].end(2)))
    parser = ScriptSource(); parser.feed(source)
    if len(targets) != 1:
        raise ValueError('Se requiere exactamente un script /assets/catalogo-publicado.js')
    start, end = targets[0]; reference = asset + '?v=' + sha(js_data)[:12]
    updated = (source[:start] + reference + source[end:]).encode('utf-8')
    # Comprobación byte a byte de toda la parte que no es el atributo src permitido.
    byte_start = len(source[:start].encode('utf-8')); byte_end = len(source[:end].encode('utf-8'))
    if index_data[:byte_start] != updated[:byte_start] or index_data[byte_end:] != updated[byte_start + len(reference.encode('utf-8')):]:
        raise ValueError('La invalidación intentó modificar contenido ajeno al src del script')
    return updated, reference


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default=str(ROOT)); parser.add_argument('--reporte-http', required=True)
    parser.add_argument('--registro', default='importacion/actualizaciones-sku.json')
    parser.add_argument('--payload', default='assets/catalogo-publicado.js')
    parser.add_argument('--orden-predeterminado', choices=ORDERS, help='Cambio explícito de configuración; conserva fechas y huellas por SKU')
    parser.add_argument('--reporte', default='reportes/actualizaciones-sku.json'); parser.add_argument('--aplicar', action='store_true')
    args = parser.parse_args(); root = Path(args.root).resolve()
    protected = {p: (root / p).read_bytes() for p in ('index.html', 'seo-contenido.json', 'datos-593/inventario-publico.csv', 'seo-pages.json')}
    report_data = safe(root, args.reporte_http).read_bytes()
    registry = safe(root, args.registro); before = registry.read_bytes() if registry.exists() else None
    state, results = register(root, json.loads(report_data), json.loads(before) if before else {}, args.reporte_http, sha(report_data))
    set_default_order(state, args.orden_predeterminado)
    for path, content in protected.items():
        if (root / path).read_bytes() != content:
            raise ValueError('La base cambió durante la verificación: ' + path)
    if args.aplicar:
        if (registry.read_bytes() if registry.exists() else None) != before:
            raise ValueError('Registro modificado concurrentemente; repetir sin sobrescribir')
        if safe(root, args.payload) != root / 'assets/catalogo-publicado.js':
            raise ValueError('La publicación e invalidación de caché requieren assets/catalogo-publicado.js')
        js = 'window.CONECTATECH_CATALOGO=' + json.dumps(payload(state), ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c') + ';\n'
        js_data = js.encode()
        updated_index, reference = version_asset_reference(protected['index.html'], js_data)
        # Preparar y comprobar el único cambio de HTML antes de escribir cualquier archivo.
        if (root / 'index.html').read_bytes() != protected['index.html']:
            raise ValueError('El índice cambió durante la preparación; repetir sin sobrescribir')
        editorial.atomic_write(safe(root, args.payload), js_data)
        editorial.atomic_write(registry, editorial.encode(state))
        editorial.atomic_write(root / 'index.html', updated_index)
        for path, content in protected.items():
            expected = updated_index if path == 'index.html' else content
            if (root / path).read_bytes() != expected:
                raise ValueError('Un archivo protegido cambió fuera de la referencia autorizada: ' + path)
    counts = Counter(r['estado'] for r in results)
    output = {'modo': 'aplicar' if args.aplicar else 'simular', 'resultados': results, 'resumen': dict(counts),
              'registro_total': len(state['productos']), 'finanzas_stock_originales_conservados': True}
    if args.aplicar:
        output['cache_catalogo'] = {'src': reference, 'sha256_js': sha(js_data), 'referencia_modificada': updated_index != protected['index.html']}
    editorial.atomic_write(safe(root, args.reporte), editorial.encode(output))
    print(json.dumps(output['resumen'], ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
