import importlib.util,sys,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('conversation_deploy',Path(__file__).with_name('deploy_alex_conversation.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
from scoped_content import Bundle,Part
class ScopeTest(unittest.TestCase):
    def setUp(self):
        self.old={n:b'/* preserved baseline */'*8 for n in m.OWNED};self.old['alex-ui.mjs']+=b'export function privacyPage(){return "preserved";}'
        self.new={n:b'/* new conversation */'+b for n,b in self.old.items()}
        self.bundle=Bundle('worker.mjs',tuple(Part(n,n,'application/javascript+module',b) for n,b in {**self.old,'worker.mjs':b'host','central-data.mjs':b'current-source','alex-signature-store.mjs':b'private-store','source-attestations.mjs':b'other-session'}.items()))
    def test_preserves_every_unowned_byte(self):
        result=m.prepare(self.bundle,self.new,self.old)
        for p in self.bundle.parts:
            if p.name not in m.OWNED:self.assertEqual(p,next(q for q in result.parts if q.name==p.name))
    def test_rejects_privacy_change(self):
        self.new['alex-ui.mjs']+=b'changed';self.assertRaises(ValueError,m.prepare,self.bundle,self.new,self.old)
    def test_rejects_stale_baseline_or_scope_expansion(self):
        self.old['alex.mjs']+=b'concurrent';self.assertRaises(ValueError,m.prepare,self.bundle,self.new,self.old)
        self.new['worker.mjs']=b'changed';self.assertRaises(ValueError,m.prepare,self.bundle,self.new,self.old)
    def test_compiles_actual_three_modules_without_replacing_data(self):
        for n in m.OWNED:self.assertNotIn(b"with {type:'json'}",m.compiled(n,(m.ROOT/'automatizacion'/n).read_bytes()))
if __name__=='__main__':unittest.main()
