"""Synthetic live bundles only. No credentials, real catalog or network."""
import copy, importlib.util, json, sys, unittest
from pathlib import Path
from unittest.mock import Mock

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from scoped_content import Bundle,Part
from generic_receiver_guard import preserve_live_receiver
spec=importlib.util.spec_from_file_location('generic_overlay_deploy',ROOT/'deploy_free.py')
deploy=importlib.util.module_from_spec(spec);spec.loader.exec_module(deploy)

def bundle(receiver=b'export const legacyReceiver=true;',other=b'export const alex="fixture-only";'):
    parts=[Part('worker.mjs','worker.mjs','application/javascript+module',other)]
    if receiver is not None:parts.append(Part('commercial-reception.mjs','commercial-reception.mjs','text/javascript; charset=utf-8',receiver))
    return Bundle('worker.mjs',tuple(parts))

def files(receiver):
    return [('worker.mjs','application/javascript+module',b'authorized-generic-fixture'),
            ('commercial-reception.mjs','application/javascript+module',receiver)]

class GenericReceiverGuard(unittest.TestCase):
    def test_repository_v2_template_preserves_live_legacy_body_and_mime(self):
        live=bundle();client=Mock();client.get_bundle.return_value=live
        original=files(b"const COMMERCIAL_PROCESSOR_RELEASE='__COMMERCIAL_PROCESSOR_RELEASE__';")
        selected,verify=preserve_live_receiver(original,client)
        self.assertEqual(selected[0],original[0])
        self.assertEqual(selected[1],('commercial-reception.mjs',live.parts[1].content_type,live.parts[1].body))
        self.assertNotIn(b'__COMMERCIAL_PROCESSOR_RELEASE__',selected[1][2]);verify()

    def test_repository_sentinel_preserves_exact_live_rendered_processor(self):
        body=b"const COMMERCIAL_PROCESSOR_RELEASE='"+b'a'*40+b"';"
        live=bundle(body);client=Mock();client.get_bundle.return_value=live
        selected,verify=preserve_live_receiver(files(b'PRIVATE_FIXTURE_REPO_SENTINEL'),client)
        self.assertEqual(selected[1][2],body);self.assertEqual(selected[1][1],live.parts[1].content_type)
        self.assertNotIn(b'PRIVATE_FIXTURE_REPO_SENTINEL',selected[1][2]);verify()

    def test_missing_live_target_or_read_failure_aborts_before_any_write_without_values(self):
        for result in (bundle(None),RuntimeError('PRIVATE_FIXTURE_PROVIDER_BODY')):
            client=Mock();api=Mock()
            if isinstance(result,Exception):client.get_bundle.side_effect=result
            else:client.get_bundle.return_value=result
            try:
                selected,verify=preserve_live_receiver(files(b'PRIVATE_FIXTURE_REPO_SENTINEL'),client)
                api.call('/secrets','PUT',{'fixture':True})
                verify();api.call('/worker','PUT',selected)
                self.fail('MISSING_TARGET_ACCEPTED')
            except RuntimeError as error:
                self.assertEqual(str(error),'LIVE_RECEIVER_CAPTURE_FAILED; values withheld')
                self.assertNotIn('PRIVATE_FIXTURE',str(error))
            api.call.assert_not_called()

    def test_any_concurrent_module_change_fences_immediately_before_code_put(self):
        client=Mock();client.get_bundle.side_effect=[bundle(),bundle(other=b'concurrent-fixture-only-alex')]
        _,verify=preserve_live_receiver(files(b'unused-fixture-template'),client)
        data={'schema':'conectatech.commercial.v1','source':{'sha256':'a'*64,'cut_date':'2026-10-01',
            'generated_at':'2026-10-01T22:00:00Z'},'expires_at':'2026-10-02T22:00:00Z',
            'products':[{'sku':'FIXTURE001','source_name':'synthetic source','name':'synthetic title','variant_gb':[],
                'availability':'in_stock','blocked_reasons':[],
                'prices':{'currency':'USD','promo_cash_cents':100,'pvp_card_cents':120}}]}
        def get(path):
            if path=='/health':return {'ok':True,'pilot':True,'meta_ingress_enabled':False,'messenger_outbound':False,'release':'old-release'}
            if path=='/commercial/catalog':return copy.deepcopy(data)
            if path=='/messenger/status':return {'mode':'development-only','reception_enabled':False,'outbound_enabled':False}
            if path=='/messenger/seller/status':return {'mode':'authorized-testers-only','enabled':False,'live_customers_enabled':False}
            raise AssertionError('UNEXPECTED_OFFLINE_ROUTE')
        capture={'current':data,'selected':data,'health':get('/health'),'mode':'preserve_current'}
        api=Mock()
        with self.assertRaisesRegex(RuntimeError,'LIVE_BUNDLE_CHANGED_BEFORE_UPLOAD'):
            deploy.upload_preserving_source(api,b'fixture-only-body','multipart/fixture',capture,'new-release',get,before_put=verify)
        api.call.assert_not_called()

    def test_main_capture_precedes_secret_writes_and_fence_is_immediately_before_code_put(self):
        source=(ROOT/'deploy_free.py').read_text()
        main=source.split('def main():',1)[1]
        self.assertLess(main.index("preserve_live_receiver(files,content_client,expected_source=capture['current'])"),main.index("api.call(SCRIPT+'/secrets'"))
        self.assertIn('capture,release,before_put=verify_live_bundle)',main)
        self.assertIn("if before_put is not None:before_put()\n    api.call(SCRIPT,'PUT',body,ctype)",source)

    def test_http_source_lagging_live_cf_data_aborts_before_any_write(self):
        http={'schema':'conectatech.commercial.v1','source':{'sha256':'a'*64,'cut_date':'2026-10-01',
            'generated_at':'2026-10-01T22:00:00Z'},'expires_at':'2026-10-02T22:00:00Z',
            'products':[{'sku':'FIXTURE001','source_name':'synthetic source','name':'synthetic title','variant_gb':[],
                'availability':'in_stock','blocked_reasons':[],
                'prices':{'currency':'USD','promo_cash_cents':100,'pvp_card_cents':120}}]}
        cf=copy.deepcopy(http);cf['source']['sha256']='b'*64
        live=bundle();live=Bundle(live.entrypoint,live.parts+(Part('central-data.mjs','central-data.mjs','application/javascript+module',b'export default '+json.dumps(cf).encode()+b';'),))
        client=Mock();client.get_bundle.return_value=live;api=Mock()
        with self.assertRaisesRegex(RuntimeError,'LIVE_RECEIVER_CAPTURE_FAILED; values withheld'):
            selected,verify=preserve_live_receiver(files(b'synthetic template'),client,expected_source=http)
            api.call('/secrets','PUT',{'fixture':True})
            verify();api.call('/worker','PUT',selected)
        api.call.assert_not_called()
        selected,verify=preserve_live_receiver(files(b'synthetic template'),client,expected_source=cf)
        self.assertEqual(selected[1][2],live.parts[1].body)
        verify()

if __name__=='__main__':unittest.main()
