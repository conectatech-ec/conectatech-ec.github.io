import unittest,sys,csv,io
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]));from simular import simulate,URL
class Cases(unittest.TestCase):
 def data(self,rows):
  f=io.StringIO();w=csv.DictWriter(f,['id','price','availability','link','image_link','custom_label_0']);w.writeheader();w.writerows(rows);return f.getvalue()
 def target(self):return {'id':'TELF001','price':'139.90 USD','availability':'in stock','link':URL,'image_link':'https://example.test/existing.jpg','custom_label_0':''}
 def test_only_label_changes(self):
  rows=[self.target(),{**self.target(),'id':'OTHER','price':'5.00 USD'}];r=simulate(self.data(rows));self.assertEqual(r['changes'],[{'sku':'TELF001','fields':['custom_label_0']}]);self.assertTrue(r['non_target_rows_unchanged']);self.assertTrue(r['other_target_fields_unchanged']);self.assertFalse(r['applied']);self.assertFalse(r['before_collection_match']);self.assertTrue(r['after_collection_match'])
 def test_duplicate_missing_and_changed_price_are_blocked(self):
  for rows in [[],[self.target(),self.target()],[{**self.target(),'price':'1.00 USD'}],[{**self.target(),'availability':'out of stock'}]]:
   with self.assertRaises(ValueError):simulate(self.data(rows))
 def test_idempotent_candidate_preserves_existing_assignment(self):
  r=simulate(self.data([{**self.target(),'custom_label_0':'ct-web:celulares-y-smartphones'}]));self.assertEqual(r['changes'],[])
