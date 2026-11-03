"""Offline scoped-deployment guards; all module bodies below are synthetic."""
import base64,importlib.util,json,unittest
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

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
        worker=b'// independently edited live host preserved\n'+module.WORKER_AUTH+b'\n  try {\n'+module.WORKER_ANCHOR+b'\n    return "live marketplace route";\n   }\n   // unowned banner preview remains intact\n'
        for name in ('worker.mjs','central-source.mjs','central-data.mjs','source-attestations.mjs','commercial-reception.mjs','alex-collaborators.mjs','marketplace-library.mjs'):
            parts.append(Part(name,name,'application/javascript+module',worker if name=='worker.mjs' else b'opaque synthetic unowned module '+name.encode(),
                              (('X-Fixture-Keep','unowned-header'),('Content-Length','UNCHANGED-FIXTURE-HEADER'))))
        return Bundle('worker.mjs',tuple(parts)),desired,baselines

    def test_owned_allowlist_only_and_unowned_bodies_headers_and_host_regions_are_preserved(self):
        before,desired,baseline=self.fixture();after=module.prepare_variants(before,desired,baseline)
        old={part.name:part for part in before.parts};new={part.name:part for part in after.parts}
        self.assertEqual(before.entrypoint,after.entrypoint)
        self.assertEqual(set(new)-set(old),module.ADDED)
        self.assertEqual(len(new),len(old)+len(module.ADDED))
        for name in set(old)-module.OWNED-module.PATCHED:
            self.assertIs(new[name],old[name])
            self.assertEqual(new[name].body,old[name].body)
            self.assertEqual(new[name].headers,old[name].headers)
        self.assertEqual(module.PATCHED,{'worker.mjs'})
        self.assertEqual(new['worker.mjs'].body,old['worker.mjs'].body.replace(module.WORKER_ANCHOR,module.PRIVATE_SIGNATURE_ROUTE+module.WORKER_ANCHOR,1))
        self.assertEqual(new['worker.mjs'].body.replace(module.PRIVATE_SIGNATURE_ROUTE,b'',1),old['worker.mjs'].body)
        self.assertIn(('X-Fixture-Keep','unowned-header'),new['worker.mjs'].headers)
        self.assertIn(('Content-Length',str(len(new['worker.mjs'].body))),new['worker.mjs'].headers)
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
        for name in ('alex-store.mjs','worker.mjs'):
            missing=Bundle(before.entrypoint,tuple(part for part in before.parts if part.name!=name))
            with self.subTest(missing=name),self.assertRaisesRegex(ValueError,'VAR_LIVE_MODULE_LAYOUT_CHANGED'):
                module.prepare_variants(missing,desired,baseline)
        after=module.prepare_variants(before,desired,baseline)
        with self.assertRaisesRegex(ValueError,'VAR_LIVE_MODULE_LAYOUT_CHANGED' if module.ADDED else 'VAR_LIVE_OWNED_MODULE_CHANGED'):
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

    def test_other_sessions_attestations_and_the_financial_source_are_preserved(self):
        self.assertNotIn('source-attestations.mjs',module.OWNED)
        for name in ['source-attestations.mjs','central-data.mjs','central-source.mjs','marketplace-library.mjs']:
            with self.subTest(module=name),self.assertRaisesRegex(ValueError,'VAR_COMPILE_SCOPE_INVALID'):
                module.compiled(name,b'{}')
        self.assertEqual(module.SOURCE_PATHS,{'alex-signature-release.mjs':'alex-signature-release.json'})

    def test_signature_release_is_the_only_added_json_module_and_uses_exact_packaging(self):
        raw=b'{\n  "scope": "owner_private_only", "products": {}\n}\n'
        self.assertEqual(module.ADDED,{'alex-signature-release.mjs','alex-signature-store.mjs'})
        self.assertEqual(module.compiled('alex-signature-release.mjs',raw),b'export default '+raw+b';\n')
        original=b"import release from './alex-signature-release.json' with {type:'json'};\n"
        self.assertEqual(module.compiled('alex-media.mjs',original),b"import release from './alex-signature-release.mjs';\n")
        with self.assertRaisesRegex(ValueError,'VAR_DATA_MODULE_OBJECT_REQUIRED'):
            module.compiled('alex-signature-release.mjs',b'[]')
        self.assertEqual(module.compiled('alex-signature-store.mjs',original),b"import release from './alex-signature-release.mjs';\n")
        self.assertNotIn('alex-signature-store.mjs',module.SOURCE_PATHS)

    def test_live_worker_patch_preserves_independent_banner_preview_and_rejects_unsafe_anchors(self):
        before,desired,baseline=self.fixture()
        original=next(part for part in before.parts if part.name=='worker.mjs').body
        independent=original.replace(module.WORKER_ANCHOR,b'   // new unrelated banner preview feature\n'+module.WORKER_ANCHOR)+b'\n// unrelated source tail\n'
        changed=Bundle(before.entrypoint,tuple(replace(part,body=independent) if part.name=='worker.mjs' else part for part in before.parts))
        deployed=module.prepare_variants(changed,desired,baseline)
        actual=next(part for part in deployed.parts if part.name=='worker.mjs').body
        self.assertEqual(actual.replace(module.PRIVATE_SIGNATURE_ROUTE,b'',1),independent)
        self.assertLess(actual.index(module.WORKER_AUTH),actual.index(module.PRIVATE_SIGNATURE_ROUTE))
        unsafe=(
            (original.replace(module.WORKER_ANCHOR,b''),'VAR_WORKER_PATCH_ANCHOR_INVALID'),
            (original+module.WORKER_ANCHOR,'VAR_WORKER_PATCH_ANCHOR_INVALID'),
            (original.replace(module.WORKER_AUTH,b''),'VAR_WORKER_PATCH_ANCHOR_INVALID'),
            (original+module.WORKER_AUTH,'VAR_WORKER_PATCH_ANCHOR_INVALID'),
            (original.replace(module.WORKER_AUTH,b'')+module.WORKER_AUTH,'VAR_WORKER_AUTHORIZATION_ORDER_INVALID'),
            (module.patch_live_worker(original),'VAR_WORKER_SIGNATURE_ROUTE_ALREADY_PRESENT'),
            (original+b"\n// 'alex-private-signature'",'VAR_WORKER_SIGNATURE_ROUTE_ALREADY_PRESENT'),
        )
        for body,code in unsafe:
            with self.subTest(code=code),self.assertRaisesRegex(ValueError,code):module.patch_live_worker(body)
        self.assertNotIn('worker.mjs',module.REPLACED)
        self.assertNotIn('worker.mjs',module.OWNED)

    def test_scoped_private_route_is_identical_to_the_local_host_route(self):
        worker=(module.ROOT/'automatizacion/worker.mjs').read_bytes()
        self.assertEqual(worker.count(module.PRIVATE_SIGNATURE_ROUTE+module.WORKER_ANCHOR),1)

    def test_verify_switch_is_read_only_and_never_substitutes_for_explicit_deploy(self):
        expected={'deploy':True,'worker':'conectatech-comercial-piloto','expected_base_release':module.BASE_RELEASE,'baseline_code_revision':module.CODE_REVISION,'cost_max_usd':0}
        class Response:
            status=200
            def __init__(self,value):self.value=json.dumps({'content':base64.b64encode(json.dumps(value).encode()).decode()}).encode()
            def read(self,_limit):return self.value
            def __enter__(self):return self
            def __exit__(self,*_args):return False
        env={'GITHUB_SHA':'d'*40,'EXPECTED_BASE_RELEASE':module.BASE_RELEASE,'EXPECTED_CODE_REVISION':module.CODE_REVISION}
        with patch.dict(module.os.environ,env),patch.object(module,'read_latest_revision',return_value='d'*40):
            for value in (expected,{**expected,'verify':False},{**expected,'verify':True}):
                opener=SimpleNamespace(open=lambda *_args,**_kwargs:Response(value))
                with patch.object(module.urllib.request,'build_opener',return_value=opener):module.require_control()
            for value in ({**expected,'deploy':False,'verify':True},{**expected,'verify':'true'},{**expected,'cost_max_usd':False},{**expected,'arbitrary_permission':True}):
                opener=SimpleNamespace(open=lambda *_args,**_kwargs:Response(value))
                with patch.object(module.urllib.request,'build_opener',return_value=opener),self.assertRaisesRegex(ValueError,'VAR_PUBLIC_CONTROL_DISABLED_OR_CHANGED'):
                    module.require_control()

if __name__=='__main__':unittest.main()
