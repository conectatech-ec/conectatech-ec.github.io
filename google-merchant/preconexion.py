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
from generar import load_inventory, download, BASE


def inspect(root, out):
    summary = json.loads((out / 'validacion.json').read_text())
    proofs = json.loads((out / 'evidencias.json').read_text())
    raw_index = (root / 'index.html').read_text()
    products = json.loads(re.search(r'const products=(\[[\s\S]*?\]);\s*\n', raw_index)[1])
    master_path = Path(__file__).resolve().parent / 'fuentes/vigente.json'
    records, inventory_meta = load_inventory(master_path)
    master = {row['sku']: row for row in records}
    dates = Counter(str(p.get('fecha_inventario')) for p in proofs)
    mismatches = []
    for product in products:
        row = master.get(product['sku'])
        if not row:
            continue
        availability = 'in_stock' if product['stock'] > 0 else 'out_of_stock'
        if availability != row['availability']:
            mismatches.append({'sku': product['sku'], 'motivo': 'disponibilidad_web_difiere_corte16'})
        if row['precio_coincide_corte'] is not True or Decimal(str(product['promo'])) != Decimal(row['precio_publico_validado']):
            mismatches.append({'sku': product['sku'], 'motivo': 'precio_web_no_validado_con_corte16'})
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
    cut = inventory_meta['fecha_corte']
    age = (datetime.now(timezone.utc).date() - datetime.strptime(cut, '%Y-%m-%d').date()).days
    domain = {'sitio': BASE + '/', 'cuenta_merchant': '5874003439',
              'archivo_verificacion_existente': BASE + '/google8bb019c7a5a192ed.html',
              'estado_cuenta': 'NO_COMPROBABLE_SIN_ACCESO_MERCHANT_CENTER',
              'requiere_usuario': 'Comparar el archivo o token que pide Google en la cuenta 5874003439; completar Verificar y después Reclamar. Archivo público presente no prueba reclamación ni titularidad de esa cuenta.'}
    if summary['validacion'] == 'local_y_http_publico':
        for label, url in [('sitio', BASE + '/'), ('archivo', domain['archivo_verificacion_existente']), ('robots', BASE + '/robots.txt')]:
            try:
                raw, content_type = download(url)
                document = raw.decode('utf-8')
                domain[label + '_https'] = 'HTTP 200, sin redirección'
                if label == 'archivo':
                    domain['contenido_archivo_correcto'] = document.strip() == 'google-site-verification: google8bb019c7a5a192ed.html'
                elif label == 'sitio':
                    domain['meta_google_site_verification_presente'] = bool(re.search(r'<meta[^>]+name=["\']google-site-verification', document, re.I))
                else:
                    import urllib.robotparser
                    robot = urllib.robotparser.RobotFileParser()
                    robot.parse(document.splitlines())
                    domain['rastreo_googlebot_permitido'] = robot.can_fetch('Googlebot', BASE + '/')
                    domain['rastreo_imagenes_permitido'] = robot.can_fetch('Googlebot-image', BASE + '/imagenes/arod001/AROD001-01.webp')
            except Exception as exc:
                domain[label + '_https'] = 'NO_VERIFICADO: ' + str(exc)
    live = sum(p.get('http_publico') == 'verificado' for p in proofs)
    data = dict(
        merchant_center='5874003439', verificado_en_utc=datetime.now(timezone.utc).isoformat(),
        fuente_commit=summary['source_commit'], fuente_rama='main (lectura solamente)',
        inventario_sha256=hashlib.sha256(master_path.read_bytes()).hexdigest(), fecha_corte=cut, antiguedad_corte_dias=age,
        inventario_origen=inventory_meta['archivo_origen'], origen_privado_sha256=inventory_meta['sha256_xlsx_privado'],
        articulos_feed=summary['incluidos'], articulos_con_http_publico_verificado=live,
        coherencia_catalogo_maestro={'sku_web': len(products), 'sku_con_revision_corte16': len(records), 'discrepancias': mismatches, 'nota': 'Revisión limitada a los SKU del feed anterior, sin cantidades internas ni precios privados. SKU sin esta revisión quedan excluidos; diferencias de precio o de disponibilidad con la ficha excluyen el artículo.'},
        precio_final_documentado='Corte corregido16: Q V. TOTAL = contado; X PVP + Y importe de IVA = PVP final. IVA incluido. Sin recalcular porcentajes ni modificar precios web.',
        fechas_inventario_en_articulos=dict(dates), stock_tiempo_real_acreditado=sum(p.get('stock_tiempo_real') is True for p in proofs),
        observaciones_fichas=dict(counts), enlaces_politicas_en_fichas=sorted(policy_links),
        dominio_merchant=domain,
        estado='BLOQUEADO_PARA_PUBLICACION', publicacion_habilitada=False,
        bloqueos=[
            {'tema': 'stock', 'estado': 'CORTE16_APLICADO; NO_TIEMPO_REAL', 'accion': 'Mantener actualizada la extracción de 593. El feed usa exclusivamente el corte16 corregido; excluye disponibilidad incompatible con la ficha y no modifica producción. Un corte no es inventario en tiempo real.'},
            {'tema': 'precio', 'estado': 'IVA_DOCUMENTADO; COMPRA_FINAL_PENDIENTE', 'accion': 'Confirmar que el precio contado es accesible al comprador y coincide con el total del producto al comprar, con gastos de envío separados y conocidos antes de confirmar.'},
            {'tema': 'compra', 'estado': 'NO_ACREDITADA_COMPRA_COMPLETA_EN_SITIO', 'accion': 'Demostrar proceso completo de pedido en el sitio, confirmación y entrega estimada; WhatsApp de consulta y panel de cotizaciones no acreditan este requisito. Contraentrega es admisible como método de pago, pero no reemplaza un proceso de compra verificable.'},
            {'tema': 'envios', 'estado': 'COBERTURA_COSTO_PLAZOS_PENDIENTES', 'accion': 'Documentar cobertura real (Quito u otras zonas), tarifas, manejo y tránsito. No asumir cobertura nacional ni envío gratis. Ecuador no aparece en la lista general de países donde el atributo shipping es obligatorio; eso no permite informar condiciones falsas o no aclarar gastos de compra.'},
            {'tema': 'devoluciones', 'estado': 'POLITICA_COMPLETA_NO_IDENTIFICADA', 'accion': 'Facilitar URL pública con condiciones reales de devolución/reembolso, plazos, procedimiento y costos. Garantía no equivale a devolución.'},
            {'tema': 'cuenta', 'estado': 'SIN_ACCESO_CONECTADO', 'accion': 'En la cuenta 5874003439 comprobar dominio verificado/reclamado, datos de empresa y contacto, Ecuador/español/USD y diagnósticos. No se modificó la cuenta.'},
        ],
        siguiente_paso='En Merchant Center 5874003439, Configuración > Información de empresa > Tienda online: verificar y reclamar https://conectatech-ec.github.io/. Añadir la URL estable como fuente Ecuador/español/USD manteniendo exclusiones; no habilitar hasta confirmar compra completa, envíos, devoluciones y discrepancias pendientes.',
        automatizacion={'cada_ejecucion': 'Obtiene el HEAD actual de main en una copia separada, valida y escribe únicamente en feeds/google-merchant-ec.',
                        'programacion': 'Preparada mediante tarea cloud que escribe solo solicitud-actualizacion.json en la rama de integración y dispara GitHub Actions. No depende de laptop ni del schedule de main.',
                        'estado_programacion': 'Consultar automatización ChatGPT; este informe no presupone que esté creada o activa.',
                        'actualizacion_inventario': 'Usa el CSV depurado vigente y su manifiesto con hash. Un nuevo corte requiere un archivo real autorizado; no inventa ni refresca artificialmente su fecha.'},
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
