"""Authenticated GET-only comparison; never invokes an installation permission.

Private bundle stays in RAM. Export a module/diff only after its full bytes match
a public historical source or the original public selective patch functions.
"""
import difflib,gzip,hashlib,json,os,subprocess,sys
from dataclasses import replace
from pathlib import Path
from scoped_content import (CFClient,Bundle,Part,SCRIPT,same_bundle,same_json,
    encode_bundle,private_get,read_latest_revision,ScopedError,receiver_error_code)
from scoped_policy import closed_health,tester_scope

ROOT=Path(__file__).resolve().parent
CONTROL=ROOT.parent/'.github/checkout-base-read.json'
OUTPUT=ROOT/'generated/fase2/checkout-base-read'
MANIFEST_SHA='c816421a8d755bdc757cbce632f8d5c331e7c8b3748364b2ce6d3ee13bd415e3'
CANDIDATES_SHA='4b12255365c5a86c2e56c9495d92eac9efe3b4ca0936ac608c1028e2cccffcd6'
NAMES=('worker.mjs','messenger-store.mjs')

class ReadError(RuntimeError):pass
def fail(code):raise ReadError(code) from None
def sha(data):return hashlib.sha256(data).hexdigest()
def compiled(data):return data.replace(b"import catalog from './generated/catalogo.json' with {type:'json'};",b"import catalog from './catalog.mjs';")

class ReadOnlyCFClient(CFClient):
    def request(self,path,method='GET',data=None,content_type=None):
        if method!='GET' or data is not None or path not in {SCRIPT+'/settings',SCRIPT+'/content/v2'}:
            fail('CHECKOUT_COMPARISON_WRITES_FORBIDDEN')
        return super().request(path,method,data,content_type)
    def put_bundle(self,bundle):fail('CHECKOUT_COMPARISON_WRITES_FORBIDDEN')

def permission():
    control=json.loads(CONTROL.read_bytes())
    old=json.loads((ROOT.parent/'.github/checkout-install-once.json').read_bytes())
    flags=json.loads((ROOT/'activar-cloud.json').read_bytes())
    if (control.get('enabled') is not True or control.get('cost_max_usd')!=0 or control.get('operation')!='read-only-active-checkout-base' or
        control.get('manifest_sha256')!=MANIFEST_SHA or old.get('enabled') is not False or
        old.get('closed_after_run')!='43939141450' or flags.get('activar') is not False or
        flags.get('datahub_scoped_content_enabled') is not False or
        os.environ.get('GITHUB_REF')!='refs/heads/automatizacion/piloto-cloud-3sku-20261015' or
        os.environ.get('GITHUB_EVENT_NAME')!='push' or os.environ.get('GITHUB_RUN_ATTEMPT')!='1' or
        os.environ.get('CF_FREE_ONLY_CONFIRMED')!='true'):fail('CHECKOUT_READ_SCOPE_REQUIRED')
    def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT.parent,stderr=subprocess.DEVNULL).decode().strip()
    if (git('rev-parse','HEAD')!=os.environ.get('GITHUB_SHA') or
        git('rev-parse','HEAD^')!=control.get('authorized_parent') or
        git('diff-tree','--no-commit-id','--name-only','-r','HEAD').splitlines()!=['.github/checkout-base-read.json'] or
        read_latest_revision()!=os.environ['GITHUB_SHA']):fail('CHECKOUT_READ_REVISION_CHANGED')

def public_inputs():
    manifest=(ROOT/'checkout-integration.json').read_bytes()
    candidates=(ROOT/'revision-checkout/public-base-candidates.json').read_bytes()
    if sha(manifest)!=MANIFEST_SHA or sha(candidates)!=CANDIDATES_SHA:fail('CHECKOUT_PUBLIC_INPUT_CHANGED')
    manifest=json.loads(manifest);entries=json.loads(candidates)['entries']
    for entry in entries:
        if entry['name'] not in NAMES or sha(entry['code'].encode())!=entry['sha256']:
            fail('CHECKOUT_PUBLIC_CANDIDATE_INVALID')
    return manifest,entries

def plan(before,manifest,entries):
    by_hash={(x['name'],x['sha256']):x for x in entries}
    source={p.name:p for p in before.parts}
    if before.entrypoint!='worker.mjs' or len(source)!=len(before.parts) or not set(NAMES).issubset(source):
        fail('CHECKOUT_READ_LAYOUT_CHANGED')
    matched={}
    for name in NAMES:
        body=source[name].body;entry=by_hash.get((name,sha(body)))
        if entry is None or body!=entry['code'].encode():fail('CHECKOUT_ACTIVE_BASE_NOT_PUBLICLY_RECONSTRUCTED')
        matched[name]=entry
    modules={};diffs={};changed={};records=[]
    for item in manifest['runtime_modules']:
        name=Path(item['path']).name
        approved=(ROOT/name).read_bytes()
        if sha(approved)!=item['after_sha256']:fail('CHECKOUT_APPROVED_ARTIFACT_CHANGED')
        if item['operation']=='add':
            if name in source:fail('CHECKOUT_ALREADY_PRESENT')
            modules[name]=approved
            records.append({'name':name,'before_sha256':None,'after_sha256':sha(approved)})
            continue
        actual=source[name].body;updated=actual
        for delta in item['replacements']:
            old,new=compiled(delta['before'].encode()),compiled(delta['after'].encode())
            if updated.count(old)!=1 or new in updated:fail('CHECKOUT_READ_ANCHOR_CHANGED')
            updated=updated.replace(old,new,1)
        reversed_body=updated
        for delta in reversed(item['replacements']):
            old,new=compiled(delta['before'].encode()),compiled(delta['after'].encode())
            if reversed_body.count(new)!=1:fail('CHECKOUT_READ_INVERSE_NOT_EXACT')
            reversed_body=reversed_body.replace(new,old,1)
        if reversed_body!=actual:fail('CHECKOUT_READ_INVERSE_NOT_EXACT')
        approved_before=compiled(approved)
        for delta in reversed(item['replacements']):
            approved_before=approved_before.replace(compiled(delta['after'].encode()),compiled(delta['before'].encode()),1)
        # Both operands are now confirmed public source; no private text in diffs.
        diffs[name]=''.join(difflib.unified_diff(approved_before.decode().splitlines(True),
            actual.decode().splitlines(True),fromfile='PR388-base/'+name,tofile='active-publicly-reconstructed/'+name))
        changed[name]=updated
        modules[name]=updated
        records.append({'name':name,'before_sha256':sha(actual),'after_sha256':sha(updated),
            'manifest_base_compiled_sha256':sha(approved_before),'public_source_commit':matched[name]['source_commit'],
            'selective_patches':matched[name]['selective_patches'],'inverse_exact':True})
    if len(records)!=8 or set(changed)!=set(NAMES):fail('CHECKOUT_READ_DELTA_SCOPE_CHANGED')
    result=[]
    for part in before.parts:
        if part.name in changed:
            body=changed[part.name]
            headers=tuple((key,str(len(body)) if key.lower()=='content-length' else value) for key,value in part.headers)
            result.append(replace(part,body=body,headers=headers))
        else:result.append(part)
    result.extend(Part(name,name,'application/javascript+module',body) for name,body in modules.items() if name not in source)
    after=Bundle(before.entrypoint,tuple(result))
    inverse=Bundle(after.entrypoint,tuple(source[p.name] if p.name in changed else p for p in after.parts if p.name in source))
    if not same_bundle(inverse,before):fail('CHECKOUT_READ_BUNDLE_INVERSE_NOT_EXACT')
    if len(gzip.compress(encode_bundle(after)[0]))>=3_000_000:fail('CHECKOUT_READ_FREE_BUNDLE_LIMIT')
    return {'runtime_modules':records,'delta_sha256':sha(json.dumps(records,sort_keys=True,separators=(',',':')).encode()),
        'other_modules_preserved':True,'settings_changed':False,'inverse_exact':True},modules,diffs

def main():
    permission();manifest,entries=public_inputs()
    api=ReadOnlyCFClient(os.environ.get('CLOUDFLARE_ACCOUNT_ID'),os.environ.get('CLOUDFLARE_API_TOKEN'))
    settings=api.get_settings();before=api.get_bundle();health=closed_health(private_get('/health'))
    tester_scope(private_get,health['messenger_outbound'])
    observed={p.name:sha(p.body) for p in before.parts if p.name in NAMES}
    report={'schema':'conectatech.checkout-active-base.v1','worker':'conectatech-comercial-piloto',
        'run_id':os.environ.get('GITHUB_RUN_ID'),'execution_commit':os.environ.get('GITHUB_SHA'),
        'read_only':True,'worker_puts':0,'installation_permission_enabled':False,'activar':False,
        'datahub_scoped_content_enabled':False,'checkout_enabled':False,'deliveries':[],
        'cost_additional_usd':0,'observed_sha256':observed,'base_release':health['release']}
    try:proposal,modules,diffs=plan(before,manifest,entries)
    except ReadError as error:
        report.update(status='BLOCKED',error=error.args[0]);write_report(report);raise SystemExit(1)
    if not same_bundle(api.get_bundle(),before) or not same_json(api.get_settings(),settings):fail('CHECKOUT_READ_CONCURRENT_CHANGE')
    closed_health(private_get('/health'),health['messenger_outbound'],health['release'])
    tester_scope(private_get,health['messenger_outbound']);permission()
    OUTPUT.mkdir(parents=True,exist_ok=True)
    for name in NAMES:
        (OUTPUT/('active-'+name)).write_bytes(next(p.body for p in before.parts if p.name==name))
        (OUTPUT/('candidate-'+name)).write_bytes(modules[name])
        (OUTPUT/(name+'.diff')).write_text(diffs[name])
    report.update(status='READ_VERIFIED_DELTA_PLANNED',proposal=proposal,
        bundle_unchanged_during_read=True,settings_unchanged_during_read=True,
        source_and_receiver_preserved=True,previous_services_verified=True,
        public_code_reconstruction_exact=True)
    write_report(report)

def write_report(value):
    OUTPUT.mkdir(parents=True,exist_ok=True)
    (OUTPUT/'report.json').write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(value,separators=(',',':')))

if __name__=='__main__':
    try:main()
    except SystemExit:raise
    except Exception as error:
        code=error.args[0] if isinstance(error,ReadError) else receiver_error_code(error) if isinstance(error,ScopedError) else 'CHECKOUT_READ_FAILED'
        write_report({'status':'BLOCKED','error':code,'read_only':True,'worker_puts':0})
        raise SystemExit(1)
