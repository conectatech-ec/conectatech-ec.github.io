import importlib.util,unittest
from dataclasses import dataclass,replace
from pathlib import Path
ROOT=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('install',ROOT/'install-receiver.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
@dataclass(frozen=True)
class Part:
 name:str;filename:str;content_type:str;body:bytes;headers:tuple=()
@dataclass(frozen=True)
class Bundle:
 entrypoint:str;parts:tuple
class Tests(unittest.TestCase):
 def setUp(self):
  self.original=Bundle('worker.mjs',tuple(Part(n,n,'application/javascript+module',(ROOT/'base'/f).read_bytes()) for n,f in [('worker.mjs','worker-installed.mjs'),('commercial-reception.mjs','commercial-reception-installed.mjs')])+(Part('untouched.mjs','untouched.mjs','application/javascript+module',b'UNRELATED PRIVATE FIXTURE'),))
  self.patch=m.load_patch()
 def test_only_reviewed_delta_changes(self):
  new=m.candidate(self.original,self.patch,Part,Bundle);a=m.modules(self.original);b=m.modules(new)
  self.assertEqual(a['untouched.mjs'],b['untouched.mjs']);self.assertEqual(set(b)-set(a),{'observer-auth.mjs','observer-dispatch.mjs'})
  worker=b['worker.mjs'].body.decode().replace("import {handleObserverRequest} from './observer-auth.mjs';\n",'').replace('  const observer=await handleObserverRequest(req,env);if(observer)return observer;\n','')
  self.assertEqual(worker.encode(),a['worker.mjs'].body)
 def test_unreviewed_worker_cannot_be_overwritten(self):
  modified=replace(self.original,parts=(replace(self.original.parts[0],body=b'changed'),*self.original.parts[1:]))
  with self.assertRaisesRegex(ValueError,'WORKER_BASE_CHANGED'):m.candidate(modified,self.patch,Part,Bundle)
 def test_unreviewed_receiver_cannot_be_overwritten(self):
  modified=replace(self.original,parts=(self.original.parts[0],replace(self.original.parts[1],body=b'changed'),self.original.parts[2]))
  with self.assertRaisesRegex(ValueError,'RECEIVER_BASE_CHANGED'):m.candidate(modified,self.patch,Part,Bundle)
 def test_installation_never_silently_repeats(self):
  new=m.candidate(self.original,self.patch,Part,Bundle)
  with self.assertRaisesRegex(ValueError,'ALREADY_PRESENT'):m.candidate(new,self.patch,Part,Bundle)
 def test_inverse_is_exact(self):
  new=m.candidate(self.original,self.patch,Part,Bundle)
  self.assertEqual(m.recover(self.original,new,new,Bundle),self.original)
 def test_inverse_preserves_new_unrelated_work(self):
  new=m.candidate(self.original,self.patch,Part,Bundle)
  current=replace(new,parts=tuple(replace(p,body=b'new unrelated work') if p.name=='untouched.mjs' else p for p in new.parts))
  recovered=m.recover(self.original,new,current,Bundle)
  self.assertEqual(m.modules(recovered)['untouched.mjs'].body,b'new unrelated work')
  self.assertEqual(m.modules(recovered)['worker.mjs'],m.modules(self.original)['worker.mjs'])
 def test_inverse_does_not_overwrite_new_owned_work(self):
  new=m.candidate(self.original,self.patch,Part,Bundle)
  current=replace(new,parts=tuple(replace(p,body=b'new reviewed work') if p.name=='worker.mjs' else p for p in new.parts))
  with self.assertRaisesRegex(ValueError,'RECOVERY_OWNED_MODULE_CHANGED'):m.recover(self.original,new,current,Bundle)
if __name__=='__main__':unittest.main()
