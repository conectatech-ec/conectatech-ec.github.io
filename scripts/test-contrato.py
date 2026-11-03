#!/usr/bin/env python3
"""Fixtures sintéticas: prueban bloqueos; no constituyen evidencia comercial."""
import copy
import csv
import importlib.util
import json
import hashlib
import subprocess
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
    def test_reencuadre_actual_exige_anclaje_y_bytes(self):
        sku='TEST001'; legacy='/imagenes/test001/TEST001-01.webp'; current='/imagenes/test001/TEST001-r26-01.webp'
        file=self.root/current.lstrip('/');file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes(b'fixture de bytes de reencuadre, no evidencia comercial')
        (self.root/'seo-contenido.json').write_text(json.dumps({sku:{'imagen':legacy}}))
        contract={'sku':sku,'imagen_principal':legacy};ctx={'productos':{sku:{'imageUrl':current}},'fotografia_actual':{sku:{'imagen':current,'imagenProfesional':{'versiones':{'1200':{'url':current,'sha256':validator.sha(file.read_bytes())}}}}}}
        self.assertEqual(validator.active_cover(self.root,contract,ctx),current)
        bad=copy.deepcopy(ctx);bad['fotografia_actual'][sku]['imagenProfesional']['versiones']['1200']['sha256']='0'*64
        self.assertEqual(validator.active_cover(self.root,contract,bad),legacy)
        bad=copy.deepcopy(ctx);bad['productos'][sku]['imageUrl']='/imagen-no-coincidente.webp'
        self.assertEqual(validator.active_cover(self.root,contract,bad),legacy)
        self.assertEqual(validator.active_cover(self.root,contract,{'productos':ctx['productos']}),legacy)
        file.write_bytes(b'bytes modificados tras seleccion')
        self.assertEqual(validator.active_cover(self.root,contract,ctx),legacy)

    def test_stock_actual_exige_corte_comercial_validado_y_evidencia(self):
        s='TEST001'; c=self.contracts[s]; self.products[0]['stock']=2
        (self.root/'index.html').write_text('const products='+json.dumps(self.products)+';\n')
        cut={'fecha_corte':'2026-11-02','sha256_original':'a'*64,'productos':{p['sku']:{'stock':p['stock'],'promo_centavos':round(p['promo']*100),'pvp_centavos':round(p['pvp']*100)}for p in self.products}}
        state={'fecha_corte':cut['fecha_corte'],'origen_sha256':cut['sha256_original'],'sku_web':2}
        for name,d in [('corte-comercial-publico-validado.json',cut),('estado-ultimo-corte.json',state)]:
            (self.root/'datos-593'/name).write_text(json.dumps(d))
        self.ctx=validator.context(self.root); c['stock']=2; c['stock_fecha_corte']=cut['fecha_corte']
        self.assertIn('stock_593',{e['codigo']for e in self.errors()})
        actual=self.ctx['corte_comercial'];c['validaciones']['corte_comercial']={k:actual[k]for k in ('archivo','sha256','fecha')}|{'fila':actual['productos'][s]}
        self.assertNotIn('stock_593',{e['codigo']for e in self.errors()})
        c['validaciones']['corte_comercial']['sha256']='0'*64
        self.assertIn('stock_593',{e['codigo']for e in self.errors()})
        cut['productos'][s]['stock']=9
        (self.root/'datos-593/corte-comercial-publico-validado.json').write_text(json.dumps(cut))
        with self.assertRaises(subprocess.CalledProcessError): validator.context(self.root)

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

    def test_revision_cover_preserves_sku_and_position_checks(self):
        contract = self.contracts['TEST001']; mobile = contract['validaciones']['movil']
        revised = '/imagenes/test001/TEST001-r106-01.webp'
        contract['imagen_principal'] = revised
        page = self.root / mobile['archivo_html']; page.write_text('TEST001' + revised)
        mobile['sha256_html'] = validator.sha(page.read_bytes())
        self.assertEqual(self.errors(), [])
        for invalid in ['/imagenes/test002/TEST002-r106-01.webp',
                        '/imagenes/test001/TEST001-r106-02.webp',
                        '/imagenes/test001/TEST001-r0-01.webp',
                        '/imagenes/test001/../TEST001-r106-01.webp',
                        revised + '?revision=106']:
            with self.subTest(path=invalid):
                contract['imagen_principal'] = invalid
                self.assertIn('portada', {e['codigo'] for e in self.errors()})

    def runjob(self):
        (self.root / 'manifest.json').write_text(json.dumps(self.manifest))
        pipeline.run(SimpleNamespace(root=self.root, manifiesto='manifest.json', reporte='report.json', aplicar=True, borradores=None))
        return json.loads((self.root / 'report.json').read_text())

    def test_revision_resources_do_not_overwrite_published_images(self):
        self.assertEqual(self.runjob()['productos'][0]['estado'], 'aplicado_local')
        previous = self.root / 'imagenes/test001/TEST001-01.webp'
        previous_bytes = previous.read_bytes()
        self.items['TEST001'][0]['revision_publicacion'] = 106
        revised = '/imagenes/test001/TEST001-r106-01.webp'
        self.contracts['TEST001']['imagen_principal'] = revised
        self.assertEqual(self.runjob()['productos'][0]['estado'], 'aplicado_local')
        self.assertEqual(previous.read_bytes(), previous_bytes)
        self.assertTrue((self.root / revised.lstrip('/')).is_file())
        self.assertEqual(pipeline.editorial.read_catalog(self.root)[1][0]['imageUrl'], revised)
        with patch.object(pipeline, 'process', side_effect=AssertionError('No regenerar revisión intacta')):
            self.assertEqual(self.runjob()['productos'][0]['estado'], 'aplicado_local')

    def test_revision_resource_tag_rejects_paths_and_nonintegers(self):
        for invalid in ['../otro', 0, -1, True, 1.5]:
            item = {**self.items['TEST001'][0], 'revision_publicacion': invalid}
            with self.subTest(revision=invalid), self.assertRaises(ValueError):
                pipeline.process(self.root, 'TEST001', item, self.rule)

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

    def test_original_classification_rejects_legacy_generic_labels(self):
        c = self.contracts['TEST001']
        c['especificaciones'].append({**c['especificaciones'][0], 'nombre': 'Clasificación', 'valor': 'AAA / genérica'})
        self.assertIn('clasificacion_contradictoria', {e['codigo'] for e in self.errors()})
        c['especificaciones'].pop()
        c['descripcion'] = 'Accesorio genérico.'
        self.assertIn('clasificacion_contradictoria', {e['codigo'] for e in self.errors()})
        c['descripcion'] = 'Producto original.'
        self.assertEqual(self.errors(), [])

    def test_financial_changes_block_only_affected_sku(self):
        self.manifest['skus'] = ['TEST001', 'TEST002']; self.contracts['TEST001']['precio_contado'] = 7.26
        r = self.runjob(); by = {x['sku']: x for x in r['productos']}
        self.assertEqual(by['TEST001']['estado'], 'pendiente'); self.assertEqual(by['TEST002']['estado'], 'aplicado_local')
        after = pipeline.editorial.read_catalog(self.root)[1]
        self.assertEqual(pipeline.editorial.financial(after), pipeline.editorial.financial(self.products))
        self.assertNotIn('imageUrl', after[0])

    def test_owner_authorized_reference_requires_instruction_and_intact_input(self):
        evidence = self.root / 'owner.json'
        evidence.write_text(json.dumps({'autorizacion_edicion_existente': {
            'confirmada': True, 'aplica_a_todos_sku': True,
            'no_afirma_permiso_distribuidor': True, 'mensaje': 'Fixture: editar referencia proporcionada.'}}))
        rights = self.contracts['TEST001']['derechos_imagen']
        rights.update(tipo='edicion_autorizada_propietario', edicion_asistida_ia=True,
            autorizacion_propietario={'archivo': evidence.name, 'sha256': validator.sha(evidence.read_bytes())},
            referencia_proporcionada={'archivo': 'TEST001.png', 'sha256': validator.sha((self.root / 'TEST001.png').read_bytes())})
        self.assertEqual(self.errors(), [])
        evidence.write_text('{}')
        self.assertIn('derechos', {e['codigo'] for e in self.errors()})
        rights['autorizacion_propietario']['sha256'] = validator.sha(evidence.read_bytes())
        self.assertIn('derechos', {e['codigo'] for e in self.errors()})

    def test_owner_reference_without_existing_image_is_not_a_permission_flag(self):
        rights = self.contracts['TEST001']['derechos_imagen']
        rights.update(tipo='edicion_autorizada_propietario', edicion_asistida_ia=True)
        self.assertIn('derechos', {e['codigo'] for e in self.errors()})

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


class SealedUnitPresentationTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
        (self.root/'importacion').mkdir();(self.root/'reportes').mkdir()
        self.proof={'origen':'CONFIRMACION_PROPIETARIO_CHAT','excepciones_presentacion_sellada':{'JUGU142':{'autorizada':True,'mostrar_empaque':True,'unidad_sellada':True}}}
        self.data={'version':1,'productos':{'JUGU142':{'aprobado_por_propietario':True,'tipo':'UNIDAD_SORPRESA_SELLADA'}}}
        self.write_proof();self.sealed=__import__('presentacion_sellada')
    def write_proof(self):
        p=self.root/'reportes/owner.json';p.write_text(json.dumps(self.proof));self.data['evidencia']={'archivo':'reportes/owner.json','sha256':hashlib.sha256(p.read_bytes()).hexdigest()};self.write_data()
    def write_data(self):
        (self.root/'importacion/excepciones-presentacion-sellada.json').write_text(json.dumps(self.data))
    def js(self,sku='JUGU142'):
        code='console.log(require('+json.dumps(str(ROOT/'scripts/presentacion-sellada.cjs'))+')(process.argv[1],process.argv[2]));'
        return subprocess.check_output(['node','-e',code,sku,str(self.root)],text=True).strip()=='true'
    def test_only_named_sku_has_matching_python_and_js_authorization(self):
        self.assertTrue(self.sealed.authorized(self.root,'JUGU142'));self.assertTrue(self.js())
        self.assertFalse(self.sealed.authorized(self.root,'OTHER001'));self.assertFalse(self.js('OTHER001'))
    def test_changed_proof_bytes_revoke_both_readers(self):
        (self.root/'reportes/owner.json').write_text('{}');self.assertFalse(self.sealed.authorized(self.root,'JUGU142'));self.assertFalse(self.js())
    def test_commercial_sealed_unit_requires_its_own_matching_proof(self):
        claim={'origen':'CONFIRMACION_PROPIETARIO_CHAT','excepciones_presentacion_sellada':{'CHIP001':{'autorizada':True,'mostrar_empaque':True,'unidad_sellada':True}}}
        file=self.root/'reportes/chips.json';file.write_text(json.dumps(claim))
        self.data['productos']['CHIP001']={'aprobado_por_propietario':True,'tipo':'UNIDAD_COMERCIAL_SELLADA','evidencia':{'archivo':'reportes/chips.json','sha256':hashlib.sha256(file.read_bytes()).hexdigest()}}
        self.write_data();self.assertTrue(self.sealed.authorized(self.root,'CHIP001'));self.assertTrue(self.js('CHIP001'))
        self.assertTrue(self.sealed.authorized(self.root,'JUGU142'));self.assertTrue(self.js())
        self.assertFalse(self.sealed.authorized(self.root,'CHIP002'));self.assertFalse(self.js('CHIP002'))
        self.data['productos']['CHIP001'].pop('evidencia');self.write_data()
        self.assertFalse(self.sealed.authorized(self.root,'CHIP001'));self.assertFalse(self.js('CHIP001'))
    def test_changed_commercial_proof_revokes_only_that_exception(self):
        file=self.root/'reportes/chips.json';file.write_text(json.dumps({'origen':'CONFIRMACION_PROPIETARIO_CHAT','excepciones_presentacion_sellada':{'CHIP001':{'autorizada':True,'mostrar_empaque':True,'unidad_sellada':True}}}))
        self.data['productos']['CHIP001']={'aprobado_por_propietario':True,'tipo':'UNIDAD_COMERCIAL_SELLADA','evidencia':{'archivo':'reportes/chips.json','sha256':hashlib.sha256(file.read_bytes()).hexdigest()}};self.write_data()
        file.write_text('{}');self.assertFalse(self.sealed.authorized(self.root,'CHIP001'));self.assertFalse(self.js('CHIP001'))
        self.assertTrue(self.sealed.authorized(self.root,'JUGU142'));self.assertTrue(self.js())
    def test_truth_like_flags_do_not_authorize(self):
        self.data['productos']['JUGU142']['aprobado_por_propietario']='true';self.write_data();self.assertFalse(self.sealed.authorized(self.root,'JUGU142'));self.assertFalse(self.js())
    def test_valid_hash_without_explicit_sku_claim_does_not_authorize(self):
        self.proof['excepciones_presentacion_sellada']={};self.write_proof();self.assertFalse(self.sealed.authorized(self.root,'JUGU142'));self.assertFalse(self.js())
    def test_path_outside_reports_is_rejected(self):
        self.data['evidencia']['archivo']='../owner.json';self.write_data();self.assertFalse(self.sealed.authorized(self.root,'JUGU142'));self.assertFalse(self.js())
    def test_box_photo_requires_sealed_single_unit_and_same_evidence(self):
        c={'unidad_venta':{'verificada':True,'sellada':True,'cantidad':1,'fuente':'reportes/owner.json'}};p={'contiene_caja':True};r={'presentacion':'con caja'}
        self.assertTrue(self.sealed.box_photo_allowed(self.root,'JUGU142',p,r,c))
        for k,v in [('verificada',False),('sellada',False),('cantidad',2),('cantidad',True),('fuente','reportes/other.json')]:
            bad=copy.deepcopy(c);bad['unidad_venta'][k]=v;self.assertFalse(self.sealed.box_photo_allowed(self.root,'JUGU142',p,r,bad))
        self.assertFalse(self.sealed.box_photo_allowed(self.root,'OTHER001',p,r,c))
        self.assertFalse(self.sealed.box_photo_allowed(self.root,'JUGU142',p,{'presentacion':'sin caja'},c))
    def test_global_sin_caja_is_kept_for_every_other_sku(self):
        rules=__import__('reglas_sku');row={'autenticidad':'original verificado','presentacion':'con caja','instrucciones':'','evidencia_autenticidad':'fixture','revision':1};registry={'politica_general':{'presentacion_obligatoria':'sin caja'},'productos':{'JUGU142':row,'OTHER001':row}}
        (self.root/'importacion/reglas-sku.json').write_text(json.dumps(registry))
        self.assertEqual(rules.rule('JUGU142',self.root)['presentacion'],'con caja');self.assertEqual(rules.rule('OTHER001',self.root)['presentacion'],'sin caja')
    def test_queue_refresh_preserves_only_confirmed_sealed_presentation(self):
        sync=module('sealed_queue_test','sincronizar-cola-drive.py');state={'productos':{'JUGU142':{},'OTHER001':{}},'resumen':{}};registry={'productos':{s:{'presentacion':'con caja','revision':3}for s in state['productos']}}
        sync.refresh_rule_revisions(state,registry,self.root)
        self.assertEqual(state['productos']['JUGU142']['presentacion'],'con caja');self.assertEqual(state['productos']['OTHER001']['presentacion'],'sin caja')
    def test_rule_update_accepts_confirmed_sku_and_rejects_other_box(self):
        rules=__import__('reglas_sku');row={'autenticidad':'original verificado','presentacion':'sin caja','instrucciones':'','evidencia_autenticidad':'fixture','revision':2};registry={'politica_general':{'presentacion_obligatoria':'sin caja'},'productos':{'JUGU142':row,'OTHER001':copy.deepcopy(row)}}
        file=self.root/'importacion/reglas-sku.json';file.write_text(json.dumps(registry));(self.root/'importacion/alias-sku.json').write_text('{}')
        update={'sku':'JUGU142','autenticidad':'','presentacion':'con caja','instrucciones':'Unidad sellada confirmada','evidencia_autenticidad':''};changed=rules.apply_rows([update],True,self.root);self.assertEqual(len(changed),1);self.assertEqual(rules.rule('JUGU142',self.root)['revision'],3)
        before=file.read_bytes();update['sku']='OTHER001'
        with self.assertRaises(ValueError):rules.apply_rows([update],True,self.root)
        self.assertEqual(file.read_bytes(),before)

class OutOfStockPricePresentationTests(unittest.TestCase):
    def test_archived_prices_keep_amount_and_availability_checks(self):
        subprocess.run(['node',str(ROOT/'scripts/test-precios-ficha.cjs')],check=True,capture_output=True,text=True)

class CommercialEditorialNameTests(unittest.TestCase):
    def test_commercial_name_requires_matching_review_and_original_identity(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'importacion/editorial/lotes').mkdir(parents=True)
            c={'sku':'TEST001','nombre_original':'NOMBRE 593','titulo_comercial':'Título comercial','especificaciones':[{'nombre':'Operador','valor':'Ejemplo'}],'descripcion':'Descripción verificada','imagen_principal':'/imagenes/test.webp'}
            product={'name':'Nombre anterior','specs':{'Operador':'Ejemplo'},'imageUrl':c['imagen_principal']}
            seo={'nombre':c['titulo_comercial'],'caracteristicas':product['specs'],'descripcion':c['descripcion'],'comercialVerificado':True,'imagen':c['imagen_principal'],'imagenPendiente':False}
            (root/'seo-contenido.json').write_text(json.dumps({'TEST001':seo}))
            entry={'titulo':c['titulo_comercial'],'subtitulo':'Dato verificado','tituloAnterior':product['name'],'nombre593':c['nombre_original'],'mostrarTituloEnFicha':True,'lote':'editorial-123'}
            mf={'skus':['TEST001'],'productos':{'TEST001':entry.copy()}}
            (root/'importacion/editorial/lotes/lote-123.json').write_text(json.dumps(mf))
            cfg=root/'importacion/editorial/publicados.json'
            with patch.object(validator,'active_cover',return_value=c['imagen_principal']):
                for key,bad in [(None,None),('tituloAnterior','Otra identidad'),('nombre593','Otro593'),('mostrarTituloEnFicha',False),('lote','../fuera')]:
                    e=entry.copy()
                    if key:e[key]=bad
                    cfg.write_text(json.dumps({'activo':True,'productos':{'TEST001':e}}))
                    errors=validator.validate_editorial(root,c,{'productos':{'TEST001':product}})
                    self.assertEqual(not errors,key is None,(key,errors))

if __name__ == '__main__':
    unittest.main()
