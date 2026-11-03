"""Offline scoped-deployment guards; all module bodies below are synthetic."""
import importlib.util,unittest
from dataclasses import replace
from pathlib import Path

spec=importlib.util.spec_from_file_location('deploy_alex_variants',Path(__file__).with_name('deploy_alex_variants.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
from scoped_content import Bundle,Part

class VariantScopeTests(unittest.TestCase):
    def fixture(self):
        padding=b'// synthetic public module fixture '*7+b'\n'
        privacy=b'export function privacyPage(){return "unchanged approved privacy and deletion";}\n'
        baselines={name:b'// previous '+name.encode()+b'\n'+padding for name in module.REPLACED}
        baselines['alex-ui.mjs']=b'export function alexPage(){return "old chat";}\n'+padding+privacy
        desired={name:b'// updated '+name.encode()+b'\n'+padding for name in module.OWNED}
        desired['alex-ui.mjs']=b'export function alexPage(){return "new variant display";}\n'+padding+privacy
        parts=[Part(name,name,'application/javascript+module',body,(('Content-Length',str(len(body))),('X-Fixture-Keep','owned-header'))) for name,body in sorted(baselines.items())]
        for name in ('worker.mjs','central-source.mjs','central-data.mjs','commercial-reception.mjs','alex-collaborators.mjs','marketplace-library.mjs'):
            parts.append(Part(name,name,'application/javascript+module',b'opaque synthetic unowned module '+name.encode(),
                              (('X-Fixture-Keep','unowned-header'),('Content-Length','UNCHANGED-FIXTURE-HEADER'))))
        return Bundle('worker.mjs',tuple(parts)),desired,baselines

    def test_owned_allowlist_only_and_unowned_bodies_headers_and_host_are_preserved(self):
        before,desired,baseline=self.fixture();after=module.prepare_variants(before,desired,baseline)
        old={part.name:part for part in before.parts};new={part.name:part for part in after.parts}
        self.assertEqual(before.entrypoint,after.entrypoint)
        self.assertEqual(set(new)-set(old),module.ADDED)
        self.assertEqual(len(new),len(old)+len(module.ADDED))
        for name in set(old)-module.OWNED:
            self.assertIs(new[name],old[name])
            self.assertEqual(new[name].body,old[name].body)
            self.assertEqual(new[name].headers,old[name].headers)
        for name in module.REPLACED:
            self.assertEqual(new[name].body,desired[name])
            self.assertIn(('Content-Length',str(len(desired[name]))),new[name].headers)
            self.assertIn(('X-Fixture-Keep','owned-header'),new[name].headers)
        for name in module.ADDED:
            self.assertEqual(new[name].body,desired[name]);self.assertEqual(new[name].filename,name)
        with self.assertRaisesRegex(ValueError,'VAR_MODULE_SET_INVALID'):
            module.prepare_variants(before,{**desired,'worker.mjs':b'host overwrite forbidden'},baseline)
        with self.assertRaisesRegex(ValueError,'VAR_MODULE_SET_INVALID'):
            module.prepare_variants(before,{**desired,'central-source.mjs':b'adapter overwrite forbidden'},baseline)

    def test_privacy_and_deletion_tail_must_remain_byte_identical(self):
        before,desired,baseline=self.fixture()
        for replacement in (
            desired['alex-ui.mjs'].replace(b'unchanged approved privacy and deletion',b'new unapproved policy'),
            desired['alex-ui.mjs'].replace(b'export function privacyPage',b'export function removedPrivacyPage'),
            desired['alex-ui.mjs']+b'export function privacyPage(){return "duplicate";}',
        ):
            with self.subTest(case=replacement[-30:]),self.assertRaisesRegex(ValueError,'VAR_PRIVACY_PAGE_CHANGED'):
                module.prepare_variants(before,{**desired,'alex-ui.mjs':replacement},baseline)

    def test_any_owned_live_edit_outside_the_pinned_baseline_is_rejected(self):
        before,desired,baseline=self.fixture()
        for name in module.REPLACED:
            changed=Bundle(before.entrypoint,tuple(replace(part,body=part.body+b'concurrent synthetic edit') if part.name==name else part for part in before.parts))
            with self.subTest(module=name),self.assertRaisesRegex(ValueError,'VAR_LIVE_OWNED_MODULE_CHANGED'):
                module.prepare_variants(changed,desired,baseline)

    def test_existing_new_modules_missing_targets_and_blind_repeat_upload_are_rejected(self):
        before,desired,baseline=self.fixture()
        for name in module.ADDED:
            changed=Bundle(before.entrypoint,(*before.parts,Part(name,name,'application/javascript+module',b'existing independently deployed module')))
            with self.subTest(module=name),self.assertRaisesRegex(ValueError,'VAR_LIVE_MODULE_LAYOUT_CHANGED'):
                module.prepare_variants(changed,desired,baseline)
        missing=Bundle(before.entrypoint,tuple(part for part in before.parts if part.name!='alex-store.mjs'))
        with self.assertRaisesRegex(ValueError,'VAR_LIVE_MODULE_LAYOUT_CHANGED'):
            module.prepare_variants(missing,desired,baseline)
        after=module.prepare_variants(before,desired,baseline)
        with self.assertRaisesRegex(ValueError,'VAR_LIVE_OWNED_MODULE_CHANGED'):
            module.prepare_variants(after,desired,baseline)

    def test_duplicate_modules_wrong_entrypoint_baseline_scope_and_invalid_body_are_rejected(self):
        before,desired,baseline=self.fixture()
        for bundle in (Bundle('different-host.mjs',before.parts),Bundle(before.entrypoint,(*before.parts,before.parts[0]))):
            with self.assertRaisesRegex(ValueError,'VAR_MODULE_SET_INVALID'):
                module.prepare_variants(bundle,desired,baseline)
        with self.assertRaisesRegex(ValueError,'VAR_MODULE_SET_INVALID'):
            module.prepare_variants(before,desired,{key:value for key,value in baseline.items() if key!='channels.mjs'})
        for body in (b'',b'x'*200001,'not module bytes'):
            with self.subTest(kind=type(body).__name__),self.assertRaisesRegex(ValueError,'VAR_REPLACEMENT_INVALID'):
                module.prepare_variants(before,{**desired,'alex-media.mjs':body},baseline)

    def test_known_json_imports_are_rewritten_without_creating_or_replacing_data_modules(self):
        original=b'\n'.join(old for old,_new in module.IMPORTS)+b'\nexport const unchanged=1;\n'
        rewritten=module.compiled('alex.mjs',original)
        for old,new in module.IMPORTS:
            self.assertNotIn(old,rewritten);self.assertIn(new,rewritten)
        self.assertIn(b'export const unchanged=1;',rewritten)
        self.assertIn(b"with {type:'json'}",original)
        with self.assertRaisesRegex(ValueError,'VAR_COMPILE_SCOPE_INVALID'):
            module.compiled('worker.mjs',original)
        with self.assertRaisesRegex(ValueError,'VAR_UNSUPPORTED_JSON_IMPORT'):
            module.compiled('alex-store.mjs',b"import unknown from './unreviewed.json' with {type:'json'};")

if __name__=='__main__':unittest.main()
