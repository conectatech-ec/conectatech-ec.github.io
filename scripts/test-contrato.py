#!/usr/bin/env python3
"""Fixtures sintéticas: prueban bloqueos; no constituyen evidencia comercial."""
import copy
import csv
import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / file)
    result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result); return result
pipeline = module('contract_pipeline', 'procesar-imagenes.py')
validator = pipeline.contracts


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'importacion').mkdir(); (self.root / 'datos-593').mkdir()
        self.products = [{'sku': 'TEST001', 'name': 'Producto original de prueba', 'category': 'Accesorios', 'promo': 7.25, 'pvp': 8.5, 'stock': 3},
                         {'sku': 'TEST002', 'name': 'Otro producto', 'category': 'Accesorios', 'promo': 9, 'pvp': 10.35, 'stock': 2}]
        (self.root / 'index.html').write_text('const products=' + json.dumps(self.products) + ';\n')
        self.rule = {'revision': 1, 'presentacion': 'sin caja', 'autenticidad': 'original verificado', 'instrucciones': '', 'evidencia_autenticidad': 'Confirmación comercial de prueba'}
        values = {'seo-contenido.json': {'TEST001': {}, 'TEST002': {}}, 'seo-pages.json': {'TEST001': 'test001', 'TEST002': 'test002'},
                  'importacion/alias-sku.json': {}, 'importacion/medios.json': {},
                  'importacion/reglas-sku.json': {'productos': {p['sku']: copy.deepcopy(self.rule) for p in self.products}}}
        for path, value in values.items(): (self.root / path).write_text(json.dumps(value))
        with (self.root / validator.BASE_593).open('w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['sku', 'nombre', 'stock', 'precio_general', 'iva', 'tipo', 'categoria', 'clasificacion'])
            writer.writeheader()
            for p in self.products: writer.writerow({'sku': p['sku'], 'nombre': p['name'], 'stock': p['stock'], 'precio_general': '6.3', 'iva': '15', 'tipo': 'PRODUCTO', 'categoria': 'ACCESORIOS', 'clasificacion': ''})
        self.ctx = validator.context(self.root)
        self.items = {}; self.contracts = {}; self.approvals = {}
        for n, p in enumerate(self.products):
            sku = p['sku']; source = self.root / (sku + '.png')
            Image.new('RGB', (1200, 1200), ('#135570', '#bb3311')[n]).save(source)
            digest = validator.sha(source.read_bytes()); url = 'https://drive.google.com/file/d/' + sku + '/view'
            item = {'posicion': 1, 'archivo': source.name, 'sha256': digest, 'revision_regla': 1, 'modelo_revisado': True,
                    'calidad_revisada': True, 'sin_datos_privados': True, 'fondo_aprobado': True, 'contiene_caja': False, 'fuente': url}
            self.items[sku] = [item]
            primary = '/imagenes/' + sku.lower() + '/' + sku + '-01.webp'
            public_url = 'https://conectatech-ec.github.io/productos/' + sku.lower() + '/'
            # Captura/HTML falsos son exclusivamente fixtures y nunca se usan en producción.
            mobile = self.root / (sku + '-movil.png'); Image.new('RGB', (390, 800), 'white').save(mobile)
            html = self.root / (sku + '.html'); html.write_text(sku + primary)
            self.contracts[sku] = {'sku': sku, 'nombre_original': p['name'], 'titulo_comercial': p['name'], 'tipo': 'original', 'marca': 'Prueba', 'modelo': sku,
                'variante': 'Azul' if not n else 'Rojo', 'categoria_original': p['category'], 'categoria_comercial': p['category'], 'precio_contado': p['promo'], 'pvp': p['pvp'], 'stock': p['stock'],
                'unidad_venta': {'descripcion': '1 producto', 'cantidad': 1, 'verificada': True, 'fuente': url},
                'fotografias_fuente': [{'url': url, 'sha256': digest}], 'fuentes_tecnicas': [url], 'imagen_principal': primary, 'imagenes_secundarias': [],
                'derechos_imagen': {'estado': 'AUTORIZADO', 'tipo': 'propia', 'evidencia': 'Fixture: autorización del propietario', 'fuente': url, 'fecha_verificacion': '2026-10-10', 'archivos': [{'sha256': digest, 'fuente': url}]},
                'especificaciones': [{'nombre': 'Color', 'valor': 'Azul' if not n else 'Rojo', 'fuentes': [url], 'estado': 'VERIFICADO'}],
                'estado_calidad': 'APROBADO', 'estado_publicacion': 'PENDIENTE', 'url_publica': public_url, 'fecha_verificacion': '2026-10-10',
                'validaciones': {'base_593': {'archivo': validator.BASE_593, 'sha256': self.ctx['sha256_593'], 'fila': self.ctx['base_593'][sku]},
                    'identidad': {'marca_verificado': True, 'modelo_verificado': True, 'variante_verificado': True, 'fuentes': [url], 'discrepancias_pendientes': []},
                    'ficha': {'verificada': True, 'fuente': url},
                    'movil': {'estado': 'VERIFICADO', 'sku': sku, 'url': public_url, 'archivo': mobile.name, 'sha256': validator.sha(mobile.read_bytes()), 'ancho_viewport': 390, 'ancho_documento': 390,
                              'fecha': '2026-10-10', 'archivo_html': html.name, 'sha256_html': validator.sha(html.read_bytes())}}}
            self.approvals[sku] = {'estado': 'APROBADO', 'identidad_verificada': True, 'ficha_verificada': True, 'uso_comercial_permitido': True}
        self.manifest = {'version': 3, 'skus': ['TEST001'], 'imagenes': self.items, 'aprobaciones': self.approvals, 'contratos': self.contracts}

    def errors(self, sku='TEST001'):
        return validator.validate(self.root, self.contracts[sku], sku, self.rule, self.items[sku], self.ctx)

    def runjob(self):
        (self.root / 'manifest.json').write_text(json.dumps(self.manifest))
        pipeline.run(SimpleNamespace(root=self.root, manifiesto='manifest.json', reporte='report.json', aplicar=True, borradores=None))
        return json.loads((self.root / 'report.json').read_text())

    def test_verified_contract_and_idempotence(self):
        self.assertEqual(self.errors(), [])
        report = self.runjob(); self.assertEqual(report['productos'][0]['estado'], 'aplicado_local')
        before = (self.root / 'index.html').read_bytes()
        with patch.object(pipeline, 'process', side_effect=AssertionError('No regenerar')):
            report = self.runjob()
        self.assertEqual(report['resumen']['imagenes_reutilizadas'], 1)
        self.assertEqual((self.root / 'index.html').read_bytes(), before)
        self.assertEqual(pipeline.editorial.financial(pipeline.editorial.read_catalog(self.root)[1]), pipeline.editorial.financial(self.products))
        self.assertEqual(validator.context(self.root)['sha256_593'], self.ctx['sha256_593'])

    def test_financial_changes_block_only_affected_sku(self):
        self.manifest['skus'] = ['TEST001', 'TEST002']; self.contracts['TEST001']['precio_contado'] = 7.26
        r = self.runjob(); by = {x['sku']: x for x in r['productos']}
        self.assertEqual(by['TEST001']['estado'], 'pendiente'); self.assertEqual(by['TEST002']['estado'], 'aplicado_local')
        after = pipeline.editorial.read_catalog(self.root)[1]
        self.assertEqual(pipeline.editorial.financial(after), pipeline.editorial.financial(self.products))
        self.assertNotIn('imageUrl', after[0])

    def test_duplicate_sku_never_applies_first_occurrence(self):
        self.manifest['skus'] = ['TEST001', 'TEST001', 'TEST002']; r = self.runjob()
        self.assertEqual(len(r['errores']), 2)
        self.assertEqual(r['productos'][0]['sku'], 'TEST002'); self.assertEqual(r['productos'][0]['estado'], 'aplicado_local')
        self.assertNotIn('imageUrl', pipeline.editorial.read_catalog(self.root)[1][0])

    def test_external_public_access_is_not_permission(self):
        rights = self.contracts['TEST001']['derechos_imagen']; rights['estado'] = 'PUBLICA'; rights['evidencia'] = ''
        self.assertIn('derechos', {e['codigo'] for e in self.errors()})
        self.assertEqual(self.runjob()['productos'][0]['estado'], 'pendiente')

    def test_permission_must_cover_exact_hash(self):
        self.contracts['TEST001']['derechos_imagen']['archivos'][0]['sha256'] = 'f' * 64
        self.assertIn('derechos', {e['codigo'] for e in self.errors()})

    def test_unknown_brand_and_model_do_not_change_commercial_originality(self):
        contract = self.contracts['TEST001']; identity = contract['validaciones']['identidad']
        contract['marca'] = None; contract['modelo'] = None
        identity.update(marca_no_declarada=True, modelo_no_declarado=True, sku_verificado=True)
        identity.pop('marca_verificado'); identity.pop('modelo_verificado')
        self.assertEqual(self.errors(), [])
        self.assertEqual(contract['tipo'], 'original')
        identity['discrepancias_pendientes'] = [{'campo': 'modelo', 'tratamiento': 'NO_DECLARAR', 'valor_catalogo': 'Camaro',
            'descripcion': 'Modelo no confirmado; se describe el juguete sin atribuir modelo', 'fuente': contract['fotografias_fuente'][0]['url']}]
        self.assertEqual(self.errors(), [])
        contract['titulo_comercial'] = 'Juguete Camaro'
        self.assertIn('discrepancia', {e['codigo'] for e in self.errors()})

    def test_preparation_does_not_require_the_preview_it_will_generate(self):
        del self.contracts['TEST001']['validaciones']['movil']
        self.assertIn('movil', {e['codigo'] for e in self.errors()})
        self.assertEqual(self.runjob()['productos'][0]['estado'], 'aplicado_local')

    def test_internal_broken_link_rejected_before_push(self):
        contract = self.contracts['TEST001']; mobile = contract['validaciones']['movil']
        page = self.root / mobile['archivo_html']; page.write_text('<a href="/missing/">Pendiente</a>')
        mobile['sha256_html'] = validator.sha(page.read_bytes())
        self.assertTrue(validator.validate_links(self.root, contract))

    def test_pending_claim_cannot_be_public(self):
        spec = self.contracts['TEST001']['especificaciones'][0]; spec['estado'] = 'POR_VERIFICAR'
        self.assertIn('especificaciones', {e['codigo'] for e in self.errors()})
        spec['publicar'] = False; self.assertNotIn('especificaciones', {e['codigo'] for e in self.errors()})

    def test_593_replacement_requires_review(self):
        self.contracts['TEST001']['validaciones']['base_593']['sha256'] = 'a' * 64
        self.assertIn('base_593', {e['codigo'] for e in self.errors()})

    def test_mobile_capture_cannot_be_missing_or_from_other_html(self):
        mobile = self.contracts['TEST001']['validaciones']['movil']; mobile['ancho_documento'] = 900
        self.assertIn('movil', {e['codigo'] for e in self.errors()})
        mobile['ancho_documento'] = 390; (self.root / mobile['archivo_html']).write_text('HTML cambiado')
        self.assertIn('movil', {e['codigo'] for e in self.errors()})

    def test_postpublication_requires_real_http_report(self):
        self.runjob(); photos = json.loads((self.root / 'importacion/medios.json').read_text())['TEST001']['imagenes']
        contract = self.contracts['TEST001']
        self.assertTrue(validator.validate_publication(self.root, contract, photos))
        data = {'fecha': '2026-10-10', 'resultados': [{'sku': 'TEST001', 'url': contract['url_publica'], 'estado': 'publicado_verificado', 'http': 200, 'imagen_pendiente': False,
               'promo': 7.25, 'pvp': 8.5, 'stock_catalogo': 3, 'sha256_ficha': contract['validaciones']['movil']['sha256_html'],
               'versiones_verificadas': [{'tamano': '01-' + s, 'http': 200, 'sha256': v['sha256']} for s, v in photos[0]['versiones'].items()]}]}
        path = self.root / 'http.json'; path.write_text(json.dumps(data))
        contract['validaciones']['publicacion_http'] = {'archivo': path.name, 'sha256': validator.sha(path.read_bytes())}
        self.assertEqual(validator.validate_publication(self.root, contract, photos), [])
        data['resultados'][0]['estado'] = 'verificado_local'; path.write_text(json.dumps(data))
        contract['validaciones']['publicacion_http']['sha256'] = validator.sha(path.read_bytes())
        self.assertTrue(validator.validate_publication(self.root, contract, photos))

    def test_corrupt_output_blocks_files_validation(self):
        self.runjob(); photos = json.loads((self.root / 'importacion/medios.json').read_text())['TEST001']['imagenes']
        path = self.root / photos[0]['versiones']['300']['url'].lstrip('/'); path.write_bytes(b'corrupt')
        self.assertTrue(validator.validate_images(self.root, self.contracts['TEST001'], photos))

    def test_unauthorized_update_preserves_existing_approved_cover(self):
        self.runjob(); before = (self.root / 'index.html').read_bytes()
        self.contracts['TEST001']['derechos_imagen']['estado'] = 'PENDIENTE'
        self.assertEqual(self.runjob()['productos'][0]['estado'], 'pendiente')
        self.assertEqual(before, (self.root / 'index.html').read_bytes())


if __name__ == '__main__':
    unittest.main()
