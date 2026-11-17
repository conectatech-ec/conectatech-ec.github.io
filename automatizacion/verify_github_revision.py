"""Read only GitHub's actual current ref; no Worker credentials or provider calls."""
import json,os,subprocess
from pathlib import Path
from github_revision_read import RevisionOpener,RevisionReadError,read_revision,read_authenticated_revision

ROOT=Path(__file__).resolve().parent
CONTROL=ROOT.parent/'.github/checkout-revision-read.json'
OUTPUT=ROOT/'generated/fase2/github-revision-read.json'

def fail(code):raise RevisionReadError(code)
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT.parent,stderr=subprocess.DEVNULL).decode().strip()

def permission():
    c=json.loads(CONTROL.read_bytes());old=json.loads((ROOT.parent/'.github/checkout-install-once.json').read_bytes())
    if (c.get('enabled') is not True or c.get('operation')!='github-current-revision-read-only' or c.get('cost_max_usd')!=0 or
        old.get('enabled') is not False or old.get('closed_after_run')!='44146619274' or
        os.environ.get('GITHUB_REF')!='refs/heads/automatizacion/piloto-cloud-3sku-20261015' or
        os.environ.get('GITHUB_EVENT_NAME')!='push' or os.environ.get('GITHUB_RUN_ATTEMPT')!='1' or
        git('rev-parse','HEAD')!=os.environ.get('GITHUB_SHA') or git('rev-parse','HEAD^')!=c.get('authorized_parent') or
        git('diff-tree','--no-commit-id','--name-only','-r','HEAD').splitlines()!=['.github/checkout-revision-read.json']):
        fail('GITHUB_REVISION_READ_SCOPE_REQUIRED')

def main():
    permission()
    # One controlled reproduction of the former anonymous transport. It cannot
    # become a fallback: success below requires the authenticated validator.
    anonymous=RevisionOpener(anonymous_probe=True)
    try:
        read_revision(anonymous);anonymous_result={'status':'ok',**anonymous.diagnostics}
    except RevisionReadError as error:anonymous_result={'status':'failed','error':error.code,**anonymous.diagnostics}
    first={};actual=read_authenticated_revision(diagnostics=first)
    expected=os.environ['GITHUB_SHA']
    if actual!=expected:fail('GITHUB_REVISION_NOT_CURRENT')
    second={};verified=read_authenticated_revision(diagnostics=second)
    if verified!=actual:fail('GITHUB_REVISION_CHANGED_DURING_READ')
    from install_checkout import approved_artifacts,ACTIVE_DELTA_SHA
    approved_artifacts()
    return {'schema':'conectatech.github-revision-read.v1','status':'AUTHENTICATED_REMOTE_REVISION_VERIFIED',
        'run_id':os.environ.get('GITHUB_RUN_ID'),'execution_commit':expected,'remote_sha':verified,
        'sha_matches_execution':True,'strict_original_validator':True,'anonymous_probe':anonymous_result,
        'authenticated_reads':[first,second],'github_permissions':'contents:read','worker_requests':0,'worker_puts':0,
        'installation_permission_enabled':False,'checkout_delta_sha256':ACTIVE_DELTA_SHA,
        'activar':False,'datahub_scoped_content_enabled':False,'cost_additional_usd':0}

if __name__=='__main__':
    try:result=main()
    except Exception as error:
        result={'status':'BLOCKED','error':error.code if isinstance(error,RevisionReadError) else 'GITHUB_REVISION_CHECK_FAILED',
            'worker_requests':0,'worker_puts':0}
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,separators=(',',':')))
    if result['status']=='BLOCKED':raise SystemExit(1)
