#!/usr/bin/env python3
"""Prepare assets only. Never publish or change the source catalog/inventory."""
import argparse,csv,datetime as dt,hashlib,html,importlib.util,json,re,shutil,sys
from decimal import Decimal
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='https://conectatech-ec.github.io'
CHANNELS=['MARKETPLACE_RAFA','META_CATALOGO','FACEBOOK_PAGINA','INSTAGRAM','WEB']
def dump(path,value):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def amount(value):
 if not re.fullmatch(r'\d+(?:\.\d+)?',value or ''):raise ValueError('Importe no válido')
 return Decimal(value)
def build(reference,inventory,output=ROOT/'paquete'):
 config=json.loads((ROOT/'data/seleccion.json').read_text())
 if hashlib.sha256(inventory.read_bytes()).hexdigest()!=config['source_inventory_sha256']:raise ValueError('El inventario cambió: revisar y actualizar configuración explícitamente')
 if len(config['skus'])!=30 or len(set(config['skus']))!=30:raise ValueError('Se requieren 30 SKU únicos')
 spec=importlib.util.spec_from_file_location('inventory_reader',ROOT.parent/'colaboradores/scripts/import_inventory.py');reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
 exported=iter(reader.rows(inventory));headers=None
 for n,row in enumerate(exported):
  if row.get('D')=='Cod. Principal' and row.get('Q')=='V. TOTAL' and row.get('X')=='PVP' and row.get('Y')=='PVP % IVA' and row.get('B')=='Stock':headers=row;break
  if n>=19:break
 if not headers:raise ValueError('Formato 593 no confirmado')
 commercial={}
 for row in exported:
  sku=row.get('D','').strip()
  if not sku:continue
  if sku in commercial:raise ValueError('SKU duplicado en 593: '+sku)
  if sku in config['skus']:
   commercial[sku]={'promo':amount(row.get('Q')),'pvp':amount(row.get('X'))+amount(row.get('Y')),'available':amount(row.get('B'))>0,'category':row.get('J'),'name':row.get('C')}
  else:commercial[sku]=None
 content=json.loads((reference/'seo-contenido.json').read_text());urls=json.loads((reference/'seo-pages.json').read_text())
 existing_feed={r['id']:r for r in csv.DictReader((reference/'exportaciones/meta-catalogo-piloto.csv').open())}
 output.mkdir(parents=True,exist_ok=True);items=[];feed=[];exclusions=[]
 for rank,sku in enumerate(config['skus'],1):
  p=content[sku];v=commercial.get(sku)
  if not v or not v['available'] or v['promo']<=0 or v['pvp']<=0:raise ValueError('Producto no promocionable: '+sku)
  contract_relative=f'importacion/contratos/{sku}.json';contract_path=reference/contract_relative;contract=json.loads(contract_path.read_text());image_path=reference/p['imagen'].lstrip('/')
  if not p.get('comercialVerificado') or p.get('imagenPendiente') or p.get('presentacion')!='sin caja' or contract.get('estado_calidad')!='APROBADO' or contract.get('pendientes'):raise ValueError('Revisión editorial incompleta: '+sku)
  media=p.get('imagenProfesional',{})
  if media.get('contiene_caja') is not False:raise ValueError('Imagen sin validación SIN CAJA: '+sku)
  image_hash=hashlib.sha256(image_path.read_bytes()).hexdigest()
  url=BASE+'/productos/'+urls[sku]+'/'
  old=existing_feed.get(sku,{})
  if old.get('condition')!='new':raise ValueError('Condición comercial no verificada: '+sku)
  title=p.get('nombre') or contract['titulo_comercial']
  # Preserve "compatible", physical + expanded RAM, sale unit, model and variant qualifiers.
  if len(title)>150:raise ValueError('Revisar título demasiado largo: '+sku)
  description=p['descripcion'].strip();benefits=p.get('beneficios') or []
  features=p.get('caracteristicas') or {}
  fulfillment='Retiro en tienda: Quito, Av. 6 de Diciembre y La Niña, C.C. Multicentro Shopping, subsuelo, local 3. Retiro sin costo de envío.\nContraentrega en Quito: según cobertura y sector, desde $2,90; puede alcanzar aproximadamente $25 a $30 según distancia. Tarifa exacta antes del pedido.\nEnvíos nacionales por Servientrega: $6,90. Pago anticipado del producto más envío; CONECTATECH asume cualquier sobrecosto del transporte. Despacho coordinado después de verificar el pago. No hay envío nacional contraentrega.\nConfirmar disponibilidad del producto antes de cerrar la venta.'
  text='\n'.join([title,f"Precio de contado: ${v['promo']:.2f}",'Condición: nuevo.',description,*[b['titulo']+': '+b['descripcion'] for b in benefits[:3]],f"Unidad de venta: {p.get('unidadVenta') or contract.get('unidad_venta')}",fulfillment,'CONECTATECH · Consulta condiciones vigentes.'])
  item={'sku':sku,'priority':rank,'priority_basis':'Selección editorial por categoría, identidad, imagen aprobada y disponibilidad; no es ranking de ventas','title':title,'model':p.get('modelo'),'brand':p.get('marca'),'category':v['category'],'category_marketplace':{'suggestion':p.get('categoriaOriginal'),'official_id':None,'verified':False,'action':'Elegir categoría oficial visible en la cuenta antes de publicar'},'condition':'new','price':f"{v['promo']:.2f}",'pvp':f"{v['pvp']:.2f}",'currency':'USD','available':True,'features':features,'description':description,'benefits':benefits,'sale_unit':p.get('unidadVenta') or contract.get('unidad_venta'),'variant':p.get('variante'),'image_url':BASE+p['imagen'],'image_file':f'imagenes/{sku}.webp','banner_url':None,'banner_status':'No hay banner vigente verificado para este lote; se reutiliza imagen principal aprobada','product_url':url,'marketplace_copy':text,'facebook_copy':text+'\nFicha: '+url,'instagram_copy':text+'\nConsulta la ficha de este modelo en el catálogo web de CONECTATECH.','fulfillment_confirmed':True,'guarantee':None,'state':'PREPARADO','channels':{ch:{'state':'REVISAR','publication_id':None,'publication_url':None,'approved':False} for ch in CHANNELS},'source':{'inventory_sha256':config['source_inventory_sha256'],'catalog_commit':config['source_catalog_commit'],'image_sha256':image_hash,'contract_path':contract_relative,'contract_sha256':hashlib.sha256(contract_path.read_bytes()).hexdigest(),'source_date':config['source_date'],'valid_until':config['valid_until']},'metrics':{'views':None,'inquiries':None,'leads':None,'confirmed_sales':None},'visual_review':{'needs_better_framing':sku=='TELF026','note':'Producto pequeño en el lienzo; mejorar encuadre en futura revisión sin cambiar el modelo' if sku=='TELF026' else 'Reutilizar imagen aprobada sin regenerarla'},'review':['Categoría oficial de Marketplace en la cuenta','Confirmar cobertura y tarifa exacta de contraentrega para el pedido','Aprobación externa por canal','Revalidar precio e imagen de ficha web antes de sincronizar']}
  dest=output/item['image_file'];dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(image_path,dest)
  (output/'anuncios').mkdir(exist_ok=True);(output/'anuncios'/f'{sku}.txt').write_text(text+'\n')
  brand=p.get('marca')
  # Never turn a compatible device model into an invented manufacturer MPN or brand.
  if brand and brand.lower() not in ['genérico','generico']:
   feed.append({'id':sku,'title':title,'description':description+' '+fulfillment,'availability':'in stock','condition':'new','price':f"{v['promo']:.2f} USD",'link':url,'image_link':item['image_url'],'brand':brand,'product_type':v['category']})
  else:exclusions.append({'sku':sku,'reason':'Marca, GTIN o MPN comercial verificable pendiente para catálogo empresarial; no se inventa un identificador'})
  items.append(item)
 manifest={'batch_id':config['batch_id'],'source_date':config['source_date'],'valid_until':config['valid_until'],'inventory_sha256':config['source_inventory_sha256'],'prepared':len(items),'approved':0,'published':0,'meta_feed_candidates':len(feed),'meta_feed_exclusions':exclusions,'externally_validated':False,'external_publication_enabled':False,'items':items}
 dump(output/'lote.json',manifest)
 with (output/'meta-catalogo-candidato.csv').open('w',newline='') as f:
  fields=['id','title','description','availability','condition','price','link','image_link','brand','product_type'];w=csv.DictWriter(f,fields);w.writeheader();w.writerows(feed)
 with (output/'bandeja-rafa.csv').open('w',newline='') as f:
  fields=['sku','title','price','currency','description','image_file','product_url','category_suggestion','state'];w=csv.DictWriter(f,fields);w.writeheader()
  for i in items:w.writerow({'sku':i['sku'],'title':i['title'],'price':i['price'],'currency':'USD','description':i['marketplace_copy'],'image_file':i['image_file'],'product_url':i['product_url'],'category_suggestion':i['category_marketplace']['suggestion'],'state':'PREPARADO'})
 # CSV is an internal queue, never asserted to match an unknown Marketplace bulk template.
 safe_json=json.dumps(manifest,ensure_ascii=False).replace('<','\\u003c').replace('\u2028','\\u2028').replace('\u2029','\\u2029')
 (output/'lote.js').write_text('window.CONECTATECH_BATCH='+safe_json+';\n')
 return manifest
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--reference',type=Path,required=True);p.add_argument('--inventory',type=Path,required=True);p.add_argument('--output',type=Path,default=ROOT/'paquete');a=p.parse_args();m=build(a.reference,a.inventory,a.output);print(json.dumps({k:m[k] for k in ['prepared','approved','published','meta_feed_candidates']},ensure_ascii=False))
