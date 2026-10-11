import csv,hashlib,json,re,shutil
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path.cwd();D=ROOT/'.produccion-privada/lote-062';L=ROOT/'importacion/lotes/lote-062';m=json.load(open(L/'manifiesto-aprobados.json'));paths=json.load(open(D/'maestros.json'));now=datetime.now(timezone.utc).isoformat()
titles={
 'REL046':'Smartwatch Infinix XWATCH H4 | azul o gris con correa deportiva',
 'REL050':'Smartwatch Riversong Motive 10GT | negro o verde, diseño circular',
 'JUGU092':'Miniatura estilo Jeep Wrangler | camuflaje verde y techo cerrado',
 'JUGU081':'Miniatura Mercedes-Benz Clase C L | sedán rojo de colección',
 'JUGU106':'Moto de colección estilo Kawasaki | motocross verde',
 'JUGU068':'Miniatura Vespa clásica | scooter celeste de colección',
 'JUGU042':'Miniatura Volkswagen Transporter T1 | Combi con tabla de surf',
 'JUGU075':'Camioneta clásica de colección | turquesa con plataforma estilo madera',
 'JUGU104':'Van todoterreno de colección | diseño blanco con parrilla de techo',
 'JUGU088':'Miniatura estilo Dodge Challenger | deportivo rojo o blanco',
 'JUGU133':'SUV todoterreno de colección | negro o plateado con diseño robusto',
 'JUGU134':'Miniatura estilo Dodge Challenger | acabado tornasol y alerón',
 'JUGU095':'Miniatura estilo Toyota FJ Cruiser | todoterreno azul con parrilla',
 'JUGU116':'Miniatura estilo McLaren Senna | deportivo púrpura con alerón',
 'JUGU036':'Miniatura Volkswagen Escarabajo | diseño Gulf azul y naranja número 67'}
photokeys={'FLAS005':['FLAS005'],'JUGU092':['JUGU092-revision2'],'REL046':['REL046-azul','REL046-gris'],'REL050':['REL050-negro','REL050-verde']}
proof={
 'JUGU081':'Emblema Mercedes-Benz y placa C-Cless L legibles en vista frontal; se identifica la representación Clase C L, sin atribuir fabricación/licencia del juguete.',
 'JUGU106':'Inscripción Kawasaki legible en asiento; no se declara KX250F porque el sufijo no queda confirmado.',
 'JUGU068':'Inscripción Vespa y silueta clásica visibles; no se declara cilindrada ni submodelo.',
 'JUGU042':'Emblema VW frontal y carrocería Transporter T1, parabrisas partido y frontal en V.',
 'JUGU088':'Carrocería Dodge Challenger de dos puertas, ópticas y emblema lateral de referencia; ambas variantes propias.',
 'JUGU134':'Misma carrocería Challenger comprobada en vistas laterales y trasera; no se declara motor o licencia.',
 'JUGU095':'Carrocería Toyota FJ Cruiser con tres ventanas laterales características, frontal y techo; representación estilo FJ Cruiser, sin licencia atribuida.',
 'JUGU116':'Carrocería McLaren Senna con grandes tomas laterales, puertas y alerón trasero característicos en tres vistas propias; no es Lamborghini.',
 'JUGU036':'Carrocería Volkswagen Escarabajo comprobada en tres vistas; diseño físico Gulf número 67 visible.',
 'JUGU075':'Se mejora nombre por características visibles; marca y modelo exactos no se declaran.',
 'JUGU104':'Se mejora nombre por características visibles; marca y modelo exactos no se declaran.',
 'JUGU133':'Se mejora nombre por características visibles; marca y modelo exactos no se declaran.',
 'JUGU092':'Corrección de variante verde con techo cerrado respaldada por las dos referencias originales. Se analizaron otras cuatro vistas sin techo, pero no se publican esas variantes por clasificación comercial contradictoria.'}
oldmanifests=[json.load(open(p)) for p in sorted((ROOT/'importacion/lotes').glob('*/manifiesto*.json'),reverse=True) if 'qa' not in p.name and p.parent!=L]
reviews=[]
for s in list(dict.fromkeys(list(photokeys)+list(titles))):
 prev=next(p for p in oldmanifests if s in p.get('imagenes',{}));cp=ROOT/'importacion/contratos'/(s+'.json');c=json.load(open(cp));
 for k in ('imagenes','aprobaciones','contratos'):m[k][s]=prev[k][s]
 m['skus'].append(s)
 if s in titles:c['titulo_comercial']=titles[s]
 if s in photokeys:
  template=m['imagenes'][s][0];entries=[];rights=[]
  for i,key in enumerate(photokeys[s],1):
   source=Path(paths[key]);dest=L/'editorial-imagenes'/f'{s}-{i:02}.png';shutil.copy2(source,dest);digest=hashlib.sha256(source.read_bytes()).hexdigest()
   note='Corrección comercial solicitada: imagen individual, producto grande, acabado nuevo sin desgaste, sin caja, fondo blanco, hardware y color cotejados visualmente con fotografías propias.'
   if s=='JUGU092':note+=' '+proof[s]+' Se rechazó la primera propuesta por alterar espejos y piezas pequeñas; esta edición mantiene la pose y piezas de la fotografía directa.'
   if s=='FLAS005':note+=' Inscripción editorial USB 2.0 / 128 GB a solicitud del propietario para el formato comercial de FLAS004; datos verificados en referencia y ficha, no se presenta como prueba de grabado de fábrica.'
   if s in ('REL046','REL050'):note+=' Cada color ocupa una imagen independiente de la galería, no un montaje; venta por unidad.'
   e={**template,'archivo':str(dest.relative_to(ROOT)),'sha256':digest,'posicion':i,'nota_revision':note};entries.append(e);rights.append({'sha256':digest,'fuente':e['fuente']})
   if i==1:
    deriv={**c['maestro'],'archivo_maestro':f'/imagenes/{s.lower()}/original-{digest[:16]}.png','sha256_maestro':digest,'metodo':note}
    c['maestro']=deriv;c['derechos_imagen']['derivacion']=deriv;c['validaciones']['revision_visual']={'estado':'VERIFICADO','fecha':now,'sha256_maestro':digest,'evidencia':note}
  m['imagenes'][s]=entries;c['derechos_imagen']['archivos']=rights;c['imagenes_secundarias']=[f'/imagenes/{s.lower()}/{s}-{i:02}.webp' for i in range(2,len(entries)+1)]
  if s in ('REL046','REL050'):c['descripcion']=c['descripcion'].replace('La imagen muestra','La galería muestra')
 else:
  assert all(Path(e['archivo']).is_file() and hashlib.sha256(Path(e['archivo']).read_bytes()).hexdigest()==e['sha256'] for e in m['imagenes'][s]),s
  # Solo cambia el título: originales, medios aprobados y revisión de reglas permanecen idénticos.
  c['validaciones']['identidad']['evidencia_titulo']=proof[s]
 c['estado_publicacion']='APROBADO_LOCAL';c['fecha_verificacion']=now;cp.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n')
 reviews.append({'sku':s,'cambio':'imagen y título' if s in photokeys else 'solo título comercial','evidencia':proof.get(s,c['validaciones']['revision_visual']['evidencia'])})
m['cantidad_seleccionada']=len(m['skus']);mapping=json.load(open('importacion/categorias-comerciales.json'))['mapa']
for s in m['skus']:
 c=json.load(open(m['contratos'][s]));cat=c['categoria_original'];m['categorias_comerciales'][cat]={**mapping[cat],'fuente':'importacion/categorias-comerciales.json'}
(L/'manifiesto-aprobados.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
with (L/'editorial.csv').open(encoding='utf-8-sig',newline='') as f:reader=csv.DictReader(f);fields=reader.fieldnames;rows=list(reader)
for s in list(dict.fromkeys(list(photokeys)+list(titles))):
 c=json.load(open(m['contratos'][s]));rows.append({'sku':s,'nombre_comercial':c['titulo_comercial'],'descripcion':c['descripcion'],'caracteristicas_json':json.dumps({e['nombre']:e['valor'] for e in c['especificaciones'] if e.get('publicar',True)},ensure_ascii=False),'fuente':m['contratos'][s],'imagen_principal':f'{s}-01.png','terminos_busqueda':c['titulo_comercial'],'verificado':'SI'})
with (L/'editorial.csv').open('w',encoding='utf-8-sig',newline='') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
(L/'titulos-verificados.json').write_text(json.dumps({'titulos':titles,'evidencias':proof},ensure_ascii=False,indent=2)+'\n');(L/'revision-correcciones.json').write_text(json.dumps(reviews,ensure_ascii=False,indent=2)+'\n')
qa=json.load(open(L/'manifiesto-qa.json'));qa['skus']=list(dict.fromkeys(m['skus']+['TELF024','TELF023','PARL042']+qa['skus']));(L/'manifiesto-qa.json').write_text(json.dumps(qa,indent=2)+'\n')
active=json.load(open('importacion/lote-activo.json'));active['skus']=m['skus'];Path('importacion/lote-activo.json').write_text(json.dumps(active,indent=2)+'\n')
print({'nuevos':50,'correcciones_fotograficas':4,'solo_titulo':len(m['skus'])-54,'total_sku':len(m['skus'])})
