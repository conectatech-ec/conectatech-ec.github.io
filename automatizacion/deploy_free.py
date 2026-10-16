"""Cloudflare REST deployment; stdlib only. Never modifies a subscription or main.
No request is issued until activation, secrets and the free-account guard pass.
"""
import json, os, re, secrets, sys, urllib.error, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parent
WORKER='conectatech-comercial-piloto'
DATABASE='conectatech-comercial-piloto'
BRANCH='refs/heads/automatizacion/piloto-cloud-3sku-20261015'
def verify_free(subscriptions):
    if not isinstance(subscriptions,list): raise ValueError('Unverifiable account subscriptions')
    for s in subscriptions:
        if str(s.get('state','')).lower() in ('cancelled','expired'): continue
        price=s.get('price')
        if not isinstance(price,(int,float)) or price!=0: raise ValueError('Paid or unknown subscription: no deployment permitted')
        # Zero-price trials can still convert; refuse trials as well.
        if 'trial' in json.dumps(s).lower(): raise ValueError('Trial not permitted')
        plan=s.get('rate_plan',{})
        if str(plan.get('id','')).lower() not in ('free','workers_free'): raise ValueError('Zero base price does not establish a free plan')
        if any(float(c.get('unit_price',0))!=0 for c in plan.get('components',[])): raise ValueError('Metered charges not permitted')
    return True
class API:
    def __init__(self,account,token):self.base=f'https://api.cloudflare.com/client/v4/accounts/{account}';self.token=token
    def call(self,path,method='GET',data=None,content_type='application/json'):
        payload=data if isinstance(data,bytes) else json.dumps(data).encode() if data is not None else None
        req=urllib.request.Request(self.base+path,data=payload,method=method,headers={'Authorization':'Bearer '+self.token,'Content-Type':content_type})
        try:
            with urllib.request.urlopen(req,timeout=45) as r: body=json.load(r)
        except urllib.error.HTTPError as e: raise RuntimeError(f'Cloudflare request failed ({e.code}) at {path}; credentials and response body withheld') from None
        if body.get('success') is not True: raise RuntimeError('Cloudflare rejected '+path)
        if path=='/subscriptions' and body.get('result_info',{}).get('total_count',len(body['result']))>len(body['result']): raise RuntimeError('Paginated subscriptions cannot establish a free account')
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
    return missing
def check_connection(api):
    verify_free(api.call('/subscriptions'))
    subdomain=api.call('/workers/subdomain').get('subdomain')
    if not subdomain or not re.fullmatch(r'[a-z0-9-]+',subdomain): raise ValueError('Set a free workers.dev subdomain in the dashboard first')
    databases=api.call('/d1/database?per_page=100')
    if not isinstance(databases,list): raise ValueError('D1 permission could not be verified')
    return subdomain,databases
def report_connection(result):
    path=ROOT/'generated/fase2/connection.json';path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))
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
            report_connection({'ready':False,'status':'awaiting_github_environment_configuration','missing':missing,'cloud_requests_issued':False})
            return
        raise ValueError('Missing account or secrets; no requests issued: '+', '.join(missing))
    account=os.environ['CLOUDFLARE_ACCOUNT_ID'];token=os.environ['CLOUDFLARE_API_TOKEN'];pilot=os.environ['PILOT_TOKEN']
    api=API(account,token)
    subdomain,dbs=check_connection(api) # Only GET requests, including plan guard.
    if check_only:
        report_connection({'ready':True,'status':'read_only_check_passed','free_guard':'passed','workers_dev_configured':True,'d1_read_access':True,'resources_created':False})
        return
    matches=[d for d in dbs if d['name']==DATABASE]
    if len(matches)>1: raise ValueError('Ambiguous pilot database')
    db=matches[0] if matches else api.call('/d1/database','POST',{'name':DATABASE})
    dbid=db['uuid']
    api.call('/d1/database/'+dbid+'/query','POST',{'sql':(ROOT/'schema.sql').read_text()})
    metadata={'main_module':'worker.mjs','compatibility_date':'2026-10-01','bindings':[{'type':'d1','name':'DB','id':dbid},{'type':'ai','name':'AI'},{'type':'plain_text','name':'LIVE_DATA','text':'true'},{'type':'plain_text','name':'FREE_TIER_VERIFIED','text':'true'}], 'observability':{'enabled':False}}
    files=[]
    for name in ['worker.mjs','live.mjs','channels.mjs','banner.mjs']:
        source=(ROOT/name).read_text()
        if name=='worker.mjs': source=source.replace("import catalog from './generated/catalogo.json' with {type:'json'};","import catalog from './catalog.mjs';")
        files.append((name,'application/javascript+module',source.encode()))
    files.append(('catalog.mjs','application/javascript+module',b'export default '+(ROOT/'generated/catalogo.json').read_bytes()+b';\n'))
    body,ctype=multipart(metadata,files)
    api.call('/workers/scripts/'+WORKER,'PUT',body,ctype)
    api.call('/workers/scripts/'+WORKER+'/secrets','PUT',{'name':'PILOT_TOKEN','text':pilot,'type':'secret_text'})
    api.call('/workers/scripts/'+WORKER+'/schedules','PUT',[{'cron':'19 * * * *'}])
    # Only pilot workers.dev; no routes, domains, production scripts or Pages.
    api.call('/workers/scripts/'+WORKER+'/subdomain','POST',{'enabled':True,'previews_enabled':False})
    url=f'https://{WORKER}.{subdomain}.workers.dev'
    path=ROOT/'generated/fase2/deployment.json';path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps({'url':url,'worker':WORKER,'free_guard':'passed','real_ai':'pending_smoke_test'},indent=2)+'\n')
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('url='+url+'\n')
    print('Pilot deployed at '+url+'; real AI must still pass smoke test')
if __name__=='__main__':
    try:main()
    except (ValueError,RuntimeError) as e:sys.exit(str(e))
