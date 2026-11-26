#!/usr/bin/env python3
"""Update only the installed observer identity adapter through original transport."""
import hashlib,json,os,sys
from dataclasses import replace
from pathlib import Path
ROOT=Path(__file__).resolve().parent
NAME='observer-auth.mjs'
def sha(body):return hashlib.sha256(body).hexdigest()
def change(bundle,expected,body,Bundle,name=NAME):
    if name not in {NAME,'observer-dispatch.mjs'}:raise ValueError('ADAPTER_SCOPE_DENIED')
    parts=[p for p in bundle.parts if p.name==name]
    if len(parts)!=1 or sha(parts[0].body)!=expected:raise ValueError('AUTH_BASE_CHANGED')
    return Bundle(bundle.entrypoint,tuple(replace(p,body=body,headers=tuple((k,str(len(body)) if k.lower()=='content-length' else v) for k,v in p.headers)) if p.name==name else p for p in bundle.parts))
def main():
    if os.environ.get('GITHUB_REF')!='refs/heads/automatizacion/piloto-cloud-3sku-20261015':raise ValueError('EXISTING_PILOT_BRANCH_REQUIRED')
    if os.environ.get('CF_FREE_ONLY_CONFIRMED')!='true':raise ValueError('FREE_ONLY_REQUIRED')
    if os.environ.get('CT593_INSTALL_AUTHORIZATION')!='DG26_OBSERVADOR_593_IMPLEMENTACION_AUTORIZADA_V1':raise ValueError('INSTALL_AUTHORIZATION_REQUIRED')
    if os.environ.get('GITHUB_RUN_ATTEMPT')!='1':raise ValueError('INSTALL_NOT_REENTRANT')
    sys.path.insert(0,os.environ['CT593_ORIGINAL_TRANSPORT'])
    from scoped_content import CFClient,Bundle,same_bundle,same_json
    api=CFClient(os.environ['CLOUDFLARE_ACCOUNT_ID'],os.environ['CLOUDFLARE_API_TOKEN'])
    settings=api.get_settings();before=api.get_bundle()
    expected={NAME:os.environ['CT593_AUTH_EXPECTED_SHA']}
    if os.environ.get('CT593_DISPATCH_EXPECTED_SHA'):expected['observer-dispatch.mjs']=os.environ['CT593_DISPATCH_EXPECTED_SHA']
    old={p.name:p.body for p in before.parts if p.name in expected}
    bodies={n:(ROOT/n).read_bytes() for n in expected};after=before
    for name in expected:after=change(after,expected[name],bodies[name],Bundle,name)
    if not same_json(settings,api.get_settings()) or not same_bundle(before,api.get_bundle()):raise ValueError('RUNTIME_CHANGED_BEFORE_PUT')
    try:
        result=api.put_bundle(after)
        if not same_bundle(after,api.get_bundle()) or not same_json(settings,api.get_settings()):raise ValueError('POST_INSTALL_MISMATCH')
        print(json.dumps({'stage':'observer_adapters_updated','sha256':{n:sha(b) for n,b in bodies.items()},'provider':result,'other_modules_preserved':len(before.parts)-len(expected),'settings_preserved':True}))
    except Exception:
        current=api.get_bundle()
        if not same_bundle(before,current):
            inverse=current
            for name in expected:inverse=change(inverse,sha(bodies[name]),old[name],Bundle,name)
            api.put_bundle(inverse)
            if not same_bundle(inverse,api.get_bundle()):raise ValueError('RECOVERY_NOT_VERIFIED')
        raise ValueError('AUTH_UPDATE_NOT_VERIFIED') from None
if __name__=='__main__':
    try:main()
    except Exception as e:
        allowed={'ADAPTER_SCOPE_DENIED','AUTH_BASE_CHANGED','EXISTING_PILOT_BRANCH_REQUIRED','FREE_ONLY_REQUIRED','INSTALL_AUTHORIZATION_REQUIRED','INSTALL_NOT_REENTRANT','RUNTIME_CHANGED_BEFORE_PUT','POST_INSTALL_MISMATCH','RECOVERY_NOT_VERIFIED','AUTH_UPDATE_NOT_VERIFIED'}
        print('::error::'+(str(e) if str(e) in allowed else 'AUTH_UPDATE_FAILED'));raise SystemExit(1)
