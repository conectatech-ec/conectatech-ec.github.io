#!/usr/bin/env python3
"""Audits a snapshot; never writes to Meta or changes the production feed."""
import argparse,collections,csv,datetime as dt,hashlib,importlib.util,io,json,re,unicodedata
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def normal(value):return ''.join(c for c in unicodedata.normalize('NFKD',value.strip().casefold()) if not unicodedata.combining(c))
def dump(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
def rule(terms):return {'field':'product_type','operator':'equals_any','values':terms}
def native(r):
 if r['operator']=='equals_any':return {'or':[{'product_type':{'eq':v}} for v in r['values']]} if len(r['values'])>1 else {'product_type':{'eq':r['values'][0]}}
 if r['operator']=='smartwatch_subset':return {'and':[{'product_type':{'eq':'RELOJES'}},{'or':[{'name':{'i_contains':v}} for v in ['smartwatch','smartwath','smarwatch']]}]}
 raise ValueError('Regla no soportada')
def match(row,r):
 if r['operator']=='equals_any':return row.get('product_type') in r['values']
 if r['operator']=='smartwatch_subset':return row.get('product_type')=='RELOJES' and any(v in normal(row.get('title','')) for v in ['smartwatch','smartwath','smarwatch'])
 return False
def audit(feed,inventory,reader_path):
 raw=feed.read_bytes();rows=list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))));ids=[r['id'] for r in rows]
 if len(ids)!=len(set(ids)):raise ValueError('SKU duplicados en feed; no generar plan')
 spec=importlib.util.spec_from_file_location('inventory',reader_path);reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
 master={r.get('D'):r.get('J','') for r in reader.rows(inventory) if r.get('D')}
 categories=collections.Counter(r.get('product_type','') for r in rows);findings=[];item_audits=[]
 for r in rows:
  cat=r.get('product_type','');expected=master.get(r['id']);issues=[]
  if r['id'].startswith('TELF') and expected=='TELEFONOS':expected='Celulares'
  if not cat:issues.append('CATEGORIA_VACIA')
  if expected is None:issues.append('AUSENTE_EN_INVENTARIO_REFERENCIA')
  elif normal(cat)!=normal(expected):issues.append('DIFIERE_MAESTRO_593')
  title=normal(r['title'])
  if cat=='AUDIFONOS' and re.match(r'^(luz|aro de luz|panel de luz)\b',title):issues.append('POSIBLE_LUZ_EN_AUDIFONOS')
  if cat=='RELOJES' and not any(w in title for w in ['smartwatch','smartwath','smarwatch']):issues.append('RELOJ_NO_SMARTWATCH_NO_MEZCLAR_EN_SUBCONJUNTO')
  if 'smartwath' in title or 'smarwatch' in title:issues.append('NOMBRE_SMARTWATCH_INCONSISTENTE')
  record={'sku':r['id'],'title':r['title'],'product_type':cat,'master_category':expected,'master_matches':expected is not None and normal(cat)==normal(expected),'review':issues,'semantic_verification':'HEURISTICA_DE_REVISION_NO_CERTIFICACION' if not issues else 'REVISAR_SIN_CAMBIAR_FEED'}
  item_audits.append(record)
  if issues:findings.append(record)
 master_category_names={('Celulares' if sku.startswith('TELF') and cat=='TELEFONOS' else cat) for sku,cat in master.items() if cat and cat!='Categoría'}
 empty_master_categories=sorted(cat for cat in master_category_names if cat not in categories)
 names=collections.defaultdict(list)
 for cat in categories:
  if cat:names[normal(cat)].append(cat)
 variants=[v for v in names.values() if len(v)>1]
 sets=[]
 for cat,count in sorted(categories.items()):
  if not cat:continue
  existing=cat=='Celulares';r=rule([cat]);members=[p['id'] for p in rows if match(p,r)]
  sets.append({'key':'category:'+normal(cat),'name':'CONECTATECH | '+cat.upper(),'kind':'CATEGORY','rule':r,'api_filter_candidate':native(r),'api_filter_validated':False,'expected_count':count,'members':members,'existence':'EXISTENTE_CONFIRMADO_PROPIETARIO' if existing else 'NO_VERIFICADO_CREAR_SOLO_SI_NO_EXISTE','existing_id':None,'state':'CONSERVAR_VERIFICAR_ID' if existing else 'PREPARADO_PARA_REVISION','manual_instruction':'Tipo de producto coincide exactamente con '+cat,'contains_would_match':sum(normal(cat) in normal(p.get('product_type','')) for p in rows)})
 groups={
  'CARGA Y ENERGÍA':['CARGADORES','CUBOS CARGADORES','BASES INALAMBRICAS','POWERBANKS'],
  'AUDIO':['AUDIFONOS','PARLANTES','MICROFONOS','BARRAS DE SONIDO','RADIOS','REPRODUCTORES','KITS DE GRABACION'],
  'COMPUTACIÓN':['MOUSE','TECLADOS','HUB USB','FLASH MEMORIES','TARJETAS DE MEMORIA','DISCOS DUROS EXTERNOS','LECTORES DE MEMORIA','LECTORES EXTERNOS','SWITCH','EXTENSORES WIFI','WEBCAMS','MONITORES','PROYECTORES','PRESENTADORES','PADMOUSE','CAPTURADORAS DE VIDEO'],
  'ILUMINACIÓN':['FOCOS','LAMPARAS','LINTERNAS','PANELES DE LUZ','TIRAS LEDS'],
  'FOTOGRAFÍA Y VIDEO':['CAMARAS DE SEGURIDAD','CAPTURADORAS DE VIDEO','TRIPODES','ESTABILIZADORES']}
 for name,cats in groups.items():
  actual=[c for c in cats if categories.get(c)];r=rule(actual);members=[p['id'] for p in rows if match(p,r)]
  sets.append({'key':'group:'+normal(name),'name':'CONECTATECH | '+name,'kind':'GROUP','rule':r,'api_filter_candidate':native(r),'api_filter_validated':False,'expected_count':len(members),'members':members,'existence':'NO_VERIFICADO_CREAR_SOLO_SI_NO_EXISTE','existing_id':None,'state':'PREPARADO_PARA_REVISION','manual_instruction':'Coincidir con cualquiera de estos valores exactos de Tipo de producto: '+', '.join(actual)})
 r={'field':'product_type_and_title','operator':'smartwatch_subset'};members=[p['id'] for p in rows if match(p,r)]
 sets.append({'key':'group:smartwatches','name':'CONECTATECH | SMARTWATCHES','kind':'SUBSET','rule':r,'api_filter_candidate':native(r),'api_filter_validated':False,'expected_count':len(members),'members':members,'excluded_non_smartwatch':[p['id'] for p in rows if p.get('product_type')=='RELOJES' and not match(p,r)],'existence':'NO_VERIFICADO_CREAR_SOLO_SI_NO_EXISTE','existing_id':None,'state':'REVISAR_CAMPOS_FILTRO_META','manual_instruction':'Tipo de producto = RELOJES Y nombre contiene smartwatch/smartwath/smarwatch. Si no se ofrece filtro por nombre, conservar conjunto RELOJES sin llamarlo Smartwatches; no aplicar un filtro que incluya despertadores.'})
 for proposed in sets:
  blockers=[f['sku'] for f in findings if f['sku'] in proposed['members'] and 'POSIBLE_LUZ_EN_AUDIFONOS' in f['review']]
  proposed['classification_review_required']=blockers
  if blockers:proposed['state']='REVISAR_CLASIFICACION_ANTES_DE_CREAR'
 report={'catalog_id':'1036301566100990','feed_source':'https://conectatech-ec.github.io/exportaciones/meta-catalogo-piloto.csv','feed_sha256':hashlib.sha256(raw).hexdigest(),'inventory_reference_sha256':hashlib.sha256(inventory.read_bytes()).hexdigest(),'checked_at':dt.datetime.now(dt.timezone.utc).isoformat(),'total':len(rows),'nonempty_categories':len(categories)-int('' in categories),'without_category':categories.get('',0),'source_mismatches':sum('DIFIERE_MAESTRO_593' in p['review'] for p in item_audits),'absent_master':sum('AUSENTE_EN_INVENTARIO_REFERENCIA' in p['review'] for p in item_audits),'master_categories_without_feed':empty_master_categories,'case_accent_duplicate_categories':variants,'name_style_observation':'Celulares en formato título; las demás categorías en mayúsculas. No hay categorías duplicadas por mayúsculas/acentos en esta instantánea.','findings':findings,'item_audits':item_audits,'categories':[{'category':cat,'count':count} for cat,count in sorted(categories.items())],'sets':sets,'remote_changes':0}
 dump(ROOT/'data/auditoria.json',report)
 dump(ROOT/'data/conjuntos-config.json',{'catalog_id':report['catalog_id'],'feed_sha256':report['feed_sha256'],'reported_catalog_count':945,'source_name_reported_by_owner':'CONECTATECH | Sincronización automática 593','create_catalog':False,'modify_feed':False,'paid_campaigns':False,'apply_enabled':False,'sets':sets})
 with (ROOT/'data/categorias.csv').open('w',newline='') as f:w=csv.DictWriter(f,['category','count']);w.writeheader();w.writerows(report['categories'])
 with (ROOT/'data/revision-sku.csv').open('w',newline='') as f:
  w=csv.writer(f);w.writerow(['sku','title','product_type','master_matches','review']);w.writerows([p['sku'],p['title'],p['product_type'],p['master_matches'],';'.join(p['review'])] for p in item_audits)
 lines=['AVANCE — RED COMERCIAL CONECTATECH','','| Categoría real del feed | Productos | Conjunto |','|---|---:|---|']
 lines += ['| '+(cat or 'SIN CATEGORÍA')+' | '+str(count)+' | '+('Existente confirmado por propietario' if cat=='Celulares' else 'Revisión del maestro; sin conjunto de venta' if not cat else 'Preparado; existencia remota pendiente de comprobar')+' |' for cat,count in sorted(categories.items())]
 (ROOT/'CATEGORIAS.md').write_text('\n'.join(lines)+'\n')
 return report
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--feed',type=Path,required=True);p.add_argument('--inventory',type=Path,required=True);p.add_argument('--reader',type=Path,required=True);a=p.parse_args();r=audit(a.feed,a.inventory,a.reader);print(json.dumps({k:r[k] for k in ['total','nonempty_categories','without_category','source_mismatches','absent_master']},ensure_ascii=False));print(json.dumps({s['name']:s['expected_count'] for s in r['sets'] if s['kind']!='CATEGORY'},ensure_ascii=False))
