import urllib.request,ssl,json,hashlib,re,time
from pathlib import Path
from datetime import datetime,timezone
W=Path('work/produccion123');E=['CHIP001','CHIP002','CHIP003','CHIP004'];pages=json.loads(Path('seo-pages.json').read_text());ps=json.loads(re.search(r'const products=(\[[\s\S]*?\]);\s*\n',Path('index.html').read_text())[1]);by={p['sku']:p for p in ps};sha=lambda b:hashlib.sha256(b).hexdigest();expected={s:sha(Path('productos',pages[s],'index.html').read_bytes())for s in E};deadline=time.monotonic()+2400;ctx=ssl.create_default_context()
while time.monotonic()<deadline:
 try:
  rows=[]
  for s in E:
   url='https://conectatech-ec.github.io/productos/'+pages[s]+'/'
   with urllib.request.urlopen(urllib.request.Request(url,headers={'Cache-Control':'no-cache'}),context=ctx,timeout=35)as response:data=response.read();assert response.status==200 and sha(data)==expected[s],s
   rows.append({'sku':s,'url':url,'http':200,'sha256':sha(data)})
  with urllib.request.urlopen('https://conectatech-ec.github.io/',context=ctx,timeout=35)as response:root=response.read();assert response.status==200
  current=json.loads(re.search(rb'const products=(\[[\s\S]*?\]);\s*\n',root)[1]);current={p['sku']:p for p in current};assert all(current[s]['imageUrl']==by[s]['imageUrl']for s in E)
  (W/'activacion-servida.json').write_text(json.dumps({'fecha':datetime.now(timezone.utc).isoformat(),'estado':'CUATRO_FICHAS_Y_CATALOGO_SERVIDOS','root_sha256':sha(root),'resultados':rows},ensure_ascii=False,indent=2)+'\n');print('Cuatro fichas y sus portadas ya están servidas con bytes esperados.',flush=True);break
 except (OSError,AssertionError,KeyError)as error:
  (W/'espera-activacion-ultimo.json').write_text(json.dumps({'fecha':datetime.now(timezone.utc).isoformat(),'estado':'DESPLIEGUE_AUN_NO_COMPLETO','detalle':str(error)}));print('Esperando las cuatro fichas en Pages',flush=True);time.sleep(30)
else:raise SystemExit('Publicación pendiente; no registrar fechas.')
