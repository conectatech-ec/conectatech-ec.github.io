"""Three existing conversational modules only; preserve the live host/data/assets."""
import base64,json,os,sys,time,urllib.request
from dataclasses import replace
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'automatizacion'))
from scoped_content import CFClient,ScopedDeployer,Bundle,same_bundle,same_json,private_get,read_latest_revision,NoRedirect,strict_json
from scoped_policy import closed_health,tester_scope
BASE='acfc00763dfbc7ac34c2c62f9ccecea4f613c870'
BASELINE='e984fe95263fbf545d283e8ea7252ae3089f681d'
OWNED=frozenset({'alex.mjs','alex-store.mjs','alex-ui.mjs'})
CONTROL='https://api.github.com/repos/conectatech-ec/conectatech-ec.github.io/contents/.github/alex-conversation.json?ref=automatizacion%2Fpiloto-cloud-3sku-20261015'
RAW='https://raw.githubusercontent.com/conectatech-ec/conectatech-ec.github.io/'
def fail(code):raise ValueError(code)
def public_get(url):
    req=urllib.request.Request(url,headers={'Accept':'application/vnd.github+json','Cache-Control':'no-cache','User-Agent':'CONECTATECH-Alex-conversation'})
    with urllib.request.build_opener(NoRedirect()).open(req,timeout=30) as r:
        data=r.read(200001)
        if r.status!=200 or len(data)>200000:fail('CONV_PUBLIC_READ_FAILED')
    return data
def control():
    value=strict_json(base64.b64decode(strict_json(public_get(CONTROL))['content']))
    expected={'deploy':True,'verify':False,'worker':'conectatech-comercial-piloto','baseline_code_revision':BASELINE,'cost_max_usd':0}
    if value!=expected or type(value['deploy']) is not bool or type(value['cost_max_usd']) is not int:fail('CONV_CONTROL_DISABLED_OR_CHANGED')
    if read_latest_revision()!=os.environ.get('GITHUB_SHA'):fail('CONV_STALE_REVISION')
def compiled(name,body):
    if name not in OWNED or not isinstance(body,bytes):fail('CONV_COMPILE_SCOPE')
    for old,new in [(b"import policy from './alex-policy.json' with {type:'json'};",b"import policy from './alex-policy.mjs';"),(b"import signatureLibrary from './marketplace-library.json' with {type:'json'};",b"import signatureLibrary from './marketplace-library.mjs';")]:body=body.replace(old,new)
    if b"with {type:'json'}" in body:fail('CONV_JSON_IMPORT_UNHANDLED')
    return body
def prepare(bundle,replacements,baselines):
    names=[p.name for p in bundle.parts]
    if bundle.entrypoint!='worker.mjs' or set(replacements)!=OWNED or set(baselines)!=OWNED or len(names)!=len(set(names)) or not OWNED.issubset(names):fail('CONV_MODULE_SET_CHANGED')
    for p in bundle.parts:
        if p.name in OWNED and p.body!=baselines[p.name]:fail('CONV_LIVE_BASELINE_CHANGED')
    marker=b'export function privacyPage'
    old=baselines['alex-ui.mjs'];new=replacements['alex-ui.mjs']
    if old.count(marker)!=1 or new.count(marker)!=1 or old.split(marker)[1]!=new.split(marker)[1]:fail('CONV_PRIVACY_CHANGED')
    if any(not isinstance(b,bytes) or not 100<=len(b)<=200000 for b in replacements.values()):fail('CONV_MODULE_INVALID')
    return Bundle(bundle.entrypoint,tuple(replace(p,body=replacements[p.name],headers=tuple((k,str(len(replacements[p.name])) if k.lower()=='content-length' else v) for k,v in p.headers)) if p.name in OWNED else p for p in bundle.parts))
def main():
    if os.environ.get('GITHUB_REF')!='refs/heads/automatizacion/piloto-cloud-3sku-20261015' or os.environ.get('CF_FREE_ONLY_CONFIRMED')!='true':fail('CONV_PILOT_FREE_ONLY')
    control()
    baselines={n:compiled(n,public_get(RAW+BASELINE+'/automatizacion/'+n)) for n in OWNED}
    replacements={n:compiled(n,(ROOT/'automatizacion'/n).read_bytes()) for n in OWNED}
    api=CFClient(os.environ.get('CLOUDFLARE_ACCOUNT_ID'),os.environ.get('CLOUDFLARE_API_TOKEN'))
    guard=ScopedDeployer(api);capture=guard.capture()
    if capture['health']['release']!=BASE:fail('CONV_RELEASE_CHANGED')
    updated=prepare(capture['bundle'],replacements,baselines)
    guard.check_before_put(capture);control();api.put_bundle(updated)
    for attempt in range(12):
        actual=api.get_bundle()
        if not same_bundle(actual,capture['bundle']) and not same_bundle(actual,updated):fail('CONV_CONCURRENT_BUNDLE')
        if not same_json(api.get_settings(),capture['settings']):fail('CONV_SETTINGS_CHANGED')
        closed_health(private_get('/health'),capture['health']['messenger_outbound'],BASE);tester_scope(private_get,capture['health']['messenger_outbound'])
        if not same_json(private_get('/commercial/catalog'),capture['source']):fail('CONV_SOURCE_CHANGED')
        if same_bundle(actual,updated):break
        if attempt==11:fail('CONV_PROPAGATION_UNCONFIRMED')
        time.sleep(2)
    receipt={'schema':'conectatech.alex.conversation-deploy.v1','passed':True,'revision':os.environ['GITHUB_SHA'],'changed_modules':sorted(OWNED),'worker_puts':1,'worker_and_unowned_modules_preserved':True,'settings_secrets_and_quotas_preserved':True,'source_and_banners_preserved':True,'external_customers_enabled':False,'new_cost_usd':0,'private_content_recorded':False}
    path=ROOT/'automatizacion/generated/fase2/alex-conversation-deploy.json';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
if __name__=='__main__':
    try:main()
    except Exception as e:sys.exit(str(e) if isinstance(e,ValueError) and str(e).startswith('CONV_') else 'CONV_DEPLOY_FAILED_PRIVATE_DETAILS_WITHHELD')
