"""Offline XLSX validation, interruption/recovery and source-history regressions."""
import copy, fcntl, hashlib, io, json, os, re, sys, tempfile, unittest, zipfile
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import central_593_test as fixtures
import normalizar_593 as normalizer
import process_pending_593 as processor
import processing_lease
from report_identity import confirm_cut


def report(folder, name='Reporte-Inventario.xlsx', *, modified=True, header=True, when=None):
    when = when or fixtures.NOW
    original = fixtures.workbook(folder, [fixtures.row()], when=when, bad_header=not header)
    data = {}
    with zipfile.ZipFile(original) as z:
        data = {n: z.read(n) for n in z.namelist()}
    if modified:
        value = when if modified is True else modified
        data['docProps/core.xml'] = data['docProps/core.xml'].replace(
            b'</core>', ('<dcterms:modified>'+value.isoformat()+'</dcterms:modified></core>').encode())
    path = Path(folder) / name
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for n, b in data.items(): z.writestr(n, b)
    return path


class Sync593(unittest.TestCase):
    def normalized(self, p, **kw):
        return normalizer.normalize(p, fixtures.BASE, fixtures.WEB, now=fixtures.NOW, **kw)

    def test_workflow_authenticates_finalization_and_checks_exact_run_before_processing(self):
        workflow = (Path(__file__).resolve().parents[2]/'.github/workflows/central-593.yml').read_text()
        # A rerun must use the checked release, even if its branch has advanced.
        checkout = workflow.split('      - uses: actions/checkout@v4', 1)[1].split('      - ', 1)[0]
        self.assertIn('ref: ${{ github.sha }}', checkout)
        processing = workflow.index('      - id: reporte')
        for command in ('python automatizacion/tests/sync_593_test.py',
                        'node automatizacion/tests/sync-receiver.test.mjs'):
            self.assertLess(workflow.index(command), processing)
        # Step environments are independent: the read step cannot authenticate finish.
        finish = re.search(r'^      - name: Borrar el original privado[^\n]*\n(.*?)(?=^      - |\Z)',
                           workflow, re.M | re.S)
        self.assertIsNotNone(finish)
        self.assertIn('        env:\n          PILOT_TOKEN: ${{ secrets.PILOT_TOKEN }}', finish[1])

    def test_original_and_historical_names_same_data_and_original_bytes_untouched(self):
        with tempfile.TemporaryDirectory() as folder:
            path = report(folder); before = path.read_bytes(); digest = hashlib.sha256(before).hexdigest()
            original, _ = self.normalized(path)
            self.assertEqual(original['source']['original_name'], 'Reporte-Inventario.xlsx')
            self.assertEqual(original['source']['cut_date_evidence'], '593_matching_created_modified')
            for name in ('Reporte-Inventario al '+fixtures.LOCAL.strftime('%d-%m-%Y')+'.xlsx',
                         'Reporte-Inventario '+fixtures.LOCAL.strftime('%d-%m-%Y')+'.xlsx'):
                other = Path(folder)/name;other.write_bytes(before); data, _ = self.normalized(other)
                self.assertEqual(data['products'], original['products'])
                self.assertEqual(data['source']['sha256'], digest)
            self.assertEqual(path.read_bytes(), before)

    def test_cut_comes_from_export_not_reception_and_guayaquil_midnight_is_preserved(self):
        with tempfile.TemporaryDirectory() as folder:
            when = fixtures.NOW - timedelta(hours=3)
            data, _ = self.normalized(report(folder, when=when))
            self.assertEqual(data['source']['generated_at'], normalizer.iso(when))
            self.assertEqual(data['source']['received_at'], normalizer.iso(fixtures.NOW))
            self.assertNotEqual(data['source']['received_at'], data['source']['generated_at'])
            self.assertEqual(data['source']['cut_date'], when.astimezone(fixtures.LOCAL.tzinfo).date().isoformat())

    def test_explicit_report_date_must_agree_and_missing_evidence_is_not_invented(self):
        when=fixtures.NOW.isoformat();date=fixtures.LOCAL.date()
        generated,cut,evidence=confirm_cut('Reporte-Inventario.xlsx',when,None,[date])
        self.assertEqual(cut,date.isoformat());self.assertEqual(evidence,'report_heading_and_export_timestamp')
        for args in ((when,None,[date-timedelta(days=1)]),(None,None,[]),(when,None,[])):
            with self.subTest(args=args),self.assertRaises(ValueError):confirm_cut('Reporte-Inventario.xlsx',*args)

    def test_missing_or_changed_metadata_uncertain_date_bad_structure_and_old_cut_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            for kw in ({'modified':False}, {'modified':fixtures.NOW+timedelta(seconds=1)},
                       {'header':False}, {'when':fixtures.NOW-timedelta(days=2)}):
                with self.subTest(kw=kw), self.assertRaises(ValueError):self.normalized(report(folder, **kw))
            p=Path(folder)/'Reporte-Inventario.xlsx';p.write_bytes(b'PK'+b'0'*200)
            with self.assertRaisesRegex(ValueError,'INVENTORY_STRUCTURE_INVALID'):self.normalized(p)

    def test_last_valid_and_history_survive_preparation_failure_old_cut_and_repeat(self):
        with tempfile.TemporaryDirectory() as folder:
            old, validation = self.normalized(report(folder, when=fixtures.NOW-timedelta(minutes=2)))
            newer, report_data = self.normalized(report(folder, when=fixtures.NOW-timedelta(minutes=1)))
            out=Path(folder)/'hub';normalizer.write_bundle(out, old, validation)
            before=(out/'current.json').read_bytes()
            with patch.object(normalizer,'adapters',side_effect=OSError('synthetic interruption')):
                with self.assertRaises(OSError):normalizer.write_bundle(out,newer,report_data)
            self.assertEqual((out/'current.json').read_bytes(),before)
            normalizer.write_bundle(out,newer,report_data)
            self.assertEqual(json.loads((out/'last-valid.json').read_text())['source'],old['source'])
            self.assertEqual(len(list((out/'history').glob('*.json'))),2)
            unchanged=(out/'current.json').read_bytes()
            self.assertFalse(normalizer.write_bundle(out,newer,report_data))
            self.assertEqual((out/'current.json').read_bytes(),unchanged)
            with self.assertRaisesRegex(ValueError,'OLDER_THAN_LAST_VALID'):normalizer.write_bundle(out,old,validation)
            self.assertEqual((out/'current.json').read_bytes(),unchanged)

    def test_local_writer_lock_blocks_a_concurrent_promotion(self):
        with tempfile.TemporaryDirectory() as folder:
            data, validation=self.normalized(report(folder));out=Path(folder)/'hub'
            with (Path(folder)/'.hub-593.lock').open('a') as lock:
                fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
                with self.assertRaisesRegex(RuntimeError,'REPORT_BUSY'):normalizer.write_bundle(out,data,validation)
            self.assertFalse((out/'current.json').exists())

    def test_interruption_after_deployment_recovers_receipt_without_download_or_redeploy(self):
        with tempfile.TemporaryDirectory() as folder:
            current,_=self.normalized(report(folder));sha=current['source']['sha256'];calls=[]
            def request(path,body=None):
                calls.append((path,body))
                if path=='/commercial/status':data={'pending':True,'file_sha256':sha}
                elif path=='/commercial/catalog':data=current
                elif body['status']=='claim':data={'lease_token':'synthetic-lease'}
                elif body['status']=='processed':data={'completed':True,'raw_file_erased':True}
                else:raise AssertionError('Unexpected operation')
                return io.BytesIO(json.dumps(data).encode())
            with patch.dict(os.environ,{'GITHUB_REF':'refs/heads/automatizacion/piloto-cloud-3sku-20261015','RUNNER_TEMP':folder}),patch.object(processor,'request',side_effect=request):
                processor.main();self.assertFalse(processing_lease.location().exists())
            self.assertFalse(any('/commercial/report' in path for path,_ in calls))
            self.assertEqual([b['status'] for _,b in calls if b],['claim','processed'])

    def test_private_lease_permissions_and_release_do_not_enter_artifacts(self):
        with tempfile.TemporaryDirectory() as folder,patch.dict(os.environ,{'RUNNER_TEMP':folder}):
            processing_lease.save('a'*64,'synthetic-only')
            p=processing_lease.location();self.assertEqual(p.stat().st_mode&0o777,0o600)
            self.assertNotIn('automatizacion',str(p))
            calls=[]
            def request(path,body):calls.append(body);return io.BytesIO(b'{"released":true}')
            processing_lease.finish(request,'release');self.assertFalse(p.exists());self.assertEqual(calls[0]['status'],'release')

if __name__=='__main__':unittest.main()
