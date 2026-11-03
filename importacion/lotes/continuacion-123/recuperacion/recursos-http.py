import urllib.request,ssl,json,hashlib,time
from pathlib import Path
from datetime import datetime,timezone
W=Path('work/produccion123');R=Path('reportes/continuacion-123');res=json.load(open(W/'recursos.json'));deadline=time.monotonic()+2400;ctx=ssl.create_default_context()
while time.monotonic()<deadline:
 try:
  out=[]
  for s,d in res.items():
   for v in d['proceso']['versiones'].values():
    with urllib.request.urlopen('https://conectatech-ec.github.io'+v['url'],context=ctx,timeout=35)as response:
     payload=response.read();assert response.status==200 and hashlib.sha256(payload).hexdigest()==v['sha256']and'image/webp'in response.headers['Content-Type'];out.append({'sku':s,'url':'https://conectatech-ec.github.io'+v['url'],'http':200,'sha256':v['sha256'],'bytes':len(payload),'estado':'VERIFICADO'})
  assert len(out)==12;(R/'recursos-http.json').write_text(json.dumps({'fecha':datetime.now(timezone.utc).isoformat(),'verificados':12,'resultados':out},ensure_ascii=False,indent=2)+'\n');print('CHIP001–004:12WebP públicos200,MIMEySHAcoincidentes.',flush=True);break
 except (OSError,AssertionError,KeyError):print('Esperando doce recursos del siguiente lote',flush=True);time.sleep(30)
else:raise SystemExit('Recursos pendientes;no activar lote123.')
