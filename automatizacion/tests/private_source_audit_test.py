import copy
import io
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import audit_private_source as audit

NOW = datetime(2026, 11, 2, 23, 0, tzinfo=timezone.utc)


class PrivateSourceAuditV2(unittest.TestCase):
    def setUp(self):
        self.limit = patch.object(audit, 'EXPECTED_PUBLIC_COUNT', 1)
        self.limit.start();self.addCleanup(self.limit.stop)

    def fixture(self):
        row = {'sku': 'TELF017', 'source_name': 'Already public synthetic name ñ',
               'variant_gb': [128], 'prices': {'cash': 12345}, 'stock': 987}
        public = {'schema': 'conectatech.commercial.v1', 'source': {'sha256': 'a'*64,
                  'cut_date': '2026-10-21', 'generated_at': '2026-10-22T00:00:00Z'}, 'products': [row]}
        status = {'source_sha256': 'a'*64, 'cut_date': '2026-10-21',
                  'generated_at': '2026-10-22T00:00:00Z', 'products': 1}
        cut = {'sha256_original': audit.EXPECTED_PUBLIC_SHA, 'fecha_corte': audit.EXPECTED_PUBLIC_CUT,
               'cantidad_sku_web': 1, 'productos': {'TELF017': {'stock': 1}}}
        return public, status, cut

    def transport(self, catalog, status, after=None):
        calls=[];payloads=[status,catalog,status if after is None else after]
        def request(path,body=None):
            self.assertIsNone(body);calls.append(path)
            return io.BytesIO(json.dumps(payloads[len(calls)-1]).encode())
        return request,calls

    def test_only_gets_report_contains_no_identity_hash_names_prices_stock(self):
        public,status,cut=self.fixture();request,calls=self.transport(copy.deepcopy(public),status)
        r=audit.audit_private_source(request,public,cut,NOW)
        self.assertEqual(r['matched_public_skus'],['TELF017'])
        self.assertEqual(calls,['/commercial/catalog/status','/commercial/catalog','/commercial/catalog/status'])
        encoded=json.dumps(r)
        for value in [public['products'][0]['source_name'],'12345','987','"prices"','"stock"','variant_gb']:
            self.assertNotIn(value,encoded)
        self.assertEqual(r['write_requests'],0)

    def test_private_identity_mismatch_is_public_sku_only(self):
        public,status,cut=self.fixture();private=copy.deepcopy(public);private['products'][0]['source_name']='Secret changed name'
        request,_=self.transport(private,status);r=audit.audit_private_source(request,public,cut,NOW)
        self.assertEqual(r['mismatched_public_skus'],['TELF017']);self.assertEqual(r['matched_public_skus'],[])
        self.assertNotIn('Secret changed name',json.dumps(r))

    def test_changed_private_metadata_fails_without_disclosing_it(self):
        public,status,cut=self.fixture();bad={**status,'source_sha256':'b'*64}
        request,calls=self.transport(public,bad)
        with self.assertRaisesRegex(ValueError,'^AUDIT_PRIVATE_BASE_MISMATCH$'):audit.audit_private_source(request,public,cut,NOW)
        self.assertEqual(len(calls),1)
        request,_=self.transport(public,status,bad)
        with self.assertRaisesRegex(ValueError,'^AUDIT_PRIVATE_SOURCE_CHANGED$'):audit.audit_private_source(request,public,cut,NOW)

    def test_changed_public_cut_or_duplicate_private_sku_stop(self):
        public,status,cut=self.fixture();badcut={**cut,'sha256_original':'c'*64};request,calls=self.transport(public,status)
        with self.assertRaisesRegex(ValueError,'AUDIT_PUBLIC_CUT_CHANGED'):audit.audit_private_source(request,public,badcut,NOW)
        self.assertEqual(calls,[])
        public['products'].append(copy.deepcopy(public['products'][0]));status['products']=2;request,_=self.transport(public,status)
        with self.assertRaisesRegex(ValueError,'AUDIT_DUPLICATE_SKU'):audit.audit_private_source(request,public,cut,NOW)


if __name__=='__main__':unittest.main()
