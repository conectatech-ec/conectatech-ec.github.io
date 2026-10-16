import importlib.util,sqlite3,unittest,os,sys,tempfile,io,json
from unittest.mock import patch
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('deploy_free',ROOT/'deploy_free.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class MinimumPrivilegeTest(unittest.TestCase):
 def test_live_tail_scope_does_not_allow_other_worker_or_broad_logs_access(self):
  module.permitted_request(module.SCRIPT+'/tails','GET');module.permitted_request(module.SCRIPT+'/tails','POST');module.permitted_request(module.SCRIPT+'/tails/'+'a'*32,'DELETE')
  for path,method in [('/workers/observability/telemetry/query','POST'),('/workers/scripts/production/tails','POST'),(module.SCRIPT+'/tails','DELETE'),(module.SCRIPT+'/tails/not-valid','DELETE')]:
   with self.assertRaises(ValueError):module.permitted_request(path,method)
 def test_read_only_reception_audit_does_not_disclose_binding_values_or_invent_event_evidence(self):
  private='synthetic-private-credential-do-not-emit'
  report=module.reception_settings({'observability':{'enabled':False},'bindings':[{'name':'META_INGRESS_ENABLED','text':'false'},{'name':'META_MODE','text':'development-only'},{'name':'META_APP_SECRET','text':private}]})
  self.assertFalse(report['observability_enabled']);self.assertFalse(report['meta_ingress_enabled']);self.assertTrue(report['development_only'])
  self.assertTrue(report['meta_app_secret_binding_present']);self.assertFalse(report['test_sender_allowlist_binding_present']);self.assertNotIn(private,json.dumps(report))
  for field in ['event_http_status','event_signature_verified','event_discard_verified']:self.assertIsNone(report[field])
  self.assertIsNone(module.reception_settings({})['observability_enabled'])
 def test_rotation_preserves_exact_secret_and_retries_propagation_without_code_upload(self):
  token='  synthetic-fixture-token-of-at-least-32-characters\n'
  settings={'bindings':[{'name':'META_INGRESS_ENABLED','text':'false'},{'name':'META_MODE','text':'development-only'}]}
  class FakeAPI:
   def __init__(self):self.calls=[]
   def call(self,*args):self.calls.append(args)
  class Reply:
   status=200
   def __init__(self,text):self.text=text
   def __enter__(self):return self
   def __exit__(self,*args):pass
   def read(self,n):return self.text.encode()
  api=FakeAPI();seen=[]
  def opener(req,timeout):
   q=module.urllib.parse.parse_qs(module.urllib.parse.urlsplit(req.full_url).query)
   seen.append(q['hub.verify_token'][0])
   if len(seen)==1 or seen[-1]!=token:raise module.urllib.error.HTTPError(req.full_url,403,'fixture',{},io.BytesIO(b'Forbidden'))
   return Reply(q['hub.challenge'][0])
  with tempfile.TemporaryDirectory() as tmp,patch.object(module,'ROOT',Path(tmp)),patch.object(module.urllib.request,'urlopen',side_effect=opener),patch.object(module.time,'sleep') as delay,patch('builtins.print') as output:
   result=module.sync_meta_verify_token(api,settings,'https://conectatech-comercial-piloto.fixture.workers.dev',token)
   self.assertTrue(result['passed']);self.assertEqual(result['attempts'],2);delay.assert_called_once_with(2)
   self.assertEqual(api.calls,[(module.SCRIPT+'/secrets','PUT',{'name':'META_VERIFY_TOKEN','text':token,'type':'secret_text'})])
   self.assertEqual(seen[:2],[token,token]);self.assertNotIn(token,str(output.call_args_list))
 def test_rotation_alternate_client_requires_exact_challenge_and_keeps_secret_out_of_arguments(self):
  token='synthetic-fixture-secret-only-for-test-0001'
  settings={'bindings':[{'name':'META_INGRESS_ENABLED','text':'false'},{'name':'META_MODE','text':'development-only'}]}
  success={'passed':True,'configured_token_http':200,'challenge_matches':True,'wrong_token_http':403,'attempts':1}
  for verified in [True,False]:
   data={**success,'challenge_matches':verified}
   child=unittest.mock.Mock(returncode=0,stdout=json.dumps(data))
   blocked=module.urllib.error.HTTPError('https://fixture.invalid',403,'fixture',{},io.BytesIO(b'upstream denial'))
   with tempfile.TemporaryDirectory() as tmp,patch.object(module,'ROOT',Path(tmp)),patch.object(module.urllib.request,'urlopen',side_effect=blocked),patch.object(module.subprocess,'run',return_value=child) as run,patch('builtins.print'):
    if verified:self.assertTrue(module.sync_meta_verify_token(unittest.mock.Mock(),settings,'https://fixture.invalid',token)['passed'])
    else:
     with self.assertRaises(RuntimeError):module.sync_meta_verify_token(unittest.mock.Mock(),settings,'https://fixture.invalid',token)
    self.assertNotIn(token,str(run.call_args.args));self.assertEqual(run.call_args.kwargs['env']['META_VERIFY_TOKEN'],token)
 def test_rotation_refuses_open_ingress_before_any_mutation(self):
  api=unittest.mock.Mock()
  with self.assertRaises(ValueError):module.sync_meta_verify_token(api,{'bindings':[]},'https://unused.invalid','x'*32)
  api.call.assert_not_called()
 def test_rotation_never_treats_http_200_with_wrong_challenge_as_success(self):
  settings={'bindings':[{'name':'META_INGRESS_ENABLED','text':'false'},{'name':'META_MODE','text':'development-only'}]}
  reply=unittest.mock.MagicMock();reply.__enter__.return_value=reply;reply.status=200;reply.read.return_value=b'wrong-challenge'
  with patch.object(module.urllib.request,'urlopen',return_value=reply),patch.object(module.time,'sleep'):
   with self.assertRaisesRegex(RuntimeError,'New token challenge failed'):module.sync_meta_verify_token(unittest.mock.Mock(),settings,'https://unused.invalid','x'*32)
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
 def test_optional_meta_configuration_rejects_weak_verify_token_and_bad_psids(self):
  module.validate_meta_settings({})
  module.validate_meta_settings({'META_VERIFY_TOKEN':'x'*32,'META_TEST_SENDER_IDS':'123,456'})
  for env in [{'META_VERIFY_TOKEN':'short'},{'META_TEST_SENDER_IDS':'123,not-a-psid'}]:
   with self.assertRaises(ValueError):module.validate_meta_settings(env)
 def test_confirmed_page_configured_without_enabling_ingress_or_sends(self):
  with patch.dict(os.environ,{'META_PAGE_ID':''}):
   meta=module.worker_metadata({'meta_page_id':'105549695770538'})
  bindings={b['name']:b for b in meta['bindings']}
  self.assertEqual(bindings['META_PAGE_ID']['text'],'105549695770538')
  self.assertEqual(bindings['META_INGRESS_ENABLED']['text'],'false')
  self.assertEqual(bindings['META_MODE']['text'],'development-only')
  self.assertNotIn('META_PAGE_ACCESS_TOKEN',bindings)
 def test_messenger_storage_is_sqlite_on_same_worker_without_new_api_permissions(self):
  metadata=module.worker_metadata()
  self.assertEqual(metadata['exports'],{'MessengerTestInbox':{'type':'durable-object','storage':'sqlite'}})
  binding=next(b for b in metadata['bindings'] if b['name']=='MESSENGER_TEST_INBOX')
  self.assertEqual(binding['type'],'durable_object_namespace');self.assertEqual(binding['class_name'],'MessengerTestInbox')
  self.assertNotIn('script_name',binding)
  self.assertIn('secret_text',metadata['keep_bindings'])
  self.assertEqual(next(b['text'] for b in metadata['bindings'] if b['name']=='META_INGRESS_ENABLED'),'false')
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
