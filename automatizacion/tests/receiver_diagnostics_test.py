"""Historical evidence and synthetic failure scenarios only; no remote execution."""
import contextlib,copy,io,json,os,subprocess,sys,tempfile,types,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import scoped_content as scoped
import scoped_content_test as fixtures
import receiver_install_test as install_fixtures
from receiver_plan_test import TEMPLATE

HISTORICAL='d8725238f620e2a78c4328e8547031d2911d97d2'

def legacy_status(source):
    return {'schema':source['schema'],'source_sha256':source['source']['sha256'],
        'cut_date':source['source']['cut_date'],'generated_at':source['source']['generated_at'],
        'normalized_at':source['normalized_at'],'published_at':source.get('published_at'),
        'expires_at':source['expires_at'],'current':False,'products':len(source['products']),
        'blocked':sum(p['availability']=='blocked' for p in source['products'])}

class Diagnostics(unittest.TestCase):
    def runtime(self):return install_fixtures.Installation().runtime()
    def install(self,r):return r.client().install_receiver(TEMPLATE)
    def failure(self,report,phase,code):
        self.assertEqual(report['initial_failure']['phase'],phase)
        self.assertEqual(report['initial_failure']['code'],code)
        self.assertFalse(report['ok_installation']);self.assertFalse(report['ready'])
        self.assertFalse(report['ingest_ready']);self.assertNotIn(fixtures.PRIVATE,json.dumps(report))
    def stale_http(self,r,reads):
        original=r.on_private_read;seen=[]
        def status(runtime,path):
            if path=='/commercial/catalog/status':
                seen.append(True)
                if len(seen)<=reads:return legacy_status(runtime.original_source)
            return original(runtime,path)
        r.on_private_read=status
        return seen
    def test_historical_aggregate_cannot_distinguish_three_different_initial_errors(self):
        # Execute only public Python from the exact failed commit, against RAM fixtures.
        name='_historical_scoped_receiver';old=types.ModuleType(name)
        old.__file__=scoped.__file__;sys.modules[name]=old
        try:
            source=subprocess.check_output(['git','show',HISTORICAL+':automatizacion/scoped_content.py'],cwd=Path(scoped.__file__).resolve().parents[1])
            exec(compile(source,old.__file__,'exec'),old.__dict__)
            reports=[]
            for fault in ('write_response','postcheck_stamps','http_stale'):
                r=self.runtime()
                if fault=='write_response':
                    original=r.put_bundle;calls=[]
                    def put(bundle):
                        result=original(bundle);calls.append(True)
                        if len(calls)==1:raise old.ScopedError('CF_HTTP_502')
                        return result
                    r.put_bundle=put
                elif fault=='postcheck_stamps':install_fixtures.Installation().fail_postcheck(r)
                else:self.stale_http(r,1)
                client=old.ScopedDeployer(r,r.private_get,sleep=r.waits.append,now=fixtures.NOW)
                report=client.install_receiver(TEMPLATE);reports.append(report)
                self.assertEqual(report['status'],'BLOCKED_RECOVERED')
                self.assertTrue(scoped.same_bundle(r.bundle,r.original_bundle))
            self.assertEqual(reports[0],reports[1])
            self.assertEqual(reports[1],reports[2])
            self.assertNotIn('initial_failure',reports[0])
        finally:sys.modules.pop(name,None)
    def test_write_rejection_before_application_records_code_and_never_recovers_or_retries(self):
        r=self.runtime();attempts=[]
        def reject(bundle):attempts.append(True);raise scoped.ScopedError('CF_HTTP_403')
        r.put_bundle=reject;report=self.install(r)
        self.failure(report,'installation_write','CF_HTTP_403')
        self.assertEqual(report['status'],'BLOCKED_INSTALL_UNCONFIRMED')
        self.assertEqual(len(attempts),1);self.assertEqual(report['recovery_puts'],0)
        self.assertIsNone(report['recovery_failure'])
    def test_write_response_loss_after_application_keeps_initial_error_after_exact_recovery(self):
        r=self.runtime();original=r.put_bundle;calls=[]
        def put(bundle):
            result=original(bundle);calls.append(True)
            if len(calls)==1:raise scoped.ScopedError('CF_HTTP_502; response withheld')
            return result
        r.put_bundle=put;report=self.install(r)
        self.failure(report,'installation_write','CF_HTTP_502')
        self.assertEqual(report['status'],'BLOCKED_RECOVERED');self.assertEqual(len(calls),2)
        self.assertIsNone(report['recovery_failure']);self.assertTrue(scoped.same_bundle(r.bundle,r.original_bundle))
    def test_bundle_propagation_timeout_is_distinct_from_http_stamps(self):
        r=self.runtime();r.provider_lag=99;report=self.install(r)
        self.failure(report,'bundle_propagation','SCOPED_PROPAGATION_FAILED')
        self.assertEqual(report['installation_puts'],1);self.assertEqual(report['recovery_puts'],0)
        self.assertEqual(r.waits,[2]*11)
    def test_verified_legacy_http_lag_uses_existing_read_budget_with_one_put(self):
        r=self.runtime();seen=self.stale_http(r,2);report=self.install(r)
        self.assertTrue(report['ok_installation']);self.assertEqual((report['installation_puts'],report['recovery_puts']),(1,0))
        self.assertEqual(r.waits,[2,2]);self.assertGreaterEqual(len(seen),3)
        self.assertIsNone(report['initial_failure']);self.assertIsNone(report['recovery_failure'])
    def test_mixed_bundle_and_http_lag_share_twelve_reads_not_two_independent_budgets(self):
        r=self.runtime();r.provider_lag=5;self.stale_http(r,6);report=self.install(r)
        self.assertTrue(report['ok_installation']);self.assertEqual(r.waits,[2]*11);self.assertEqual(len(r.puts),1)
    def test_persistent_legacy_http_timeout_recovers_and_retains_absent_stamp_states(self):
        r=self.runtime();self.stale_http(r,99);report=self.install(r)
        self.failure(report,'http_propagation','RECEIVER_HTTP_PROPAGATION_TIMEOUT')
        self.assertEqual(report['initial_failure']['release_state'],'absent')
        self.assertEqual(report['initial_failure']['code_state'],'absent')
        self.assertEqual((report['installation_puts'],report['recovery_puts']),(1,1))
        self.assertEqual(r.waits,[2]*11);self.assertTrue(scoped.same_bundle(r.bundle,r.original_bundle))
    def test_absent_stamps_with_foreign_metadata_are_never_treated_as_propagation(self):
        for edit in ({'source_sha256':'f'*64},{'extra':fixtures.PRIVATE},{'current':'false'},{'current':True}):
            r=self.runtime();original=r.on_private_read
            def status(runtime,path):
                if path=='/commercial/catalog/status':return {**legacy_status(runtime.original_source),**edit}
                return original(runtime,path)
            r.on_private_read=status;report=self.install(r)
            self.failure(report,'receiver_http_stamps','PROCESSOR_RELEASE_NOT_VERIFIED')
            self.assertEqual(r.waits,[]);self.assertEqual(report['recovery_puts'],1)
    def test_wrong_release_code_or_incomplete_marks_fail_without_waiting(self):
        for edit,code,state,key in [({'processor_release':'f'*40},'PROCESSOR_RELEASE_NOT_VERIFIED','mismatch','release_state'),
            ({'processor_code_sha256':'f'*64},'PROCESSOR_CODE_NOT_VERIFIED','mismatch','code_state'),
            ({'processor_code_sha256':None},'PROCESSOR_CODE_NOT_VERIFIED','absent','code_state'),
            ({'processor_code_sha256':fixtures.PRIVATE},'PROCESSOR_CODE_NOT_VERIFIED','invalid','code_state')]:
            r=self.runtime();original=r.on_private_read
            def status(runtime,path):
                value=original(runtime,path)
                return {**value,**edit} if path=='/commercial/catalog/status' else value
            r.on_private_read=status;report=self.install(r)
            self.failure(report,'receiver_http_stamps',code)
            self.assertEqual(report['initial_failure'][key],state);self.assertEqual(r.waits,[])
    def test_later_read_only_stamps_failure_keeps_initial_phase_after_recovery(self):
        r=self.runtime();install_fixtures.Installation().fail_postcheck(r);report=self.install(r)
        self.failure(report,'postcheck_http_stamps','INGEST_RECEIVER_STATUS_MISMATCH')
        self.assertEqual(report['initial_failure']['release_state'],'mismatch')
        self.assertEqual(report['initial_failure']['code_state'],'mismatch')
        self.assertIsNone(report['recovery_failure']);self.assertEqual(report['status'],'BLOCKED_RECOVERED')
    def test_postcheck_capture_failure_is_separate_from_the_write(self):
        r=self.runtime();client=r.client();capture=client.capture;calls=[]
        def fault():
            calls.append(True)
            if len(calls)==3:raise scoped.ScopedError('BUNDLED_AND_HTTP_SOURCE_DIFFER')
            return capture()
        client.capture=fault;report=client.install_receiver(TEMPLATE)
        self.failure(report,'postcheck_capture','BUNDLED_AND_HTTP_SOURCE_DIFFER')
        self.assertEqual(report['status'],'BLOCKED_RECOVERED')
    def test_unexpected_receiver_bytes_stop_recovery_and_preserve_both_errors(self):
        r=self.runtime();client=r.client();check=client.check_ingest
        def changed(text,diagnostic=None):
            body=fixtures.get_part(r.bundle,'commercial-reception.mjs').body+b'//concurrent'
            r.bundle=scoped.replace_part(r.bundle,'commercial-reception.mjs',body)
            return check(text,diagnostic)
        client.check_ingest=changed;report=client.install_receiver(TEMPLATE)
        self.failure(report,'receiver_body','INGEST_RECEIVER_INCOMPATIBLE')
        self.assertEqual(report['recovery_failure'],{'phase':'recovery_precheck','code':'RECEIVER_ROLLBACK_RUNTIME_CHANGED'})
        self.assertEqual(report['recovery_puts'],0);self.assertIsNone(report['unowned_modules_preserved'])
    def test_missing_bundle_stamp_is_distinct_from_http_propagation(self):
        r=self.runtime();client=r.client();check=client.check_ingest
        def changed(text,diagnostic=None):
            body=fixtures.get_part(r.bundle,'commercial-reception.mjs').body
            body=body.replace(("const COMMERCIAL_PROCESSOR_RELEASE='"+scoped.APPROVED_RECEIVER_RELEASE+"';").encode(),b'')
            r.bundle=scoped.replace_part(r.bundle,'commercial-reception.mjs',body)
            return check(text,diagnostic)
        client.check_ingest=changed;report=client.install_receiver(TEMPLATE)
        self.failure(report,'receiver_bundle_stamps','INGEST_RECEIVER_STAMPS_REQUIRED_RELEASE_UNRECOGNIZED_CODE_VALID')
        self.assertEqual(report['recovery_puts'],0)
    def test_final_fence_failure_is_recorded_before_a_safe_recovery(self):
        r=self.runtime();client=r.client();check=client.check_ingest;fence=client.check_before_put;pending=[]
        def checked(text,diagnostic=None):
            result=check(text,diagnostic);pending.append(True);return result
        def failed_fence(capture):
            if pending:pending.clear();raise scoped.ScopedError('SOURCE_CHANGED_BEFORE_PUT')
            return fence(capture)
        client.check_ingest=checked;client.check_before_put=failed_fence
        report=client.install_receiver(TEMPLATE)
        self.failure(report,'post_install_fence','SOURCE_CHANGED_BEFORE_PUT')
        self.assertEqual(report['status'],'BLOCKED_RECOVERED')
    def test_recovery_write_failure_does_not_replace_the_initial_error(self):
        r=self.runtime();install_fixtures.Installation().fail_postcheck(r);put=r.put_bundle;calls=[]
        def fault(bundle):
            calls.append(True)
            if len(calls)==2:raise scoped.ScopedError('CF_HTTP_503; '+fixtures.PRIVATE)
            return put(bundle)
        r.put_bundle=fault;report=self.install(r)
        self.failure(report,'postcheck_http_stamps','INGEST_RECEIVER_STATUS_MISMATCH')
        self.assertEqual(report['recovery_failure'],{'phase':'recovery_write','code':'CF_HTTP_503'})
        self.assertEqual(len(calls),2);self.assertIsNone(report['source_preserved'])
    def test_recovery_verification_failure_is_separate_from_initial_and_recovery_write(self):
        r=self.runtime();install_fixtures.Installation().fail_postcheck(r);original=r.on_private_read
        def changed(runtime,path):
            if len(runtime.puts)>1 and path=='/health':
                return {'ok':True,'pilot':True,'release':'f'*40,'meta_ingress_enabled':False,'messenger_outbound':True}
            return original(runtime,path)
        r.on_private_read=changed;report=self.install(r)
        self.failure(report,'postcheck_http_stamps','INGEST_RECEIVER_STATUS_MISMATCH')
        self.assertEqual(report['recovery_failure'],{'phase':'recovery_verify','code':'SOURCE_RELEASE_CHANGED'})
        self.assertEqual((report['installation_puts'],report['recovery_puts']),(1,1))
    def test_failure_before_put_retains_a_safe_phase_and_has_zero_mutations(self):
        r=self.runtime();client=r.client();calls=[]
        def revoke():
            calls.append(True)
            if len(calls)==2:raise scoped.ScopedError('RECEIVER_INSTALLATION_NOT_AUTHORIZED')
        client.authorize=revoke
        with self.assertRaises(scoped.ScopedError) as caught:client.install_receiver(TEMPLATE)
        self.assertEqual(scoped.installation_error_diagnostic(caught.exception),
            {'phase':'pre_write_check','code':'RECEIVER_INSTALLATION_NOT_AUTHORIZED'})
        self.assertEqual(r.puts,[])
    def test_unknown_private_error_text_context_and_all_caps_never_enter_receipt(self):
        for error in [scoped.ScopedError(fixtures.PRIVATE),ValueError(fixtures.PRIVATE),RuntimeError(fixtures.PRIVATE),
            scoped.ScopedError('https://private.invalid/?token='+fixtures.PRIVATE)]:
            r=self.runtime();attempts=[]
            def fail(bundle):attempts.append(True);raise error
            r.put_bundle=fail;report=self.install(r)
            self.failure(report,'installation_write','SCOPED_CONTENT_FAILED')
            self.assertEqual(len(attempts),1);self.assertNotIn('private.invalid',json.dumps(report))
    def test_cli_annotation_keeps_both_safe_failures_without_reclassifying_terminal_status(self):
        r=self.runtime();install_fixtures.Installation().fail_postcheck(r)
        put=r.put_bundle;calls=[];output=io.StringIO()
        def fault(bundle):
            calls.append(True)
            if len(calls)==2:raise scoped.ScopedError('CF_HTTP_503; '+fixtures.PRIVATE)
            return put(bundle)
        r.put_bundle=fault
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'activar-cloud.json').write_text('{"activar":false,"datahub_scoped_content_enabled":false}')
            environment=fixtures.CLIPromotionContract().environment()
            with patch.object(scoped,'ROOT',root),patch.dict(os.environ,environment,clear=True),patch.object(sys,'argv',['scoped_content.py','--install-receiver']),patch.object(scoped,'require_receiver_installation'),patch.object(scoped,'CFClient',return_value=r),patch.object(scoped,'ScopedDeployer',return_value=r.client()),patch.object(scoped,'approved_receiver_artifacts',return_value=TEMPLATE),contextlib.redirect_stdout(output):
                with self.assertRaises(scoped.ScopedError) as caught:scoped.main()
        line=next(x for x in output.getvalue().splitlines() if x.startswith('::notice title=DataHub receptor instalacion::'))
        record=json.loads(line.split('::',2)[2])
        self.assertEqual(record['initial_failure']['code'],'INGEST_RECEIVER_STATUS_MISMATCH')
        self.assertEqual(record['recovery_failure']['code'],'CF_HTTP_503')
        self.assertIsNone(scoped.installation_error_diagnostic(caught.exception))
        self.assertNotIn(fixtures.PRIVATE,output.getvalue())
    def test_outer_failure_formatter_filters_injected_fields_and_unknown_codes(self):
        error=scoped.ScopedError(fixtures.PRIVATE)
        error.receiver_failure={'phase':fixtures.PRIVATE,'code':fixtures.PRIVATE,
            'release_state':fixtures.PRIVATE,'body':fixtures.PRIVATE}
        self.assertEqual(scoped.installation_error_diagnostic(error),{'phase':'unknown','code':'SCOPED_CONTENT_FAILED'})
        self.assertEqual(scoped.receiver_error_code(scoped.ScopedError('CF_HTTP_403; '+fixtures.PRIVATE)),'CF_HTTP_403')

if __name__=='__main__':unittest.main()
