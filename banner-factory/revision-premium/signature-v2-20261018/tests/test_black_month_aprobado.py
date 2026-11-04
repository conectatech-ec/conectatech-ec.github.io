import copy
from datetime import datetime, timezone
from pathlib import Path
import sys
import unittest
import json
import hashlib
from PIL import Image, ImageChops
HERE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(HERE))
from tema_campana import (Campaign,CampaignError,CampaignPlacementError,CleanBaseRequired,
 apply_campaign,restore_campaign,needs_campaign_refresh,clear_cache,cache_size,METADATA_KEY)
# Fixture histórica: prueba del sello anterior y de su retirada.
CFG="{\"campaign_enabled\":true,\"campaign_id\":\"black_month_2026\",\"campaign_label\":\"BLACK MONTH\",\"campaign_start\":\"2026-11-01\",\"campaign_end\":\"2026-11-30\",\"campaign_style\":\"black_gold_red_asset\",\"campaign_position\":\"below_logo\",\"campaign_secondary_color\":\"#d6a83d\",\"campaign_background_color\":\"#080808\",\"campaign_foreground_color\":\"#f9d976\",\"campaign_border_color\":\"#c91723\",\"campaign_width\":300,\"campaign_height\":101,\"campaign_margin_x\":24,\"campaign_margin_y\":185,\"campaign_timezone\":\"America/Guayaquil\",\"campaign_layout\":\"signature_1200_phone_centered_v1\",\"campaign_asset\":\"assets/campaigns/black-month-2026.png\",\"campaign_asset_sha256\":\"e053e2d9524385c8c95d911974b5aa82d268d7417ffe39e2bccba080b9114734\",\"campaign_approved\":true,\"campaign_approval_source\":\"Aprobación explícita del propietario: APROBADO, procede con todos de acuerdo a lo ya conversado.\",\"campaign_expiry_action\":\"restore_original_patch_using_verified_clean_base\",\"campaign_end_inclusive\":true,\"campaign_restore_from\":\"2026-12-01T00:00:00-05:00\",\"campaign_rollout_scope\":\"approved_library_and_new\",\"campaign_no_independent_cron\":true}"
CFG=json.loads(CFG)

class ApprovedBlackMonth(unittest.TestCase):
 def setUp(self):
  clear_cache()
  self.cfg=copy.deepcopy(CFG)
  self.c=Campaign.from_mapping(self.cfg)
  self.base=Image.new("RGBA",(1200,1200),(4,16,33,255))
 def apply(self,image=None,day="2026-11-04",**kw):
  return apply_campaign(image if image is not None else self.base,self.c,generated_at=day,**kw)
 def test_position_matches_owner_approval(self):
  _,r=self.apply()
  self.assertEqual(r["rect"],[24,185,324,286])
  self.assertEqual(r["position"],"below_logo")
  self.assertEqual(r["style"],"black_gold_red_asset")
 def test_exact_approved_asset_and_label(self):
  p=HERE/self.c.asset_path
  self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(),self.c.asset_sha256)
  with Image.open(p) as im:
   self.assertEqual(im.size,(300,101))
   self.assertEqual(im.info["conectatech.campaign_label"],"BLACK MONTH")
   self.assertEqual(im.mode,"RGBA")
   self.assertEqual(im.getpixel((0,0))[3],0)
 def test_only_badge_region_changes(self):
  out,_=self.apply()
  diff=ImageChops.difference(out,self.base)
  for channel in diff.split():
   b=channel.getbbox()
   if b:
    self.assertTrue(24<=b[0]<=b[2]<=324)
    self.assertTrue(185<=b[1]<=b[3]<=286)
  self.assertEqual(out.crop((0,0,1200,176)).tobytes(),self.base.crop((0,0,1200,176)).tobytes())
  self.assertEqual(out.crop((0,290,1200,1200)).tobytes(),self.base.crop((0,290,1200,1200)).tobytes())
 def test_font_not_needed_and_no_ai_per_sku(self):
  out,r=self.apply()
  self.assertEqual(r["font_revision"],"asset:"+self.c.asset_sha256)
  self.assertEqual(cache_size(),1)
 def test_duplicate_is_noop(self):
  one,_=self.apply();two,r=self.apply(one)
  self.assertIs(one,two);self.assertTrue(r["already_applied"])
 def test_end_of_november_exact_ecuador(self):
  self.assertTrue(self.c.active("2026-12-01T04:59:59Z"))
  self.assertFalse(self.c.active("2026-12-01T05:00:00Z"))
  self.assertTrue(self.c.active("2026-11-30"))
  self.assertFalse(self.c.active("2026-12-01"))
 def test_expiry_restores_exact_pixels(self):
  one,_=self.apply()
  clean,r=self.apply(one,day="2026-12-01",clean_base=self.base)
  self.assertIsNone(r);self.assertNotIn(METADATA_KEY,clean.info)
  self.assertEqual(clean.tobytes(),self.base.tobytes())
 def test_expiry_preserves_new_commercial_pixels_outside_badge(self):
  one,_=self.apply()
  one.putpixel((100,970),(250,1,2,255))
  clean,_=self.apply(one,day="2026-12-01",clean_base=self.base)
  self.assertEqual(clean.getpixel((100,970)),(250,1,2,255))
  self.assertEqual(clean.crop((24,185,324,286)).tobytes(),self.base.crop((24,185,324,286)).tobytes())
 def test_expiry_without_clean_original_blocks(self):
  one,_=self.apply()
  with self.assertRaises(CleanBaseRequired):self.apply(one,day="2026-12-01")
 def test_wrong_clean_original_rejected(self):
  one,_=self.apply()
  wrong=self.base.copy();wrong.putpixel((24,185),(255,0,0,255))
  with self.assertRaises(CleanBaseRequired):self.apply(one,day="2026-12-01",clean_base=wrong)
 def test_title_collision_rejected(self):
  with self.assertRaises(CampaignPlacementError):self.apply(protected_regions=[(60,205,1100,270)])
 def test_other_category_cannot_silently_use_phone_layout(self):
  cfg=dict(self.cfg,campaign_layout="signature_1200_dynamic_bboxes_v1")
  c=Campaign.from_mapping(cfg)
  with self.assertRaises(CampaignPlacementError):apply_campaign(self.base,c,generated_at="2026-11-04")
  with self.assertRaises(CampaignPlacementError):
   apply_campaign(self.base,c,generated_at="2026-11-04",protected_regions=[(60,205,1100,270)])
  out,r=apply_campaign(self.base,c,generated_at="2026-11-04",protected_regions=[(350,190,1150,280)])
  self.assertEqual(r["rect"],[24,185,324,286])
 def test_asset_integrity_and_label_mismatch_rejected(self):
  cfg=dict(self.cfg,campaign_asset_sha256="0"*64)
  with self.assertRaises(CampaignError):apply_campaign(self.base,Campaign.from_mapping(cfg),generated_at="2026-11-04")
  cfg=dict(self.cfg,campaign_label="NAVIDAD")
  with self.assertRaises(CampaignError):apply_campaign(self.base,Campaign.from_mapping(cfg),generated_at="2026-11-04")
 def test_incremental_selection_also_detects_removal_without_price_change(self):
  _,r=self.apply()
  self.assertFalse(needs_campaign_refresh(r,self.c,"2026-11-30"))
  self.assertTrue(needs_campaign_refresh(r,self.c,"2026-12-01"))
  self.assertTrue(needs_campaign_refresh(None,self.c,"2026-11-04"))
  self.assertFalse(needs_campaign_refresh(None,self.c,"2026-12-01"))

if __name__=="__main__":unittest.main()
