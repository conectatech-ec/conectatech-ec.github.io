"""Update one existing pilot Worker with a per-Worker Editor token.
Free plan is verified by owner in dashboard; no Billing/D1/account-list API access.
"""
import base64, json, os, re, secrets, subprocess, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parent
WORKER='conectatech-comercial-piloto'
BRANCH='refs/heads/automatizacion/piloto-cloud-3sku-20261015'
SCRIPT='/workers/scripts/'+WORKER

def private_worker_json(path):
    """Capture fixed private GETs in RAM. Never print/persist bodies or child stderr."""
    if path not in {'/health','/commercial/catalog','/messenger/status','/messenger/seller/status'}:
        raise ValueError('PRIVATE_READ_PATH')
    try:
        child=subprocess.run(['node',str(ROOT/'central-http.mjs'),path],input='',text=True,capture_output=True,timeout=55)
        probe=json.loads(child.stdout)
        if child.returncode or probe.get('status')!=200:raise ValueError()
        data=base64.b64decode(probe['bytes_b64'],validate=True)
        if len(data)>2_000_000:raise ValueError()
        def unique(pairs):
            result={}
            for key,value in pairs:
                if key in result:raise ValueError()
                result[key]=value
            return result
        def invalid_constant(_):raise ValueError()
        result=json.loads(data,object_pairs_hook=unique,parse_constant=invalid_constant)
        if not isinstance(result,dict):raise ValueError()
        return result
    except (OSError,ValueError,KeyError,TypeError,subprocess.TimeoutExpired):
        raise RuntimeError('PRIVATE_READ_FAILED; response values withheld') from None

def source_time(value):
    try:
        result=datetime.fromisoformat(value.replace('Z','+00:00'))
        if result.tzinfo is None:raise ValueError()
        return result
    except (ValueError,TypeError,AttributeError):raise ValueError('SOURCE_DATE_INVALID') from None

def validate_source(data):
    """Structural validation only; identity/finance preservation uses the whole body."""
    if not isinstance(data,dict) or data.get('schema')!='conectatech.commercial.v1' or not isinstance(data.get('source'),dict):
        raise ValueError('SOURCE_SCHEMA_INVALID')
    source=data['source'];products=data.get('products')
    if (not isinstance(source.get('sha256'),str) or not re.fullmatch(r'[a-f0-9]{64}',source['sha256']) or
        not isinstance(source.get('cut_date'),str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',source['cut_date'])):
        raise ValueError('SOURCE_METADATA_INVALID')
    generated=source_time(source.get('generated_at'));expires=source_time(data.get('expires_at'))
    if (expires-generated).total_seconds()!=86400 or generated.timestamp()>time.time()+300:
        raise ValueError('SOURCE_DATE_INVALID')
    if generated.astimezone(timezone(timedelta(hours=-5))).date().isoformat()!=source['cut_date']:
        raise ValueError('SOURCE_CUT_DATE_INVALID')
    if not isinstance(products,list) or not 1<=len(products)<=5000:raise ValueError('SOURCE_PRODUCTS_INVALID')
    seen=set()
    for product in products:
        if not isinstance(product,dict):raise ValueError('SOURCE_PRODUCT_INVALID')
        sku=product.get('sku')
        if not isinstance(sku,str) or not re.fullmatch(r'[A-Z0-9_-]{3,40}',sku) or sku in seen:
            raise ValueError('SOURCE_PRODUCT_INVALID')
        seen.add(sku)
        if (not isinstance(product.get('availability'),str) or product['availability'] not in {'in_stock','out_of_stock','blocked'} or not isinstance(product.get('blocked_reasons'),list) or
            any(not isinstance(reason,str) for reason in product['blocked_reasons']) or
            any(not isinstance(product.get(key),str) or not product[key] for key in ('source_name','name')) or
            not isinstance(product.get('variant_gb'),list) or any(type(n) is not int or n<0 for n in product['variant_gb'])):
            raise ValueError('SOURCE_PRODUCT_INVALID')
        if any(key in product for key in ('stock','cost','quantity')):raise ValueError('SOURCE_PRIVATE_FIELD')
        if product['availability']!='blocked':
            prices=product.get('prices')
            if not isinstance(prices,dict) or prices.get('currency')!='USD':raise ValueError('SOURCE_PRICE_INVALID')
            values=[prices.get('promo_cash_cents'),prices.get('pvp_card_cents')]
            if any(type(value) is not int or not 0<value<=9007199254740991 for value in values) or values[1]<values[0]:
                raise ValueError('SOURCE_PRICE_INVALID')
    return data

def same_source(a,b):
    # Intentionally no private fingerprint, identity array or snapshot on disk.
    def equal(x,y):
        if type(x) is not type(y):return False
        if isinstance(x,dict):return x.keys()==y.keys() and all(equal(x[key],y[key]) for key in x)
        if isinstance(x,list):return len(x)==len(y) and all(equal(u,v) for u,v in zip(x,y))
        return x==y
    return equal({k:v for k,v in a.items() if k!='published_at'},{k:v for k,v in b.items() if k!='published_at'})

def closed_health(health,expected_tester=None,expected_release=None):
    if health.get('ok') is not True or health.get('pilot') is not True or health.get('meta_ingress_enabled') is not False:
        raise ValueError('SOURCE_HEALTH_OR_INGRESS_INVALID')
    if (type(health.get('messenger_outbound')) is not bool or not isinstance(health.get('release'),str) or
        not re.fullmatch(r'[A-Za-z0-9_.-]{1,160}',health['release'])):
        raise ValueError('SOURCE_HEALTH_INVALID')
    if expected_tester is not None and health['messenger_outbound']!=expected_tester:raise ValueError('SOURCE_TESTER_TRANSPORT_CHANGED')
    if expected_release is not None and health['release']!=expected_release:raise ValueError('SOURCE_RELEASE_CHANGED')
    return health

def tester_scope(get_json,enabled):
    messaging=get_json('/messenger/status');seller=get_json('/messenger/seller/status')
    if (messaging.get('mode')!='development-only' or messaging.get('reception_enabled') is not False or
        messaging.get('outbound_enabled') is not enabled or seller.get('mode')!='authorized-testers-only' or
        seller.get('enabled') is not enabled or seller.get('live_customers_enabled') is not False):
        raise ValueError('SOURCE_TESTER_SCOPE_CHANGED')

def source_update_lease():
    try:
        import processing_lease
        path=processing_lease.location()
        if path.stat().st_size>4096:raise ValueError()
        return json.loads(path.read_text())
    except (ImportError,OSError,ValueError):raise ValueError('SOURCE_UPDATE_LEASE_REQUIRED') from None

def select_source(compiled,current,config,environ,lease=None,now=None):
    """Code-only always preserves live data, even if a compiled date is newer."""
    validate_source(current)
    expected=environ.get('CENTRAL_EXPECTED_SOURCE_SHA256','')
    rollback=config.get('source_rollback_confirmed') is True
    if not expected and not rollback:return current,'preserve_current'
    validate_source(compiled)
    if expected and rollback:raise ValueError('SOURCE_UPDATE_AND_ROLLBACK_CONFLICT')
    if rollback:
        if (config.get('rollback_source_sha256')!=compiled['source']['sha256'] or
            environ.get('CENTRAL_ROLLBACK_EXPECTED_CURRENT_SHA256')!=current['source']['sha256']):
            raise ValueError('SOURCE_ROLLBACK_NOT_PINNED')
        return compiled,'explicit_rollback'
    if not re.fullmatch(r'[a-f0-9]{64}',expected) or expected!=compiled['source']['sha256']:
        raise ValueError('SOURCE_UPDATE_SHA_MISMATCH')
    if (not isinstance(lease,dict) or lease.get('sha256')!=expected or
        not isinstance(lease.get('lease_token'),str) or
        not re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}',lease['lease_token'])):
        raise ValueError('SOURCE_UPDATE_LEASE_REQUIRED')
    if expected==current['source']['sha256']:
        if not same_source(compiled,current):raise ValueError('SOURCE_UPDATE_SAME_SHA_DIFFERENT_BODY')
        return current,'validated_source_already_current'
    if source_time(compiled['source']['generated_at'])<=source_time(current['source']['generated_at']):
        raise ValueError('SOURCE_UPDATE_MUST_ADVANCE_GENERATION')
    now=now or datetime.now(timezone.utc)
    generated=source_time(compiled['source']['generated_at'])
    if source_time(compiled['expires_at'])<now or generated>now+timedelta(minutes=5):raise ValueError('SOURCE_UPDATE_NOT_FRESH')
    if generated.astimezone(timezone(timedelta(hours=-5))).date().isoformat()!=compiled['source']['cut_date']:
        raise ValueError('SOURCE_UPDATE_CUT_DATE_MISMATCH')
    if (compiled['source'].get('cut_date_evidence') not in {'593_matching_created_modified','report_heading_and_export_timestamp','legacy_filename_and_export_timestamp'} or
        compiled['source'].get('mapping')!={'sku':'D','name':'C','availability':'B>0','promo_cash':'Q','pvp_card':'X+Y'}):
        raise ValueError('SOURCE_UPDATE_VALIDATION_EVIDENCE_REQUIRED')
    return compiled,'validated_source_update'

def capture_source(compiled,config,environ,get_json=private_worker_json,lease=None):
    before=closed_health(get_json('/health'))
    tester_scope(get_json,before['messenger_outbound'])
    current=validate_source(get_json('/commercial/catalog'))
    closed_health(get_json('/health'),before['messenger_outbound'],before['release'])
    if environ.get('CENTRAL_EXPECTED_SOURCE_SHA256') and lease is None:lease=source_update_lease()
    selected,mode=select_source(compiled,current,config,environ,lease)
    return {'current':current,'selected':selected,'health':before,'mode':mode}

def upload_preserving_source(api,body,ctype,capture,expected_release,get_json=private_worker_json,sleep=time.sleep,before_put=None):
    if not re.fullmatch(r'[A-Za-z0-9_.-]{1,160}',expected_release or ''):raise ValueError('SOURCE_EXPECTED_RELEASE_REQUIRED')
    enabled=capture['health']['messenger_outbound']
    # Recheck immediately before the single code PUT. Concurrent ingestion aborts.
    closed_health(get_json('/health'),enabled,capture['health']['release'])
    if not same_source(validate_source(get_json('/commercial/catalog')),capture['current']):
        raise ValueError('SOURCE_CHANGED_BEFORE_UPLOAD')
    tester_scope(get_json,enabled)
    if before_put is not None:before_put()
    api.call(SCRIPT,'PUT',body,ctype)
    # No retry of PUT. Data-only ingestion can retain the same code release, so
    # accept propagation only when the complete selected source also arrives.
    for attempt in range(1,13):
        health=closed_health(get_json('/health'),enabled)
        if health['release']==expected_release:
            tester_scope(get_json,enabled)
            actual=validate_source(get_json('/commercial/catalog'))
            if same_source(actual,capture['selected']):
                closed_health(get_json('/health'),enabled,expected_release)
                break
            if capture['mode'] not in {'validated_source_update','explicit_rollback'} or not same_source(actual,capture['current']):
                raise RuntimeError('SOURCE_FULL_COMPARISON_FAILED; private values withheld')
        if attempt==12:raise RuntimeError('SOURCE_RELEASE_OR_DATA_PROPAGATION_FAILED; no repeated upload')
        sleep(2)
    return {'policy':'preserve-current-or-explicit-validated-update','mode':capture['mode'],
            'full_comparison_in_deployer_memory':True,'equal_except_published_at':True,
            'original_expiry_preserved':True,'private_body_recorded':False,'private_identity_fingerprint_recorded':False,
            'tester_transport_enabled':enabled,'general_reception_enabled':False,'health_attempts':attempt}
def permitted_request(path,method):
    allowed={(SCRIPT+'/settings','GET'),(SCRIPT+'/tails','GET'),(SCRIPT+'/tails','POST'),(SCRIPT,'PUT'),(SCRIPT+'/secrets','PUT')}
    if method=='DELETE' and re.fullmatch(re.escape(SCRIPT)+r'/tails/[a-f0-9]{32}',path):return
    if (path,method) not in allowed: raise ValueError('Operation outside isolated Worker scope')
class API:
    def __init__(self,account,token):self.base=f'https://api.cloudflare.com/client/v4/accounts/{account}';self.token=token
    def call(self,path,method='GET',data=None,content_type='application/json'):
        permitted_request(path,method)
        payload=data if isinstance(data,bytes) else json.dumps(data).encode() if data is not None else None
        req=urllib.request.Request(self.base+path,data=payload,method=method,headers={'Authorization':'Bearer '+self.token,'Content-Type':content_type})
        try:
            with urllib.request.urlopen(req,timeout=45) as r: body=json.load(r)
        except urllib.error.HTTPError as e:
            try: codes=[x.get('code') for x in json.loads(e.read(16000)).get('errors',[]) if isinstance(x.get('code'),int)]
            except Exception:codes=[]
            raise RuntimeError(f'Worker request failed (HTTP {e.code}, error_codes={codes}); response values withheld; no permission broadening performed.') from None
        if body.get('success') is not True: raise RuntimeError('Worker request rejected; response body withheld')
        return body.get('result')
def multipart(metadata,files):
    boundary='codex-'+secrets.token_hex(16);parts=[]
    for name,ctype,body in [('metadata','application/json',json.dumps(metadata).encode()),*files]:
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{name}"\r\nContent-Type: {ctype}\r\n\r\n'.encode()+body+b'\r\n')
    return b''.join(parts)+f'--{boundary}--\r\n'.encode(),'multipart/form-data; boundary='+boundary
def effective_settings(environ,config):
    settings=dict(environ)
    if not settings.get('CLOUDFLARE_PILOT_URL'):
        settings['CLOUDFLARE_PILOT_URL']=config.get('url_publica','')
    return settings
def connection_settings(environ):
    missing=[]
    if environ.get('CF_FREE_ONLY_CONFIRMED')!='true': missing.append('CF_FREE_ONLY_CONFIRMED')
    if not re.fullmatch(r'[a-f0-9]{32}',environ.get('CLOUDFLARE_ACCOUNT_ID','')): missing.append('CLOUDFLARE_ACCOUNT_ID')
    if not environ.get('CLOUDFLARE_API_TOKEN'): missing.append('CLOUDFLARE_API_TOKEN')
    if len(environ.get('PILOT_TOKEN',''))<32: missing.append('PILOT_TOKEN')
    if not re.fullmatch(r'https://'+re.escape(WORKER)+r'\.[a-z0-9-]+\.workers\.dev',environ.get('CLOUDFLARE_PILOT_URL','')): missing.append('CLOUDFLARE_PILOT_URL')
    return missing
def validate_meta_settings(environ):
    verify=environ.get('META_VERIFY_TOKEN','').strip()
    if verify and len(verify)<32:raise ValueError('META_VERIFY_TOKEN must have at least 32 characters')
    testers=environ.get('META_TEST_SENDER_IDS','').strip()
    if testers:
        ids=[s.strip() for s in testers.split(',')]
        if len(ids)>20 or any(not re.fullmatch(r'[0-9]{1,32}',s) for s in ids):raise ValueError('META_TEST_SENDER_IDS must contain at most 20 numeric PSIDs')
def check_connection(api):
    settings=api.call(SCRIPT+'/settings')
    if not isinstance(settings,dict): raise ValueError('Pilot settings could not be verified')
    # Avoid discarding or inheriting production bindings from an unexpected Worker.
    for b in settings.get('bindings',[]):
        if b.get('name') not in {'AI','LIVE_DATA','FREE_TIER_VERIFIED','PILOT_TOKEN','PILOT_RELEASE','META_APP_SECRET','META_VERIFY_TOKEN','META_PAGE_ID','META_TEST_SENDER_IDS','META_MODE','MESSENGER_TEST_INBOX','META_INGRESS_ENABLED','META_PAGE_ACCESS_TOKEN','META_APP_ID','ALEX_ENABLED','CATALOG_FIRST','COMMERCIAL_ACTIONS_TOKEN'} or b.get('type') not in {'ai','plain_text','secret_text','durable_object_namespace'}:
            raise ValueError('Unexpected existing binding; review isolated pilot before upload')
    return settings

def worker_metadata(config=None):
    bindings=[{'type':'ai','name':'AI'},{'type':'plain_text','name':'LIVE_DATA','text':'true'},{'type':'plain_text','name':'FREE_TIER_VERIFIED','text':'true'},{'type':'plain_text','name':'PILOT_RELEASE','text':os.environ.get('PILOT_DEPLOY_RELEASE') or os.environ.get('GITHUB_SHA','local-unreleased')},{'type':'plain_text','name':'META_MODE','text':'development-only'},{'type':'plain_text','name':'META_INGRESS_ENABLED','text':'false'},{'type':'durable_object_namespace','name':'MESSENGER_TEST_INBOX','class_name':'MessengerTestInbox'}]
    bindings.append({'type':'plain_text','name':'ALEX_ENABLED','text':'true' if (config or {}).get('alex_generativo') is True else 'false'})
    bindings.append({'type':'plain_text','name':'CATALOG_FIRST','text':'true' if (config or {}).get('catalogo_primero') is True else 'false'})
    page=(os.environ.get('META_PAGE_ID','') or (config or {}).get('meta_page_id','')).strip()
    if page:
        if not re.fullmatch(r'[0-9]+',page):raise ValueError('META_PAGE_ID must be a numeric Page ID')
        bindings.append({'type':'plain_text','name':'META_PAGE_ID','text':page})
    if os.environ.get('META_APP_ID'):
        if not re.fullmatch(r'[0-9]+',os.environ['META_APP_ID']):raise ValueError('META_APP_ID must be numeric')
        bindings.append({'type':'plain_text','name':'META_APP_ID','text':os.environ['META_APP_ID']})
    return {'main_module':'worker.mjs','compatibility_date':'2026-10-01','bindings':bindings,'keep_bindings':['secret_text','plain_text'],'exports':{'MessengerTestInbox':{'type':'durable-object','storage':'sqlite'}},'observability':{'enabled':False}}
def report_connection(result):
    path=ROOT/'generated/fase2/connection.json';path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('ready='+str(result['ready']).lower()+'\n')
def reception_settings(settings):
    bindings={b['name']:b for b in settings.get('bindings',[])}
    observations=settings.get('observability') or {}
    logs=observations.get('logs') or {}
    return {'observability_enabled':observations.get('enabled'),'logs_enabled':logs.get('enabled'),'invocation_logs_enabled':logs.get('invocation_logs'),
            'meta_ingress_enabled':bindings.get('META_INGRESS_ENABLED',{}).get('text')=='true',
            'development_only':bindings.get('META_MODE',{}).get('text')=='development-only',
            'meta_app_secret_binding_present':'META_APP_SECRET' in bindings,
            'meta_verify_token_binding_present':'META_VERIFY_TOKEN' in bindings,
            'test_sender_allowlist_binding_present':'META_TEST_SENDER_IDS' in bindings,
            'event_http_status':None,'event_signature_verified':None,'event_discard_verified':None,
            'scope':'current_configuration_only_not_a_Meta_event_receipt'}
def tail_read_status(api):
    try:
        result=api.call(SCRIPT+'/tails')
        return {'list_access':True,'active_sessions':len(result) if isinstance(result,list) else None,'historical_invocations':False,'scope':'live_tail_session_metadata_only'}
    except RuntimeError:
        return {'list_access':False,'historical_invocations':False,'scope':'existing_token_only_no_permission_expansion'}
def sync_meta_verify_token(api,settings,url,token):
    bindings={b['name']:b for b in settings.get('bindings',[])}
    if bindings.get('META_INGRESS_ENABLED',{}).get('text')!='false' or bindings.get('META_MODE',{}).get('text')!='development-only':
        raise ValueError('Token rotation requires closed development-only Messenger ingress')
    if len(token.strip())<32:raise ValueError('META_VERIFY_TOKEN must have at least 32 characters')
    # Secret values are opaque: never strip or otherwise change the GitHub value.
    api.call(SCRIPT+'/secrets','PUT',{'name':'META_VERIFY_TOKEN','text':token,'type':'secret_text'})
    def challenge_request(candidate,challenge):
        target=url+'/webhooks/meta?'+urllib.parse.urlencode({'hub.mode':'subscribe','hub.verify_token':candidate,'hub.challenge':challenge})
        try:
            with urllib.request.urlopen(urllib.request.Request(target,headers={'Cache-Control':'no-cache'}),timeout=10) as response:
                return response.status,response.read(512).decode('utf-8')
        except urllib.error.HTTPError as error:return error.code,error.read(512).decode('utf-8',errors='replace')
        except (urllib.error.URLError,TimeoutError):return 0,''
    challenge='ct-rotation-'+secrets.token_hex(12)
    node_result=None
    for attempt in range(1,16):
        status,body=challenge_request(token,challenge)
        if status==200 and body==challenge:break
        if status==403 and body!='Forbidden':
            # Some intermediaries reject urllib before the Worker. Use the same
            # standards-based Node fetch client as the existing HTTPS pilot tests.
            try:
                child=subprocess.run(['node',str(ROOT/'verify-meta-token.mjs'),url],env={**os.environ,'META_VERIFY_TOKEN':token},capture_output=True,text=True,timeout=180)
                node_result=json.loads(child.stdout)
            except (OSError,ValueError,subprocess.TimeoutExpired):raise RuntimeError('HTTPS client verification failed; URL and secret withheld') from None
            if child.returncode!=0 or node_result.get('passed') is not True or node_result.get('configured_token_http')!=200 or node_result.get('challenge_matches') is not True or node_result.get('wrong_token_http')!=403:
                raise RuntimeError(f"HTTPS challenge not verified (HTTP {node_result.get('configured_token_http',0)}); URL and secret withheld")
            break
        if attempt<15:time.sleep(2)
    else:
        print(json.dumps({'rotation_diagnostic':True,'http':status,'handler_forbidden':body=='Forbidden','github_value_has_outer_whitespace':token!=token.strip()}))
        raise RuntimeError(f'New token challenge failed (HTTP {status}); request URL and secret withheld')
    wrong_status=node_result['wrong_token_http'] if node_result else challenge_request('invalid-'+secrets.token_hex(24),challenge)[0]
    if wrong_status!=403:raise RuntimeError('Incorrect verification token was not rejected; secret withheld')
    result={'worker':WORKER,'url':url+'/webhooks/meta','passed':True,'configured_token_http':200,'challenge_matches':True,'wrong_token_http':403,'attempts':node_result['attempts'] if node_result else attempt,'https_client':'node_fetch' if node_result else 'python_urllib','secret_preserved_exactly':True,'reception_enabled':False,'outbound_enabled':False,'worker_code_changed':False,'paid_services_activated':False}
    path=ROOT/'generated/fase2/meta-token-sync.json';path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
    return result
def main():
    if os.environ.get('GITHUB_REF')!=BRANCH: raise ValueError('Only the isolated pilot branch may connect or deploy')
    check_only=sys.argv[1:]==['--check']
    sync_only=sys.argv[1:]==['--sync-meta-verify-token']
    if sys.argv[1:] and not (check_only or sync_only): raise ValueError('Unsupported argument')
    config=json.loads((ROOT/'activar-cloud.json').read_text())
    if config.get('activar') is True and config.get('sincronizar_meta_verify_token') is True:raise ValueError('Choose code deployment or token rotation, never both')
    if sync_only and config.get('sincronizar_meta_verify_token') is not True:raise ValueError('Token synchronization remains disabled')
    if not (check_only or sync_only) and config.get('activar') is not True: raise ValueError('Activation remains disabled')
    settings=effective_settings(os.environ,config)
    missing=connection_settings(settings)
    if missing:
        if check_only:
            report_connection({'ready':False,'status':'awaiting_github_environment_configuration','missing':missing,'cloud_requests_issued':False});return
        raise ValueError('Missing configuration; no requests issued: '+', '.join(missing))
    validate_meta_settings(os.environ)
    api=API(settings['CLOUDFLARE_ACCOUNT_ID'],settings['CLOUDFLARE_API_TOKEN'])
    existing=check_connection(api)
    if check_only:
        report_connection({'ready':True,'status':'existing_worker_read_check_passed','plan_verification':'owner_dashboard_attestation','resources_created':False,'d1_enabled':False,'messenger_reception_audit':reception_settings(existing),'tail_read_status':tail_read_status(api)});return
    if sync_only:
        sync_meta_verify_token(api,existing,settings['CLOUDFLARE_PILOT_URL'],os.environ.get('META_VERIFY_TOKEN',''));return
    # Preserve the receiver actually live in this Worker, never a repository template.
    from scoped_content import CFClient
    from generic_receiver_guard import preserve_live_receiver
    content_client=CFClient(settings['CLOUDFLARE_ACCOUNT_ID'],settings['CLOUDFLARE_API_TOKEN'])
    metadata=worker_metadata(config);files=[]
    for name in ['worker.mjs','live.mjs','channels.mjs','banner.mjs','commerce.mjs','messenger.mjs','messenger-store.mjs','messenger-control.mjs','messenger-setup.mjs','messenger-graph.mjs','messenger-seller.mjs','alex.mjs','alex-context.mjs','alex-catalog.mjs','central-source.mjs','commercial-reception.mjs','alex-store.mjs','alex-ui.mjs','alex-review.mjs','shared-hub.mjs','marketplace-pilot.mjs']:
        source=(ROOT/name).read_text()
        source=source.replace("import catalog from './generated/catalogo.json' with {type:'json'};","import catalog from './catalog.mjs';")
        source=source.replace("import baseline from './generated/catalogo.json' with {type:'json'};","import baseline from './catalog.mjs';")
        source=source.replace("import policy from './alex-policy.json' with {type:'json'};","import policy from './alex-policy.mjs';")
        source=source.replace("import original from './generated/catalogo.json' with {type:'json'};","import original from './catalog.mjs';")
        source=source.replace("import extra from './generated/alex-productos-extra.json' with {type:'json'};","import extra from './alex-extra.mjs';")
        source=source.replace("import central from './central/current.json' with {type:'json'};","import central from './central-data.mjs';")
        source=source.replace("import enrichment from './central/enrichment.json' with {type:'json'};","import enrichment from './central-enrichment.mjs';")
        source=source.replace("import attestations from './central/source-attestations.json' with {type:'json'};","import attestations from './source-attestations.mjs';")
        source=source.replace("import library from './marketplace-library.json' with {type:'json'};","import library from './marketplace-library.mjs';")
        files.append((name,'application/javascript+module',source.encode()))
    files.append(('catalog.mjs','application/javascript+module',b'export default '+(ROOT/'generated/catalogo.json').read_bytes()+b';\n'))
    files.append(('alex-policy.mjs','application/javascript+module',b'export default '+(ROOT/'alex-policy.json').read_bytes()+b';\n'))
    files.append(('alex-extra.mjs','application/javascript+module',b'export default '+(ROOT/'generated/alex-productos-extra.json').read_bytes()+b';\n'))
    for module,path in [('central-enrichment.mjs','central/enrichment.json'),('source-attestations.mjs','central/source-attestations.json'),('marketplace-library.mjs','marketplace-library.json')]:
        files.append((module,'application/javascript+module',b'export default '+(ROOT/path).read_bytes()+b';\n'))
    try:compiled=json.loads((ROOT/'central/current.json').read_bytes())
    except (ValueError,OSError):raise ValueError('COMPILED_SOURCE_INVALID') from None
    capture=capture_source(compiled,config,os.environ)
    source_record={**capture['selected'],'published_at':datetime.now(timezone.utc).isoformat().replace('+00:00','Z')}
    files.append(('central-data.mjs','application/javascript+module',b'export default '+json.dumps(source_record,ensure_ascii=False,separators=(',',':')).encode()+b';\n'))
    files,verify_live_bundle=preserve_live_receiver(files,content_client,expected_source=capture['current'])
    body,ctype=multipart(metadata,files)
    # Synchronize secrets first. The final mutation uploads the complete code bundle,
    # preventing subsequent secret deployments from restoring an earlier bundle.
    api.call(SCRIPT+'/secrets','PUT',{'name':'PILOT_TOKEN','text':os.environ['PILOT_TOKEN'],'type':'secret_text'})
    for name in ['META_APP_SECRET','META_VERIFY_TOKEN','META_TEST_SENDER_IDS','META_PAGE_ACCESS_TOKEN','COMMERCIAL_ACTIONS_TOKEN']:
        value=os.environ.get(name,'')
        if value:api.call(SCRIPT+'/secrets','PUT',{'name':name,'text':value,'type':'secret_text'})
    release=next(binding['text'] for binding in metadata['bindings'] if binding['name']=='PILOT_RELEASE')
    preservation=upload_preserving_source(api,body,ctype,capture,release,before_put=verify_live_bundle)
    # workers.dev is enabled manually in the panel; no account/subdomain/route changes.
    url=settings['CLOUDFLARE_PILOT_URL']
    path=ROOT/'generated/fase2/deployment.json';path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps({'url':url,'worker':WORKER,'plan_verification':'owner_dashboard_attestation','d1_enabled':False,'real_ai':'pending_smoke_test','source_preservation':preservation},indent=2)+'\n')
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('url='+url+'\n')
    print('Isolated pilot uploaded; HTTPS and real AI must pass smoke test')
if __name__=='__main__':
    try:main()
    except (ValueError,RuntimeError) as e:sys.exit(str(e))
