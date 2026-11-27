"""New source-evidence tests only; original XLSX validator and identity function."""
import copy,importlib.util,json,os,tempfile,unittest
from pathlib import Path
from datetime import timedelta

folder=Path(os.environ['CHECKOUT_593_PRODUCER']).resolve()
spec=importlib.util.spec_from_file_location('source_fixture',folder/'test-preparar-revision-comercial-593.py')
fixtures=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixtures)
h=fixtures.h

class SourceEvidence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.loader=h.original_validator(os.environ['NORMALIZADOR_593_ORIGINAL'])
        cls.normalizer=cls.loader.__enter__()
    @classmethod
    def tearDownClass(cls):cls.loader.__exit__(None,None,None)
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
        self.old=fixtures.workbook(self.root/'old',15);self.cut=fixtures.base_cut(self.old)
        self.state=fixtures.state_of(self.cut);self.catalog=fixtures.catalog_of(self.cut)
        self.next=fixtures.workbook(self.root/'next',16,cash=11,stock=2)
    def prepare(self,path=None,**kwargs):
        values=dict(state=self.state,previous=self.cut,catalog=self.catalog,baseline_csv=fixtures.baseline_csv(),
            received_at='2026-11-16T16:02:00Z',normalizer=self.normalizer,previous_excel=self.old,now=fixtures.NOW)
        values.update(kwargs);return h.prepare(path or self.next,**values)
    def test_normalizer_creates_evidence_from_original_identity_without_raw_names_or_private_columns(self):
        out=self.prepare();e=out['evidencia_checkout']
        self.assertEqual(e['source_sha256'],h.digest(self.next));self.assertEqual(e['generated_at'],'2026-11-16T16:00:00.000Z')
        self.assertEqual(e['expires_at'],'2026-11-17T16:00:00.000Z');self.assertEqual(len(e['identity_signatures']),1000)
        expected=self.normalizer.identity_signature({'source_name':'Producto TEST0000','variant_gb':[]})
        self.assertEqual(e['identity_signatures']['TEST0000'],expected)
        for private in ['Producto TEST','source_name','variant_gb','cash_source','pvp_base_source','cost']:
            self.assertNotIn(private,json.dumps(e))
        self.assertEqual(out['productos']['TEST0000'],dict(stock=2,promo_centavos=1100,pvp_centavos=1380))
    def test_existing_published_sha_can_receive_metadata_without_new_sequence_or_renewed_time(self):
        published=self.prepare();published.pop('evidencia_checkout');before=copy.deepcopy(published)
        out=self.prepare(self.next,state=fixtures.state_of(published),previous=published,catalog=fixtures.catalog_of(published))
        e=out.pop('evidencia_checkout');self.assertEqual(out,before)
        self.assertEqual(e['generated_at'],before['revision_fuente']['generado_en'])
        self.assertEqual(e['revision_sequence'],before['revision_fuente']['secuencia'])
    def test_existing_evidence_is_idempotent(self):
        out=self.prepare();again=self.prepare(self.next,state=fixtures.state_of(out),previous=out,catalog=fixtures.catalog_of(out))
        self.assertEqual(out,again)
    def test_backfill_rejects_expired_original(self):
        published=self.prepare();published.pop('evidencia_checkout')
        with self.assertRaisesRegex(ValueError,'REPORT_EXPIRED'):
            self.prepare(self.next,state=fixtures.state_of(published),previous=published,catalog=fixtures.catalog_of(published),now=fixtures.NOW+timedelta(days=1))
    def test_metadata_cannot_attest_a_modified_published_projection(self):
        published=self.prepare();published.pop('evidencia_checkout');published['productos']['TEST0000']['stock']=3
        with self.assertRaisesRegex(ValueError,'CHECKOUT_ORIGINAL_COMMERCIAL_MISMATCH'):
            self.prepare(self.next,state=fixtures.state_of(published),previous=published,catalog=fixtures.catalog_of(published))
    def test_next_revision_generates_evidence_automatically_and_builds_cross_language_fixture(self):
        one=self.prepare();second=fixtures.workbook(self.root/'second',17,cash=12,stock=3)
        two=self.prepare(second,state=fixtures.state_of(one),previous=one,catalog=fixtures.catalog_of(one),previous_excel=self.next,received_at='2026-11-16T17:02:00Z')
        self.assertEqual(two['evidencia_checkout']['revision_sequence'],2)
        self.assertEqual(two['evidencia_checkout']['source_sha256'],h.digest(second))
        self.assertNotEqual(one['evidencia_checkout']['attestation_sha256'],two['evidencia_checkout']['attestation_sha256'])
        products=[]
        for i in range(37):
            sku=f'TEST{i:04d}';products.append(dict(sku=sku,source_name='Producto '+sku,variant_gb=[],name='Nombre público '+sku,
                availability='in_stock' if i==0 else 'blocked',blocked_reasons=[] if i==0 else ['ABSENT_LATEST_REPORT'],
                prices=dict(currency='USD',promo_cash_cents=1000,pvp_card_cents=1380),
                web=dict(price_matches=True,url='https://conectatech-ec.github.io/productos/'+sku.lower()+'/',image_url='https://conectatech-ec.github.io/imagenes/'+sku.lower()+'.webp')))
        original_source,_=self.normalizer.read_xlsx(self.old,now=fixtures.NOW)
        fallback=dict(schema='conectatech.commercial.v1',source=original_source,expires_at='2026-11-17T15:00:00.000Z',products=products)
        target=Path(os.environ['CHECKOUT_593_CROSS_FIXTURE']);target.write_text(json.dumps(dict(cut=one,pointer=fixtures.state_of(one),fallback=fallback,now=int(fixtures.NOW.timestamp()*1000)),ensure_ascii=False))

if __name__=='__main__':unittest.main()
