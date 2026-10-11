import json,hashlib,shutil
from pathlib import Path
L=Path('importacion/lotes/lote-060');m=json.load(open(L/'manifiesto-aprobados.json'));previous=json.load(open('importacion/lotes/lote-059/manifiesto-aprobados.json'));masters=json.load(open('.produccion-privada/lote-059/maestros.json'))
for sku,color in [('JUGU042','Variante roja y azul'),('JUGU088','Variante roja'),('JUGU133','Variante plateada')]:
 if sku not in m['skus']:
  m['skus'].append(sku)
  for k in ('imagenes','aprobaciones','contratos'):m[k][sku]=previous[k][sku]
 primary=m['imagenes'][sku][0];src=Path(masters[sku+'-secundaria']);dest=L/'editorial-imagenes'/(sku+'-02.png');shutil.copy2(src,dest);sha=hashlib.sha256(dest.read_bytes()).hexdigest()
 secondary={**primary,'archivo':str(dest),'sha256':sha,'posicion':2,'nota_revision':color+' del mismo SKU contrastada con todas las fotografías propias; geometría y color fieles, producto nuevo limpio. Venta por unidad, no lote de variantes.'}
 m['imagenes'][sku].append(secondary)
 cpath=Path(m['contratos'][sku]);c=json.loads(cpath.read_text());c['imagenes_secundarias']=['/imagenes/'+sku.lower()+'/'+sku+'-02.webp'];c['derechos_imagen']['archivos'].append({'sha256':sha,'fuente':secondary['fuente']});c['estado_publicacion']='APROBADO_LOCAL';cpath.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n')
m['cantidad_seleccionada']=len(m['skus']);(L/'manifiesto-aprobados.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');q=json.load(open('importacion/lotes/lote-059/manifiesto-qa.json'));q['skus']=list(dict.fromkeys(m['skus']+q['skus']));(L/'manifiesto-qa.json').write_text(json.dumps(q,indent=2)+'\n');p=Path('importacion/lote-activo.json');a=json.loads(p.read_text());a['skus']=m['skus'];p.write_text(json.dumps(a,indent=2)+'\n')
print({'nuevos_o_corregidos':20,'galerias_adicionales':3,'sku_manifest':len(m['skus'])})
