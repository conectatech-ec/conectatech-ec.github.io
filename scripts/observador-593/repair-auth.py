#!/usr/bin/env python3
"""Update only the installed observer identity adapter through original transport."""
import hashlib,json,os,sys
from dataclasses import replace
from pathlib import Path
ROOT=Path(__file__).resolve().parent
NAME='observer-auth.mjs'
def sha(body):return hashlib.sha256(body).hexdigest()
def change(bundle,expected,body,Bundle):
    parts=[p for p in bundle.parts if p.name==NAME]
    if len(parts)!=1 or sha(parts[0].body)!=expected:raise ValueError('AUTH_BASE_CHANGED')
    return Bundle(bundle.entrypoint,tuple(replace(p,body=body,headers=tuple((k,str(len(body)) if k.lower()=='content-length' else v) for k,v in p.headers)) if p.name==NAME else p for p in bundle.parts))
def main():
    if os.environ.get('GITHUB_REF')!='refs/heads/automatizacion/piloto-cloud-3sku-20261015':raise ValueError('EXISTING_PILOT_BRANCH_REQUIRED')
    if os.environ.get('CF_FREE_ONLY_CONFIRMED')!='true':raise ValueError('FREE_ONLY_REQUIRED')
    if os.environ.get('CT593_INSTALL_AUTHORIZATION')!='DG26_OBSERVADOR_593_IMPLEMENTACION_AUTORIZADA_V1':raise ValueError('INSTALL_AUTHORIZATION_REQUIRED')
    if os.environ.get('GITHUB_RUN_ATTEMPT')!='1':raise ValueError('INSTALL_NOT_REENTRANT')
    sys.path.insert(0,os.environ['CT593_ORIGINAL_TRANSPORT'])
    from scoped_content import CFClient,Bundle,same_bundle,same_json
    api=CFClient(os.environ['CLOUDFLARE_ACCOUNT_ID'],os.environ['CLOUDFLARE_API_TOKEN'])
    settings=api.get_settings();before=api.get_bundle()
    old=next(p.body for p in before.parts if p.name==NAME)
    body=(ROOT/NAME).read_bytes();after=change(before,os.environ['CT593_AUTH_EXPECTED_SHA'],body,Bundle)
    if not same_json(settings,api.get_settings()) or not same_bundle(before,api.get_bundle()):raise ValueError('RUNTIME_CHANGED_BEFORE_PUT')
    try:
        result=api.put_bundle(after)
        if not same_bundle(after,api.get_bundle()) or not same_json(settings,api.get_settings()):raise ValueError('POST_INSTALL_MISMATCH')
        print(json.dumps({'stage':'observer_auth_updated','sha256':sha(body),'provider':result,'other_modules_preserved':len(before.parts)-1,'settings_preserved':True}))
    except Exception:
        current=api.get_bundle()
        if not same_bundle(before,current):
            inverse=change(current,sha(body),old,Bundle);api.put_bundle(inverse)
            if not same_bundle(inverse,api.get_bundle()):raise ValueError('RECOVERY_NOT_VERIFIED')
        raise ValueError('AUTH_UPDATE_NOT_VERIFIED') from None
if __name__=='__main__':
    try:main()
    except Exception as e:
        allowed={'AUTH_BASE_CHANGED','EXISTING_PILOT_BRANCH_REQUIRED','FREE_ONLY_REQUIRED','INSTALL_AUTHORIZATION_REQUIRED','INSTALL_NOT_REENTRANT','RUNTIME_CHANGED_BEFORE_PUT','POST_INSTALL_MISMATCH','RECOVERY_NOT_VERIFIED','AUTH_UPDATE_NOT_VERIFIED'}
        print('::error::'+(str(e) if str(e) in allowed else 'AUTH_UPDATE_FAILED'));raise SystemExit(1)
