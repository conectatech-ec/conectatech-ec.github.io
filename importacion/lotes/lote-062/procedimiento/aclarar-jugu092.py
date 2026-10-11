import csv,json,hashlib
from pathlib import Path
from PIL import Image
s='JUGU092';p=Path('importacion/contratos')/(s+'.json');c=json.load(open(p))
note=' La imagen corresponde a la variante verde con techo cerrado. Hay referencias de otras variantes sin techo registradas como AAA/genéricas; confirma la presentación, el color y la clasificación de la unidad disponible antes de comprar.'
assert note not in c['descripcion'];c['descripcion']+=note;q=json.load(open('importacion/cola-drive.json'))['productos'][s];seen={x['drive_id'] for x in c['fotografias_fuente']}
for f in q['fotos']:
 if f['id'] in seen:continue
 source=Path('.produccion-privada/lote-062/fuentes')/s/f['nombre'];im=Image.open(source)
 c['fotografias_fuente'].append({'nombre':f['nombre'],'drive_id':f['id'],'url':f['url'],'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'filas_registro':f.get('registro',[]),'uso':'Referencia adicional de variantes sin techo; no publicada como fotografía comercial, clasificación por variante pendiente.','original_intacto':True,'resolucion':list(im.size)})
c['fuentes_tecnicas']=list(dict.fromkeys(c['fuentes_tecnicas']+[f['url'] for f in q['fotos']]))
c['validaciones']['ficha']['evidencia']=c['validaciones']['ficha'].get('evidencia','')+' Aclaración editorial de la variante de portada frente a cuatro referencias adicionales registradas AAA/genéricas, sin afirmar la disponibilidad o clasificación de todas las unidades.'
c['validaciones']['identidad']['alcance_revision']='La portada identifica la variante verde con techo cerrado. Las cuatro fotografías adicionales se analizaron para declarar la existencia de variantes; su autenticidad por variante sigue pendiente, sin publicación comercial de esas imágenes.'
c['estado_publicacion']='APROBADO_LOCAL';p.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n')
seo_path=Path('seo-contenido.json');seo=json.load(open(seo_path));seo[s]['descripcion']=c['descripcion'];seo_path.write_text(json.dumps(seo,ensure_ascii=False,indent=2)+'\n')
L=Path('importacion/lotes/lote-062');m=json.load(open(L/'manifiesto-correcciones.json'));mini={**m,'skus':[s],'cantidad_seleccionada':1}
for k in ['imagenes','aprobaciones','contratos']:mini[k]={s:m[k][s]}
(L/'manifiesto-jugu092.json').write_text(json.dumps(mini,ensure_ascii=False,indent=2)+'\n');(L/'manifiesto-qa-jugu092.json').write_text(json.dumps({'skus':[s,'TELF024','TELF023','PARL042','REL046','REL050']},indent=2)+'\n')
with (L/'editorial.csv').open(encoding='utf-8-sig',newline='') as f:reader=csv.DictReader(f);fields=reader.fieldnames;rows=list(reader)
for r in rows:
 if r['sku']==s:r['descripcion']=c['descripcion']
with (L/'editorial.csv').open('w',encoding='utf-8-sig',newline='') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
print('JUGU092: aclaración respaldada por seis fotografías. Imagen y datos financieros intactos.')
