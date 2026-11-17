"""PR388 content-only installation using the existing scoped transport and bundle.

Private captures are sealed with the existing cipher before persistence. No source,
receiver, settings, secrets, lease or commercial activation operation is available.
"""
import base64,gzip,hashlib,json,os,subprocess,sys,time,urllib.request
from dataclasses import replace
from pathlib import Path
from scoped_content import (CFClient,ScopedDeployer,Bundle,Part,ScopedError,receiver_error_code,
    same_bundle,same_json,bundled_source,encode_bundle,read_latest_revision)
from scoped_policy import closed_health,tester_scope

ROOT=Path(__file__).resolve().parent
ARTIFACT_COMMIT='1567ea58d12e698691889ca164cf8398616807ca'
MANIFEST_SHA='c816421a8d755bdc757cbce632f8d5c331e7c8b3748364b2ce6d3ee13bd415e3'
BASE_RELEASE='acfc00763dfbc7ac34c2c62f9ccecea4f613c870'
RECEIVER_SHA='699ac61bcf8311ac72bdf56c723e3c562882517909c443d9521d5b132624b869'
SOURCE_SHA='caaa9a78fe8479f87197005e352489b65230c174d79401ed7bbe4febbcc7de76'
CONTROL=ROOT.parent/'.github/checkout-install-once.json'
TARGET=ROOT/'generated/fase2/checkout-install'
AUTHORIZATION='DG-CHECKOUT-ACTIVE-44006715609-ONCE'
ACTIVE_BASE_RUN='44006715609'
ACTIVE_DELTA_SHA='30230fcaacec6af22f2f642bf6175f03f7c316488bc57af6b4c363475d028d35'
BRANCH='refs/heads/automatizacion/piloto-cloud-3sku-20261015'
KNOWN_BASES={'worker.mjs':{'d16c5fe25fe0288a6835da8510b88c4239a18f6ff82979d24d018d335f15dc62'},
    'messenger-store.mjs':{'07238457b4a0c272cb62db7389ff1eb042ee987df56900529c4705e2e2673cae'}}
PINNED_AFTER={'worker.mjs':'57226559e6ab2a151e2ff9297a6dea0805bd3fbbbf7126716c0a298efa55794e',
    'messenger-store.mjs':'f77dd1a5e253beef8a52fdd3a43b01f4e995c68953566f7c3052c6eb099c3047'}

class CheckoutError(RuntimeError):pass
def fail(code):raise CheckoutError(code) from None
def diagnostic(error):
    if isinstance(error,CheckoutError):return error.args[0]
    if isinstance(error,ScopedError):return receiver_error_code(error)
    return 'CHECKOUT_SCOPED_OPERATION_FAILED'
def sha(value):return hashlib.sha256(value).hexdigest()
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT.parent,stderr=subprocess.DEVNULL).decode().strip()
def compiled(body):return body.replace(b"import catalog from './generated/catalogo.json' with {type:'json'};",b"import catalog from './catalog.mjs';")

def approved_artifacts():
    raw=(ROOT/'checkout-integration.json').read_bytes()
    if sha(raw)!=MANIFEST_SHA:fail('CHECKOUT_MANIFEST_CHANGED')
    manifest=json.loads(raw)
    if len(manifest['runtime_modules'])!=8:fail('CHECKOUT_SCOPE_CHANGED')
    replacements={}
    for item in manifest['runtime_modules']:
        name=Path(item['path']).name
        body=(ROOT/name).read_bytes()
        if sha(body)!=item['after_sha256']:fail('CHECKOUT_ARTIFACT_CHANGED')
        replacements[name]=body
    config=replacements['checkout-config.mjs']
    if b'enabled: false' not in config or b'deliveries: []' not in config:fail('CHECKOUT_MUST_STAY_DISABLED')
    flags=json.loads((ROOT/'activar-cloud.json').read_bytes())
    if flags.get('activar') is not False or flags.get('datahub_scoped_content_enabled') is not False or flags.get('costo_maximo_usd')!=0:
        fail('CHECKOUT_COMMERCIAL_FLAGS_CHANGED')
    for item in manifest['protected_paths']:
        if sha((ROOT.parent/item['path']).read_bytes())!=item['sha256']:fail('CHECKOUT_PROTECTED_FILE_CHANGED')
    return manifest,replacements

def prepare_bundle(before,manifest,replacements):
    names=[p.name for p in before.parts]
    patches={Path(x['path']).name:x for x in manifest['runtime_modules'] if x['operation']=='patch'}
    additions={Path(x['path']).name for x in manifest['runtime_modules'] if x['operation']=='add'}
    if (before.entrypoint!='worker.mjs' or len(set(names))!=len(names) or len(additions)!=6 or
        set(patches)!={'worker.mjs','messenger-store.mjs'} or not set(patches).issubset(names) or additions.intersection(names)):
        fail('CHECKOUT_LIVE_LAYOUT_CHANGED')
    result=[]
    for part in before.parts:
        if part.name not in patches:result.append(part);continue
        if sha(part.body) not in KNOWN_BASES[part.name]:fail('CHECKOUT_LIVE_BASE_NOT_APPROVED')
        body=part.body
        for change in patches[part.name]['replacements']:
            old,new=compiled(change['before'].encode()),compiled(change['after'].encode())
            if body.count(old)!=1 or new in body:fail('CHECKOUT_HOOK_ANCHOR_CHANGED')
            body=body.replace(old,new,1)
        if sha(body)!=PINNED_AFTER[part.name]:fail('CHECKOUT_CANDIDATE_NOT_PINNED')
        headers=tuple((k,str(len(body)) if k.lower()=='content-length' else v) for k,v in part.headers)
        result.append(replace(part,body=body,headers=headers))
    for name in sorted(additions):result.append(Part(name,name,'application/javascript+module',replacements[name]))
    after=Bundle(before.entrypoint,tuple(result))
    rollback_candidate(before,after,after,{}, {})
    # The existing Worker already exists; this only checks its Free payload limit.
    if len(gzip.compress(encode_bundle(after)[0]))>=3_000_000:fail('CHECKOUT_FREE_BUNDLE_LIMIT')
    return after

def rollback_candidate(before,after,actual,settings,expected_settings):
    if not same_bundle(actual,after) or not same_json(settings,expected_settings):fail('CHECKOUT_RECOVERY_RUNTIME_CHANGED')
    originals={p.name:p for p in before.parts}
    candidate=Bundle(actual.entrypoint,tuple(originals[p.name] if p.name in {'worker.mjs','messenger-store.mjs'} else p
        for p in actual.parts if p.name in originals))
    if not same_bundle(candidate,before):fail('CHECKOUT_RECOVERY_NOT_EXACT')
    return candidate

def require_permission():
    c=json.loads(CONTROL.read_bytes())
    if (c.get('enabled') is not True or c.get('authorization')!=AUTHORIZATION or
        c.get('active_base_run')!=ACTIVE_BASE_RUN or c.get('delta_sha256')!=ACTIVE_DELTA_SHA or
        c.get('artifact_commit')!=ARTIFACT_COMMIT or c.get('manifest_sha256')!=MANIFEST_SHA or
        c.get('cost_max_usd')!=0 or os.environ.get('GITHUB_REF')!=BRANCH or
        os.environ.get('GITHUB_EVENT_NAME')!='push' or os.environ.get('GITHUB_RUN_ATTEMPT')!='1' or
        os.environ.get('CF_FREE_ONLY_CONFIRMED')!='true' or
        os.environ.get('CHECKOUT_INSTALL_AUTHORIZATION')!=AUTHORIZATION):fail('CHECKOUT_PERMISSION_NOT_VALID')
    if git('rev-parse','HEAD')!=os.environ.get('GITHUB_SHA') or git('rev-parse','HEAD^')!=c.get('authorized_parent'):
        fail('CHECKOUT_PERMISSION_PARENT_CHANGED')
    if git('diff-tree','--no-commit-id','--name-only','-r','HEAD').splitlines()!=['.github/checkout-install-once.json']:
        fail('CHECKOUT_ACTIVATION_SCOPE_CHANGED')
    if read_latest_revision()!=os.environ['GITHUB_SHA']:fail('CHECKOUT_REVISION_NO_LONGER_CURRENT')
    return c

def pack_capture(capture):
    return {'entrypoint':capture['bundle'].entrypoint,'parts':[dict(name=p.name,filename=p.filename,
        content_type=p.content_type,headers=p.headers,body=base64.b64encode(p.body).decode()) for p in capture['bundle'].parts],
        'settings':capture['settings'],'health':capture['health']}

def unpack_capture(value):
    bundle=Bundle(value['entrypoint'],tuple(Part(p['name'],p['filename'],p['content_type'],
        base64.b64decode(p['body'],validate=True),tuple(map(tuple,p['headers']))) for p in value['parts']))
    return {'bundle':bundle,'settings':value['settings'],'health':value['health'],'source':bundled_source(bundle)}

def cipher(value,opening=False):
    operation='unseal' if opening else 'seal'
    code=("import {"+operation+"} from './automatizacion/messenger-control.mjs';"
        "let s='';for await(const c of process.stdin)s+=c;"
        "process.stdout.write(await "+operation+"(s,process.env.PILOT_TOKEN));")
    result=subprocess.run(['node','--input-type=module','-e',code],cwd=ROOT.parent,input=value,
        capture_output=True,text=True,timeout=30)
    if result.returncode:fail('CHECKOUT_BACKUP_CIPHER_FAILED')
    return result.stdout

def require_capture(capture):
    if capture['health']['release']!=BASE_RELEASE:fail('CHECKOUT_RUNTIME_RELEASE_CHANGED')
    parts={p.name:p for p in capture['bundle'].parts}
    if 'commercial-reception.mjs' not in parts or sha(parts['commercial-reception.mjs'].body)!=RECEIVER_SHA:
        fail('CHECKOUT_RECEIVER_CHANGED')
    if capture['source']['source']['sha256']!=SOURCE_SHA:fail('CHECKOUT_SOURCE_CHANGED')

def safe_report(**fields):
    TARGET.mkdir(parents=True,exist_ok=True)
    report={'schema':'conectatech.checkout-install.v1','worker':'conectatech-comercial-piloto',
        'artifact_commit':ARTIFACT_COMMIT,'execution_commit':os.environ.get('GITHUB_SHA'),
        'run_id':os.environ.get('GITHUB_RUN_ID'),'checkout_enabled':False,'deliveries':[],
        'activar':False,'datahub_scoped_content_enabled':False,'cost_additional_usd':0,**fields}
    (TARGET/'receipt.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,separators=(',',':')))
    return report

def closure_probe():
    for path,anonymous,status,error in [('/api/compra/catalogo',False,503,'COMPRA_NO_HABILITADA'),
        ('/api/compra/admin/pedidos',True,401,'Unauthorized'),
        ('/api/compra/admin/pedidos',False,503,'COMPRA_NO_HABILITADA')]:
        child=subprocess.run(['node',str(ROOT/'scoped-http.mjs'),path,*(['--anonymous'] if anonymous else [])],
            capture_output=True,text=True,timeout=55)
        try:
            envelope=json.loads(child.stdout);body=json.loads(base64.b64decode(envelope['bytes_b64']))
            passed=not child.returncode and envelope['status']==status and body.get('error')==error
        except Exception:passed=False
        if not passed:fail('CHECKOUT_CLOSURE_NOT_VERIFIED')

def verify(api,guard,capture,expected,probe=closure_probe,sleep=time.sleep):
    for attempt in range(6):
        actual=api.get_bundle()
        if not same_json(api.get_settings(),capture['settings']):fail('CHECKOUT_SETTINGS_CHANGED')
        if not same_bundle(actual,expected) and not same_bundle(actual,capture['bundle']):fail('CHECKOUT_UNEXPECTED_BUNDLE')
        guard.check_before_put({**capture,'bundle':actual})
        if same_bundle(actual,expected):probe();return
        if attempt<5:sleep(2)
    fail('CHECKOUT_PROPAGATION_NOT_VERIFIED')

def perform_install(api,guard,capture,expected,authorize=require_permission,probe=closure_probe,sleep=time.sleep):
    counts={'installation':0,'recovery':0};phase='pre_write_check'
    guard.check_before_put(capture);authorize()
    try:
        phase='installation_put';counts['installation']=1
        provider=api.put_bundle(expected)
        phase='post_install_verification';verify(api,guard,capture,expected,probe,sleep)
        return dict(status='INSTALLED_VERIFIED',worker_puts=counts,provider=provider or {},
            settings_preserved=True,source_preserved=True,receiver_preserved=True,other_modules_preserved=True,
            previous_services_verified=True,public_checkout_http=503,admin_unauthorized_http=401,
            admin_disabled_http=503,recovery='not_needed')
    except Exception as error:
        initial=diagnostic(error)
        result=dict(status='BLOCKED',phase=phase,error=initial,worker_puts=counts)
        try:
            actual=api.get_bundle();settings=api.get_settings()
            if same_bundle(actual,capture['bundle']) and same_json(settings,capture['settings']):
                result['recovery']='not_needed_original_bundle_active';return result
            recovery=rollback_candidate(capture['bundle'],expected,actual,settings,capture['settings'])
            guard.check_before_put({**capture,'bundle':actual});authorize()
            # Recheck exactly, including source, immediately before this recovery.
            rollback_candidate(capture['bundle'],expected,api.get_bundle(),api.get_settings(),capture['settings'])
            counts['recovery']=1;api.put_bundle(recovery)
            verify(api,guard,{**capture,'bundle':expected},recovery,lambda:None,sleep)
            result['recovery']='specific_inverse_verified'
        except Exception:
            result['recovery']='blocked_no_further_writes'
        return result

def main(mode):
    if mode not in {'--prepare','--install'}:fail('CHECKOUT_CLI_SCOPE_DENIED')
    require_permission();manifest,replacements=approved_artifacts()
    api=CFClient(os.environ.get('CLOUDFLARE_ACCOUNT_ID'),os.environ.get('CLOUDFLARE_API_TOKEN'))
    guard=ScopedDeployer(api)
    TARGET.mkdir(parents=True,exist_ok=True)
    backup=TARGET/'receiver-and-worker-backup.sealed.json'
    if mode=='--prepare':
        capture=guard.capture();require_capture(capture)
        expected=prepare_bundle(capture['bundle'],manifest,replacements)
        guard.check_before_put(capture);require_permission()
        plaintext=json.dumps(pack_capture(capture),separators=(',',':'))
        sealed=cipher(plaintext)
        if cipher(sealed,True)!=plaintext:fail('CHECKOUT_BACKUP_ROUNDTRIP_FAILED')
        backup.write_text(sealed);backup.chmod(0o600)
        hashes={p.name:sha(p.body) for p in expected.parts if p.name in replacements}
        safe_report(status='PREPARED_READ_ONLY',worker_puts={'installation':0,'recovery':0},
            backup_sealed_sha256=sha(sealed.encode()),rollback_exact=True,delta_sha256=hashes,
            changed_existing_before_sha256={p.name:sha(p.body) for p in capture['bundle'].parts if p.name in replacements})
        return
    prepared=json.loads((TARGET/'receipt.json').read_bytes())
    if prepared.get('status')!='PREPARED_READ_ONLY' or sha(backup.read_bytes())!=prepared['backup_sealed_sha256']:
        fail('CHECKOUT_BACKUP_NOT_PREPARED')
    capture=unpack_capture(json.loads(cipher(backup.read_text(),True)));require_capture(capture)
    expected=prepare_bundle(capture['bundle'],manifest,replacements)
    # O_EXCL burns this job-local permit even if the response to the PUT is lost.
    descriptor=os.open(TARGET/'installation-attempt-consumed',os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.close(descriptor)
    result=perform_install(api,guard,capture,expected)
    safe_report(**result,delta_sha256=prepared['delta_sha256'],
        changed_existing_before_sha256=prepared['changed_existing_before_sha256'],
        backup_sealed_sha256=prepared['backup_sealed_sha256'])
    if result['status']!='INSTALLED_VERIFIED':raise SystemExit(1)

if __name__=='__main__':
    try:main(sys.argv[1] if len(sys.argv)==2 else '')
    except SystemExit:raise
    except Exception as error:
        # Never serialize exception messages from HTTP, private bodies or secrets.
        code=diagnostic(error)
        safe_report(status='BLOCKED',phase='preflight',error=code,worker_puts={'installation':0,'recovery':0})
        raise SystemExit(1)
