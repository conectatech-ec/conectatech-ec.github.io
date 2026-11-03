import importlib.util,unittest
from dataclasses import replace
from pathlib import Path

spec=importlib.util.spec_from_file_location('deploy_alex_collaborators',Path(__file__).with_name('deploy_alex_collaborators.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
from scoped_content import Bundle,Part

class CollaboratorScopeTests(unittest.TestCase):
    def fixture(self):
        padding=b'// '+b'public code fixture '*8+b'\n'
        old_route=(module.CHAT_START+b"\n    return legacyChat();\n   }\n")
        new_route=(module.CHAT_START+b"\n    return routeSimulator(b);\n   }\n"
                   b"   if(path==='/alex/collaborators'&&req.method==='GET')return profilesForOwner();\n")
        prefix=b"import {legacy} from './legacy.mjs';\nconst json=Object;\n"
        suffix=module.CHAT_END+b".includes(path))return status();\n// banner: baseline\n"
        baseline_worker=prefix+old_route+suffix+padding
        live_worker=baseline_worker.replace(b'// banner: baseline',b'// banner: live-owned-by-another-session')
        # The local full worker intentionally has unrelated draft code. It must
        # not enter the live bundle when the collaborator route is promoted.
        local_worker=module.PROFILE_IMPORT+prefix+new_route+suffix.replace(b'// banner: baseline',b'// banner: NEVER PUBLISH LOCAL DRAFT')+padding
        tail=b'export function privacyPage(){return "approved privacy and deletion";}\n'
        old_ui=b'export function alexPage(){return "old chat";}\n'+padding+tail
        new_ui=b'export function alexPage(){return "collaborator selector";}\n'+padding+tail
        baseline={'worker.mjs':baseline_worker,'alex.mjs':b'export function generateAlex(){return "old";}\n'+padding,
                  'alex-store.mjs':b'export function alexFetch(){return "old";}\n'+padding,'alex-ui.mjs':old_ui}
        desired={'worker.mjs':local_worker,'alex.mjs':b'export function generateAlex(){return "new persona";}\n'+padding,
                 'alex-store.mjs':b'export function alexFetch(){return "isolated contexts";}\n'+padding,
                 'alex-ui.mjs':new_ui,'alex-collaborators.mjs':b'export const profiles={COL001:"Rafa",COL002:"Jessy"};\n'+padding}
        live={**baseline,'worker.mjs':live_worker}
        parts=[Part(name,name,'application/javascript+module',body,(('Content-Length',str(len(body))),)) for name,body in live.items()]
        parts.extend([Part('central-data.mjs','central-data.mjs','application/javascript+module',b'private source: never publish in output'),
                      Part('commercial-reception.mjs','commercial-reception.mjs','application/javascript+module',b'live Data Hub receiver'),
                      Part('messenger.mjs','messenger.mjs','application/javascript+module',b'live Messenger receiver')])
        return Bundle('worker.mjs',tuple(parts)),desired,baseline

    def test_only_owned_modules_change_and_an_existing_worker_draft_is_preserved(self):
        before,desired,baseline=self.fixture();after=module.prepare_collaborators(before,desired,baseline)
        old={part.name:part for part in before.parts};new={part.name:part for part in after.parts}
        self.assertEqual(set(new)-set(old),{'alex-collaborators.mjs'})
        self.assertEqual(before.entrypoint,after.entrypoint)
        for name in ('central-data.mjs','commercial-reception.mjs','messenger.mjs'):
            self.assertEqual(old[name],new[name])
        worker=new['worker.mjs'].body
        self.assertIn(b'// banner: live-owned-by-another-session',worker)
        self.assertNotIn(b'NEVER PUBLISH LOCAL DRAFT',worker)
        self.assertEqual(worker.count(module.PROFILE_IMPORT),1)
        self.assertIn(b'routeSimulator(b)',worker)
        self.assertIn(b"path==='/alex/collaborators'",worker)
        for name in module.REPLACED:
            self.assertIn(('Content-Length',str(len(new[name].body))),new[name].headers)

    def test_unknown_live_owned_code_blocks_before_any_replacement(self):
        before,desired,baseline=self.fixture()
        changed=Bundle(before.entrypoint,tuple(replace(part,body=part.body+b'changed after baseline') if part.name=='alex-store.mjs' else part for part in before.parts))
        with self.assertRaisesRegex(ValueError,'COL_LIVE_OWNED_MODULE_CHANGED'):
            module.prepare_collaborators(changed,desired,baseline)

    def test_privacy_and_deletion_cannot_change_with_the_ui(self):
        before,desired,baseline=self.fixture()
        changed={**desired,'alex-ui.mjs':desired['alex-ui.mjs'].replace(b'approved privacy and deletion',b'changed private policy')}
        with self.assertRaisesRegex(ValueError,'COL_PRIVACY_PAGE_CHANGED'):
            module.prepare_collaborators(before,changed,baseline)

    def test_ambiguous_routes_new_entrypoints_and_extra_targets_are_rejected(self):
        before,desired,baseline=self.fixture()
        changed=Bundle(before.entrypoint,tuple(replace(part,body=part.body+module.chat_block(baseline['worker.mjs'])) if part.name=='worker.mjs' else part for part in before.parts))
        with self.assertRaisesRegex(ValueError,'COL_LIVE_WORKER_ROUTE_CHANGED'):
            module.prepare_collaborators(changed,desired,baseline)
        with self.assertRaisesRegex(ValueError,'COL_MODULE_SET_INVALID'):
            module.prepare_collaborators(Bundle('other.mjs',before.parts),desired,baseline)
        with self.assertRaisesRegex(ValueError,'COL_MODULE_SET_INVALID'):
            module.prepare_collaborators(before,{**desired,'commercial-reception.mjs':b'not permitted'},baseline)

    def test_a_previous_collaborator_install_is_not_blindly_uploaded_again(self):
        before,desired,baseline=self.fixture();installed=module.prepare_collaborators(before,desired,baseline)
        with self.assertRaisesRegex(ValueError,'COL_LIVE_MODULE_LAYOUT_CHANGED'):
            module.prepare_collaborators(installed,desired,baseline)

    def test_only_the_known_json_import_requires_packaging_translation(self):
        value=b"import policy from './alex-policy.json' with {type:'json'};\nexport const unchanged=1;\n"
        transformed=module.compiled('alex.mjs',value)
        self.assertIn(b"from './alex-policy.mjs';",transformed)
        self.assertIn(b'export const unchanged=1;',transformed)
        self.assertEqual(module.compiled('alex-store.mjs',value),value)

if __name__=='__main__':unittest.main()
