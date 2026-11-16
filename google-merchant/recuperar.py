#!/usr/bin/env python3
"""Conciliar catálogo y preparar lotes aislados; no publica ni habilita destinos."""
import argparse
import concurrent.futures
import hashlib
import json
import re
import subprocess
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import generar as feed
from conciliacion import Reconciler


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def reconcile(root, output, inventory, published_feed, public=False):
    root, output = root.resolve(), output.resolve()
    # Nunca se escribe dentro de la fuente web ni en el directorio operativo del generador.
    if output.is_relative_to(root) or output == Path(__file__).resolve().parent:
        raise ValueError('Usar una salida de revisión fuera de la fuente web y del feed operativo')
    raw_index = (root / 'index.html').read_text()
    products = json.loads(re.search(r'const products=(\[[\s\S]*?\]);\s*\n', raw_index)[1])
    if len({p['sku'] for p in products}) != len(products):
        raise ValueError('SKU duplicado en fuente')
    seo = json.loads((root / 'seo-contenido.json').read_text())
    urls = json.loads((root / 'seo-pages.json').read_text())
    records, meta = feed.load_inventory(inventory)
    master = {p['sku']: p for p in records}
    original_xml = published_feed.read_bytes()
    original_items = ET.fromstring(original_xml).findall('./channel/item')
    ids = [row.find('{' + feed.NS + '}id').text for row in original_items]
    if len(set(ids)) != len(ids) or set(ids) - {p['sku'] for p in products}:
        raise ValueError('Feed publicado incoherente con catálogo')
    original_ids = set(ids)
    # Mantener product_type de la exportación vigente sin leer finanzas privadas.
    import csv
    with (root / 'datos-593/inventario-publico.csv').open(newline='') as handle:
        for row in csv.DictReader(handle):
            if row['sku'] in master:
                master[row['sku']]['categoria'] = row.get('categoria', '')
    context = Reconciler(root)
    if meta.get('fuente_commit') != context.commit:
        raise ValueError('La revisión de inventario no corresponde al snapshot web')
    entries, pairs, original_pairs = {}, [], []
    for p in sorted(products, key=lambda item: item['sku']):
        sku = p['sku']
        entry = dict(sku=sku, incluido_feed_original=sku in original_ids, motivo_original=None,
                     categoria='NO_ELEGIBLE', motivo_actual=None, aprobaciones_faltantes=[])
        entries[sku] = entry
        args = (root, p, seo.get(sku, {}), urls.get(sku), master.get(sku))
        try:
            original_pairs.append(feed.candidate(*args))
        except (ValueError, OSError, KeyError, TypeError) as exc:
            entry['motivo_original'] = str(exc)
        try:
            row, proof = feed.candidate(*args, reconciler=context)
            proof.update(contrato_sha256=hashlib.sha256((root / proof['contrato']).read_bytes()).hexdigest(),
                         aprobaciones_existentes=context.proofs.get(sku, []))
            pairs.append((row, proof))
            entry.update(categoria='YA_INCLUIDO' if sku in original_ids else 'RECUPERABLE_TECNICAMENTE',
                         motivo_actual='Controles satisfechos; destinos excluidos', availability=row['availability'],
                         evidencias=proof)
        except (ValueError, OSError, KeyError, TypeError) as exc:
            entry['motivo_actual'] = str(exc)
            if sku in original_ids:
                raise ValueError('Regresión en SKU ya incluido: ' + sku + ': ' + str(exc)) from exc
            cp = root / 'importacion/contratos' / (sku + '.json')
            c = json.loads(cp.read_text()) if cp.is_file() else {}
            identity = c.get('validaciones', {}).get('identidad', {})
            if str(exc) == 'aprobacion_premium_por_sha_pendiente':
                entry.update(categoria='PENDIENTE_APROBACION_COMERCIAL',
                             aprobaciones_faltantes=['Aprobación visual por SHA y fidelidad del maestro premium activo; no basta la aprobación histórica sin SHA/fecha.'])
            elif identity.get('sku_verificado') is False and identity.get('discrepancias_pendientes'):
                entry.update(categoria='PENDIENTE_APROBACION_COMERCIAL',
                             aprobaciones_faltantes=['Resolver la colisión documentada de identidad/modelos antes de aprobar una fotografía y ficha del SKU.'])
            if not p.get('imageUrl') and not seo.get(sku, {}).get('imagen') and not cp.is_file():
                entry['motivo_actual'] = 'Sin portada comercial en catálogo/SEO ni contrato aprobado; una confirmación de originalidad o título editorial no acredita fotografía apta.'
            if sku == 'CAMA010' and p.get('stock') == -1:
                entry['motivo_actual'] = 'Stock -1 en catálogo y corte comercial público validado; no se transforma en 0 ni se reutiliza el CSV histórico con stock positivo.'
            if sku == 'MICR27' and not cp.is_file():
                entry['motivo_actual'] = 'Sin contrato de identidad/unidad/publicación verificable. Imagen de referencia de fabricante no sustituye documentación de elegibilidad.'
            if sku == 'TELF001' and c.get('estado_calidad') == 'REVISAR':
                entry['motivo_actual'] = 'Sin portada comercial aprobada: contrato REVISAR, sin revisión visual y derechos de la imagen comercial pendientes. La identificación del producto no autoriza una portada.'
            if sku == 'TELF012' and identity.get('sku_verificado') is False:
                entry['motivo_actual'] = 'Colisión de identidad Samsung Galaxy A17 / Redmi A7 Pro documentada; contrato BLOQUEADO, SKU y variante sin verificar. Stock0 conservado.'
            if sku == 'BILL006' and p.get('stock') == 0 and 'Anulado' in seo.get(sku, {}).get('reglaSKU', {}).get('instrucciones', ''):
                entry['motivo_actual'] = 'Producción anulada por orden del propietario; stock0, sin portada. Conservar SKU y no reencolar.'
    if feed.xml_feed([row for row, _ in original_pairs]) != original_xml:
        raise ValueError('La línea base no reproduce exactamente el XML publicado; revisar antes de conciliar')
    if public:
        checked = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            futures = {pool.submit(feed.verify_public, pair): pair for pair in pairs}
            for future in concurrent.futures.as_completed(futures):
                row, proof = futures[future]
                try:
                    verified = future.result()
                    checked.append((row, verified))
                    entries[row['id']]['evidencias'] = verified
                except Exception as exc:
                    if row['id'] in original_ids:
                        raise ValueError('Fallo HTTPS de producto ya incluido: ' + row['id']) from exc
                    entries[row['id']].update(categoria='NO_ELEGIBLE', motivo_actual='HTTP actual: ' + str(exc))
                    entries[row['id']].pop('evidencias', None)
                if len(checked) and len(checked) % 100 == 0:
                    print('HTTPS verificados: ' + str(len(checked)), flush=True)
        pairs = sorted(checked, key=lambda pair: pair[0]['id'])
    rows = [row for row, _ in pairs]
    context.verify_snapshot()
    for row, proof in pairs:
        checks = [(root / proof['contrato'], proof['contrato_sha256']),
                  (root / 'productos' / urls[row['id']] / 'index.html', proof['html_sha256']),
                  (root / row['image_link'].removeprefix(feed.BASE).lstrip('/'), proof['imagen_sha256'])]
        if any(hashlib.sha256(path.read_bytes()).hexdigest() != digest for path, digest in checks):
            raise ValueError('Cambio concurrente en producto: ' + row['id'])
    additions = [(row, proof) for row, proof in pairs if row['id'] not in original_ids]
    xml = feed.xml_feed(rows)
    output.mkdir(parents=True, exist_ok=True)
    (output / 'productos-recuperados.xml').write_bytes(xml)
    batches = output / 'lotes'
    batches.mkdir(exist_ok=True)
    batch_summary = []
    for start in range(0, len(additions), 50):
        batch = additions[start:start + 50]
        name = f'lote-{start // 50 + 1:03d}'
        data = feed.xml_feed([row for row, _ in batch])
        (batches / (name + '.xml')).write_bytes(data)
        proof = dict(lote=name, publicacion_habilitada=False, sku=[row['id'] for row, _ in batch],
                     xml_sha256=hashlib.sha256(data).hexdigest(), evidencias=[p for _, p in batch])
        write_json(batches / (name + '.json'), proof)
        batch_summary.append({key: proof[key] for key in ['lote', 'sku', 'xml_sha256']})
    summary = dict(fecha=datetime.now(ZoneInfo('America/Guayaquil')).isoformat(),
                   source_commit=context.commit, fecha_corte=meta['fecha_corte'],
                   publicacion_habilitada=False, shopping_ads_habilitado=False, costo_adicional=0,
                   alcance='Recuperación técnica del XML de validación. Requisitos globales y activación de fichas gratuitas continúan pendientes en PR #313/#363.',
                   total_sku=len(products), categorias=dict(Counter(e['categoria'] for e in entries.values())),
                   adicionales_con_aprobaciones_existentes=len(additions),
                   adicionales_disponibles=sum(r['availability'] == 'in_stock' for r, _ in additions),
                   adicionales_agotados=sum(r['availability'] == 'out_of_stock' for r, _ in additions),
                   articulos_xml_preparado=len(rows), xml_sha256=hashlib.sha256(xml).hexdigest(),
                   xml_publicado_sha256=hashlib.sha256(original_xml).hexdigest(),
                   linea_base_identica=True, validacion='local_y_https' if public else 'local_HTTP_pendiente',
                   destinos_excluidos_en_todos=['Shopping_ads', 'Free_listings'], lotes=batch_summary)
    write_json(output / 'resumen.json', summary)
    write_json(output / 'conciliacion-1199.json', list(entries.values()))
    print(json.dumps({k: summary[k] for k in ['total_sku', 'categorias', 'adicionales_con_aprobaciones_existentes', 'articulos_xml_preparado', 'validacion']}, ensure_ascii=False))
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--inventory', type=Path, required=True)
    parser.add_argument('--published-feed', type=Path, required=True)
    parser.add_argument('--verify-public', action='store_true')
    args = parser.parse_args()
    reconcile(args.root, args.output, args.inventory, args.published_feed, args.verify_public)
