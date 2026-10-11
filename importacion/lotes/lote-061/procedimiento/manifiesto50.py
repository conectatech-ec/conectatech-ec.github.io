import json
from pathlib import Path
L=Path('importacion/lotes/lote-061');m={'version':3,'lote':'lote-059-061-consolidado','cantidad_seleccionada':50,'skus':[],'imagenes':{},'aprobaciones':{},'contratos':{},'categorias_comerciales':{}}
for lot in ('059','060','061'):
 x=json.load(open('importacion/lotes/lote-'+lot+'/manifiesto-aprobados.json'))
 for sku in x['skus']:
  if sku not in m['skus']:m['skus'].append(sku)
 for key in ('imagenes','aprobaciones','contratos','categorias_comerciales'):m[key].update(x[key])
assert len(m['skus'])==50
(L/'manifiesto-50.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');q=json.load(open('importacion/lotes/lote-060/manifiesto-qa.json'));q['skus']=list(dict.fromkeys(m['skus']+q['skus']));(L/'manifiesto-qa.json').write_text(json.dumps(q,indent=2)+'\n');Path('.produccion-privada/lote-059/skus50.txt').write_text('\n'.join(m['skus'])+'\n')
print({'sku_actualizados_unicos':len(m['skus']),'sku_qa_regresion':len(q['skus'])})
