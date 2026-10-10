#!/usr/bin/env python3
"""Aplica metadatos comerciales revisados de contratos v3; no importa fichas ni imágenes."""
import argparse
from collections import Counter
from datetime import datetime
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result); return result

contracts = module('contratos_metadatos', 'validar-contrato.py')
editorial = module('editorial_metadatos', 'importar-productos.py')
from reglas_sku import rule


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default=str(ROOT)); parser.add_argument('--manifiesto', required=True)
    parser.add_argument('--aplicar', action='store_true'); parser.add_argument('--reporte', default='reportes/metadatos-contratos.json')
    args = parser.parse_args(); root = Path(args.root).resolve()
    manifest = json.loads(contracts.safe(root, args.manifiesto).read_text())
    if manifest.get('version', 1) < 3:
        raise ValueError('Este proceso requiere manifiesto versión 3')
    ctx = contracts.context(root)
    aliases = json.loads((root / 'importacion/alias-sku.json').read_text())
    skus = [aliases.get(s, s) for s in manifest['skus']]; counts = Counter(skus)
    protected = {p: (root / p).read_bytes() for p in ['index.html', contracts.BASE_593, 'seo-pages.json']}
    seo_path = root / 'seo-contenido.json'; before_seo = seo_path.read_bytes(); seo = json.loads(before_seo)
    reference = (root / 'datos-593/REFERENCIA-OFICIAL.md').read_text()
    cut = re.search(r'Inventario exportado el (\d{2}-\d{2}-\d{4})', reference)
    if not cut:
        raise ValueError('No se encontró la fecha del corte validado en referencia 593')
    cut_date = datetime.strptime(cut[1], '%d-%m-%Y').date()
    approved = {}; results = []
    for sku in dict.fromkeys(skus):
        errors = []
        try:
            if counts[sku] != 1:
                raise ValueError('SKU duplicado en el lote')
            approval = manifest.get('aprobaciones', {}).get(sku, {})
            if approval.get('estado') != 'APROBADO' or any(approval.get(k) is not True for k in ('identidad_verificada', 'ficha_verificada', 'uso_comercial_permitido')):
                raise ValueError('Aprobación de identidad, ficha o derechos pendiente')
            contract = contracts.load_contract(root, manifest, sku)
            errors = contracts.validate(root, contract, sku, rule(sku, root), manifest.get('imagenes', {}).get(sku, []), ctx,
                manifest.get('categorias_comerciales'), require_mobile=False)
            if contract.get('stock_fecha_corte') != cut_date.isoformat():
                errors.append({'codigo': 'corte', 'motivo': 'Fecha de stock distinta del corte 593 documentado'})
            if not errors:
                approved[sku] = contract
        except (ValueError, OSError, KeyError, TypeError) as exc:
            errors = [{'codigo': 'contrato', 'motivo': str(exc)}]
        if errors:
            results.append({'sku': sku, 'estado': 'pendiente', 'errores': errors})
    for sku, contract in approved.items():
        previous = dict(seo.get(sku, {})); current = dict(previous)
        metadata = {'tipo': contract['tipo'], 'clasificacionComercial': 'Producto original' if contract['tipo'] == 'original' else 'Producto genérico / compatible',
            'categoriaOriginal': contract['categoria_original'], 'categoriaComercial': contract['categoria_comercial'],
            'unidadVenta': contract['unidad_venta']['descripcion'], 'fechaInventario': cut_date.strftime('%d/%m/%Y'),
            'stockTiempoReal': False, 'presentacion': 'sin caja'}
        for key in ('marca', 'modelo', 'variante'):
            value = contract.get(key)
            if isinstance(value, str) and value.strip(): metadata[key] = value
            else: current.pop(key, None)
        for source, destination in [('contenido_venta', 'contenidoVenta'), ('compatibilidad', 'compatibilidad')]:
            value = contract.get(source)
            # El gate ya exige la ficha revisada y unidad de venta confirmada; no inferir datos faltantes.
            if isinstance(value, str) and value.strip(): metadata[destination] = value
            else: current.pop(destination, None)
        if contract.get('beneficios'):
            metadata['beneficios'] = [{k: b[k] for k in ('valor','titulo','descripcion')} for b in contract['beneficios']]
        else:
            current.pop('beneficios', None)
        # Conservar ventas cruzadas ya revisadas aunque el nuevo lote sea de otra categoría.
        related = []
        for item in previous.get('relacionados', []):
            other = item.get('sku') if isinstance(item, dict) else None
            candidate = ctx['productos'].get(other)
            if not candidate or other == sku or other not in ctx['slugs']:
                continue
            canonical = 'https://conectatech-ec.github.io/productos/' + ctx['slugs'][other] + '/'
            if item.get('url') == canonical and item.get('nombre') == candidate.get('name'):
                related.append(item)
            if len(related) == 3: break
        for other, candidate in approved.items():
            if len(related) >= 3: break
            if other == sku or any(x['sku'] == other for x in related) or candidate['categoria_comercial'] != contract['categoria_comercial']:
                continue
            product = ctx['productos'][other]
            # No enlazar con un nombre todavía sin aplicar o con un nombre histórico cuestionado.
            if product.get('name') != candidate['titulo_comercial']:
                continue
            related.append({'sku': other, 'nombre': product['name'], 'url': candidate['url_publica']})
            if len(related) == 3: break
        metadata['relacionados'] = related; current.update(metadata)
        # Lista cerrada de claves: este proceso no toca SKU, precios, stock ni imágenes.
        seo[sku] = current
        results.append({'sku': sku, 'estado': 'preparado' if current != previous else 'sin_cambios',
                        'campos': sorted(k for k in set(previous) | set(current) if previous.get(k) != current.get(k)),
                        'relacionados': [r['sku'] for r in related]})
    for path, data in protected.items():
        if (root / path).read_bytes() != data:
            raise ValueError('Cambió la base protegida durante la ejecución: ' + path)
    if args.aplicar:
        if seo_path.read_bytes() != before_seo:
            raise ValueError('SEO cambió durante la revisión; repetir para no sobrescribir cambios concurrentes')
        editorial.atomic_write(seo_path, editorial.encode(seo))
        for row in results:
            if row['estado'] == 'preparado': row['estado'] = 'aplicado_local'
    report = {'modo': 'aplicar' if args.aplicar else 'simular', 'resultados': results,
        'precios_stock_sku_urls_imagenes_conservados': True,
        'aprobados': len(approved), 'pendientes': len(results) - len(approved),
        'nota': 'Metadatos locales. El importador editorial sigue a cargo de títulos, descripción y características; la publicación requiere verificación móvil y HTTP.'}
    editorial.atomic_write(contracts.safe(root, args.reporte), editorial.encode(report))
    print(json.dumps({k: report[k] for k in ('modo', 'aprobados', 'pendientes')}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
