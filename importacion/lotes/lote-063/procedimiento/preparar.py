import json,re,shutil,sys,hashlib,csv,subprocess
from pathlib import Path
from datetime import datetime,timezone
from PIL import Image
ROOT=Path.cwd();LOT=sys.argv[1];skus=sys.argv[2:];D=ROOT/'.produccion-privada/lote-063';L=ROOT/'importacion/lotes'/LOT;L.mkdir(parents=True,exist_ok=True);masters=json.load(open(D/'maestros.json'));newfacts=json.load(open(D/'fichas-nuevas.json')) if (D/'fichas-nuevas.json').exists() else {};p={x['sku']:x for x in json.loads(re.search(r'const products\s*=\s*(\[.*?\]);',(ROOT/'index.html').read_text(),re.S)[1])};q=json.load(open('importacion/cola-drive.json'))['productos'];db=json.load(open('importacion/reglas-sku.json'));policy=db['politica_general']['autenticidad_registro'];sys.path.insert(0,str(ROOT/'scripts'));from reglas_sku import apply_rows
rows=[];facts={};old={};now=datetime.now(timezone.utc).isoformat()
for s in skus:
 es=[r for f in q[s]['fotos'] for r in f.get('registro',[])];kind={r['tipo'] for r in es};auth={policy['valores_tipo'].get(k) for k in kind};assert len(auth)==1 and None not in auth,(s,kind)
 existing=db['productos'].get(s,{});rows.append({'sku':s,'autenticidad':next(iter(auth)),'presentacion':'sin caja','instrucciones':existing.get('instrucciones',''),'evidencia_autenticidad':f"Confirmación comercial del propietario ({policy['fecha_confirmacion']}): {policy['documento_url']} — Registro, columna Tipo, filas {','.join(str(r['fila']) for r in es)}; valores: {', '.join(sorted(kind))}."})
 cf=ROOT/'importacion/contratos'/(s+'.json')
 if cf.exists() and s not in newfacts:
  c=json.loads(subprocess.check_output(['git','show','HEAD:importacion/contratos/'+s+'.json'],text=True));old[s]=c;f={'titulo':p[s]['name'],'marca':c.get('marca'),'modelo':c.get('modelo'),'variante':c['variante'],'descripcion':c['descripcion'],'specs':[[a['nombre'],a['valor']] for a in c['especificaciones'] if a.get('publicar',True)],'compatibilidad':c.get('compatibilidad','Consulta compatibilidad al comprar.'),'contenido':c.get('contenido_venta',c['unidad_venta']['descripcion']),'beneficios':[[b['valor'],b['titulo'],b['descripcion'],b['especificaciones']] for b in c.get('beneficios',[])]}
 else:f=newfacts[s]
 f['categoria']=p[s]['category'];f['categoria_comercial']=json.load(open('importacion/categorias-comerciales.json'))['mapa'][p[s]['category']]['nombre'];f['metodo']='Edición/representación comercial asistida por IA desde todas las fotografías propias del SKU. Acabado de producto nuevo: superficies limpias sin rayas, polvo o desgaste, luz de estudio, fondo blanco y sombra natural. Geometría, colores y hardware cotejados contra vistas propias; no se publican cajas ni se inventan caras ocultas.'
 if s=='MICR08':f['metodo']+=' Corrección solicitada: cuello de cisne erguido, conservando base, cápsula, textura y salida de cable.'
 if s in ('FLAS009','FLAS038'):f['metodo']+=' Sustituye imagen objetada expresamente por el propietario; acabado impecable y composición más comercial.'
 facts[s]=f;dest=L/'editorial-imagenes'/(s+'.png');dest.parent.mkdir(exist_ok=True);shutil.copy2(masters[s],dest)
apply_rows(rows,True)
(L/'fichas-verificadas.json').write_text(json.dumps(facts,ensure_ascii=False,indent=2)+'\n')
src=(ROOT/'scripts/preparar-lote-054.py').read_text().replace('ROOT = Path(__file__).resolve().parents[1]','ROOT = Path.cwd()').replace('lote-054',LOT).replace("f'{sku}.webp'","f'{sku}.png'").replace('original-{digest[:16]}.webp','original-{digest[:16]}.png').replace(f'.produccion-privada/{LOT}/fuentes','.produccion-privada/lote-063/fuentes').replace("'categoria_original':'Adaptadores','categoria_comercial':'Cables y Conectividad'","'categoria_original':fact['categoria'],'categoria_comercial':fact['categoria_comercial']").replace("method='Edición asistida","method_unused='Edición asistida").replace(' contract={'," method=fact['metodo']\n contract={")
exec(compile(src,'preparador-reutilizado','exec'),{'__name__':'preparador_reutilizado'})
# Preservar contenido comercial aprobado y metadatos técnicos anteriores en correcciones fotográficas.
for s,c in old.items():
 path=ROOT/'importacion/contratos'/(s+'.json');new=json.loads(path.read_text())
 for key in ('descripcion','especificaciones','compatibilidad','contenido_venta','garantia','beneficios','unidad_venta'):
  if key in c:new[key]=c[key]
 new['validaciones']['identidad']=c['validaciones']['identidad'];new['validaciones']['identidad']['fuentes']=[f['url'] for f in q[s]['fotos']];new['validaciones']['ficha']=c['validaciones']['ficha'];path.write_text(json.dumps(new,ensure_ascii=False,indent=2)+'\n')
m=json.load(open(L/'manifiesto-aprobados.json'));mapping=json.load(open('importacion/categorias-comerciales.json'))['mapa'];m['categorias_comerciales']={p[s]['category']:{**mapping[p[s]['category']],'fuente':'importacion/categorias-comerciales.json'} for s in skus};(L/'manifiesto-aprobados.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');previous=json.load(open('importacion/lotes/lote-062/manifiesto-qa.json'))['skus'];(L/'manifiesto-qa.json').write_text(json.dumps({'skus':list(dict.fromkeys(skus+previous))},indent=2)+'\n');Path('importacion/lote-activo.json').write_text(json.dumps({'version':1,'lote':LOT,'rama':'catalogo/'+LOT.replace('-',''),'estado':'APROBADO_LOCAL','manifiesto':str((L/'manifiesto-aprobados.json').relative_to(ROOT)),'skus':skus,'qa_manifiesto':str((L/'manifiesto-qa.json').relative_to(ROOT)),'qa_base_publica':None},indent=2)+'\n')
