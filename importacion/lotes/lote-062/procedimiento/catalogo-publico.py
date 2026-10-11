import json,hashlib,re,urllib.request
from datetime import datetime,timezone
from pathlib import Path
base='https://conectatech-ec.github.io';result={'fecha':datetime.now(timezone.utc).isoformat(),'recursos':[]}
contents={}
for f in ('index.html','assets/catalogo-publicado.js'):
 url=base+'/' if f=='index.html' else base+'/'+f
 req=urllib.request.Request(url,headers={'Cache-Control':'no-cache','User-Agent':'CONECTATECH-QA/1.0'})
 with urllib.request.urlopen(req,timeout=30) as r:data=r.read();status=r.status
 assert data==Path(f).read_bytes(),f
 contents[f]=data.decode();result['recursos'].append({'archivo':f,'url':url,'http':status,'sha256':hashlib.sha256(data).hexdigest(),'identico_local':True})
p=json.loads(re.search(r'const products\s*=\s*(\[.*?\]);',contents['index.html'],re.S)[1]);meta=json.loads(contents['assets/catalogo-publicado.js'].split('=',1)[1].rstrip(';\n'))['productos']
items=[x for x in p if x['stock']>0]
items.sort(key=lambda x:(bool(x.get('imageUrl') or meta.get(x['sku'],{}).get('imagen',{}).get('src')),meta.get(x['sku'],{}).get('actualizadoEn','')),reverse=True)
new=json.load(open('importacion/lotes/lote-062/manifiesto-consolidado.json'))['skus']
assert set(x['sku'] for x in items[:len(new)])==set(new),[x['sku'] for x in items[:len(new)]]
result['primeros_sku_actualizados']=[x['sku'] for x in items[:len(new)]];result['actualizados_primero']=True;result['alcance']='Comparación de bytes públicos y orden predeterminado; pruebas de navegador público se registran mediante GitHub Actions.'
Path('reportes/lote-062/catalogo-publico.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('Catálogo público idéntico: los 66 SKU actualizados aparecen primero.')
