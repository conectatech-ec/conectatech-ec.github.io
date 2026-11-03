"""Replace only the public chat UI in the live pilot bundle; no secret/settings/data writes."""
import base64,json,os,sys,time,urllib.request
from dataclasses import replace
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'automatizacion'))
from scoped_content import CFClient,ScopedDeployer,Bundle,same_bundle,same_json,private_get,read_latest_revision,NoRedirect
from scoped_policy import closed_health,tester_scope
TARGET='alex-ui.mjs'
CONTROL='https://api.github.com/repos/conectatech-ec/conectatech-ec.github.io/contents/.github/alex-simulator.json?ref=automatizacion%2Fpiloto-cloud-3sku-20261015'
def require_control():
    req=urllib.request.Request(CONTROL,headers={'Accept':'application/vnd.github+json','Cache-Control':'no-cache','User-Agent':'CONECTATECH-Alex-UI'})
    with urllib.request.build_opener(NoRedirect()).open(req,timeout=30) as response:
        body=json.load(response)
    value=json.loads(base64.b64decode(body['content'],validate=False))
    if value!={'deploy':True,'worker':'conectatech-comercial-piloto','module':TARGET,'expected_engine_release':os.environ['EXPECTED_ENGINE_RELEASE'],'cost_max_usd':0}:
        raise ValueError('UI_PUBLIC_CONTROL_DISABLED_OR_CHANGED')
    if read_latest_revision()!=os.environ['GITHUB_SHA']:raise ValueError('UI_REVISION_NO_LONGER_CURRENT')
def prepare_ui(bundle,text):
    owned=[p for p in bundle.parts if p.name==TARGET]
    if len(owned)!=1 or not isinstance(text,bytes) or not 1000<=len(text)<=100000:raise ValueError('UI_MODULE_INVALID')
    marker=b'export function privacyPage'
    if owned[0].body.count(marker)!=1 or text.count(marker)!=1 or owned[0].body.split(marker)[1]!=text.split(marker)[1]:
        raise ValueError('UI_CANNOT_CHANGE_PRIVACY_PAGES')
    parts=tuple(replace(p,body=text,headers=tuple((k,str(len(text)) if k.lower()=='content-length' else v) for k,v in p.headers)) if p.name==TARGET else p for p in bundle.parts)
    return Bundle(bundle.entrypoint,parts)
def main():
    if os.environ.get('GITHUB_REF')!='refs/heads/automatizacion/piloto-cloud-3sku-20261015' or os.environ.get('CF_FREE_ONLY_CONFIRMED')!='true':
        raise ValueError('UI_PILOT_FREE_SCOPE_REQUIRED')
    require_control()
    api=CFClient(os.environ.get('CLOUDFLARE_ACCOUNT_ID'),os.environ.get('CLOUDFLARE_API_TOKEN'))
    guard=ScopedDeployer(api);capture=guard.capture();before=capture['bundle']
    if capture['health']['release']!=os.environ['EXPECTED_ENGINE_RELEASE']:raise ValueError('UI_ENGINE_RELEASE_CHANGED')
    updated=prepare_ui(before,(ROOT/'automatizacion'/TARGET).read_bytes())
    if any(p!=next(q for q in updated.parts if q.name==p.name) for p in before.parts if p.name!=TARGET):raise ValueError('UI_UNOWNED_MODULE_CHANGED')
    guard.check_before_put(capture);require_control()
    puts=0
    if not same_bundle(before,updated):api.put_bundle(updated);puts=1
    for attempt in range(12):
        actual=api.get_bundle()
        if not same_bundle(actual,before) and not same_bundle(actual,updated):raise ValueError('UI_UNEXPECTED_CONCURRENT_BUNDLE')
        if not same_json(api.get_settings(),capture['settings']):raise ValueError('UI_SETTINGS_CHANGED')
        closed_health(private_get('/health'),capture['health']['messenger_outbound'],capture['health']['release'])
        tester_scope(private_get,capture['health']['messenger_outbound'])
        if not same_json(private_get('/commercial/catalog'),capture['source']):raise ValueError('UI_COMMERCIAL_SOURCE_CHANGED')
        if same_bundle(actual,updated):break
        if attempt==11:raise ValueError('UI_PROPAGATION_NOT_VERIFIED')
        time.sleep(2)
    report={'schema':'conectatech.alex.ui-deployment.v1','passed':True,'ui_revision':os.environ['GITHUB_SHA'],
      'engine_release_preserved':capture['health']['release'],'changed_modules':[TARGET],'worker_puts':puts,
      'settings_and_secrets_preserved':True,'all_other_module_bodies_preserved':True,'commercial_source_preserved_exactly':True,
      'tester_transport_preserved':True,'external_customers_enabled':False,'new_cost_usd':0,'private_content_recorded':False}
    target=ROOT/'automatizacion/generated/fase2/alex-simulator-deploy.json';target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
if __name__=='__main__':
    try:main()
    except Exception as error:
        code=str(error) if isinstance(error,ValueError) else 'UI_SCOPED_DEPLOYMENT_FAILED'
        sys.exit(code if code.startswith('UI_') else 'UI_SCOPED_DEPLOYMENT_FAILED')
