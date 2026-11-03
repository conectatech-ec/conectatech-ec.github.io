import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('deploy_alex_ui',Path(__file__).with_name('deploy_alex_ui.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
from scoped_content import Bundle,Part
class UIScopeTests(unittest.TestCase):
    def fixture(self):
        tail=b'export function privacyPage(){return "approved public privacy";}'
        old=b'export function alexPage(){'+b' '*1100+b'}\n'+tail
        new=b'export function alexPage(){'+b' '*1200+b'}\n'+tail
        parts=(Part('worker.mjs','worker.mjs','application/javascript+module',b'unchanged engine'),
               Part('alex-ui.mjs','alex-ui.mjs','application/javascript+module',old,(('Content-Length',str(len(old))),)),
               Part('central-data.mjs','central-data.mjs','application/javascript+module',b'private source fixture never output'))
        return Bundle('worker.mjs',parts),new
    def test_only_public_chat_body_changes_and_private_modules_remain_exact(self):
        before,new=self.fixture();after=module.prepare_ui(before,new)
        self.assertEqual(before.entrypoint,after.entrypoint)
        self.assertEqual(before.parts[0],after.parts[0]);self.assertEqual(before.parts[2],after.parts[2])
        self.assertEqual(after.parts[1].body,new);self.assertIn(('Content-Length',str(len(new))),after.parts[1].headers)
    def test_privacy_changes_and_missing_target_cannot_be_deployed(self):
        before,new=self.fixture()
        with self.assertRaisesRegex(ValueError,'UI_CANNOT_CHANGE_PRIVACY_PAGES'):module.prepare_ui(before,new.replace(b'approved public privacy',b'changed policy'))
        with self.assertRaisesRegex(ValueError,'UI_MODULE_INVALID'):module.prepare_ui(Bundle('worker.mjs',(before.parts[0],before.parts[2])),new)
if __name__=='__main__':unittest.main()
