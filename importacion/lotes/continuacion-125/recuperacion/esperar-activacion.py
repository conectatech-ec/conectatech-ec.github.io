import urllib.request,json,time,hashlib
from pathlib import Path
from datetime import datetime,timezone
W=Path('work/produccion125');sku='TECL028';slug=json.loads(Path('seo-pages.json').read_text())[sku];file=Path('productos')/slug/'index.html';expected=hashlib.sha256(file.read_bytes()).hexdigest();url='https://conectatech-ec.github.io/productos/'+slug+'/';deadline=time.monotonic()+2400
while time.monotonic()<deadline:
 try:
  with urllib.request.urlopen(url,timeout=35)as r:data=r.read();assert r.status==200
  assert hashlib.sha256(data).hexdigest()==expected
  (W/'activacion-servida.json').write_text(json.dumps({'fecha':datetime.now(timezone.utc).isoformat(),'url':url,'sha256':expected,'estado':'HTML_ESPERADO_SERVIDO'},indent=2)+'\n');print('TECL028:HTML esperado público.',flush=True);break
 except(OSError,AssertionError):print('Esperando HTML deTECL028',flush=True);time.sleep(30)
else:raise SystemExit('HTML todavía no coincide;no registrar ni cerrar.')
