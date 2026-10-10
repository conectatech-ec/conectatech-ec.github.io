#!/usr/bin/env python3
"""Valida contratos por SKU; no rellena evidencia ni modifica datos comerciales."""
import argparse
from collections import Counter
import csv
from datetime import datetime
from decimal import Decimal, InvalidOperation
import hashlib
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import re
from urllib.parse import urlparse, urljoin, unquote
from PIL import Image
from reglas_sku import rule

ROOT = Path(__file__).resolve().parents[1]
CAMPOS = ('sku nombre_original titulo_comercial tipo marca modelo variante categoria_original '
          'categoria_comercial precio_contado pvp stock unidad_venta fotografias_fuente '
          'fuentes_tecnicas imagen_principal imagenes_secundarias derechos_imagen '
          'especificaciones estado_calidad estado_publicacion url_publica fecha_verificacion').split()
SHA = re.compile(r'^[a-f0-9]{64}$')
BASE_593 = 'datos-593/inventario-publico.csv'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def safe(root, path):
    if not isinstance(path, str) or not path:
        raise ValueError('Ruta vacía o inválida')
    dest = (Path(root) / path).resolve()
    if not dest.is_relative_to(Path(root).resolve()):
        raise ValueError('Ruta fuera del repositorio')
    return dest


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def number(value):
    if isinstance(value, bool):
        raise ValueError('Un booleano no es un importe')
    try:
        result = Decimal(str(value))
        if not result.is_finite():
            raise ValueError('Número no finito')
        return result
    except InvalidOperation as exc:
        raise ValueError('Valor numérico inválido') from exc


def reference(value):
    return nonempty(value) and (value.startswith('https://') or value.startswith('http://') or value.startswith('importacion/') or value.startswith('reportes/') or value.startswith('datos-593/'))


def dated(value):
    try:
        datetime.fromisoformat(value.replace('Z', '+00:00'))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


def context(root):
    """Lectura única del índice y el corte: no investiga ni reprocesa otros SKU."""
    root = Path(root)
    html = (root / 'index.html').read_text()
    products = json.loads(re.search(r'const products=(\[[\s\S]*?\]);\s*\n', html)[1])
    counts = Counter(p['sku'] for p in products)
    data = (root / BASE_593).read_bytes()
    rows = list(csv.DictReader(io.StringIO(data.decode('utf-8-sig'))))
    counts_593 = Counter(r['sku'] for r in rows)
    return {'productos': {p['sku']: p for p in products}, 'duplicados': {s for s, n in counts.items() if n > 1},
            'base_593': {r['sku']: r for r in rows}, 'duplicados_593': {s for s, n in counts_593.items() if n > 1},
            'sha256_593': sha(data), 'slugs': json.loads((root / 'seo-pages.json').read_text()),
            'categorias': {p.get('category') for p in products if p.get('category')}}


def load_contract(root, manifest, sku):
    source = manifest.get('contratos', {})
    if isinstance(source, str):
        source = json.loads(safe(root, source).read_text())
    if not isinstance(source, dict):
        raise ValueError('contratos debe ser un mapa por SKU o su archivo JSON')
    contract = source.get(sku)
    if isinstance(contract, str):
        contract = json.loads(safe(root, contract).read_text())
    if not isinstance(contract, dict):
        raise ValueError('Contrato ausente para ' + sku)
    return contract


def artifact(root, evidence):
    """Verifica evidencia local por bytes; un nombre de archivo no prueba revisión."""
    if not isinstance(evidence, dict) or not SHA.fullmatch(str(evidence.get('sha256', ''))):
        raise ValueError('Evidencia sin hash válido')
    data = safe(root, evidence.get('archivo')).read_bytes()
    if sha(data) != evidence['sha256']:
        raise ValueError('Evidencia modificada después de la revisión')
    return data


def validate(root, contract, sku, r, candidates, ctx, categories=None, require_mobile=True):
    """Prepublicación: devuelve errores de este SKU, nunca modifica el contrato."""
    errors = []
    def fail(code, message):
        errors.append({'codigo': code, 'motivo': message})
    if not isinstance(contract, dict):
        return [{'codigo': 'contrato', 'motivo': 'Contrato ausente o inválido'}]
    missing = [k for k in CAMPOS if k not in contract]
    if missing:
        fail('campos', 'Campos obligatorios ausentes: ' + ', '.join(missing))
    p = ctx['productos'].get(sku)
    if not p or sku in ctx['duplicados'] or contract.get('sku') != sku:
        fail('sku', 'SKU desconocido, duplicado o distinto del contrato')
        return errors
    base = ctx['base_593'].get(sku)
    if not base or sku in ctx['duplicados_593']:
        fail('base_593', 'SKU ausente o duplicado en el corte 593')
    validation = contract.get('validaciones', {})
    if not isinstance(validation, dict):
        validation = {}
    for label, key in [('precio_contado', 'promo'), ('pvp', 'pvp'), ('stock', 'stock')]:
        try:
            if number(contract.get(label)) != number(p[key]):
                fail('finanzas', label + ' difiere del catálogo; no se recalcula')
        except (ValueError, KeyError):
            fail('finanzas', label + ' debe conservar un valor numérico válido')
    evidence_593 = validation.get('base_593', {})
    if (not isinstance(evidence_593, dict) or evidence_593.get('archivo') != BASE_593 or
            evidence_593.get('sha256') != ctx['sha256_593'] or evidence_593.get('fila') != base):
        fail('base_593', 'Falta hash y fila literal íntegra del corte 593 vigente')
    if base:
        try:
            if number(contract.get('stock')) != number(base['stock']):
                fail('stock_593', 'Stock del catálogo y corte 593 discrepantes; requiere validación comercial')
        except (ValueError, KeyError):
            fail('stock_593', 'Stock de 593 inválido')
    for key in ('nombre_original', 'titulo_comercial', 'categoria_original', 'categoria_comercial'):
        if not nonempty(contract.get(key)):
            fail('texto', key + ' vacío')
    # nombre_original es un dato histórico; no exigir que vuelva a ser el título ya enriquecido.
    if contract.get('categoria_original') != p.get('category'):
        mapping = (categories or {}).get(contract.get('categoria_original'), {})
        if not isinstance(mapping, dict) or mapping.get('nombre') != p.get('category'):
            fail('categoria_original', 'Categoría original no corresponde al catálogo ni a una migración registrada')
    category = contract.get('categoria_comercial')
    mapping = (categories or {}).get(contract.get('categoria_original'), {})
    if category != p.get('category'):
        if not (isinstance(mapping, dict) and mapping.get('nombre') == category and mapping.get('verificada') is True and reference(mapping.get('fuente'))):
            fail('categoria', 'Categoría comercial sin mapeo revisado y fuente')
    expected_url = 'https://conectatech-ec.github.io/productos/' + ctx['slugs'].get(sku, '') + '/'
    if contract.get('url_publica') != expected_url or sku not in ctx['slugs']:
        fail('url', 'URL distinta de la ficha estable registrada')
    if not dated(contract.get('fecha_verificacion')):
        fail('fecha', 'Fecha de verificación ausente o inválida')
    if contract.get('estado_calidad') != 'APROBADO':
        fail('calidad', 'Estado de calidad aún no APROBADO')
    if contract.get('estado_publicacion') not in ('PENDIENTE', 'APROBADO_LOCAL', 'PUBLICADO_VERIFICADO', 'REVISAR', 'BLOQUEADO'):
        fail('estado', 'Estado de publicación desconocido')
    if r.get('presentacion') != 'sin caja' or any(i.get('contiene_caja') is not False for i in candidates):
        fail('caja', 'Toda fotografía comercial debe estar verificada SIN CAJA')
    expected_type = {'original verificado': 'original', 'genérico/compatible': 'generico'}.get(r.get('autenticidad'))
    if not expected_type or contract.get('tipo') != expected_type or not nonempty(r.get('evidencia_autenticidad')):
        fail('autenticidad', 'Tipo no coincide con la regla comercial documentada')
    identity = validation.get('identidad', {})
    if not isinstance(identity, dict):
        identity = {}
    not_declared = {'marca': 'marca_no_declarada', 'modelo': 'modelo_no_declarado'}
    for field in ('marca', 'modelo', 'variante'):
        omitted = (field in not_declared and contract.get(field) is None and
                   identity.get(not_declared[field]) is True and identity.get('sku_verificado') is True)
        if omitted:
            continue
        if identity.get(field + '_verificado') is not True:
            fail('identidad', field + ' sin revisión exacta')
        if not nonempty(contract.get(field)):
            if not (expected_type == 'generico' and identity.get(field + '_no_aplica') is True):
                fail('identidad', field + ' no identificado; no sustituir por un modelo similar')
    photos = contract.get('fotografias_fuente')
    if not isinstance(photos, list) or not photos:
        fail('fuentes', 'Faltan fotografías de identificación')
        photos = []
    urls = set()
    for photo in photos:
        if not isinstance(photo, dict) or not reference(photo.get('url')) or not SHA.fullmatch(str(photo.get('sha256', ''))):
            fail('fuentes', 'Fotografía fuente sin procedencia y hash')
        else:
            urls.add(photo['url'])
    id_sources = identity.get('fuentes', [])
    if not isinstance(id_sources, list) or not id_sources or any(x not in urls for x in id_sources):
        fail('identidad', 'Revisión de identidad no vinculada a fotografías fuente')
    discrepancies = identity.get('discrepancias_pendientes')
    if not isinstance(discrepancies, list):
        fail('discrepancia', 'Falta registro explícito de discrepancias de identidad')
    else:
        for discrepancy in discrepancies:
            field = discrepancy.get('campo') if isinstance(discrepancy, dict) else None
            # Un nombre base dudoso puede omitirse sin fingir que se identificó el modelo.
            allowed_omission = (field in not_declared and
                contract.get(field) is None and identity.get(not_declared[field]) is True and
                discrepancy.get('tratamiento') == 'NO_DECLARAR' and discrepancy.get('fuente') in urls and
                nonempty(discrepancy.get('descripcion')) and identity.get('sku_verificado') is True)
            if not allowed_omission:
                fail('discrepancia', 'Identidad con discrepancias sin resolver')
            elif nonempty(discrepancy.get('valor_catalogo')):
                assertions = ' '.join([str(contract.get('titulo_comercial', '')), str(contract.get('descripcion', ''))] +
                    [str(s.get('valor', '')) for s in contract.get('especificaciones', []) if isinstance(s, dict) and s.get('publicar') is not False])
                if discrepancy['valor_catalogo'].casefold() in assertions.casefold():
                    fail('discrepancia', 'El modelo omitido aún aparece en una afirmación publicable')
    unit = contract.get('unidad_venta', {})
    if not isinstance(unit, dict) or not (nonempty(unit.get('descripcion')) and unit.get('verificada') is True and reference(unit.get('fuente'))):
        fail('unidad', 'Unidad de venta sin confirmar y documentar')
    else:
        try:
            if number(unit.get('cantidad')) <= 0:
                fail('unidad', 'Cantidad de venta debe ser positiva')
        except ValueError:
            fail('unidad', 'Cantidad de venta inválida')
    technical = contract.get('fuentes_tecnicas')
    if not isinstance(technical, list) or not technical or any(not reference(x) for x in technical):
        fail('fuentes_tecnicas', 'Fuentes técnicas ausentes o inválidas')
        technical = []
    specs = contract.get('especificaciones')
    if not isinstance(specs, list) or not specs:
        fail('especificaciones', 'Faltan especificaciones con evidencia por campo')
        specs = []
    for spec in specs:
        if not isinstance(spec, dict):
            fail('especificaciones', 'Especificación debe ser un objeto'); continue
        if spec.get('publicar') is False:
            continue
        spec_sources = spec.get('fuentes')
        if not (nonempty(spec.get('nombre')) and nonempty(spec.get('valor')) and spec.get('estado') == 'VERIFICADO' and
                isinstance(spec_sources, list) and spec_sources and all(x in technical or x in urls for x in spec_sources)):
            fail('especificaciones', 'Afirmación publicable sin fuente/verificación: ' + str(spec.get('nombre', '?')))
    editorial = validation.get('ficha', {})
    if not isinstance(editorial, dict) or editorial.get('verificada') is not True or not reference(editorial.get('fuente')):
        fail('ficha', 'Revisión editorial de título, descripción y afirmaciones pendiente')
    rights = contract.get('derechos_imagen', {})
    if not isinstance(rights, dict):
        rights = {}
    if not (rights.get('estado') == 'AUTORIZADO' and rights.get('tipo') in ('propia', 'licencia', 'permiso_fabricante', 'permiso_distribuidor') and
            nonempty(rights.get('evidencia')) and reference(rights.get('fuente')) and dated(rights.get('fecha_verificacion'))):
        fail('derechos', 'Derechos de uso sin autorización y evidencia documentadas; público no equivale a permitido')
    covered = rights.get('archivos', [])
    if not isinstance(covered, list):
        covered = []
    covered_hashes = {(x.get('sha256'), x.get('fuente')) for x in covered if isinstance(x, dict)}
    for item in candidates:
        if (item.get('sha256'), item.get('fuente')) not in covered_hashes:
            fail('derechos', 'Permiso no vinculado al hash y procedencia de cada imagen comercial')
    if not candidates:
        fail('portada', 'Sin fotografía comercial revisada en el manifiesto')
    principal = '/imagenes/' + sku.lower() + '/' + sku + '-01.webp'
    if contract.get('imagen_principal') != principal:
        fail('portada', 'Ruta de portada no corresponde al SKU/posición 01')
    expected_secondary = ['/imagenes/' + sku.lower() + '/' + sku + '-' + str(i.get('posicion')).zfill(2) + '.webp' for i in candidates if i.get('posicion') != 1]
    if contract.get('imagenes_secundarias') != expected_secondary:
        fail('galeria', 'Galería no coincide con las vistas auténticas del manifiesto')
    # Aplicar localmente permite generar HTML/medios de revisión. Publicar exige la captura.
    if not require_mobile:
        return errors
    # La revisión visual requiere una captura real de la ficha a ancho móvil.
    mobile = validation.get('movil', {})
    try:
        if not isinstance(mobile, dict) or mobile.get('estado') != 'VERIFICADO' or mobile.get('sku') != sku or mobile.get('url') != expected_url:
            raise ValueError('Revisión móvil ausente o corresponde a otra ficha')
        width = mobile.get('ancho_viewport')
        docwidth = mobile.get('ancho_documento')
        if not isinstance(width, int) or not 320 <= width <= 600 or not isinstance(docwidth, (int, float)) or docwidth > width:
            raise ValueError('Viewport móvil inválido o desbordamiento horizontal')
        data = artifact(root, mobile)
        with Image.open(io.BytesIO(data)) as im:
            if im.width < width or im.height < 300:
                raise ValueError('Captura móvil insuficiente')
        if not dated(mobile.get('fecha')) or not SHA.fullmatch(str(mobile.get('sha256_html', ''))):
            raise ValueError('Captura móvil sin fecha/hash de HTML revisado')
        html_source = artifact(root, {'archivo': mobile.get('archivo_html'), 'sha256': mobile.get('sha256_html')})
        if sku not in html_source.decode() or contract.get('imagen_principal') not in html_source.decode():
            raise ValueError('HTML de revisión no contiene SKU y portada previstos')
    except (ValueError, OSError, TypeError, KeyError) as exc:
        fail('movil', str(exc))
    return errors


class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.urls = []
    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag in ('a', 'link') and attributes.get('href'):
            self.urls.append(attributes['href'])
        if tag in ('img', 'script', 'source') and attributes.get('src'):
            self.urls.append(attributes['src'])


def validate_links(root, contract):
    """Rutas internas reales y sintaxis de contacto; nunca envía WhatsApp."""
    errors = []
    try:
        mobile = contract['validaciones']['movil']
        html = artifact(root, {'archivo': mobile['archivo_html'], 'sha256': mobile['sha256_html']}).decode()
        links = Links(); links.feed(html)
        for url in set(links.urls):
            if url.startswith(('#', 'mailto:', 'tel:')):
                continue
            parsed = urlparse(urljoin(contract['url_publica'], url))
            if parsed.scheme not in ('https', 'http') or not parsed.hostname:
                raise ValueError('Enlace con protocolo o destino inválido: ' + url)
            if parsed.hostname == 'conectatech-ec.github.io':
                path = unquote(parsed.path).lstrip('/')
                if not path or parsed.path.endswith('/'):
                    path += 'index.html'
                if not safe(root, path).is_file():
                    raise ValueError('Enlace interno roto: ' + url)
            elif parsed.hostname == 'wa.me' and not re.fullmatch(r'/[1-9][0-9]{7,14}', parsed.path):
                raise ValueError('Enlace WhatsApp inválido')
    except (ValueError, OSError, KeyError, TypeError) as exc:
        errors.append({'codigo': 'enlaces', 'motivo': str(exc)})
    return errors


def validate_editorial(root, contract, ctx):
    """El contenido aplicado debe ser exactamente el que documenta el contrato."""
    errors = []
    try:
        sku = contract['sku']; product = ctx['productos'][sku]
        editorial = json.loads((Path(root) / 'seo-contenido.json').read_text()).get(sku, {})
        if product.get('name') != contract['titulo_comercial'] or editorial.get('nombre') != contract['titulo_comercial']:
            raise ValueError('Título aplicado distinto del título revisado')
        expected = {s['nombre']: s['valor'] for s in contract['especificaciones'] if s.get('publicar') is not False}
        if not expected or product.get('specs') != expected or editorial.get('caracteristicas') != expected:
            raise ValueError('Características aplicadas distintas de las afirmaciones verificadas')
        if not nonempty(editorial.get('descripcion')) or editorial.get('comercialVerificado') is not True:
            raise ValueError('Descripción comercial todavía no aplicada y verificada')
        if 'descripcion' in contract and editorial['descripcion'] != contract['descripcion']:
            raise ValueError('Descripción aplicada distinta de la revisión editorial')
        if product.get('imageUrl') != contract['imagen_principal'] or editorial.get('imagen') != contract['imagen_principal'] or editorial.get('imagenPendiente'):
            raise ValueError('Catálogo/ficha aún no vinculan la portada aprobada')
    except (ValueError, OSError, KeyError, TypeError) as exc:
        errors.append({'codigo': 'editorial_aplicada', 'motivo': str(exc)})
    return errors


def validate_images(root, contract, photos, writes=None):
    """Comprueba bytes de todas las salidas antes de escribir archivos públicos."""
    errors = []
    writes = writes or {}
    try:
        if len([p for p in photos if p.get('posicion') == 1]) != 1:
            raise ValueError('Debe existir exactamente una portada')
        actual_paths = []
        for photo in photos:
            if photo.get('contiene_caja') is not False:
                raise ValueError('Caja en una imagen comercial')
            original_path = photo['original'].lstrip('/')
            original_data = writes[original_path] if original_path in writes else safe(root, original_path).read_bytes()
            if sha(original_data) != photo.get('sha256_original'):
                raise ValueError('Original modificado o hash ausente')
            with Image.open(io.BytesIO(original_data)) as original:
                dimensions = original.size
                crop = photo.get('recorte')
                if crop:
                    dimensions = (crop[2] - crop[0], crop[3] - crop[1])
                if min(dimensions) < 500 or max(dimensions) < 1000:
                    raise ValueError('Resolución útil insuficiente; no se amplía')
            versions = photo.get('versiones', {})
            if set(versions) != {'1200', '600', '300'}:
                raise ValueError('Faltan tamaños 1200/600/300')
            for size, version in versions.items():
                path = version['url'].lstrip('/')
                data = writes[path] if path in writes else safe(root, path).read_bytes()
                if sha(data) != version['sha256']:
                    raise ValueError('Hash de miniatura incorrecto')
                with Image.open(io.BytesIO(data)) as im:
                    if im.format != 'WEBP' or im.size != (int(size), int(size)):
                        raise ValueError('Formato o dimensiones de miniatura incorrectos')
            actual_paths.append(versions['1200']['url'])
        expected_paths = [contract.get('imagen_principal')] + contract.get('imagenes_secundarias', [])
        if set(actual_paths) != set(expected_paths):
            raise ValueError('Las salidas no coinciden con el contrato')
    except (ValueError, OSError, TypeError, KeyError) as exc:
        errors.append({'codigo': 'archivos', 'motivo': str(exc)})
    return errors


def validate_publication(root, contract, photos):
    """Consume la comprobación HTTP real existente; no confunde local con Pages."""
    errors = []
    try:
        evidence = contract.get('validaciones', {}).get('publicacion_http', {})
        report = json.loads(artifact(root, evidence))
        if not dated(report.get('fecha')):
            raise ValueError('Reporte HTTP sin fecha')
        matches = [x for x in report.get('resultados', []) if x.get('sku') == contract['sku']]
        if len(matches) != 1:
            raise ValueError('Comprobación HTTP ausente o duplicada para el SKU')
        row = matches[0]
        if row.get('estado') != 'publicado_verificado' or row.get('http') != 200 or row.get('url') != contract['url_publica'] or row.get('imagen_pendiente') is not False:
            raise ValueError('Pages aún no verificado con fotografía servida')
        for key, httpkey in [('precio_contado', 'promo'), ('pvp', 'pvp'), ('stock', 'stock_catalogo')]:
            if number(row.get(httpkey)) != number(contract[key]):
                raise ValueError('Datos HTTP distintos del contrato: ' + key)
        expected = {(str(p['posicion']).zfill(2) + '-' + size, v['sha256']) for p in photos for size, v in p['versiones'].items()}
        actual = {(v.get('tamano'), v.get('sha256')) for v in row.get('versiones_verificadas', []) if v.get('http') == 200}
        if not expected or expected != actual:
            raise ValueError('Miniaturas o hashes HTTP incompletos')
        mobile = contract['validaciones']['movil']
        if row.get('sha256_ficha') != mobile.get('sha256_html'):
            raise ValueError('La revisión móvil no corresponde al HTML servido')
    except (ValueError, OSError, TypeError, KeyError) as exc:
        errors.append({'codigo': 'publicacion', 'motivo': str(exc)})
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default=str(ROOT)); parser.add_argument('--manifiesto', required=True)
    parser.add_argument('--fase', choices=('preparacion', 'archivos', 'prepublicacion', 'publicacion'), default='preparacion')
    parser.add_argument('--reporte', default='reportes/contratos.json')
    args = parser.parse_args(); root = Path(args.root).resolve()
    manifest = json.loads(safe(root, args.manifiesto).read_text()); ctx = context(root)
    aliases = json.loads((root / 'importacion/alias-sku.json').read_text())
    skus = [aliases.get(s, s) for s in manifest['skus']]; counts = Counter(skus)
    media_path = root / 'importacion/medios.json'; media = json.loads(media_path.read_text()) if media_path.exists() else {}
    results = []
    for sku in dict.fromkeys(skus):
        try:
            contract = load_contract(root, manifest, sku)
            errors = validate(root, contract, sku, rule(sku, root), manifest.get('imagenes', {}).get(sku, []), ctx, manifest.get('categorias_comerciales'), require_mobile=args.fase in ('prepublicacion', 'publicacion'))
            if counts[sku] > 1:
                errors.append({'codigo': 'duplicado', 'motivo': 'SKU repetido en el lote; no aplicar ninguna aparición'})
            photos = media.get(sku, {}).get('imagenes', [])
            if args.fase in ('archivos', 'prepublicacion', 'publicacion'):
                errors += validate_images(root, contract, photos)
            if args.fase in ('prepublicacion', 'publicacion'):
                errors += validate_links(root, contract)
                errors += validate_editorial(root, contract, ctx)
            if args.fase == 'publicacion':
                errors += validate_publication(root, contract, photos)
        except (ValueError, OSError, KeyError, TypeError) as exc:
            errors = [{'codigo': 'contrato', 'motivo': str(exc)}]
        results.append({'sku': sku, 'estado': 'REVISAR' if errors else ('PUBLICADO_VERIFICADO' if args.fase == 'publicacion' else 'APROBADO_LOCAL'), 'errores': errors})
    report = {'fase': args.fase, 'resultados': results, 'aprobados': sum(not x['errores'] for x in results), 'pendientes': sum(bool(x['errores']) for x in results)}
    destination = safe(root, args.reporte); destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'aprobados': report['aprobados'], 'pendientes': report['pendientes']}, ensure_ascii=False))
    return int(bool(report['pendientes']))


if __name__ == '__main__':
    raise SystemExit(main())
