import urllib.request,json,re,time,hashlib
from pathlib import Path
from datetime import datetime,timezone
W=Path('work/produccion122');E=['AUDI130'];expected=json.loads(Path('assets/catalogo-publicado.js').read_text().split('=',1)[1].strip().rstrip(';'))['productos'];deadline=time.monotonic()+2400
while time.monotonic()<deadline:
 try:
  with urllib.request.urlopen('https://conectatech-ec.github.io/',timeout=35)as response:root=response.read();assert response.status==200
  asset=re.search(rb'<script[^>]+src="(/assets/catalogo-publicado\.js[^\"]*)"',root)[1].decode();url='https://conectatech-ec.github.io'+asset
  with urllib.request.urlopen(url,timeout=35)as response:payload=response.read();assert response.status==200
  data=json.loads(payload.decode().split('=',1)[1].strip().rstrip(';'));assert all(data['productos'][s]==expected[s]for s in E)
  (W/'registro-servido.json').write_text(json.dumps({'fecha':datetime.now(timezone.utc).isoformat(),'estado':'UN_REGISTRO_PUBLICOS_VERIFICADOS','asset':url,'sha256':hashlib.sha256(payload).hexdigest(),'skus':E},ensure_ascii=False,indent=2)+'\n');print('Registro público de las una ficha servido con sus fechas e imágenes esperadas.',flush=True);break
 except (OSError,AssertionError,KeyError,IndexError):print('Esperando registro de una ficha en Pages',flush=True);time.sleep(30)
else:raise SystemExit('Registro aún no publicado;no cerrar prioridad.')
