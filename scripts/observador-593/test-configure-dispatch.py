import importlib.util,unittest,json
from pathlib import Path
s=importlib.util.spec_from_file_location('config',Path(__file__).with_name('configure-dispatch.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Tests(unittest.TestCase):
 def test_cannot_change_other_secret(self):
  with self.assertRaisesRegex(ValueError,'SCOPE_DENIED'):m.binding_payload('PILOT_TOKEN','value')
 def test_requires_fine_grained_token(self):
  with self.assertRaisesRegex(ValueError,'FINE_GRAINED'):m.binding_payload('COMMERCIAL_ACTIONS_TOKEN','ghp_classic_fixture')
 def test_ready_requires_exact_contract(self):
  with self.assertRaisesRegex(ValueError,'CONTRACT_REQUIRED'):m.binding_payload('COMMERCIAL_OBSERVER_READY','true')
 def test_unrelated_binding_change_cannot_pass(self):
  before={'flag':True,'bindings':[{'name':'PILOT_TOKEN','type':'secret_text'}]};after={**before,'bindings':before['bindings']+[{'name':'COMMERCIAL_ACTIONS_TOKEN','type':'secret_text'}]}
  self.assertTrue(m.unchanged_settings(before,after,'COMMERCIAL_ACTIONS_TOKEN'))
  self.assertFalse(m.unchanged_settings(before,{**after,'flag':False},'COMMERCIAL_ACTIONS_TOKEN'))
  self.assertFalse(m.unchanged_settings(before,{**after,'bindings':after['bindings'][1:]},'COMMERCIAL_ACTIONS_TOKEN'))
if __name__=='__main__':unittest.main()
