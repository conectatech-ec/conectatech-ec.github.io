import json,urllib.request,time,sys
from pathlib import Path
phase,sha=sys.argv[1:];last=None;deadline=time.monotonic()+2400
base='https://api.github.com/repos/conectatech-ec/conectatech-ec.github.io'
while time.monotonic()<deadline:
 with urllib.request.urlopen(base+'/actions/runs?head_sha='+sha+'&per_page=50',timeout=30)as r:d=json.load(r)
 runs=[x for x in d['workflow_runs']if x['name']=='Validar lote antes de publicar'and x['event']=='push']
 if runs:
  x=max(runs,key=lambda x:x['id']);status=(x['id'],x['status'],x['conclusion'])
  if status!=last:print(phase,*status,flush=True);last=status
  if x['status']=='completed':
   report={'id':x['id'],'estado':x['status'],'resultado':x['conclusion'],'head':x['head_sha'],'url':x['html_url']};Path('work/produccion125/ci-'+phase+'.json').write_text(json.dumps(report,indent=2)+'\n');assert report['head']==sha and report['resultado']=='success',report;break
 time.sleep(25)
else:raise SystemExit('CI sigue pendiente; no publicar sin SUCCESS.')
