import unittest,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'));sys.path.insert(0,str(ROOT/'scripts'))
from planner import plan,apply_plan
from auditar import match
from preflight_api import probe
class SetTests(unittest.TestCase):
 def setUp(self):self.config=json.loads((ROOT/'data/conjuntos-config.json').read_text());self.audit=json.loads((ROOT/'data/auditoria.json').read_text())
 def test_counts_all_sku_and_unknown_category(self):
  self.assertEqual(self.audit['total'],945);self.assertEqual(len(self.audit['item_audits']),945);self.assertEqual(self.audit['without_category'],27);self.assertEqual(self.audit['nonempty_categories'],69);self.assertEqual(self.audit['source_mismatches'],0)
 def test_leaf_partition_and_empty_groups_not_created(self):
  leafs=[s for s in self.config['sets'] if s['kind']=='CATEGORY'];members=[sku for s in leafs for sku in s['members']];self.assertEqual(len(members),918);self.assertEqual(len(set(members)),918);self.assertEqual(len(leafs),69);self.assertTrue(all(s['expected_count']>0 for s in self.config['sets']))
 def test_smartwatches_exclude_three_non_smartwatches(self):
  s=next(s for s in self.config['sets'] if s['name']=='CONECTATECH | SMARTWATCHES');self.assertEqual(s['expected_count'],30);self.assertEqual(set(s['excluded_non_smartwatch']),{'REL043','REL047','REL001'});self.assertNotIn('REL071',s['members'])
 def test_exact_category_prevents_contains_collision(self):
  s=next(s for s in self.config['sets'] if s['name']=='CONECTATECH | CARGADORES');self.assertEqual(s['expected_count'],47);self.assertEqual(s['contains_would_match'],61);self.assertFalse(match({'product_type':'CUBOS CARGADORES'},s['rule']))
 def test_reuse_existing_and_never_duplicate_owner_confirmed_set(self):
  first=self.config['sets'][0];existing=[{'id':'TEST-ONLY','name':first['name'],'filter':first['api_filter_candidate']}];result=plan(self.config,existing);self.assertEqual(result['actions'][0]['action'],'REUSE_EXISTING');phone=next(a for a in result['actions'] if a['name']=='CONECTATECH | CELULARES');self.assertEqual(phone['action'],'KEEP_OWNER_CONFIRMED_VERIFY_REMOTE_ID');self.assertIsNone(phone['request_candidate']);self.assertEqual(result['changes_executed'],0)
 def test_conflict_never_overwrites_and_wrong_catalog_rejected(self):
  first=self.config['sets'][0];result=plan(self.config,[{'id':'TEST','name':first['name'],'filter':{'brand':{'eq':'TEST'}}}]);self.assertEqual(result['actions'][0]['action'],'REVIEW_EXISTING_FILTER_NO_AUTOMATIC_UPDATE');self.assertIsNone(result['actions'][0]['request_candidate']);bad={**self.config,'catalog_id':'OTHER'}
  with self.assertRaises(ValueError):plan(bad,[])
  with self.assertRaises(PermissionError):apply_plan(result)
 def test_missing_credentials_does_not_make_network_calls_or_claim_permission(self):
  r=probe(None,None);self.assertEqual(r['status'],'NO_CREDENTIALS_CONFIGURED');self.assertFalse(r['write_authorized']);self.assertIsNone(r['sets'])

 def test_flagged_light_blocks_audio_set_creation_candidate(self):
  result=plan(self.config,[])
  for name in ['CONECTATECH | AUDIO','CONECTATECH | AUDIFONOS']:
   action=next(a for a in result['actions'] if a['name']==name);self.assertEqual(action['action'],'REVIEW_CLASSIFICATION_BEFORE_CREATE');self.assertIsNone(action['request_candidate'])
