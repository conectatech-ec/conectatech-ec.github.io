"""GET-only audit of an already-public fallback against the deployed catalog.

No manifest or identity hashes. Source values are compared directly in memory.
The report contains public SKU IDs and the public baseline's own metadata only.
"""
import json
import os
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PUBLIC_CUT_URL = 'https://raw.githubusercontent.com/conectatech-ec/conectatech-ec.github.io/main/datos-593/corte-comercial-publico-validado.json'
EXPECTED_PUBLIC_SHA = '265843da6b15038d055535ecdd9ed0b421c947caad27e52c584f16e8bbc6fc80'
EXPECTED_PUBLIC_CUT = '2026-11-02'
EXPECTED_PUBLIC_COUNT = 1170
LIMIT = 2_000_000
SHA = re.compile(r'[a-f0-9]{64}\Z')
SKU = re.compile(r'[A-Z0-9_-]{3,40}\Z')


def fail(code):
    raise ValueError(code)


def stamp(value):
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if parsed.tzinfo is None:
            fail('AUDIT_TIMESTAMP')
        return parsed.astimezone(timezone.utc).isoformat()
    except (AttributeError, TypeError, ValueError):
        fail('AUDIT_TIMESTAMP')


def decode_response(response):
    try:
        raw = response.read(LIMIT + 1)
        if len(raw) > LIMIT:
            fail('AUDIT_RESPONSE_SIZE')
        data = json.loads(raw)
    except ValueError as error:
        if str(error) == 'AUDIT_RESPONSE_SIZE':
            raise
        fail('AUDIT_JSON')
    if not isinstance(data, dict):
        fail('AUDIT_SCHEMA')
    return data


def get_private(request, path):
    with request(path) as response:  # No body argument: existing transport emits GET.
        return decode_response(response)


def source_key(source, count):
    sha, date = source.get('sha256'), source.get('cut_date')
    if not isinstance(sha, str) or not SHA.fullmatch(sha):
        fail('AUDIT_SOURCE_SCHEMA')
    if not isinstance(date, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date):
        fail('AUDIT_SOURCE_SCHEMA')
    if type(count) is not int or not 0 < count <= 5000:
        fail('AUDIT_SOURCE_SCHEMA')
    return {'sha256': sha, 'cut_date': date, 'generated_at': stamp(source.get('generated_at')), 'products': count}


def status_key(status):
    nested = status.get('source') or {}
    if not isinstance(nested, dict):
        fail('AUDIT_STATUS_SCHEMA')
    source = {'sha256': status.get('source_sha256', nested.get('sha256')),
              'cut_date': status.get('cut_date', nested.get('cut_date')),
              'generated_at': status.get('generated_at', nested.get('generated_at'))}
    return source_key(source, status.get('products', status.get('product_count')))


def catalog_rows(data):
    rows = data.get('products')
    if data.get('schema') != 'conectatech.commercial.v1' or not isinstance(rows, list) or not 0 < len(rows) <= 5000:
        fail('AUDIT_CATALOG_SCHEMA')
    result = {}
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get('sku'), str) or not SKU.fullmatch(row['sku']):
            fail('AUDIT_CATALOG_SCHEMA')
        if row['sku'] in result:
            fail('AUDIT_DUPLICATE_SKU')
        result[row['sku']] = row
    return result


def identity_value(row):
    name, variants = row.get('source_name'), row.get('variant_gb')
    if not isinstance(name, str) or not name or len(name) > 250:
        fail('AUDIT_IDENTITY_SCHEMA')
    if not isinstance(variants, list) or any(type(n) is not int or n < 0 for n in variants):
        fail('AUDIT_IDENTITY_SCHEMA')
    return row['sku'], name, variants


def audit_private_source(request, public_fallback, public_cut, now=None):
    now = now or datetime.now(timezone.utc)
    if public_cut.get('sha256_original') != EXPECTED_PUBLIC_SHA or public_cut.get('fecha_corte') != EXPECTED_PUBLIC_CUT:
        fail('AUDIT_PUBLIC_CUT_CHANGED')
    scope = public_cut.get('productos')
    if not isinstance(scope, dict) or len(scope) != EXPECTED_PUBLIC_COUNT or public_cut.get('cantidad_sku_web') != EXPECTED_PUBLIC_COUNT:
        fail('AUDIT_PUBLIC_COVERAGE')
    published = catalog_rows(public_fallback)
    if not set(scope) <= set(published):
        fail('AUDIT_PUBLIC_SKU_NOT_IN_BASELINE')
    baseline = source_key(public_fallback.get('source') or {}, len(published))
    expected_identities = {sku: identity_value(published[sku]) for sku in scope}

    before_raw = get_private(request, '/commercial/catalog/status')
    before = status_key(before_raw)
    if before != baseline:
        fail('AUDIT_PRIVATE_BASE_MISMATCH')  # Never include observed private metadata.
    catalog = get_private(request, '/commercial/catalog')
    after_raw = get_private(request, '/commercial/catalog/status')
    after = status_key(after_raw)
    if before != after:
        fail('AUDIT_PRIVATE_SOURCE_CHANGED')
    # These values only guard stability; they are never included in the output.
    for key in ('normalized_at', 'published_at', 'expires_at'):
        if before_raw.get(key) != after_raw.get(key):
            fail('AUDIT_PRIVATE_SOURCE_CHANGED')
        if key in before_raw and before_raw[key] != catalog.get(key):
            fail('AUDIT_CATALOG_STATUS_MISMATCH')
    private_rows = catalog_rows(catalog)
    if source_key(catalog.get('source') or {}, len(private_rows)) != baseline:
        fail('AUDIT_CATALOG_STATUS_MISMATCH')
    matched, mismatch, missing, invalid = [], [], [], []
    for sku in sorted(scope):
        row = private_rows.get(sku)
        if row is None:
            missing.append(sku)
            continue
        try:
            actual = identity_value(row)
        except ValueError:
            invalid.append(sku)
            continue
        (matched if actual == expected_identities[sku] else mismatch).append(sku)
    return {'schema': 'conectatech.public_baseline_identity_audit.v2', 'audit_only': True,
            'at': now.isoformat(), 'expected_public_source_sha256': EXPECTED_PUBLIC_SHA,
            'expected_public_cut_date': EXPECTED_PUBLIC_CUT, 'public_baseline': baseline,
            'public_sku_count': len(scope), 'matched_public_skus': matched,
            'mismatched_public_skus': mismatch, 'missing_public_skus': missing,
            'invalid_public_skus': invalid, 'baseline_metadata_matches': True,
            'identity_values_persisted': False, 'private_values_exported': False,
            'private_read_requests': 3, 'write_requests': 0, 'ai_calls': 0,
            'customer_messages': 0}


def main():
    output = os.environ.get('GITHUB_OUTPUT')
    if output:
        with open(output, 'a') as stream:
            stream.write('audit_only=true\nready=false\n')
    try:
        from process_pending_593 import request
        public_fallback = json.loads((ROOT / 'central/current.json').read_text())
        public_request = urllib.request.Request(PUBLIC_CUT_URL, headers={'Accept': 'application/json'})
        with urllib.request.urlopen(public_request, timeout=30) as response:
            public_cut = decode_response(response)
        result = audit_private_source(request, public_fallback, public_cut)
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and re.fullmatch(r'AUDIT_[A-Z_]+', str(error)) else 'AUDIT_READ_FAILED'
        result = {'audit_only': True, 'passed': False, 'error_code': code,
                  'private_values_exported': False, 'write_requests': 0,
                  'ai_calls': 0, 'customer_messages': 0}
    else:
        result['passed'] = True
    target = ROOT / 'generated/fase2/central-identity-audit.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))
    if not result['passed']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
