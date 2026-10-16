import copy
import hashlib
import importlib.util
import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image

spec = importlib.util.spec_from_file_location('feed', Path(__file__).with_name('generar.py'))
feed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(feed)


class FeedTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for folder in ['importacion/contratos', 'imagenes', 'productos/test1-producto']:
            (self.root / folder).mkdir(parents=True)
        image_path = self.root / 'imagenes/test.png'
        Image.new('RGB', (300, 300), 'white').save(image_path)
        self.p = dict(sku='TEST1', name='Producto & prueba', promo=12.34, stock=2, imageUrl='/imagenes/test.png')
        self.o = dict(comercialVerificado=True, imagenPendiente=False, nombre=self.p['name'], descripcion='Descripción <literal sin etiquetas>')
        self.o['descripcion'] = 'Descripción real con & y comillas ".'
        self.o.update(imagen=self.p['imageUrl'], imagenProfesional=dict(contiene_caja=False, revision_visual='VERIFICADO', versiones={'300': dict(url=self.p['imageUrl'], sha256=hashlib.sha256(image_path.read_bytes()).hexdigest())}))
        self.master = dict(stock='2', promo_contado='12.34', categoria='ACCESORIOS')
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
        self.master['promo_contado'] = '15.00'
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
        self.master['stock'] = '0'
        self.schema['offers']['availability'] = 'https://schema.org/OutOfStock'
        self.save()
        self.assertEqual(self.run_candidate()[0]['availability'], 'out_of_stock')

    def test_inconsistent_landing_page_rejected(self):
        self.schema['offers']['price'] = '13.00'
        self.save()
        with self.assertRaisesRegex(ValueError, 'precio_ficha_no_coincide'):
            self.run_candidate()

    def test_external_or_traversal_url_rejected(self):
        for url in ['https://example.org/a.png', '/imagenes/../x.png', '/%2e%2e/a.png', 'https://user@conectatech-ec.github.io/a.png']:
            with self.subTest(url=url), self.assertRaises(ValueError):
                feed.local_url(url)


if __name__ == '__main__':
    unittest.main()
