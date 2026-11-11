"""Patch DataHub-owned modules in the live Worker bundle. All content stays in RAM."""
import base64, hashlib, json, os, re, secrets, subprocess, sys, time, urllib.error, urllib.request
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from email import policy
from email.parser import BytesParser
from pathlib import Path
from scoped_policy import validate_source, source_time, same_source, closed_health, tester_scope

ROOT=Path(__file__).resolve().parent
WORKER='conectatech-comercial-piloto'
SCRIPT='/workers/scripts/'+WORKER
BRANCH='refs/heads/automatizacion/piloto-cloud-3sku-20261015'
MAX_BUNDLE=20_000_000
PLACEHOLDER='__COMMERCIAL_PROCESSOR_RELEASE__'
CODE_PLACEHOLDER='__COMMERCIAL_PROCESSOR_CODE_SHA256__'
PUBLIC_CONFIG_URL='https://api.github.com/repos/conectatech-ec/conectatech-ec.github.io/contents/automatizacion/activar-cloud.json?ref=automatizacion%2Fpiloto-cloud-3sku-20261015'
PUBLIC_REF_URL='https://api.github.com/repos/conectatech-ec/conectatech-ec.github.io/git/ref/heads/automatizacion/piloto-cloud-3sku-20261015'
CRITICAL_FILES=('automatizacion/commercial-reception.mjs','automatizacion/normalizar_593.py',
    'automatizacion/inventory_completeness.py',
    'automatizacion/report_identity.py','automatizacion/processing_lease.py','automatizacion/process_pending_593.py',
    'automatizacion/data_hub_593.py','automatizacion/scoped_content.py','automatizacion/scoped_policy.py',
    'automatizacion/scoped-http.mjs','automatizacion/central-e2e.mjs','.github/workflows/central-593.yml')
MODULE=re.compile(r'[A-Za-z0-9_./-]{1,200}\Z')
SHA=re.compile(r'[a-f0-9]{64}\Z')
RELEASE=re.compile(r'[a-f0-9]{40}\Z')

class ScopedError(RuntimeError):pass
def fail(code):raise ScopedError(code) from None

def strict_json(raw):
    def pairs(values):
        result={}
        for key,value in values:
            if key in result:fail('JSON_DUPLICATE_KEY')
            result[key]=value
        return result
    def constant(_):fail('JSON_CONSTANT_INVALID')
    try:return json.loads(raw,object_pairs_hook=pairs,parse_constant=constant)
    except (ValueError,UnicodeError,TypeError):fail('JSON_INVALID')

def same_json(a,b):
    if type(a) is not type(b):return False
    if isinstance(a,dict):return a.keys()==b.keys() and all(same_json(a[k],b[k]) for k in a)
    if isinstance(a,list):return len(a)==len(b) and all(same_json(x,y) for x,y in zip(a,b))
    return a==b

@dataclass(frozen=True)
class Part:
    name:str
    filename:str
    content_type:str
    body:bytes
    headers:tuple=()

@dataclass(frozen=True)
class Bundle:
    entrypoint:str
    parts:tuple

def safe_name(name):
    return isinstance(name,str) and MODULE.fullmatch(name) and not name.startswith('/') and '..' not in name.split('/')

def parse_bundle(raw,content_type,entrypoint):
    if not isinstance(raw,bytes) or not 1<=len(raw)<=MAX_BUNDLE:fail('BUNDLE_SIZE_INVALID')
    if not safe_name(entrypoint):fail('BUNDLE_ENTRYPOINT_INVALID')
    if not isinstance(content_type,str) or '\r' in content_type or '\n' in content_type:fail('BUNDLE_CONTENT_TYPE_INVALID')
    try:
        message=BytesParser(policy=policy.default).parsebytes(('Content-Type: '+content_type+'\r\nMIME-Version: 1.0\r\n\r\n').encode()+raw)
        boundary=message.get_boundary()
        if message.get_content_type()!='multipart/form-data' or not boundary or not message.is_multipart() or message.defects:
            fail('BUNDLE_MULTIPART_REQUIRED')
        closing=b'--'+boundary.encode('ascii')+b'--'
        if not raw.rstrip(b'\r\n').endswith(closing):fail('BUNDLE_MULTIPART_TRUNCATED')
        parts=[];seen=set()
        for item in message.iter_parts():
            keys=[key.lower() for key,_value in item.items()]
            if len(keys)!=len(set(keys)) or keys.count('content-disposition')!=1 or keys.count('content-type')!=1:
                fail('BUNDLE_HEADER_AMBIGUOUS')
            name=item.get_param('name',header='content-disposition');filename=item.get_filename() or name
            if (item.defects or item.is_multipart() or item.get_content_disposition()!='form-data' or
                not safe_name(name) or not safe_name(filename) or name!=filename or name in seen or name=='metadata'):
                fail('BUNDLE_PART_INVALID')
            if item.get('Content-Transfer-Encoding','binary').lower() not in {'binary','8bit'}:fail('BUNDLE_ENCODING_UNSUPPORTED')
            ctype=str(item.get('Content-Type',''))
            if not ctype or any(char in ctype for char in '\r\n'):fail('BUNDLE_PART_TYPE_INVALID')
            headers=[]
            for key,value in item.items():
                if key.lower() in {'content-disposition','content-type'}:continue
                if not re.fullmatch(r'[A-Za-z0-9-]+',key) or '\r' in str(value) or '\n' in str(value):fail('BUNDLE_HEADER_INVALID')
                headers.append((key,str(value)))
            body=item.get_payload(decode=True)
            if not isinstance(body,bytes):fail('BUNDLE_PART_BODY_INVALID')
            parts.append(Part(name,filename,ctype,body,tuple(headers)));seen.add(name)
        if not 1<=len(parts)<=200 or entrypoint not in seen:fail('BUNDLE_MODULES_INVALID')
        return Bundle(entrypoint,tuple(parts))
    except ScopedError:raise
    except Exception:fail('BUNDLE_PARSE_FAILED')

def same_bundle(a,b):
    return (a.entrypoint==b.entrypoint and len(a.parts)==len(b.parts)==len({p.name for p in a.parts})==len({p.name for p in b.parts}) and
            {p.name:p for p in a.parts}=={p.name:p for p in b.parts})

def encode_bundle(bundle):
    boundary='conectatech-'+secrets.token_hex(20)
    while any(boundary.encode() in part.body for part in bundle.parts):boundary='conectatech-'+secrets.token_hex(20)
    parts=[Part('metadata','metadata','application/json',json.dumps({'main_module':bundle.entrypoint},separators=(',',':')).encode()),*bundle.parts]
    output=[]
    for part in parts:
        header=f'--{boundary}\r\nContent-Disposition: form-data; name="{part.name}"; filename="{part.filename}"\r\nContent-Type: {part.content_type}\r\n'
        header+=''.join(f'{key}: {value}\r\n' for key,value in part.headers)
        output.append(header.encode()+b'\r\n'+part.body+b'\r\n')
    output.append(f'--{boundary}--\r\n'.encode())
    body=b''.join(output)
    if len(body)>MAX_BUNDLE:fail('BUNDLE_UPLOAD_SIZE_INVALID')
    return body,'multipart/form-data; boundary='+boundary

def replace_part(bundle,name,body):
    if name not in {'commercial-reception.mjs','central-data.mjs'}:fail('MODULE_SCOPE_DENIED')
    if sum(part.name==name for part in bundle.parts)!=1:fail('TARGET_MODULE_REQUIRED')
    return Bundle(bundle.entrypoint,tuple(replace(part,body=body,headers=tuple((k,str(len(body)) if k.lower()=='content-length' else v) for k,v in part.headers)) if part.name==name else part for part in bundle.parts))

def bundled_source(bundle):
    values=[part for part in bundle.parts if part.name=='central-data.mjs']
    if len(values)!=1:fail('BUNDLED_SOURCE_REQUIRED')
    body=values[0].body
    if not body.startswith(b'export default ') or not body.rstrip().endswith(b';'):fail('BUNDLED_SOURCE_WRAPPER_INVALID')
    return validate_source(strict_json(body[len(b'export default '):].rstrip()[:-1]))

def processor_release_of(bundle):
    values=[part.body for part in bundle.parts if part.name=='commercial-reception.mjs']
    if len(values)!=1:return None
    matches=re.findall(rb"const COMMERCIAL_PROCESSOR_RELEASE='([a-f0-9]{40})';",values[0])
    return matches[0].decode('ascii') if len(matches)==1 else None

def processor_code_of(bundle):
    values=[part.body for part in bundle.parts if part.name=='commercial-reception.mjs']
    if len(values)!=1:return None
    matches=re.findall(rb"const COMMERCIAL_PROCESSOR_CODE_SHA256='([a-f0-9]{64})';",values[0])
    return matches[0].decode('ascii') if len(matches)==1 else None

def public_code_hash(repository=None):
    # This hash covers PUBLIC SOURCE CODE ONLY. Never add data or runtime modules.
    repository=Path(repository) if repository is not None else ROOT.parent
    digest=hashlib.sha256()
    try:
        for name in CRITICAL_FILES:
            value=(repository/name).read_bytes()
            if not value or len(value)>2_000_000:fail('PUBLIC_CODE_SIZE_INVALID')
            digest.update(name.encode()+b'\0'+len(value).to_bytes(8,'big')+value)
    except OSError:fail('PUBLIC_CODE_REQUIRED')
    return digest.hexdigest()

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):fail('CF_REDIRECT_DENIED')

def read_latest_config(opener=None):
    # Public fixed GitHub endpoint: no Cloudflare or Worker credential is sent.
    request=urllib.request.Request(PUBLIC_CONFIG_URL,method='GET',headers={
        'Accept':'application/vnd.github+json','Cache-Control':'no-cache','Pragma':'no-cache','User-Agent':'CONECTATECH-scoped-content-control'})
    try:
        client=opener or urllib.request.build_opener(NoRedirect())
        with client.open(request,timeout=30) as response:
            raw=response.read(65537)
            if response.status!=200 or len(raw)>65536:fail('LATEST_PUBLIC_CONFIG_READ_FAILED')
        envelope=strict_json(raw)
        if not isinstance(envelope,dict) or envelope.get('encoding')!='base64' or not isinstance(envelope.get('content'),str):fail('LATEST_PUBLIC_CONFIG_INVALID')
        value=base64.b64decode(''.join(envelope['content'].split()),validate=True)
        if len(value)>16384:fail('LATEST_PUBLIC_CONFIG_INVALID')
        config=strict_json(value)
        if not isinstance(config,dict):fail('LATEST_PUBLIC_CONFIG_INVALID')
        return config
    except ScopedError:raise
    except Exception:fail('LATEST_PUBLIC_CONFIG_READ_FAILED')

def require_latest_promotion(getter=None):
    config=(getter or read_latest_config)()
    if (config.get('activar') is not False or config.get('sincronizar_meta_verify_token',False) is not False or
        config.get('datahub_scoped_content_enabled') is not True):fail('LATEST_PUBLIC_CONFIG_WRITES_DISABLED')

def read_latest_revision(opener=None):
    request=urllib.request.Request(PUBLIC_REF_URL,method='GET',headers={
        'Accept':'application/vnd.github+json','Cache-Control':'no-cache','Pragma':'no-cache','User-Agent':'CONECTATECH-scoped-content-control'})
    try:
        client=opener or urllib.request.build_opener(NoRedirect())
        with client.open(request,timeout=30) as response:
            raw=response.read(16385)
            if response.status!=200 or len(raw)>16384:fail('LATEST_PUBLIC_REVISION_READ_FAILED')
        value=strict_json(raw);obj=value.get('object') if isinstance(value,dict) else None
        revision=obj.get('sha') if isinstance(obj,dict) else None
        if not isinstance(revision,str) or not RELEASE.fullmatch(revision) or obj.get('type')!='commit':fail('LATEST_PUBLIC_REVISION_INVALID')
        return revision
    except ScopedError:raise
    except Exception:fail('LATEST_PUBLIC_REVISION_READ_FAILED')

def require_latest_revision(expected,getter=None):
    if not isinstance(expected,str) or not RELEASE.fullmatch(expected) or (getter or read_latest_revision)()!=expected:
        fail('BOOTSTRAP_REVISION_NOT_CURRENT')

class CFClient:
    def __init__(self,account,token,opener=None):
        if not re.fullmatch(r'[a-f0-9]{32}',account or '') or not token:fail('CF_CONFIGURATION_REQUIRED')
        self.base='https://api.cloudflare.com/client/v4/accounts/'+account
        self.token=token;self.opener=opener or urllib.request.build_opener(NoRedirect())
    def request(self,path,method='GET',data=None,content_type=None):
        allowed={(SCRIPT+'/settings','GET'),(SCRIPT+'/content/v2','GET'),(SCRIPT+'/content','PUT')}
        if (path,method) not in allowed or method=='GET' and data is not None:fail('CF_SCOPE_DENIED')
        headers={'Authorization':'Bearer '+self.token,'Cache-Control':'no-cache','Accept':'application/json' if path.endswith('/settings') else '*/*'}
        if content_type:headers['Content-Type']=content_type
        req=urllib.request.Request(self.base+path,method=method,data=data,headers=headers)
        try:
            with self.opener.open(req,timeout=45) as response:
                raw=response.read(MAX_BUNDLE+1)
                if response.status!=200 or len(raw)>MAX_BUNDLE:fail('CF_RESPONSE_INVALID')
                return raw,dict(response.headers)
        except ScopedError:raise
        except urllib.error.HTTPError as error:fail('CF_HTTP_'+str(error.code))
        except Exception:fail('CF_REQUEST_FAILED; credentials and response withheld')
    def get_settings(self):
        raw,_=self.request(SCRIPT+'/settings');body=strict_json(raw)
        if not isinstance(body,dict) or body.get('success') is not True or not isinstance(body.get('result'),dict):fail('CF_SETTINGS_INVALID')
        return body['result']
    def get_bundle(self):
        raw,headers=self.request(SCRIPT+'/content/v2');headers={k.lower():v for k,v in headers.items()}
        return parse_bundle(raw,headers.get('content-type'),headers.get('cf-entrypoint'))
    def put_bundle(self,bundle):
        body,ctype=encode_bundle(bundle);raw,_=self.request(SCRIPT+'/content','PUT',body,ctype)
        response=strict_json(raw)
        if not isinstance(response,dict) or response.get('success') is not True:fail('CF_UPLOAD_REJECTED')
        result=response.get('result') or {};observed={}
        if isinstance(result,dict):
            for key in ('version_id','deployment_id'):
                value=result.get(key)
                if isinstance(value,str) and re.fullmatch(r'[a-f0-9-]{16,64}',value):observed['provider_'+key]=value
        return observed

def private_get(path):
    allowed={'/health','/commercial/catalog','/commercial/catalog/status','/messenger/status','/messenger/seller/status'}
    if path not in allowed:fail('PRIVATE_READ_SCOPE_DENIED')
    try:
        child=subprocess.run(['node',str(ROOT/'scoped-http.mjs'),path],input='',capture_output=True,text=True,timeout=55)
        result=strict_json(child.stdout)
        if child.returncode or result.get('status')!=200:fail('PRIVATE_HTTP_200_REQUIRED')
        raw=base64.b64decode(result['bytes_b64'],validate=True)
        if len(raw)>2_000_000:fail('PRIVATE_BODY_TOO_LARGE')
        data=strict_json(raw)
        if not isinstance(data,dict):fail('PRIVATE_BODY_INVALID')
        return data
    except ScopedError:raise
    except Exception:fail('PRIVATE_READ_FAILED; private values withheld')

def validate_update(compiled,current,expected,lease,now):
    validate_source(compiled);validate_source(current)
    if not isinstance(expected,str) or not SHA.fullmatch(expected) or compiled['source']['sha256']!=expected:fail('SOURCE_EXPECTED_SHA_MISMATCH')
    if (not isinstance(lease,dict) or lease.get('sha256')!=expected or not isinstance(lease.get('lease_token'),str) or
        not re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}',lease['lease_token'])):
        fail('SOURCE_SAME_JOB_LEASE_REQUIRED')
    if expected==current['source']['sha256']:
        if not same_source(compiled,current):fail('SOURCE_SAME_SHA_DIFFERENT_BODY')
        return False
    if source_time(compiled['source']['generated_at'])<=source_time(current['source']['generated_at']):fail('SOURCE_GENERATION_MUST_ADVANCE')
    if source_time(compiled['expires_at'])<now:fail('SOURCE_UPDATE_EXPIRED')
    source=compiled['source']
    if (source.get('cut_date_evidence') not in {'593_matching_created_modified','report_heading_and_export_timestamp','legacy_filename_and_export_timestamp'} or
        source.get('mapping')!={'sku':'D','name':'C','availability':'B>0','promo_cash':'Q','pvp_card':'X+Y'}):fail('SOURCE_VALIDATION_EVIDENCE_REQUIRED')
    return True

class ScopedDeployer:
    def __init__(self,api,private_get=private_get,sleep=time.sleep,now=None,authorize=None,revision_check=None):
        self.api=api;self.private_get=private_get;self.sleep=sleep;self.now=now;self.authorize=authorize or (lambda:None)
        self.revision_check=revision_check or (lambda revision:None)
    def timestamp(self):return self.now or datetime.now(timezone.utc)
    def capture(self):
        settings=self.api.get_settings();bundle=self.api.get_bundle()
        health=closed_health(self.private_get('/health'))
        if not RELEASE.fullmatch(health['release']):fail('RUNTIME_RELEASE_SHA_REQUIRED')
        tester_scope(self.private_get,health['messenger_outbound'])
        source=validate_source(self.private_get('/commercial/catalog'))
        if not same_json(bundled_source(bundle),source):fail('BUNDLED_AND_HTTP_SOURCE_DIFFER')
        closed_health(self.private_get('/health'),health['messenger_outbound'],health['release'])
        # The release is the existing Alex binding, never the new DataHub revision.
        bindings=settings.get('bindings')
        if not isinstance(bindings,list):fail('CF_BINDINGS_REQUIRED')
        releases=[b for b in bindings if b.get('name')=='PILOT_RELEASE']
        if len(releases)!=1 or releases[0].get('type')!='plain_text' or releases[0].get('text')!=health['release']:fail('CF_RUNTIME_RELEASE_MISMATCH')
        return {'settings':settings,'bundle':bundle,'health':health,'source':source}
    def receipt(self,capture,mode,**extra):
        return {'schema':'conectatech.scoped-content.v1','ok':True,'mode':mode,
            'runtime_release':capture['health']['release'],'tester_transport_enabled':capture['health']['messenger_outbound'],
            'general_reception_enabled':False,'private_body_recorded':False,'private_fingerprint_recorded':False,
            'settings_preserved':True,'unowned_modules_preserved':True,**extra}
    def inspect(self):
        capture=self.capture()
        if not same_bundle(self.api.get_bundle(),capture['bundle']) or not same_json(self.api.get_settings(),capture['settings']):fail('INSPECT_RUNTIME_CHANGED')
        observed=self.timestamp()
        return self.receipt(capture,'inspect',read_only=True,ready=True,worker_puts=0,module_count=len(capture['bundle'].parts),processor_release=processor_release_of(capture['bundle']),processor_code_sha256=processor_code_of(capture['bundle']),
            observed_at=observed.isoformat().replace('+00:00','Z'),source_fresh=source_time(capture['source']['expires_at'])>=observed,
            runtime_bundle_readable=True,provider_version_observed=False)
    def require_ingest_receiver(self,capture,receiver_text):
        release=processor_release_of(capture['bundle']);code=processor_code_of(capture['bundle'])
        if not release or not code:fail('INGEST_RECEIVER_STAMPS_REQUIRED')
        if receiver_text.count(PLACEHOLDER)!=1 or receiver_text.count(CODE_PLACEHOLDER)!=1:fail('RECEIVER_TEMPLATE_REQUIRED')
        expected=receiver_text.replace(PLACEHOLDER,release).replace(CODE_PLACEHOLDER,code).encode()
        actual=next(p.body for p in capture['bundle'].parts if p.name=='commercial-reception.mjs')
        if actual!=expected:fail('INGEST_RECEIVER_INCOMPATIBLE')
        status=self.private_get('/commercial/catalog/status')
        if status.get('processor_release')!=release or status.get('processor_code_sha256')!=code:fail('INGEST_RECEIVER_STATUS_MISMATCH')
        return release
    def check_ingest(self,receiver_text):
        capture=self.capture();release=self.require_ingest_receiver(capture,receiver_text)
        if not same_bundle(self.api.get_bundle(),capture['bundle']) or not same_json(self.api.get_settings(),capture['settings']):fail('INSPECT_RUNTIME_CHANGED')
        return self.receipt(capture,'check_ingest',read_only=True,ready=True,worker_puts=0,
            receiver_body_matches=True,processor_release=release)
    def check_before_put(self,capture):
        if not same_bundle(self.api.get_bundle(),capture['bundle']) or not same_json(self.api.get_settings(),capture['settings']):fail('RUNTIME_CHANGED_BEFORE_PUT')
        closed_health(self.private_get('/health'),capture['health']['messenger_outbound'],capture['health']['release'])
        tester_scope(self.private_get,capture['health']['messenger_outbound'])
        if not same_json(self.private_get('/commercial/catalog'),capture['source']):fail('SOURCE_CHANGED_BEFORE_PUT')
    def commit(self,capture,expected,allowed,selected,processor_release=None):
        before=capture['bundle'];enabled=capture['health']['messenger_outbound'];release=capture['health']['release']
        if allowed not in ({'commercial-reception.mjs'},{'central-data.mjs'}):fail('MODULE_SCOPE_DENIED')
        if before.entrypoint!=expected.entrypoint or {p.name for p in before.parts}!={p.name for p in expected.parts}:fail('BUNDLE_LAYOUT_CHANGED')
        if any(p!=next(q for q in expected.parts if q.name==p.name) for p in before.parts if p.name not in allowed):fail('UNOWNED_MODULE_CHANGED')
        if not same_json(bundled_source(expected),selected):fail('EXPECTED_SOURCE_BUNDLE_MISMATCH')
        if allowed=={'commercial-reception.mjs'} and not same_json(selected,capture['source']):fail('BOOTSTRAP_CANNOT_CHANGE_SOURCE')
        self.check_before_put(capture)
        if allowed=={'central-data.mjs'} and not same_source(selected,capture['source']) and source_time(selected['expires_at'])<self.timestamp():fail('SOURCE_UPDATE_EXPIRED_BEFORE_PUT')
        self.authorize() # Re-read current public control, including on an old-job rerun.
        no_change=same_bundle(before,expected)
        if allowed=={'commercial-reception.mjs'} and not no_change:self.revision_check(processor_release)
        provider={} if no_change else self.api.put_bundle(expected) # Exactly one mutation; never retried.
        for attempt in range(1,13):
            actual=self.api.get_bundle()
            if not same_json(self.api.get_settings(),capture['settings']):fail('SETTINGS_CHANGED_AFTER_PUT')
            closed_health(self.private_get('/health'),enabled,release);tester_scope(self.private_get,enabled)
            if not same_bundle(actual,expected) and not same_bundle(actual,before):fail('UNEXPECTED_BUNDLE_AFTER_PUT')
            source=validate_source(self.private_get('/commercial/catalog'))
            source_matches=same_source(source,selected) if allowed=={'central-data.mjs'} else same_json(source,selected)
            if not source_matches and not same_json(source,capture['source']):fail('UNEXPECTED_SOURCE_AFTER_PUT')
            if same_bundle(actual,expected) and source_matches:
                closed_health(self.private_get('/health'),enabled,release)
                if processor_release:
                    status=self.private_get('/commercial/catalog/status')
                    if status.get('processor_release')!=processor_release:fail('PROCESSOR_RELEASE_NOT_VERIFIED')
                return self.receipt(capture,'bootstrap' if allowed=={'commercial-reception.mjs'} else 'ingest',
                    ready=True,processor_release=processor_release,worker_puts=0 if no_change else 1,
                    full_comparison_in_memory=True,equal_except_published_at=allowed=={'central-data.mjs'},
                    original_expiry_preserved=True,health_attempts=attempt,provider_version_observed=bool(provider),**provider)
            if attempt==12:fail('SCOPED_PROPAGATION_FAILED; no repeated upload')
            self.sleep(2)
    def bootstrap(self,receiver_text,processor_release,code_sha=None):
        if not isinstance(processor_release,str) or not RELEASE.fullmatch(processor_release):fail('PROCESSOR_RELEASE_REQUIRED')
        if not isinstance(receiver_text,str) or receiver_text.count(PLACEHOLDER)!=1:fail('RECEIVER_TEMPLATE_REQUIRED')
        if code_sha is not None and (not isinstance(code_sha,str) or not SHA.fullmatch(code_sha) or receiver_text.count(CODE_PLACEHOLDER)!=1):fail('PUBLIC_CODE_TEMPLATE_REQUIRED')
        capture=self.capture()
        if code_sha is not None and processor_code_of(capture['bundle'])==code_sha:
            current_release=processor_release_of(capture['bundle'])
            current=[part.body for part in capture['bundle'].parts if part.name=='commercial-reception.mjs'][0]
            rendered=receiver_text.replace(PLACEHOLDER,current_release or '').replace(CODE_PLACEHOLDER,code_sha).encode()
            if not current_release or current!=rendered:fail('PUBLIC_CODE_HASH_BODY_MISMATCH')
            processor_release=current_release
        body=receiver_text.replace(PLACEHOLDER,processor_release)
        if code_sha is not None:body=body.replace(CODE_PLACEHOLDER,code_sha)
        body=body.encode()
        expected=replace_part(capture['bundle'],'commercial-reception.mjs',body)
        receipt=self.commit(capture,expected,{'commercial-reception.mjs'},capture['source'],processor_release)
        if code_sha is not None:receipt['processor_code_sha256']=code_sha
        return receipt
    def ingest(self,compiled,expected_sha,lease,processor_release=None,receiver_text=None):
        if processor_release is not None and (not isinstance(processor_release,str) or not RELEASE.fullmatch(processor_release)):fail('PROCESSOR_RELEASE_REQUIRED')
        capture=self.capture()
        if receiver_text is not None:self.require_ingest_receiver(capture,receiver_text)
        validate_update(compiled,capture['source'],expected_sha,lease,self.timestamp())
        if processor_release and processor_release_of(capture['bundle'])!=processor_release:fail('BUNDLED_PROCESSOR_RELEASE_DIFFER')
        if processor_release and self.private_get('/commercial/catalog/status').get('processor_release')!=processor_release:fail('PROCESSOR_RELEASE_NOT_VERIFIED')
        selected={**compiled,'published_at':self.timestamp().isoformat().replace('+00:00','Z')}
        if same_source(compiled,capture['source']):selected=capture['source']
        if selected is capture['source']:expected=capture['bundle']
        else:
            body=b'export default '+json.dumps(selected,ensure_ascii=False,allow_nan=False,separators=(',',':')).encode()+b';\n'
            expected=replace_part(capture['bundle'],'central-data.mjs',body)
        return self.commit(capture,expected,{'central-data.mjs'},selected,processor_release)

def main():
    if len(sys.argv)!=2 or sys.argv[1] not in {'--inspect','--check-ingest','--bootstrap','--ingest'}:fail('SCOPED_CLI_INVALID')
    if os.environ.get('GITHUB_REF')!=BRANCH:fail('PILOT_BRANCH_REQUIRED')
    if os.environ.get('CF_FREE_ONLY_CONFIRMED')!='true':fail('FREE_ONLY_CONFIRMATION_REQUIRED')
    config=strict_json((ROOT/'activar-cloud.json').read_bytes())
    if config.get('activar') is not False or config.get('sincronizar_meta_verify_token') is True:fail('FULL_DEPLOY_MUST_STAY_DISABLED')
    if sys.argv[1] not in {'--inspect','--check-ingest'} and config.get('datahub_scoped_content_enabled') is not True:fail('SCOPED_WRITES_NOT_PROMOTED')
    if sys.argv[1] not in {'--inspect','--check-ingest'}:require_latest_promotion()
    api=CFClient(os.environ.get('CLOUDFLARE_ACCOUNT_ID'),os.environ.get('CLOUDFLARE_API_TOKEN'))
    client=ScopedDeployer(api,authorize=require_latest_promotion,revision_check=require_latest_revision);mode=sys.argv[1];release=os.environ.get('GITHUB_SHA','')
    if mode=='--inspect':report=client.inspect()
    elif mode=='--check-ingest':report=client.check_ingest((ROOT/'commercial-reception.mjs').read_text())
    elif mode=='--bootstrap':report=client.bootstrap((ROOT/'commercial-reception.mjs').read_text(),release,public_code_hash())
    else:
        import processing_lease
        path=processing_lease.location()
        if path.stat().st_size>4096:fail('LEASE_FILE_TOO_LARGE')
        data=(ROOT/'central/current.json').read_bytes()
        if len(data)>2_000_000:fail('COMPILED_SOURCE_TOO_LARGE')
        expected_processor=os.environ.get('COMMERCIAL_PROCESSOR_EXPECTED_RELEASE','')
        if not RELEASE.fullmatch(expected_processor):fail('PROCESSOR_RELEASE_REQUIRED')
        report=client.ingest(strict_json(data),os.environ.get('CENTRAL_EXPECTED_SOURCE_SHA256'),strict_json(path.read_bytes()),expected_processor,
            receiver_text=(ROOT/'commercial-reception.mjs').read_text())
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'],'a') as output:
            for key in ('ready','runtime_release','processor_release'):
                if key in report and report[key] is not None:output.write(key+'='+str(report[key]).lower()+'\n')
    print(json.dumps(report,separators=(',',':')))
    if mode=='--check-ingest':
        receipt={key:report[key] for key in ('ready','read_only','worker_puts','runtime_release','processor_release','receiver_body_matches')}
        print('::notice title=DataHub receptor lectura::'+json.dumps(receipt,separators=(',',':')))

if __name__=='__main__':
    try:main()
    except Exception as error:
        code=str(error).split(';',1)[0] if isinstance(error,(ScopedError,ValueError)) and re.fullmatch(r'[A-Z0-9_]+(?:; [a-z ]+)?',str(error)) else 'SCOPED_CONTENT_FAILED'
        print(json.dumps({'schema':'conectatech.scoped-content.v1','ok':False,'error':code,'private_values_recorded':False}))
        if sys.argv[1:]==['--check-ingest']:print('::error title=DataHub receptor lectura::'+code)
        sys.exit(1)
