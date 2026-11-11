"""Offline receiver compatibility and ingest-only contracts; no real credentials."""
import contextlib,copy,io,json,os,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import scoped_content as scoped
import process_pending_593 as processor
import scoped_content_test as fixtures

class ReceiverContract(unittest.TestCase):
    def runtime(self):
        r=fixtures.Runtime(processor_release=fixtures.PROCESSOR_RELEASE)
        rendered=fixtures.CODE_TEMPLATE.replace(scoped.PLACEHOLDER,fixtures.PROCESSOR_RELEASE).replace(scoped.CODE_PLACEHOLDER,fixtures.CODE_HASH).encode()
        r.bundle=scoped.replace_part(r.bundle,'commercial-reception.mjs',rendered)
        r.original_bundle=copy.deepcopy(r.bundle)
        r.on_private_read=lambda runtime,path:dict(processor_release=fixtures.PROCESSOR_RELEASE,processor_code_sha256=fixtures.CODE_HASH) if path=='/commercial/catalog/status' else None
        return r
    def test_compatible_receiver_is_read_only_even_with_historical_package_stamp(self):
        r=self.runtime();result=r.client().check_ingest(fixtures.CODE_TEMPLATE)
        self.assertTrue(result['ready']);self.assertTrue(result['read_only']);self.assertEqual(result['worker_puts'],0)
        self.assertEqual(r.puts,[]);self.assertEqual(result['processor_release'],fixtures.PROCESSOR_RELEASE)
        self.assertNotIn(fixtures.PRIVATE,json.dumps(result))
    def test_different_receiver_bytes_block_without_bootstrap(self):
        r=self.runtime();r.bundle=scoped.replace_part(r.bundle,'commercial-reception.mjs',fixtures.get_part(r.bundle,'commercial-reception.mjs').body+b'//different')
        with self.assertRaisesRegex(scoped.ScopedError,'INGEST_RECEIVER_INCOMPATIBLE'):r.client().check_ingest(fixtures.CODE_TEMPLATE)
        self.assertEqual(r.puts,[])
    def test_missing_code_stamp_blocks_without_write(self):
        r=fixtures.Runtime()
        with self.assertRaisesRegex(scoped.ScopedError,'INGEST_RECEIVER_STAMPS_REQUIRED'):r.client().check_ingest(fixtures.CODE_TEMPLATE)
        self.assertEqual(r.puts,[])
    def test_status_does_not_match_bundle_blocks(self):
        r=self.runtime();r.on_private_read=lambda runtime,path:dict(processor_release='f'*40,processor_code_sha256=fixtures.CODE_HASH) if path=='/commercial/catalog/status' else None
        with self.assertRaisesRegex(scoped.ScopedError,'INGEST_RECEIVER_STATUS_MISMATCH'):r.client().check_ingest(fixtures.CODE_TEMPLATE)
        self.assertEqual(r.puts,[])
    def test_concurrent_bundle_change_aborts_read_only_check(self):
        r=self.runtime()
        def change(runtime):
            if runtime.bundle_reads==2:runtime.bundle=scoped.Bundle(runtime.bundle.entrypoint,tuple(scoped.replace(p,body=b'changed') if p.name=='alex.mjs' else p for p in runtime.bundle.parts))
        r.on_bundle_read=change
        with self.assertRaisesRegex(scoped.ScopedError,'INSPECT_RUNTIME_CHANGED'):r.client().check_ingest(fixtures.CODE_TEMPLATE)
        self.assertEqual(r.puts,[])
    def test_ingest_rechecks_receiver_and_changes_only_source_once(self):
        r=self.runtime();result=r.client().ingest(fixtures.source('b',2),'b'*64,fixtures.lease(),fixtures.PROCESSOR_RELEASE,receiver_text=fixtures.CODE_TEMPLATE)
        self.assertEqual(result['worker_puts'],1);self.assertEqual(len(r.puts),1)
        for before in r.original_bundle.parts:
            if before.name!='central-data.mjs':self.assertEqual(before,fixtures.get_part(r.puts[0],before.name))
    def test_ingest_incompatible_receiver_blocks_before_put(self):
        r=self.runtime()
        with self.assertRaisesRegex(scoped.ScopedError,'INGEST_RECEIVER_INCOMPATIBLE'):
            r.client().ingest(fixtures.source('b',2),'b'*64,fixtures.lease(),fixtures.PROCESSOR_RELEASE,receiver_text=fixtures.CODE_TEMPLATE+'//new')
        self.assertEqual(r.puts,[])
    def test_expired_update_is_not_rejuvenated(self):
        r=self.runtime();client=r.client();client.now=fixtures.NOW.replace(day=5)
        with self.assertRaisesRegex(scoped.ScopedError,'SOURCE_UPDATE_EXPIRED'):
            client.ingest(fixtures.source('b',2),'b'*64,fixtures.lease(),fixtures.PROCESSOR_RELEASE,receiver_text=fixtures.CODE_TEMPLATE)
        self.assertEqual(r.puts,[])
    def test_unauthorized_pending_sha_is_rejected_before_claim(self):
        calls=[]
        def request(path,body=None):
            calls.append((path,body));return contextlib.closing(io.BytesIO(json.dumps({'pending':True,'file_sha256':'a'*64}).encode()))
        with patch.dict(os.environ,{'GITHUB_REF':scoped.BRANCH,'CENTRAL_AUTHORIZED_SOURCE_SHA256':'b'*64}),patch.object(processor,'request',request):
            with self.assertRaisesRegex(ValueError,'SOURCE_NOT_AUTHORIZED'):processor.main()
        self.assertEqual(calls,[('/commercial/status',None)])
    def test_workflow_remains_original_and_closed_with_no_bootstrap_or_synthetic_upload(self):
        root=Path(__file__).resolve().parents[2];text=(root/'.github/workflows/central-593.yml').read_text()
        config=json.loads((root/'automatizacion/activar-cloud.json').read_text())
        self.assertIs(config['datahub_scoped_content_enabled'],False);self.assertIs(config['activar'],False)
        self.assertNotIn('scoped_content.py --bootstrap',text);self.assertIn('scoped_content.py --check-ingest',text)
        self.assertNotIn('run: node automatizacion/central-e2e.mjs',text)
        self.assertIn('CENTRAL_AUTHORIZED_SOURCE_SHA256:',text)
        self.assertIn("steps.scoped_mode.outputs.authorized == 'true' && steps.receiver.outputs.ready == 'true'",text)
        self.assertIn('  push:',text);self.assertNotIn('workflow_dispatch:',text)
    def test_closed_read_only_cli_emits_only_safe_annotation_and_never_puts(self):
        r=self.runtime()
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'activar-cloud.json').write_text('{"activar":false,"datahub_scoped_content_enabled":false}')
            (root/'commercial-reception.mjs').write_text(fixtures.CODE_TEMPLATE)
            output=io.StringIO()
            with patch.object(scoped,'ROOT',root),patch.dict(os.environ,fixtures.CLIPromotionContract().environment(),clear=True),patch.object(sys,'argv',['scoped_content.py','--check-ingest']),patch.object(scoped,'CFClient',return_value=r),patch.object(scoped,'ScopedDeployer',return_value=r.client()),contextlib.redirect_stdout(output):
                scoped.main()
            line=next(x for x in output.getvalue().splitlines() if x.startswith('::notice'))
            receipt=json.loads(line.split('::',2)[2])
            self.assertEqual(receipt['worker_puts'],0);self.assertTrue(receipt['read_only'])
            self.assertEqual(receipt['processor_release'],fixtures.PROCESSOR_RELEASE)
            self.assertNotIn(fixtures.PRIVATE,line);self.assertEqual(r.puts,[])

if __name__=='__main__':unittest.main()
