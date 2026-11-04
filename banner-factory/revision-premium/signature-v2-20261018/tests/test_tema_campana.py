import copy
from datetime import datetime, timezone
from io import BytesIO
import json
from pathlib import Path
import sys
import unittest

from PIL import Image, ImageChops, ImageFont
from PIL.PngImagePlugin import PngInfo

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from tema_campana import (
    Campaign, CampaignError, CampaignPlacementError, CleanBaseRequired,
    apply_campaign, placement, clear_cache, cache_size, add_png_metadata, METADATA_KEY,
)

CFG = json.loads("{\"campaign_enabled\":true,\"campaign_id\":\"black_month_2026\",\"campaign_label\":\"BLACK MONTH\",\"campaign_start\":\"2026-11-01\",\"campaign_end\":\"2026-11-30\",\"campaign_style\":\"compact_ribbon\",\"campaign_position\":\"top_right\",\"campaign_secondary_color\":\"#a4f232\",\"campaign_background_color\":\"#041021\",\"campaign_foreground_color\":\"#f3f8ff\",\"campaign_border_color\":\"#35c8ff\",\"campaign_width\":224,\"campaign_height\":32,\"campaign_margin_x\":24,\"campaign_margin_y\":12,\"campaign_timezone\":\"America/Guayaquil\",\"campaign_layout\":\"signature_1200_header_v1\"}")
# Fixture de regresión del sello mínimo anterior; nunca es configuración productiva.
# Fuente exclusivamente para las pruebas sintéticas. Producción debe suministrar
# la fuente original del motor, sin cambiar familia ni peso.
FONT = ImageFont.truetype("DejaVuSans.ttf", 18)
REV = "fuente-sintetica-prueba:18:normal"


class CampaignTests(unittest.TestCase):
    def setUp(self):
        clear_cache()
        self.cfg = copy.deepcopy(CFG)
        self.c = Campaign.from_mapping(self.cfg)
        self.base = Image.new("RGBA", (1200, 1200), (4, 16, 33, 255))

    def apply(self, image=None, c=None, day="2026-11-03", **kw):
        args = dict(generated_at=day, font=FONT, font_revision=REV)
        args.update(kw)
        return apply_campaign(self.base if image is None else image, c or self.c, **args)

    def test_inclusive_start_end_and_inactive_outside(self):
        for day, active in [
            ("2026-10-31", False), ("2026-11-01", True),
            ("2026-11-30", True), ("2026-12-01", False),
        ]:
            with self.subTest(day=day):
                self.assertEqual(self.c.active(day), active)

    def test_guayaquil_day_boundaries_from_utc(self):
        for stamp, active in [
            ("2026-11-01T04:59:59Z", False),
            ("2026-11-01T05:00:00Z", True),
            ("2026-12-01T04:59:59Z", True),
            ("2026-12-01T05:00:00Z", False),
        ]:
            with self.subTest(stamp=stamp):
                self.assertEqual(self.c.active(stamp), active)

    def test_naive_datetime_rejected(self):
        with self.assertRaises(CampaignError):
            self.c.active(datetime(2026, 11, 3, 10))

    def test_canonical_config_and_safe_fixed_position(self):
        self.assertEqual(placement(self.c, (1200, 1200)), (952, 12, 1176, 44))
        self.assertEqual(self.c.label, "BLACK MONTH")
        self.assertEqual(self.c.campaign_id, "black_month_2026")

    def test_no_pixels_outside_badge_change(self):
        original = self.base.tobytes()
        out, record = self.apply()
        self.assertEqual(self.base.tobytes(), original, "entrada modificada")
        self.assertEqual(out.size, (1200, 1200))
        diff = ImageChops.difference(self.base, out)
        for ch in diff.split():
            bbox = ch.getbbox()
            if bbox:
                self.assertGreaterEqual(bbox[0], 952)
                self.assertGreaterEqual(bbox[1], 12)
                self.assertLessEqual(bbox[2], 1176)
                self.assertLessEqual(bbox[3], 44)
        self.assertNotEqual(out.tobytes(), original)
        self.assertEqual(out.crop((25, 0, 206, 176)).tobytes(),
                         self.base.crop((25, 0, 206, 176)).tobytes())
        self.assertEqual(out.crop((0, 190, 1200, 1200)).tobytes(),
                         self.base.crop((0, 190, 1200, 1200)).tobytes())
        self.assertEqual(record["generated_at"], "2026-11-03")

    def test_inactive_is_noop_and_does_not_load_font(self):
        out, record = apply_campaign(self.base, self.c, generated_at="2026-12-01")
        self.assertIs(out, self.base)
        self.assertIsNone(record)
        self.assertEqual(cache_size(), 0)

    def test_disabled_is_noop(self):
        self.cfg["campaign_enabled"] = False
        out, record = self.apply(c=Campaign.from_mapping(self.cfg))
        self.assertIs(out, self.base)
        self.assertIsNone(record)

    def test_bool_not_a_string(self):
        self.cfg["campaign_enabled"] = "true"
        with self.assertRaises(CampaignError):
            Campaign.from_mapping(self.cfg)

    def test_invalid_dates_rejected(self):
        for key, value in [
            ("campaign_start", "01/11/2026"),
            ("campaign_start", "2026-02-31"),
            ("campaign_end", "2026-10-31"),
        ]:
            with self.subTest(key=key, value=value):
                cfg = dict(self.cfg, **{key: value})
                with self.assertRaises(CampaignError):
                    Campaign.from_mapping(cfg)

    def test_unknown_style_position_and_invalid_color_rejected(self):
        for key, value in [
            ("campaign_style", "no_existe"), ("campaign_position", "random"),
            ("campaign_secondary_color", "javascript:invalid"),
            ("campaign_width", True),
        ]:
            with self.subTest(key=key):
                cfg = dict(self.cfg, **{key: value})
                with self.assertRaises(CampaignError):
                    Campaign.from_mapping(cfg)

    def test_protected_dynamic_content_rejected_without_moving(self):
        with self.assertRaises(CampaignPlacementError):
            self.apply(protected_regions=[(940, 0, 1200, 55)])
        self.assertNotIn(METADATA_KEY, self.base.info)

    def test_position_over_logo_rejected(self):
        self.cfg["campaign_position"] = "top_left"
        with self.assertRaises(CampaignPlacementError):
            self.apply(c=Campaign.from_mapping(self.cfg))

    def test_unvalidated_layout_and_size_rejected(self):
        self.cfg["campaign_layout"] = "desconocido"
        with self.assertRaises(CampaignPlacementError):
            self.apply(c=Campaign.from_mapping(self.cfg))
        with self.assertRaises(CampaignPlacementError):
            self.apply(image=Image.new("RGBA", (1080, 1350)))

    def test_font_required_no_silent_fallback(self):
        with self.assertRaises(CampaignError):
            self.apply(font=None)
        with self.assertRaises(CampaignError):
            self.apply(font_revision=None)

    def test_long_text_does_not_shrink_font_or_cover_content(self):
        self.cfg["campaign_label"] = "BLACK MONTH CONECTATECH NOVIEMBRE"
        with self.assertRaises(CampaignPlacementError):
            self.apply(c=Campaign.from_mapping(self.cfg))

    def test_idempotence_preserves_bytes(self):
        first, record = self.apply()
        again, second = self.apply(image=first)
        self.assertIs(first, again)
        self.assertTrue(second["already_applied"])
        self.assertEqual(first.tobytes(), again.tobytes())
        self.assertEqual(record["patch_sha256"], second["patch_sha256"])

    def test_changed_campaign_or_expiration_requires_clean_base(self):
        first, _ = self.apply()
        self.cfg["campaign_label"] = "NAVIDAD"
        self.cfg["campaign_id"] = "navidad_2026"
        with self.assertRaises(CleanBaseRequired):
            self.apply(image=first, c=Campaign.from_mapping(self.cfg))
        with self.assertRaises(CleanBaseRequired):
            self.apply(image=first, day="2026-12-01")
        self.cfg["campaign_enabled"] = False
        with self.assertRaises(CleanBaseRequired):
            self.apply(image=first, c=Campaign.from_mapping(self.cfg))

    def test_changed_font_requires_clean_base(self):
        first, _ = self.apply()
        with self.assertRaises(CleanBaseRequired):
            self.apply(image=first, font_revision="otra-fuente")

    def test_tampered_badge_and_invalid_metadata_rejected(self):
        first, _ = self.apply()
        first.putpixel((955, 20), (255, 0, 0, 255))
        with self.assertRaises(CleanBaseRequired):
            self.apply(image=first)
        self.base.info[METADATA_KEY] = "{}"
        with self.assertRaises(CleanBaseRequired):
            self.apply()

    def test_shared_badge_cache_for_1000_sku_does_not_grow_per_sku(self):
        for _ in range(1000):
            self.apply()
        self.assertEqual(cache_size(), 1)

    def test_cache_identity_includes_font_size(self):
        self.apply()
        self.apply(font=ImageFont.truetype("DejaVuSans.ttf", 17))
        self.assertEqual(cache_size(), 2)

    def test_same_theme_fingerprint_within_month_and_changes_with_colors(self):
        self.assertEqual(self.c.fingerprint("2026-11-01"), self.c.fingerprint("2026-11-30"))
        self.cfg["campaign_secondary_color"] = "#30ff70"
        other = Campaign.from_mapping(self.cfg)
        self.assertNotEqual(self.c.fingerprint("2026-11-03"), other.fingerprint("2026-11-03"))
        self.assertIsNone(self.c.fingerprint("2026-12-01"))

    def test_next_campaign_can_change_label_dates_style_and_color(self):
        self.cfg.update(campaign_id="navidad_2026", campaign_label="NAVIDAD",
                        campaign_start="2026-12-01", campaign_end="2026-12-31",
                        campaign_style="compact_badge", campaign_secondary_color="#30ff70")
        out, record = self.apply(c=Campaign.from_mapping(self.cfg), day="2026-12-01")
        self.assertEqual(record["campaign_label"], "NAVIDAD")
        self.assertEqual(record["style"], "compact_badge")
        self.assertEqual(cache_size(), 1)

    def test_png_metadata_roundtrip_keeps_other_fields_and_idempotence(self):
        out, record = self.apply()
        info = PngInfo()
        info.add_text("sku", "PRUEBA_SINTETICA")
        add_png_metadata(info, record)
        target = BytesIO()
        out.save(target, format="PNG", pnginfo=info)
        target.seek(0)
        reread = Image.open(target).convert("RGBA")
        self.assertEqual(reread.info["sku"], "PRUEBA_SINTETICA")
        self.assertEqual(json.loads(reread.info[METADATA_KEY])["campaign_id"], "black_month_2026")
        again, r = self.apply(image=reread)
        self.assertTrue(r["already_applied"])
        self.assertEqual(again.tobytes(), out.tobytes())


if __name__ == "__main__":
    unittest.main()
