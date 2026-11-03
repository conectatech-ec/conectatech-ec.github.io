"""One authorized ALEX metadata update. Reuses the existing CF transport and bundle parser.
Never changes the Data Hub source module, other SKU approvals, runtime code or settings.
"""
import copy, hashlib, json, os, time, urllib.request
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path
from scoped_content import CFClient, ScopedDeployer, Bundle, same_bundle, same_json, strict_json, private_get
from scoped_policy import closed_health, tester_scope

ROOT=Path(__file__).resolve().parent
SHA='756693acd771ee3ae6c0881d173c802be18b82c2ccae2957d61189b5d01384f0'
DATE='2026-11-03'
MODULE='source-attestations.mjs'
IMAGE='https://conectatech-ec.github.io/imagenes/hub017/HUB017-01.webp'
IMAGE_SHA='1bcafdaf7ee44c13cd3324c008a962d36dd61a9c8bc23dbc287d07e421bb59bb'
BASE='https://conectatech-ec.github.io/'
def fail(code):raise ValueError(code)
def decode(body):
 if not body.startswith(b'export default ') or not body.rstrip().endswith(b';'):fail('HUB017_METADATA_WRAPPER')
 return strict_json(body[len(b'export default '):].rstrip()[:-1])
def metadata_patch(bundle,approval,rollback=False):
 if approval.get('cut_date')!=DATE or approval.get('generated_at')!='2026-11-03T18:55:23Z' or approval.get('identity_verified_skus')!=['HUB017']:fail('HUB017_APPROVAL_SCOPE')
 parts=[p for p in bundle.parts if p.name==MODULE]
 if len(parts)!=1:fail('HUB017_MODULE_REQUIRED')
 old=decode(parts[0].body);new=copy.deepcopy(old)
 if SHA not in new:
  if rollback:return bundle,False
  new[SHA]=copy.deepcopy(approval)
 else:
  record=new[SHA]
  if record.get('cut_date')!=DATE or record.get('generated_at')!=approval['generated_at']:fail('HUB017_CONCURRENT_ATTESTATION')
  ids=record.get('identity_verified_skus')
  if not isinstance(ids,list) or len(ids)!=len(set(ids)):fail('HUB017_ATTESTATION_SCHEMA')
  expected=approval.get('identity_evidence',{}).get('HUB017')
  actual=record.get('identity_evidence',{}).get('HUB017')
  if actual is not None and not same_json(actual,expected):fail('HUB017_CONCURRENT_ATTESTATION')
  if rollback:
   record['identity_verified_skus']=[sku for sku in ids if sku!='HUB017']
   if 'identity_evidence' in record:
    record['identity_evidence'].pop('HUB017',None)
    if not record['identity_evidence']:del record['identity_evidence']
   if not record['identity_verified_skus'] and {k:v for k,v in record.items() if k!='identity_verified_skus'}=={k:v for k,v in approval.items() if k not in {'identity_verified_skus','identity_evidence'}}:del new[SHA]
  else:
   if 'HUB017' not in ids:record['identity_verified_skus']=[*ids,'HUB017']
   if expected is not None:record.setdefault('identity_evidence',{})['HUB017']=expected
  if same_json(old,new):return bundle,False
  if SHA in old and SHA in new:
   if [s for s in old[SHA]['identity_verified_skus'] if s!='HUB017']!=[s for s in new[SHA]['identity_verified_skus'] if s!='HUB017']:fail('HUB017_OTHER_SKU_CHANGED')
 if {k:v for k,v in new.items() if k!=SHA}!={k:v for k,v in old.items() if k!=SHA}:fail('HUB017_OTHER_APPROVAL_CHANGED')
 body=b'export default '+json.dumps(new,ensure_ascii=False,separators=(',',':')).encode()+b';\n'
 result=Bundle(bundle.entrypoint,tuple(replace(p,body=body,headers=tuple((k,str(len(body)) if k.lower()=='content-length' else v) for k,v in p.headers)) if p.name==MODULE else p for p in bundle.parts))
 if any(p!=next(q for q in result.parts if q.name==p.name) for p in bundle.parts if p.name!=MODULE):fail('HUB017_UNOWNED_MODULE_CHANGED')
 return result,True
def public(path):
 request=urllib.request.Request(BASE+path,headers={'Cache-Control':'no-cache'})
 with urllib.request.urlopen(request,timeout=30) as response:
  if response.status!=200:fail('HUB017_PUBLIC_HTTP')
  raw=response.read(2_000_001)
  if len(raw)>2_000_000:fail('HUB017_PUBLIC_SIZE')
  return raw
def main():
 config=strict_json((ROOT/'activar-cloud.json').read_bytes())
 if config.get('activar') is not False or config.get('sincronizar_meta_verify_token') is not False or config.get('aprobar_identidad_hub017') is not True:fail('HUB017_WRITES_DISABLED')
 if os.environ.get('CF_FREE_ONLY_CONFIRMED','').lower()!='true':fail('HUB017_FREE_ONLY_REQUIRED')
 approved_record=strict_json((ROOT/'central/source-attestations.json').read_bytes())[SHA]
 approval={key:approved_record[key] for key in ('cut_date','generated_at')}
 approval.update(evidence='HUB017 owner-approved packaging/593 alias only; no financial override',identity_verified_skus=['HUB017'],identity_evidence={'HUB017':approved_record['identity_evidence']['HUB017']})
 rollback=config.get('hub017_identity_mode','apply')=='rollback'
 if config.get('hub017_identity_mode','apply') not in {'apply','rollback'}:fail('HUB017_MODE_INVALID')
 generated=datetime.fromisoformat(approval['generated_at'].replace('Z','+00:00'))
 if not 0<=(datetime.now(timezone.utc)-generated).total_seconds()<86400:fail('HUB017_REPORT_NOT_FRESH')
 state=strict_json(public('datos-593/estado-ultimo-corte.json'));cut=strict_json(public('datos-593/corte-comercial-publico-validado.json'))
 if state.get('origen_sha256')!=SHA or state.get('fecha_corte')!=DATE or state.get('referencia')!='datos-593/corte-comercial-publico-validado.json' or cut.get('sha256_original')!=SHA or cut.get('fecha_corte')!=DATE:fail('HUB017_SOURCE_CHANGED')
 row=cut['productos']['HUB017']
 if row.get('stock',0)<=0 or row.get('promo_centavos')!=1190 or row.get('pvp_centavos')!=1369:fail('HUB017_COMMERCIAL_SOURCE_CHANGED')
 if hashlib.sha256(public('imagenes/hub017/HUB017-01.webp')).hexdigest()!=IMAGE_SHA:fail('HUB017_IMAGE_CHANGED')
 api=CFClient(os.environ.get('CLOUDFLARE_ACCOUNT_ID'),os.environ.get('CLOUDFLARE_API_TOKEN'))
 operation=ScopedDeployer(api);capture=operation.capture()
 target=next((p for p in capture['source']['products'] if p['sku']=='HUB017'),None)
 if not target or target['source_name']!=approval['identity_evidence']['HUB017']['baseline_alias'] or target['blocked_reasons']:fail('HUB017_RUNTIME_IDENTITY_REQUIRES_REVIEW')
 expected,changed=metadata_patch(capture['bundle'],approval,rollback)
 operation.check_before_put(capture)
 # Re-read the control immediately before the single authorized metadata mutation.
 from scoped_content import read_latest_config
 latest=read_latest_config()
 if latest.get('aprobar_identidad_hub017') is not True or latest.get('activar') is not False or latest.get('sincronizar_meta_verify_token') is not False or latest.get('hub017_identity_mode','apply')!=config.get('hub017_identity_mode','apply'):fail('HUB017_PUBLIC_CONTROL_CLOSED')
 if changed:api.put_bundle(expected)
 try:
  for attempt in range(12):
   observed=api.get_bundle()
   if not same_json(api.get_settings(),capture['settings']):fail('HUB017_SETTINGS_CHANGED')
   if not same_json(private_get('/commercial/catalog'),capture['source']):fail('HUB017_SOURCE_CHANGED_AFTER_PUT')
   closed_health(private_get('/health'),capture['health']['messenger_outbound'],capture['health']['release']);tester_scope(private_get,capture['health']['messenger_outbound'])
   if same_bundle(observed,expected):break
   if not same_bundle(observed,capture['bundle']):fail('HUB017_CONCURRENT_RUNTIME_CHANGE')
   if attempt==11:fail('HUB017_PROPAGATION_TIMEOUT')
   time.sleep(2)
 except Exception:
  if changed and same_bundle(api.get_bundle(),expected) and same_json(api.get_settings(),capture['settings']) and same_json(private_get('/commercial/catalog'),capture['source']):api.put_bundle(capture['bundle'])
  raise
 receipt={'sku':'HUB017','metadata_applied':not rollback,'mode':'rollback' if rollback else 'apply','worker_puts':int(changed),'module':MODULE,'other_modules_unchanged':True,'private_source_unchanged':True,'settings_unchanged':True,'runtime_release':capture['health']['release'],'source_sha256':SHA,'cut_date':DATE,'generated_at':approval['generated_at'],'rollback':'Reopen the existing control with hub017_identity_mode=rollback; only the identical HUB017 approval is removed. Never restore the full Worker or Data Hub source.'}
 out=ROOT/'generated/fase2/hub017-identity-deploy.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
if __name__=='__main__':main()
