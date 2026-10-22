"""GitHub Actions private workbook processor. Only sanitized outputs may become artifacts."""
import hashlib,json,os,re,sys,tempfile,time,urllib.request,urllib.error,urllib.parse,subprocess,base64,io
from pathlib import Path
from normalizar_593 import normalize,write_bundle,iso,stamp
ROOT=Path(__file__).resolve().parent
BASE='https://conectatech-comercial-piloto.conectatech-ecu.workers.dev'
def request(path,body=None):
 result=subprocess.run(['node',str(ROOT/'central-http.mjs'),path],input=json.dumps(body) if body is not None else '',text=True,capture_output=True,timeout=55)
 try:data=json.loads(result.stdout)
 except Exception:raise RuntimeError('PRIVATE_SOURCE_TRANSPORT') from None
 if result.returncode or data.get('status',0)==0:raise RuntimeError('PRIVATE_SOURCE_TRANSPORT')
 if data['status']>=400:raise urllib.error.HTTPError(BASE+path,data['status'],'PRIVATE_SOURCE_HTTP',{},None)
 response=io.BytesIO(base64.b64decode(data['bytes_b64']));response.headers={'X-Report-Filename':data.get('filename')};return response
def output(ready):
 if os.environ.get('GITHUB_OUTPUT'):
  with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('ready='+str(ready).lower()+'\n')
def main():
 if os.environ.get('GITHUB_REF')!='refs/heads/automatizacion/piloto-cloud-3sku-20261015':raise ValueError('PILOT_BRANCH_REQUIRED')
 try:
  with request('/commercial/status') as r:state=json.load(r)
 except urllib.error.HTTPError as error:
  if error.code==404:output(False);print('Receiver bootstrap pending deployment; no source changed.');return
  raise
 if not state.get('pending'):output(False);print('No pending report; no deployment or source change.');return
 sha=state['file_sha256'];report={'at':iso(stamp()),'source_sha256':sha,'raw_source_public':False,'stock_quantities_public':False,'production_channels_changed':False}
 try:
  with request('/commercial/report?sha256='+sha) as r:raw=r.read(1000001);filename=urllib.parse.unquote(r.headers['X-Report-Filename'])
  if len(raw)>1000000 or hashlib.sha256(raw).hexdigest()!=sha or not re.fullmatch(r'Reporte-Inventario \d{2}-\d{2}-\d{4}\.xlsx',filename):raise ValueError('SOURCE_INTEGRITY')
  prefix='https://raw.githubusercontent.com/conectatech-ec/conectatech-ec.github.io/main/'
  def public(name):
   with urllib.request.urlopen(prefix+name,timeout=30) as r:return r.read(4000000)
  baseline=public('datos-593/inventario-publico.csv').decode('utf-8-sig');published=json.loads(public('exportaciones/catalogo-ventas.json'))
  with request('/commercial/catalog') as r:previous=json.load(r)
  media={p['sku']:p['web']['image_url'] for p in previous['products'] if p.get('web',{}).get('image_url')}
  units=[p['sku'] for p in previous['products'] if p.get('sale_unit')]
  with tempfile.TemporaryDirectory(prefix='private-593-') as folder:
   p=Path(folder)/filename;p.write_bytes(raw);p.chmod(0o600);canonical,validation=normalize(p,baseline,published,media=media,sale_units=units)
  if canonical['source']['generated_at']<previous['source']['generated_at']:raise ValueError('REPORT_OLDER_THAN_LAST_VALID')
  write_bundle(ROOT/'central',canonical,validation)
  c=json.loads((ROOT/'activar-cloud.json').read_text());c['activar']=True;(ROOT/'activar-cloud.json').write_text(json.dumps(c))
  report.update(validated=True,products=len(canonical['products']),blocked=validation['blocked_count']);output(True)
 except Exception as error:
  code=str(error) if re.fullmatch(r'[A-Z0-9_]{1,80}',str(error)) else 'SOURCE_VALIDATION_FAILED';report.update(validated=False,error_code=code)
  if isinstance(error,ValueError):
   with request('/commercial/complete',{'sha256':sha,'status':'rejected','error_code':code}) as r:r.read()
  else:report['retryable']=True
  output(False)
 (ROOT/'generated/fase2').mkdir(parents=True,exist_ok=True);(ROOT/'generated/fase2/central-processing.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
 if not report.get('validated'):raise SystemExit(1)
if __name__=='__main__':main()
