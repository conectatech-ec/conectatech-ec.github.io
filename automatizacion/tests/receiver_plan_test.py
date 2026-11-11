"""Offline planning/rollback contracts; only public receiver code and synthetic data."""
import contextlib,copy,hashlib,io,json,os,subprocess,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import scoped_content as scoped
import scoped_content_test as fixtures

ROOT=Path(__file__).resolve().parents[1]
TEMPLATE=(ROOT/'commercial-reception.mjs').read_text()
LEGACY=(ROOT/'tests/fixtures/receiver-original-cc05f6d77.txt').read_bytes()

class ReceiverPlanning(unittest.TestCase):
    def runtime(self):
        r=fixtures.Runtime()
        r.bundle=scoped.replace_part(r.bundle,'commercial-reception.mjs',LEGACY)
        r.original_bundle=copy.deepcopy(r.bundle)
        return r
    def plan(self,r):
        return r.client().plan_receiver(TEMPLATE,fixtures.PROCESSOR_RELEASE,fixtures.CODE_HASH)
    def test_public_original_and_reviewed_template_are_pinned(self):
        self.assertEqual(hashlib.sha256(LEGACY).hexdigest(),scoped.LEGACY_RECEIVER_SHA256)
        self.assertEqual(hashlib.sha256(TEMPLATE.encode()).hexdigest(),scoped.REVIEWED_RECEIVER_SHA256)
    def test_reviewable_patch_builds_exact_target_and_reverses_exactly(self):
        artifact=ROOT/'revision-receptor/adaptacion-publica.patch'
        with tempfile.TemporaryDirectory() as folder:
            destination=Path(folder)/'automatizacion/commercial-reception.mjs'
            destination.parent.mkdir();destination.write_bytes(LEGACY)
            subprocess.run(['git','apply',str(artifact)],cwd=folder,check=True,capture_output=True)
            self.assertEqual(destination.read_bytes(),TEMPLATE.encode())
            subprocess.run(['git','apply','--reverse',str(artifact)],cwd=folder,check=True,capture_output=True)
            self.assertEqual(destination.read_bytes(),LEGACY)
    def test_plan_changes_only_receiver_and_cannot_authorize_ingest(self):
        r=self.runtime();settings=copy.deepcopy(r.settings);plan,report=self.plan(r)
        self.assertEqual(r.puts,[]);self.assertTrue(scoped.same_bundle(r.bundle,r.original_bundle))
        self.assertEqual(r.settings,settings);self.assertTrue(report['read_only'])
        self.assertFalse(report['ready']);self.assertFalse(report['ingest_ready'])
        self.assertFalse(report['deployment_authorized']);self.assertEqual(report['worker_puts'],0)
        self.assertEqual(report['changed_modules'],['commercial-reception.mjs'])
        self.assertEqual(plan.before.entrypoint,plan.after.entrypoint)
        for part in plan.before.parts:
            if part.name!='commercial-reception.mjs':self.assertEqual(part,fixtures.get_part(plan.after,part.name))
        self.assertEqual(scoped.processor_release_of(plan.after),fixtures.PROCESSOR_RELEASE)
        self.assertEqual(scoped.processor_code_of(plan.after),fixtures.CODE_HASH)
        self.assertEqual(scoped.bundled_source(plan.before),scoped.bundled_source(plan.after))
        self.assertNotIn(fixtures.PRIVATE,json.dumps(report));self.assertNotIn(fixtures.PRIVATE,repr(plan))
        self.assertEqual({path for kind,path in r.calls if kind=='private'},
            {'/health','/messenger/status','/messenger/seller/status','/commercial/catalog'})
    def test_missing_stamps_do_not_prove_the_active_body_is_the_original(self):
        r=self.runtime();r.bundle=scoped.replace_part(r.bundle,'commercial-reception.mjs',LEGACY+b'//unknown local fix')
        with self.assertRaisesRegex(scoped.ScopedError,'RECEIVER_BASELINE_NOT_REVIEWED'):self.plan(r)
        self.assertEqual(r.puts,[])
    def test_stamps_alone_do_not_make_the_original_ingest_compatible(self):
        r=self.runtime()
        stamps=("const COMMERCIAL_PROCESSOR_RELEASE='"+fixtures.PROCESSOR_RELEASE+"';\nconst COMMERCIAL_PROCESSOR_CODE_SHA256='"+fixtures.CODE_HASH+"';\n").encode()
        r.bundle=scoped.replace_part(r.bundle,'commercial-reception.mjs',stamps+LEGACY)
        with self.assertRaisesRegex(scoped.ScopedError,'INGEST_RECEIVER_INCOMPATIBLE'):r.client().check_ingest(TEMPLATE)
        self.assertEqual(r.puts,[])
    def test_unreviewed_target_or_bad_identity_is_rejected_before_capture(self):
        for text,release,code in [(TEMPLATE+'//changed',fixtures.PROCESSOR_RELEASE,fixtures.CODE_HASH),
            (TEMPLATE,'not-a-commit',fixtures.CODE_HASH),(TEMPLATE,fixtures.PROCESSOR_RELEASE,'not-a-hash')]:
            r=self.runtime()
            with self.assertRaises(scoped.ScopedError):r.client().plan_receiver(text,release,code)
            self.assertEqual(r.calls,[])
    def test_concurrent_bundle_or_settings_change_aborts_planning(self):
        for kind in ('bundle','settings'):
            r=self.runtime()
            if kind=='bundle':
                def change(runtime):
                    if runtime.bundle_reads==2:runtime.bundle=scoped.replace_part(runtime.bundle,'central-data.mjs',fixtures.module_json(fixtures.source('b',2)))
                r.on_bundle_read=change
            else:
                def change(runtime):
                    if runtime.settings_reads==2:runtime.settings['compatibility_date']='2026-11-01'
                r.on_settings_read=change
            with self.assertRaisesRegex(scoped.ScopedError,'INSPECT_RUNTIME_CHANGED'):self.plan(r)
            self.assertEqual(r.puts,[])
    def test_inverse_reconstructs_every_original_byte_without_provider_write(self):
        r=self.runtime();plan,_=self.plan(r)
        restored=scoped.receiver_rollback_candidate(plan,plan.after,copy.deepcopy(r.settings))
        self.assertTrue(scoped.same_bundle(restored,plan.before));self.assertEqual(r.puts,[])
    def test_inverse_preserves_original_mime_and_recomputes_content_length(self):
        r=self.runtime();r.bundle=scoped.Bundle(r.bundle.entrypoint,tuple(
            scoped.replace(p,headers=(('Content-Length',str(len(p.body))),('X-Original','preserve'))) if p.name=='commercial-reception.mjs' else p for p in r.bundle.parts))
        plan,_=self.plan(r);receiver=fixtures.get_part(plan.after,'commercial-reception.mjs')
        self.assertEqual(dict(receiver.headers)['Content-Length'],str(len(receiver.body)))
        self.assertEqual(dict(receiver.headers)['X-Original'],'preserve')
        self.assertTrue(scoped.same_bundle(scoped.receiver_rollback_candidate(plan,plan.after,r.settings),plan.before))
    def test_inverse_refuses_any_runtime_or_permission_drift(self):
        r=self.runtime();plan,_=self.plan(r)
        changed=scoped.Bundle(plan.after.entrypoint,tuple(scoped.replace(p,body=b'concurrent Alex') if p.name=='alex.mjs' else p for p in plan.after.parts))
        settings=copy.deepcopy(r.settings);settings['bindings'].append({'name':'future','type':'secret_text'})
        for bundle,configuration in [(changed,r.settings),(plan.before,r.settings),(plan.after,settings)]:
            with self.assertRaisesRegex(scoped.ScopedError,'RECEIVER_ROLLBACK_RUNTIME_CHANGED'):
                scoped.receiver_rollback_candidate(plan,bundle,configuration)
        self.assertEqual(r.puts,[])
    def test_cli_plans_with_flags_closed_and_emits_no_private_capture(self):
        r=self.runtime();client=r.client()
        client.bootstrap=lambda *args: self.fail('bootstrap must not execute')
        client.ingest=lambda *args,**kwargs:self.fail('ingest must not execute')
        client.authorize=lambda:self.fail('write promotion must not execute')
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'activar-cloud.json').write_text('{"activar":false,"datahub_scoped_content_enabled":false}')
            (root/'commercial-reception.mjs').write_text(TEMPLATE)
            environment=fixtures.CLIPromotionContract().environment();environment['GITHUB_OUTPUT']=str(root/'output')
            output=io.StringIO()
            with patch.object(scoped,'ROOT',root),patch.dict(os.environ,environment,clear=True),patch.object(sys,'argv',['scoped_content.py','--plan-receiver']),patch.object(scoped,'public_code_hash',return_value=fixtures.CODE_HASH),patch.object(scoped,'require_latest_promotion',side_effect=AssertionError('promotion')),patch.object(scoped,'CFClient',return_value=r),patch.object(scoped,'ScopedDeployer',return_value=client),contextlib.redirect_stdout(output):
                scoped.main()
            report=json.loads(output.getvalue().splitlines()[0]);self.assertEqual(report['worker_puts'],0)
            self.assertFalse(report['ready']);self.assertNotIn(fixtures.PRIVATE,output.getvalue())
            self.assertIn('ready=false',(root/'output').read_text());self.assertEqual(r.puts,[])
            annotation=next(line for line in output.getvalue().splitlines() if line.startswith('::notice title=DataHub receptor plan::'))
            evidence=json.loads(annotation.split('::',2)[2])
            self.assertFalse(evidence['ready']);self.assertFalse(evidence['deployment_authorized'])
            self.assertEqual(evidence['worker_puts'],0);self.assertTrue(evidence['settings_preserved'])
            self.assertTrue(evidence['unowned_modules_preserved']);self.assertTrue(evidence['source_preserved'])
            self.assertNotIn('runtime_release',evidence)
    def test_original_workflow_calls_one_installation_with_disabled_commercial_steps(self):
        text=(ROOT.parent/'.github/workflows/central-593.yml').read_text()
        self.assertEqual(text.count('run: python automatizacion/scoped_content.py --install-receiver'),1)
        self.assertNotIn('scoped_content.py --bootstrap',text)
        self.assertNotIn('scoped_content.py --check-ingest',text)
        self.assertIn("if: false && steps.scoped_mode.outputs.authorized == 'true' && steps.receiver.outputs.ready == 'true'",text)
        self.assertEqual(text.count("if: steps.reporte.outputs.ready == 'true'"),4)
        self.assertIn('environment: conectatech-piloto-gratis',text)
        self.assertIn('permissions:\n  contents: read',text)
    def test_closing_without_reservation_never_calls_private_request(self):
        import processing_lease
        with tempfile.TemporaryDirectory() as folder,patch.dict(os.environ,{'RUNNER_TEMP':folder,'GITHUB_RUN_ID':'offline-plan','GITHUB_RUN_ATTEMPT':'1'}):
            def forbidden(*args,**kwargs):self.fail('no lease: HTTP is forbidden')
            self.assertIsNone(processing_lease.finish(forbidden,'release'))
    def test_precise_diagnostic_distinguishes_each_missing_or_unrecognized_stamp(self):
        release="const COMMERCIAL_PROCESSOR_RELEASE='"+fixtures.PROCESSOR_RELEASE+"';"
        code="const COMMERCIAL_PROCESSOR_CODE_SHA256='"+fixtures.CODE_HASH+"';"
        for body,states in [(b'export const old=true;','ABSENT_CODE_ABSENT'),(release.encode(),'VALID_CODE_ABSENT'),
            (code.encode(),'ABSENT_CODE_VALID'),(b'const COMMERCIAL_PROCESSOR_RELEASE="unknown";','UNRECOGNIZED_CODE_ABSENT')]:
            r=self.runtime();r.bundle=scoped.replace_part(r.bundle,'commercial-reception.mjs',body)
            with self.assertRaisesRegex(scoped.ScopedError,'INGEST_RECEIVER_STAMPS_REQUIRED_RELEASE_'+states):r.client().check_ingest(TEMPLATE)
            self.assertEqual(r.puts,[])

if __name__=='__main__':unittest.main()
