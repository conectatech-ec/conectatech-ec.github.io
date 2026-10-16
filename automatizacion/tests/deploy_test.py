import importlib.util,sqlite3,unittest,os,sys
from unittest.mock import patch
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('deploy_free',ROOT/'deploy_free.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class MinimumPrivilegeTest(unittest.TestCase):
 def test_financial_database_and_other_workers_blocked_before_network(self):
  api=module.API('a'*32,'synthetic-token')
  with patch.object(module.urllib.request,'urlopen') as network:
   for path,method in [('/subscriptions','GET'),('/subscriptions','POST'),('/d1/database','GET'),('/d1/database','POST'),('/workers/scripts/production','PUT'),('/workers/subdomain','GET'),(module.SCRIPT+'/schedules','PUT'),(module.SCRIPT+'/subdomain','POST')]:
    with self.assertRaises(ValueError):api.call(path,method)
   network.assert_not_called()
 def test_missing_attestation_and_exact_pilot_url_block_connection(self):
  env={'CF_FREE_ONLY_CONFIRMED':'true','CLOUDFLARE_ACCOUNT_ID':'a'*32,'CLOUDFLARE_API_TOKEN':'fixture','PILOT_TOKEN':'x'*32,'CLOUDFLARE_PILOT_URL':'https://conectatech-comercial-piloto.fixture.workers.dev'}
  self.assertEqual(module.connection_settings(env),[])
  env['CF_FREE_ONLY_CONFIRMED']='false';env['CLOUDFLARE_PILOT_URL']='https://production.example'
  self.assertEqual(set(module.connection_settings(env)),{'CF_FREE_ONLY_CONFIRMED','CLOUDFLARE_PILOT_URL'})
 def test_public_url_fallback_does_not_supply_or_override_credentials(self):
  url='https://conectatech-comercial-piloto.fixture.workers.dev'
  settings=module.effective_settings({}, {'url_publica':url})
  self.assertEqual(settings,{'CLOUDFLARE_PILOT_URL':url})
  self.assertEqual(module.effective_settings({'CLOUDFLARE_PILOT_URL':'https://wrong.example'}, {'url_publica':url})['CLOUDFLARE_PILOT_URL'],'https://wrong.example')
 def test_connection_reads_only_existing_worker(self):
  class FakeAPI:
   def __init__(self):self.calls=[]
   def call(self,path,method='GET',data=None):self.calls.append((path,method));return {'bindings':[]}
  api=FakeAPI();self.assertTrue(module.check_connection(api));self.assertEqual(api.calls,[(module.SCRIPT+'/settings','GET')])
 def test_no_database_binding_and_reject_existing_unexpected_resources(self):
  self.assertNotIn('d1',[b['type'] for b in module.worker_metadata()['bindings']])
  class FakeAPI:
   def call(self,path):return {'bindings':[{'name':'PRODUCTION_DB','type':'d1'}]}
  with self.assertRaises(ValueError):module.check_connection(FakeAPI())
 def test_main_cannot_connect_or_deploy(self):
  with patch.dict(os.environ,{'GITHUB_REF':'refs/heads/main'}),patch.object(sys,'argv',['deploy_free.py','--check']),patch.object(module.urllib.request,'urlopen') as network:
   with self.assertRaises(ValueError):module.main()
   network.assert_not_called()
 def test_actual_sqlite_dedup_and_retention_for_future_optional_database(self):
  db=sqlite3.connect(':memory:');db.executescript((ROOT/'schema.sql').read_text())
  row=('fixture-000000001','hash','{}','2026-01-01','2026-01-02')
  for _ in range(2):db.execute('INSERT OR IGNORE INTO solicitudes VALUES (?,?,?,?,?)',row)
  self.assertEqual(db.execute('SELECT count(*) FROM solicitudes').fetchone()[0],1)
  db.execute('DELETE FROM solicitudes WHERE expires_at < ?',('2026-02-01',));self.assertEqual(db.execute('SELECT count(*) FROM solicitudes').fetchone()[0],0)
if __name__=='__main__':unittest.main()
