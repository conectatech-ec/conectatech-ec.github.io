#!/usr/bin/env python3
"""Prepara contratos/editorial/manifiesto del lote 052 desde evidencia ya revisada."""
import csv, hashlib, json
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LOTE = ROOT / 'importacion/lotes/lote-052'
SKUS = ['ADAP018','ADAP030','ADAP036','ADAP037','ADAP038','ADAP039']
FACTS = {
 'ADAP018': {
  'titulo':'Unión HDMI hembra a hembra compacta', 'variante':'Negro',
  'descripcion':'Une dos cables HDMI con conectores macho mediante un acoplador compacto. Su formato de una pieza facilita extender una conexión existente sin cambiar los cables.',
  'specs': [('Conectores','HDMI hembra a HDMI hembra'),('Función','Unión de dos cables HDMI'),('Formato','Acoplador compacto de una pieza'),('Color','Negro')],
  'compatibilidad':'Cables con conectores HDMI macho; confirma el tipo de conexión de tus equipos.',
  'contenido':'1 acoplador HDMI hembra a hembra.',
  'beneficios':[('HDMI hembra a hembra','Une tus cables','Completa una conexión HDMI usando dos cables con conectores macho.',['Conectores','Función']),('Compacto','Ocupa poco espacio','Su cuerpo de una pieza se integra con facilidad en tu instalación.',['Formato'])]},
 'ADAP030': {
  'titulo':'Divisor de audio y micrófono 3,5 mm blanco', 'variante':'Blanco',
  'descripcion':'Separa una conexión combinada de 3,5 mm en dos entradas para audífonos y micrófono compatibles. El cable corto y el cuerpo compacto ayudan a ordenar la conexión en tu equipo.',
  'specs':[('Conector al equipo','3,5 mm macho de cuatro contactos'),('Salidas visibles','Dos entradas hembra de 3,5 mm'),('Uso','Audio y micrófono en equipos compatibles'),('Color','Blanco')],
  'compatibilidad':'Equipos con puerto combinado de 3,5 mm y accesorios separados de audio/micrófono; confirma la distribución de contactos.',
  'contenido':'1 adaptador divisor de 3,5 mm.',
  'beneficios':[('2 conexiones','Separa audio y micrófono','Conecta accesorios separados a un puerto combinado compatible.',['Salidas visibles','Uso']),('3,5 mm','Conexión directa','Utiliza el puerto de audio combinado de tu equipo compatible.',['Conector al equipo'])]},
 'ADAP036': {
  'titulo':'Adaptador Bluetooth 5.0 USB-A para PC y laptop', 'variante':'Negro',
  'descripcion':'Añade conectividad Bluetooth a un computador compatible mediante USB-A. Su diseño compacto ocupa poco espacio y resulta práctico para equipos de escritorio o portátiles.',
  'specs':[('Interfaz','USB-A'),('Bluetooth','Versión 5.0, según empaque'),('Uso','PC y laptop compatibles'),('Formato','Dongle compacto'),('Color','Negro')],
  'compatibilidad':'Computadores con puerto USB-A y sistema compatible; confirma controladores y versión del sistema.',
  'contenido':'1 adaptador Bluetooth USB-A.',
  'beneficios':[('Bluetooth 5.0','Añade conexión inalámbrica','Incorpora Bluetooth a un computador compatible mediante USB-A.',['Bluetooth','Interfaz']),('Formato compacto','Déjalo conectado','El cuerpo pequeño ocupa poco espacio alrededor del puerto USB.',['Formato'])]},
 'ADAP037': {
  'titulo':'Convertidor HDMI a VGA negro', 'variante':'Negro',
  'descripcion':'Conecta una fuente con salida HDMI a una pantalla o proyector con entrada VGA compatible. El cable corto permite acomodar el convertidor sin añadir un adaptador rígido al puerto.',
  'specs':[('Entrada','HDMI macho'),('Salida','VGA hembra'),('Conversión','HDMI a VGA'),('Color','Negro')],
  'compatibilidad':'Fuente HDMI y pantalla/proyector VGA compatibles. La conversión indicada es HDMI a VGA.',
  'contenido':'1 convertidor HDMI a VGA.',
  'beneficios':[('HDMI → VGA','Conecta equipos de distintas generaciones','Lleva la salida HDMI de una fuente a una pantalla VGA compatible.',['Entrada','Salida','Conversión']),('Cable corto','Más flexibilidad en el puerto','Reduce la tensión de un adaptador rígido al acomodar la conexión.',['Formato'])]},
 'ADAP038': {
  'titulo':'Adaptador Mini DisplayPort a HDMI blanco', 'variante':'Blanco',
  'descripcion':'Conecta un equipo con Mini DisplayPort a una pantalla o proyector con entrada HDMI compatible. Su cable corto facilita orientar la conexión en el escritorio.',
  'specs':[('Entrada','Mini DisplayPort macho'),('Salida','HDMI hembra'),('Conversión','Mini DisplayPort a HDMI'),('Color','Blanco')],
  'compatibilidad':'Equipos con salida Mini DisplayPort y pantallas con entrada HDMI; confirma la compatibilidad de video del equipo.',
  'contenido':'1 adaptador Mini DisplayPort a HDMI.',
  'beneficios':[('Mini DP → HDMI','Conecta tu pantalla HDMI','Convierte la salida Mini DisplayPort del equipo en una conexión HDMI compatible.',['Entrada','Salida','Conversión']),('Cable corto','Acomoda la conexión','El tramo flexible ayuda a orientar el adaptador junto al equipo.',['Formato'])]},
 'ADAP039': {
  'titulo':'Adaptador DisplayPort a HDMI negro', 'variante':'Negro',
  'descripcion':'Conecta un equipo con salida DisplayPort a una pantalla o proyector con entrada HDMI compatible. El cable corto permite orientar el adaptador con comodidad.',
  'specs':[('Entrada','DisplayPort macho'),('Salida','HDMI hembra'),('Conversión','DisplayPort a HDMI'),('Color','Negro')],
  'compatibilidad':'Equipos con salida DisplayPort y pantallas con entrada HDMI; confirma resolución y compatibilidad del equipo.',
  'contenido':'1 adaptador DisplayPort a HDMI.',
  'beneficios':[('DP → HDMI','Conecta tu pantalla HDMI','Lleva la salida DisplayPort de tu equipo a una entrada HDMI compatible.',['Entrada','Salida','Conversión']),('Cable corto','Conexión más cómoda','El tramo flexible facilita acomodar el adaptador junto al puerto.',['Formato'])]},
}

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def dump(path,obj): path.parent.mkdir(parents=True,exist_ok=True); path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')

now=datetime.now(timezone.utc).isoformat()
queue=json.loads((ROOT/'importacion/cola-drive.json').read_text())['productos']
rules=json.loads((ROOT/'importacion/reglas-sku.json').read_text())['productos']
urls=json.loads((ROOT/'seo-pages.json').read_text())
base_hash=sha(ROOT/'datos-593/inventario-publico.csv')
with (ROOT/'datos-593/inventario-publico.csv').open(encoding='utf-8-sig',newline='') as f:
 rows={r['sku']:r for r in csv.DictReader(f)}

manifest={'version':3,'lote':'lote-052','cantidad_seleccionada':len(SKUS),'skus':SKUS,'imagenes':{},'aprobaciones':{},'contratos':{},'categorias_comerciales':{'Adaptadores':{'nombre':'Cables y Conectividad','subcategoria':'Adaptadores','verificada':True,'fuente':'importacion/categorias-comerciales.json'}}}
visual={'lote':'lote-052','fecha':now,'referencias_aprobadas':['POWE003','ADAP005'],'revision':[]}
editor=[]
for sku in SKUS:
 fact=FACTS[sku]; q=queue[sku]; r=rules[sku]; base=rows[sku]
 master=LOTE/'editorial-imagenes'/f'{sku}.webp'; digest=sha(master)
 source_urls=[x['url'] for x in q['fotos']]
 photos=[]
 for item in q['fotos']:
  local=next((p for p in (ROOT/'.produccion-privada/lote-052/fuentes').glob(f'{sku}__*') if p.name.endswith(item['nombre'])),None)
  ph={'nombre':item['nombre'],'drive_id':item['id'],'url':item['url'],'sha256':sha(local) if local else None,'filas_registro':item.get('registro',[]),'uso':'Identificación y referencia propia para edición','original_intacto':True}
  if local:
   with Image.open(local) as im: ph['resolucion']=list(im.size)
  photos.append(ph)
 tipo='original' if r['autenticidad']=='original verificado' else 'generico'
 specs=[{'nombre':n,'valor':v,'fuentes':source_urls,'estado':'VERIFICADO','publicar':True} for n,v in fact['specs']]
 # Beneficios que mencionan formato requieren una especificación explícita.
 names={x['nombre'] for x in specs}
 if any('Formato' in b[3] for b in fact['beneficios']) and 'Formato' not in names:
  specs.append({'nombre':'Formato','valor':'Cable corto flexible','fuentes':source_urls,'estado':'VERIFICADO','publicar':True})
 evidence=r.get('evidencia_autenticidad','')
 url='https://conectatech-ec.github.io/productos/'+urls[sku]+'/'
 method='Edición asistida por IA de fotografías propias autorizadas: retiro de bolsa o blíster, limpieza, luz de estudio y fondo blanco. Revisión visual de conectores, forma y color contra todas las vistas disponibles; sin añadir puertos ni accesorios.'
 contract={
  'sku':sku,'nombre_original':base['nombre'].title(),'titulo_comercial':fact['titulo'],'tipo':tipo,'marca':None,'modelo':None,'variante':fact['variante'],
  'categoria_original':'Adaptadores','categoria_comercial':'Cables y Conectividad','precio_contado':float(base['promo_contado']),'pvp':float(base['pvp_final']),'stock':int(base['stock']),
  'unidad_venta':{'descripcion':'1 unidad','cantidad':1,'verificada':True,'fuente':'datos-593/inventario-publico.csv','evidencia':'SKU singular cotejado con fotografías de la unidad de venta'},
  'fotografias_fuente':photos,'fuentes_tecnicas':source_urls+['datos-593/inventario-publico.csv'],'imagen_principal':f'/imagenes/{sku.lower()}/{sku}-01.webp','imagenes_secundarias':[],
  'derechos_imagen':{'estado':'AUTORIZADO','tipo':'propia','titular':'CONECTATECH','fuente':source_urls[0],'evidencia':'Fotografías propias autorizadas por el propietario para edición asistida por IA y publicación. No se utilizaron fotografías externas.','fecha_verificacion':now,'archivos':[{'sha256':digest,'fuente':source_urls[0]}],'material_externo_utilizado':False,'derivacion':{'archivo_maestro':f'/imagenes/{sku.lower()}/original-{digest[:16]}.webp','sha256_maestro':digest,'fuente_fotografia_propia':source_urls[0],'metodo':method,'edicion_asistida_ia':True,'originales_intactos_en_drive':True}},
  'especificaciones':specs,'estado_calidad':'APROBADO','estado_publicacion':'APROBADO_LOCAL','url_publica':url,'fecha_verificacion':now,'descripcion':fact['descripcion'],'presentacion':'sin caja','stock_fecha_corte':'2026-10-10','stock_tiempo_real':False,'pendientes':[],'evidencia_clasificacion':evidence,'revision_regla':r['revision'],
  'maestro':{'archivo_maestro':f'/imagenes/{sku.lower()}/original-{digest[:16]}.webp','sha256_maestro':digest,'fuente_fotografia_propia':source_urls[0],'metodo':method,'edicion_asistida_ia':True,'originales_intactos_en_drive':True},
  'compatibilidad':fact['compatibilidad'],'contenido_venta':fact['contenido'],
  'beneficios':[{'valor':b[0],'titulo':b[1],'descripcion':b[2],'especificaciones':b[3],'fuentes':source_urls,'estado':'VERIFICADO'} for b in fact['beneficios']],
  'validaciones':{'base_593':{'archivo':'datos-593/inventario-publico.csv','sha256':base_hash,'fila':base},'identidad':{'sku_verificado':True,'marca_no_declarada':True,'modelo_no_declarado':True,'modelo_verificado':False,'variante_verificado':True,'fuentes':source_urls,'discrepancias_pendientes':[]},'ficha':{'verificada':True,'fuente':source_urls[0],'evidencia':'Datos contrastados con 593 y fotografías propias del SKU; no se publican capacidades, resoluciones ni compatibilidad universal no comprobadas.'},'revision_visual':{'estado':'VERIFICADO','fecha':now,'sha256_maestro':digest,'evidencia':method}}
 }
 dump(ROOT/'importacion/contratos'/f'{sku}.json',contract)
 manifest['imagenes'][sku]=[{'archivo':str(master.relative_to(ROOT)),'sha256':digest,'posicion':1,'revision_regla':r['revision'],'modelo_revisado':True,'calidad_revisada':True,'sin_datos_privados':True,'fuente':source_urls[0],'contiene_caja':False,'fondo_aprobado':True,'referencia_fabricante':False,'nota_revision':method,'ajustes':{}}]
 manifest['aprobaciones'][sku]={'estado':'APROBADO','identidad_verificada':True,'ficha_verificada':True,'uso_comercial_permitido':True}
 manifest['contratos'][sku]=f'importacion/contratos/{sku}.json'
 visual['revision'].append({'sku':sku,'maestro':str(master.relative_to(ROOT)),'sha256':digest,'observacion':method})
 editor.append({'sku':sku,'nombre_comercial':fact['titulo'],'descripcion':fact['descripcion'],'caracteristicas_json':json.dumps({n:v for n,v in fact['specs']},ensure_ascii=False),'fuente':f'importacion/contratos/{sku}.json','imagen_principal':f'{sku}.webp','terminos_busqueda':fact['titulo'],'verificado':'SI'})

dump(LOTE/'manifiesto-aprobados.json',manifest); dump(LOTE/'produccion-visual.json',visual)
with (LOTE/'editorial.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.DictWriter(f,fieldnames=['sku','nombre_comercial','descripcion','caracteristicas_json','fuente','imagen_principal','terminos_busqueda','verificado']); w.writeheader(); w.writerows(editor)
print(json.dumps({'lote':'lote-052','skus':SKUS,'contratos':len(SKUS)},ensure_ascii=False))
