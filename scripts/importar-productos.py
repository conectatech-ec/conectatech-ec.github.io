#!/usr/bin/env python3
"""Importación editorial por SKU. Nunca escribe precio, PVP, stock ni la base 593."""
import argparse
import csv
from collections import Counter
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from datetime import datetime, timezone
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PATTERN = re.compile(r'const products=(\[[\s\S]*?\]);\s*\n')
FIELDS = ['sku', 'nombre_comercial', 'descripcion', 'caracteristicas_json', 'fuente',
          'imagen_principal', 'terminos_busqueda', 'verificado']
EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}

def encode(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()

def atomic_write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_bytes() == content:
        return
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as f:
        f.write(content)
        temporary = f.name
    os.replace(temporary, path)

def read_catalog(root):
    html = (root / 'index.html').read_text()
    match = PATTERN.search(html)
    if not match:
        raise ValueError('No se encontró products en index.html')
    products = json.loads(match[1])
    if len({p['sku'] for p in products}) != len(products):
        raise ValueError('SKU duplicados en catálogo')
    return html, products

def financial(products):
    return {p['sku']: (p['promo'], p['pvp'], p['stock']) for p in products}

def run(args):
    root = Path(args.root).resolve()
    html, products = read_catalog(root)
    original_financial = financial(products)
    original_html = (root / 'index.html').read_bytes()
    original_seo = (root / 'seo-contenido.json').read_bytes()
    editorial = json.loads(original_seo)
    from reglas_sku import rule, compatible
    media_path = root / "importacion/medios.json"
    media = json.loads(media_path.read_text()) if media_path.exists() else {}
    aliases_path = root / 'importacion/alias-sku.json'
    aliases = json.loads(aliases_path.read_text()) if aliases_path.exists() else {}
    by_sku = {p['sku']: p for p in products}
    urls = json.loads((root / 'seo-pages.json').read_text())
    if args.plantilla:
        with open(args.plantilla, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=FIELDS)
            writer.writeheader()
            writer.writerows({'sku': p['sku'], 'verificado': 'NO'} for p in products)
        print(f'Plantilla: {len(products)} SKU; sin precios, costos ni stock.')
        return 0
    if not args.csv or not args.imagenes:
        raise ValueError('Se requieren --csv y --imagenes')
    image_root = Path(args.imagenes).resolve()
    if not image_root.is_dir():
        raise ValueError('La carpeta de imágenes no existe')
    candidates = {}
    errors, pending, prepared, unchanged = [], [], [], []
    for f in sorted(image_root.iterdir()):
        if f.suffix.lower() not in EXTENSIONS or not f.is_file():
            continue
        # Sin aproximaciones: SOLO nombre SKU exacto (o alias explícito).
        key = f.stem.upper()
        key = aliases.get(key, key)
        candidates.setdefault(key, []).append(f)
    with open(args.csv, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None or set(reader.fieldnames) != set(FIELDS) or len(reader.fieldnames) != len(FIELDS):
            raise ValueError('Columnas inválidas: usar la plantilla; no se admiten precios/stock/costos ni columnas adicionales')
        rows = list(reader)
    per_sku=getattr(args,'por_sku',False)
    counts=Counter(aliases.get((r.get('sku') or '').strip().upper(),(r.get('sku') or '').strip().upper()) for r in rows)
    seen, writes = set(), {}
    for number, row in enumerate(rows, 2):
        raw_sku = (row.get('sku') or '').strip().upper()
        sku = aliases.get(raw_sku, raw_sku)
        def fail(reason):
            errors.append({'fila': number, 'sku': raw_sku, 'motivo': reason})
        if None in row or any(v is None for v in row.values()):
            fail('Número de columnas incorrecto'); continue
        if sku not in by_sku:
            fail('SKU desconocido; altas deben venir de 593'); continue
        if per_sku and counts[sku]>1:
            fail('SKU duplicado o alias que representa la misma ficha; se omiten todas sus filas');continue
        if sku in seen:
            fail('SKU duplicado o alias que representa la misma ficha'); continue
        seen.add(sku)
        if row['verificado'].strip().upper() not in ('SI', 'NO'):
            fail('verificado debe ser SI o NO'); continue
        if row['verificado'].strip().upper() != 'SI':
            pending.append({'sku': sku, 'motivo': 'Contenido e imagen pendientes de revisión'}); continue
        if any(not row[k].strip() for k in ('nombre_comercial', 'descripcion', 'caracteristicas_json', 'fuente')):
            fail('Contenido aprobado incompleto: nombre, descripción, características y fuente son obligatorios'); continue
        try:
            specs = json.loads(row['caracteristicas_json'])
            if not isinstance(specs, dict) or not specs or any(not isinstance(k, str) or not k.strip() or not isinstance(v, str) or not v.strip() for k, v in specs.items()):
                raise ValueError()
        except (ValueError, TypeError):
            fail('caracteristicas_json debe ser un objeto con textos verificados'); continue
        explicit = row['imagen_principal'].strip()
        if explicit:
            path = (image_root / explicit).resolve()
            if not path.is_relative_to(image_root) or not path.is_file() or path.suffix.lower() not in EXTENSIONS:
                fail('Imagen inexistente, formato inválido o ruta fuera de la carpeta'); continue
        else:
            found = candidates.get(sku, [])
            if len(found) != 1:
                fail('Se requiere exactamente una foto por SKU o imagen_principal explícita'); continue
            path = found[0].resolve()
            if not path.is_relative_to(image_root):
                fail('Enlace a imagen fuera de carpeta'); continue
        try:
            data = path.read_bytes()
            if len(data) > 20 * 1024 * 1024:
                raise ValueError('Imagen mayor de 20 MB')
            with Image.open(io.BytesIO(data)) as im:
                width, height = im.size
                fmt = im.format
                if fmt not in ('JPEG', 'PNG', 'WEBP') or getattr(im, 'n_frames', 1) != 1:
                    raise ValueError('Solo fotografías estáticas JPEG, PNG o WebP')
                if min(width, height) < 500 or max(width, height) < 800:
                    raise ValueError(f'Resolución insuficiente: {width}x{height}; no se amplían miniaturas')
                if width * height > 40_000_000:
                    raise ValueError('Más de 40 megapíxeles')
                im.verify()
        except Exception as exc:
            fail('Imagen inválida: ' + str(exc)); continue
        digest = hashlib.sha256(data).hexdigest()
        extension = {'JPEG': '.jpg', 'PNG': '.png', 'WEBP': '.webp'}[fmt]
        relative = f'imagenes/{sku.lower()}/original-{digest[:16]}{extension}'
        image_url = '/' + relative
        p = by_sku[sku]
        before = json.dumps([p, editorial.get(sku)], sort_keys=True)
        name = row['nombre_comercial'].strip()
        description = row['descripcion'].strip()
        p.update(name=name, imageUrl=image_url, specs=specs,
                 searchTerms=' '.join([sku, raw_sku, row['terminos_busqueda'].strip()]))
        custom = dict(editorial.get(sku, {}))
        # Estas claves editoriales comparten la fuente; no afectan valores 593.
        custom.update(nombre=name, tituloSeo=name+' en Quito | ConectaTech',
                      descripcionSeo=description[:160], descripcion=description,
                      caracteristicas=specs, imagen=image_url, comercialVerificado=True,
                      fuenteVerificacion=row['fuente'].strip(),
                      imagenOriginal={'sha256': digest, 'ancho': width, 'alto': height})
        if row['fuente'].strip().startswith('https://'):
            custom['fuenteOficial'] = row['fuente'].strip()
        else:
            custom.pop('fuenteOficial', None)
        policy = rule(sku, root)
        managed = media.get(sku, {})
        cover = next((i for i in managed.get('imagenes', []) if i['posicion']==1 and compatible(policy, i, True)), None)
        known_sources = {i.get('sha256_original') for i in managed.get('imagenes', [])}
        known_sources.add(editorial.get(sku, {}).get('imagenOriginal', {}).get('sha256'))
        if managed.get('revision_regla') != policy['revision'] or digest not in known_sources:
            cover = None
            media[sku] = {'revision_regla': policy['revision'], 'regla': policy, 'imagenes': []}

        # La carga editorial y la producción visual son pasos distintos.
        p['imageUrl'] = cover['versiones']['1200']['url'] if cover else ''
        custom['imagen'] = p['imageUrl']
        custom['imagenPendiente'] = not bool(cover)
        custom['reglaSKU'] = policy
        if cover: custom['imagenProfesional'] = cover
        else:
            for key in ('imagenProfesional','galeria','banner'): custom.pop(key, None)
            pending.append({'sku': sku, 'motivo': 'Original archivado; ejecutar producción visual contra reglas vigentes'})
        editorial[sku] = custom
        writes[root / relative] = data
        item = {'sku': sku, 'solicitado': raw_sku, 'imagen': image_url,
                'resolucion': f'{width}x{height}', 'sha256': digest,
                'url': 'https://conectatech-ec.github.io/productos/'+urls[sku]+'/'}
        after = json.dumps([p, custom], sort_keys=True)
        (unchanged if before == after and (root / relative).exists() else prepared).append(item)
    if financial(products) != original_financial:
        raise ValueError('Invariante falló: intento de modificar precio o stock')
    report = {'fecha': datetime.now(timezone.utc).isoformat(),
              'modo': 'aplicar' if args.aplicar else 'simular',
              'total_catalogo': len(products), 'filas_lote': len(rows), 'fuera_del_lote_sin_revisar': len(products)-len(seen),
              'preparados': prepared, 'sin_cambios': unchanged, 'pendientes': pending, 'errores': errors,
              'aplicados': [], 'publicados': [],
              'nota': 'Aplicar modifica archivos locales. Solo el despliegue y la verificación HTTP confirman publicación.',
              'precios_stock_conservados': True}
    if args.aplicar and (per_sku or not errors):
        if original_html != (root/'index.html').read_bytes() or original_seo != (root/'seo-contenido.json').read_bytes():
            raise ValueError('El catálogo cambió durante la validación; vuelva a simular')
        replacement = 'const products='+json.dumps(products, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')+';\n'
        new_html = PATTERN.sub(lambda _: replacement, html, count=1).encode()
        # Tras validar TODO el lote, fotos primero y referencias al final.
        for path, data in writes.items():
            atomic_write(path, data)
        atomic_write(root/'importacion/medios.json', encode(media))
        atomic_write(root/'seo-contenido.json', encode(editorial))
        atomic_write(root/'index.html', new_html)
        report['aplicados'] = prepared
    destination = Path(args.reporte)
    atomic_write(destination, encode(report))
    summary = {key: len(report[key]) for key in ('preparados','sin_cambios','pendientes','errores','aplicados','publicados')}
    print(json.dumps(summary, ensure_ascii=False))
    return 1 if errors else 0

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default=str(ROOT))
    parser.add_argument('--csv')
    parser.add_argument('--imagenes')
    parser.add_argument('--aplicar', action='store_true')
    parser.add_argument('--por-sku', action='store_true', help='Aplicar filas válidas aunque otro SKU falle; duplicados nunca se aplican')
    parser.add_argument('--plantilla')
    parser.add_argument('--reporte', default='reportes/importacion-productos.json')
    args = parser.parse_args()
    try:
        sys.exit(run(args))
    except Exception as exc:
        atomic_write(Path(args.reporte), encode({'errores': [{'motivo': str(exc)}], 'aplicados': [], 'publicados': []}))
        print(str(exc), file=sys.stderr)
        sys.exit(1)
