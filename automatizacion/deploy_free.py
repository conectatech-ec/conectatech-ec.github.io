"""Update one existing pilot Worker with a per-Worker Editor token.
Free plan is verified by owner in dashboard; no Billing/D1/account-list API access.
"""
import json, os, re, secrets, sys, urllib.error, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parent
WORKER='conectatech-comercial-piloto'
BRANCH='refs/heads/automatizacion/piloto-cloud-3sku-20261015'
SCRIPT='/workers/scripts/'+WORKER
def permitted_request(path,method):
    allowed={(SCRIPT+'/settings','GET'),(SCRIPT,'PUT'),(SCRIPT+'/secrets','PUT')}
    if (path,method) not in allowed: raise ValueError('Operation outside isolated Worker scope')
class API:
    def __init__(self,account,token):self.base=f'https://api.cloudflare.com/client/v4/accounts/{account}';self.token=token
    def call(self,path,method='GET',data=None,content_type='application/json'):
        permitted_request(path,method)
        payload=data if isinstance(data,bytes) else json.dumps(data).encode() if data is not None else None
        req=urllib.request.Request(self.base+path,data=payload,method=method,headers={'Authorization':'Bearer '+self.token,'Content-Type':content_type})
        try:
            with urllib.request.urlopen(req,timeout=45) as r: body=json.load(r)
        except urllib.error.HTTPError as e: raise RuntimeError(f'Worker request failed ({e.code}); verify existing pilot and per-Worker Editor scope. No permission broadening performed.') from None
        if body.get('success') is not True: raise RuntimeError('Worker request rejected; response body withheld')
        return body['result']
def multipart(metadata,files):
    boundary='codex-'+secrets.token_hex(16);parts=[]
    for name,ctype,body in [('metadata','application/json',json.dumps(metadata).encode()),*files]:
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{name}"\r\nContent-Type: {ctype}\r\n\r\n'.encode()+body+b'\r\n')
    return b''.join(parts)+f'--{boundary}--\r\n'.encode(),'multipart/form-data; boundary='+boundary
def connection_settings(environ):
    missing=[]
    if environ.get('CF_FREE_ONLY_CONFIRMED')!='true': missing.append('CF_FREE_ONLY_CONFIRMED')
    if not re.fullmatch(r'[a-f0-9]{32}',environ.get('CLOUDFLARE_ACCOUNT_ID','')): missing.append('CLOUDFLARE_ACCOUNT_ID')
    if not environ.get('CLOUDFLARE_API_TOKEN'): missing.append('CLOUDFLARE_API_TOKEN')
    if len(environ.get('PILOT_TOKEN',''))<32: missing.append('PILOT_TOKEN')
    if not re.fullmatch(r'https://'+re.escape(WORKER)+r'\.[a-z0-9-]+\.workers\.dev',environ.get('CLOUDFLARE_PILOT_URL','')): missing.append('CLOUDFLARE_PILOT_URL')
    return missing
def check_connection(api):
    settings=api.call(SCRIPT+'/settings')
    if not isinstance(settings,dict): raise ValueError('Pilot settings could not be verified')
    # Avoid discarding or inheriting production bindings from an unexpected Worker.
    for b in settings.get('bindings',[]):
        if b.get('name') not in {'AI','LIVE_DATA','FREE_TIER_VERIFIED','PILOT_TOKEN'} or b.get('type') not in {'ai','plain_text','secret_text'}:
            raise ValueError('Unexpected existing binding; review isolated pilot before upload')
    return True

def worker_metadata():
    return {'main_module':'worker.mjs','compatibility_date':'2026-10-01','bindings':[{'type':'ai','name':'AI'},{'type':'plain_text','name':'LIVE_DATA','text':'true'},{'type':'plain_text','name':'FREE_TIER_VERIFIED','text':'true'}],'observability':{'enabled':False}}
def report_connection(result):
    path=ROOT/'generated/fase2/connection.json';path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('ready='+str(result['ready']).lower()+'\n')
def main():
    if os.environ.get('GITHUB_REF')!=BRANCH: raise ValueError('Only the isolated pilot branch may connect or deploy')
    check_only=sys.argv[1:]==['--check']
    if sys.argv[1:] and not check_only: raise ValueError('Unsupported argument')
    if not check_only:
        config=json.loads((ROOT/'activar-cloud.json').read_text())
        if config.get('activar') is not True: raise ValueError('Activation remains disabled')
    missing=connection_settings(os.environ)
    if missing:
        if check_only:
            report_connection({'ready':False,'status':'awaiting_github_environment_configuration','missing':missing,'cloud_requests_issued':False});return
        raise ValueError('Missing configuration; no requests issued: '+', '.join(missing))
    api=API(os.environ['CLOUDFLARE_ACCOUNT_ID'],os.environ['CLOUDFLARE_API_TOKEN'])
    check_connection(api)
    if check_only:
        report_connection({'ready':True,'status':'existing_worker_read_check_passed','plan_verification':'owner_dashboard_attestation','resources_created':False,'d1_enabled':False});return
    metadata=worker_metadata();files=[]
    for name in ['worker.mjs','live.mjs','channels.mjs','banner.mjs']:
        source=(ROOT/name).read_text()
        if name=='worker.mjs': source=source.replace("import catalog from './generated/catalogo.json' with {type:'json'};","import catalog from './catalog.mjs';")
        files.append((name,'application/javascript+module',source.encode()))
    files.append(('catalog.mjs','application/javascript+module',b'export default '+(ROOT/'generated/catalogo.json').read_bytes()+b';\n'))
    body,ctype=multipart(metadata,files)
    api.call(SCRIPT,'PUT',body,ctype)
    api.call(SCRIPT+'/secrets','PUT',{'name':'PILOT_TOKEN','text':os.environ['PILOT_TOKEN'],'type':'secret_text'})
    # workers.dev is enabled manually in the panel; no account/subdomain/route changes.
    url=os.environ['CLOUDFLARE_PILOT_URL']
    path=ROOT/'generated/fase2/deployment.json';path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps({'url':url,'worker':WORKER,'plan_verification':'owner_dashboard_attestation','d1_enabled':False,'real_ai':'pending_smoke_test'},indent=2)+'\n')
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('url='+url+'\n')
    print('Isolated pilot uploaded; HTTPS and real AI must pass smoke test')
if __name__=='__main__':
    try:main()
    except (ValueError,RuntimeError) as e:sys.exit(str(e))
