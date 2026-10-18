#!/usr/bin/env python3
"""Read only our public catalog/images; no Meta scraping, credentials or write calls."""
import concurrent.futures,datetime as dt,hashlib,json,re,urllib.request
from decimal import Decimal
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def get(url):
 if not url.startswith('https://conectatech-ec.github.io/'):raise ValueError('Destino no autorizado')
 with urllib.request.urlopen(url,timeout=30) as r:
  if not r.url.startswith('https://conectatech-ec.github.io/'):raise ValueError('Redirección no autorizada')
  return r.status,r.read()
def verify(item):
 result={'sku':item['sku'],'image_status':None,'product_status':None,'image_hash_matches':False,'price_matches':False,'errors':[]}
 try:
  status,data=get(item['image_url']);result['image_status']=status;result['image_hash_matches']=hashlib.sha256(data).hexdigest()==item['source']['image_sha256']
  if not result['image_hash_matches']:result['errors'].append('Imagen pública diferente de la imagen aprobada del lote: revisar cambio concurrente')
 except Exception as e:result['errors'].append('Imagen: '+str(e))
 try:
  status,data=get(item['product_url']);result['product_status']=status
  for raw in re.findall(r'<script[^>]*type=[\"\x27]application/ld\+json[\"\x27][^>]*>(.*?)</script>',data.decode(),re.S):
   obj=json.loads(raw)
   if isinstance(obj,dict) and obj.get('@type')=='Product':
    offers=obj.get('offers',{});result['public_price']=str(offers.get('price'));result['price_matches']=Decimal(str(offers.get('price')))==Decimal(item['price'])
  if not result['price_matches']:result['errors'].append('Precio de ficha pública distinto/no verificado: no sincronizar hasta resolver')
 except Exception as e:result['errors'].append('Ficha: '+str(e))
 result['ready_for_feed_review']=result['image_hash_matches'] and result['price_matches'];return result
if __name__=='__main__':
 manifest=json.loads((ROOT/'paquete/lote.json').read_text())
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(verify,manifest['items']))
 report={'checked_at':dt.datetime.now(dt.timezone.utc).isoformat(),'method':'HTTP público solo CONECTATECH; GET de imágenes y JSON-LD de fichas','checked':len(results),'passed':sum(r['ready_for_feed_review'] for r in results),'results':results}
 (ROOT/'data/verificacion-publica.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 # Produce a separate feed for review, removing only rows whose own landing evidence failed.
 import csv
 candidate=ROOT/'paquete/meta-catalogo-candidato.csv';ready={r['sku'] for r in results if r['ready_for_feed_review']}
 with candidate.open() as f:r=csv.DictReader(f);fields=r.fieldnames;rows=[row for row in r if row['id'] in ready]
 with (ROOT/'paquete/meta-catalogo-revisado-http.csv').open('w',newline='') as f:w=csv.DictWriter(f,fields);w.writeheader();w.writerows(rows)
 print(json.dumps({'checked':report['checked'],'passed':report['passed'],'feed_review_rows':len(rows)}))
