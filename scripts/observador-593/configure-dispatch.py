#!/usr/bin/env python3
"""Configure only the two observer bindings; never log secret values."""
import argparse,hashlib,json,os,re,sys,urllib.request
from datetime import datetime,timezone
REPO='conectatech-ec/conectatech-ec.github.io'
BRANCH='automatizacion/piloto-cloud-3sku-20261015'
WORKFLOW='publicar-corte-comercial-593.yml'
NAMES={'COMMERCIAL_ACTIONS_TOKEN','COMMERCIAL_OBSERVER_READY'}
EXPECTED={'observer-auth.mjs':'a8a947ca7d6168d93b7738d949a7d4b143765475f16de2c6c3d2c5d4a8958723','observer-dispatch.mjs':'2360a3a445c17bdab966b1d442f9eb12d57b739004e90afeaa3b1573c7008d78'}
CONTRACT='CT593_OBSERVER_V1'
def unchanged_settings(before,after,name):
    def clean(s):return {**s,'bindings':[b for b in s.get('bindings',[]) if b.get('name')!=name]}
    found=[b for b in after.get('bindings',[]) if b.get('name')==name]
    return clean(before)==clean(after) and len(found)==1 and found[0].get('type')=='secret_text'
def binding_payload(name,value):
    if name not in NAMES:raise ValueError('BINDING_SCOPE_DENIED')
    if name=='COMMERCIAL_ACTIONS_TOKEN' and not re.fullmatch(r'github_pat_[A-Za-z0-9_]{40,250}',value or ''):raise ValueError('FINE_GRAINED_CREDENTIAL_REQUIRED')
    if name=='COMMERCIAL_OBSERVER_READY' and value!=CONTRACT:raise ValueError('CONTRACT_REQUIRED')
    return json.dumps({'name':name,'text':value,'type':'secret_text'}).encode()
def github(opener,token,path,body=None):
    allowed={'/actions/workflows/'+WORKFLOW,'/actions/workflows/'+WORKFLOW+'/dispatches'}
    if path not in allowed and not re.fullmatch(r'/actions/runs/[0-9]+',path):raise ValueError('GITHUB_SCOPE_DENIED')
    headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':'application/json','User-Agent':'CONECTATECH-593','X-GitHub-Api-Version':'2022-11-28'}
    req=urllib.request.Request('https://api.github.com/repos/'+REPO+path,headers=headers,data=json.dumps(body).encode() if body else None)
    with opener.open(req,timeout=25) as response:
        raw=response.read(1000001)
        if len(raw)>1000000:raise ValueError('GITHUB_RESPONSE_LIMIT')
        return response.status,json.loads(raw) if raw else None
def main():
    p=argparse.ArgumentParser();p.add_argument('action',choices=['credential','ready']);p.add_argument('--probe-run');p.add_argument('--probe-head');a=p.parse_args()
    if os.environ.get('GITHUB_REF')!='refs/heads/'+BRANCH or os.environ.get('GITHUB_RUN_ATTEMPT')!='1':raise ValueError('EXISTING_PILOT_ONCE_REQUIRED')
    if os.environ.get('CF_FREE_ONLY_CONFIRMED')!='true' or os.environ.get('CT593_INSTALL_AUTHORIZATION')!='DG26_OBSERVADOR_593_IMPLEMENTACION_AUTORIZADA_V1':raise ValueError('AUTHORIZATION_REQUIRED')
    sys.path.insert(0,os.environ['CT593_ORIGINAL_TRANSPORT'])
    from scoped_content import CFClient,NoRedirect,same_bundle,same_json
    opener=urllib.request.build_opener(NoRedirect());token=os.environ.get('COMMERCIAL_ACTIONS_TOKEN','')
    binding_payload('COMMERCIAL_ACTIONS_TOKEN',token)
    status,workflow=github(opener,token,'/actions/workflows/'+WORKFLOW)
    if status!=200 or workflow.get('path')!='.github/workflows/'+WORKFLOW or workflow.get('state')!='active':raise ValueError('WORKFLOW_IDENTITY')
    if a.action=='ready':
        if not re.fullmatch(r'[0-9]+',a.probe_run or '') or not re.fullmatch(r'[a-f0-9]{40}',a.probe_head or ''):raise ValueError('PROBE_REQUIRED')
        status,run=github(opener,token,'/actions/runs/'+a.probe_run)
        if status!=200 or run.get('conclusion')!='success' or run.get('head_sha')!=a.probe_head or run.get('head_branch')!=BRANCH or run.get('event')!='workflow_dispatch' or run.get('path')!='.github/workflows/'+WORKFLOW:raise ValueError('PROBE_NOT_VERIFIED')
    api=CFClient(os.environ['CLOUDFLARE_ACCOUNT_ID'],os.environ['CLOUDFLARE_API_TOKEN']);before=api.get_settings();bundle=api.get_bundle()
    actual={x.name:hashlib.sha256(x.body).hexdigest() for x in bundle.parts}
    if any(actual.get(n)!=v for n,v in EXPECTED.items()):raise ValueError('ADAPTER_VERSION_CHANGED')
    name='COMMERCIAL_ACTIONS_TOKEN' if a.action=='credential' else 'COMMERCIAL_OBSERVER_READY'
    if any(b.get('name')==name for b in before.get('bindings',[])):raise ValueError('BINDING_ALREADY_EXISTS')
    if a.action=='ready' and not any(b.get('name')=='COMMERCIAL_ACTIONS_TOKEN' and b.get('type')=='secret_text' for b in before.get('bindings',[])):raise ValueError('CREDENTIAL_NOT_INSTALLED')
    if not same_bundle(bundle,api.get_bundle()) or not same_json(before,api.get_settings()):raise ValueError('RUNTIME_CHANGED')
    value=token if a.action=='credential' else CONTRACT
    req=urllib.request.Request(api.base+'/workers/scripts/conectatech-comercial-piloto/secrets',method='PUT',headers={'Authorization':'Bearer '+api.token,'Content-Type':'application/json'},data=binding_payload(name,value))
    with opener.open(req,timeout=45) as response:
        if response.status!=200 or json.loads(response.read(100000)).get('success') is not True:raise ValueError('BINDING_INSTALL_FAILED')
    if not same_bundle(bundle,api.get_bundle()) or not unchanged_settings(before,api.get_settings(),name):raise ValueError('BINDING_POSTCHECK_FAILED')
    if a.action=='credential':
        status,_=github(opener,token,'/actions/workflows/'+WORKFLOW+'/dispatches',{'ref':BRANCH,'inputs':{'source_sha256':'a2609eff408b43fbecaf75dc2b4e04624154a448f5c8cd30192cdf348d8875f4','verify_only':True}})
        if status!=204:raise ValueError('CREDENTIAL_DISPATCH_FAILED')
    print(json.dumps({'stage':'observer_binding_configured','binding':name,'at':datetime.now(timezone.utc).isoformat(),'modules_preserved':len(bundle.parts),'other_settings_preserved':True,'probe_requested':a.action=='credential','apps_script_trigger_created':False}))
if __name__=='__main__':
    try:main()
    except Exception as e:
        codes={'BINDING_SCOPE_DENIED','FINE_GRAINED_CREDENTIAL_REQUIRED','CONTRACT_REQUIRED','GITHUB_SCOPE_DENIED','GITHUB_RESPONSE_LIMIT','EXISTING_PILOT_ONCE_REQUIRED','AUTHORIZATION_REQUIRED','WORKFLOW_IDENTITY','PROBE_REQUIRED','PROBE_NOT_VERIFIED','ADAPTER_VERSION_CHANGED','BINDING_ALREADY_EXISTS','CREDENTIAL_NOT_INSTALLED','RUNTIME_CHANGED','BINDING_INSTALL_FAILED','BINDING_POSTCHECK_FAILED','CREDENTIAL_DISPATCH_FAILED'}
        print('::error::'+(str(e) if type(e) is ValueError and str(e) in codes else 'BINDING_CONFIGURATION_FAILED'));raise SystemExit(1)
