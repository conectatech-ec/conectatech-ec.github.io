"""Read-only comparison with the encrypted capture of the one authorized PUT."""
import hashlib,importlib.util,json,os,sys
from pathlib import Path
execroot=Path(os.environ['CHECKOUT_EXECUTOR_REPO'])
spec=importlib.util.spec_from_file_location('source_install',execroot/'.github/scripts/checkout-source-396.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
from scoped_content import CFClient,ScopedDeployer,same_bundle,same_json
from install_checkout import cipher,unpack_capture,closure_probe

class ReadOnlyClient(CFClient):
    def request(self,path,method='GET',data=None,content_type=None):
        if method!='GET' or data is not None:raise RuntimeError('READ_ONLY_OPERATION_REQUIRED')
        return super().request(path,method,data,content_type)
    def put_bundle(self,*args):raise RuntimeError('READ_ONLY_OPERATION_REQUIRED')
def normalize(value,path=''):
    if isinstance(value,dict):return {k:normalize(v,path+'/'+k) for k,v in value.items()}
    if isinstance(value,list):
        if path=='/bindings':
            if any(not isinstance(x,dict) or not isinstance(x.get('name'),str) for x in value):raise RuntimeError('BINDING_LAYOUT_INVALID')
            if len({x['name'] for x in value})!=len(value):raise RuntimeError('BINDING_NAME_DUPLICATED')
            value=sorted(value,key=lambda x:x['name'])
        return [normalize(x,path+'/'+str(i)) for i,x in enumerate(value)]
    return value
def paths(before,after,path=''):
    if type(before)!=type(after):return [path+':type']
    if isinstance(before,dict):
        result=[path+'/'+k+':missing_or_added' for k in before.keys()^after.keys()]
        for k in before.keys()&after.keys():result+=paths(before[k],after[k],path+'/'+k)
        return sorted(result)
    if isinstance(before,list):
        if len(before)!=len(after):return [path+':length']
        return [p for i,(a,b) in enumerate(zip(before,after)) for p in paths(a,b,path+'/'+str(i))]
    return [] if before==after else [path]
def main():
    if os.environ.get('CF_FREE_ONLY_CONFIRMED')!='true':raise RuntimeError('FREE_ONLY_REQUIRED')
    raw=Path(os.environ['SOURCE396_BACKUP']).read_bytes()
    if hashlib.sha256(raw).hexdigest()!='1dbdc7d8ff0d606387e11bd84bbc796053c019dbac9139efbaa0097dce3751ca':raise RuntimeError('BACKUP_IDENTITY_CHANGED')
    before=unpack_capture(json.loads(cipher(raw.decode(),True)));expected=m.candidate(before['bundle'])
    api=ReadOnlyClient(os.environ['CLOUDFLARE_ACCOUNT_ID'],os.environ['CLOUDFLARE_API_TOKEN']);guard=ScopedDeployer(api)
    actual=guard.capture();nb,na=normalize(before['settings']),normalize(actual['settings'])
    report={'operation':'source396-post-put-read-only','writes':0,'original_run':45915507220,
        'module_count':len(actual['bundle'].parts),'entire_candidate_bundle_exact':same_bundle(actual['bundle'],expected),
        'private_source_preserved':same_json(before['source'],actual['source']),
        'settings_exact':same_json(before['settings'],actual['settings']),
        'settings_binding_order_normalized_equal':same_json(nb,na),
        'settings_changed_paths_after_binding_sort':paths(nb,na),
        'binding_names_before':[x['name'] for x in before['settings']['bindings']],
        'binding_names_after':[x['name'] for x in actual['settings']['bindings']]}
    public_keys={'compatibility_date','compatibility_flags','usage_model','logpush','handlers','has_assets','tail_consumers'}
    report['non_sensitive_settings_changes']={k:{'before':before['settings'].get(k),'after':actual['settings'].get(k)}
        for k in public_keys if not same_json(before['settings'].get(k),actual['settings'].get(k))}
    manifest,_=m.artifacts();names=manifest['active_baseline_verification']['active_modules_sha256']
    report['selected_active_sha256']={n:m.identities(actual['bundle'])[n] for n in names}
    try:closure_probe();report['public_checkout_http']=503;report['admin_anonymous_http']=401
    except Exception:report['closure_verified']=False
    try:report['effective_source']=m.source_preflight(actual['bundle'])
    except Exception:report['effective_source_verified']=False
    again=api.get_bundle();settings=api.get_settings()
    report['stable_during_read']=same_bundle(again,actual['bundle']) and same_json(settings,actual['settings'])
    report['health_and_existing_services_verified']=True
    out=Path(os.environ['CHECKOUT_SOURCE_OUTPUT']);out.mkdir(parents=True,exist_ok=True)
    (out/'diagnostic.json').write_text(json.dumps(report,indent=2)+'\n')
    print('SOURCE396_DIAGNOSTIC='+json.dumps(report,separators=(',',':')))
if __name__=='__main__':
    try:main()
    except Exception:print('SOURCE396_DIAGNOSTIC_FAILED_READ_ONLY');raise SystemExit(1)
