import copy
import hashlib
import json
import unittest
from unittest.mock import patch

import test_feed as fixtures
from conciliacion import Reconciler


class RecoveryTest(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.FeedTest('test_valid_xml_and_no_invented_identifiers')
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.root = self.fixture.root
        (self.root / 'importacion/premium-activo.json').write_text('{"productos":{}}')
        (self.root / 'importacion/excepciones-presentacion-sellada.json').write_text('{"version":1,"productos":{}}')
        self.context = Reconciler.__new__(Reconciler)
        self.context.root, self.context.cache, self.context.proofs = self.root, {}, {}
        self.context.snapshot = {'productos': {}}
        self.context.commit = 'source-test'

    def candidate(self):
        f = self.fixture
        return fixtures.feed.candidate(self.root, f.p, f.o, 'test1-producto', f.master, reconciler=self.context)

    def legacy_report(self, state='publicado_verificado', sku='TEST1'):
        f = self.fixture
        report = dict(resultados=[dict(solicitado=sku, sku=sku, estado=state, http=200,
                     imagen_pendiente=False, url=f.schema['offers']['url'], sha256_ficha='a' * 64,
                     versiones_verificadas=[dict(http=200, sha256='b' * 64)])])
        (self.root / 'reportes').mkdir(exist_ok=True)
        path = self.root / 'reportes/historico.json'
        path.write_text(json.dumps(report))
        f.contract['validaciones']['publicacion_http'] = dict(archivo='reportes/historico.json',
                                                           sha256=hashlib.sha256(path.read_bytes()).hexdigest())
        f.save()

    def test_missing_status_uses_verified_report_without_editing_contract(self):
        self.legacy_report()
        path = self.root / 'importacion/contratos/TEST1.json'
        before = path.read_bytes()
        with self.assertRaisesRegex(ValueError, 'publicacion_no_verificada'):
            self.fixture.run_candidate()
        row, _ = self.candidate()
        self.assertEqual(row['excluded_destination'], ['Shopping_ads', 'Free_listings'])
        self.assertEqual(before, path.read_bytes())
        self.assertEqual(self.context.proofs['TEST1'][0]['tipo'], 'publicacion_historica_recuperada')

    def test_local_status_requires_actual_successful_publication_evidence(self):
        self.legacy_report()
        self.fixture.contract['estado_publicacion'] = 'APROBADO_LOCAL'
        self.fixture.save()
        self.assertEqual(self.candidate()[0]['id'], 'TEST1')

    def test_report_hash_mismatch_is_not_approval(self):
        self.legacy_report()
        (self.root / 'reportes/historico.json').write_text('{}')
        with self.assertRaisesRegex(ValueError, 'hash_evidencia'):
            self.candidate()

    def test_failed_or_other_sku_report_is_not_approval(self):
        for state, sku in [('pendiente', 'TEST1'), ('publicado_verificado', 'OTHER')]:
            self.legacy_report(state, sku)
            self.context.cache = {}
            with self.subTest(state=state, sku=sku), self.assertRaisesRegex(ValueError, 'publicacion_no_verificada'):
                self.candidate()

    def test_recovery_does_not_override_commercial_quality_or_unit(self):
        self.legacy_report()
        self.fixture.contract['estado_calidad'] = 'REVISAR'
        self.fixture.save()
        with self.assertRaisesRegex(ValueError, 'publicacion_no_verificada'):
            self.candidate()
        self.fixture.contract['estado_calidad'] = 'APROBADO'
        self.fixture.contract['unidad_venta']['verificada'] = False
        self.fixture.save()
        with self.assertRaisesRegex(ValueError, 'ficha_o_unidad_pendiente'):
            self.candidate()

    def set_omission(self, treatment='NO_DECLARAR'):
        identity = self.fixture.contract['validaciones']['identidad']
        identity.update(modelo_no_declarado=True, discrepancias_pendientes=[
            dict(campo='modelo', valor_catalogo='DUDOSO123', tratamiento=treatment)])
        self.fixture.save()

    def test_documented_non_declaration_is_respected_not_deleted_from_source(self):
        self.set_omission()
        before = copy.deepcopy(self.fixture.contract)
        self.assertEqual(self.candidate()[0]['id'], 'TEST1')
        self.assertEqual(self.fixture.contract, before)
        self.assertNotIn('DUDOSO123', json.dumps(self.candidate()[0]))

    def test_open_identity_discrepancy_still_blocks(self):
        self.set_omission('PENDIENTE')
        with self.assertRaisesRegex(ValueError, 'identidad_pendiente'):
            self.candidate()

    def test_disputed_model_cannot_be_emitted(self):
        self.set_omission()
        self.fixture.schema['model'] = 'DUDOSO123'
        self.fixture.save()
        with self.assertRaisesRegex(ValueError, 'identidad_pendiente'):
            self.candidate()

    def test_photo_change_requires_existing_registry_and_contract_chain(self):
        f = self.fixture
        self.context.snapshot['productos']['TEST1'] = dict(imagen='/imagenes/new.png', imagenProfesional=f.o['imagenProfesional'], fuentes=[])
        with self.assertRaisesRegex(ValueError, 'cadena_imagen_contrato_no_acreditada'):
            self.candidate()

    def sealed(self):
        source = dict(origen='CONFIRMACION_PROPIETARIO_CHAT', excepciones_presentacion_sellada={
            'TEST1': dict(autorizada=True, mostrar_empaque=True, unidad_sellada=True)})
        (self.root / 'reportes').mkdir(exist_ok=True)
        path = self.root / 'reportes/sellado.json'
        path.write_text(json.dumps(source))
        registry = dict(version=1, productos={'TEST1': dict(aprobado_por_propietario=True,
            tipo='UNIDAD_COMERCIAL_SELLADA', evidencia=dict(archivo='reportes/sellado.json',
            sha256=hashlib.sha256(path.read_bytes()).hexdigest()))})
        (self.root / 'importacion/excepciones-presentacion-sellada.json').write_text(json.dumps(registry))
        self.fixture.o['imagenProfesional']['contiene_caja'] = True
        self.fixture.contract['unidad_venta']['sellada'] = True
        self.fixture.save()

    def test_sealed_exception_requires_scoped_owner_claim_and_hash(self):
        self.sealed()
        self.assertEqual(self.candidate()[0]['id'], 'TEST1')
        self.assertTrue(self.fixture.o['imagenProfesional']['contiene_caja'])
        self.context.cache = {}
        (self.root / 'reportes/sellado.json').write_text('{}')
        with self.assertRaisesRegex(ValueError, 'hash_evidencia'):
            self.candidate()

    def test_box_without_authorized_exception_still_blocks(self):
        self.fixture.o['imagenProfesional']['contiene_caja'] = True
        with self.assertRaisesRegex(ValueError, 'fotografia_no_aprobada'):
            self.candidate()

    def test_pending_premium_master_cannot_be_reused(self):
        digest = hashlib.sha256((self.root / 'imagenes/test.png').read_bytes()).hexdigest()
        (self.root / 'importacion/premium-activo.json').write_text(json.dumps(dict(productos={
            'TEST1': dict(sha256_maestro=digest, fidelidad_resuelta=False, aprobacion_visual={})})))
        with self.assertRaisesRegex(ValueError, 'aprobacion_premium_por_sha_pendiente'):
            self.candidate()

    def test_change_of_cached_evidence_aborts_before_writing(self):
        self.context.read('importacion/premium-activo.json')
        (self.root / 'importacion/premium-activo.json').write_text('{}')
        with patch('conciliacion.subprocess.check_output', return_value='source-test\n'):
            with self.assertRaisesRegex(ValueError, 'Cambio concurrente de evidencia'):
                self.context.verify_snapshot()


if __name__ == '__main__':
    unittest.main()
