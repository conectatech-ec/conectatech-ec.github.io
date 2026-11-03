import copy,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from scoped_content import Part,Bundle
from hub017_identity import metadata_patch,decode,SHA,MODULE
def fixture():
 bundle=Bundle('worker.mjs',(Part('worker.mjs','worker.mjs','application/javascript+module',b'worker unchanged'),Part('central-data.mjs','central-data.mjs','application/javascript+module',b'private source remains byte identical'),Part(MODULE,MODULE,'application/javascript+module',b'export default {"existing":{"identity_verified_skus":["KEEP001"]}};\n')))
 approval={'cut_date':'2026-11-03','generated_at':'2026-11-03T18:55:23Z','identity_verified_skus':['HUB017']}
 return bundle,approval
class IdentityTests(unittest.TestCase):
 def test_only_metadata_and_hub017(self):
  b,a=fixture();updated,changed=metadata_patch(b,a);self.assertTrue(changed);self.assertEqual(updated.parts[:2],b.parts[:2]);value=decode(updated.parts[-1].body);self.assertEqual(value['existing'],{'identity_verified_skus':['KEEP001']});self.assertEqual(value[SHA],a)
 def test_idempotent(self):
  b,a=fixture();updated,_=metadata_patch(b,a);again,changed=metadata_patch(updated,a);self.assertFalse(changed);self.assertEqual(updated,again)
 def test_other_sku_not_authorized(self):
  b,a=fixture();a['identity_verified_skus'].append('OTHER001')
  with self.assertRaisesRegex(ValueError,'SCOPE'):metadata_patch(b,a)
 def test_no_overwrite_concurrent_approval(self):
  b,a=fixture();a['identity_evidence']={'HUB017':{'source_name':'verified original'}};updated,_=metadata_patch(b,a);other=copy.deepcopy(a);other['identity_evidence']['HUB017']['source_name']='different concurrent identity'
  with self.assertRaisesRegex(ValueError,'CONCURRENT'):metadata_patch(updated,other)
 def test_missing_module_rejected(self):
  b,a=fixture()
  with self.assertRaisesRegex(ValueError,'MODULE_REQUIRED'):metadata_patch(Bundle(b.entrypoint,b.parts[:2]),a)
 def test_rollback_removes_only_hub017_approval(self):
  b,a=fixture();updated,_=metadata_patch(b,a);restored,changed=metadata_patch(updated,a,True);self.assertTrue(changed);self.assertEqual(decode(restored.parts[-1].body),decode(b.parts[-1].body));self.assertEqual(restored.parts[:2],b.parts[:2])
 def test_rollback_preserves_concurrent_other_sku_approval(self):
  b,a=fixture();other=copy.deepcopy(a);other['identity_verified_skus'].append('KEEP002');modified=Bundle(b.entrypoint,(*b.parts[:2],Part(MODULE,MODULE,'application/javascript+module',('export default '+__import__('json').dumps({SHA:other})+';').encode())))
  restored,_=metadata_patch(modified,a,True);self.assertEqual(decode(restored.parts[-1].body)[SHA]['identity_verified_skus'],['KEEP002'])
if __name__=='__main__':unittest.main()
