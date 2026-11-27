"""Regresiones de altas/deltas; todas las escrituras quedan en fixtures temporales."""
import copy, importlib.util, json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('queue_altas',ROOT/'scripts/sincronizar-cola-drive.py')
queue=importlib.util.module_from_spec(spec);spec.loader.exec_module(queue)
SHA='a'*64

class QueueAltasTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);(self.root/'datos-593').mkdir();(self.root/'importacion').mkdir()
        self.files=[{'id':'photo1','nombre':'TEST001.jpg','modificado':'1','bytes':100,'sha256':'b'*64}]
        self.rows=[['Fecha','SKU','Archivo','URL','Tipo','Presentación'],
                   ['', 'TEST001','TEST001.jpg','https://drive.google.com/file/d/photo1/view','Original','']]
        self.catalog=[{'sku':'TEST001'}]
        self.cut={'fecha_corte':'2026-11-27','sha256_original':SHA,'productos':{'NEW001':{'stock':1}},
                  'revision_fuente':{'secuencia':7},'evidencia_checkout':{
                  'schema':'conectatech.checkout-source-attestation.v1','source_sha256':SHA,
                  'cut_date':'2026-11-27','revision_sequence':7,'identity_signatures':{'NEW001':'c'*64}}}
        self.write('datos-593/cut.json',self.cut)
        self.state={'origen_sha256':SHA,'fecha_corte':'2026-11-27','revision_fuente':{'secuencia':7},
                    'referencia':'datos-593/cut.json'}
        self.write('datos-593/estado-ultimo-corte.json',self.state)

    def write(self,path,value):
        target=self.root/path;target.parent.mkdir(parents=True,exist_ok=True)
        target.write_text(json.dumps(value));return target

    def run_queue(self,files=None,rows=None,previous=None,source=None,delta=False):
        return queue.synchronize(files if files is not None else self.files,
             rows if rows is not None else self.rows,self.catalog,{},previous or {},source,delta)

    def close(self,state,sku='TEST001'):
        entry=state['productos'][sku];entry['revision_regla']=1
        entry['produccion']={'huella_revisada':entry['huella'],'revision_regla_revisada':1,
                             'estado':'publicado_verificado','reporte':'reportes/real.json'}
        return state

    def new_photo(self,sku='NEW001'):
        self.files[0]['nombre']=sku+'.jpg';self.rows[1][1]=sku;self.rows[1][2]=sku+'.jpg'

    def test_new_exact_suffix_requires_evidence_and_never_approves(self):
        self.new_photo('ADAP027A')
        self.assertFalse(self.run_queue()['productos']) # CLI histórico, sin fuente593.
        self.cut['productos']['ADAP027A']={'stock':1}
        self.cut['evidencia_checkout']['identity_signatures']['ADAP027A']='d'*64
        self.write('datos-593/cut.json',self.cut)
        source=queue.load_source593(self.root/'datos-593/estado-ultimo-corte.json',self.root)
        entry=self.run_queue(source=source)['productos']['ADAP027A']
        self.assertEqual(entry['tipo_trabajo'],'alta');self.assertEqual(entry['estado'],'REVISAR')
        self.assertFalse(entry['pendientes_593']);self.assertNotIn('aprobaciones',entry)
        self.assertEqual(entry['fuente_593']['identidad_sha256'],'d'*64)

    def test_new_photo_outside_canonical_coverage_remains_pending(self):
        self.new_photo('OUT001')
        source=queue.load_source593(self.root/'datos-593/cut.json',self.root)
        entry=self.run_queue(source=source)['productos']['OUT001']
        self.assertEqual(entry['estado'],'REVISAR');self.assertTrue(entry['pendientes_593'])
        self.assertIsNone(entry['fuente_593']['identidad_sha256'])

    def test_company_photo_without_legacy_registry_stays_in_review(self):
        self.new_photo();source=queue.load_source593(self.root/'datos-593/cut.json',self.root)
        entry=self.run_queue(rows=[self.rows[0]],source=source)['productos']['NEW001']
        self.assertEqual(entry['estado'],'REVISAR');self.assertTrue(entry['incidencias'])
        self.assertEqual(entry['autenticidad'],'por verificar')

    def test_company_timestamp_suffix_preserves_exact_sku(self):
        self.new_photo('MOUS047')
        self.files[0]['nombre']='MOUS047_20261126_130536_409_46608fdc.jpg'
        self.rows[1][2]=self.files[0]['nombre']
        source=queue.load_source593(self.root/'datos-593/cut.json',self.root)
        result=self.run_queue(source=source)
        self.assertEqual(list(result['productos']),['MOUS047'])
        self.assertTrue(result['productos']['MOUS047']['pendientes_593'])
        self.files[0]['nombre']='MOUS047unknown_suffix.jpg'
        self.assertFalse(self.run_queue(source=source)['productos'])

    def test_source_rejects_mismatched_state_attestation_or_boolean_sequence(self):
        for field,value in [('source_sha256','d'*64),('cut_date','2026-11-26'),('revision_sequence',True)]:
            cut=copy.deepcopy(self.cut);cut['evidencia_checkout'][field]=value
            self.write('datos-593/cut.json',cut)
            with self.subTest(field=field),self.assertRaises(ValueError):
                queue.load_source593(self.root/'datos-593/estado-ultimo-corte.json',self.root)
        self.write('datos-593/cut.json',self.cut)
        self.state['origen_sha256']='d'*64;self.write('datos-593/estado-ultimo-corte.json',self.state)
        with self.assertRaises(ValueError):queue.load_source593(self.root/'datos-593/estado-ultimo-corte.json',self.root)
        self.cut['revision_fuente']['secuencia']=1
        self.cut['evidencia_checkout']['revision_sequence']=True
        self.write('datos-593/cut.json',self.cut)
        with self.assertRaises(ValueError):queue.load_source593(self.root/'datos-593/cut.json',self.root)

    def test_source_reference_cannot_escape_repository(self):
        self.state['referencia']='../outside.json'
        path=self.write('datos-593/estado-ultimo-corte.json',self.state)
        with self.assertRaisesRegex(ValueError,'fuera'):queue.load_source593(path,self.root)

    def test_missing_canonical_attestation_fails_without_recursing(self):
        self.cut.pop('evidencia_checkout');self.write('datos-593/cut.json',self.cut)
        with self.assertRaisesRegex(ValueError,'contrato de identidad'):
            queue.load_source593(self.root/'datos-593/estado-ultimo-corte.json',self.root)

    def extract(self):
        return {'fecha_corte':'2026-11-27','archivo':'Reporte-Inventario.xlsx','sha256_original':SHA,
                'productos':{'NEW001':{'fila':1510,'nombre':'Producto nuevo exacto','stock':1,
                                      'promo_contado':10.0,'pvp_final':12.5}}}

    def test_sanitized_extract_links_current_source_without_auto_approval(self):
        path=self.write('reportes/alta/base-593.json',self.extract())
        source=queue.load_source593(path,self.root);self.new_photo()
        entry=self.run_queue(source=source)['productos']['NEW001']
        self.assertEqual(entry['estado'],'REVISAR')
        self.assertEqual(entry['fuente_593']['evidencia']['fila'],1510)
        self.assertFalse(entry['fuente_593']['evidencia']['alta_registrada'])
        self.assertNotIn('stock',entry['fuente_593'])

    def test_extract_rejects_stale_source_missing_row_and_private_cost(self):
        for mutate in [lambda d:d.update(sha256_original='d'*64),
                       lambda d:d['productos']['NEW001'].pop('fila'),
                       lambda d:d['productos']['NEW001'].update(costo=1)]:
            extract=self.extract();mutate(extract);path=self.write('reportes/alta/base-593.json',extract)
            with self.assertRaises(ValueError):queue.load_source593(path,self.root)

    def test_historical_extract_requires_matching_registered_evidence(self):
        extract=self.extract();extract.update(sha256_original='d'*64,fecha_corte='2026-11-23')
        extract['productos']['NEW001'].pop('fila')
        self.cut['altas_validadas']=[{'sha256_original':'d'*64,'fecha':'2026-11-23',
                                    'skus':['NEW001'],'evidencia':'reportes/alta/base-593.json'}]
        self.write('datos-593/cut.json',self.cut)
        path=self.write('reportes/alta/base-593.json',extract)
        self.assertTrue(queue.load_source593(path,self.root)['referencias']['NEW001']['alta_registrada'])
        other=self.write('reportes/other.json',extract)
        with self.assertRaises(ValueError):queue.load_source593(other,self.root)

    def test_rename_and_identical_content_ids_do_not_reopen_closed_work(self):
        first=self.close(self.run_queue());fingerprint=first['productos']['TEST001']['huella']
        self.files[0].update(nombre='TEST001_20261127_000100.jpg',modificado='2')
        second=self.run_queue(previous=first)
        self.assertEqual(second['cambios'],[]);self.assertEqual(second['productos']['TEST001']['huella'],fingerprint)
        self.assertFalse(queue.needs_work(second['productos']['TEST001']))
        duplicate={**self.files[0],'id':'photo2'}
        rows=self.rows+[['','TEST001',duplicate['nombre'],'https://drive.google.com/file/d/photo2/view','Original','']]
        third=self.run_queue(files=self.files+[duplicate],rows=rows,previous=second)
        self.assertEqual(third['cambios'],[]);self.assertEqual(len(third['duplicados_exactos']),1)

    def test_company_rename_without_legacy_registry_preserves_content_fingerprint(self):
        first=self.close(self.run_queue(rows=[]))
        self.files[0].update(nombre='TEST001_20261127_000100_123_abcdef12.jpg',modificado='2')
        second=self.run_queue(rows=[],previous=first)
        self.assertEqual(second['cambios'],[])
        self.assertFalse(queue.needs_work(second['productos']['TEST001']))

    def test_changed_hash_preserves_production_and_source_history(self):
        first=self.close(self.run_queue());old=copy.deepcopy(first)
        self.files[0]['sha256']='e'*64
        second=self.run_queue(previous=first);entry=second['productos']['TEST001']
        self.assertEqual(entry['produccion'],old['productos']['TEST001']['produccion'])
        self.assertEqual(entry['historial_fuentes'][0]['fotos'][0]['sha256'],'b'*64)
        self.assertTrue(queue.needs_work(entry));self.assertEqual(first,old)

    def test_first_593_provenance_does_not_reopen_existing_unchanged_sku(self):
        first=self.close(self.run_queue())
        self.cut['productos']['TEST001']={'stock':1}
        self.cut['evidencia_checkout']['identity_signatures']['TEST001']='d'*64
        self.write('datos-593/cut.json',self.cut)
        source=queue.load_source593(self.root/'datos-593/cut.json',self.root)
        second=self.run_queue(previous=first,source=source)
        self.assertEqual(second['cambios'],[]);self.assertFalse(queue.needs_work(second['productos']['TEST001']))
        third=self.run_queue(previous=second,source=source)
        self.assertEqual(third['cambios'],[])

    def test_owner_principal_selection_is_a_semantic_change(self):
        first=self.close(self.run_queue())
        self.files[0]['nombre']='TEST001 PRINCIPAL.jpg'
        second=self.run_queue(previous=first)
        self.assertEqual(second['cambios'],['TEST001'])
        self.assertTrue(queue.needs_work(second['productos']['TEST001']))

    def test_hash_reused_only_when_drive_metadata_matches(self):
        first=self.close(self.run_queue());self.files[0].pop('sha256')
        same=self.run_queue(previous=first)
        self.assertEqual(same['productos']['TEST001']['fotos'][0]['sha256'],'b'*64)
        self.assertEqual(same['cambios'],[])
        self.files[0]['modificado']='2'
        changed=self.run_queue(previous=same)
        self.assertIsNone(changed['productos']['TEST001']['fotos'][0]['sha256'])
        self.assertEqual(changed['cambios'],['TEST001'])

    def test_delta_preserves_omitted_sku_and_views_and_detects_duplicates(self):
        files=self.files+[{'id':'photo2','nombre':'TEST001-02.jpg','sha256':'c'*64},
                          {'id':'other','nombre':'OTHER001.jpg','sha256':'d'*64}]
        rows=self.rows+[['','TEST001','TEST001-02.jpg','https://drive.google.com/file/d/photo2/view','Original',''],
                       ['','OTHER001','OTHER001.jpg','https://drive.google.com/file/d/other/view','Original','']]
        self.catalog.append({'sku':'OTHER001'});first=self.run_queue(files=files,rows=rows)
        changed={**self.files[0],'sha256':'d'*64}
        delta=self.run_queue(files=[changed],rows=rows,previous=first,delta=True)
        self.assertEqual(delta['ausentes_en_snapshot'],[])
        self.assertEqual(len(delta['productos']['TEST001']['fotos']),2)
        self.assertEqual(delta['productos']['OTHER001'],first['productos']['OTHER001'])
        self.assertEqual(list(delta['productos']),list(first['productos']))
        self.assertEqual(len(delta['duplicados_exactos']),1)

    def test_reappearing_closed_source_clears_absence_without_reprocessing(self):
        first=self.close(self.run_queue());absent=self.run_queue(files=[],previous=first)
        self.assertTrue(absent['productos']['TEST001']['ausente_en_snapshot'])
        back=self.run_queue(previous=absent)
        self.assertNotIn('ausente_en_snapshot',back['productos']['TEST001'])
        self.assertFalse(queue.needs_work(back['productos']['TEST001']))

    def test_delta_preserves_company_watermark_until_operator_advances_it(self):
        first=self.run_queue()
        first['fuentes_empresariales']={'referencias':{'watermark':'2026-11-26T18:07:19.953Z'}}
        second=self.run_queue(files=[],previous=first,delta=True)
        self.assertEqual(second['fuentes_empresariales'],first['fuentes_empresariales'])
        second['fuentes_empresariales']['referencias']['watermark']='changed'
        self.assertEqual(first['fuentes_empresariales']['referencias']['watermark'],'2026-11-26T18:07:19.953Z')

    def test_rename_to_other_sku_and_registry_conflict_are_not_silently_deduplicated(self):
        first=self.run_queue();self.catalog.append({'sku':'OTHER001'})
        self.files[0]['nombre']='OTHER001.jpg'
        conflict=self.run_queue(previous=first,delta=True)
        self.assertTrue(conflict['errores']);self.assertNotIn('OTHER001',conflict['productos'])
        self.files[0]['nombre']='TEST001.jpg';self.rows[1][1]='OTHER001'
        self.assertEqual(self.run_queue(previous=first)['productos']['TEST001']['estado'],'BLOQUEADO')

    def test_legacy_cli_and_new_delta_cli_only_write_temporary_state(self):
        self.write('index.html','unused')
        (self.root/'index.html').write_text('const products='+json.dumps(self.catalog)+';\n')
        self.write('importacion/alias-sku.json',{})
        self.write('importacion/reglas-sku.json',{'productos':{'TEST001':{'revision':1}}})
        files=self.write('files.json',self.files);rows=self.write('rows.json',self.rows)
        args=['queue','--inventario',str(files),'--registro',str(rows),'--estado',str(self.root/'state.json'),
              '--lote',str(self.root/'lot.json')]
        with patch.object(queue,'ROOT',self.root),patch('sys.argv',args):queue.main()
        self.assertEqual(json.loads((self.root/'lot.json').read_text())['skus'],['TEST001'])
        with patch.object(queue,'ROOT',self.root),patch('sys.argv',args+['--delta','--fuente-593',str(self.root/'datos-593/cut.json')]):queue.main()
        lot=json.loads((self.root/'lot.json').read_text())
        self.assertEqual(lot['version'],3);self.assertEqual(lot['aprobaciones'],{})
        company_args=args[:3]+args[5:]+['--delta','--fuente-593',str(self.root/'datos-593/cut.json')]
        with patch.object(queue,'ROOT',self.root),patch('sys.argv',company_args):queue.main()
        entry=json.loads((self.root/'state.json').read_text())['productos']['TEST001']
        self.assertEqual(entry['estado'],'REVISAR');self.assertTrue(entry['incidencias'])

    def test_new_pending_high_priority_and_delta_changes_precede_historical_phones(self):
        historical={f'TELF{i:03}':{'huella':'old'+str(i),'revision_regla':1}
                    for i in range(20)}
        products={**historical,'CABL001':{'huella':'changed','tipo_trabajo':'actualizacion'}}
        for sku in ['PARL017','MOUS047','PET001','TECL034']:
            products[sku]={'huella':'new'+sku,'revision_regla':1,'tipo_trabajo':'alta'}
        # Una alta seleccionada en un ciclo previo sigue primero mientras su evidencia no esté revisada.
        state={'productos':products,'cambios':['MOUS047','PET001','TECL034','CABL001']}
        waiting=queue.pending_order(state)
        self.assertEqual(set(waiting[:4]),{'PARL017','MOUS047','PET001','TECL034'})
        self.assertEqual(waiting[4],'CABL001')
        self.assertEqual(waiting[5:7],['TELF000','TELF001'])
        self.assertEqual(len(waiting),25) # El límite operativo no borra pendientes históricos.
        products['PARL017']['produccion']={'huella_revisada':'newPARL017',
            'revision_regla_revisada':1,'estado':'REVISAR'}
        self.assertNotIn('PARL017',queue.pending_order(state))

    def prepare_cli_with_default_classification_policy(self):
        self.catalog.append({'sku':'OTHER001'})
        (self.root/'index.html').write_text('const products='+json.dumps(self.catalog)+';\n')
        self.write('importacion/alias-sku.json',{})
        registry={'productos':{sku:{'revision':1,'autenticidad':'por verificar','presentacion':'sin caja',
                                   'instrucciones':'','evidencia_autenticidad':''}
                               for sku in ['TEST001','OTHER001']},'politica_general':{
            'autenticidad_registro':{'confirmado_por_propietario':True,
                'modo':'ORIGINAL_POR_DEFECTO_EXCEPTO_MARCAS_AAA','marcas_excepcion_aaa':[],
                'valores_tipo':{'Original':'original verificado'},'fecha_confirmacion':'2026-11-26',
                'documento_url':'https://example.test/fixture','pestana':'Registro'}}}
        rules_path=self.write('importacion/reglas-sku.json',registry)
        old_file={'id':'oldphoto','nombre':'OTHER001.jpg','sha256':'c'*64}
        rows=self.rows+[['','OTHER001','OTHER001.jpg','https://drive.google.com/file/d/oldphoto/view','Original','']]
        previous=self.run_queue(files=self.files+[old_file],rows=rows)
        self.write('state.json',previous)
        files=self.write('files.json',self.files)
        args=['queue','--inventario',str(files),'--estado',str(self.root/'state.json'),
              '--lote',str(self.root/'lot.json'),'--delta']
        return args,rules_path,rows

    def test_company_cli_without_registry_or_with_header_only_never_mutates_rules(self):
        args,rules_path,rows=self.prepare_cli_with_default_classification_policy()
        before=rules_path.read_bytes();empty=self.write('empty-registry.json',[rows[0]])
        for extra in [[],['--registro',str(empty)]]:
            with self.subTest(extra=extra),patch.object(queue,'ROOT',self.root),patch('sys.argv',args+extra):
                queue.main()
            self.assertEqual(rules_path.read_bytes(),before)
            summary=json.loads((self.root/'state.json').read_text())['resumen']
            self.assertNotIn('reglas_autenticidad_actualizadas',summary)

    def test_explicit_registry_cannot_reclassify_historical_sku_outside_delta(self):
        args,rules_path,rows=self.prepare_cli_with_default_classification_policy()
        before=json.loads(rules_path.read_text())['productos']['OTHER001']
        registry=self.write('registry.json',rows)
        with patch.object(queue,'ROOT',self.root),patch('sys.argv',args+['--registro',str(registry)]):
            queue.main()
        result=json.loads(rules_path.read_text())
        self.assertEqual(result['productos']['OTHER001'],before)
        self.assertEqual(result['productos']['TEST001']['autenticidad'],'original verificado')
        changes=result['historial'][0]['cambios']
        self.assertEqual([change['sku'] for change in changes],['TEST001'])

if __name__=='__main__':unittest.main()
