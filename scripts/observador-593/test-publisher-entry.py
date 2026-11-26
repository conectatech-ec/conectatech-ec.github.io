import hashlib,importlib.util,json,tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('entry',Path(__file__).with_name('publisher-entry.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
RAW=b'synthetic-private-input';SHA=hashlib.sha256(RAW).hexdigest();OLD='a'*64;COMMIT='b'*40
class Tests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);self.repo=self.root/'repo';self.work=self.root/'private'
  (self.repo/'datos-593').mkdir(parents=True);self.e=m.Entry(self.repo,self.work,self.root/'transport',self.root/'validator',SHA)
  m.save(self.repo/m.STATE,{'origen_sha256':OLD});self.calls=[];self.e.output=lambda **x:None
 def tearDown(self):self.temp.cleanup()
 def claim(self,download=True):
  def call(path,body=None):
   self.calls.append((path,body))
   if path.endswith('status'):return {'observer_contract':m.CONTRACT,'pending':True,'file_sha256':SHA,'received_at':'2026-11-26T21:00:00.000Z'}
   return {'sha256':SHA,'lease_token':'1'*36,'lease_until':9999999999999}
  self.e.call=call;self.e.request=lambda *a:(RAW,'Reporte-Inventario.xlsx')
  if not download:m.save(self.repo/m.STATE,{'origen_sha256':SHA})
  self.e.begin()
 def test_rejects_unsafe_sha_and_private_work_inside_repo(self):
  with self.assertRaisesRegex(ValueError,'SOURCE_SHA_REQUIRED'):m.Entry(self.repo,self.work,'t','v','a'*64+'\n')
  with self.assertRaisesRegex(ValueError,'PRIVATE_WORK'):m.Entry(self.repo,self.repo/'secret','t','v',SHA)
 def test_no_pending_never_claims(self):
  self.e.call=lambda path,body=None:({'observer_contract':m.CONTRACT,'pending':False} if body is None else self.fail('claim'))
  self.e.begin();self.assertFalse(self.e.journal.exists())
 def test_wrong_pending_sha_never_claims(self):
  self.e.call=lambda path,body=None:({'observer_contract':m.CONTRACT,'pending':True,'file_sha256':OLD} if body is None else self.fail('claim'))
  self.e.begin();self.assertFalse(self.e.journal.exists())
 def test_foreign_contract_does_not_claim(self):
  self.e.call=lambda *a:{'pending':True,'file_sha256':SHA}
  with self.assertRaisesRegex(ValueError,'CONTRACT'):self.e.begin()
 def test_already_published_never_downloads(self):
  self.claim(download=False);self.assertFalse((self.work/'Reporte-Inventario.xlsx').exists())
  with patch.object(m,'run',side_effect=AssertionError('no validator')):self.e.prepare()
 def test_input_saved_only_outside_repository(self):
  self.claim();p=self.work/'Reporte-Inventario.xlsx';self.assertEqual(p.read_bytes(),RAW);self.assertEqual(p.stat().st_mode&0o777,0o600)
  self.assertFalse(any(self.repo.rglob('*.xlsx')))
 def test_integrity_change_before_validation_preserves_canonical(self):
  self.claim();(self.work/'Reporte-Inventario.xlsx').write_bytes(b'changed')
  with self.assertRaisesRegex(ValueError,'SOURCE_INTEGRITY'):self.e.prepare()
  self.assertFalse((self.repo/m.CUT).exists())
 def test_expired_reservation_does_not_validate(self):
  self.claim();d=m.read(self.e.journal);d['lease_until']=0;m.save(self.e.journal,d)
  with self.assertRaisesRegex(ValueError,'RESERVATION_EXPIRED'):self.e.prepare()
 def test_original_validator_failure_does_not_publish(self):
  self.claim()
  with patch.object(m,'run',return_value=SimpleNamespace(returncode=1,stderr='ERROR_593 PREVIOUS_XLSX_REQUIRED_FOR_APPROVED_ALTAS\n',stdout='')):
   with self.assertRaisesRegex(ValueError,'PREVIOUS_XLSX_REQUIRED'):self.e.prepare()
  self.assertFalse((self.repo/m.CUT).exists())
 def test_original_validator_arbitrary_output_is_not_exposed(self):
  self.claim()
  with patch.object(m,'run',return_value=SimpleNamespace(returncode=1,stderr='PRIVATE FILE CONTENT',stdout='')):
   with self.assertRaisesRegex(ValueError,'^ORIGINAL_VALIDATOR_REJECTED$'):self.e.prepare()
 def test_prepared_identity_must_match_source_and_fresh_base(self):
  self.claim()
  def fake(args,**kw):
   self.assertIn(str(self.repo/'scripts/preparar-revision-comercial-593.py'),args)
   self.assertIn('--validador',args);self.assertIn('--repo',args)
   m.save(self.work/'candidate.json',{'sha256_original':SHA,'revision_fuente':{'anterior_sha256':'c'*64}})
   return SimpleNamespace(returncode=0,stderr='',stdout='')
  with patch.object(m,'run',side_effect=fake):
   with self.assertRaisesRegex(ValueError,'PREPARED_SOURCE_MISMATCH'):self.e.prepare()
  self.assertFalse((self.repo/m.CUT).exists())
 def test_canonical_not_published_does_not_complete_receipt(self):
  self.claim();self.calls=[]
  def fake(args,**kw):return SimpleNamespace(returncode=0,stdout=(COMMIT if args[1]=='rev-parse' else json.dumps({'origen_sha256':OLD})),stderr='')
  with patch.object(m,'run',side_effect=fake):
   with self.assertRaisesRegex(ValueError,'PUBLISHED_SOURCE_MISMATCH'):self.e.complete()
  self.assertEqual(self.calls,[])
 def test_complete_requires_readback_same_commit(self):
  self.claim();state={'origen_sha256':SHA,'fecha_corte':'2026-11-26','revision_fuente':{'generado_en':'2026-11-26T20:00:00.000Z'}}
  def fake(args,**kw):return SimpleNamespace(returncode=0,stdout=(COMMIT if args[1]=='rev-parse' else json.dumps(state)),stderr='')
  self.e.call=lambda path,body=None:({'completed':True,'raw_file_erased':True} if body else {'status':'processed','published_commit':'c'*40})
  with patch.object(m,'run',side_effect=fake):
   with self.assertRaisesRegex(ValueError,'RECEIPT_NOT_VERIFIED'):self.e.complete()
  self.assertNotEqual(m.read(self.e.journal)['stage'],'complete')
 def test_release_never_claims_or_reprocesses(self):
  self.claim();self.calls=[];self.e.call=lambda path,body:self.calls.append(body)
  self.e.release();self.assertEqual([x['status'] for x in self.calls],['release'])
if __name__=='__main__':unittest.main()
