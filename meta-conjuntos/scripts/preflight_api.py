#!/usr/bin/env python3
"""Optional authenticated GET-only probe. No tokens printed, written, or placed in URLs."""
import argparse,datetime as dt,json,os,re,urllib.parse,urllib.request,urllib.error
from pathlib import Path
CATALOG='1036301566100990'
def probe(token,version):
 report={'catalog_id':CATALOG,'checked_at':dt.datetime.now(dt.timezone.utc).isoformat(),'write_tested':False,'write_authorized':False,'campaigns_activated':False}
 if not token: return {**report,'status':'NO_CREDENTIALS_CONFIGURED','sets':None}
 if not re.fullmatch(r'v\d+\.\d+',version or ''):raise ValueError('Configurar META_GRAPH_VERSION con versión admitida por la app; no adivinarla')
 def get(path,params):
  request=urllib.request.Request('https://graph.facebook.com/'+version+'/'+path+'?'+urllib.parse.urlencode(params),headers={'Authorization':'Bearer '+token,'Accept':'application/json'},method='GET')
  try:
   with urllib.request.urlopen(request,timeout=30) as response:return json.loads(response.read())
  except urllib.error.HTTPError as e:
   # Provider error messages can contain account identifiers; retain only status, not payload.
   raise RuntimeError('Graph API HTTP '+str(e.code)) from None
 try:
  catalog=get(CATALOG,{'fields':'id,name,product_count'});report['read_access']=str(catalog.get('id'))==CATALOG;report['observed_product_count']=catalog.get('product_count')
  permissions=get('me/permissions',{});report['catalog_management_granted']=any(p.get('permission')=='catalog_management' and p.get('status')=='granted' for p in permissions.get('data',[]))
  sets=[];after=None;seen=set()
  for _ in range(100):
   params={'fields':'id,name,filter,product_count','limit':'100'}
   if after:params['after']=after
   page=get(CATALOG+'/product_sets',params);sets.extend(page.get('data',[]));paging=page.get('paging',{})
   if not paging.get('next'):break
   after=paging.get('cursors',{}).get('after')
   if not after or after in seen:raise RuntimeError('Paginación incompleta o repetida: no elaborar plan de creación')
   seen.add(after)
  else:raise RuntimeError('Límite de paginación: no asumir inventario completo de conjuntos')
  report.update({'status':'READ_VERIFIED_WRITE_NOT_TESTED','sets':sets,'note':'Leer catálogo y catalog_management no demuestra por sí solo tareas de administración del activo ni aprobación para escribir.'});return report
 except RuntimeError as e:return {**report,'status':'UNVERIFIED','error':str(e),'sets':None}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True,help='Ruta privada, no repositorio público');a=p.parse_args();report=probe(os.environ.get('META_CATALOG_ACCESS_TOKEN'),os.environ.get('META_GRAPH_VERSION'));a.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');a.output.chmod(0o600);print(json.dumps({k:v for k,v in report.items() if k not in ['sets']},ensure_ascii=False))
