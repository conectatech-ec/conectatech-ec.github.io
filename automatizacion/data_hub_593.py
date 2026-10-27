"""Shared, versioned channel handoffs. Preparing an adapter is never a delivery receipt."""
import argparse, copy, hashlib, json, os
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CHANNELS = ('web_catalog', 'webstore', 'alex_messenger', 'signature',
            'pdf_categories', 'meta_commerce', 'google_merchant', 'whatsapp_business')
COMMERCIAL = ('source_name', 'category', 'variant_gb', 'prices', 'availability', 'blocked_reasons')
ENRICHMENT = {'display_name', 'description', 'specifications', 'photo_url', 'photo_sha256',
              'banner_url', 'banner_sha256', 'web_url', 'provenance', 'identity_signature', 'source_name', 'variant_gb'}

def version(data):
    return '593-v1-' + data['source']['sha256']

def identity(product):
    return hashlib.sha256(json.dumps({k: product.get(k) for k in
        ('source_name', 'variant_gb')}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()

def signature(data):
    """Compare authoritative business fields, independent of publication or enrichment."""
    rows = [{ 'sku': p['sku'], **{k: p.get(k) for k in COMMERCIAL}}
            for p in sorted(data['products'], key=lambda p: p['sku'])]
    return hashlib.sha256(json.dumps(rows, sort_keys=True, ensure_ascii=False).encode()).hexdigest()

def changes(data, previous=None):
    before = {p['sku']: p for p in (previous or {}).get('products', [])}
    after = {p['sku']: p for p in data['products']}
    items = []
    for sku in sorted(before.keys() | after.keys()):
        old, new = before.get(sku), after.get(sku)
        fields = ['added' if old is None else 'removed'] if old is None or new is None else [
            k for k in COMMERCIAL if old.get(k) != new.get(k)]
        if fields:
            items.append({'sku': sku, 'fields': fields})
    affected = [i['sku'] for i in items]
    categories = sorted({p.get('category') or 'Sin categoría'
        for i in items for p in (before.get(i['sku']), after.get(i['sku'])) if p})
    # These are invalidation/preparation instructions, never permission to render or publish.
    return {'source_version': version(data), 'baseline_available': previous is not None,
            'changed_sku': affected, 'changes': items,
            'signature': {'invalidate_or_regenerate_only': affected, 'executed': False},
            'pdf_categories': {'invalidate_or_regenerate_only': categories, 'executed': False},
            'production_publication_authorized': False}

def complementary(data, existing=None, approved=None):
    existing = existing or {'schema': 'conectatech.enrichment.v1', 'products': {}}
    result = {'schema': 'conectatech.enrichment.v1', 'products': {}}
    for p in data['products']:
        old = existing.get('products', {}).get(p['sku'], {})
        if set(old) - ENRICHMENT:
            raise ValueError('ENRICHMENT_CANNOT_OVERRIDE_COMMERCIAL_FIELDS')
        if old.get('identity_signature') not in (None, identity(p)):
            old = {}  # A changed variant must never inherit an old photograph/ficha.
        if any('IDENTITY' in r or 'VARIANT' in r for r in p['blocked_reasons']):
            continue
        entry = copy.deepcopy(old)
        entry['identity_signature'] = identity(p)
        web = p.get('web', {})
        if web.get('url'): entry.setdefault('web_url', web['url'])
        if web.get('image_url'): entry.setdefault('photo_url', web['image_url'])
        if p.get('name') != p['source_name']: entry.setdefault('display_name', p['name'])
        a = (approved or {}).get(p['sku'], {})
        for target, source in {'display_name':'public_name', 'description':'descripcion',
                'specifications':'caracteristicas', 'photo_url':'foto', 'photo_sha256':'foto_sha256',
                'banner_url':'banner', 'banner_sha256':'banner_sha256'}.items():
            if a.get(source): entry.setdefault(target, a[source])
        entry.setdefault('provenance', 'Existing approved catalogue/media; no 593 financial override')
        result['products'][p['sku']] = entry
    return result

def hub(data, plan, receipts=None, now=None):
    now = now or datetime.now(timezone.utc)
    fresh = datetime.fromisoformat(data['expires_at'].replace('Z', '+00:00')) >= now
    states = {}
    for channel in CHANNELS:
        receipt = (receipts or {}).get(channel)
        verified = bool(receipt and receipt.get('version') == version(data)
                        and receipt.get('commercial_signature') == signature(data)
                        and receipt.get('received') is True and receipt.get('processed') is True
                        and receipt.get('evidence') and receipt.get('verified_at'))
        states[channel] = {'expected_version': version(data),
            'verified_version': receipt.get('version') if verified else None,
            'state': 'verified_source_expired' if verified and not fresh else
                     'verified' if verified else 'prepared_not_delivered',
            'receipt': receipt if verified else None,
            'pending': [] if verified else ['destination_receipt_required'],
            'production_publish_enabled': False}
    pending = [k for k, v in states.items() if v['state'] != 'verified']
    return {'schema':'conectatech.data_hub.v1', 'version':version(data),
        'source_sha256':data['source']['sha256'], 'commercial_signature':signature(data),
        'cut_date':data['source']['cut_date'], 'generated_at':data['source']['generated_at'],
        'validated_at':data['normalized_at'], 'expires_at':data['expires_at'], 'fresh':fresh,
        'commercial_source':'current.json', 'official_name_field':'source_name',
        'active_source_endpoint':'https://conectatech-comercial-piloto.conectatech-ecu.workers.dev/commercial/catalog',
        'active_source_requires_existing_private_auth':True,
        'repository_snapshot_is_not_future_live_pointer':True,
        'enrichment':'enrichment.json', 'changes':'changes.json',
        'channels':states, 'changed_sku_count':len(plan['changed_sku']),
        'alerts':[{'channel':c, 'code':'DESTINATION_NOT_CURRENT'} for c in pending],
        'fully_synchronized':not pending, 'fully_automated':False,
        'future_channels_contract':{'canonical':'current.json', 'enrichment':'enrichment.json',
            'must_verify':['version','commercial_signature','received','processed','evidence','verified_at']}}

def write_hub(out, data, previous=None, existing_enrichment=None, receipts=None, approved=None):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    plan = changes(data, previous)
    outputs = {'changes.json':plan, 'enrichment.json':complementary(data, existing_enrichment, approved),
               'hub.json':hub(data, plan, receipts)}
    for name, obj in outputs.items():
        (out/name).write_text(json.dumps(obj, ensure_ascii=False, indent=2)+'\n')
    return outputs['hub.json']

def verify_alex(out):
    """Existing PILOT_TOKEN, read-only HTTPS; not a fabricated Messenger delivery."""
    from process_pending_593 import request
    out = Path(out); data = json.loads((out/'current.json').read_text())
    with request('/commercial/catalog/status') as r: state = json.load(r)
    with request('/commercial/catalog') as r: runtime = json.load(r)
    matches = (state.get('current') is True and state.get('source_sha256') == data['source']['sha256']
               and signature(runtime) == signature(data))
    receipt = {'version':version(runtime), 'commercial_signature':signature(runtime),
        'received':matches, 'processed':matches, 'verified_at':datetime.now(timezone.utc).isoformat(),
        'evidence':'Authenticated HTTPS /commercial/catalog and /commercial/catalog/status',
        'scope':'Alex pilot loaded commercial source; not a Messenger visual receipt'}
    plan = json.loads((out/'changes.json').read_text())
    manifest = hub(data, plan, {'alex_messenger':receipt})
    (out/'hub.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        lines=['Data Hub 593: '+version(data), '', '| Destino | Estado |', '|---|---|']
        lines += ['| '+c+' | '+s['state']+' |' for c,s in manifest['channels'].items()]
        lines += ['', 'La verificación de Alex acredita su fuente cargada por HTTPS. No acredita recepción visual en Messenger.',
                  'Publicación de producción desactivada. Automatización integral pendiente.']
        with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as summary: summary.write('\n'.join(lines)+'\n')
    print(json.dumps({'hub_version':version(data), 'alex_source_verified':matches,
        'channels_pending':len(manifest['alerts']), 'fully_automated':False,
        'receipt':receipt}))
    if not matches: raise RuntimeError('ALEX_SOURCE_NOT_CURRENT')

if __name__ == '__main__':
    a=argparse.ArgumentParser(); a.add_argument('--out', default=str(ROOT/'central'))
    a.add_argument('--verify-alex', action='store_true'); args=a.parse_args()
    if args.verify_alex: verify_alex(args.out)
    else:
        folder=Path(args.out); data=json.loads((folder/'current.json').read_text())
        old=json.loads((folder/'enrichment.json').read_text()) if (folder/'enrichment.json').exists() else None
        write_hub(folder,data,existing_enrichment=old)
