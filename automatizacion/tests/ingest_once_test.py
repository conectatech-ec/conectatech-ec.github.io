"""Focused new permission/source/fencing checks, all external calls mocked."""
import copy,io,json,os,sys,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import scoped_content as s
import scoped_content_test as f
import process_pending_593 as p

class Once(unittest.TestCase):
 def env(self):return {'GITHUB_REF':s.BRANCH,'GITHUB_SHA':'d'*40,'GITHUB_WORKFLOW_SHA':'d'*40,'GITHUB_WORKFLOW_REF':'conectatech-ec/conectatech-ec.github.io/.github/workflows/central-593.yml@'+s.BRANCH,'GITHUB_EVENT_NAME':'push','GITHUB_RUN_ATTEMPT':'1','CF_FREE_ONLY_CONFIRMED':'true','CENTRAL_INGEST_AUTHORIZATION':s.INGEST_ONCE_AUTHORIZATION}
 def config(self):return {'activar':False,'datahub_scoped_content_enabled':False,'sincronizar_meta_verify_token':False,'costo_maximo_usd':0}
 def test_single_permission_accepts_closed_flags(self):
  with patch.dict(os.environ,self.env(),clear=True),patch.object(s.subprocess,'check_output',side_effect=['d'*40,s.INGEST_ONCE_PARENT]),patch.object(s,'read_latest_config',return_value=self.config()),patch.object(s,'require_latest_revision') as rev:
   s.require_ingest_once();rev.assert_called_once_with('d'*40)
 def test_retries_and_other_events_fail_before_remote_access(self):
  for change in ({'GITHUB_RUN_ATTEMPT':'2'},{'GITHUB_EVENT_NAME':'workflow_dispatch'},{'CENTRAL_INGEST_AUTHORIZATION':'wrong'}):
   with patch.dict(os.environ,{**self.env(),**change},clear=True),patch.object(s,'read_latest_config') as read:
    with self.assertRaises(s.ScopedError):s.require_ingest_once()
    read.assert_not_called()
 def test_parent_flags_and_cost_remain_enforced(self):
  for parent,c in [('f'*40,self.config()),(s.INGEST_ONCE_PARENT,{**self.config(),'activar':True}),(s.INGEST_ONCE_PARENT,{**self.config(),'datahub_scoped_content_enabled':True}),(s.INGEST_ONCE_PARENT,{**self.config(),'costo_maximo_usd':1})]:
   with patch.dict(os.environ,self.env(),clear=True),patch.object(s.subprocess,'check_output',side_effect=['d'*40,parent]),patch.object(s,'read_latest_config',return_value=c),patch.object(s,'require_latest_revision'):
    with self.assertRaises(s.ScopedError):s.require_ingest_once()
 def test_missing_or_different_queue_report_never_claims(self):
  for state,code in [({'pending':False},'APPROVED_REPORT_NOT_PENDING'),({'pending':True,'file_sha256':'a'*64},'SOURCE_NOT_AUTHORIZED')]:
   calls=[]
   def request(path,body=None):calls.append((path,body));return io.BytesIO(json.dumps(state).encode())
   with patch.dict(os.environ,{'GITHUB_REF':s.BRANCH,'CENTRAL_AUTHORIZED_SOURCE_SHA256':s.INGEST_ONCE_SHA}),patch.object(p,'request',request):
    with self.assertRaisesRegex(ValueError,code):p.main()
   self.assertEqual(calls,[('/commercial/status',None)])
 def runtime(self):
  r=f.Runtime();template=(s.ROOT/'commercial-reception.mjs').read_text();body=template.replace(s.PLACEHOLDER,s.APPROVED_RECEIVER_RELEASE).replace(s.CODE_PLACEHOLDER,s.APPROVED_RECEIVER_CODE).encode()
  r.bundle=s.replace_part(r.bundle,'commercial-reception.mjs',body);r.original_bundle=copy.deepcopy(r.bundle)
  r.on_private_read=lambda rt,path:{'processor_release':s.APPROVED_RECEIVER_RELEASE,'processor_code_sha256':s.APPROVED_RECEIVER_CODE} if path=='/commercial/catalog/status' else None
  data=f.source('b',15);data['source'].update(sha256=s.INGEST_ONCE_SHA,cut_date='2026-11-15',generated_at=s.INGEST_ONCE_GENERATED);data['expires_at']=s.INGEST_ONCE_EXPIRES
  lease={**f.lease(),'sha256':s.INGEST_ONCE_SHA}
  return r,template,data,lease
 def test_only_central_data_changes_once(self):
  r,t,data,lease=self.runtime()
  with patch.dict(os.environ,self.env(),clear=True):result=r.client().ingest(data,s.INGEST_ONCE_SHA,lease,s.APPROVED_RECEIVER_RELEASE,receiver_text=t)
  self.assertEqual(result['worker_puts'],1);self.assertEqual(len(r.puts),1)
  for part in r.original_bundle.parts:
   if part.name!='central-data.mjs':self.assertEqual(part,f.get_part(r.puts[0],part.name))
 def test_approved_identity_and_receiver_drift_block_before_put(self):
  for fault in ('source','receiver'):
   r,t,data,lease=self.runtime()
   if fault=='source':data['source']['sha256']='f'*64
   else:r.bundle=s.replace_part(r.bundle,'commercial-reception.mjs',b'unknown')
   with patch.dict(os.environ,self.env(),clear=True):
    with self.assertRaises(s.ScopedError):r.client().ingest(data,s.INGEST_ONCE_SHA,lease,s.APPROVED_RECEIVER_RELEASE,receiver_text=t)
   self.assertEqual(r.puts,[])
 def test_final_fence_detects_change_during_authorization(self):
  r,t,data,lease=self.runtime();client=r.client()
  client.authorize=lambda:setattr(r,'bundle',s.replace_part(r.bundle,'commercial-reception.mjs',b'concurrent'))
  with patch.dict(os.environ,self.env(),clear=True):
   with self.assertRaisesRegex(s.ScopedError,'RUNTIME_CHANGED_BEFORE_PUT'):client.ingest(data,s.INGEST_ONCE_SHA,lease,s.APPROVED_RECEIVER_RELEASE,receiver_text=t)
  self.assertEqual(r.puts,[])

if __name__=='__main__':unittest.main()
