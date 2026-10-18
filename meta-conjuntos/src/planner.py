"""Offline product-set planner. No remote mutations, catalogs or campaign operations."""
import hashlib,json,unicodedata
CATALOG_ID='1036301566100990'
def canonical(value):
 if isinstance(value,str):
  try:value=json.loads(value)
  except (ValueError,TypeError):return value
 if isinstance(value,dict):return {k:canonical(v) for k,v in sorted(value.items())}
 if isinstance(value,list):return sorted([canonical(v) for v in value],key=lambda v:json.dumps(v,sort_keys=True))
 return value
def key(value):return json.dumps(canonical(value),sort_keys=True,ensure_ascii=False)
def plan(config,existing):
 if config.get('catalog_id')!=CATALOG_ID:raise ValueError('No cambiar catálogo maestro')
 if config.get('create_catalog') or config.get('modify_feed') or config.get('paid_campaigns'):raise ValueError('Operación fuera de alcance')
 if len({s['name'] for s in config['sets']})!=len(config['sets']):raise ValueError('Nombres de conjunto duplicados')
 by_name={};by_filter={}
 for item in existing:
  by_name.setdefault(item['name'].casefold(),[]).append(item);by_filter.setdefault(key(item.get('filter',{})),[]).append(item)
 actions=[];seen=set()
 for desired in config['sets']:
  if desired['expected_count']<=0:actions.append({'name':desired['name'],'action':'SKIP_EMPTY'});continue
  fingerprint=key(desired['api_filter_candidate']);name=desired['name'];matches=by_name.get(name.casefold(),[])
  if desired['existence']=='EXISTENTE_CONFIRMADO_PROPIETARIO':action='KEEP_OWNER_CONFIRMED_VERIFY_REMOTE_ID'
  elif len(matches)>1:action='REVIEW_DUPLICATE_EXISTING_NAMES'
  elif matches:action='REUSE_EXISTING' if key(matches[0].get('filter',{}))==fingerprint else 'REVIEW_EXISTING_FILTER_NO_AUTOMATIC_UPDATE'
  elif fingerprint in by_filter:action='REUSE_EXISTING_FILTER_DIFFERENT_NAME'
  elif desired.get('classification_review_required'):action='REVIEW_CLASSIFICATION_BEFORE_CREATE'
  elif fingerprint in seen:action='SKIP_DUPLICATE_PROPOSED_FILTER'
  else:action='CREATE_DRAFT_REQUIRES_ACCESS_AND_APPROVAL'
  seen.add(fingerprint)
  actions.append({'name':name,'key':desired['key'],'expected_count':desired['expected_count'],'action':action,'existing_ids':[m.get('id') for m in matches],'request_candidate':{'method':'POST','path':'/'+CATALOG_ID+'/product_sets','body':{'name':name,'filter':desired['api_filter_candidate']}} if action.startswith('CREATE_DRAFT') else None,'filter_platform_validated':desired.get('api_filter_validated',False),'remote_write_executed':False})
 return {'catalog_id':CATALOG_ID,'apply_enabled':False,'actions':actions,'changes_executed':0,'explanation':'Las solicitudes son candidatas, no se envían. Revalidar filtros, catálogo, permisos y aprobación antes de habilitar cualquier transporte de escritura.'}
def apply_plan(*args,**kwargs):raise PermissionError('Aplicación remota desactivada: requiere evidencia de autorización de cuenta y aprobación explícita del propietario. Usar plan/manual.')
