#!/usr/bin/env python3
"""Actualiza solo la revisión limitada del feed desde el corte público validado."""
import json, hashlib, re, subprocess
from pathlib import Path
from datetime import date
from generar import load_inventory
def prepare(root, target):
    previous, old = load_inventory(target)
    source = root / 'datos-593/corte-comercial-publico-validado.json'
    data = json.loads(source.read_text())
    state = json.loads((root / 'datos-593/estado-ultimo-corte.json').read_text())
    cut = date.fromisoformat(data['fecha_corte'])
    if cut < date.fromisoformat(old['fecha_corte']) or cut > date.today() or state['fecha_corte'] != data['fecha_corte'] or state['origen_sha256'] != data['sha256_original']:
        raise ValueError('Corte público incoherente o regresivo')
    catalog = json.loads(re.search(r'const products=(\[[\s\S]*?\]);\s*\n', (root / 'index.html').read_text())[1])
    if len({p['sku'] for p in catalog}) != len(catalog):
        raise ValueError('SKU duplicados en catálogo')
    records = []
    for item in sorted(catalog, key=lambda p: p['sku']):
        sku = item['sku']
        p = data['productos'].get(sku)
        if not p:
            continue
        stock, cents = p.get('stock'), p.get('promo_centavos')
        if type(stock) is not int or stock < 0 or type(cents) is not int or cents <= 0:
            continue
        records.append(dict(sku=sku, availability='in_stock' if stock > 0 else 'out_of_stock',
                            precio_coincide_corte=True, precio_publico_validado=f'{cents // 100}.{cents % 100:02d}'))
    if not records:
        raise ValueError('Ningún registro público validado')
    meta = dict(fecha_corte=data['fecha_corte'], archivo_origen=data['fuente'],
        sha256_xlsx_privado=data['sha256_original'],
        fuente_publica='datos-593/corte-comercial-publico-validado.json',
        fuente_publica_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
        fuente_commit=subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True).strip(),
        alcance='Solo SKU del catálogo web presentes en el corte comercial público validado; disponibilidad binaria y precios ya públicos. Sin cantidades.',
        stock_tiempo_real=False, referencias_exportadas=len(records),
        campos_publicos=['sku','availability','precio_coincide_corte','precio_publico_validado'],
        no_publicado=['Excel original','CSV privado','cantidades internas','costos','márgenes'],
        sha256_productos=hashlib.sha256(json.dumps(records,sort_keys=True,separators=(',',':')).encode()).hexdigest(),
        productos=records)
    target.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
    return meta
if __name__ == '__main__':
    prepare(Path('fuente-vigente'),Path('google-merchant/fuentes/vigente.json'))
