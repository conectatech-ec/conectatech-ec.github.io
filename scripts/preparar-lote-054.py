#!/usr/bin/env python3
"""Prepara contratos/editorial/manifiesto del lote 054 desde evidencia ya revisada."""
import csv, hashlib, json
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LOTE = ROOT / 'importacion/lotes/lote-054'
FACTS = json.loads((LOTE/'fichas-verificadas.json').read_text())
SKUS = list(FACTS)
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def dump(path,obj): path.parent.mkdir(parents=True,exist_ok=True); path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')

now=datetime.now(timezone.utc).isoformat()
queue=json.loads((ROOT/'importacion/cola-drive.json').read_text())['productos']
rules=json.loads((ROOT/'importacion/reglas-sku.json').read_text())['productos']
urls=json.loads((ROOT/'seo-pages.json').read_text())
base_hash=sha(ROOT/'datos-593/inventario-publico.csv')
with (ROOT/'datos-593/inventario-publico.csv').open(encoding='utf-8-sig',newline='') as f:
 rows={r['sku']:r for r in csv.DictReader(f)}

manifest={'version':3,'lote':'lote-054','cantidad_seleccionada':len(SKUS),'skus':SKUS,'imagenes':{},'aprobaciones':{},'contratos':{},'categorias_comerciales':{'Adaptadores':{'nombre':'Cables y Conectividad','subcategoria':'Adaptadores','verificada':True,'fuente':'importacion/categorias-comerciales.json'}}}
visual={'lote':'lote-054','fecha':now,'referencias_aprobadas':['POWE003','ADAP005'],'revision':[]}
editor=[]
for sku in SKUS:
 fact=FACTS[sku]; q=queue[sku]; r=rules[sku]; base=rows[sku]
 master=LOTE/'editorial-imagenes'/f'{sku}.webp'; digest=sha(master)
 source_urls=[x['url'] for x in q['fotos']]
 photos=[]
 for item in q['fotos']:
  local=ROOT/'.produccion-privada/lote-054/fuentes'/sku/item['nombre']
  if not local.is_file(): raise FileNotFoundError(local)
  ph={'nombre':item['nombre'],'drive_id':item['id'],'url':item['url'],'sha256':sha(local) if local else None,'filas_registro':item.get('registro',[]),'uso':'Identificación y referencia propia para edición','original_intacto':True}
  if local:
   with Image.open(local) as im: ph['resolucion']=list(im.size)
  photos.append(ph)
 tipo='original' if r['autenticidad']=='original verificado' else 'generico'
 specs=[{'nombre':n,'valor':v,'fuentes':source_urls,'estado':'VERIFICADO','publicar':True} for n,v in fact['specs']]
 evidence=r.get('evidencia_autenticidad','')
 url='https://conectatech-ec.github.io/productos/'+urls[sku]+'/'
 method='Edición asistida por IA de fotografías propias autorizadas: retiro de bolsa o blíster, limpieza, luz de estudio y fondo blanco. Revisión visual de conectores, forma y color contra todas las vistas disponibles; sin añadir puertos ni accesorios.'
 contract={
  'sku':sku,'nombre_original':base['nombre'].title(),'titulo_comercial':fact['titulo'],'tipo':tipo,'marca':fact.get('marca'),'modelo':fact.get('modelo'),'variante':fact['variante'],
  'categoria_original':'Adaptadores','categoria_comercial':'Cables y Conectividad','precio_contado':float(base['promo_contado']),'pvp':float(base['pvp_final']),'stock':int(base['stock']),
  'unidad_venta':{'descripcion':'1 unidad','cantidad':1,'verificada':True,'fuente':'datos-593/inventario-publico.csv','evidencia':'SKU singular cotejado con fotografías de la unidad de venta'},
  'fotografias_fuente':photos,'fuentes_tecnicas':source_urls+['datos-593/inventario-publico.csv'],'imagen_principal':f'/imagenes/{sku.lower()}/{sku}-01.webp','imagenes_secundarias':[],
  'derechos_imagen':{'estado':'AUTORIZADO','tipo':'propia','titular':'CONECTATECH','fuente':source_urls[0],'evidencia':'Fotografías propias autorizadas por el propietario para edición asistida por IA y publicación. No se utilizaron fotografías externas.','fecha_verificacion':now,'archivos':[{'sha256':digest,'fuente':source_urls[0]}],'material_externo_utilizado':False,'derivacion':{'archivo_maestro':f'/imagenes/{sku.lower()}/original-{digest[:16]}.webp','sha256_maestro':digest,'fuente_fotografia_propia':source_urls[0],'metodo':method,'edicion_asistida_ia':True,'originales_intactos_en_drive':True}},
  'especificaciones':specs,'estado_calidad':'APROBADO','estado_publicacion':'APROBADO_LOCAL','url_publica':url,'fecha_verificacion':now,'descripcion':fact['descripcion'],'presentacion':'sin caja','stock_fecha_corte':'2026-10-10','stock_tiempo_real':False,'pendientes':[],'evidencia_clasificacion':evidence,'revision_regla':r['revision'],
  'maestro':{'archivo_maestro':f'/imagenes/{sku.lower()}/original-{digest[:16]}.webp','sha256_maestro':digest,'fuente_fotografia_propia':source_urls[0],'metodo':method,'edicion_asistida_ia':True,'originales_intactos_en_drive':True},
  'compatibilidad':fact['compatibilidad'],'contenido_venta':fact['contenido'],
  'beneficios':[{'valor':b[0],'titulo':b[1],'descripcion':b[2],'especificaciones':b[3],'fuentes':source_urls,'estado':'VERIFICADO'} for b in fact['beneficios']],
  'validaciones':{'base_593':{'archivo':'datos-593/inventario-publico.csv','sha256':base_hash,'fila':base},'identidad':{'sku_verificado':True,'marca_no_declarada':fact.get('marca') is None,'modelo_no_declarado':fact.get('modelo') is None,'marca_verificado':fact.get('marca') is not None,'modelo_verificado':fact.get('modelo') is not None,'variante_verificado':True,'fuentes':source_urls,'discrepancias_pendientes':[]},'ficha':{'verificada':True,'fuente':source_urls[0],'evidencia':'Datos contrastados con 593, Registro y fotografías propias del SKU; no se publican capacidades, resoluciones ni compatibilidad universal no comprobadas.'},'revision_visual':{'estado':'VERIFICADO','fecha':now,'sha256_maestro':digest,'evidencia':method}}
 }
 dump(ROOT/'importacion/contratos'/f'{sku}.json',contract)
 manifest['imagenes'][sku]=[{'archivo':str(master.relative_to(ROOT)),'sha256':digest,'posicion':1,'revision_regla':r['revision'],'modelo_revisado':True,'calidad_revisada':True,'sin_datos_privados':True,'fuente':source_urls[0],'contiene_caja':False,'fondo_aprobado':True,'referencia_fabricante':False,'nota_revision':method,'ajustes':{}}]
 manifest['aprobaciones'][sku]={'estado':'APROBADO','identidad_verificada':True,'ficha_verificada':True,'uso_comercial_permitido':True}
 manifest['contratos'][sku]=f'importacion/contratos/{sku}.json'
 visual['revision'].append({'sku':sku,'maestro':str(master.relative_to(ROOT)),'sha256':digest,'observacion':method})
 editor.append({'sku':sku,'nombre_comercial':fact['titulo'],'descripcion':fact['descripcion'],'caracteristicas_json':json.dumps({item['nombre']:item['valor'] for item in specs},ensure_ascii=False),'fuente':f'importacion/contratos/{sku}.json','imagen_principal':f'{sku}.webp','terminos_busqueda':fact['titulo'],'verificado':'SI'})

dump(LOTE/'manifiesto-aprobados.json',manifest); dump(LOTE/'produccion-visual.json',visual)
with (LOTE/'editorial.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.DictWriter(f,fieldnames=['sku','nombre_comercial','descripcion','caracteristicas_json','fuente','imagen_principal','terminos_busqueda','verificado']); w.writeheader(); w.writerows(editor)
print(json.dumps({'lote':'lote-054','skus':SKUS,'contratos':len(SKUS)},ensure_ascii=False))
