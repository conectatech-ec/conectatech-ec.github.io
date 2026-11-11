"""One authorized receiver PUT and fenced recovery, entirely offline."""
import contextlib,copy,hashlib,io,json,os,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import Mock,patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import scoped_content as scoped
import scoped_content_test as fixtures
from receiver_plan_test import LEGACY,TEMPLATE

class Installation(unittest.TestCase):
    def runtime(self):
        r=fixtures.Runtime();r.bundle=scoped.replace_part(r.bundle,'commercial-reception.mjs',LEGACY)
        r.original_bundle=copy.deepcopy(r.bundle)
        def status(runtime,path):
            if path=='/commercial/catalog/status':
                return {'processor_release':scoped.processor_release_of(runtime.bundle),
                    'processor_code_sha256':scoped.processor_code_of(runtime.bundle)}
        r.on_private_read=status
        return r
    def install(self,r):return r.client().install_receiver(TEMPLATE)
    def test_installs_exact_approved_body_once_and_preserves_everything_else(self):
        r=self.runtime();before=copy.deepcopy(r.settings);client=r.client()
        client.bootstrap=Mock(side_effect=AssertionError('bootstrap forbidden'))
        client.ingest=Mock(side_effect=AssertionError('ingest forbidden'))
        report=client.install_receiver(TEMPLATE)
        self.assertTrue(report['ok_installation']);self.assertFalse(report['ready']);self.assertFalse(report['ingest_ready'])
        self.assertEqual((report['installation_puts'],report['recovery_puts']),(1,0));self.assertEqual(len(r.puts),1)
        self.assertTrue(report['check_ingest_satisfactory']);self.assertEqual(r.settings,before)
        body=fixtures.get_part(r.bundle,'commercial-reception.mjs').body
        self.assertEqual(hashlib.sha256(body).hexdigest(),scoped.APPROVED_RECEIVER_BODY)
        for part in r.original_bundle.parts:
            if part.name!='commercial-reception.mjs':self.assertEqual(part,fixtures.get_part(r.bundle,part.name))
        self.assertNotIn(fixtures.PRIVATE,json.dumps(report));self.assertEqual(r.waits,[])
        client.bootstrap.assert_not_called();client.ingest.assert_not_called()
    def test_approved_public_package_is_recovered_from_its_commit_not_current_installer(self):
        self.assertEqual(scoped.approved_receiver_artifacts(),TEMPLATE)
    def test_unknown_base_blocks_before_any_put(self):
        r=self.runtime();r.bundle=scoped.replace_part(r.bundle,'commercial-reception.mjs',LEGACY+b'//unknown')
        with self.assertRaisesRegex(scoped.ScopedError,'RECEIVER_BASELINE_NOT_REVIEWED'):self.install(r)
        self.assertEqual(r.puts,[])
    def test_a_second_installation_cannot_write_again(self):
        r=self.runtime();self.install(r)
        with self.assertRaisesRegex(scoped.ScopedError,'RECEIVER_BASELINE_NOT_REVIEWED'):self.install(r)
        self.assertEqual(len(r.puts),1)
    def test_free_bundle_budget_is_checked_before_any_put(self):
        r=self.runtime()
        with patch.object(scoped.gzip,'compress',return_value=b'x'*3_000_000):
            with self.assertRaisesRegex(scoped.ScopedError,'FREE_BUNDLE_BUDGET_EXCEEDED'):self.install(r)
        self.assertEqual(r.puts,[])
    def test_last_fence_after_authorization_detects_concurrent_code_before_put(self):
        r=self.runtime();client=r.client();calls=[]
        def authorize():
            calls.append(True)
            if len(calls)==2:r.bundle=scoped.Bundle(r.bundle.entrypoint,tuple(scoped.replace(p,body=b'parallel Alex') if p.name=='alex.mjs' else p for p in r.bundle.parts))
        client.authorize=authorize
        with self.assertRaisesRegex(scoped.ScopedError,'RUNTIME_CHANGED_BEFORE_PUT'):client.install_receiver(TEMPLATE)
        self.assertEqual(r.puts,[])
    def fail_postcheck(self,r,concurrent=False):
        original=r.on_private_read;calls=[]
        def status(runtime,path):
            if path=='/commercial/catalog/status':
                calls.append(True)
                if len(calls)>=2:
                    if concurrent:
                        runtime.bundle=scoped.Bundle(runtime.bundle.entrypoint,tuple(scoped.replace(p,body=b'concurrent change') if p.name=='alex.mjs' else p for p in runtime.bundle.parts))
                    return {'processor_release':'f'*40,'processor_code_sha256':'f'*64}
            return original(runtime,path)
        r.on_private_read=status
    def test_post_check_failure_recovers_only_exact_original_module_once(self):
        r=self.runtime();self.fail_postcheck(r);report=self.install(r)
        self.assertFalse(report['ok_installation']);self.assertEqual(report['status'],'BLOCKED_RECOVERED')
        self.assertEqual((report['installation_puts'],report['recovery_puts']),(1,1))
        self.assertTrue(scoped.same_bundle(r.bundle,r.original_bundle));self.assertTrue(report['original_receiver_restored'])
    def test_post_failure_with_concurrent_code_never_rolls_back(self):
        r=self.runtime();self.fail_postcheck(r,True);report=self.install(r)
        self.assertEqual(report['status'],'BLOCKED_RECOVERY_UNSAFE_OR_UNVERIFIED')
        self.assertEqual((report['installation_puts'],report['recovery_puts']),(1,0))
        self.assertEqual(fixtures.get_part(r.bundle,'alex.mjs').body,b'concurrent change')
    def test_changed_permissions_after_put_prevent_recovery(self):
        r=self.runtime();r.on_put=lambda runtime,_:runtime.settings['bindings'].append({'name':'concurrent','type':'secret_text'})
        report=self.install(r);self.assertFalse(report['ok_installation']);self.assertEqual(len(r.puts),1)
        self.assertEqual(report['recovery_puts'],0)
        self.assertIsNone(report['settings_preserved']);self.assertFalse(report['ok'])
    def test_source_or_messenger_drift_prevents_recovery(self):
        for path in ('/commercial/catalog','/messenger/seller/status'):
            r=self.runtime();original=r.on_private_read
            def changed(runtime,current_path):
                if runtime.puts and current_path==path:
                    if path=='/commercial/catalog':return fixtures.source('b',2)
                    return {'mode':'authorized-testers-only','enabled':False,'live_customers_enabled':False}
                return original(runtime,current_path)
            r.on_private_read=changed;report=self.install(r)
            self.assertFalse(report['ok']);self.assertEqual(report['recovery_puts'],0);self.assertEqual(len(r.puts),1)
    def test_revoked_authorization_prevents_recovery_put(self):
        r=self.runtime();self.fail_postcheck(r);client=r.client();calls=[]
        def authorize():
            calls.append(True)
            if len(calls)>2:raise scoped.ScopedError('REVOKED')
        client.authorize=authorize
        report=client.install_receiver(TEMPLATE);self.assertEqual(report['recovery_puts'],0);self.assertEqual(len(r.puts),1)
    def test_response_loss_after_application_can_recover_without_install_retry(self):
        r=self.runtime();original=r.put_bundle;calls=[]
        def put(bundle):
            result=original(bundle);calls.append(True)
            if len(calls)==1:raise scoped.ScopedError('RESPONSE_LOST')
            return result
        r.put_bundle=put;report=self.install(r)
        self.assertEqual(report['status'],'BLOCKED_RECOVERED');self.assertEqual(len(calls),2)
        self.assertTrue(scoped.same_bundle(r.bundle,r.original_bundle))
    def test_response_loss_without_provable_application_never_repeats_write(self):
        r=self.runtime();calls=[]
        def put(bundle):calls.append(True);raise scoped.ScopedError('RESPONSE_LOST')
        r.put_bundle=put;report=self.install(r)
        self.assertEqual(report['status'],'BLOCKED_INSTALL_UNCONFIRMED');self.assertEqual(len(calls),1)
        self.assertEqual(report['recovery_puts'],0)
    def test_read_propagation_polls_never_repeat_installation(self):
        r=self.runtime();r.provider_lag=2;report=self.install(r)
        self.assertTrue(report['ok_installation']);self.assertEqual(len(r.puts),1);self.assertEqual(len(r.waits),2)
    def test_recovery_response_loss_is_never_retried(self):
        r=self.runtime();self.fail_postcheck(r);original=r.put_bundle;calls=[]
        def put(bundle):
            calls.append(True)
            if len(calls)==2:raise scoped.ScopedError('RECOVERY_RESPONSE_LOST')
            return original(bundle)
        r.put_bundle=put;report=self.install(r)
        self.assertFalse(report['ok_installation']);self.assertEqual(len(calls),2);self.assertEqual(report['recovery_puts'],1)
    def test_cli_with_closed_flags_uses_only_scoped_installation_and_safe_evidence(self):
        r=self.runtime();environment=fixtures.CLIPromotionContract().environment();output=io.StringIO()
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'activar-cloud.json').write_text('{"activar":false,"datahub_scoped_content_enabled":false}')
            with patch.object(scoped,'ROOT',root),patch.dict(os.environ,environment,clear=True),patch.object(sys,'argv',['scoped_content.py','--install-receiver']),patch.object(scoped,'require_receiver_installation'),patch.object(scoped,'require_latest_promotion',side_effect=AssertionError('general write promotion forbidden')),patch.object(scoped,'CFClient',return_value=r),patch.object(scoped,'ScopedDeployer',return_value=r.client()),patch.object(scoped,'approved_receiver_artifacts',return_value=TEMPLATE),contextlib.redirect_stdout(output):
                scoped.main()
        annotation=next(line for line in output.getvalue().splitlines() if line.startswith('::notice title=DataHub receptor instalacion::'))
        report=json.loads(annotation.split('::',2)[2]);self.assertTrue(report['ok_installation'])
        self.assertEqual(report['worker_puts'],1);self.assertFalse(report['ready'])
        self.assertNotIn(fixtures.PRIVATE,output.getvalue())

class Authorization(unittest.TestCase):
    def environment(self):
        return {'GITHUB_REF':scoped.BRANCH,'GITHUB_SHA':'d'*40,'GITHUB_WORKFLOW_SHA':'d'*40,
            'GITHUB_WORKFLOW_REF':'conectatech-ec/conectatech-ec.github.io/.github/workflows/central-593.yml@'+scoped.BRANCH,
            'GITHUB_EVENT_NAME':'push','GITHUB_RUN_ATTEMPT':'1','CF_FREE_ONLY_CONFIRMED':'true',
            'CENTRAL_RECEIVER_INSTALL_AUTHORIZATION':scoped.RECEIVER_INSTALL_AUTHORIZATION}
    def config(self):return {'activar':False,'datahub_scoped_content_enabled':False,'sincronizar_meta_verify_token':False,'costo_maximo_usd':0}
    def test_exact_single_push_is_authorized_with_both_flags_closed(self):
        with patch.dict(os.environ,self.environment(),clear=True),patch.object(scoped.subprocess,'check_output',side_effect=['d'*40,scoped.APPROVED_RECEIVER_RELEASE]),patch.object(scoped,'read_latest_config',return_value=self.config()),patch.object(scoped,'require_latest_revision') as revision:
            scoped.require_receiver_installation();revision.assert_called_once_with('d'*40)
    def test_reruns_other_workflows_events_and_missing_free_attestation_are_denied(self):
        for key,value in [('GITHUB_RUN_ATTEMPT','2'),('GITHUB_EVENT_NAME','workflow_dispatch'),('GITHUB_REF','refs/heads/main'),('GITHUB_WORKFLOW_REF','another'),('GITHUB_WORKFLOW_SHA','f'*40),('CF_FREE_ONLY_CONFIRMED','false'),('CENTRAL_RECEIVER_INSTALL_AUTHORIZATION','')]:
            with patch.dict(os.environ,{**self.environment(),key:value},clear=True),patch.object(scoped,'read_latest_config') as network:
                with self.assertRaises(scoped.ScopedError):scoped.require_receiver_installation()
                network.assert_not_called()
    def test_later_commit_or_armed_ingestion_or_nonzero_cost_is_denied(self):
        for parent,config in [('f'*40,self.config()),(scoped.APPROVED_RECEIVER_RELEASE,{**self.config(),'datahub_scoped_content_enabled':True}),(scoped.APPROVED_RECEIVER_RELEASE,{**self.config(),'activar':True}),(scoped.APPROVED_RECEIVER_RELEASE,{**self.config(),'costo_maximo_usd':1})]:
            with patch.dict(os.environ,self.environment(),clear=True),patch.object(scoped.subprocess,'check_output',side_effect=['d'*40,parent]),patch.object(scoped,'read_latest_config',return_value=config),patch.object(scoped,'require_latest_revision'):
                with self.assertRaises(scoped.ScopedError):scoped.require_receiver_installation()

if __name__=='__main__':unittest.main()
