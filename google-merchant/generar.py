#!/usr/bin/env python3
"""Exportador de solo lectura. No importa ni ejecuta generadores del catálogo."""
import argparse
import concurrent.futures
import csv
import hashlib
import html
import io
import json
import re
import subprocess
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.parse import urljoin, urlsplit

from PIL import Image

BASE = 'https://conectatech-ec.github.io'
NS = 'http://base.google.com/ns/1.0'
ET.register_namespace('g', NS)


def money(value):
    if isinstance(value, bool):
        raise ValueError('precio_no_confiable')
    try:
        amount = Decimal(str(value))
        if not amount.is_finite() or amount <= 0 or amount != amount.quantize(Decimal('.01')):
            raise ValueError('precio_no_confiable')
        return amount
    except InvalidOperation as exc:
        raise ValueError('precio_no_confiable') from exc


def local_url(value):
    raw_path = urlsplit(value or '').path
    if any(part in ('.', '..') for part in raw_path.split('/')):
        raise ValueError('ruta_no_admitida')
    url = urljoin(BASE + '/', value or '')
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or parsed.netloc != urlsplit(BASE).netloc or parsed.query or parsed.fragment:
        raise ValueError('url_no_admitida')
    if any(part in ('.', '..') for part in parsed.path.split('/')) or '%' in parsed.path:
        raise ValueError('ruta_no_admitida')
    return url


def product_schema(document):
    for block in re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', document, re.S | re.I):
        obj = json.loads(block)
        candidates = obj if isinstance(obj, list) else obj.get('@graph', [obj])
        for candidate in candidates:
            if candidate.get('@type') == 'Product':
                return candidate
    raise ValueError('sin_datos_estructurados_producto')


def picture(data):
    with Image.open(io.BytesIO(data)) as im:
        if im.format not in ('JPEG', 'PNG', 'WEBP') or min(im.size) < 250 or im.width * im.height > 64000000:
            raise ValueError('fotografia_no_valida')
        im.verify()


def check_page(document, row):
    obj = product_schema(document)
    offer = obj.get('offers', {})
    if obj.get('sku') != row['id'] or obj.get('name') != row['title'] or obj.get('description') != row['description']:
        raise ValueError('ficha_no_coincide')
    if offer.get('priceCurrency') != 'USD' or money(offer.get('price')) != money(row['price'].split()[0]):
        raise ValueError('precio_ficha_no_coincide')
    expected = 'InStock' if row['availability'] == 'in_stock' else 'OutOfStock'
    if offer.get('availability', '').rsplit('/', 1)[-1] != expected:
        raise ValueError('stock_ficha_no_coincide')
    images = obj.get('image', [])
    if isinstance(images, str):
        images = [images]
    if row['image_link'] not in images or offer.get('url') != row['link']:
        raise ValueError('enlaces_ficha_no_coinciden')
    shown = re.search(r'<div class="price">(.*?)</div>', document, re.S)
    if not shown or money(html.unescape(re.sub('<[^>]+>', '', shown[1])).replace('$', '').replace(',', '.').strip()) != money(row['price'].split()[0]):
        raise ValueError('precio_visible_no_coincide')
    return obj


def candidate(root, p, o, slug, master):
    sku = p.get('sku')
    if not isinstance(sku, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,50}', sku):
        raise ValueError('sku_no_valido')
    if o.get('comercialVerificado') is not True or o.get('imagenPendiente') is not False:
        raise ValueError('producto_no_aprobado')
    cp = root / 'importacion/contratos' / (sku + '.json')
    if not cp.is_file():
        raise ValueError('sin_contrato')
    contract = json.loads(cp.read_text())
    checks = contract.get('validaciones', {})
    identity = checks.get('identidad', {})
    if contract.get('sku') != sku or identity.get('sku_verificado') is not True or identity.get('discrepancias_pendientes'):
        raise ValueError('identidad_pendiente')
    if checks.get('ficha', {}).get('verificada') is not True or contract.get('unidad_venta', {}).get('verificada') is not True:
        raise ValueError('ficha_o_unidad_pendiente')
    if contract.get('estado_calidad') != 'APROBADO' or contract.get('estado_publicacion') != 'PUBLICADO_VERIFICADO' or checks.get('publicacion_http', {}).get('estado') != 'VERIFICADO':
        raise ValueError('publicacion_no_verificada')
    title, description = o.get('nombre'), o.get('descripcion')
    if not title or not description or len(title) > 150 or len(description) > 5000 or re.search('<[^>]+>', title + description):
        raise ValueError('texto_incompleto_o_no_valido')
    if p.get('name') != title:
        raise ValueError('titulo_catalogo_no_coincide')
    if not master:
        raise ValueError('sin_inventario_maestro')
    price = money(p.get('promo'))
    if price != money(master.get('promo_contado')):
        raise ValueError('precio_inventario_no_coincide')
    stock = p.get('stock')
    if isinstance(stock, bool) or not isinstance(stock, int) or stock < 0 or Decimal(master['stock']) != stock:
        raise ValueError('stock_no_confiable')
    if not slug or not re.fullmatch(r'[a-z0-9-]+', slug):
        raise ValueError('sin_url_estable')
    image = local_url(o.get('imagen'))
    if not o.get('imagen') or image != local_url(p.get('imageUrl')) or image != local_url(contract.get('imagen_principal')):
        raise ValueError('imagen_no_coincide')
    info = o.get('imagenProfesional', {})
    version = next((v for v in info.get('versiones', {}).values() if local_url(v.get('url')) == image), None)
    if info.get('contiene_caja') is not False or not info.get('revision_visual') or not version:
        raise ValueError('fotografia_no_aprobada')
    image_bytes = (root / urlsplit(image).path.lstrip('/')).read_bytes()
    if hashlib.sha256(image_bytes).hexdigest() != version.get('sha256'):
        raise ValueError('hash_fotografia_no_coincide')
    picture(image_bytes)
    row = dict(id=sku, title=title, description=description, link=BASE + '/productos/' + slug + '/',
               image_link=image, availability='in_stock' if stock > 0 else 'out_of_stock', price=f'{price:.2f} USD',
               excluded_destination='Shopping_ads')
    page_path = root / 'productos' / slug / 'index.html'
    document = page_path.read_text()
    obj = check_page(document, row)
    conditions = {'NewCondition': 'new', 'UsedCondition': 'used', 'RefurbishedCondition': 'refurbished'}
    condition = conditions.get(obj.get('offers', {}).get('itemCondition', '').rsplit('/', 1)[-1])
    if condition:
        row['condition'] = condition
    # Solo marca explícita en contrato y ficha; nunca deducir de título, SKU o compatibilidad.
    brand = obj.get('brand', {})
    brand = brand.get('name') if isinstance(brand, dict) else brand
    if brand and brand == contract.get('marca') and contract.get('tipo') != 'generico' and str(brand).lower() not in ('genérico', 'generico', 'generic', 'n/a'):
        row['brand'] = brand
    # La ausencia de identificadores no prueba que no existan: no fabricar GTIN/MPN ni identifier_exists=no.
    if master.get('categoria'):
        row['product_type'] = master['categoria']
    proof = dict(sku=sku, stock=stock, fecha_inventario=o.get('fechaInventario'), stock_tiempo_real=o.get('stockTiempoReal'),
                 contrato=str(cp.relative_to(root)), precio_fuente='index.products.promo = inventario593.promo_contado = ficha.offers.price = precio visible',
                 html_sha256=hashlib.sha256(document.encode()).hexdigest(), imagen_sha256=hashlib.sha256(image_bytes).hexdigest())
    return row, proof


def download(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'ConectaTech-Merchant-Validator/1.0'})
    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status != 200 or response.geturl() != url:
            raise ValueError('http_o_redireccion_no_validos')
        return response.read(20000001), response.headers.get_content_type()


def verify_public(pair):
    row, proof = pair
    page, content_type = download(row['link'])
    if content_type != 'text/html':
        raise ValueError('http_ficha_no_html')
    check_page(page.decode('utf-8'), row)
    data, content_type = download(row['image_link'])
    if not content_type.startswith('image/') or hashlib.sha256(data).hexdigest() != proof['imagen_sha256']:
        raise ValueError('http_fotografia_no_coincide')
    picture(data)
    return dict(proof, http_publico='verificado')


def xml_feed(rows):
    rss = ET.Element('rss', {'version': '2.0'})
    channel = ET.SubElement(rss, 'channel')
    for key, value in [('title', 'ConectaTech — catálogo Ecuador'), ('link', BASE), ('description', 'Productos del catálogo aprobado de ConectaTech'), ('language', 'es-EC')]:
        ET.SubElement(channel, key).text = value
    for row in rows:
        item = ET.SubElement(channel, 'item')
        for key, value in row.items():
            ET.SubElement(item, '{' + NS + '}' + key).text = str(value)
    ET.indent(rss)
    data = ET.tostring(rss, encoding='utf-8', xml_declaration=True) + b'\n'
    ET.fromstring(data)
    return data


def generate(root, out, public=False):
    products = json.loads(re.search(r'const products=(\[[\s\S]*?\]);\s*\n', (root / 'index.html').read_text())[1])
    seo = json.loads((root / 'seo-contenido.json').read_text())
    urls = json.loads((root / 'seo-pages.json').read_text())
    with (root / 'datos-593/inventario-publico.csv').open(newline='') as f:
        master_rows = list(csv.DictReader(f))
    master = {p['sku']: p for p in master_rows}
    if len(master) != len(master_rows) or len({p['sku'] for p in products}) != len(products):
        raise ValueError('SKU duplicado; se cancela toda la exportación')
    pairs, exclusions = [], []
    for p in sorted(products, key=lambda p: p['sku']):
        try:
            pairs.append(candidate(root, p, seo.get(p['sku'], {}), urls.get(p['sku']), master.get(p['sku'])))
        except (ValueError, OSError, KeyError, TypeError) as exc:
            exclusions.append(dict(sku=p['sku'], motivo=str(exc)))
    if public:
        verified = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            futures = {pool.submit(verify_public, pair): pair for pair in pairs}
            for future in concurrent.futures.as_completed(futures):
                pair = futures[future]
                try:
                    verified.append((pair[0], future.result()))
                except Exception as exc:
                    exclusions.append(dict(sku=pair[0]['id'], motivo='http_publico: ' + str(exc)))
        pairs = sorted(verified, key=lambda pair: pair[0]['id'])
    if not pairs:
        raise ValueError('Cero productos verificables; no se reemplaza el feed anterior')
    rows = [pair[0] for pair in pairs]
    data = xml_feed(rows)
    out.mkdir(parents=True, exist_ok=True)
    source_commit = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip()
    summary = dict(merchant_center='5874003439', idioma='es', pais='EC', moneda='USD', costo_autorizado=0,
                   source_commit=source_commit, validacion='local_y_http_publico' if public else 'local; HTTP público pendiente',
                   productos_origen=len(products), incluidos=len(rows), excluidos=len(exclusions),
                   motivos=dict(sorted(Counter(e['motivo'] for e in exclusions).items())),
                   feed_sha256=hashlib.sha256(data).hexdigest(),
                   advertencias=['Stock registrado: no implica inventario en tiempo real.',
                                 'Faltan verificar compra online, precio final, envíos y devoluciones; XML válido no garantiza aprobación de Google.',
                                 'GTIN/MPN ausentes se omiten; no se declara identifier_exists=no.',
                                 'País e idioma se configuran también en Merchant Center.'])
    (out / 'productos-ec.xml').write_bytes(data)
    for name, value in [('validacion.json', summary), ('exclusiones.json', sorted(exclusions, key=lambda e: e['sku'])), ('evidencias.json', [pair[1] for pair in pairs])]:
        (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: summary[k] for k in ('productos_origen', 'incluidos', 'excluidos', 'validacion')}, ensure_ascii=False))
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--output', type=Path)
    parser.add_argument('--verify-public', action='store_true')
    args = parser.parse_args()
    generate(args.root.resolve(), args.output or args.root / 'google-merchant', args.verify_public)
