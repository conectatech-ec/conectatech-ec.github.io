#!/usr/bin/env python3
"""Pruebas de fechas efectivas con contenido/HTTP sintéticos, sin acceso a producción."""
import copy
import hashlib
import html
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('updates', ROOT / 'scripts/registrar-actualizaciones.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)


class UpdateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup); self.root = Path(self.temp.name)
        self.products = {}; self.seo = {}; self.slugs = {}; self.initial = '2026-10-10T06:49:51+00:00'
        for sku, color in [('TEST001', 'blue'), ('TEST002', 'red')]:
            versions = {}
            folder = self.root / 'imagenes' / sku.lower(); folder.mkdir(parents=True)
            for size in ('300', '600', '1200'):
                path = folder / (sku + '-01' + ('' if size == '1200' else '-' + size) + '.webp')
                Image.new('RGB', (int(size), int(size)), color).save(path, 'WEBP')
                versions[size] = {'url': '/' + str(path.relative_to(self.root)), 'sha256': m.sha(path.read_bytes())}
            name = 'Producto ' + sku; image = versions['1200']['url']
            self.products[sku] = {'sku': sku, 'name': name, 'category': 'Prueba', 'promo': 9.25, 'pvp': 10.64, 'stock': 2, 'imageUrl': image, 'specs': {'Color': color, 'Tipo': 'Accesorio'}}
            self.seo[sku] = {'nombre': name, 'descripcion': 'Descripción de prueba.', 'caracteristicas': dict(self.products[sku]['specs']), 'imagen': image,
                'imagenPendiente': False, 'imagenProfesional': {'posicion': 1, 'contiene_caja': False, 'versiones': versions},
                'tituloSeo': name + ' | Tienda', 'descripcionSeo': 'Descripción SEO de prueba', 'categoriaComercial': 'Accesorios', 'contenidoVenta': '1 accesorio',
                'compatibilidad': 'Según el equipo', 'unidadVenta': '1 unidad', 'reglaSKU': {'autenticidad': 'original verificado', 'revision': 1}}
            self.slugs[sku] = sku.lower()
        self.write_inputs()

    def write_inputs(self):
        (self.root / 'index.html').write_text('const products=' + json.dumps(list(self.products.values())) + ';\n')
        (self.root / 'seo-contenido.json').write_text(json.dumps(self.seo))
        (self.root / 'seo-pages.json').write_text(json.dumps(self.slugs))

    def http_report(self, date=None):
        self.write_inputs(); rows = []
        for sku, product in self.products.items():
            c = self.seo[sku]; url = m.ORIGIN + '/productos/' + self.slugs[sku] + '/'
            schema = {'sku': sku, 'name': c['nombre'], 'description': c['descripcion'], 'offers': {'price': str(product['promo']), 'priceCurrency': 'USD',
                      'availability': 'https://schema.org/' + ('InStock' if product['stock'] > 0 else 'OutOfStock')}}
            body = '<html><head><title>' + html.escape(c['tituloSeo']) + '</title><meta name="description" content="' + html.escape(c['descripcionSeo'], quote=True) + '"><link rel="canonical" href="' + url + '">'
            body += '<script type="application/ld+json">' + json.dumps(schema) + '</script></head><body><img src="' + c['imagen'] + '">'
            body += '<p>' + html.escape(' '.join([c['categoriaComercial'], c['contenidoVenta'], c['compatibilidad']] + [str(x) for pair in c['caracteristicas'].items() for x in pair])) + '</p></body></html>'
            path = self.root / 'productos' / self.slugs[sku] / 'index.html'; path.parent.mkdir(parents=True, exist_ok=True); path.write_text(body)
            rows.append({'sku': sku, 'estado': 'publicado_verificado', 'http': 200, 'imagen_pendiente': False, 'url': url,
                'promo': product['promo'], 'pvp': product['pvp'], 'stock_catalogo': product['stock'], 'sha256_ficha': m.sha(path.read_bytes()),
                'imagen': m.ORIGIN + c['imagen'], 'versiones_verificadas': [{'tamano': '01-' + size, 'http': 200, 'sha256': v['sha256']} for size, v in c['imagenProfesional']['versiones'].items()]})
        return {'fecha': date or self.initial, 'resultados': rows}

    def register(self, report, previous=None):
        return m.register(self.root, report, previous or {}, 'reportes/prueba-http.json', m.sha(json.dumps(report).encode()))

    def test_only_published_unique_sku_bootstrap(self):
        report = self.http_report(); report['resultados'][1]['estado'] = 'ficha_existente_imagen_pendiente'
        report['resultados'].append({'sku': 'DESCONOCIDO'})
        state, rows = self.register(report)
        self.assertEqual(set(state['productos']), {'TEST001'})
        self.assertEqual(state['productos']['TEST001']['actualizadoEn'], self.initial)
        self.assertEqual(sum(r['estado'] == 'pendiente' for r in rows), 2)

    def test_reverification_price_stock_sources_and_qa_do_not_change_date_or_state(self):
        state, _ = self.register(self.http_report()); original = copy.deepcopy(state)
        self.products['TEST001'].update(promo=12.5, pvp=14.38, stock=0)
        self.seo['TEST001'].update(fecha_verificacion='2099-01-01', fuenteVerificacion='Nueva fuente interna', fechaInventario='09/10/2026')
        self.seo['TEST001']['reglaSKU'].update(revision=10, evidencia_autenticidad='Misma clasificación con otra referencia')
        after, rows = self.register(self.http_report('2026-10-11T12:00:00+00:00'), state)
        self.assertEqual(after, original); self.assertTrue(all(x['estado'] == 'sin_cambios' for x in rows))
        self.assertEqual(m.payload(after)['ordenPredeterminado'], 'recientes')

    def test_real_title_update_changes_only_one_sku_and_keeps_history(self):
        state, _ = self.register(self.http_report()); self.products['TEST001']['name'] = 'Título nuevo'
        self.seo['TEST001']['nombre'] = 'Título nuevo'; self.seo['TEST001']['tituloSeo'] = 'Título nuevo | Tienda'
        after, _ = self.register(self.http_report('2026-10-11T07:00:00+00:00'), state)
        self.assertEqual(after['productos']['TEST002'], state['productos']['TEST002'])
        self.assertEqual(after['productos']['TEST001']['actualizadoEn'], '2026-10-11T07:00:00+00:00')
        self.assertEqual(after['productos']['TEST001']['historial'][0]['huella'], state['productos']['TEST001']['huella'])

    def test_explicit_default_order_persists_without_touching_product_dates(self):
        state, _ = self.register(self.http_report()); before = copy.deepcopy(state['productos'])
        m.set_default_order(state, 'precio-asc')
        self.assertEqual(m.payload(state)['ordenPredeterminado'], 'precio-asc')
        after, _ = self.register(self.http_report('2026-10-11T07:00:00+00:00'), state)
        self.assertEqual(after['productos'], before)
        self.assertEqual(m.payload(after)['ordenPredeterminado'], 'precio-asc')
        with self.assertRaises(ValueError): m.set_default_order(after, 'inventado')

    def test_actual_image_bytes_update_requires_matching_http_evidence(self):
        state, _ = self.register(self.http_report()); versions = self.seo['TEST001']['imagenProfesional']['versiones']
        path = self.root / versions['600']['url'].lstrip('/'); Image.new('RGB', (600, 600), 'green').save(path, 'WEBP')
        report = self.http_report('2026-10-11T07:00:00+00:00')
        after, rows = self.register(report, state)
        self.assertEqual(after, state); self.assertEqual(rows[0]['estado'], 'pendiente')
        versions['600']['sha256'] = m.sha(path.read_bytes())
        after, _ = self.register(self.http_report('2026-10-11T07:00:00+00:00'), state)
        self.assertNotEqual(after['productos']['TEST001']['huella'], state['productos']['TEST001']['huella'])

    def test_unchanged_semantics_ignore_order_and_extra_whitespace(self):
        state, _ = self.register(self.http_report())
        self.seo['TEST001']['caracteristicas'] = {'Tipo': 'Accesorio', 'Color': 'blue'}
        self.products['TEST001']['specs'] = dict(self.seo['TEST001']['caracteristicas'])
        self.seo['TEST001']['descripcion'] = 'Descripción  de\nprueba.'
        after, _ = self.register(self.http_report('2026-10-11T07:00:00+00:00'), state)
        self.assertEqual(after, state)

    def test_unpublished_local_change_and_duplicate_report_cannot_advance(self):
        state, _ = self.register(self.http_report()); report = self.http_report('2026-10-11T07:00:00+00:00')
        self.seo['TEST001']['descripcion'] = 'Cambio local no publicado'; self.write_inputs()
        report['resultados'].append(copy.deepcopy(report['resultados'][1]))
        after, rows = self.register(report, state)
        self.assertEqual(after, state); self.assertTrue(all(x['estado'] == 'pendiente' for x in rows))

    def test_older_report_cannot_replace_newer_changed_content(self):
        state, _ = self.register(self.http_report())
        self.seo['TEST001']['categoriaComercial'] = 'Otra categoría'
        after, rows = self.register(self.http_report('2026-10-09T07:00:00+00:00'), state)
        self.assertEqual(after, state); self.assertIn('anterior', rows[0]['motivo'])

    def test_three_sizes_required_and_financial_http_must_match(self):
        state, _ = self.register(self.http_report()); report = self.http_report('2026-10-11T07:00:00+00:00')
        report['resultados'][0]['versiones_verificadas'].pop(); report['resultados'][1]['promo'] = 1
        after, rows = self.register(report, state)
        self.assertEqual(after, state); self.assertTrue(all(r['estado'] == 'pendiente' for r in rows))


if __name__ == '__main__':
    unittest.main()
