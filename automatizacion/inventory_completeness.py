"""Reject suspect full exports before any inventory or channel is promoted."""
import re
from collections import Counter
from decimal import Decimal, InvalidOperation

MIN_UNIQUE_PRODUCTS = 500
MASS_UNAVAILABLE_LIMIT = 500


class IncompleteReport(ValueError):
    def __init__(self, code, metrics):
        super().__init__(code)
        self.metrics = metrics


def guard_rows(rows, baseline, previous=None):
    # Services, empty codes and duplicated lines cannot inflate the product count.
    counts = Counter(r['values']['D'] for r in rows
               if r['values'].get('F') == 'PRODUCTO'
               and re.fullmatch(r'[A-Z0-9_-]{3,40}', r['values'].get('D', '')))
    present = set(counts)
    unique_products = sum(count == 1 for count in counts.values())
    central = {p['sku'] for p in (previous or {}).get('products', [])
               if 'ABSENT_LATEST_REPORT' not in p.get('blocked_reasons', [])}
    reference = set(baseline) | central
    metrics = {'unique_products': unique_products, 'minimum_products': MIN_UNIQUE_PRODUCTS,
               'reference_products': len(reference),
               'missing_products': len(reference - present)}
    if unique_products < MIN_UNIQUE_PRODUCTS:
        raise IncompleteReport('REPORT_BELOW_MINIMUM_PRODUCTS', metrics)
    # Preserve the existing 90% safeguard, using identities rather than row totals.
    if len(reference & present) * 10 < len(reference) * 9:
        raise IncompleteReport('INCOMPLETE_FULL_REPORT', metrics)
    return metrics


def guard_impact(products, baseline, previous=None):
    after = {p['sku']: p for p in products}
    central = {p['sku']: p for p in (previous or {}).get('products', [])
               if 'ABSENT_LATEST_REPORT' not in p.get('blocked_reasons', [])}
    reference = set(baseline) | set(central)
    present = {p['sku'] for p in products
               if 'ABSENT_LATEST_REPORT' not in p.get('blocked_reasons', [])}
    at_risk = reference - present
    for sku in reference:
        was_available = central.get(sku, {}).get('availability') == 'in_stock'
        try:
            was_available |= Decimal(str(baseline.get(sku, {}).get('stock', 0))) > 0
        except InvalidOperation:
            pass
        if was_available and after.get(sku, {}).get('availability') != 'in_stock':
            at_risk.add(sku)
    metrics = {'missing_or_newly_unavailable': len(at_risk),
               'mass_unavailable_limit': MASS_UNAVAILABLE_LIMIT}
    if len(at_risk) >= MASS_UNAVAILABLE_LIMIT:
        raise IncompleteReport('REPORT_MASS_UNAVAILABILITY', metrics)
    return metrics
