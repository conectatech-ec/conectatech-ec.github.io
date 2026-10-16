"""Temporary tail of this Worker only; never persist tail URLs or raw logs."""
import os,re,subprocess
from deploy_free import API,SCRIPT,BRANCH
if os.environ.get('GITHUB_REF')!=BRANCH:raise SystemExit('Pilot branch required')
api=API(os.environ['CLOUDFLARE_ACCOUNT_ID'],os.environ['CLOUDFLARE_API_TOKEN'])
tail=None
try:
    try:tail=api.call(SCRIPT+'/tails','POST',{})
    except RuntimeError:print('Live tail unavailable with existing token; no permission expansion requested')
    env=dict(os.environ)
    if isinstance(tail,dict) and isinstance(tail.get('url'),str) and tail['url'].startswith('wss://'):env['CF_WORKER_TAIL_URL']=tail['url']
    result=subprocess.run(['node','automatizacion/tail-proof.mjs'],env=env)
finally:
    if isinstance(tail,dict) and re.fullmatch(r'[a-f0-9]{32}',tail.get('id','')):
        try:api.call(SCRIPT+'/tails/'+tail['id'],'DELETE')
        except RuntimeError:print('Temporary tail cleanup not confirmed; session remains subject to provider expiration')
raise SystemExit(result.returncode)
