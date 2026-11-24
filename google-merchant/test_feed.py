import copy
import hashlib
import importlib.util
import json
import tempfile
import subprocess
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image

spec = importlib.util.spec_from_file_location('feed', Path(__file__).with_name('generar.py'))
feed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(feed)

REAL_CLOSED_CONTRACT = "{\"sku\":\"TELF038\",\"url_publica\":\"https://conectatech-ec.github.io/productos/telf038-honor-play20a-128gb/\",\"precio_contado\":185.9,\"pvp\":232.38,\"stock\":1,\"estado_calidad\":\"APROBADO\",\"estado_publicacion\":\"PUBLICADO_VERIFICADO\",\"validaciones\":{\"publicacion_http\":{\"archivo\":\"reportes/continuacion-135/http-publicacion.json\",\"sha256\":\"af6ae7e1f54fc83f78d0074e179e9ae81e486ca8c296941dc5e66d4347cafe65\"},\"movil\":{\"solicitado\":\"TELF038\",\"sku\":\"TELF038\",\"estado\":\"VERIFICADO\",\"fecha\":\"2026-11-23T23:22:16.943Z\",\"errores\":[],\"verificaciones\":{\"http\":true,\"html_coincide_local\":true,\"sin_desbordamiento_horizontal\":true,\"titulo\":true,\"sku\":true,\"canonical\":true,\"promo_contado\":true,\"pvp\":true,\"jerarquia_precio\":true,\"disponibilidad\":true,\"imagen_principal\":true,\"imagenes_cargadas\":true,\"galeria_del_contrato\":true,\"javascript\":true,\"beneficios_verificados\":true,\"detalles_cerrados\":true,\"detalles_accesibles\":true,\"enlaces_internos\":true,\"escritorio\":true},\"revision_visual_producto\":\"NO_REALIZADA_POR_ESTA_HERRAMIENTA\",\"url\":\"https://conectatech-ec.github.io/productos/telf038-honor-play20a-128gb/\",\"url_comprobada\":\"https://conectatech-ec.github.io/productos/telf038-honor-play20a-128gb/\",\"archivo_html\":\"productos/telf038-honor-play20a-128gb/index.html\",\"http\":200,\"sha256_html\":\"5fdf6923dccac946f1c8fda6ad5536ce6083380bd6088c587b5bcdb72a507bce\",\"sha256_html_local\":\"5fdf6923dccac946f1c8fda6ad5536ce6083380bd6088c587b5bcdb72a507bce\",\"ancho_viewport\":390,\"ancho_documento\":390,\"alto_viewport\":844,\"imagen\":{\"src\":\"https://conectatech-ec.github.io/imagenes/telf038/TELF038-r135-01.webp\",\"url_cargada\":\"https://conectatech-ec.github.io/imagenes/telf038/TELF038-r135-01-600.webp?v=3e1f5f7b3a38d1e9\",\"naturalWidth\":351,\"naturalHeight\":351,\"completa\":true,\"visible\":true},\"precio_archivado_por_stock_cero\":false,\"galeria\":[],\"enlaces_internos\":[{\"url\":\"https://conectatech-ec.github.io/productos/telf038-honor-play20a-128gb/\",\"http\":200,\"ok\":true},{\"url\":\"https://conectatech-ec.github.io/logo-conectatech.png\",\"http\":200,\"ok\":true},{\"url\":\"https://conectatech-ec.github.io/assets/disponibilidad-web.css?v=1\",\"http\":200,\"ok\":true},{\"url\":\"https://conectatech-ec.github.io/\",\"http\":200,\"ok\":true},{\"url\":\"https://conectatech-ec.github.io/imagenes/telf038/TELF038-r135-01.webp\",\"http\":200,\"ok\":true},{\"url\":\"https://conectatech-ec.github.io/productos/mica006-mica-hd-para-android/\",\"http\":200,\"ok\":true},{\"url\":\"https://conectatech-ec.github.io/productos/estu050-estuche-transparente-para-android/\",\"http\":200,\"ok\":true},{\"url\":\"https://conectatech-ec.github.io/productos/carg053-cargador-30w-usb-c-con-cable-1hora/\",\"http\":200,\"ok\":true},{\"url\":\"https://conectatech-ec.github.io/productos/cabl025-cable-iin-zii-usb-c-1-20m-8822/\",\"http\":200,\"ok\":true}],\"archivo\":\"reportes/continuacion-135/qa-publica/capturas/TELF038-390.png\",\"sha256\":\"9523fead3410438c5ef18f5775502be8b81ab7f5416b807320732061c129ee85\",\"escritorio\":{\"ancho_viewport\":1280,\"ancho_documento\":1280,\"archivo\":\"reportes/continuacion-135/qa-publica/capturas/TELF038-1280.png\",\"sha256\":\"9d691cc2f070f83707d3d1317e182b27029796b825c656553eae08b875c5a932\",\"sin_desbordamiento_horizontal\":true,\"imagen_cargada\":true}}}}"
REAL_HTTP_REPORT = "{\n  \"fecha\": \"2026-11-23T23:21:03.462902+00:00\",\n  \"resultados\": [\n    {\n      \"solicitado\": \"TELF038\",\n      \"sku\": \"TELF038\",\n      \"url\": \"https://conectatech-ec.github.io/productos/telf038-honor-play20a-128gb/\",\n      \"estado\": \"publicado_verificado\",\n      \"http\": 200,\n      \"promo\": 185.9,\n      \"pvp\": 232.38,\n      \"stock_catalogo\": 1,\n      \"imagen_pendiente\": false,\n      \"sha256_ficha\": \"5fdf6923dccac946f1c8fda6ad5536ce6083380bd6088c587b5bcdb72a507bce\",\n      \"imagen\": \"https://conectatech-ec.github.io/imagenes/telf038/TELF038-r135-01.webp\",\n      \"versiones_verificadas\": [\n        {\n          \"tamano\": \"01-300\",\n          \"http\": 200,\n          \"sha256\": \"2ee90c92db42d79c019cc9719f4a6fdc90604914e5c4dbe5444ff004c28d9aeb\"\n        },\n        {\n          \"tamano\": \"01-600\",\n          \"http\": 200,\n          \"sha256\": \"3e1f5f7b3a38d1e95c1cd9311b4e51a2dee6ed17bd8390cb4cc52bbb664b4db0\"\n        },\n        {\n          \"tamano\": \"01-1200\",\n          \"http\": 200,\n          \"sha256\": \"f56be3f7cfef744d00443803a6cfcf5a1f5e16772453c042872c6f4a463d9aa3\"\n        }\n      ],\n      \"resolucion\": \"1200x1200\"\n    }\n  ],\n  \"publicados\": 1,\n  \"pendientes\": 0,\n  \"errores\": 0\n}\n"

def original_helpers():
    source = Path(__file__).resolve().parents[1] / 'fuente-vigente/scripts'
    for helper in feed.PUBLICATION_HELPERS:
        path = source / Path(helper).name
        if not path.is_file():
            raise AssertionError('Materializar los helpers originales del checkout fuente antes de las pruebas: ' + str(path))
        yield helper, path.read_bytes()


class FeedTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for helper, payload in original_helpers():
            path = self.root / helper
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(payload)
        for folder in ['importacion/contratos', 'imagenes', 'productos/test1-producto']:
            (self.root / folder).mkdir(parents=True)
        image_path = self.root / 'imagenes/test.png'
        Image.new('RGB', (300, 300), 'white').save(image_path)
        self.p = dict(sku='TEST1', name='Producto & prueba', promo=12.34, stock=2, imageUrl='/imagenes/test.png')
        self.o = dict(comercialVerificado=True, imagenPendiente=False, nombre=self.p['name'], descripcion='Descripción <literal sin etiquetas>')
        self.o['descripcion'] = 'Descripción real con & y comillas ".'
        self.o.update(imagen=self.p['imageUrl'], imagenProfesional=dict(contiene_caja=False, revision_visual='VERIFICADO', versiones={'300': dict(url=self.p['imageUrl'], sha256=hashlib.sha256(image_path.read_bytes()).hexdigest())}))
        self.master = dict(availability='in_stock', precio_coincide_corte=True, precio_publico_validado='12.34', categoria='ACCESORIOS')
        self.contract = dict(sku='TEST1', estado_calidad='APROBADO', estado_publicacion='PUBLICADO_VERIFICADO', unidad_venta=dict(verificada=True), imagen_principal=self.p['imageUrl'], validaciones=dict(identidad=dict(sku_verificado=True, discrepancias_pendientes=[]), ficha=dict(verificada=True), publicacion_http=dict(estado='VERIFICADO')))
        self.schema = {'@type': 'Product', 'sku': 'TEST1', 'name': self.p['name'], 'description': self.o['descripcion'], 'image': [feed.BASE + self.p['imageUrl']], 'offers': dict(url=feed.BASE + '/productos/test1-producto/', price='12.34', priceCurrency='USD', availability='https://schema.org/InStock', itemCondition='https://schema.org/NewCondition')}
        self.save()

    def save(self):
        (self.root / 'importacion/contratos/TEST1.json').write_text(json.dumps(self.contract))
        (self.root / 'productos/test1-producto/index.html').write_text('<script type="application/ld+json">' + json.dumps(self.schema) + '</script><div class="price">$12,34</div>')

    def run_candidate(self):
        return feed.candidate(self.root, self.p, self.o, 'test1-producto', self.master)

    def test_valid_xml_and_no_invented_identifiers(self):
        before = copy.deepcopy(self.p)
        row, _ = self.run_candidate()
        doc = ET.fromstring(feed.xml_feed([row]))
        self.assertEqual(doc.find('.//{' + feed.NS + '}structured_title/{' + feed.NS + '}content').text, self.p['name'])
        self.assertEqual(doc.find('.//{' + feed.NS + '}structured_description/{' + feed.NS + '}digital_source_type').text, 'trained_algorithmic_media')
        self.assertEqual(row['availability'], 'in_stock')
        self.assertEqual([node.text for node in doc.findall('.//{' + feed.NS + '}excluded_destination')], ['Shopping_ads', 'Free_listings'])
        for key in ['gtin', 'mpn', 'identifier_exists', 'brand', 'shipping']:
            self.assertNotIn(key, row)
        self.assertEqual(before, self.p)

    def test_bad_prices_rejected(self):
        for price in [0, -1, True, 'NaN', 'Infinity', 1.234, None]:
            with self.subTest(price=price), self.assertRaises((ValueError, TypeError)):
                feed.money(price)

    def test_price_disagreement_rejected(self):
        self.master['precio_publico_validado'] = '15.00'
        with self.assertRaisesRegex(ValueError, 'precio_inventario_no_coincide'):
            self.run_candidate()

    def test_missing_or_corrupt_photo_rejected(self):
        (self.root / 'imagenes/test.png').write_bytes(b'not an image')
        with self.assertRaisesRegex(ValueError, 'hash_fotografia'):
            self.run_candidate()

    def test_unapproved_rejected(self):
        self.o['comercialVerificado'] = False
        with self.assertRaisesRegex(ValueError, 'producto_no_aprobado'):
            self.run_candidate()

    def test_zero_stock_is_out_of_stock(self):
        self.p['stock'] = 0
        self.master['availability'] = 'out_of_stock'
        self.schema['offers']['availability'] = 'https://schema.org/OutOfStock'
        self.save()
        self.assertEqual(self.run_candidate()[0]['availability'], 'out_of_stock')

    def test_private_quantities_not_exposed_or_invented(self):
        row, proof = self.run_candidate()
        self.assertEqual(row['availability'], 'in_stock')
        self.assertNotIn('stock', proof)
        self.assertEqual(proof['disponibilidad_corte16'], 'in_stock')
        self.assertEqual(self.p['stock'], 2)

    def test_corrected_soldout_cannot_reuse_stale_web_availability(self):
        self.master['availability'] = 'out_of_stock'
        with self.assertRaisesRegex(ValueError, 'stock_ficha_no_coincide'):
            self.run_candidate()

    def test_inventory_hash_and_minimum_cut(self):
        path = self.root / 'vigente.json'
        records = [{'sku': 'TEST1', 'availability': 'in_stock', 'precio_coincide_corte': True, 'precio_publico_validado': '12.34'}]
        raw = json.dumps(records, sort_keys=True, separators=(',', ':')).encode()
        meta = {'fecha_corte': '2026-10-16', 'sha256_productos': hashlib.sha256(raw).hexdigest(), 'referencias_exportadas': 1, 'productos': records}
        path.write_text(json.dumps(meta))
        result, _ = feed.load_inventory(path)
        self.assertEqual(result[0]['_fecha_corte'], '16/10/2026')
        meta['fecha_corte'] = '2026-10-10'
        path.write_text(json.dumps(meta))
        with self.assertRaisesRegex(ValueError, 'corte del 10/10'):
            feed.load_inventory(path)
        meta['fecha_corte'] = '2026-10-16'
        meta['sha256_productos'] = '0' * 64
        path.write_text(json.dumps(meta))
        with self.assertRaisesRegex(ValueError, 'manifiesto'):
            feed.load_inventory(path)

    def test_inconsistent_landing_page_rejected(self):
        self.schema['offers']['price'] = '13.00'
        self.save()
        with self.assertRaisesRegex(ValueError, 'precio_ficha_no_coincide'):
            self.run_candidate()

    def test_external_or_traversal_url_rejected(self):
        for url in ['https://example.org/a.png', '/imagenes/../x.png', '/%2e%2e/a.png', 'https://user@conectatech-ec.github.io/a.png']:
            with self.subTest(url=url), self.assertRaises(ValueError):
                feed.local_url(url)

    def referenced(self):
        self.o['imagenProfesional']['posicion'] = 1
        image_sha = self.o['imagenProfesional']['versiones']['300']['sha256']
        html_sha = hashlib.sha256((self.root / 'productos/test1-producto/index.html').read_bytes()).hexdigest()
        self.contract.update(precio_contado=12.34, pvp=15.00, stock=2, url_publica=feed.BASE + '/productos/test1-producto/')
        capture = self.root / 'reportes/movil.png'
        capture.parent.mkdir(parents=True, exist_ok=True)
        Image.new('RGB', (390, 844), 'white').save(capture)
        self.contract['validaciones']['movil'] = {'sha256_html': html_sha, 'estado': 'VERIFICADO', 'sku': 'TEST1',
            'url': self.contract['url_publica'], 'archivo': 'reportes/movil.png', 'sha256': hashlib.sha256(capture.read_bytes()).hexdigest()}
        self.report = {'fecha': '2026-11-23T23:21:03+00:00', 'resultados': [{
            'sku': 'TEST1', 'estado': 'publicado_verificado', 'http': 200, 'url': self.contract['url_publica'],
            'imagen_pendiente': False, 'promo': 12.34, 'pvp': 15.00, 'stock_catalogo': 2,
            'sha256_ficha': html_sha, 'versiones_verificadas': [{'tamano': '01-300', 'sha256': image_sha, 'http': 200}]}]}
        self.save_report()
        return self.report

    def save_report(self):
        path = self.root / 'reportes/publicacion.json'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.report))
        self.contract['validaciones']['publicacion_http'] = {
            'archivo': 'reportes/publicacion.json', 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
        self.save()

    def source_commit(self, products=None, seo=None):
        (self.root / 'index.html').write_text('const products=' + json.dumps(products if products is not None else [self.p]) + ';\n')
        (self.root / 'seo-contenido.json').write_text(json.dumps(seo if seo is not None else {'TEST1': self.o}))
        subprocess.run(['git', 'init', '--quiet', str(self.root)], check=True, capture_output=True)
        subprocess.run(['git', '-C', str(self.root), 'add', '.'], check=True, capture_output=True)
        subprocess.run(['git', '-C', str(self.root), '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
                        'commit', '--quiet', '-m', 'Original source fixture'], check=True, capture_output=True)
        return subprocess.check_output(['git', '-C', str(self.root), 'rev-parse', 'HEAD'], text=True).strip()

    def test_canonical_file_reference_uses_original_validator(self):
        self.referenced()
        row, _ = self.run_candidate()
        self.assertEqual(row['id'], 'TEST1')
        self.assertEqual(row['excluded_destination'], ['Shopping_ads', 'Free_listings'])
        self.assertNotIn('estado', self.contract['validaciones']['publicacion_http'])

    def test_actual_closed_TELF038_receipt_from_PR411(self):
        contract = json.loads(REAL_CLOSED_CONTRACT)
        report = json.loads(REAL_HTTP_REPORT)
        path = self.root / contract['validaciones']['publicacion_http']['archivo']
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(REAL_HTTP_REPORT)
        photos = [{'posicion': 1, 'versiones': {
            version['tamano'].split('-')[1]: {'sha256': version['sha256']}
            for version in report['resultados'][0]['versiones_verificadas']}}]
        before = copy.deepcopy(contract)
        with feed.original_publication_validator(self.root) as validator:
            self.assertEqual(validator.validate_publication(self.root, contract, photos), [])
        self.assertEqual(contract, before)
        self.assertEqual(contract['sku'], 'TELF038')
        self.assertEqual(report['fecha'], '2026-11-23T23:21:03.462902+00:00')

    def test_referenced_receipt_bad_hash_is_rejected(self):
        self.referenced()
        self.contract['validaciones']['publicacion_http']['sha256'] = '0' * 64
        self.save()
        with self.assertRaisesRegex(ValueError, 'publicacion_no_verificada'):
            self.run_candidate()

    def test_referenced_receipt_wrong_or_duplicate_sku_is_rejected(self):
        self.referenced()
        for rows in [[dict(self.report['resultados'][0], sku='OTHER')], self.report['resultados'] * 2]:
            self.report['resultados'] = rows
            self.save_report()
            with self.assertRaisesRegex(ValueError, 'publicacion_no_verificada'):
                self.run_candidate()

    def test_local_http_200_is_not_publication(self):
        self.referenced()
        self.report['resultados'][0]['estado'] = 'verificado_local'
        self.save_report()
        with self.assertRaisesRegex(ValueError, 'publicacion_no_verificada'):
            self.run_candidate()

    def test_referenced_receipt_thumbnail_and_browser_html_are_checked(self):
        self.referenced()
        self.report['resultados'][0]['versiones_verificadas'][0]['sha256'] = '0' * 64
        self.save_report()
        with self.assertRaisesRegex(ValueError, 'publicacion_no_verificada'):
            self.run_candidate()
        self.referenced()
        self.contract['validaciones']['movil']['sha256_html'] = '0' * 64
        self.save()
        with self.assertRaisesRegex(ValueError, 'publicacion_no_verificada'):
            self.run_candidate()

    def test_referenced_mobile_capture_tamper_is_rejected(self):
        self.referenced()
        capture = self.root / self.contract['validaciones']['movil']['archivo']
        capture.write_bytes(capture.read_bytes() + b'tampered')
        with self.assertRaisesRegex(ValueError, 'Evidencia modificada'):
            self.run_candidate()

    def test_reference_path_escape_and_symlink_are_rejected(self):
        self.referenced()
        for path in ['../outside.json', '/tmp/outside.json', 'reportes/../outside.json',
                     'reportes/%2e%2e/outside.json', 'https://example.org/publicacion.json']:
            self.contract['validaciones']['publicacion_http']['archivo'] = path
            self.save()
            with self.assertRaisesRegex(ValueError, 'ruta_publicacion'):
                self.run_candidate()
        self.referenced()
        with tempfile.TemporaryDirectory() as outside:
            (self.root / 'reportes/publicacion.json').unlink()
            (self.root / 'reportes/publicacion.json').symlink_to(Path(outside) / 'outside.json')
            with self.assertRaisesRegex(ValueError, 'ruta_publicacion'):
                self.run_candidate()

    def test_source_materialization_is_pinned_and_only_references_are_loaded(self):
        self.referenced()
        (self.root / 'reportes/unrelated.json').write_text('{"unrelated":true}')
        commit = self.source_commit()
        (self.root / 'reportes/publicacion.json').unlink()
        (self.root / 'reportes/unrelated.json').unlink()
        result = feed.materialize_publication_evidence(self.root)
        self.assertEqual(result['source_commit'], commit)
        self.assertEqual(result['reports'], ['reportes/movil.png', 'reportes/publicacion.json'])
        self.assertTrue((self.root / 'reportes/publicacion.json').is_file())
        self.assertFalse((self.root / 'reportes/unrelated.json').exists())
        self.assertEqual(subprocess.check_output(['git', '-C', str(self.root), 'diff', '--', 'scripts'], text=True), '')

    def test_source_does_not_dereference_local_or_unapproved_products(self):
        for changed in ['local', 'photo', 'identity', 'title']:
            with self.subTest(changed=changed):
                self.referenced()
                if changed == 'local':
                    self.contract['estado_publicacion'] = 'APROBADO_LOCAL'
                elif changed == 'photo':
                    self.o['imagenPendiente'] = True
                elif changed == 'identity':
                    self.contract['validaciones']['identidad']['sku_verificado'] = False
                else:
                    self.p['name'] = 'Other title'
                self.save()
                self.source_commit()
                (self.root / 'reportes/publicacion.json').unlink()
                result = feed.materialize_publication_evidence(self.root)
                self.assertEqual(result['reports'], [])
                self.assertFalse((self.root / 'reportes/publicacion.json').exists())
                self.contract['estado_publicacion'] = 'PUBLICADO_VERIFICADO'
                self.o['imagenPendiente'] = False
                self.contract['validaciones']['identidad']['sku_verificado'] = True
                self.p['name'] = self.o['nombre']

    def test_source_does_not_overwrite_a_modified_original_helper(self):
        self.referenced()
        self.source_commit()
        path = self.root / feed.PUBLICATION_HELPERS[0]
        path.write_bytes(path.read_bytes() + b'\n# local alteration\n')
        before = path.read_bytes()
        with self.assertRaisesRegex(ValueError, 'fuente_local_modificada'):
            feed.materialize_publication_evidence(self.root)
        self.assertEqual(path.read_bytes(), before)

    def test_materialized_report_hash_must_match_contract(self):
        self.referenced()
        self.contract['validaciones']['publicacion_http']['sha256'] = '0' * 64
        self.save()
        self.source_commit()
        (self.root / 'reportes/publicacion.json').unlink()
        result = feed.materialize_publication_evidence(self.root)
        self.assertEqual(result['rejected_publication'], [{'sku': 'TEST1', 'motivo': 'hash_publicacion_no_coincide'}])
        self.assertFalse((self.root / 'reportes/publicacion.json').exists())
        with self.assertRaises((ValueError, OSError)):
            self.run_candidate()

    def test_mixed_bad_references_do_not_block_valid_publication(self):
        self.referenced()
        products, contents, contracts, slugs = [self.p], {'TEST1': self.o}, {}, {'TEST1': 'test1-producto'}
        bad_ids = ['BAD_HASH', 'BAD_PNG', 'BAD_MISSING_SHA', 'BAD_MISSING_FILE', 'BAD_NO_PATH']
        for sku in bad_ids:
            product, content, contract = copy.deepcopy(self.p), copy.deepcopy(self.o), copy.deepcopy(self.contract)
            product['sku'] = sku
            slug = sku.lower() + '-producto'
            schema = copy.deepcopy(self.schema)
            schema['sku'] = sku
            schema['offers']['url'] = feed.BASE + '/productos/' + slug + '/'
            path = self.root / 'productos' / slug / 'index.html'
            path.parent.mkdir(parents=True)
            path.write_text('<script type="application/ld+json">' + json.dumps(schema) + '</script><div class="price">$12,34</div>')
            contract.update(sku=sku, url_publica=schema['offers']['url'])
            contract['validaciones']['movil'].update(sku=sku, url=contract['url_publica'],
                sha256_html=hashlib.sha256(path.read_bytes()).hexdigest())
            row = copy.deepcopy(self.report['resultados'][0])
            row.update(sku=sku, url=contract['url_publica'], sha256_ficha=contract['validaciones']['movil']['sha256_html'])
            self.report['resultados'].append(row)
            products.append(product); contents[sku] = content; contracts[sku] = contract; slugs[sku] = slug
        self.save_report()
        for sku, contract in contracts.items():
            contract['validaciones']['publicacion_http'] = copy.deepcopy(self.contract['validaciones']['publicacion_http'])
            if sku == 'BAD_HASH':
                contract['validaciones']['publicacion_http']['sha256'] = '0' * 64
            elif sku == 'BAD_PNG':
                contract['validaciones']['movil']['sha256'] = '0' * 64
            elif sku == 'BAD_MISSING_SHA':
                del contract['validaciones']['publicacion_http']['sha256']
            elif sku == 'BAD_MISSING_FILE':
                contract['validaciones']['publicacion_http']['archivo'] = 'reportes/not-in-source.json'
            elif sku == 'BAD_NO_PATH':
                del contract['validaciones']['publicacion_http']['archivo']
            (self.root / 'importacion/contratos' / (sku + '.json')).write_text(json.dumps(contract))
        (self.root / 'seo-pages.json').write_text(json.dumps(slugs))
        (self.root / 'datos-593').mkdir()
        (self.root / 'datos-593/inventario-publico.csv').write_text('sku,categoria\n' + ''.join(p['sku'] + ',ACCESORIOS\n' for p in products))
        rows = [{'sku': p['sku'], 'availability': 'in_stock', 'precio_coincide_corte': True,
                 'precio_publico_validado': '12.34'} for p in products]
        inventory = {'fecha_corte': '2026-11-23', 'referencias_exportadas': len(rows), 'productos': rows,
                     'sha256_productos': hashlib.sha256(json.dumps(rows, sort_keys=True, separators=(',', ':')).encode()).hexdigest()}
        inventory_path = self.root / 'vigente.json'
        inventory_path.write_text(json.dumps(inventory))
        # An invalid reference to the shared report is encountered BEFORE the valid owner.
        self.source_commit(products=list(reversed(products)), seo=contents)
        (self.root / 'reportes/publicacion.json').unlink()
        (self.root / 'reportes/movil.png').unlink()
        result = feed.materialize_publication_evidence(self.root)
        self.assertEqual({x['sku'] for x in result['rejected_publication']}, set(bad_ids))
        self.assertEqual(result['reports'], ['reportes/movil.png', 'reportes/publicacion.json'])
        self.assertTrue(all(set(row) == {'sku', 'motivo'} for row in result['rejected_publication']))
        summary = feed.generate(self.root, self.root / 'output', inventory=inventory_path)
        self.assertEqual(summary['incluidos'], 1)
        self.assertEqual(summary['excluidos'], len(bad_ids))
        xml = ET.fromstring((self.root / 'output/productos-ec.xml').read_bytes())
        self.assertEqual([item.text for item in xml.findall('.//{' + feed.NS + '}id')], ['TEST1'])
        self.assertFalse(summary['publicacion_habilitada'])
        self.assertEqual([item.text for item in xml.findall('.//{' + feed.NS + '}excluded_destination')],
                         ['Shopping_ads', 'Free_listings'])

    def test_modified_source_report_remains_a_global_failure(self):
        self.referenced()
        self.source_commit()
        path = self.root / 'reportes/publicacion.json'
        path.write_bytes(path.read_bytes() + b' ')
        before = path.read_bytes()
        with self.assertRaisesRegex(feed.SourceIntegrityError, 'fuente_local_modificada'):
            feed.materialize_publication_evidence(self.root)
        self.assertEqual(path.read_bytes(), before)

    def test_missing_official_helper_remains_a_global_failure(self):
        self.referenced()
        self.source_commit()
        subprocess.run(['git', '-C', str(self.root), 'rm', '--quiet', feed.PUBLICATION_HELPERS[0]], check=True)
        subprocess.run(['git', '-C', str(self.root), '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
                        'commit', '--quiet', '-m', 'Fixture without official dependency'], check=True)
        with self.assertRaisesRegex(feed.SourceIntegrityError, 'dependencia_original_no_disponible'):
            feed.materialize_publication_evidence(self.root)


if __name__ == '__main__':
    unittest.main()
