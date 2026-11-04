import copy
from datetime import datetime,timezone
from pathlib import Path
import json,sys,unittest
from PIL import Image,ImageChops
HERE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(HERE))
from tema_campana import Campaign,apply_campaign,restore_campaign,CampaignError,CampaignPlacementError,CleanBaseRequired
from emblema_web import tile_from_repository,HEADER_SIZE
CFG=json.loads((HERE/"campana-tematica.json").read_text())
REPO=HERE.parents[2]

class OfficialEmblemTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c=Campaign.from_mapping(CFG)
        cls.tile=tile_from_repository(REPO,cls.c)
    def setUp(self):
        self.base=Image.new("RGBA",(1200,1200),(4,16,33,255))
        # Señales de control: marca, producto, precio y fotografía.
        for xy in ((220,60),(1180,188),(116,200),(600,500),(130,990)):
            self.base.putpixel(xy,(255,220,40,255))
    def apply(self,**kw):
        return apply_campaign(self.base,self.c,generated_at="2026-11-04",repo_root=REPO,**kw)
    def test_official_resource_transparency(self):
        self.assertEqual(self.tile.size,HEADER_SIZE)
        self.assertEqual(self.tile.getpixel((0,0))[3],0)
        self.assertLessEqual(self.tile.getbbox()[3],188)
    def test_only_header_changes_and_input_intact(self):
        before=self.base.tobytes();out,r=self.apply()
        self.assertEqual(self.base.tobytes(),before)
        diff=ImageChops.difference(out,self.base)
        for channel in diff.split():
            box=channel.getbbox()
            if box:self.assertTrue(0<=box[0]<box[2]<=215 and 0<=box[1]<box[3]<=190)
        self.assertEqual(out.crop((0,190,1200,1200)).tobytes(),self.base.crop((0,190,1200,1200)).tobytes())
        self.assertEqual(out.crop((216,0,1200,190)).tobytes(),self.base.crop((216,0,1200,190)).tobytes())
    def test_second_application_is_exact_noop(self):
        first,r=self.apply()
        second,r2=apply_campaign(first,self.c,generated_at="2026-11-20",repo_root=REPO)
        self.assertIs(first,second);self.assertTrue(r2["already_applied"])
    def test_expiry_restores_exact_original(self):
        first,r=self.apply()
        out,record=apply_campaign(first,self.c,generated_at="2026-12-01",clean_base=self.base,repo_root=REPO)
        self.assertIsNone(record);self.assertEqual(out.tobytes(),self.base.tobytes())
    def test_expiry_requires_private_original(self):
        first,r=self.apply()
        with self.assertRaises(CleanBaseRequired):
            apply_campaign(first,self.c,generated_at="2026-12-01")
    def test_last_ecuador_minute_is_inclusive(self):
        self.assertTrue(self.c.active("2026-12-01T04:59:59Z"))
        self.assertFalse(self.c.active("2026-12-01T05:00:00Z"))
    def test_wrong_official_hash_rejected(self):
        c=Campaign.from_mapping(dict(CFG,campaign_asset_sha256="0"*64))
        with self.assertRaises(ValueError):tile_from_repository(REPO,c)
    def test_logo_cannot_be_substituted(self):
        with self.assertRaises(CampaignError):
            Campaign.from_mapping(dict(CFG,campaign_logo="generic.png"))
    def test_collision_isolated(self):
        with self.assertRaises(CampaignPlacementError):
            self.apply(protected_regions=[(80,175,200,210)])
    def test_wrong_size_isolated(self):
        with self.assertRaises(CampaignPlacementError):
            apply_campaign(Image.new("RGBA",(1080,1080)),self.c,generated_at="2026-11-04",repo_root=REPO)
    def test_disabled_does_not_load_missing_resources(self):
        c=Campaign.from_mapping(dict(CFG,campaign_enabled=False))
        out,r=apply_campaign(self.base,c,generated_at="2026-11-04",repo_root="/missing")
        self.assertIs(out,self.base);self.assertIsNone(r)
    def test_source_alpha_preserves_original_logo(self):
        # Decoración no puede invadir el área opaca del logo.
        import io
        from emblema_web import _bytes,_tile
        art=_bytes(REPO/self.c.asset_path,self.c.asset_sha256)
        logo=_bytes(REPO/self.c.logo_path,self.c.logo_sha256)
        self.assertEqual(_tile(art,logo).tobytes(),self.tile.tobytes())

if __name__=="__main__":unittest.main()
