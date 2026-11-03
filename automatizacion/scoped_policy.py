"""Pure private-source checks. Values stay in caller memory; errors are fixed codes."""
import re,time
from datetime import datetime,timedelta,timezone

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
