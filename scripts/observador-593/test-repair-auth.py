import importlib.util,unittest
from dataclasses import dataclass
from pathlib import Path
s=importlib.util.spec_from_file_location('repair',Path(__file__).with_name('repair-auth.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
@dataclass(frozen=True)
class Part:
 name:str;body:bytes;headers:tuple=()
@dataclass(frozen=True)
class Bundle:
 entrypoint:str;parts:tuple
class Tests(unittest.TestCase):
 def setUp(self):self.original=Bundle('worker.mjs',(Part('observer-auth.mjs',b'old'),Part('other.mjs',b'unrelated')))
 def test_updates_only_identity(self):
  new=m.change(self.original,m.sha(b'old'),b'new',Bundle)
  self.assertEqual(new.parts[0].body,b'new');self.assertEqual(new.parts[1],self.original.parts[1])
 def test_unknown_identity_version_is_rejected(self):
  with self.assertRaisesRegex(ValueError,'AUTH_BASE_CHANGED'):m.change(self.original,m.sha(b'other'),b'new',Bundle)
 def test_inverse_preserves_other_modules(self):
  live=Bundle('worker.mjs',(Part('observer-auth.mjs',b'new'),Part('other.mjs',b'concurrent')))
  old=m.change(live,m.sha(b'new'),b'old',Bundle)
  self.assertEqual(old.parts[1].body,b'concurrent')
if __name__=='__main__':unittest.main()
