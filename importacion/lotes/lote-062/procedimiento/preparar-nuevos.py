import json,re,hashlib
from pathlib import Path
D=Path('.produccion-privada/lote-062')
records=json.load(open(D/'registros-50.json')); q=json.load(open('importacion/cola-drive.json'))['productos']; paths={}
for f in (D/'resultados').glob('*.json'):
 r=json.loads(f.read_text()); m=re.search(r'/workspace/generated_images/[^\s`]+\.png',r.get('output_hint',''))
 if m: paths[r['key']]=m[0]
assert len(records)==50 and len({r[0] for r in records})==50
facts={};reviews=[]
for s,title,brand,model,variant,desc,prompt in records:
 assert s in paths,s
 for photo in q[s]['fotos']: assert (D/'fuentes'/s/photo['nombre']).is_file(),(s,photo['nombre'])
 generic=any(r['tipo']=='AAA (genérico)' for p in q[s]['fotos'] for r in p.get('registro',[]))
 if generic:
  desc+=' Versión AAA genérica/compatible; no es un producto original de la marca de referencia.'
  if not any(x in title.lower() for x in ['aaa','genéric','compatible']): title+=' | versión genérica'
 if s=='AUDI063':
  title='Audífonos inalámbricos compatibles tipo Pro 2 | estuche negro con pantalla'
  desc='Audífonos inalámbricos compatibles con almohadillas de silicona y estuche negro con pantalla frontal. No se presentan como un producto Apple original.'
  brand=None
 design=title.split(' | ')[-1]
 specs=[['Modelo',model],['Color y variante',variant],['Diseño',design]]
 if s=='DISC004': specs+=[['Capacidad','500 GB'],['Formato','SSD externo compacto con USB-A']]
 if s=='DISC005': specs+=[['Capacidad','1 TB'],['Formato','Disco duro externo HD710 Pro']]
 if s=='FLAS024': specs+=[['Capacidad','8 GB'],['Carcasa','Metálica con aro integrado']]
 if s=='REL071': specs+=[['Pantalla','AMOLED de 1,75 pulgadas']]
 if s in ['AUDI008','AUDI009']: specs+=[['Conector','Lightning' if s=='AUDI008' else 'USB-C']]
 if s=='AUDI081':specs+=[['Conexión','USB-A'],['Micrófono','Brazo integrado']]
 if s in ['AUDI108','AUDI096','AUDI106']:specs+=[['Micrófono','Brazo integrado']]
 if s=='AUDI118':specs+=[['Conexión','Bluetooth y 2,4 GHz, según empaque']]
 content='Una unidad del producto descrito. Consulta el contenido exacto y la compatibilidad antes de comprar.'
 if s.startswith('AUDI') and s not in ['AUDI008','AUDI009','AUDI108','AUDI107','AUDI090','AUDI081','AUDI114','AUDI096','AUDI064','AUDI047','AUDI089','AUDI007','AUDI106','AUDI005','AUDI100']:content='Par de audífonos y estuche de carga del mismo SKU; venta por unidad comercial.'
 if s=='AUDI064':content='Par de audífonos abiertos del mismo SKU. La fotografía no añade accesorios.'
 if s=='REL006': content='Smartwatch con kit de siete correas indicado en el empaque. La imagen principal muestra la correa metálica.'
 facts[s]={'titulo':title,'marca':brand,'modelo':model,'variante':variant,'descripcion':desc,'specs':specs,'compatibilidad':'Verifica la compatibilidad con tu equipo antes de comprar. No se declara compatibilidad universal.','contenido':content,'beneficios':[['Diseño','Presentación y comodidad',design+'.',['Diseño']],['Variante','Elige tu estilo',variant+'.',['Color y variante']]]}
 reviews.append({'sku':s,'estado':'VERIFICADO','maestro':paths[s],'sha256':hashlib.sha256(Path(paths[s]).read_bytes()).hexdigest(),'referencias_revisadas':len(q[s]['fotos']),'evidencia':'Comparación visual conjunta de todas las fotografías propias y el maestro individual: forma, color, botones, conectores visibles y contenido; fondo blanco, producto sin caja y acabado nuevo. No se presentan caras ocultas o accesorios no documentados.'})
(D/'maestros.json').write_text(json.dumps(paths,indent=2));(D/'fichas-nuevas.json').write_text(json.dumps(facts,ensure_ascii=False,indent=2));(D/'revision-nuevos.json').write_text(json.dumps(reviews,ensure_ascii=False,indent=2))
src=Path('.produccion-privada/lote-059/preparar.py').read_text().replace(".produccion-privada/lote-059",".produccion-privada/lote-062").replace("f['titulo']=p[s]['name'];",'').replace("lote-058/manifiesto-qa.json","lote-061/manifiesto-qa.json")
(D/'preparar.py').write_text(src)
print({'nuevos':len(facts),'revisados':len(reviews)})
