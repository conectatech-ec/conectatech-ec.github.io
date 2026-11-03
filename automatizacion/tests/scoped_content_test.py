"""Offline scoped deployment contract tests; synthetic data, no real network."""
import base64, copy, importlib.util, io, json, os, re, sys, tempfile, types, unittest
import urllib.error
from dataclasses import replace
from datetime import datetime, timezone
from email import policy
from email.parser import BytesParser
from pathlib import Path
from unittest.mock import Mock, patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import scoped_content as scoped
import scoped_policy

NOW=datetime(2026,11,3,21,tzinfo=timezone.utc)
ALEX_RELEASE='8'*40
PROCESSOR_RELEASE='c'*40
PRIVATE='SYNTHETIC_PRIVATE_MUST_NOT_APPEAR'
TEMPLATE="const COMMERCIAL_PROCESSOR_RELEASE='__COMMERCIAL_PROCESSOR_RELEASE__';\nexport const fixture='receiver';\n"
CODE_HASH='e'*64
REPOSITORY_RELEASE='d'*40
CODE_TEMPLATE=TEMPLATE+"const COMMERCIAL_PROCESSOR_CODE_SHA256='__COMMERCIAL_PROCESSOR_CODE_SHA256__';\n"

def source(sha='a',day=1):
    return {'schema':'conectatech.commercial.v1','source':{'sha256':sha*64,
        'cut_date':f'2026-11-{day:02d}','generated_at':f'2026-11-{day:02d}T22:00:00Z',
        'cut_date_evidence':'593_matching_created_modified',
        'mapping':{'sku':'D','name':'C','availability':'B>0','promo_cash':'Q','pvp_card':'X+Y'}},
        'normalized_at':'2026-11-03T20:00:00Z','published_at':None,
        'expires_at':f'2026-11-{day+1:02d}T22:00:00Z',
        'products':[{'sku':'FIXTURE01','source_name':PRIVATE,'name':'synthetic fixture',
            'variant_gb':[],'availability':'in_stock','blocked_reasons':[],
            'prices':{'currency':'USD','promo_cash_cents':1234567,'pvp_card_cents':2345678}}]}

def lease(sha='b'):
    return {'sha256':sha*64,'lease_token':'11111111-1111-4111-8111-111111111111'}

def module_json(data):
    return b'export default '+json.dumps(data,ensure_ascii=False,separators=(',',':')).encode()+b';\n'

def part(name,body,ctype='application/javascript+module',headers=()):
    return scoped.Part(name,name,ctype,body,tuple(headers))

def bundle(data=None,processor_release='b'*40):
    data=data or source()
    return scoped.Bundle('worker.mjs',(
        part('worker.mjs',b"export default {fetch(){return new Response('fixture')}};"),
        part('alex.mjs',b'export const stagedMustNeverReplaceThis=true;'),
        part('shared-hub.mjs',b'export const priorLiveHub=true;'),
        part('commercial-reception.mjs',TEMPLATE.replace(scoped.PLACEHOLDER,processor_release).encode()),
        part('central-data.mjs',module_json(data)),
        part('central-enrichment.mjs',b'export default {opaque:"'+PRIVATE.encode()+b'"};'),
        part('asset.wasm',b'\x00asm\xff\x00\r\nBINARY', 'application/wasm',(('X-Fixture-Extension','opaque-preserved'),)),
    ))

def get_part(value,name):
    return next(p for p in value.parts if p.name==name)

def response_multipart(parts,boundary='fixture_boundary',closing=True):
    chunks=[]
    for p in parts:
        headers=(f'--{boundary}\r\nContent-Disposition: form-data; name="{p.name}"; filename="{p.filename}"\r\n'
                 f'Content-Type: {p.content_type}\r\n'+''.join(f'{key}: {value}\r\n' for key,value in p.headers)+'\r\n')
        chunks.append(headers.encode()+p.body+b'\r\n')
    if closing:chunks.append(f'--{boundary}--\r\n'.encode())
    return b''.join(chunks),'multipart/form-data; boundary='+boundary

class Runtime:
    def __init__(self,enabled=True,processor_release='b'*40):
        self.source=source();self.original_source=copy.deepcopy(self.source)
        self.bundle=bundle(self.source,processor_release);self.original_bundle=self.bundle
        self.settings={'bindings':[{'name':'PILOT_RELEASE','type':'plain_text','text':ALEX_RELEASE},
            {'name':'PILOT_TOKEN','type':'secret_text'}, {'name':'MESSENGER_TEST_INBOX','type':'durable_object_namespace','namespace_id':'opaque-existing'}],
            'compatibility_date':'2026-10-01','observability':{'enabled':False},
            'unknown_future_metadata':{'flag':True,'list':[1,None,'preserve me']}}
        self.enabled=enabled;self.release=ALEX_RELEASE;self.calls=[];self.puts=[];self.waits=[]
        self.bundle_reads=0;self.settings_reads=0;self.pending=None;self.provider_lag=0;self.catalog_lag=0
        self.on_bundle_read=None;self.on_settings_read=None;self.on_private_read=None;self.on_put=None
        self.api=self
    def get_bundle(self):
        self.bundle_reads+=1;self.calls.append(('cf','bundle'))
        if self.on_bundle_read:self.on_bundle_read(self)
        if self.pending is not None:
            if self.provider_lag:self.provider_lag-=1
            else:self.bundle=self.pending;self.pending=None
        return copy.deepcopy(self.bundle)
    def get_settings(self):
        self.settings_reads+=1;self.calls.append(('cf','settings'))
        if self.on_settings_read:self.on_settings_read(self)
        return copy.deepcopy(self.settings)
    def put_bundle(self,value):
        self.puts.append(copy.deepcopy(value));self.calls.append(('cf','put'))
        if self.on_put:self.on_put(self,value)
        self.pending=copy.deepcopy(value)
        return {'provider_version_id':'11111111-1111-4111-8111-111111111111'}
    def private_get(self,path):
        self.calls.append(('private',path))
        if self.on_private_read:
            result=self.on_private_read(self,path)
            if result is not None:return result
        if path=='/health':return {'ok':True,'pilot':True,'release':self.release,'meta_ingress_enabled':False,'messenger_outbound':self.enabled}
        if path=='/messenger/status':return {'mode':'development-only','reception_enabled':False,'outbound_enabled':self.enabled}
        if path=='/messenger/seller/status':return {'mode':'authorized-testers-only','enabled':self.enabled,'live_customers_enabled':False}
        if path=='/commercial/catalog':
            if self.puts and self.catalog_lag:self.catalog_lag-=1;return copy.deepcopy(self.original_source)
            raw=get_part(self.bundle,'central-data.mjs').body
            return json.loads(raw[len(b'export default '):].rstrip().removesuffix(b';'))
        if path=='/commercial/catalog/status':
            match=re.search(rb"COMMERCIAL_PROCESSOR_RELEASE='([a-f0-9]{40})'",get_part(self.bundle,'commercial-reception.mjs').body)
            return {'processor_release':match.group(1).decode() if match else None}
        raise AssertionError('Unexpected route; side-effect receiver status must never be read')
    def client(self):return scoped.ScopedDeployer(self,self.private_get,sleep=self.waits.append,now=NOW)

class MultipartContract(unittest.TestCase):
    def test_parse_preserves_binary_payload_mime_extension_and_entrypoint(self):
        original=bundle();raw,ctype=response_multipart(original.parts)
        parsed=scoped.parse_bundle(raw,ctype,'worker.mjs')
        self.assertTrue(scoped.same_bundle(original,parsed))
        binary=get_part(parsed,'asset.wasm');self.assertEqual(binary.body,b'\x00asm\xff\x00\r\nBINARY')
        self.assertEqual(binary.content_type,'application/wasm');self.assertEqual(binary.headers,(('X-Fixture-Extension','opaque-preserved'),))
    def test_upload_metadata_contains_only_main_module_and_every_other_payload_is_exact(self):
        original=bundle();body,ctype=scoped.encode_bundle(original)
        message=BytesParser(policy=policy.default).parsebytes(('Content-Type: '+ctype+'\r\n\r\n').encode()+body)
        actual={item.get_param('name',header='content-disposition'):item for item in message.iter_parts()}
        self.assertEqual(json.loads(actual.pop('metadata').get_payload(decode=True)),{'main_module':'worker.mjs'})
        self.assertEqual(set(actual),{p.name for p in original.parts})
        for p in original.parts:
            self.assertEqual(actual[p.name].get_payload(decode=True),p.body)
            self.assertEqual(str(actual[p.name]['Content-Type']),p.content_type)
    def test_truncated_nonmultipart_missing_entrypoint_and_duplicate_modules_fail_closed(self):
        good=bundle();raw,ctype=response_multipart(good.parts)
        cases=[(raw[:-7],ctype,'worker.mjs'),(b'not multipart','text/javascript','worker.mjs'),
            (raw,ctype,'missing.mjs'),(raw,ctype,'../worker.mjs')]
        duplicate,duplicate_type=response_multipart((*good.parts,good.parts[0]));cases.append((duplicate,duplicate_type,'worker.mjs'))
        for data,kind,entrypoint in cases:
            with self.assertRaises(scoped.ScopedError):scoped.parse_bundle(data,kind,entrypoint)
    def test_ambiguous_mime_headers_metadata_fields_and_encoded_payloads_are_rejected(self):
        original=bundle();raw,ctype=response_multipart(original.parts)
        for data in [raw.replace(b'Content-Type: application/javascript+module',b'Content-Type: text/plain\r\nContent-Type: application/javascript+module',1),
                     raw.replace(b'Content-Disposition: form-data;',b'Content-Disposition: form-data; name="other.mjs"\r\nContent-Disposition: form-data;',1)]:
            with self.assertRaises(scoped.ScopedError):scoped.parse_bundle(data,ctype,'worker.mjs')
        for extra in [part('metadata',b'{}','application/json'),part('encoded.mjs',b'QQ==',headers=(('Content-Transfer-Encoding','base64'),))]:
            data,kind=response_multipart((*original.parts,extra))
            with self.assertRaises(scoped.ScopedError):scoped.parse_bundle(data,kind,'worker.mjs')
    def test_only_two_owned_module_names_can_be_replaced_and_layout_never_changes(self):
        original=bundle()
        for name in ['worker.mjs','alex.mjs','shared-hub.mjs','central-enrichment.mjs','other.mjs']:
            with self.assertRaisesRegex(scoped.ScopedError,'SCOPE'):scoped.replace_part(original,name,b'changed')
        changed=scoped.replace_part(original,'central-data.mjs',b'new only')
        self.assertEqual(changed.entrypoint,original.entrypoint)
        self.assertEqual({p.name for p in changed.parts},{p.name for p in original.parts})
        self.assertTrue(all(p==get_part(changed,p.name) for p in original.parts if p.name!='central-data.mjs'))
    def test_changed_owned_part_content_length_is_recomputed_and_unowned_headers_are_preserved(self):
        original=bundle();before=get_part(original,'central-data.mjs')
        original=replace(original,parts=tuple(replace(p,headers=(('Content-Length',str(len(p.body))),('X-Opaque','keep'))) if p.name==before.name else p for p in original.parts))
        changed=scoped.replace_part(original,'central-data.mjs',b'updated synthetic body')
        updated=get_part(changed,'central-data.mjs')
        self.assertEqual(dict(updated.headers)['Content-Length'],str(len(updated.body)))
        self.assertEqual(dict(updated.headers)['X-Opaque'],'keep')
        self.assertEqual(get_part(changed,'asset.wasm'),get_part(original,'asset.wasm'))

class ScopedDeploymentContract(unittest.TestCase):
    def test_inspect_has_no_put_no_receiver_trigger_and_no_private_body_or_fingerprint_receipt(self):
        runtime=Runtime();report=runtime.client().inspect()
        self.assertEqual(runtime.puts,[]);self.assertEqual(report['worker_puts'],0);self.assertTrue(report['read_only'])
        self.assertTrue(report['runtime_bundle_readable']);self.assertFalse(report['provider_version_observed'])
        self.assertNotIn(('private','/commercial/status'),runtime.calls)
        self.assertFalse(any(value in json.dumps(report) for value in [PRIVATE,'1234567','a'*64,'opaque-existing']))
    def test_bootstrap_replaces_only_receiver_and_preserves_settings_source_and_both_tester_states(self):
        for enabled in (True,False):
            runtime=Runtime(enabled);before=copy.deepcopy(runtime.bundle);settings=copy.deepcopy(runtime.settings)
            report=runtime.client().bootstrap(TEMPLATE,PROCESSOR_RELEASE)
            self.assertEqual(len(runtime.puts),1);self.assertEqual(runtime.settings,settings)
            self.assertEqual(get_part(runtime.bundle,'commercial-reception.mjs').body,TEMPLATE.replace(scoped.PLACEHOLDER,PROCESSOR_RELEASE).encode())
            self.assertTrue(all(p==get_part(runtime.bundle,p.name) for p in before.parts if p.name!='commercial-reception.mjs'))
            self.assertEqual(runtime.private_get('/commercial/catalog'),runtime.original_source)
            self.assertIs(report['tester_transport_enabled'],enabled);self.assertEqual(report['runtime_release'],ALEX_RELEASE)
            self.assertEqual(report['processor_release'],PROCESSOR_RELEASE);self.assertEqual(report['provider_version_id'],'11111111-1111-4111-8111-111111111111')
    def test_bootstrap_is_idempotent_and_never_republishes_identical_receiver(self):
        runtime=Runtime(processor_release=PROCESSOR_RELEASE)
        report=runtime.client().bootstrap(TEMPLATE,PROCESSOR_RELEASE)
        self.assertEqual(runtime.puts,[]);self.assertEqual(report['worker_puts'],0)
    def test_malformed_processor_revision_and_ambiguous_templates_reject_before_any_put(self):
        for template,revision in [(TEMPLATE,'invalid'),(TEMPLATE,'M'*40),(TEMPLATE.replace(scoped.PLACEHOLDER,'already-expanded'),PROCESSOR_RELEASE),(TEMPLATE+TEMPLATE,PROCESSOR_RELEASE)]:
            runtime=Runtime()
            with self.assertRaises(scoped.ScopedError):runtime.client().bootstrap(template,revision)
            self.assertEqual(runtime.puts,[])
    def test_concurrent_unowned_module_or_settings_change_before_put_aborts_without_put(self):
        for change in ('module','settings'):
            runtime=Runtime()
            if change=='module':
                def mutate(rt):
                    if rt.bundle_reads==2:rt.bundle=replace(rt.bundle,parts=tuple(replace(p,body=b'parallel Alex code') if p.name=='alex.mjs' else p for p in rt.bundle.parts))
                runtime.on_bundle_read=mutate
            else:
                def mutate(rt):
                    if rt.settings_reads==2:rt.settings['unknown_future_metadata']['flag']=1
                runtime.on_settings_read=mutate
            with self.assertRaisesRegex(scoped.ScopedError,'CHANGED_BEFORE_PUT'):runtime.client().bootstrap(TEMPLATE,PROCESSOR_RELEASE)
            self.assertEqual(runtime.puts,[])
    def test_newer_cf_source_not_yet_visible_over_http_must_abort_before_put(self):
        runtime=Runtime();runtime.bundle=scoped.replace_part(runtime.bundle,'central-data.mjs',module_json(source('d',2)))
        def stale_http(rt,path):
            if path=='/commercial/catalog':return copy.deepcopy(rt.original_source)
        runtime.on_private_read=stale_http
        with self.assertRaises((scoped.ScopedError,ValueError)):runtime.client().bootstrap(TEMPLATE,PROCESSOR_RELEASE)
        self.assertEqual(runtime.puts,[])
    def test_ingest_changes_only_data_and_keeps_enrichment_live_alex_metadata_and_source_expiry(self):
        runtime=Runtime(processor_release=PROCESSOR_RELEASE);before=copy.deepcopy(runtime.bundle);desired=source('b',2)
        report=runtime.client().ingest(desired,'b'*64,lease(),PROCESSOR_RELEASE)
        self.assertEqual(len(runtime.puts),1)
        self.assertTrue(all(p==get_part(runtime.bundle,p.name) for p in before.parts if p.name!='central-data.mjs'))
        actual=runtime.private_get('/commercial/catalog');self.assertTrue(scoped.same_source(actual,desired))
        self.assertEqual(actual['expires_at'],desired['expires_at']);self.assertEqual(runtime.release,ALEX_RELEASE)
        self.assertTrue(report['full_comparison_in_memory']);self.assertTrue(report['equal_except_published_at'])
        self.assertNotIn(PRIVATE,json.dumps(report));self.assertNotIn('b'*64,json.dumps(report))
    def test_ingest_requires_current_receiver_processor_revision_before_data_put(self):
        runtime=Runtime(processor_release='b'*40)
        with self.assertRaisesRegex(scoped.ScopedError,'PROCESSOR_RELEASE'):runtime.client().ingest(source('b',2),'b'*64,lease(),PROCESSOR_RELEASE)
        self.assertEqual(runtime.puts,[])
    def test_commit_denies_entrypoint_change_and_out_of_policy_module_mutations(self):
        for target in ('entrypoint','module','scope'):
            runtime=Runtime();client=runtime.client();capture=client.capture();expected=capture['bundle'];allowed={'commercial-reception.mjs'}
            if target=='entrypoint':expected=replace(expected,entrypoint='alex.mjs')
            elif target=='module':expected=replace(expected,parts=tuple(replace(p,body=b'changed Alex') if p.name=='alex.mjs' else p for p in expected.parts))
            else:allowed={'commercial-reception.mjs','central-data.mjs'}
            with self.assertRaises(scoped.ScopedError):client.commit(capture,expected,allowed,capture['source'])
            self.assertEqual(runtime.puts,[])
    def test_data_ingest_same_alex_release_waits_for_full_body_without_put_retry(self):
        runtime=Runtime(processor_release=PROCESSOR_RELEASE);runtime.provider_lag=2;runtime.catalog_lag=4
        report=runtime.client().ingest(source('b',2),'b'*64,lease(),PROCESSOR_RELEASE)
        self.assertEqual(len(runtime.puts),1);self.assertGreater(report['health_attempts'],2)
        self.assertEqual(runtime.waits,[2]*(report['health_attempts']-1));self.assertEqual(runtime.release,ALEX_RELEASE)
    def test_never_visible_expected_bundle_exhausts_bounded_reads_and_never_retries_put(self):
        runtime=Runtime();runtime.provider_lag=99
        with self.assertRaisesRegex(scoped.ScopedError,'PROPAGATION_FAILED'):runtime.client().bootstrap(TEMPLATE,PROCESSOR_RELEASE)
        self.assertEqual(len(runtime.puts),1);self.assertEqual(runtime.waits,[2]*11)
    def test_unexpected_unowned_bytes_settings_or_private_body_after_put_abort_without_second_put(self):
        for change in ('module','settings','source'):
            runtime=Runtime()
            if change=='module':
                def change_after(rt):
                    if rt.puts:
                        current=rt.pending or rt.bundle
                        rt.pending=replace(current,parts=tuple(replace(p,body=b'third party code') if p.name=='alex.mjs' else p for p in current.parts))
                runtime.on_bundle_read=change_after
            elif change=='settings':runtime.on_put=lambda rt,_value:rt.settings['unknown_future_metadata'].update(flag=1)
            else:
                def changed_source(rt,path):
                    if rt.puts and path=='/commercial/catalog':
                        value=copy.deepcopy(rt.original_source);value['products'][0]['source_name']='synthetic unexpected private identity';return value
                runtime.on_private_read=changed_source
            with self.assertRaises((scoped.ScopedError,ValueError)):runtime.client().bootstrap(TEMPLATE,PROCESSOR_RELEASE)
            self.assertEqual(len(runtime.puts),1)
    def test_tester_state_live_scope_general_ingress_or_alex_release_change_fails_before_mutation(self):
        edits=[('/health',{'messenger_outbound':False}),('/health',{'meta_ingress_enabled':True}),('/health',{'release':'9'*40}),('/messenger/seller/status',{'live_customers_enabled':True})]
        for path,edit in edits:
            runtime=Runtime()
            def changed(rt,current_path):
                if current_path!=path or rt.bundle_reads<2:return None
                if path=='/health':value={'ok':True,'pilot':True,'release':rt.release,'meta_ingress_enabled':False,'messenger_outbound':rt.enabled}
                else:value={'mode':'authorized-testers-only','enabled':rt.enabled,'live_customers_enabled':False}
                value.update(edit);return value
            runtime.on_private_read=changed
            with self.assertRaises((scoped.ScopedError,ValueError)):runtime.client().bootstrap(TEMPLATE,PROCESSOR_RELEASE)
            self.assertEqual(runtime.puts,[])
    def test_payload_processing_methods_never_persist_any_file(self):
        for mode in ('inspect','bootstrap','ingest'):
            runtime=Runtime(processor_release=PROCESSOR_RELEASE)
            with patch('builtins.open',side_effect=AssertionError('Payload must stay in RAM')),patch.object(Path,'write_bytes',side_effect=AssertionError('Payload must stay in RAM')),patch.object(Path,'write_text',side_effect=AssertionError('Payload must stay in RAM')):
                if mode=='inspect':report=runtime.client().inspect()
                elif mode=='bootstrap':report=runtime.client().bootstrap(TEMPLATE,PROCESSOR_RELEASE)
                else:report=runtime.client().ingest(source('b',2),'b'*64,lease(),PROCESSOR_RELEASE)
            self.assertTrue(report['ok'])

class SourceAuthorizationContract(unittest.TestCase):
    def test_exact_sha_same_job_lease_advancing_generation_freshness_and_evidence_are_required(self):
        for desired,expected,state in [(source('b',2),'d'*64,lease()),(source('b',2),'b'*64,lease('d')),(source('b',2),'b'*64,None),(source('b',1),'b'*64,lease())]:
            runtime=Runtime(processor_release=PROCESSOR_RELEASE)
            with self.assertRaises((scoped.ScopedError,ValueError)):runtime.client().ingest(desired,expected,state,PROCESSOR_RELEASE)
            self.assertEqual(runtime.puts,[])
        desired=source('b',2);del desired['source']['cut_date_evidence']
        with self.assertRaisesRegex(scoped.ScopedError,'EVIDENCE'):scoped.validate_update(desired,source(),'b'*64,lease(),NOW)
        with self.assertRaisesRegex(scoped.ScopedError,'EXPIRED'):scoped.validate_update(source('b',2),source(),'b'*64,lease(),datetime(2026,11,4,tzinfo=timezone.utc))
    def test_duplicate_sku_relabelled_cut_and_invalid_finance_are_rejected_without_values(self):
        for change in [lambda d:d['products'].append(copy.deepcopy(d['products'][0])),lambda d:d['source'].update(cut_date='2026-11-01'),lambda d:d['products'][0]['prices'].update(promo_cash_cents=True)]:
            desired=source('b',2);change(desired)
            with self.assertRaises(ValueError) as error:scoped_policy.validate_source(desired)
            self.assertNotIn(PRIVATE,str(error.exception));self.assertNotIn('1234567',str(error.exception))
    def test_same_sha_is_idempotent_only_for_full_type_sensitive_body_equality(self):
        runtime=Runtime(processor_release=PROCESSOR_RELEASE);desired=copy.deepcopy(runtime.original_source)
        report=runtime.client().ingest(desired,'a'*64,lease('a'),PROCESSOR_RELEASE)
        self.assertEqual(runtime.puts,[]);self.assertEqual(report['worker_puts'],0)
        desired['unknown']={'flag':True};current=copy.deepcopy(desired);current['unknown']['flag']=1
        self.assertFalse(scoped.same_source(desired,current))
        desired['products'][0]['source_name']='synthetic changed identity'
        with self.assertRaisesRegex(scoped.ScopedError,'SAME_SHA_DIFFERENT_BODY'):scoped.validate_update(desired,runtime.original_source,'a'*64,lease('a'),NOW)

class TransportContract(unittest.TestCase):
    def test_cf_transport_roundtrip_uses_content_endpoint_and_returns_only_real_provider_version_fields(self):
        class Reply:
            status=200
            def __init__(self,raw,headers):self.raw=raw;self.headers=headers
            def __enter__(self):return self
            def __exit__(self,*args):return False
            def read(self,n):return self.raw[:n]
        original=bundle();raw,ctype=response_multipart(original.parts)
        settings={'bindings':[{'name':'PILOT_RELEASE','type':'plain_text','text':ALEX_RELEASE}], 'unknown':{'preserve':[True,None]}}
        opener=Mock();opener.open.side_effect=[Reply(json.dumps({'success':True,'result':settings}).encode(),{'Content-Type':'application/json'}),
            Reply(raw,{'Content-Type':ctype,'CF-Entrypoint':'worker.mjs'}),
            Reply(json.dumps({'success':True,'result':{'version_id':'11111111-1111-4111-8111-111111111111','deployment_id':'22222222-2222-4222-8222-222222222222','id':ALEX_RELEASE,'secret':PRIVATE}}).encode(),{'Content-Type':'application/json'})]
        token='synthetic-token';api=scoped.CFClient('a'*32,token,opener)
        self.assertEqual(api.get_settings(),settings);self.assertTrue(scoped.same_bundle(api.get_bundle(),original))
        result=api.put_bundle(original)
        self.assertEqual(result,{'provider_version_id':'11111111-1111-4111-8111-111111111111','provider_deployment_id':'22222222-2222-4222-8222-222222222222'})
        requests=[call.args[0] for call in opener.open.call_args_list]
        self.assertEqual([request.method for request in requests],['GET','GET','PUT'])
        self.assertEqual([request.full_url.rsplit('/',2)[-1] for request in requests],['settings','v2','content'])
        self.assertTrue(all(request.get_header('Authorization')=='Bearer '+token and token not in request.full_url for request in requests))
        self.assertTrue(all(request.data is None for request in requests[:2]))
        upload=requests[-1];document=BytesParser(policy=policy.default).parsebytes(('Content-Type: '+upload.get_header('Content-type')+'\r\n\r\n').encode()+upload.data)
        metadata=next(p for p in document.iter_parts() if p.get_param('name',header='content-disposition')=='metadata')
        self.assertEqual(json.loads(metadata.get_payload(decode=True)),{'main_module':'worker.mjs'})
    def test_cf_scope_denies_full_deploy_metadata_secret_and_other_worker_mutations_before_network(self):
        opener=Mock();api=scoped.CFClient('a'*32,'fixture-token',opener)
        for path,method in [(scoped.SCRIPT,'PUT'),(scoped.SCRIPT+'/settings','PUT'),(scoped.SCRIPT+'/secrets','PUT'),('/workers/scripts/other/content','PUT'),(scoped.SCRIPT+'/content/v2','POST')]:
            with self.assertRaisesRegex(scoped.ScopedError,'SCOPE'):api.request(path,method)
        with self.assertRaisesRegex(scoped.ScopedError,'SCOPE'):api.request(scoped.SCRIPT+'/settings','GET',b'{}')
        opener.open.assert_not_called()
    def test_cf_failure_redacts_token_response_and_url_even_on_http_error(self):
        token='synthetic-private-token-do-not-log';error=urllib.error.HTTPError('https://private.fixture?token='+token,403,'fixture',{},io.BytesIO(PRIVATE.encode()))
        opener=Mock();opener.open.side_effect=error;api=scoped.CFClient('a'*32,token,opener)
        with self.assertRaises(scoped.ScopedError) as raised:api.get_bundle()
        for value in (token,PRIVATE,'private.fixture'):self.assertNotIn(value,str(raised.exception))
        self.assertTrue(raised.exception.__suppress_context__)
    def test_private_http_requires_200_and_errors_never_echo_child_stdout_or_stderr(self):
        for result in [Mock(returncode=0,stdout=json.dumps({'status':404,'bytes_b64':''}),stderr=PRIVATE),Mock(returncode=1,stdout=PRIVATE,stderr=PRIVATE),Mock(returncode=0,stdout=json.dumps({'status':200,'bytes_b64':base64.b64encode(b'{"same":1,"same":2}').decode()}),stderr=PRIVATE)]:
            with patch.object(scoped.subprocess,'run',return_value=result),self.assertRaises(scoped.ScopedError) as raised:scoped.private_get('/commercial/catalog')
            self.assertNotIn(PRIVATE,str(raised.exception))
        with patch.object(scoped.subprocess,'run') as network:
            with self.assertRaisesRegex(scoped.ScopedError,'SCOPE'):scoped.private_get('/commercial/status')
            network.assert_not_called()

class CLIPromotionContract(unittest.TestCase):
    def environment(self):
        return {'GITHUB_REF':scoped.BRANCH,'CF_FREE_ONLY_CONFIRMED':'true','GITHUB_SHA':PROCESSOR_RELEASE,
            'CLOUDFLARE_ACCOUNT_ID':'a'*32,'CLOUDFLARE_API_TOKEN':'synthetic-only','PILOT_TOKEN':'synthetic-only'}
    def test_full_deploy_rotation_or_unpromoted_scoped_writes_fail_before_cf_access(self):
        cases=[('--inspect',{'activar':True}),('--inspect',{'activar':False,'sincronizar_meta_verify_token':True}),
            ('--bootstrap',{'activar':False}),('--ingest',{'activar':False,'datahub_scoped_content_enabled':False})]
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            for command,config in cases:
                (root/'activar-cloud.json').write_text(json.dumps(config))
                with patch.object(scoped,'ROOT',root),patch.dict(os.environ,self.environment(),clear=True),patch.object(sys,'argv',['scoped_content.py',command]),patch.object(scoped,'CFClient') as network:
                    with self.assertRaises(scoped.ScopedError):scoped.main()
                    network.assert_not_called()
    def test_inspect_needs_no_write_promotion_and_emits_only_safe_scalar_outputs(self):
        runtime=Runtime();client=runtime.client()
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'activar-cloud.json').write_text('{"activar":false}')
            environment={**self.environment(),'GITHUB_OUTPUT':str(root/'github-output')}
            with patch.object(scoped,'ROOT',root),patch.dict(os.environ,environment,clear=True),patch.object(sys,'argv',['scoped_content.py','--inspect']),patch.object(scoped,'CFClient',return_value=runtime),patch.object(scoped,'ScopedDeployer',return_value=client),patch('builtins.print') as output:
                scoped.main()
            self.assertEqual(runtime.puts,[])
            text=(root/'github-output').read_text();self.assertIn('runtime_release='+ALEX_RELEASE,text)
            self.assertNotIn(PRIVATE,text);self.assertNotIn('a'*64,text)
            self.assertNotIn(PRIVATE,str(output.call_args_list))
    def test_nonpilot_branch_and_missing_free_attestation_fail_before_cf_access(self):
        for edit in [{'GITHUB_REF':'refs/heads/main'},{'CF_FREE_ONLY_CONFIRMED':'false'}]:
            with patch.dict(os.environ,{**self.environment(),**edit},clear=True),patch.object(sys,'argv',['scoped_content.py','--inspect']),patch.object(scoped,'CFClient') as network:
                with self.assertRaises(scoped.ScopedError):scoped.main()
                network.assert_not_called()

class LatestPublicWriterContract(unittest.TestCase):
    class Reply:
        def __init__(self,raw,status=200):self.raw=raw;self.status=status;self.read_sizes=[]
        def __enter__(self):return self
        def __exit__(self,*args):return False
        def read(self,n):self.read_sizes.append(n);return self.raw[:n]
    def envelope(self,config):
        return json.dumps({'encoding':'base64','content':base64.b64encode(json.dumps(config).encode()).decode()}).encode()
    def promoted(self):return {'activar':False,'sincronizar_meta_verify_token':False,'datahub_scoped_content_enabled':True}
    def test_latest_control_uses_one_fixed_public_url_without_cf_or_worker_credentials(self):
        config=self.promoted();reply=self.Reply(self.envelope(config));opener=Mock();opener.open.return_value=reply
        with patch.dict(os.environ,{'CLOUDFLARE_API_TOKEN':'synthetic-CF-secret','PILOT_TOKEN':'synthetic-worker-secret'}),patch('builtins.print') as output:
            self.assertEqual(scoped.read_latest_config(opener),config)
        request=opener.open.call_args.args[0]
        self.assertEqual(request.full_url,'https://api.github.com/repos/conectatech-ec/conectatech-ec.github.io/contents/automatizacion/activar-cloud.json?ref=automatizacion%2Fpiloto-cloud-3sku-20261015')
        self.assertEqual(request.method,'GET');self.assertIsNone(request.data)
        self.assertIsNone(request.get_header('Authorization'));self.assertIsNone(request.get_header('Cookie'))
        self.assertEqual(request.get_header('Cache-control'),'no-cache');self.assertEqual(reply.read_sizes,[65537])
        self.assertEqual(opener.open.call_args.kwargs['timeout'],30);output.assert_not_called()
    def test_missing_malformed_oversized_denied_or_unavailable_public_control_fails_closed(self):
        bad_config=b'{"activar":false,"activar":true}'
        replies=[self.Reply(self.envelope(self.promoted()),403),self.Reply(b'x'*65537),self.Reply(b'not-json'),
            self.Reply(json.dumps({'encoding':'none','content':'{}'}).encode()),self.Reply(json.dumps({'encoding':'base64','content':'not-base64!'}).encode()),
            self.Reply(json.dumps({'encoding':'base64','content':base64.b64encode(b'x'*16385).decode()}).encode()),
            self.Reply(json.dumps({'encoding':'base64','content':base64.b64encode(bad_config).decode()}).encode())]
        for reply in replies:
            opener=Mock();opener.open.return_value=reply
            with self.assertRaises(scoped.ScopedError):scoped.read_latest_config(opener)
        opener=Mock();opener.open.side_effect=RuntimeError(PRIVATE)
        with self.assertRaises(scoped.ScopedError) as error:scoped.read_latest_config(opener)
        self.assertNotIn(PRIVATE,str(error.exception));self.assertTrue(error.exception.__suppress_context__)
        for edit in [{'datahub_scoped_content_enabled':False},{'datahub_scoped_content_enabled':'true'},{'activar':True},{'sincronizar_meta_verify_token':True}]:
            with self.assertRaises(scoped.ScopedError):scoped.require_latest_promotion(lambda:{**self.promoted(),**edit})
    def test_old_local_true_and_new_public_false_blocks_before_any_cf_access(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'activar-cloud.json').write_text(json.dumps(self.promoted()))
            environment=CLIPromotionContract().environment()
            environment['GITHUB_SHA']=REPOSITORY_RELEASE
            with patch.object(scoped,'ROOT',root),patch.dict(os.environ,environment,clear=True),patch.object(sys,'argv',['scoped_content.py','--bootstrap']),patch.object(scoped,'read_latest_config',return_value={**self.promoted(),'datahub_scoped_content_enabled':False}),patch.object(scoped,'CFClient') as cf:
                with self.assertRaisesRegex(scoped.ScopedError,'LATEST_PUBLIC_CONFIG_WRITES_DISABLED'):scoped.main()
                cf.assert_not_called()
    def test_latest_public_stop_is_rechecked_immediately_before_put(self):
        runtime=Runtime();reads=[]
        def authorize():
            reads.append('latest-control')
            scoped.require_latest_promotion(lambda:{**self.promoted(),'datahub_scoped_content_enabled':False})
        client=scoped.ScopedDeployer(runtime,runtime.private_get,sleep=runtime.waits.append,now=NOW,authorize=authorize)
        with self.assertRaisesRegex(scoped.ScopedError,'LATEST_PUBLIC_CONFIG_WRITES_DISABLED'):client.bootstrap(TEMPLATE,PROCESSOR_RELEASE)
        self.assertEqual(reads,['latest-control']);self.assertEqual(runtime.puts,[])
        self.assertGreaterEqual(runtime.bundle_reads,2)

class PublicCodeFingerprintContract(unittest.TestCase):
    def live(self,processor=PROCESSOR_RELEASE,code_hash=CODE_HASH):
        runtime=Runtime(processor_release=processor)
        runtime.bundle=scoped.replace_part(runtime.bundle,'commercial-reception.mjs',CODE_TEMPLATE.replace(scoped.PLACEHOLDER,processor).replace(scoped.CODE_PLACEHOLDER,code_hash).encode())
        runtime.original_bundle=runtime.bundle
        return runtime
    def test_identical_public_code_retains_existing_processor_under_new_repository_revision_without_put(self):
        runtime=self.live();before=copy.deepcopy(runtime.bundle)
        report=runtime.client().bootstrap(CODE_TEMPLATE,REPOSITORY_RELEASE,CODE_HASH)
        self.assertEqual(runtime.puts,[]);self.assertTrue(scoped.same_bundle(before,runtime.bundle))
        self.assertEqual(report['processor_release'],PROCESSOR_RELEASE);self.assertEqual(report['processor_code_sha256'],CODE_HASH)
        self.assertEqual(report['runtime_release'],ALEX_RELEASE);self.assertEqual(report['worker_puts'],0)
        self.assertNotIn(PRIVATE,json.dumps(report));self.assertNotIn('a'*64,json.dumps(report))
    def test_changed_public_code_selects_new_repository_processor_with_only_one_owned_module_put(self):
        runtime=self.live();before=copy.deepcopy(runtime.bundle);new_hash='f'*64
        report=runtime.client().bootstrap(CODE_TEMPLATE,REPOSITORY_RELEASE,new_hash)
        self.assertEqual(len(runtime.puts),1);self.assertEqual(report['processor_release'],REPOSITORY_RELEASE)
        self.assertEqual(report['processor_code_sha256'],new_hash)
        self.assertTrue(all(p==get_part(runtime.bundle,p.name) for p in before.parts if p.name!='commercial-reception.mjs'))
        self.assertEqual(runtime.release,ALEX_RELEASE)
    def test_matching_declared_hash_with_nonmatching_receiver_bytes_fails_without_put(self):
        runtime=self.live();current=get_part(runtime.bundle,'commercial-reception.mjs')
        runtime.bundle=scoped.replace_part(runtime.bundle,current.name,current.body+b'\n// unexpected modified body\n')
        with self.assertRaisesRegex(scoped.ScopedError,'PUBLIC_CODE_HASH_BODY_MISMATCH'):runtime.client().bootstrap(CODE_TEMPLATE,REPOSITORY_RELEASE,CODE_HASH)
        self.assertEqual(runtime.puts,[])
    def test_code_hash_reads_fixed_public_files_and_excludes_config_alex_canonical_and_enrichment(self):
        excluded={'automatizacion/activar-cloud.json','automatizacion/alex.mjs','automatizacion/alex-context.mjs',
            'automatizacion/alex-catalog.mjs','automatizacion/shared-hub.mjs','automatizacion/central/current.json',
            'automatizacion/central/enrichment.json','automatizacion/central-data.mjs','automatizacion/generated/catalogo.json'}
        self.assertTrue(excluded.isdisjoint(set(scoped.CRITICAL_FILES)))
        self.assertIn('automatizacion/commercial-reception.mjs',scoped.CRITICAL_FILES)
        self.assertIn('.github/workflows/central-593.yml',scoped.CRITICAL_FILES)
        with tempfile.TemporaryDirectory() as folder:
            repository=Path(folder)
            for name in scoped.CRITICAL_FILES:
                path=repository/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(('synthetic public source '+name).encode())
            initial=scoped.public_code_hash(repository)
            for name in excluded:
                path=repository/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(PRIVATE+' updated flags/Alex/private source')
            self.assertEqual(scoped.public_code_hash(repository),initial)
            for name in scoped.CRITICAL_FILES:
                path=repository/name;original=path.read_bytes();path.write_bytes(original+b'\nchanged critical source')
                self.assertNotEqual(scoped.public_code_hash(repository),initial)
                path.write_bytes(original)
            (repository/scoped.CRITICAL_FILES[0]).unlink()
            with self.assertRaisesRegex(scoped.ScopedError,'PUBLIC_CODE_REQUIRED'):scoped.public_code_hash(repository)
    def test_cli_ingest_uses_selected_existing_processor_output_instead_of_new_repository_revision(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'central').mkdir()
            (root/'activar-cloud.json').write_text(json.dumps({'activar':False,'datahub_scoped_content_enabled':True}))
            (root/'central/current.json').write_text(json.dumps(source('b',2)));lease_path=root/'lease.json';lease_path.write_text(json.dumps(lease()))
            environment={**CLIPromotionContract().environment(),'GITHUB_SHA':REPOSITORY_RELEASE,'COMMERCIAL_PROCESSOR_EXPECTED_RELEASE':PROCESSOR_RELEASE,'CENTRAL_EXPECTED_SOURCE_SHA256':'b'*64}
            client=Mock();client.ingest.return_value={'ok':True,'ready':True,'runtime_release':ALEX_RELEASE,'processor_release':PROCESSOR_RELEASE}
            with patch.object(scoped,'ROOT',root),patch.dict(os.environ,environment,clear=True),patch.object(sys,'argv',['scoped_content.py','--ingest']),patch.object(scoped,'require_latest_promotion'),patch.object(scoped,'CFClient'),patch.object(scoped,'ScopedDeployer',return_value=client),patch.dict(sys.modules,{'processing_lease':types.SimpleNamespace(location=lambda:lease_path)}),patch('builtins.print'):
                scoped.main()
            self.assertEqual(client.ingest.call_args.args[1],'b'*64)
            self.assertEqual(client.ingest.call_args.args[3],PROCESSOR_RELEASE)
            self.assertNotEqual(client.ingest.call_args.args[3],environment['GITHUB_SHA'])

class CurrentPublicRevisionContract(unittest.TestCase):
    def test_revision_reader_uses_fixed_unauthenticated_no_cache_url_and_bounded_commit_response(self):
        reply=LatestPublicWriterContract.Reply(json.dumps({'object':{'type':'commit','sha':REPOSITORY_RELEASE}}).encode())
        opener=Mock();opener.open.return_value=reply
        with patch.dict(os.environ,{'CLOUDFLARE_API_TOKEN':'synthetic-CF-secret','PILOT_TOKEN':'synthetic-worker-secret'}):
            self.assertEqual(scoped.read_latest_revision(opener),REPOSITORY_RELEASE)
        request=opener.open.call_args.args[0]
        self.assertEqual(request.full_url,'https://api.github.com/repos/conectatech-ec/conectatech-ec.github.io/git/ref/heads/automatizacion/piloto-cloud-3sku-20261015')
        self.assertEqual(request.method,'GET');self.assertIsNone(request.data)
        self.assertIsNone(request.get_header('Authorization'));self.assertIsNone(request.get_header('Cookie'))
        self.assertEqual(request.get_header('Cache-control'),'no-cache');self.assertEqual(reply.read_sizes,[16385])
        self.assertEqual(opener.open.call_args.kwargs['timeout'],30)
    def test_missing_invalid_oversized_denied_and_unavailable_revision_fail_closed(self):
        bodies=[{},[],{'object':None},{'object':{'type':'tag','sha':REPOSITORY_RELEASE}},
            {'object':{'type':'commit','sha':'invalid'}},{'object':{'type':'commit','sha':'D'*40}}]
        replies=[LatestPublicWriterContract.Reply(json.dumps(body).encode()) for body in bodies]
        replies.extend([LatestPublicWriterContract.Reply(b'x'*16385),LatestPublicWriterContract.Reply(b'{}',403),LatestPublicWriterContract.Reply(b'{"object":{},"object":{}}')])
        for reply in replies:
            opener=Mock();opener.open.return_value=reply
            with self.assertRaises(scoped.ScopedError):scoped.read_latest_revision(opener)
        opener=Mock();opener.open.side_effect=RuntimeError(PRIVATE)
        with self.assertRaises(scoped.ScopedError) as raised:scoped.read_latest_revision(opener)
        self.assertNotIn(PRIVATE,str(raised.exception));self.assertTrue(raised.exception.__suppress_context__)
        getter=Mock(return_value=REPOSITORY_RELEASE)
        with self.assertRaisesRegex(scoped.ScopedError,'REVISION_NOT_CURRENT'):scoped.require_latest_revision(PROCESSOR_RELEASE,getter)
        with self.assertRaisesRegex(scoped.ScopedError,'REVISION_NOT_CURRENT'):scoped.require_latest_revision('invalid',getter)
    def test_old_job_cannot_replace_newer_critical_code_when_latest_branch_is_new_revision(self):
        runtime=PublicCodeFingerprintContract().live(processor=REPOSITORY_RELEASE,code_hash='f'*64)
        before=copy.deepcopy(runtime.bundle);checks=[];order=[]
        def revision_check(expected):
            checks.append(expected);order.append('revision')
            scoped.require_latest_revision(expected,lambda:REPOSITORY_RELEASE)
        client=scoped.ScopedDeployer(runtime,runtime.private_get,sleep=runtime.waits.append,now=NOW,
            authorize=lambda:order.append('authorization'),revision_check=revision_check)
        with self.assertRaisesRegex(scoped.ScopedError,'REVISION_NOT_CURRENT'):client.bootstrap(CODE_TEMPLATE,PROCESSOR_RELEASE,CODE_HASH)
        self.assertEqual(checks,[PROCESSOR_RELEASE]);self.assertEqual(order,['authorization','revision'])
        self.assertEqual(runtime.puts,[]);self.assertTrue(scoped.same_bundle(runtime.bundle,before))
    def test_identical_critical_code_keeps_live_old_processor_without_head_match_or_revision_read(self):
        runtime=PublicCodeFingerprintContract().live();checker=Mock(side_effect=AssertionError('No revision request for an unchanged receiver'))
        client=scoped.ScopedDeployer(runtime,runtime.private_get,sleep=runtime.waits.append,now=NOW,revision_check=checker)
        report=client.bootstrap(CODE_TEMPLATE,REPOSITORY_RELEASE,CODE_HASH)
        checker.assert_not_called();self.assertEqual(runtime.puts,[])
        self.assertEqual(report['processor_release'],PROCESSOR_RELEASE);self.assertEqual(report['worker_puts'],0)
    def test_new_critical_code_at_exact_current_head_updates_receiver_once(self):
        runtime=PublicCodeFingerprintContract().live();checks=[]
        def revision_check(expected):
            checks.append(expected);scoped.require_latest_revision(expected,lambda:REPOSITORY_RELEASE)
        client=scoped.ScopedDeployer(runtime,runtime.private_get,sleep=runtime.waits.append,now=NOW,revision_check=revision_check)
        report=client.bootstrap(CODE_TEMPLATE,REPOSITORY_RELEASE,'f'*64)
        self.assertEqual(checks,[REPOSITORY_RELEASE]);self.assertEqual(len(runtime.puts),1)
        self.assertEqual(report['processor_release'],REPOSITORY_RELEASE);self.assertEqual(report['runtime_release'],ALEX_RELEASE)

if __name__=='__main__':unittest.main()
