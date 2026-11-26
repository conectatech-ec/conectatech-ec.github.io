#!/usr/bin/env python3
"""Apply only the reviewed 593 adapter through the existing content transport.

Provider bindings, schedules and all unrelated module bytes remain unchanged.
No credential value or private Worker module is written to a log or artifact.
"""
import hashlib,importlib.util,json,os,sys
from dataclasses import replace
from pathlib import Path
ROOT=Path(__file__).resolve().parent
OWNED={'worker.mjs','commercial-reception.mjs','observer-auth.mjs','observer-dispatch.mjs'}
def sha(x):return hashlib.sha256(x).hexdigest()
def load_patch():
    s=importlib.util.spec_from_file_location('receiver_patch',ROOT/'patch-receiver.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def modules(bundle):return {p.name:p for p in bundle.parts}
def candidate(bundle,patch,Part,Bundle):
    parts=modules(bundle)
    if len(parts)!=len(bundle.parts) or bundle.entrypoint!='worker.mjs' or not {'worker.mjs','commercial-reception.mjs'}<=parts.keys():raise ValueError('BUNDLE_LAYOUT_CHANGED')
    if any(n in parts for n in ['observer-auth.mjs','observer-dispatch.mjs']):raise ValueError('ADAPTER_ALREADY_PRESENT')
    after=[]
    for p in bundle.parts:
        raw=patch.patch_worker(p.body) if p.name=='worker.mjs' else patch.patch_receiver(p.body) if p.name=='commercial-reception.mjs' else p.body
        after.append(replace(p,body=raw,headers=tuple((k,str(len(raw)) if k.lower()=='content-length' else v) for k,v in p.headers)))
    for name in ['observer-auth.mjs','observer-dispatch.mjs']:
        after.append(Part(name,name,'application/javascript+module',(ROOT/name).read_bytes(),()))
    return Bundle(bundle.entrypoint,tuple(after))
def hashes(bundle):return {p.name:sha(p.body) for p in bundle.parts}
def recover(before,after,current,Bundle):
    old=modules(before);new=modules(after);live=modules(current)
    for name in OWNED:
        if name not in live or live[name].body!=new[name].body:raise ValueError('RECOVERY_OWNED_MODULE_CHANGED')
    # Keep concurrent unrelated modules; restore only our exact reviewed delta.
    parts=tuple(old[p.name] if p.name in old and p.name in OWNED else p for p in current.parts if p.name not in {'observer-auth.mjs','observer-dispatch.mjs'})
    return Bundle(current.entrypoint,parts)
def main():
    if os.environ.get('GITHUB_REF')!='refs/heads/automatizacion/piloto-cloud-3sku-20261015':raise ValueError('EXISTING_PILOT_BRANCH_REQUIRED')
    if os.environ.get('CF_FREE_ONLY_CONFIRMED')!='true':raise ValueError('FREE_ONLY_REQUIRED')
    if os.environ.get('CT593_INSTALL_AUTHORIZATION')!='DG26_OBSERVADOR_593_IMPLEMENTACION_AUTORIZADA_V1':raise ValueError('INSTALL_AUTHORIZATION_REQUIRED')
    if os.environ.get('GITHUB_RUN_ATTEMPT')!='1':raise ValueError('INSTALL_NOT_REENTRANT')
    # Imported from the same reviewed original provider transport, not a new deployer.
    sys.path.insert(0,os.environ['CT593_ORIGINAL_TRANSPORT'])
    from scoped_content import CFClient,Part,Bundle,same_bundle,same_json
    api=CFClient(os.environ['CLOUDFLARE_ACCOUNT_ID'],os.environ['CLOUDFLARE_API_TOKEN'])
    settings=api.get_settings();before=api.get_bundle();after=candidate(before,load_patch(),Part,Bundle)
    if not same_json(settings,api.get_settings()) or not same_bundle(before,api.get_bundle()):raise ValueError('RUNTIME_CHANGED_BEFORE_PUT')
    attempted=False
    try:
        attempted=True;result=api.put_bundle(after)
        current=api.get_bundle();observed=api.get_settings()
        if not same_bundle(after,current) or not same_json(settings,observed):raise ValueError('POST_INSTALL_MISMATCH')
        print(json.dumps({'stage':'receiver_adapter_installed','provider':result,'modified':{n:hashes(after)[n] for n in OWNED},'unrelated_modules_preserved':len(before.parts)-2,'settings_preserved':True,'trigger_created':False}))
    except Exception:
        if attempted:
            current=api.get_bundle()
            if same_bundle(before,current):
                print(json.dumps({'stage':'original_bundle_preserved'}))
            else:
                inverse=recover(before,after,current,Bundle);api.put_bundle(inverse)
                if not same_bundle(inverse,api.get_bundle()):raise ValueError('RECOVERY_NOT_VERIFIED')
                print(json.dumps({'stage':'receiver_adapter_reverted','unrelated_modules_preserved':True}))
        raise ValueError('INSTALL_NOT_VERIFIED') from None
if __name__=='__main__':
    try:main()
    except Exception as e:
        allowed={'EXISTING_PILOT_BRANCH_REQUIRED','FREE_ONLY_REQUIRED','INSTALL_AUTHORIZATION_REQUIRED','INSTALL_NOT_REENTRANT','BUNDLE_LAYOUT_CHANGED','ADAPTER_ALREADY_PRESENT','RUNTIME_CHANGED_BEFORE_PUT','POST_INSTALL_MISMATCH','INSTALL_NOT_VERIFIED','RECOVERY_NOT_VERIFIED','RECOVERY_OWNED_MODULE_CHANGED','WORKER_BASE_CHANGED','RECEIVER_BASE_CHANGED','PATCH_ANCHOR_MISMATCH'}
        print('::error::'+(str(e) if str(e) in allowed else 'RECEIVER_INSTALL_FAILED'));raise SystemExit(1)
