import importlib.util,sqlite3,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('deploy_free',ROOT/'deploy_free.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class FreeGuardTest(unittest.TestCase):
 def test_free_empty_and_explicit(self):
  self.assertTrue(module.verify_free([]));self.assertTrue(module.verify_free([{'price':0,'state':'active','rate_plan':{'id':'workers_free'}}]))
 def test_paid_trial_unknown_rejected(self):
  for value in [[{'price':5}],[{'price':0,'type':'trial'}],[{'state':'active'}],[{'price':0,'rate_plan':{'id':'standard'}}],[{'price':0,'rate_plan':{'id':'workers_free','components':[{'unit_price':0.1}]}}],None]:
   with self.assertRaises(ValueError):module.verify_free(value)
 def test_actual_sqlite_dedup_and_retention(self):
  db=sqlite3.connect(':memory:');db.executescript((ROOT/'schema.sql').read_text())
  row=('fixture-000000001','hash','{}','2026-01-01','2026-01-02')
  for _ in range(2):db.execute('INSERT OR IGNORE INTO solicitudes VALUES (?,?,?,?,?)',row)
  self.assertEqual(db.execute('SELECT count(*) FROM solicitudes').fetchone()[0],1)
  db.execute('DELETE FROM solicitudes WHERE expires_at < ?',('2026-02-01',));self.assertEqual(db.execute('SELECT count(*) FROM solicitudes').fetchone()[0],0)
if __name__=='__main__':unittest.main()
