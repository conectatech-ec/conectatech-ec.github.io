"""Promote only the variant/media Alex modules; keep the live host and data in RAM."""
import base64,json,os,sys,time,urllib.request
from dataclasses import replace
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'automatizacion'))
from scoped_content import CFClient,ScopedDeployer,Bundle,Part,same_bundle,same_json,private_get,read_latest_revision,NoRedirect,strict_json
from scoped_policy import closed_health,tester_scope

BASE_RELEASE='acfc00763dfbc7ac34c2c62f9ccecea4f613c870'
CODE_REVISION='32a924a4961e07d00631fd59e3fb9416a94776fe'
REPLACED=frozenset({'alex.mjs','alex-context.mjs','alex-store.mjs','alex-ui.mjs','alex-catalog.mjs','channels.mjs','phone-variants.mjs','alex-variant-sales.mjs','alex-media.mjs'})
ADDED=frozenset()
OWNED=REPLACED|ADDED
CONTROL='https://api.github.com/repos/conectatech-ec/conectatech-ec.github.io/contents/.github/alex-variants.json?ref=automatizacion%2Fpiloto-cloud-3sku-20261015'
RAW='https://raw.githubusercontent.com/conectatech-ec/conectatech-ec.github.io/'
PRIVACY=b'export function privacyPage'
IMPORTS=(
 (b"import policy from './alex-policy.json' with {type:'json'};",b"import policy from './alex-policy.mjs';"),
 (b"import original from './generated/catalogo.json' with {type:'json'};",b"import original from './catalog.mjs';"),
 (b"import extra from './generated/alex-productos-extra.json' with {type:'json'};",b"import extra from './alex-extra.mjs';"),
 (b"import enrichment from './central/enrichment.json' with {type:'json'};",b"import enrichment from './central-enrichment.mjs';"),
 (b"import signatureLibrary from './marketplace-library.json' with {type:'json'};",b"import signatureLibrary from './marketplace-library.mjs';"),
)

def fail(code):raise ValueError(code)

def require_control():
    request=urllib.request.Request(CONTROL,headers={'Accept':'application/vnd.github+json','Cache-Control':'no-cache','User-Agent':'CONECTATECH-Alex-Variants'})
    with urllib.request.build_opener(NoRedirect()).open(request,timeout=30) as response:
        raw=response.read(16385)
        if response.status!=200 or len(raw)>16384:fail('VAR_CONTROL_READ_FAILED')
    envelope=strict_json(raw)
    value=strict_json(base64.b64decode(envelope['content'],validate=False))
    expected={'deploy':True,'worker':'conectatech-comercial-piloto','expected_base_release':BASE_RELEASE,'baseline_code_revision':CODE_REVISION,'cost_max_usd':0}
    if value!=expected or type(value.get('deploy')) is not bool or type(value.get('cost_max_usd')) is not int:
        fail('VAR_PUBLIC_CONTROL_DISABLED_OR_CHANGED')
    if os.environ.get('EXPECTED_BASE_RELEASE',BASE_RELEASE)!=BASE_RELEASE or os.environ.get('EXPECTED_CODE_REVISION',CODE_REVISION)!=CODE_REVISION:
        fail('VAR_BASELINE_NOT_AUTHORIZED')
    if read_latest_revision()!=os.environ.get('GITHUB_SHA'):fail('VAR_REVISION_NO_LONGER_CURRENT')

def compiled(name,body):
    if name not in OWNED or not isinstance(body,bytes):fail('VAR_COMPILE_SCOPE_INVALID')
    for old,new in IMPORTS:body=body.replace(old,new)
    if b"with {type:'json'}" in body:fail('VAR_UNSUPPORTED_JSON_IMPORT')
    return body

def fetch_baselines():
    result={}
    for name in sorted(REPLACED):
        request=urllib.request.Request(RAW+CODE_REVISION+'/automatizacion/'+name,headers={'Cache-Control':'no-cache','User-Agent':'CONECTATECH-Alex-Variants'})
        with urllib.request.build_opener(NoRedirect()).open(request,timeout=30) as response:
            value=response.read(200001)
            if response.status!=200 or not 100<=len(value)<=200000:fail('VAR_PUBLIC_BASELINE_INVALID')
        result[name]=compiled(name,value)
    return result

def prepare_variants(bundle,replacements,baselines):
    names=[part.name for part in bundle.parts]
    if bundle.entrypoint!='worker.mjs' or set(replacements)!=OWNED or set(baselines)!=REPLACED or len(names)!=len(set(names)):
        fail('VAR_MODULE_SET_INVALID')
    if not REPLACED.issubset(names) or ADDED.intersection(names):fail('VAR_LIVE_MODULE_LAYOUT_CHANGED')
    for body in replacements.values():
        if not isinstance(body,bytes) or not 100<=len(body)<=200000:fail('VAR_REPLACEMENT_INVALID')
    parts={part.name:part for part in bundle.parts}
    for name in REPLACED:
        if parts[name].body!=baselines[name]:fail('VAR_LIVE_OWNED_MODULE_CHANGED')
    old_ui=parts['alex-ui.mjs'].body;new_ui=replacements['alex-ui.mjs']
    if old_ui.count(PRIVACY)!=1 or new_ui.count(PRIVACY)!=1 or old_ui.split(PRIVACY)[1]!=new_ui.split(PRIVACY)[1]:
        fail('VAR_PRIVACY_PAGE_CHANGED')
    updated=[]
    for part in bundle.parts:
        if part.name in REPLACED:
            body=replacements[part.name]
            headers=tuple((key,str(len(body)) if key.lower()=='content-length' else value) for key,value in part.headers)
            part=replace(part,body=body,headers=headers)
        updated.append(part)
    updated.extend(Part(name,name,'application/javascript+module',replacements[name]) for name in sorted(ADDED))
    result=Bundle(bundle.entrypoint,tuple(updated))
    # The host entrypoint, receivers, central-source and all data modules are
    # deliberately outside the allowlist, even when their branch files changed.
    if any(part!=next(p for p in result.parts if p.name==part.name) for part in bundle.parts if part.name not in OWNED):
        fail('VAR_UNOWNED_MODULE_CHANGED')
    return result

def main():
    if os.environ.get('GITHUB_REF')!='refs/heads/automatizacion/piloto-cloud-3sku-20261015' or os.environ.get('CF_FREE_ONLY_CONFIRMED')!='true':
        fail('VAR_PILOT_FREE_SCOPE_REQUIRED')
    require_control();baselines=fetch_baselines()
    replacements={name:compiled(name,(ROOT/'automatizacion'/name).read_bytes()) for name in OWNED}
    api=CFClient(os.environ.get('CLOUDFLARE_ACCOUNT_ID'),os.environ.get('CLOUDFLARE_API_TOKEN'))
    guard=ScopedDeployer(api);capture=guard.capture();before=capture['bundle']
    if capture['health']['release']!=BASE_RELEASE:fail('VAR_BASE_RELEASE_CHANGED')
    updated=prepare_variants(before,replacements,baselines)
    guard.check_before_put(capture);require_control()
    # One code-content mutation only, without secret/settings writes or retries.
    api.put_bundle(updated)
    for attempt in range(12):
        actual=api.get_bundle()
        if not same_bundle(actual,before) and not same_bundle(actual,updated):fail('VAR_UNEXPECTED_CONCURRENT_BUNDLE')
        if not same_json(api.get_settings(),capture['settings']):fail('VAR_SETTINGS_CHANGED_AFTER_PUT')
        closed_health(private_get('/health'),capture['health']['messenger_outbound'],capture['health']['release'])
        tester_scope(private_get,capture['health']['messenger_outbound'])
        if not same_json(private_get('/commercial/catalog'),capture['source']):fail('VAR_COMMERCIAL_SOURCE_CHANGED')
        if same_bundle(actual,updated):break
        if attempt==11:fail('VAR_PROPAGATION_NOT_VERIFIED')
        time.sleep(2)
    report={'schema':'conectatech.alex.variants-deployment.v1','passed':True,'variants_revision':os.environ['GITHUB_SHA'],
      'base_release_preserved':capture['health']['release'],'baseline_code_revision':CODE_REVISION,'changed_modules':sorted(name for name in OWNED if baselines.get(name)!=replacements[name]),
      'worker_puts':1,'settings_and_secrets_preserved':True,'unowned_module_bodies_preserved':True,'worker_unchanged':True,
      'central_source_module_unchanged':True,'commercial_source_preserved_exactly':True,'tester_transport_preserved':True,
      'external_customers_enabled':False,'new_cost_usd':0,'private_content_recorded':False}
    target=ROOT/'automatizacion/generated/fase2/alex-variants-deploy.json';target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))

if __name__=='__main__':
    try:main()
    except Exception as error:
        code=str(error) if isinstance(error,ValueError) else 'VAR_SCOPED_DEPLOYMENT_FAILED'
        sys.exit(code if code.startswith('VAR_') else 'VAR_SCOPED_DEPLOYMENT_FAILED')
