"""Offline full-export safety tests; production thresholds are not lowered here."""
import copy, hashlib, io, json, os, sys, tempfile, unittest, zipfile
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import central_593_test as f
import normalizar_593 as n
import process_pending_593 as processor
from inventory_completeness import guard_rows, guard_impact, IncompleteReport


def rows(count):
    return [f.row('TEST%05d' % i) for i in range(count)]


def baseline(count):
    return 'sku,nombre,stock,promo_contado,pvp_final,categoria\n'+''.join(
        'TEST%05d,Producto verificado,7,2.50,2.87,Accesorios\n' % i for i in range(count))


class Completeness(unittest.TestCase):
    def test_guard_is_part_of_authenticated_processor_fingerprint(self):
        import scoped_content
        self.assertIn('automatizacion/inventory_completeness.py',scoped_content.CRITICAL_FILES)

    def normalize(self, folder, count, base=0, **kw):
        return n.normalize(f.workbook(folder, rows(count)), baseline(base),
                           f.WEB, now=f.NOW, **kw)

    def test_reports_299_300_499_rejected_without_bootstrap_baseline(self):
        with tempfile.TemporaryDirectory() as folder:
            for count in (1,299,300,499):
                with self.subTest(count=count), self.assertRaisesRegex(IncompleteReport,'BELOW_MINIMUM'):
                    self.normalize(folder,count)

    def test_exactly_500_and_larger_complete_exports_accepted(self):
        with tempfile.TemporaryDirectory() as folder:
            for count in (500,501,1573):
                _,validation=self.normalize(folder,count,count)
                self.assertEqual(validation['completeness']['unique_products'],count)

    def test_duplicates_services_and_invalid_codes_do_not_inflate_count(self):
        with tempfile.TemporaryDirectory() as folder:
            data=rows(499)+[f.row('TEST00000')]*600+[f.row('SERVICE',F='SERVICIO')]*600+[f.row('bad code')]
            with self.assertRaisesRegex(IncompleteReport,'BELOW_MINIMUM'):
                n.normalize(f.workbook(folder,data),baseline(0),f.WEB,now=f.NOW)

    def test_500_is_insufficient_when_normal_base_is_1573(self):
        with tempfile.TemporaryDirectory() as folder, self.assertRaisesRegex(IncompleteReport,'INCOMPLETE_FULL_REPORT'):
            self.normalize(folder,500,1573)

    def test_replacements_cannot_mask_missing_identities(self):
        raw=[{'values':r} for r in rows(500)]
        reference={'OTHER%05d'%i:{} for i in range(500)}
        with self.assertRaisesRegex(IncompleteReport,'INCOMPLETE_FULL_REPORT'):
            guard_rows(raw,reference)

    def test_previous_central_also_protects_unpublished_skus(self):
        previous={'products':[{'sku':'TEST%05d'%i} for i in range(1000)]}
        with self.assertRaisesRegex(IncompleteReport,'INCOMPLETE_FULL_REPORT'):
            guard_rows([{'values':r} for r in rows(500)],{},previous)

    def test_500_new_zero_stocks_block_entire_report_499_allowed(self):
        with tempfile.TemporaryDirectory() as folder:
            for zeros in (499,500,501):
                data=rows(1000)
                for r in data[:zeros]: r['B']='0'
                path=f.workbook(folder,data)
                if zeros>=500:
                    with self.assertRaisesRegex(IncompleteReport,'MASS_UNAVAILABILITY'):
                        n.normalize(path,baseline(1000),f.WEB,now=f.NOW)
                else:
                    d,_=n.normalize(path,baseline(1000),f.WEB,now=f.NOW)
                    self.assertEqual(sum(p['availability']=='out_of_stock' for p in d['products']),499)

    def test_existing_zero_stocks_are_not_counted_as_new_losses(self):
        products=[{'sku':'TEST%05d'%i,'availability':'out_of_stock'} for i in range(1000)]
        old={p['sku']:{'stock':'0'} for p in products}
        self.assertEqual(guard_impact(products,old)['missing_or_newly_unavailable'],0)

    def test_500_missing_items_and_invalidated_items_also_block(self):
        old={'TEST%05d'%i:{'stock':'7'} for i in range(1000)}
        for status in ('absent','blocked'):
            products=[{'sku':s,'availability':'in_stock'} for s in list(old)[:500]]
            if status=='blocked':products += [{'sku':s,'availability':'blocked'} for s in list(old)[500:]]
            with self.subTest(status=status),self.assertRaisesRegex(IncompleteReport,'MASS_UNAVAILABILITY'):
                guard_impact(products,old)

    def test_rejection_preserves_entire_bundle_and_corrected_report_recovers(self):
        with tempfile.TemporaryDirectory() as folder:
            valid,report=self.normalize(folder,1000,1000)
            out=Path(folder)/'hub';n.write_bundle(out,valid,report)
            before={str(p.relative_to(out)):p.read_bytes() for p in out.rglob('*') if p.is_file()}
            with self.assertRaises(IncompleteReport):self.normalize(folder,300,1000)
            self.assertEqual(before,{str(p.relative_to(out)):p.read_bytes() for p in out.rglob('*') if p.is_file()})
            corrected,report=self.normalize(folder,1000,1000)
            self.assertFalse(n.write_bundle(out,corrected,report))
            self.assertEqual(corrected['source']['sha256'],valid['source']['sha256'])

    def test_processor_records_rejection_and_never_promotes(self):
        with tempfile.TemporaryDirectory() as folder:
            valid,_=self.normalize(folder,1000,1000)
            path=f.workbook(folder,rows(300))
            with zipfile.ZipFile(path) as z: members={name:z.read(name) for name in z.namelist()}
            members['docProps/core.xml']=members['docProps/core.xml'].replace(b'</core>',('<dcterms:modified>'+f.NOW.isoformat()+'</dcterms:modified></core>').encode())
            with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
                for name,content in members.items():z.writestr(name,content)
            raw=path.read_bytes();sha=hashlib.sha256(raw).hexdigest()
            calls=[]
            def request(path,body=None):
                calls.append((path,body))
                if path=='/commercial/status':payload={'pending':True,'file_sha256':sha,'received_at':n.iso(f.NOW)}
                elif path=='/commercial/catalog':payload=valid
                elif path.startswith('/commercial/report'):
                    response=io.BytesIO(raw);response.headers={'X-Report-Filename':'Reporte-Inventario.xlsx'};return response
                elif body['status']=='claim':payload={'lease_token':'synthetic'}
                elif body['status']=='rejected':payload={'completed':True}
                else:raise AssertionError('Unexpected request')
                return io.BytesIO(json.dumps(payload).encode())
            def urlopen(url,timeout):
                return io.BytesIO(baseline(1000).encode() if url.endswith('.csv') else json.dumps(f.WEB).encode())
            with patch.dict(os.environ,{'GITHUB_REF':'refs/heads/automatizacion/piloto-cloud-3sku-20261015','RUNNER_TEMP':folder}),patch.object(processor,'ROOT',Path(folder)),patch.object(processor,'request',side_effect=request),patch.object(processor.urllib.request,'urlopen',side_effect=urlopen),patch.object(processor,'write_bundle') as writer,patch.object(processor,'output') as output:
                with self.assertRaises(SystemExit):processor.main()
                writer.assert_not_called();output.assert_called_once_with(False)
            receipt=json.loads((Path(folder)/'generated/fase2/central-processing.json').read_text())
            self.assertEqual(receipt['error_code'],'REPORT_BELOW_MINIMUM_PRODUCTS')
            self.assertEqual(receipt['completeness']['unique_products'],300)
            self.assertTrue(receipt['last_valid_preserved'])
            self.assertEqual(receipt['action'],'WAIT_FOR_CORRECTED_FULL_REPORT')
            self.assertEqual([b['status'] for _,b in calls if b],['claim','rejected'])


if __name__=='__main__':unittest.main()
