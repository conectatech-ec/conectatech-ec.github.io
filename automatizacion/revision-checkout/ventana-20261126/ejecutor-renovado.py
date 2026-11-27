"""Execute the owner's pinned PR396 delta through the original scoped transport.

The only deployable bytes come from APPROVED_COMMIT. Captures remain encrypted;
source evaluation uses the live modules in RAM and never substitutes data.
"""
import base64, hashlib, json, os, subprocess, sys, time, urllib.error, urllib.request
from dataclasses import replace
from pathlib import Path

APPROVED_COMMIT = 'e2b3237fd3709da3554081f5a0d026135e93bc54'
PATCH_SHA = '99ae311573baba50540a84063b754310206e98221f8e5e5a40d55c7916581bc1'
SOURCE_SHA = 'a2609eff408b43fbecaf75dc2b4e04624154a448f5c8cd30192cdf348d8875f4'
EXPIRY = 1795746399  # 2026-11-27T02:26:39Z
SOURCE_GENERATED = '2026-11-26T02:31:39.000Z'
BASE = 'https://conectatech-comercial-piloto.conectatech-ecu.workers.dev'
ROOT = Path(os.environ.get('CHECKOUT_APPROVED_REPO', '.')).resolve()
OUT = Path(os.environ.get('CHECKOUT_EXECUTION_OUTPUT', 'checkout-pr396-evidence')).resolve()
sys.path.insert(0, str(ROOT / 'automatizacion'))
from scoped_content import CFClient, ScopedDeployer, Bundle, NoRedirect, same_bundle, same_json
from install_checkout import cipher, pack_capture, unpack_capture

class Blocked(Exception): pass
def require(ok, code):
    if not ok: raise Blocked(code)
def digest(body): return hashlib.sha256(body).hexdigest()
def load(path): return json.loads(Path(path).read_text())
def save(report):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT/'receipt.json').write_text(json.dumps(report, indent=2)+'\n')
def initial():
    return dict(schema='conectatech.pr396.remote.v1', approved_commit=APPROVED_COMMIT,
        patch_sha256=PATCH_SHA, run_id=os.environ.get('GITHUB_RUN_ID'),
        worker='conectatech-comercial-piloto', installation_puts=0, reversion_puts=0,
        synthetic_post_attempts=0, public_checkout_enabled=False, cost_additional_usd=0)
def permission(fresh=True):
    require(os.environ.get('GITHUB_REF')=='refs/heads/automatizacion/piloto-cloud-3sku-20261015'
        and os.environ.get('GITHUB_EVENT_NAME')=='push' and os.environ.get('GITHUB_RUN_ATTEMPT')=='1'
        and os.environ.get('CF_FREE_ONLY_CONFIRMED')=='true', 'EXECUTION_SCOPE_NOT_AUTHORIZED')
    require(subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()==APPROVED_COMMIT,
        'APPROVED_COMMIT_MISMATCH')
    executor=Path(os.environ['CHECKOUT_EXECUTOR_REPO'])
    git=lambda *args: subprocess.check_output(['git',*args],cwd=executor,text=True).strip()
    require(git('rev-parse','HEAD')==os.environ.get('GITHUB_SHA') and git('rev-parse','HEAD^')=='9dd6a9f2c8df5c508a8c128a13c798fa0e48abe7',
        'EXECUTION_COMMIT_OR_PARENT_CHANGED')
    require(set(git('diff-tree','--no-commit-id','--name-only','-r','HEAD').splitlines())=={
        '.github/workflows/central-593.yml','.github/scripts/checkout-pr396-run.py'},'EXECUTION_WRAPPER_SCOPE_CHANGED')
    if fresh:
        require(time.time()<EXPIRY-180, 'AUTHORIZED_WINDOW_CLOSED_OR_RECOVERY_MARGIN_INSUFFICIENT')
        from github_revision_read import read_authenticated_revision
        require(read_authenticated_revision()==os.environ.get('GITHUB_SHA'),'AUTHORIZED_PILOT_REVISION_CHANGED')
def artifacts():
    permission(False)
    path=ROOT/'automatizacion/revision-checkout'
    m=load(path/'prueba-privada.json')
    require(digest((path/'prueba-privada.patch').read_bytes())==PATCH_SHA,'APPROVED_PATCH_MISMATCH')
    require(set(x['module'] for x in m['modules'])=={'checkout-entry.mjs','checkout-store.mjs'},'MODULE_SCOPE_CHANGED')
    replacements={}
    for item in m['modules']:
        body=(ROOT/'automatizacion'/item['module']).read_bytes()
        require(digest(body)==item['candidate_sha256'],'APPROVED_MODULE_MISMATCH')
        replacements[item['module']]=body
    return m,replacements
def candidate(before):
    m,replacements=artifacts(); original={p.name:p for p in before.parts}
    for item in m['modules']:
        require(item['module'] in original and digest(original[item['module']].body)==item['before_sha256'],
            'LIVE_MODULE_IDENTITY_MISMATCH')
    return Bundle(before.entrypoint,tuple(replace(p,body=replacements[p.name],headers=tuple(
        (k,str(len(replacements[p.name])) if k.lower()=='content-length' else v) for k,v in p.headers))
        if p.name in replacements else p for p in before.parts))
def client(): return CFClient(os.environ.get('CLOUDFLARE_ACCOUNT_ID'),os.environ.get('CLOUDFLARE_API_TOKEN'))

SOURCE_EVAL = r'''
import vm from 'node:vm'; import path from 'node:path'; import {webcrypto} from 'node:crypto';
let input=''; for await(const c of process.stdin) input+=c;
const bodies=JSON.parse(input), modules=new Map();let effective=null;
const allowed=new Set(['datos-593/estado-ultimo-corte.json','datos-593/corte-comercial-publico-validado.json','exportaciones/catalogo-ventas.json']);
const fetcher=(url,options={})=>{const u=new URL(url);if(u.origin!=='https://conectatech-ec.github.io'||u.search||u.hash||!allowed.has(u.pathname.slice(1))||options.method&&options.method!=='GET')throw Error('SOURCE_READ_SCOPE_DENIED');return fetch(url,options);};
const context=vm.createContext({fetch:fetcher,Date,URL,AbortSignal,TextEncoder,crypto:webcrypto,structuredClone});
async function get(name){if(modules.has(name))return modules.get(name);if(!Object.hasOwn(bodies,name))throw Error('SOURCE_MODULE_NOT_CAPTURED');const m=new vm.SourceTextModule(bodies[name],{context,identifier:name});modules.set(name,m);await m.link((specifier,parent)=>{if(!specifier.startsWith('./'))throw Error('SOURCE_IMPORT_SCOPE_DENIED');return get(path.posix.normalize(path.posix.join(path.posix.dirname(parent.identifier),specifier)));});return m;}
try{const central=await get('central-source.mjs');await central.evaluate();const hub=await get('shared-hub.mjs');await hub.evaluate();const checkout=await get('checkout-shared-source.mjs');await checkout.evaluate();const s=await checkout.namespace.readCheckoutSource({central:central.namespace.central,readSharedHub:async(...args)=>{effective=await hub.namespace.readSharedHub(...args);return effective;},fetcher});const p=s.products.find(p=>p.sku==='ADAP004');process.stdout.write(JSON.stringify({cutDate:s.cutDate,sourceHash:s.sourceHash,sourceGeneratedAt:s.sourceGeneratedAt,sourceTimestampBasis:s.sourceTimestampBasis,product:p?{sku:p.sku,stock:p.stock,priceCents:p.priceCents,pvpCents:p.pvpCents}:null}));}catch(error){const codes=['SOURCE_MODULE_NOT_CAPTURED','SOURCE_IMPORT_SCOPE_DENIED','SOURCE_READ_SCOPE_DENIED','SHARED_HUB_VERSION_MISMATCH','SHARED_HUB_RELABELED_REPORT','SHARED_HUB_DATE','SHARED_HUB_SCHEMA','SHARED_HUB_UNAVAILABLE','SHARED_HUB_SIZE','SHARED_HUB_OLDER_THAN_LAST_VALID','SHARED_HUB_READ_FAILED','CENTRAL_SCHEMA','CENTRAL_DATE','CENTRAL_PRODUCT','CENTRAL_PRICE','CENTRAL_PRIVATE_FIELD','CHECKOUT_SOURCE_UNVERIFIED','CHECKOUT_SOURCE_UNAVAILABLE','CHECKOUT_SOURCE_SIZE','CHECKOUT_SOURCE_VERSION_MISMATCH','CHECKOUT_SOURCE_PRODUCT_MISMATCH','CHECKOUT_SOURCE_EMPTY'];const diagnostic=effective?{source_sha256:effective.source?.sha256,cut_date:effective.source?.cut_date,generated_at:effective.source?.generated_at,expires_at:effective.expires_at,timestamp_basis:effective.source?.timestamp_basis,shared_state:effective.shared_hub_status?.state,products:effective.products.length,blocked_products:effective.products.filter(p=>p.availability==='blocked'||p.blocked_reasons?.length).length,price_matches_true:effective.products.filter(p=>p.web?.price_matches===true).length,adap004:(()=>{const p=effective.products.find(p=>p.sku==='ADAP004');return p?{availability:p.availability,blocked_reasons:p.blocked_reasons,web_price_matches:p.web?.price_matches??null,has_product_url:!!p.web?.url?.startsWith('https://conectatech-ec.github.io/productos/'),has_product_image:!!(effective.presentation?.products?.[p.sku]?.approved_media?.url||p.web?.image_url)?.startsWith('https://conectatech-ec.github.io/imagenes/'),promo_cents:p.prices?.promo_cash_cents,pvp_cents:p.prices?.pvp_card_cents}:null;})()}:null;process.stdout.write(JSON.stringify({diagnostic,error:codes.includes(error.message)?error.message:'LIVE_SOURCE_EVALUATOR_INTERNAL_ERROR',error_type:['Error','TypeError','ReferenceError','SyntaxError'].includes(error.name)?error.name:'OtherError',node_code:['ERR_VM_MODULE_LINK_FAILURE','ERR_VM_MODULE_NOT_MODULE','ERR_MODULE_NOT_FOUND','ERR_VM_MODULE_STATUS'].includes(error.code)?error.code:null}));process.exitCode=1;}
'''
def source_preflight(capture,report):
    names={'central-source.mjs','central-data.mjs','central-enrichment.mjs','source-attestations.mjs',
           'shared-hub.mjs','checkout-shared-source.mjs'}
    values={p.name:p.body.decode() for p in capture['bundle'].parts if p.name in names}
    require(set(values)==names,'SOURCE_MODULE_LAYOUT_CHANGED')
    result=subprocess.run(['node','--experimental-vm-modules','--input-type=module','-e',SOURCE_EVAL],
        input=json.dumps(values),capture_output=True,text=True,timeout=100,
        env={'PATH':os.environ['PATH']})
    try: observed=json.loads(result.stdout)
    except Exception: raise Blocked('LIVE_SOURCE_EVALUATION_FAILED') from None
    report['effective_source_preflight']=observed;save(report)
    require(result.returncode==0,observed.get('error','LIVE_SOURCE_EVALUATION_FAILED'))
    require(observed.get('cutDate')=='2026-11-25' and observed.get('sourceHash')==SOURCE_SHA,
        'EFFECTIVE_SOURCE_IDENTITY_MISMATCH')
    from scoped_policy import source_time
    require(source_time(observed.get('sourceGeneratedAt'))==source_time(SOURCE_GENERATED),
        'EFFECTIVE_SOURCE_GENERATION_NOT_ATTESTED')
    require(observed.get('product')==dict(sku='ADAP004',stock=11,priceCents=350,pvpCents=402),
        'ADAP004_AUTHORIZED_CONDITIONS_CHANGED')
    permission()
def http(path,method='GET',anonymous=False):
    require(path in {'/api/compra/admin/prueba','/api/compra/catalogo','/api/compra/admin/pedidos'},'HTTP_SCOPE_CHANGED')
    require(method=='GET' or path=='/api/compra/admin/prueba' and method=='POST','HTTP_METHOD_SCOPE_CHANGED')
    # The existing GET transport uses Node fetch; retain the same authenticated HTTPS semantics.
    # The Python urllib probe of /commercial/status returned 403 while the original Node transport returned 200.
    code=r"""
let text='';for await(const c of process.stdin)text+=c;const {path,method,anonymous}=JSON.parse(text);
const paths=new Set(['/api/compra/admin/prueba','/api/compra/catalogo','/api/compra/admin/pedidos']);
if(!paths.has(path)||!(method==='GET'||path==='/api/compra/admin/prueba'&&method==='POST')||anonymous&&path!=='/api/compra/admin/pedidos'||!process.env.PILOT_TOKEN)process.exit(2);
try{const response=await fetch('https://conectatech-comercial-piloto.conectatech-ecu.workers.dev'+path,{method,redirect:'error',headers:{Accept:'application/json','Cache-Control':'no-cache',...(!anonymous?{Authorization:'Bearer '+process.env.PILOT_TOKEN}:{}),...(path==='/api/compra/catalogo'?{Origin:'https://conectatech-ec.github.io'}:{})},...(method==='POST'?{body:'{}'}:{}),signal:AbortSignal.timeout(75000)});
const chunks=[];let n=0;for await(const part of response.body){n+=part.byteLength;if(n>50000)throw Error();chunks.push(part);}process.stdout.write(JSON.stringify({status:response.status,body:JSON.parse(Buffer.concat(chunks).toString('utf8'))}));}catch{process.exitCode=1;}
"""
    child=subprocess.run(['node','--input-type=module','-e',code],input=json.dumps({'path':path,'method':method,'anonymous':anonymous}),capture_output=True,text=True,timeout=85)
    require(child.returncode==0,'PRIVATE_HTTPS_TRANSPORT_FAILED')
    try:result=json.loads(child.stdout);return result['status'],result['body']
    except Exception:raise Blocked('PRIVATE_HTTPS_RESPONSE_INVALID') from None

def closure():
    report=load(OUT/'receipt.json')
    observed=[]
    for path,anonymous,expected,code in [('/api/compra/catalogo',False,503,'COMPRA_NO_HABILITADA'),
        ('/api/compra/admin/pedidos',True,401,'Unauthorized')]:
        args=['node',str(ROOT/'automatizacion/scoped-http.mjs'),path]+(['--anonymous'] if anonymous else [])
        child=subprocess.run(args,capture_output=True,text=True,timeout=55)
        envelope=json.loads(child.stdout)
        body=json.loads(base64.b64decode(envelope['bytes_b64']))
        value=body.get('error'); allowed={'COMPRA_NO_HABILITADA','ORIGEN_NO_AUTORIZADO','Unauthorized','RUTA_NO_DISPONIBLE'}
        observed.append({'path':path,'http_status':envelope.get('status'),'error_code':value if value in allowed else 'UNEXPECTED_RESPONSE'})
        report['closure_preflight']=observed;save(report)
        require(not child.returncode and envelope.get('status')==expected and value==code,'CHECKOUT_CLOSURE_RESPONSE_MISMATCH')
def exact(api,bundle,settings):
    require(same_bundle(api.get_bundle(),bundle) and same_json(api.get_settings(),settings),'LIVE_RUNTIME_DRIFT')
def settled(api,bundle,settings):
    for attempt in range(6):
        if same_bundle(api.get_bundle(),bundle):
            require(same_json(api.get_settings(),settings),'LIVE_SETTINGS_DRIFT');return
        if attempt<5: time.sleep(2)
    raise Blocked('BUNDLE_PROPAGATION_NOT_VERIFIED')
def recover(api,capture,after,report):
    actual=api.get_bundle();settings=api.get_settings()
    require(same_json(settings,capture['settings']),'REVERSION_SETTINGS_DRIFT')
    if same_bundle(actual,capture['bundle']):
        report['reversion']='original_bundle_verified_no_put_needed'
    else:
        require(same_bundle(actual,after),'REVERSION_RUNTIME_DRIFT')
        require(report['reversion_puts']==0,'REVERSION_PUT_BUDGET_EXHAUSTED')
        exact(api,after,capture['settings'])
        report['reversion_puts']=1;save(report)
        api.put_bundle(capture['bundle']);settled(api,capture['bundle'],capture['settings'])
        report['reversion']='original_two_modules_verified'
    closure()
    status,_=http('/api/compra/admin/prueba');require(status==404,'PRIVATE_ROUTE_CLOSURE_NOT_VERIFIED')
    report['public_checkout_http']=503;report['admin_unauthorized_http']=401
    report['private_route_after_reversion_http']=status
    m,_=artifacts();report['restored_sha256']={x['module']:x['before_sha256'] for x in m['modules']}
    report['other_modules_and_settings_preserved']=True;save(report)
def prepare():
    permission();m,_=artifacts();api=client();guard=ScopedDeployer(api)
    report=initial();save(report)
    capture=guard.capture();candidate(capture['bundle'])
    installed=load(ROOT/'automatizacion/revision-checkout/resultado-44160098418.json')['delta_sha256']
    source_install=load(ROOT/'automatizacion/revision-checkout/resultado-fuente-45915507220.json')
    require(source_install.get('status')=='INSTALLED_VERIFIED_BY_INDEPENDENT_READ' and source_install.get('installed_sha256')=='10ebe491335d008fec039e43b1ce7547d9ed45c69f2b6230b92ff8125b7018a9','SOURCE_INSTALLATION_NOT_VERIFIED')
    installed.update(source_install['selected_before_sha256'])
    installed['shared-hub.mjs']=source_install['installed_sha256']
    parts={p.name:p for p in capture['bundle'].parts}
    require(all(name in parts and digest(parts[name].body)==value for name,value in installed.items()),
        'INSTALLED_CHECKOUT_BASELINE_CHANGED')
    report['original_module_sha256']={x['module']:digest(parts[x['module']].body) for x in m['modules']}
    report['live_baseline_verified']=True;save(report)
    closure();report.update(load(OUT/'receipt.json'));source_preflight(capture,report);guard.check_before_put(capture)
    sealed=cipher(json.dumps(pack_capture(capture),separators=(',',':')))
    (OUT/'backup.sealed.json').write_text(sealed)
    report.update(status='PREPARED_AUTHENTICATED',backup_sealed_sha256=digest(sealed.encode()))
    save(report)
def execute(recovery_only=False):
    report=load(OUT/'receipt.json');api=client()
    sealed=(OUT/'backup.sealed.json').read_text()
    require(digest(sealed.encode())==report['backup_sealed_sha256'],'SEALED_BACKUP_CHANGED')
    capture=unpack_capture(json.loads(cipher(sealed,opening=True)));after=candidate(capture['bundle'])
    if recovery_only:
        if report.get('installation_puts'): recover(api,capture,after,report)
        return
    require(report.get('status')=='PREPARED_AUTHENTICATED' and report['installation_puts']==0,'EXECUTION_ALREADY_CONSUMED')
    guard=ScopedDeployer(api);guard.check_before_put(capture);source_preflight(capture,report)
    try:
        permission();report.update(phase='installation',installation_puts=1);save(report)
        api.put_bundle(after);settled(api,after,capture['settings']);closure()
        exact(api,after,capture['settings']);permission()
        report.update(phase='synthetic_test',synthetic_post_attempts=1);save(report)
        status,result=http('/api/compra/admin/prueba','POST')
        report['test_http']=status
        require(status==200 and result.get('syntheticTest') is True,'SYNTHETIC_TEST_FAILED')
        require(result.get('quote')==200 and result.get('confirm')==201 and result.get('allocation')=='cancelled'
            and result.get('duplicatePrevented') is True and result.get('orderCount')==1,'SYNTHETIC_RESULT_NOT_VERIFIED')
        status,verified=http('/api/compra/admin/prueba')
        require(status==200 and verified.get('verifiedInSeparateRequest') is True and verified.get('id')==result.get('id')
            and verified.get('allocation')=='cancelled' and verified.get('duplicatePrevented') is True
            and verified.get('orderCount')==1,'PERSISTENCE_OR_CANCELLATION_NOT_VERIFIED')
        report['synthetic_result']={k:result.get(k) for k in ('id','quote','confirm','admin','duplicatePrevented','orderCount','allocation','sourceHash','totalCents')}
        report['separate_admin_verification']=True;report['status']='REMOTE_TEST_PASSED'
    finally:
        save(report);recover(api,capture,after,report)

if __name__=='__main__':
    try:
        if sys.argv[1]=='--prepare': prepare()
        elif sys.argv[1]=='--run': execute()
        elif sys.argv[1]=='--recover':
            if (OUT/'backup.sealed.json').exists(): execute(True)
        else: raise Blocked('EXECUTION_MODE_INVALID')
    except BaseException as error:
        report=load(OUT/'receipt.json') if (OUT/'receipt.json').exists() else initial()
        report['status']='BLOCKED'
        report['error']=str(error) if type(error) is Blocked else 'REMOTE_EXECUTION_FAILED_DETAILS_WITHHELD'
        save(report);print(json.dumps(report,separators=(',',':')));sys.exit(1)
    if (OUT/'receipt.json').exists(): print((OUT/'receipt.json').read_text())
