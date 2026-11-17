"""Only the new authenticated-read boundary and selective base adaptation."""
import json,sys,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import checkout_active_base as read
import install_checkout as install

class ActiveBase(unittest.TestCase):
    def setUp(self):
        self.manifest,self.entries=read.public_inputs()
        self.worker=next(x for x in self.entries if x['sha256']=='d16c5fe25fe0288a6835da8510b88c4239a18f6ff82979d24d018d335f15dc62')
        self.store=next(x for x in self.entries if x['sha256']=='07238457b4a0c272cb62db7389ff1eb042ee987df56900529c4705e2e2673cae')
        self.before=read.Bundle('worker.mjs',tuple(read.Part(x['name'],x['name'],'application/javascript+module',x['code'].encode())
            for x in [self.worker,self.store])+(read.Part('central-data.mjs','central-data.mjs','text/javascript',b'synthetic-private-source'),
            read.Part('commercial-reception.mjs','commercial-reception.mjs','text/javascript',b'synthetic-preserved-receiver')))

    def test_transport_rejects_every_write_before_provider_client(self):
        api=read.ReadOnlyCFClient('a'*32,'synthetic-token')
        with patch.object(read.CFClient,'request',return_value=(b'{}',{})) as network:
            for path,method in [(read.SCRIPT+'/content','PUT'),(read.SCRIPT+'/settings','POST'),(read.SCRIPT+'/content/v2','DELETE')]:
                with self.assertRaisesRegex(read.ReadError,'WRITES_FORBIDDEN'):api.request(path,method)
            with self.assertRaisesRegex(read.ReadError,'WRITES_FORBIDDEN'):api.put_bundle(self.before)
            network.assert_not_called()
            api.request(read.SCRIPT+'/settings')
            network.assert_called_once()

    def test_historical_selective_worker_is_identified_and_preserved_by_exact_inverse(self):
        proposal,modules,diffs=read.plan(self.before,self.manifest,self.entries)
        self.assertEqual(len(proposal['runtime_modules']),8)
        self.assertTrue(proposal['other_modules_preserved']);self.assertTrue(proposal['inverse_exact'])
        self.assertFalse(proposal['settings_changed'])
        worker=modules['worker.mjs']
        for existing in [b'renderBanner',b'routeSimulator(b)',b'alex-private-signature']:
            self.assertIn(existing,worker)
        self.assertNotIn(b'renderValidatedBanner',worker)
        self.assertIn(b'handleCheckoutPublic',worker)
        self.assertIn('renderValidatedBanner',diffs['worker.mjs'])
        self.assertEqual(diffs['messenger-store.mjs'],'')
        for item in self.manifest['runtime_modules']:
            if item['operation']=='add':self.assertEqual(read.sha(modules[Path(item['path']).name]),item['after_sha256'])

    def test_original_installer_rejection_reproduces_without_broadening_its_allowlist(self):
        manifest,artifacts=install.approved_artifacts()
        with self.assertRaisesRegex(install.CheckoutError,'LIVE_BASE_NOT_APPROVED'):
            install.prepare_bundle(self.before,manifest,artifacts)

    def test_unknown_private_body_is_not_exported_or_included_in_diagnostic(self):
        from dataclasses import replace
        first=replace(self.before.parts[0],body=self.before.parts[0].body+b'\nsynthetic-private-value')
        unknown=read.Bundle('worker.mjs',(first,*self.before.parts[1:]))
        with self.assertRaisesRegex(read.ReadError,'NOT_PUBLICLY_RECONSTRUCTED') as error:
            read.plan(unknown,self.manifest,self.entries)
        self.assertNotIn('synthetic-private-value',str(error.exception))

    def test_read_workflow_excludes_ingestion_and_installation_and_keeps_consumed_permission_closed(self):
        text=(read.ROOT.parent/'.github/workflows/central-593.yml').read_text()
        ingestion=text.split('  ingresar:',1)[1].split('steps:',1)[0]
        self.assertIn("!contains(github.event.head_commit.message, '[checkout-compare-388]')",ingestion)
        block=text.split('  conciliar_base_checkout_lectura:',1)[1]
        for forbidden in ['--install','--ingest','--bootstrap','install_checkout.py','processing_lease','deploy_free.py']:
            self.assertNotIn(forbidden,block)
        self.assertIn('environment: conectatech-piloto-gratis',block)
        self.assertIn("!contains(github.event.head_commit.message, '[checkout-install-388]')",block)
        old=json.loads((read.ROOT.parent/'.github/checkout-install-once.json').read_text())
        self.assertIs(old['enabled'],False);self.assertEqual(old['closed_after_run'],'43939141450')

if __name__=='__main__':unittest.main()
