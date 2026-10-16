#!/usr/bin/env python3
"""Informe de preparación; no cambia el catálogo ni configura Merchant Center."""
import argparse
import csv
import hashlib
import json
import re
import subprocess
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path


def inspect(root, out):
    summary = json.loads((out / 'validacion.json').read_text())
    proofs = json.loads((out / 'evidencias.json').read_text())
    raw_index = (root / 'index.html').read_text()
    products = json.loads(re.search(r'const products=(\[[\s\S]*?\]);\s*\n', raw_index)[1])
    master_path = root / 'datos-593/inventario-publico.csv'
    with master_path.open(newline='') as f:
        master = {row['sku']: row for row in csv.DictReader(f)}
    dates = Counter(str(p.get('fecha_inventario')) for p in proofs)
    mismatches = []
    for product in products:
        row = master.get(product['sku'])
        if not row:
            mismatches.append({'sku': product['sku'], 'motivo': 'sin_maestro'})
            continue
        for field, column in [('stock', 'stock'), ('promo', 'promo_contado'), ('pvp', 'pvp_final')]:
            if Decimal(str(product.get(field))) != Decimal(row[column]):
                mismatches.append({'sku': product['sku'], 'motivo': field + '_difiere_maestro'})
    counts = Counter()
    policy_links = set()
    urls = json.loads((root / 'seo-pages.json').read_text())
    for proof in proofs:
        slug_url = urls[proof['sku']]
        document = (root / 'productos' / slug_url / 'index.html').read_text()
        for label, pattern in [('fichas_con_whatsapp', r'https://wa\.me/'),
                               ('fichas_con_contraentrega_quito', r'Envíos contraentrega en Quito'),
                               ('fichas_con_precio_sujeto_confirmacion', r'Precios y disponibilidad sujetos a confirmación'),
                               ('fichas_con_formulario', r'<form\b')]:
            counts[label] += bool(re.search(pattern, document, re.I))
        for href in re.findall(r'href=["\']([^"\']+)["\']', document):
            if re.search(r'devol|reembol|return|shipping|envio|envío|politica|política', href, re.I):
                policy_links.add(href)
    reference = (root / 'datos-593/REFERENCIA-OFICIAL.md').read_text()
    cut_match = re.search(r'exportado el (\d{2}-\d{2}-\d{4})', reference)
    cut = cut_match.group(1) if cut_match else None
    age = (datetime.now(timezone.utc).date() - datetime.strptime(cut, '%d-%m-%Y').date()).days if cut else None
    live = sum(p.get('http_publico') == 'verificado' for p in proofs)
    data = dict(
        merchant_center='5874003439', verificado_en_utc=datetime.now(timezone.utc).isoformat(),
        fuente_commit=summary['source_commit'], fuente_rama='main (lectura solamente)',
        inventario_sha256=hashlib.sha256(master_path.read_bytes()).hexdigest(), fecha_corte=cut, antiguedad_corte_dias=age,
        articulos_feed=summary['incluidos'], articulos_con_http_publico_verificado=live,
        coherencia_catalogo_maestro={'sku_revisados': len(products), 'discrepancias': mismatches},
        precio_final_documentado='REFERENCIA-OFICIAL: promo_contado = V. TOTAL; PVP final = PVP + importe IVA. Ambos IVA incluido. No se recalculan.',
        fechas_inventario_en_articulos=dict(dates), stock_tiempo_real_acreditado=sum(p.get('stock_tiempo_real') is True for p in proofs),
        observaciones_fichas=dict(counts), enlaces_politicas_en_fichas=sorted(policy_links),
        estado='BLOQUEADO_PARA_PUBLICACION', publicacion_habilitada=False,
        bloqueos=[
            {'tema': 'stock', 'estado': 'NO_ACREDITADO_VIGENTE', 'accion': 'Obtener corte depurado vigente de 593 con fecha de extracción, SKU, stock y precios finales. No importar ni modificar producción desde esta integración.'},
            {'tema': 'precio', 'estado': 'IVA_DOCUMENTADO; COMPRA_FINAL_PENDIENTE', 'accion': 'Confirmar que el precio contado es accesible al comprador y coincide con el total del producto al comprar, con gastos de envío separados y conocidos antes de confirmar.'},
            {'tema': 'compra', 'estado': 'NO_ACREDITADA_COMPRA_COMPLETA_EN_SITIO', 'accion': 'Demostrar proceso completo de pedido en el sitio, confirmación y entrega estimada; WhatsApp de consulta y panel de cotizaciones no acreditan este requisito. Contraentrega es admisible como método de pago, pero no reemplaza un proceso de compra verificable.'},
            {'tema': 'envios', 'estado': 'COBERTURA_COSTO_PLAZOS_PENDIENTES', 'accion': 'Documentar cobertura real (Quito u otras zonas), tarifas, manejo y tránsito. No asumir cobertura nacional ni envío gratis. Ecuador no aparece en la lista general de países donde el atributo shipping es obligatorio; eso no permite informar condiciones falsas o no aclarar gastos de compra.'},
            {'tema': 'devoluciones', 'estado': 'POLITICA_COMPLETA_NO_IDENTIFICADA', 'accion': 'Facilitar URL pública con condiciones reales de devolución/reembolso, plazos, procedimiento y costos. Garantía no equivale a devolución.'},
            {'tema': 'cuenta', 'estado': 'SIN_ACCESO_CONECTADO', 'accion': 'En la cuenta 5874003439 comprobar dominio verificado/reclamado, datos de empresa y contacto, Ecuador/español/USD y diagnósticos. No se modificó la cuenta.'},
        ],
        siguiente_paso='Confirmar en Merchant Center 5874003439 la verificación y reclamación del dominio del catálogo; mantener los destinos excluidos. Para activar productos hacen falta stock vigente, compra completa y políticas reales.',
        automatizacion={'cada_ejecucion': 'Obtiene el HEAD actual de main en una copia separada, valida y escribe únicamente en feeds/google-merchant-ec.',
                        'programacion_activa': False, 'motivo': 'GitHub solo ejecuta schedules desde la rama predeterminada. El workflow permanece en la rama aislada; no se modificó main.',
                        'activacion_sin_main': 'Requiere un ejecutor programado independiente gratuito autorizado; no se ha creado ni contratado ningún servicio.'},
        fuentes_oficiales=[
            'https://support.google.com/merchants/answer/160637?hl=es',
            'https://support.google.com/merchants/answer/10249082?hl=es',
            'https://support.google.com/merchants/answer/13889434?hl=es',
            'https://support.google.com/merchants/answer/14011730?hl=es'],
        costo=0)
    (out / 'preconexion.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'articulos_feed': len(proofs), 'corte': cut, 'desacuerdos_precios_stock': len(mismatches), 'estado': data['estado']}, ensure_ascii=False))
    return data


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--root', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    args = p.parse_args()
    inspect(args.root.resolve(), args.output.resolve())
