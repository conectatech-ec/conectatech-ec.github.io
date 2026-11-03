"""Scoped collaborator simulator update. Private runtime content stays only in RAM."""
import base64,json,os,sys,time,urllib.request
from dataclasses import replace
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'automatizacion'))
from scoped_content import CFClient,ScopedDeployer,Bundle,Part,same_bundle,same_json,private_get,read_latest_revision,NoRedirect
from scoped_policy import closed_health,tester_scope

BASE_RELEASE='acfc00763dfbc7ac34c2c62f9ccecea4f613c870'
UI_RELEASE='a51a1d9d947dcf306a7035a3a6e014b14667b269'
OWNED=frozenset({'worker.mjs','alex.mjs','alex-store.mjs','alex-ui.mjs','alex-collaborators.mjs'})
REPLACED=frozenset({'worker.mjs','alex.mjs','alex-store.mjs','alex-ui.mjs'})
NEW_MODULE='alex-collaborators.mjs'
CONTROL='https://api.github.com/repos/conectatech-ec/conectatech-ec.github.io/contents/.github/alex-collaborators.json?ref=automatizacion%2Fpiloto-cloud-3sku-20261015'
RAW='https://raw.githubusercontent.com/conectatech-ec/conectatech-ec.github.io/'
CHAT_START=b"   if(path==='/alex/chat'&&req.method==='POST'){"
CHAT_END=b"   if(['/alex/status','/alex/handoffs']"
PROFILE_IMPORT=b"import {profilesForOwner,routeSimulator} from './alex-collaborators.mjs';\n"
PRIVACY=b'export function privacyPage'

def fail(code):raise ValueError(code)

def require_control():
    request=urllib.request.Request(CONTROL,headers={'Accept':'application/vnd.github+json','Cache-Control':'no-cache','User-Agent':'CONECTATECH-Alex-Collaborators'})
    with urllib.request.build_opener(NoRedirect()).open(request,timeout=30) as response:
        raw=response.read(16385)
        if response.status!=200 or len(raw)>16384:fail('COL_CONTROL_READ_FAILED')
    body=json.loads(raw)
    value=json.loads(base64.b64decode(body['content'],validate=False))
    expected={'deploy':True,'worker':'conectatech-comercial-piloto','expected_base_release':BASE_RELEASE,'cost_max_usd':0}
    if value!=expected:fail('COL_PUBLIC_CONTROL_DISABLED_OR_CHANGED')
    if os.environ.get('EXPECTED_BASE_RELEASE',BASE_RELEASE)!=BASE_RELEASE:fail('COL_BASE_RELEASE_NOT_AUTHORIZED')
    if read_latest_revision()!=os.environ.get('GITHUB_SHA'):fail('COL_REVISION_NO_LONGER_CURRENT')

def compiled(name,body):
    if name=='alex.mjs':
        return body.replace(b"import policy from './alex-policy.json' with {type:'json'};",b"import policy from './alex-policy.mjs';")
    return body

def fetch_baselines():
    result={}
    for name in sorted(REPLACED):
        revision=UI_RELEASE if name=='alex-ui.mjs' else BASE_RELEASE
        request=urllib.request.Request(RAW+revision+'/automatizacion/'+name,headers={'Cache-Control':'no-cache','User-Agent':'CONECTATECH-Alex-Collaborators'})
        with urllib.request.build_opener(NoRedirect()).open(request,timeout=30) as response:
            value=response.read(200001)
            if response.status!=200 or not 100<=len(value)<=200000:fail('COL_PUBLIC_BASELINE_INVALID')
        result[name]=compiled(name,value)
    return result

def chat_block(text):
    if text.count(CHAT_START)!=1 or text.count(CHAT_END)!=1:fail('COL_WORKER_ROUTE_ANCHOR_INVALID')
    start=text.index(CHAT_START);end=text.index(CHAT_END)
    if start>=end:fail('COL_WORKER_ROUTE_ORDER_INVALID')
    return text[start:end]

def patch_worker(live,baseline,updated):
    old=chat_block(baseline);new=chat_block(updated)
    if live.count(old)!=1 or PROFILE_IMPORT in live:fail('COL_LIVE_WORKER_ROUTE_CHANGED')
    if updated.count(PROFILE_IMPORT)!=1 or new.count(b"path==='/alex/collaborators'")!=1 or b'routeSimulator(b)' not in new:
        fail('COL_UPDATED_WORKER_ROUTE_INVALID')
    if live.count(b'const json=')!=1:fail('COL_WORKER_IMPORT_ANCHOR_INVALID')
    # No other byte from the local worker replaces live code, including pending
    # Data Hub or banner previews owned by other sessions.
    return live.replace(old,new,1).replace(b'const json=',PROFILE_IMPORT+b'const json=',1)

def prepare_collaborators(bundle,replacements,baselines):
    names=[part.name for part in bundle.parts]
    if bundle.entrypoint!='worker.mjs' or set(replacements)!=OWNED or set(baselines)!=REPLACED or len(names)!=len(set(names)):
        fail('COL_MODULE_SET_INVALID')
    if not REPLACED.issubset(names) or NEW_MODULE in names:fail('COL_LIVE_MODULE_LAYOUT_CHANGED')
    for name,body in replacements.items():
        if not isinstance(body,bytes) or not 100<=len(body)<=200000:fail('COL_REPLACEMENT_INVALID')
    parts={part.name:part for part in bundle.parts}
    for name in ('alex.mjs','alex-store.mjs','alex-ui.mjs'):
        if parts[name].body!=baselines[name]:fail('COL_LIVE_OWNED_MODULE_CHANGED')
    old_ui=parts['alex-ui.mjs'].body;new_ui=replacements['alex-ui.mjs']
    if old_ui.count(PRIVACY)!=1 or new_ui.count(PRIVACY)!=1 or old_ui.split(PRIVACY)[1]!=new_ui.split(PRIVACY)[1]:
        fail('COL_PRIVACY_PAGE_CHANGED')
    worker=patch_worker(parts['worker.mjs'].body,baselines['worker.mjs'],replacements['worker.mjs'])
    updated=[]
    for part in bundle.parts:
        if part.name in REPLACED:
            body=worker if part.name=='worker.mjs' else replacements[part.name]
            headers=tuple((key,str(len(body)) if key.lower()=='content-length' else value) for key,value in part.headers)
            part=replace(part,body=body,headers=headers)
        updated.append(part)
    updated.append(Part(NEW_MODULE,NEW_MODULE,'application/javascript+module',replacements[NEW_MODULE]))
    result=Bundle(bundle.entrypoint,tuple(updated))
    if any(part!=next(p for p in result.parts if p.name==part.name) for part in bundle.parts if part.name not in OWNED):
        fail('COL_UNOWNED_MODULE_CHANGED')
    return result

def main():
    if os.environ.get('GITHUB_REF')!='refs/heads/automatizacion/piloto-cloud-3sku-20261015' or os.environ.get('CF_FREE_ONLY_CONFIRMED')!='true':
        fail('COL_PILOT_FREE_SCOPE_REQUIRED')
    require_control();baselines=fetch_baselines()
    replacements={name:compiled(name,(ROOT/'automatizacion'/name).read_bytes()) for name in OWNED}
    api=CFClient(os.environ.get('CLOUDFLARE_ACCOUNT_ID'),os.environ.get('CLOUDFLARE_API_TOKEN'))
    guard=ScopedDeployer(api);capture=guard.capture();before=capture['bundle']
    if capture['health']['release']!=BASE_RELEASE:fail('COL_BASE_RELEASE_CHANGED')
    updated=prepare_collaborators(before,replacements,baselines)
    guard.check_before_put(capture);require_control()
    # Exactly one content-only PUT, never retried. No settings, secrets, routes,
    # source, schedules or new resource mutations are available to this script.
    api.put_bundle(updated)
    for attempt in range(12):
        actual=api.get_bundle()
        if not same_bundle(actual,before) and not same_bundle(actual,updated):fail('COL_UNEXPECTED_CONCURRENT_BUNDLE')
        if not same_json(api.get_settings(),capture['settings']):fail('COL_SETTINGS_CHANGED_AFTER_PUT')
        closed_health(private_get('/health'),capture['health']['messenger_outbound'],capture['health']['release'])
        tester_scope(private_get,capture['health']['messenger_outbound'])
        if not same_json(private_get('/commercial/catalog'),capture['source']):fail('COL_COMMERCIAL_SOURCE_CHANGED')
        if same_bundle(actual,updated):break
        if attempt==11:fail('COL_PROPAGATION_NOT_VERIFIED')
        time.sleep(2)
    report={'schema':'conectatech.alex.collaborators-deployment.v1','passed':True,'collaborators_revision':os.environ['GITHUB_SHA'],
      'base_release_preserved':capture['health']['release'],'changed_modules':sorted(OWNED),'worker_patch':'only_simulator_route_and_profile_import',
      'worker_puts':1,'settings_and_secrets_preserved':True,'unowned_module_bodies_preserved':True,
      'unowned_worker_regions_preserved':True,'commercial_source_preserved_exactly':True,'tester_transport_preserved':True,
      'external_customers_enabled':False,'new_cost_usd':0,'private_content_recorded':False}
    target=ROOT/'automatizacion/generated/fase2/alex-collaborators-deploy.json';target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))

if __name__=='__main__':
    try:main()
    except Exception as error:
        code=str(error) if isinstance(error,ValueError) else 'COL_SCOPED_DEPLOYMENT_FAILED'
        sys.exit(code if code.startswith('COL_') else 'COL_SCOPED_DEPLOYMENT_FAILED')
