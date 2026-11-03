"""Offline deployment safety tests. Synthetic data; no credentials or network."""
import base64, copy, importlib.util, json, subprocess, unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import Mock, patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('deploy_free',ROOT/'deploy_free.py')
deploy=importlib.util.module_from_spec(spec);spec.loader.exec_module(deploy)

def source(sha='a',day=1):
    return {'schema':'conectatech.commercial.v1','source':{'sha256':sha*64,
            'cut_date':f'2026-10-{day:02d}','generated_at':f'2026-10-{day:02d}T22:00:00Z',
            'cut_date_evidence':'593_matching_created_modified','mapping':{'sku':'D','name':'C','availability':'B>0','promo_cash':'Q','pvp_card':'X+Y'}},
            'normalized_at':'2026-10-02T00:00:00Z','published_at':None,
            'expires_at':f'2026-10-{day+1:02d}T22:00:00Z',
            'products':[{'sku':'FIXTURE01','source_name':'synthetic private identity',
                'name':'synthetic private name','variant_gb':[], 'availability':'in_stock',
                'blocked_reasons':[],'prices':{'currency':'USD','promo_cash_cents':12345,'pvp_card_cents':23456}}]}

def lease(sha='b'):
    return {'sha256':sha*64,'lease_token':'11111111-1111-4111-8111-111111111111'}

NOW=datetime(2026,10,2,23,tzinfo=timezone.utc)

class Runtime:
    def __init__(self,data=None,enabled=True):
        self.data=data or source();self.enabled=enabled;self.release='old-release';self.calls=[]
        self.api=Mock();self.api.call.side_effect=self.put
    def put(self,*args):self.release='new-release'
    def get(self,path):
        self.calls.append(path)
        if path=='/health':return {'ok':True,'pilot':True,'meta_ingress_enabled':False,'messenger_outbound':self.enabled,'release':self.release}
        if path=='/messenger/status':return {'mode':'development-only','reception_enabled':False,'outbound_enabled':self.enabled}
        if path=='/messenger/seller/status':return {'mode':'authorized-testers-only','enabled':self.enabled,'live_customers_enabled':False}
        if path=='/commercial/catalog':return copy.deepcopy(self.data)
        raise AssertionError('Unexpected offline route')

class SourcePreservation(unittest.TestCase):
    def test_code_only_always_preserves_current_even_with_newer_or_equal_compiled_date(self):
        for compiled in [source('b',1),source('b',2),source('b',3)]:
            current=source('a',2);chosen,mode=deploy.select_source(compiled,current,{}, {})
            self.assertIs(chosen,current);self.assertEqual(mode,'preserve_current')
    def test_explicit_new_source_requires_exact_validated_sha_and_advancing_generation(self):
        chosen,mode=deploy.select_source(source('b',2),source(),{}, {'CENTRAL_EXPECTED_SOURCE_SHA256':'b'*64},lease=lease(),now=NOW)
        self.assertEqual(chosen['source']['sha256'],'b'*64);self.assertEqual(mode,'validated_source_update')
        for compiled,expected in [(source('b',2),'c'*64),(source('b',1),'b'*64),(source('b',2),'invalid')]:
            with self.assertRaisesRegex(ValueError,'SOURCE_UPDATE_'):
                deploy.select_source(compiled,source(),{}, {'CENTRAL_EXPECTED_SOURCE_SHA256':expected},lease=lease(),now=NOW)
    def test_updates_require_same_job_lease_freshness_and_validated_mapping_evidence(self):
        for state in [None,lease('c'),{'sha256':'b'*64,'lease_token':'untrusted-not-a-lease'}]:
            with self.assertRaisesRegex(ValueError,'LEASE_REQUIRED'):
                deploy.select_source(source('b',2),source(),{}, {'CENTRAL_EXPECTED_SOURCE_SHA256':'b'*64},lease=state,now=NOW)
        with self.assertRaisesRegex(ValueError,'NOT_FRESH'):
            deploy.select_source(source('b',2),source(),{}, {'CENTRAL_EXPECTED_SOURCE_SHA256':'b'*64},lease=lease(),now=datetime(2026,10,4,tzinfo=timezone.utc))
        for key in ['mapping','cut_date_evidence']:
            compiled=source('b',2);del compiled['source'][key]
            with self.assertRaisesRegex(ValueError,'VALIDATION_EVIDENCE_REQUIRED'):
                deploy.select_source(compiled,source(),{}, {'CENTRAL_EXPECTED_SOURCE_SHA256':'b'*64},lease=lease(),now=NOW)
    def test_whole_body_comparison_is_type_sensitive_and_only_top_published_at_is_ignored(self):
        a=source();a['unknown']={'flag':True,'published_at':'nested-original'}
        b=copy.deepcopy(a);b['published_at']='changed';self.assertTrue(deploy.same_source(a,b))
        b['unknown']['flag']=1;self.assertFalse(deploy.same_source(a,b))
        b=copy.deepcopy(a);b['unknown']['published_at']='nested-change';self.assertFalse(deploy.same_source(a,b))
    def test_same_sha_idempotence_requires_entire_body_equality_except_published_at(self):
        current=source();compiled=copy.deepcopy(current);compiled['published_at']='new publication time'
        self.assertIs(deploy.select_source(compiled,current,{}, {'CENTRAL_EXPECTED_SOURCE_SHA256':'a'*64},lease=lease('a'),now=NOW)[0],current)
        compiled['products'][0]['source_name']='synthetic unexpected identity'
        with self.assertRaisesRegex(ValueError,'SAME_SHA_DIFFERENT_BODY'):
            deploy.select_source(compiled,current,{}, {'CENTRAL_EXPECTED_SOURCE_SHA256':'a'*64},lease=lease('a'),now=NOW)
    def test_rollback_requires_target_and_current_source_pins_and_cannot_conflict_with_update(self):
        config={'source_rollback_confirmed':True,'rollback_source_sha256':'a'*64}
        with self.assertRaisesRegex(ValueError,'ROLLBACK_NOT_PINNED'):deploy.select_source(source(),source('b',2),config,{})
        result=deploy.select_source(source(),source('b',2),config,{'CENTRAL_ROLLBACK_EXPECTED_CURRENT_SHA256':'b'*64})
        self.assertEqual(result[1],'explicit_rollback')
        with self.assertRaisesRegex(ValueError,'UPDATE_AND_ROLLBACK_CONFLICT'):
            deploy.select_source(source(),source('b',2),config,{'CENTRAL_EXPECTED_SOURCE_SHA256':'a'*64},lease=lease('a'),now=NOW)
    def test_pre_and_post_preserve_enabled_authorized_testers_without_body_or_identity_hash_receipt(self):
        for enabled in (True,False):
            runtime=Runtime(enabled=enabled)
            capture=deploy.capture_source(source('b',2),{}, {},runtime.get)
            runtime.data['published_at']='2026-11-03T00:00:00Z'
            receipt=deploy.upload_preserving_source(runtime.api,b'fixture-only-bundle','multipart/fixture',capture,'new-release',runtime.get,sleep=lambda _:None)
            self.assertTrue(receipt['equal_except_published_at']);self.assertTrue(receipt['original_expiry_preserved'])
            self.assertIs(receipt['tester_transport_enabled'],enabled);self.assertIs(receipt['general_reception_enabled'],False)
            self.assertEqual(runtime.api.call.call_count,1)
            self.assertNotIn('synthetic private',json.dumps(receipt));self.assertNotIn('12345',json.dumps(receipt))
            self.assertNotIn('a'*64,json.dumps(receipt));self.assertNotIn('products',receipt)
    def test_concurrent_source_change_before_put_aborts_with_no_put(self):
        runtime=Runtime();capture=deploy.capture_source(source(),{}, {},runtime.get)
        runtime.data['products'][0]['source_name']='synthetic concurrent change'
        with self.assertRaisesRegex(ValueError,'CHANGED_BEFORE_UPLOAD'):
            deploy.upload_preserving_source(runtime.api,b'fixture','fixture',capture,'new-release',runtime.get)
        runtime.api.call.assert_not_called()
    def test_post_full_comparison_catches_any_private_or_unknown_field_without_reupload(self):
        mutations=[lambda x:x['products'][0].update(source_name='synthetic unexpected identity'),
                   lambda x:x['products'][0]['prices'].update(promo_cash_cents=22222),
                   lambda x:x['products'][0].update(availability='out_of_stock'),
                   lambda x:x['products'][0].update(variant_gb=[999]),
                   lambda x:x.update(unknown_private_field='synthetic unexpected value')]
        for mutate in mutations:
            runtime=Runtime();capture=deploy.capture_source(source(),{}, {},runtime.get)
            def put(*args):runtime.release='new-release';mutate(runtime.data)
            runtime.api.call.side_effect=put
            with self.assertRaisesRegex(RuntimeError,'FULL_COMPARISON_FAILED') as error:
                deploy.upload_preserving_source(runtime.api,b'fixture','fixture',capture,'new-release',runtime.get)
            self.assertEqual(runtime.api.call.call_count,1);self.assertNotIn('synthetic',str(error.exception))
    def test_propagation_retries_only_health_gets_and_never_put(self):
        runtime=Runtime();capture=deploy.capture_source(source(),{}, {},runtime.get)
        runtime.api.call.side_effect=lambda *args:None
        waits=[]
        with self.assertRaisesRegex(RuntimeError,'PROPAGATION_FAILED'):
            deploy.upload_preserving_source(runtime.api,b'fixture','fixture',capture,'new-release',runtime.get,sleep=waits.append)
        self.assertEqual(runtime.api.call.call_count,1);self.assertEqual(waits,[2]*11)
        self.assertEqual(runtime.calls[-12:],['/health']*12)
    def test_data_only_same_code_release_waits_for_full_expected_body_without_reupload(self):
        runtime=Runtime();capture=deploy.capture_source(source(),{}, {},runtime.get)
        capture.update(selected=source('b',2),mode='validated_source_update')
        runtime.api.call.side_effect=lambda *args:None
        reads=0;waits=[]
        def get(path):
            nonlocal reads
            if path=='/commercial/catalog' and runtime.api.call.call_count:
                reads+=1
                if reads==3:runtime.data=copy.deepcopy(capture['selected'])
            return runtime.get(path)
        receipt=deploy.upload_preserving_source(runtime.api,b'fixture','fixture',capture,'old-release',get,sleep=waits.append)
        self.assertEqual(reads,3);self.assertEqual(waits,[2,2]);self.assertEqual(receipt['health_attempts'],3)
        self.assertEqual(runtime.api.call.call_count,1);self.assertTrue(receipt['equal_except_published_at'])
    def test_changed_tester_open_ingress_or_live_customers_aborts(self):
        for target,change in [('/health',{'messenger_outbound':False}),('/health',{'meta_ingress_enabled':True}),('/messenger/seller/status',{'live_customers_enabled':True})]:
            runtime=Runtime();capture=deploy.capture_source(source(),{}, {},runtime.get)
            def get(path):
                result=runtime.get(path)
                if path==target:result.update(change)
                return result
            with self.assertRaisesRegex(ValueError,'SOURCE_'):
                deploy.upload_preserving_source(runtime.api,b'fixture','fixture',capture,'new-release',get)
            runtime.api.call.assert_not_called()
    def test_private_read_requires_http_200_and_sanitizes_transport_errors(self):
        for child in [Mock(returncode=0,stdout=json.dumps({'status':404,'bytes_b64':''})),
                      Mock(returncode=1,stdout='synthetic private body'),
                      Mock(returncode=0,stdout=json.dumps({'status':200,'bytes_b64':base64.b64encode(b'{"a":1,"a":2}').decode()}))]:
            with patch.object(deploy.subprocess,'run',return_value=child),self.assertRaisesRegex(RuntimeError,'PRIVATE_READ_FAILED') as error:
                deploy.private_worker_json('/commercial/catalog')
            self.assertNotIn('synthetic private body',str(error.exception))
        with patch.object(deploy.subprocess,'run',side_effect=subprocess.TimeoutExpired(['synthetic-private-url'],55)):
            with self.assertRaisesRegex(RuntimeError,'PRIVATE_READ_FAILED'):deploy.private_worker_json('/health')
    def test_invalid_structure_rejected_and_expired_valid_source_remains_usable_for_preservation(self):
        self.assertEqual(deploy.validate_source(source()).get('products')[0]['availability'],'in_stock')
        for change in [lambda d:d.update(expires_at='2099-01-01T00:00:00Z'),lambda d:d['source'].update(cut_date='2026-10-02'),lambda d:d['products'][0].update(stock=4),lambda d:d['products'].append(copy.deepcopy(d['products'][0])),lambda d:d['products'][0]['prices'].update(promo_cash_cents=True)]:
            data=source();change(data)
            with self.assertRaisesRegex(ValueError,'SOURCE_'):deploy.validate_source(data)

if __name__=='__main__':unittest.main()
