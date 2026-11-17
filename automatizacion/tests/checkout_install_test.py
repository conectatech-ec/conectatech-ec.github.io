"""New installation controls only. Every provider operation is a RAM fake."""
import json,subprocess,sys,unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import Mock
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import install_checkout as m

class Installation(unittest.TestCase):
    def setUp(self):
        self.manifest,self.artifacts=m.approved_artifacts()
        self.before=m.Bundle('worker.mjs',tuple(m.Part(n,n,'application/javascript+module',
            (m.ROOT/'revision-checkout/base-activa'/n).read_bytes())
            for n in ['worker.mjs','messenger-store.mjs'])+(m.Part('central-data.mjs','central-data.mjs',
            'application/javascript+module',b'export default {"private":"synthetic-preserve"};\n'),
            m.Part('commercial-reception.mjs','commercial-reception.mjs','application/javascript+module',b'synthetic-unchanged')))
        self.after=m.prepare_bundle(self.before,self.manifest,self.artifacts)
        self.capture={'bundle':self.before,'settings':{'bindings':[]},'source':{},'health':{}}
        self.api=Mock();self.api.current=self.before;self.api.settings=self.capture['settings']
        self.api.get_bundle.side_effect=lambda:self.api.current
        self.api.get_settings.side_effect=lambda:self.api.settings
        def put(bundle):self.api.current=bundle;return {'provider_version_id':'a'*32}
        self.api.put_bundle.side_effect=put
        self.guard=Mock()

    def run_install(self,probe=lambda:None):
        return m.perform_install(self.api,self.guard,self.capture,self.after,authorize=lambda:None,probe=probe,sleep=lambda _:None)

    def test_exact_eight_module_delta_and_inverse_preserve_source_and_receiver(self):
        self.assertEqual(len(self.after.parts),len(self.before.parts)+6)
        self.assertTrue(m.same_bundle(m.rollback_candidate(self.before,self.after,self.after,{},{}),self.before))
        for part in self.before.parts:
            if part.name not in ('worker.mjs','messenger-store.mjs'):
                self.assertEqual(part,next(x for x in self.after.parts if x.name==part.name))
        self.assertIn(b'enabled: false',self.artifacts['checkout-config.mjs'])
        self.assertIn(b'deliveries: []',self.artifacts['checkout-config.mjs'])

    def test_unknown_live_base_stops_before_put(self):
        changed=m.Bundle(self.before.entrypoint,(replace(self.before.parts[0],body=self.before.parts[0].body+b'// drift'),*self.before.parts[1:]))
        with self.assertRaisesRegex(m.CheckoutError,'BASE_NOT_APPROVED'):m.prepare_bundle(changed,self.manifest,self.artifacts)
        self.api.put_bundle.assert_not_called()

    def test_only_authenticated_base_and_pinned_candidate_are_accepted(self):
        for name in ('worker.mjs','messenger-store.mjs'):
            expected=next(p for p in self.after.parts if p.name==name)
            self.assertEqual(m.sha(expected.body),m.PINNED_AFTER[name])
            self.assertEqual(m.KNOWN_BASES[name],{m.sha(next(p for p in self.before.parts if p.name==name).body)})
        damaged=json.loads(json.dumps(self.manifest))
        worker=next(x for x in damaged['runtime_modules'] if x['path']=='automatizacion/worker.mjs')
        worker['replacements'][0]['after']+='\n// unintended change'
        with self.assertRaisesRegex(m.CheckoutError,'CANDIDATE_NOT_PINNED'):
            m.prepare_bundle(self.before,damaged,self.artifacts)

    def test_success_has_exactly_one_installation_put_and_no_recovery(self):
        result=self.run_install()
        self.assertEqual(result['status'],'INSTALLED_VERIFIED')
        self.assertEqual(result['worker_puts'],{'installation':1,'recovery':0})
        self.api.put_bundle.assert_called_once_with(self.after)

    def test_pre_write_fence_failure_has_no_put(self):
        self.guard.check_before_put.side_effect=m.CheckoutError('CHECKOUT_TEST_CONCURRENT_CHANGE')
        with self.assertRaises(m.CheckoutError):self.run_install()
        self.api.put_bundle.assert_not_called()

    def test_lost_write_response_never_retries_installation_and_recovers_exactly(self):
        def lost(bundle):
            self.api.current=bundle
            if self.api.put_bundle.call_count==1:raise m.ScopedError('CF_HTTP_503')
            return {}
        self.api.put_bundle.side_effect=lost
        result=self.run_install()
        self.assertEqual(result['error'],'CF_HTTP_503')
        self.assertEqual(result['phase'],'installation_put')
        self.assertEqual(result['recovery'],'specific_inverse_verified')
        self.assertEqual(result['worker_puts'],{'installation':1,'recovery':1})
        self.assertEqual([c.args[0] for c in self.api.put_bundle.call_args_list],[self.after,self.before])

    def test_verification_failure_runs_only_specific_inverse_once(self):
        def failed():raise m.CheckoutError('CHECKOUT_CLOSURE_NOT_VERIFIED')
        result=self.run_install(failed)
        self.assertEqual(result['phase'],'post_install_verification')
        self.assertEqual(result['recovery'],'specific_inverse_verified')
        self.assertEqual(self.api.put_bundle.call_count,2)

    def test_concurrent_bundle_discrepancy_prevents_recovery_write(self):
        def changed(bundle):self.api.current=self.before;self.api.current=m.Bundle(bundle.entrypoint,(*bundle.parts,m.Part('foreign','foreign','text/plain',b'new-concurrent')))
        self.api.put_bundle.side_effect=changed
        result=self.run_install()
        self.assertEqual(result['recovery'],'blocked_no_further_writes')
        self.assertEqual(result['worker_puts'],{'installation':1,'recovery':0})

    def test_settings_discrepancy_prevents_recovery_write(self):
        def changed(bundle):self.api.current=bundle;self.api.settings={'bindings':['changed']}
        self.api.put_bundle.side_effect=changed
        result=self.run_install()
        self.assertEqual(result['recovery'],'blocked_no_further_writes')
        self.assertEqual(self.api.put_bundle.call_count,1)

    def test_original_bundle_after_rejected_put_requires_no_recovery(self):
        self.api.put_bundle.side_effect=m.ScopedError('CF_HTTP_403')
        result=self.run_install()
        self.assertEqual(result['error'],'CF_HTTP_403')
        self.assertEqual(result['recovery'],'not_needed_original_bundle_active')
        self.assertEqual(self.api.put_bundle.call_count,1)

    def test_cipher_roundtrip_and_tamper_rejection_never_prints_private_body(self):
        import os
        from unittest.mock import patch
        with patch.dict(os.environ,{'PILOT_TOKEN':'synthetic-only-not-a-real-secret'}):
            raw=json.dumps(m.pack_capture(self.capture))
            sealed=m.cipher(raw)
            self.assertNotIn('synthetic-preserve',sealed)
            self.assertEqual(m.cipher(sealed,True),raw)
            invalid=json.loads(sealed);invalid['cipher'][0]^=1
            with self.assertRaisesRegex(m.CheckoutError,'CIPHER_FAILED'):m.cipher(json.dumps(invalid),True)

    def test_original_workflow_skips_ingestion_for_installation_and_backup_precedes_put(self):
        text=(m.ROOT.parent/'.github/workflows/central-593.yml').read_text()
        old=text.split('  ingresar:',1)[1].split('  instalar_checkout_inactivo:',1)[0]
        self.assertIn("!contains(github.event.head_commit.message, '[checkout-install-388]')",old.split('steps:')[0])
        new=text.split('  instalar_checkout_inactivo:',1)[1]
        self.assertIn('github.run_attempt == 1',new)
        for denied in ['--ingest','--bootstrap','--install-receiver','processing_lease','deploy_free.py']:
            self.assertNotIn(denied,new)
        self.assertLess(new.index('checkout-pr388-respaldo-cifrado'),new.index('install_checkout.py --install'))
        self.assertIn('environment: conectatech-piloto-gratis',new)
        self.assertNotIn('workflow_dispatch:',text)

if __name__=='__main__':unittest.main()
