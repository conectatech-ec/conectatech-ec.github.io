"""One approved shared-hub replacement through the original protected transport."""
import gzip,hashlib,json,os,subprocess,sys,time
from dataclasses import replace
from pathlib import Path

APPROVED='bc581bf93ff39fcaff18863f91a5202a3325a8e8'
PARENT='58628f56444ebff6e2b67d80144f6d5bac1ab92e'
AUTH='DG-PR396-bc581bf9-SHARED-HUB-ONCE'
MANIFEST='97477f52f261bfb808f958d2e0af6f41a10c35fcd1f7c3d5b4dd1268da677528'
BEFORE='a6a54d835d734dddfb379bb04e87c90ff63eb61f0a0313d31f49e2e20ecbccd6'
AFTER='10ebe491335d008fec039e43b1ce7547d9ed45c69f2b6230b92ff8125b7018a9'
SOURCE='a2609eff408b43fbecaf75dc2b4e04624154a448f5c8cd30192cdf348d8875f4'
GENERATED='2026-11-26T02:31:39.000Z'
EXPIRES='2026-11-27T02:31:39.000Z'
EVIDENCE='1c19ca96d1bbb60702aa7fb14b92401067b3d099d4e49860f311beb76004d938'
ROOT=Path(os.environ.get('CHECKOUT_APPROVED_REPO','.')).resolve()
EXEC=Path(os.environ.get('CHECKOUT_EXECUTOR_REPO','.')).resolve()
OUT=Path(os.environ.get('CHECKOUT_SOURCE_OUTPUT','checkout-source-evidence')).resolve()
sys.path.insert(0,str(ROOT/'automatizacion'))
from scoped_content import CFClient,ScopedDeployer,Bundle,same_bundle,same_json
from install_checkout import cipher,pack_capture,unpack_capture,closure_probe
from github_revision_read import read_authenticated_revision

class Blocked(Exception):pass
def require(ok,code):
    if not ok:raise Blocked(code)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def git(repo,*args):return subprocess.check_output(['git',*args],cwd=repo,text=True,stderr=subprocess.DEVNULL).strip()
def save(report):
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'receipt.json').write_text(json.dumps(report,indent=2)+'\n')
    print('SOURCE396_RECEIPT='+json.dumps(report,separators=(',',':')))
def load():return json.loads((OUT/'receipt.json').read_text())
def permission(revision=True):
    require(os.environ.get('GITHUB_REF')=='refs/heads/automatizacion/piloto-cloud-3sku-20261015'
        and os.environ.get('GITHUB_EVENT_NAME')=='push' and os.environ.get('GITHUB_RUN_ATTEMPT')=='1'
        and os.environ.get('CF_FREE_ONLY_CONFIRMED')=='true'
        and os.environ.get('CHECKOUT_SOURCE_INSTALL_AUTHORIZATION')==AUTH,'INSTALL_SCOPE_NOT_AUTHORIZED')
    require(git(ROOT,'rev-parse','HEAD')==APPROVED,'APPROVED_COMMIT_CHANGED')
    require(git(EXEC,'rev-parse','HEAD')==os.environ.get('GITHUB_SHA') and git(EXEC,'rev-parse','HEAD^')==PARENT,
        'EXECUTION_REVISION_OR_PARENT_CHANGED')
    require(set(git(EXEC,'diff-tree','--no-commit-id','--name-only','-r','HEAD').splitlines())=={
        '.github/scripts/checkout-source-396.py','.github/workflows/central-593.yml'},'EXECUTION_DELTA_CHANGED')
    require(os.environ.get('GITHUB_WORKFLOW_SHA')==os.environ.get('GITHUB_SHA'),'WORKFLOW_REVISION_CHANGED')
    if revision:require(read_authenticated_revision()==os.environ.get('GITHUB_SHA'),'PILOT_REVISION_CHANGED')
def artifacts():
    raw=(ROOT/'automatizacion/revision-checkout/fuente-automatica-593/manifest.json').read_bytes()
    require(sha(raw)==MANIFEST,'MANIFEST_IDENTITY_CHANGED')
    m=json.loads(raw);body=(ROOT/'automatizacion/revision-checkout/fuente-automatica-593/shared-hub.mjs').read_bytes()
    require(sha(body)==AFTER and m['runtime_modules_changed'][0]['candidate_sha256']==AFTER
        and m['source_attestations_mjs_changed'] is False,'CANDIDATE_IDENTITY_CHANGED')
    return m,body
def identities(bundle):return {p.name:sha(p.body) for p in bundle.parts}
def candidate(bundle):
    m,body=artifacts();actual=identities(bundle)
    require(bundle.entrypoint=='worker.mjs' and len(actual)==len(bundle.parts),'LIVE_LAYOUT_CHANGED')
    require(all(actual.get(n)==v for n,v in m['active_baseline_verification']['active_modules_sha256'].items()),
        'LIVE_MODULE_IDENTITY_CHANGED')
    require(actual.get('shared-hub.mjs')==BEFORE,'LIVE_READER_CHANGED')
    after=Bundle(bundle.entrypoint,tuple(replace(p,body=body,headers=tuple(
        (k,str(len(body)) if k.lower()=='content-length' else v) for k,v in p.headers))
        if p.name=='shared-hub.mjs' else p for p in bundle.parts))
    require({p.name for p in after.parts}==set(actual) and all(p==q for p,q in zip(bundle.parts,after.parts)
        if p.name!='shared-hub.mjs'),'UNOWNED_MODULE_CHANGED')
    from scoped_content import encode_bundle
    require(len(gzip.compress(encode_bundle(after)[0]))<3_000_000,'FREE_BUNDLE_LIMIT')
    return after

EVAL=r'''
import vm from 'node:vm';import path from 'node:path';import {webcrypto} from 'node:crypto';
let text='';for await(const c of process.stdin)text+=c;const bodies=JSON.parse(text),modules=new Map();let effective;
const allowed=new Set(['datos-593/estado-ultimo-corte.json','datos-593/corte-comercial-publico-validado.json','exportaciones/catalogo-ventas.json']);
const fetcher=(url,options={})=>{const u=new URL(url);if(u.origin!=='https://conectatech-ec.github.io'||u.search||u.hash||!allowed.has(u.pathname.slice(1))||options.method&&options.method!=='GET')throw Error('SOURCE_READ_SCOPE_DENIED');return fetch(url,options);};
const context=vm.createContext({fetch:fetcher,Date,URL,AbortSignal,TextEncoder,crypto:webcrypto,structuredClone});
async function get(name){if(modules.has(name))return modules.get(name);if(!Object.hasOwn(bodies,name))throw Error('SOURCE_MODULE_NOT_CAPTURED');const m=new vm.SourceTextModule(bodies[name],{context,identifier:name});modules.set(name,m);await m.link((specifier,parent)=>{if(!specifier.startsWith('./'))throw Error('SOURCE_IMPORT_SCOPE_DENIED');return get(path.posix.normalize(path.posix.join(path.posix.dirname(parent.identifier),specifier)));});return m;}
try{const central=await get('central-source.mjs');await central.evaluate();const hub=await get('shared-hub.mjs');await hub.evaluate();const checkout=await get('checkout-shared-source.mjs');await checkout.evaluate();const s=await checkout.namespace.readCheckoutSource({central:central.namespace.central,readSharedHub:async(...args)=>{effective=await hub.namespace.readSharedHub(...args);return effective;},fetcher});const p=s.products.find(p=>p.sku==='ADAP004');process.stdout.write(JSON.stringify({cutDate:s.cutDate,sourceHash:s.sourceHash,generated_at:s.sourceGeneratedAt,expires_at:effective?.expires_at,timestamp_basis:s.sourceTimestampBasis,attestation_sha256:effective?.source.attestation_sha256,product:p?{sku:p.sku,stock:p.stock,priceCents:p.priceCents,pvpCents:p.pvpCents}:null}));}catch{process.stdout.write(JSON.stringify({error:'SOURCE_EVALUATION_REJECTED'}));process.exitCode=1;}
'''
def source_preflight(bundle):
    names={'central-source.mjs','central-data.mjs','central-enrichment.mjs','source-attestations.mjs','shared-hub.mjs','checkout-shared-source.mjs'}
    values={p.name:p.body.decode() for p in bundle.parts if p.name in names}
    require(set(values)==names,'SOURCE_MODULE_LAYOUT_CHANGED')
    result=subprocess.run(['node','--experimental-vm-modules','--input-type=module','-e',EVAL],
        input=json.dumps(values),capture_output=True,text=True,timeout=100,env={'PATH':os.environ['PATH']})
    try:v=json.loads(result.stdout)
    except Exception:raise Blocked('SOURCE_EVALUATION_FAILED') from None
    require(result.returncode==0,'SOURCE_EVALUATION_REJECTED')
    require(v.get('sourceHash')==SOURCE and v.get('cutDate')=='2026-11-25' and v.get('generated_at')==GENERATED
        and v.get('expires_at')==EXPIRES and v.get('attestation_sha256')==EVIDENCE
        and v.get('timestamp_basis')=='original_workbook_core','SOURCE_ATTESTATION_NOT_CURRENT')
    from scoped_policy import source_time
    require(source_time(EXPIRES).timestamp()-time.time()>180,'SOURCE_RECOVERY_MARGIN_INSUFFICIENT')
    require(v.get('product')=={'sku':'ADAP004','stock':11,'priceCents':350,'pvpCents':402},'ADAP004_CONDITIONS_CHANGED')
    return v
def exact(api,bundle,settings):
    require(same_bundle(api.get_bundle(),bundle) and same_json(api.get_settings(),settings),'LIVE_RUNTIME_DRIFT')
def settled(api,bundle,settings):
    for attempt in range(6):
        if same_bundle(api.get_bundle(),bundle):
            require(same_json(api.get_settings(),settings),'LIVE_SETTINGS_DRIFT');return
        if attempt<5:time.sleep(2)
    raise Blocked('BUNDLE_PROPAGATION_NOT_VERIFIED')
def initial():return {'schema':'conectatech.pr396.source-install.v1','approved_commit':APPROVED,
    'run_id':os.environ.get('GITHUB_RUN_ID'),'worker':'conectatech-comercial-piloto',
    'installation_puts':0,'recovery_puts':0,'synthetic_orders':0,'public_checkout_enabled':False,'cost_additional_usd':0}
def inverse(before,after,current,settings,expected_settings):
    require(same_bundle(current,after) and same_json(settings,expected_settings),'RECOVERY_RUNTIME_DRIFT')
    old=next(p for p in before.parts if p.name=='shared-hub.mjs')
    restored=Bundle(current.entrypoint,tuple(old if p.name=='shared-hub.mjs' else p for p in current.parts))
    require(same_bundle(restored,before),'RECOVERY_NOT_SPECIFIC');return restored
def api_guard():
    api=CFClient(os.environ.get('CLOUDFLARE_ACCOUNT_ID'),os.environ.get('CLOUDFLARE_API_TOKEN'))
    return api,ScopedDeployer(api)
def prepare():
    permission();report=initial();save(report);api,guard=api_guard()
    capture=guard.capture();after=candidate(capture['bundle']);closure_probe()
    report['effective_source']=source_preflight(after)
    guard.check_before_put(capture);permission()
    plain=json.dumps(pack_capture(capture),separators=(',',':'));sealed=cipher(plain)
    require(cipher(sealed,True)==plain,'BACKUP_ROUNDTRIP_FAILED')
    OUT.mkdir(parents=True,exist_ok=True);backup=OUT/'backup.sealed.json';backup.write_text(sealed);backup.chmod(0o600)
    m,_=artifacts();selected=m['active_baseline_verification']['active_modules_sha256']
    report.update(status='PREPARED_READ_ONLY',backup_sealed_sha256=sha(sealed.encode()),module_count=len(capture['bundle'].parts),
        selected_before_sha256={n:identities(capture['bundle'])[n] for n in selected},candidate_sha256=AFTER,
        public_checkout_http=503,admin_anonymous_http=401)
    save(report)
def recover(api,guard,capture,after,report):
    current=api.get_bundle();settings=api.get_settings()
    if same_bundle(current,capture['bundle']) and same_json(settings,capture['settings']):
        report['recovery']='original_bundle_active_no_put';return
    restored=inverse(capture['bundle'],after,current,settings,capture['settings'])
    require(report['recovery_puts']==0,'RECOVERY_BUDGET_EXHAUSTED')
    # Recovery must remain available if the source/window expires after installation.
    permission(False);guard.check_before_put({**capture,'bundle':current});exact(api,current,settings)
    report['recovery_puts']=1;save(report);api.put_bundle(restored);settled(api,restored,settings);closure_probe()
    report['recovery']='specific_reader_inverse_verified'
def install():
    permission();report=load();require(report.get('status')=='PREPARED_READ_ONLY','PREPARATION_REQUIRED')
    backup=OUT/'backup.sealed.json';require(sha(backup.read_bytes())==report['backup_sealed_sha256'],'BACKUP_CHANGED')
    capture=unpack_capture(json.loads(cipher(backup.read_text(),True)));after=candidate(capture['bundle']);api,guard=api_guard()
    guard.check_before_put(capture);report['effective_source']=source_preflight(after);permission();exact(api,capture['bundle'],capture['settings'])
    fd=os.open(OUT/'installation-attempt-consumed',os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.close(fd)
    try:
        report['installation_puts']=1;report['status']='INSTALLATION_ATTEMPTED';save(report)
        report['provider']=api.put_bundle(after);settled(api,after,capture['settings'])
        guard.check_before_put({**capture,'bundle':after});closure_probe();report['effective_source']=source_preflight(api.get_bundle())
        report.update(status='INSTALLED_VERIFIED',installed_sha256=AFTER,recovery='not_needed',
            other_modules_preserved=True,settings_preserved=True,private_source_preserved=True,
            observer416_preserved=True,public_checkout_http=503,admin_anonymous_http=401)
        save(report)
    except Exception as error:
        report.update(status='FAILED',error=str(error) if isinstance(error,Blocked) else 'INSTALLATION_NOT_VERIFIED');save(report)
        try:recover(api,guard,capture,after,report)
        except Exception:report['recovery']='blocked_no_further_writes'
        save(report);raise SystemExit(1)
def recovery_check():
    if not (OUT/'receipt.json').is_file():return
    report=load()
    if report.get('status')=='INSTALLED_VERIFIED' or report.get('installation_puts')!=1:return
    if report.get('recovery_puts',0)>0:return
    capture=unpack_capture(json.loads(cipher((OUT/'backup.sealed.json').read_text(),True)))
    after=candidate(capture['bundle']);api,guard=api_guard();recover(api,guard,capture,after,report);save(report)
if __name__=='__main__':
    try:
        {'--prepare':prepare,'--install':install,'--recover':recovery_check}[sys.argv[1]]()
    except SystemExit:raise
    except Exception as error:
        report=load() if (OUT/'receipt.json').is_file() else initial()
        report.update(status='BLOCKED',error=str(error) if isinstance(error,Blocked) else 'PROTECTED_SOURCE_OPERATION_BLOCKED')
        save(report);raise SystemExit(1)
