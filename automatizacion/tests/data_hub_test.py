"""Multi-version contracts: channel preparation cannot masquerade as real delivery."""
import copy, importlib.util, json, sys, tempfile, unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from data_hub_593 import changes, complementary, hub, identity, signature, version, write_hub
from normalizar_593 import normalize, write_bundle
spec=importlib.util.spec_from_file_location('fixtures',ROOT/'tests/central_593_test.py')
fixtures=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixtures)

class DataHub(unittest.TestCase):
 def data(self): return json.loads((ROOT/'central/current.json').read_text())
 def test_same_source_does_not_regenerate_everything(self):
  d=self.data();p=changes(d,copy.deepcopy(d));self.assertEqual(p['changed_sku'],[])
  self.assertEqual(p['pdf_categories']['invalidate_or_regenerate_only'],[])
 def test_changed_price_and_old_new_categories_limit_regeneration(self):
  old=self.data();new=copy.deepcopy(old);p=next(p for p in new['products'] if p['sku']=='TELF011')
  oldcategory=p['category'];p['category']='Nueva categoría';p['prices']['promo_cash_cents']+=1
  plan=changes(new,old);self.assertEqual(plan['changed_sku'],['TELF011'])
  self.assertEqual(set(plan['pdf_categories']['invalidate_or_regenerate_only']),{oldcategory,'Nueva categoría'})
  self.assertFalse(plan['signature']['executed']);self.assertFalse(plan['production_publication_authorized'])
 def test_enrichment_cannot_override_financial_data_or_cross_variants(self):
  d=self.data();p=next(p for p in d['products'] if p['sku']=='TELF011')
  with self.assertRaisesRegex(ValueError,'CANNOT_OVERRIDE'):
   complementary(d,{'products':{'TELF011':{'prices':{'promo_cash_cents':1}}}})
  old={'products':{'TELF011':{'identity_signature':'wrong-variant','photo_url':'https://wrong.invalid/256.jpg'}}}
  enrich=complementary(d,old);self.assertNotEqual(enrich['products']['TELF011'].get('photo_url'),'https://wrong.invalid/256.jpg')
  self.assertNotIn('FLAS024',enrich['products']);self.assertNotIn('MOUS010',enrich['products'])
  self.assertEqual(p['prices']['promo_cash_cents'],18590)
 def test_receipt_requires_exact_version_business_digest_and_processing(self):
  d=self.data();plan=changes(d,d);good={'version':version(d),'commercial_signature':signature(d),
   'received':True,'processed':True,'evidence':'Synthetic test receipt; not real channel proof','verified_at':'2026-10-22T01:00:00Z'}
  for edit in ({'version':'old'},{'commercial_signature':'wrong'},{'processed':False},{'received':False},{'evidence':''}):
   r={**good,**edit};state=hub(d,plan,{'meta_commerce':r})
   self.assertEqual(state['channels']['meta_commerce']['state'],'prepared_not_delivered')
  state=hub(d,plan,{'alex_messenger':good},now=datetime.fromisoformat(d['source']['generated_at'].replace('Z','+00:00')))
  self.assertEqual(state['channels']['alex_messenger']['state'],'verified');self.assertFalse(state['fully_synchronized'])
  self.assertEqual(len(state['alerts']),7);self.assertFalse(state['fully_automated'])
 def test_expired_receipt_is_not_current_and_all_eight_share_one_source(self):
  d=self.data();r={'version':version(d),'commercial_signature':signature(d),'received':True,'processed':True,'evidence':'test','verified_at':'2026-10-22T01:00:00Z'}
  later=datetime.fromisoformat(d['expires_at'].replace('Z','+00:00'))+timedelta(seconds=1)
  state=hub(d,changes(d,d),{'alex_messenger':r},now=later)
  self.assertEqual(state['channels']['alex_messenger']['state'],'verified_source_expired')
  self.assertEqual(len(state['channels']),8);self.assertTrue(all(s['expected_version']==version(d) for s in state['channels'].values()))
 def test_new_workbook_chain_advances_version_and_never_marks_channels_delivered(self):
  # Two actual XLSX fixtures use the real importer, adapters and staging path.
  # This is simulated source data, not an external destination receipt.
  with tempfile.TemporaryDirectory() as folder:
   now=fixtures.NOW
   a,_=normalize(fixtures.workbook(folder,[fixtures.row()],when=now-timedelta(minutes=2)),fixtures.BASE,fixtures.WEB,now=now)
   d,report=normalize(fixtures.workbook(folder,[fixtures.row(Q='2.40')],when=now-timedelta(minutes=1)),fixtures.BASE,fixtures.WEB,now=now)
   out=Path(folder)/'hub';write_bundle(out,a,report);write_bundle(out,d,report,previous_central=a)
   self.assertNotEqual(version(a),version(d));self.assertTrue((out/'last-valid.json').exists())
   manifest=json.loads((out/'hub.json').read_text());plan=json.loads((out/'changes.json').read_text())
   self.assertEqual(manifest['version'],version(d));self.assertEqual(plan['changed_sku'],['TEST001'])
   for name in ('alex','web_catalog','webstore','banner_factory','pdf_categories','whatsapp_business'):
    adapter=json.loads((out/'adapters'/f'{name}.json').read_text());self.assertEqual(adapter['data_version'],version(d));self.assertEqual(adapter['canonical'],'../current.json')
   self.assertFalse(manifest['fully_synchronized']);self.assertEqual(len(manifest['alerts']),8)
   self.assertNotIn('"stock":',json.dumps(manifest));self.assertNotIn('PRIVATE_COST',(out/'current.json').read_text())
   older=copy.deepcopy(a)
   with self.assertRaisesRegex(ValueError,'OLDER_THAN_LAST_VALID'):write_bundle(out,older,report)
   self.assertEqual(json.loads((out/'current.json').read_text())['source']['sha256'],d['source']['sha256'])

if __name__=='__main__':unittest.main()
