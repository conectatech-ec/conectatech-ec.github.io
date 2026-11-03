"""Capa mínima para el motor SIGNATURE existente; no genera ni publica banners.

Recibe la imagen base en memoria y una fuente cargada por el motor original.
La fecha de campaña es la fecha real de generación en Guayaquil, no la del 593.
El llamador conserva la selección incremental, precios, fotos, QA y publicación.
"""
from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass
from datetime import date, datetime
import hashlib
import json
import re
from threading import RLock
from zoneinfo import ZoneInfo

SCHEMA_VERSION = 1
METADATA_KEY = "conectatech.campaign"
LAYOUT = "signature_1200_header_v1"
CANVAS = (1200, 1200)
COLORS = re.compile(r"^#[0-9a-fA-F]{6}$")
POSITIONS = {"top_right", "top_left", "bottom_right", "bottom_left"}
STYLES = {"compact_ribbon", "compact_badge"}
# Regiones del encabezado y de la plantilla ya aprobada, en coordenadas 1200.
# El sello (952,12)-(1176,44) queda sobre el eslogan, sin cubrir sus trazos.
PROTECTED = (
    (25, 0, 206, 176),       # emblema original
    (206, 40, 800, 111),     # rótulo CONECTATECH
    (205, 115, 795, 165),    # tecnología/conectividad/innovación
    (810, 48, 1195, 165),    # eslogan y circuito
    (25, 190, 1175, 285),    # nombre del producto
    (50, 290, 780, 895),     # fotografía y elementos de venta
    (790, 290, 1190, 895),   # beneficios
    (0, 900, 1200, 1106),    # precios y vigencia
    (0, 1106, 1200, 1200),   # servicios y WhatsApp
)
_CACHE: OrderedDict = OrderedDict()
_CACHE_LOCK = RLock()
_CACHE_LIMIT = 32


class CampaignError(ValueError):
    pass


class CampaignPlacementError(CampaignError):
    pass


class CleanBaseRequired(CampaignError):
    """Regenerar desde la base limpia; nunca borrar una campaña pintando encima."""


def _iso_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise CampaignError("Fecha de campaña inválida; usar AAAA-MM-DD.")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise CampaignError("Fecha de campaña inexistente.") from exc


def _integer(value, field, minimum, maximum):
    if type(value) is not int or not minimum <= value <= maximum:
        raise CampaignError(f"{field} fuera de límites.")
    return value


@dataclass(frozen=True)
class Campaign:
    enabled: bool
    campaign_id: str
    label: str
    start: date
    end: date
    style: str
    position: str
    secondary: str
    background: str
    foreground: str
    border: str
    width: int
    height: int
    margin_x: int
    margin_y: int
    timezone: str
    layout: str

    @classmethod
    def from_mapping(cls, cfg):
        if type(cfg.get("campaign_enabled")) is not bool:
            raise CampaignError("campaign_enabled debe ser booleano.")
        label, identity = cfg.get("campaign_label"), cfg.get("campaign_id")
        if not isinstance(label, str) or not label.strip() or len(label) > 40:
            raise CampaignError("Etiqueta vacía o demasiado larga.")
        if not isinstance(identity, str) or not re.fullmatch(r"[a-z0-9_-]{1,80}", identity):
            raise CampaignError("campaign_id inválido.")
        start, end = _iso_date(cfg.get("campaign_start")), _iso_date(cfg.get("campaign_end"))
        if end < start:
            raise CampaignError("El fin de campaña precede al inicio.")
        style, position = cfg.get("campaign_style"), cfg.get("campaign_position")
        if style not in STYLES or position not in POSITIONS:
            raise CampaignError("Estilo o posición de campaña no admitidos.")
        colors = [cfg.get(k, default) for k, default in (
            ("campaign_secondary_color", "#a4f232"),
            ("campaign_background_color", "#041021"),
            ("campaign_foreground_color", "#f3f8ff"),
            ("campaign_border_color", "#35c8ff"),
        )]
        if any(not isinstance(c, str) or not COLORS.fullmatch(c) for c in colors):
            raise CampaignError("Los colores deben usar #RRGGBB.")
        timezone = cfg.get("campaign_timezone", "America/Guayaquil")
        if timezone != "America/Guayaquil":
            raise CampaignError("La fábrica utiliza America/Guayaquil.")
        return cls(
            cfg["campaign_enabled"], identity, label.strip(), start, end, style, position,
            *[c.lower() for c in colors],
            _integer(cfg.get("campaign_width", 224), "campaign_width", 80, 360),
            _integer(cfg.get("campaign_height", 32), "campaign_height", 24, 72),
            _integer(cfg.get("campaign_margin_x", 24), "campaign_margin_x", 0, 200),
            _integer(cfg.get("campaign_margin_y", 12), "campaign_margin_y", 0, 200),
            timezone, cfg.get("campaign_layout", LAYOUT),
        )

    def local_day(self, generated_at=None):
        if generated_at is None:
            return datetime.now(ZoneInfo(self.timezone)).date()
        if isinstance(generated_at, datetime):
            if generated_at.tzinfo is None:
                raise CampaignError("La fecha/hora de generación necesita zona horaria.")
            return generated_at.astimezone(ZoneInfo(self.timezone)).date()
        if isinstance(generated_at, date):
            return generated_at
        if isinstance(generated_at, str):
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", generated_at):
                return _iso_date(generated_at)
            parsed = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
            return self.local_day(parsed)
        raise CampaignError("Fecha real de generación inválida.")

    def active(self, generated_at=None):
        day = self.local_day(generated_at)
        return self.enabled and self.start <= day <= self.end

    def payload(self):
        return {
            "schema": SCHEMA_VERSION, "id": self.campaign_id, "label": self.label,
            "start": self.start.isoformat(), "end": self.end.isoformat(),
            "style": self.style, "position": self.position,
            "colors": [self.secondary, self.background, self.foreground, self.border],
            "size": [self.width, self.height], "margin": [self.margin_x, self.margin_y],
            "timezone": self.timezone, "layout": self.layout,
        }

    def fingerprint(self, generated_at=None):
        if not self.active(generated_at):
            return None
        data = json.dumps(self.payload(), sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(data.encode("utf-8")).hexdigest()


def placement(campaign, size, protected_regions=()):
    if campaign.layout != LAYOUT or tuple(size) != CANVAS:
        raise CampaignPlacementError("Formato sin zona segura validada; revisar solo esta pieza.")
    w, h = size
    x = w - campaign.margin_x - campaign.width if campaign.position.endswith("right") else campaign.margin_x
    y = campaign.margin_y if campaign.position.startswith("top") else h - campaign.margin_y - campaign.height
    rect = (x, y, x + campaign.width, y + campaign.height)
    if min(x, y) < 0 or rect[2] > w or rect[3] > h:
        raise CampaignPlacementError("El sello sale del lienzo.")
    for protected in tuple(PROTECTED) + tuple(protected_regions):
        if len(protected) != 4:
            raise CampaignPlacementError("Región protegida inválida.")
        a, b, c, d = protected
        if a > c or b > d:
            raise CampaignPlacementError("Región protegida invertida.")
        if x < c and rect[2] > a and y < d and rect[3] > b:
            raise CampaignPlacementError("El sello se cruza con una región protegida.")
    return rect


def clear_cache():
    with _CACHE_LOCK:
        _CACHE.clear()


def cache_size():
    with _CACHE_LOCK:
        return len(_CACHE)


def _color(value, alpha=255):
    return tuple(int(value[p:p + 2], 16) for p in (1, 3, 5)) + (alpha,)


def _badge(campaign, font, font_revision):
    from PIL import Image, ImageDraw
    if font is None or not font_revision:
        raise CampaignError("Usar la fuente original del motor y su revisión; no hay sustitución.")
    key = (json.dumps(campaign.payload(), sort_keys=True), str(font_revision),
           str(getattr(font, "path", "")), getattr(font, "size", None), tuple(font.getname()) if font else ())
    with _CACHE_LOCK:
        if key in _CACHE:
            _CACHE.move_to_end(key)
            return _CACHE[key]
        w, h = campaign.width, campaign.height
        tile = Image.new("RGBA", (w, h))
        draw = ImageDraw.Draw(tile)
        bbox = font.getbbox(campaign.label, anchor="lt")
        if bbox[2] - bbox[0] > w - 30 or bbox[3] - bbox[1] > h - 8:
            raise CampaignPlacementError("La etiqueta no cabe; no reducir ni cambiar la fuente en silencio.")
        if campaign.style == "compact_ribbon":
            points = [(0, 0), (w - 10, 0), (w - 1, h // 2), (w - 10, h - 1), (0, h - 1)]
            draw.polygon(points, fill=_color(campaign.background, 248))
            draw.line(points + [points[0]], fill=_color(campaign.border, 220), width=1)
        else:
            draw.rounded_rectangle((0, 0, w - 1, h - 1), radius=5,
                                   fill=_color(campaign.background, 248),
                                   outline=_color(campaign.border, 220), width=1)
        draw.rectangle((1, 3, 3, h - 4), fill=_color(campaign.secondary))
        draw.text((w / 2 - 3, h / 2), campaign.label, font=font,
                  fill=_color(campaign.foreground), anchor="mm")
        _CACHE[key] = tile
        while len(_CACHE) > _CACHE_LIMIT:
            _CACHE.popitem(last=False)
        return tile


def _read_marker(image):
    marker = image.info.get(METADATA_KEY)
    if marker is None:
        return None
    try:
        result = json.loads(marker) if isinstance(marker, str) else marker
        if (not isinstance(result, dict) or not result.get("fingerprint")
                or not result.get("patch_sha256") or len(result.get("rect", ())) != 4):
            raise ValueError("registro de campaña completo requerido")
        return result
    except (ValueError, TypeError) as exc:
        raise CleanBaseRequired("Metadatos de campaña inválidos; requiere base limpia.") from exc


def apply_campaign(image, campaign, *, generated_at=None, font=None,
                   font_revision=None, protected_regions=()):
    """Devuelve (imagen, registro). No guarda archivos ni modifica la entrada.

    campaign puede construirse una vez por lote. font debe proceder de la misma
    función/fontbank del motor aprobado. font_revision incluye hash/tamaño/peso.
    Las revisiones existentes no se recorren ni regeneran al activar la campaña.
    """
    if not isinstance(campaign, Campaign):
        campaign = Campaign.from_mapping(campaign)
    day = campaign.local_day(generated_at)
    fingerprint = campaign.fingerprint(day)
    marker = _read_marker(image)
    if fingerprint is None:
        if marker:
            raise CleanBaseRequired("Campaña terminada/desactivada: regenerar desde base sin sello.")
        return image, None
    rect = placement(campaign, image.size, protected_regions)
    if marker:
        if marker.get("font_revision") != str(font_revision):
            raise CleanBaseRequired("La fuente cambió; regenerar desde base limpia.")
        if marker.get("fingerprint") != fingerprint or tuple(marker.get("rect", ())) != rect:
            raise CleanBaseRequired("Otra campaña o configuración: regenerar desde base limpia.")
        expected_hash = marker.get("patch_sha256")
        actual_hash = hashlib.sha256(image.convert("RGBA").crop(rect).tobytes()).hexdigest()
        if expected_hash != actual_hash:
            raise CleanBaseRequired("Sello alterado después de generarlo.")
        return image, dict(marker, already_applied=True)

    badge = _badge(campaign, font, font_revision)
    out = image.copy() if image.mode == "RGBA" else image.convert("RGBA")
    out.alpha_composite(badge, (rect[0], rect[1]))
    record = {
        "schema": SCHEMA_VERSION, "campaign_id": campaign.campaign_id,
        "campaign_label": campaign.label, "fingerprint": fingerprint,
        "campaign_start": campaign.start.isoformat(), "campaign_end": campaign.end.isoformat(),
        "generated_at": day.isoformat(), "timezone": campaign.timezone,
        "style": campaign.style, "position": campaign.position, "rect": list(rect),
        "font_revision": str(font_revision),
        "patch_sha256": hashlib.sha256(out.crop(rect).tobytes()).hexdigest(),
        "already_applied": False,
    }
    out.info[METADATA_KEY] = json.dumps(record, sort_keys=True)
    return out, record


def add_png_metadata(png_info, record):
    """Añadir al PngInfo existente antes de su único guardado; no reemplazarlo."""
    if record is not None:
        png_info.add_text(METADATA_KEY, json.dumps(record, sort_keys=True))
    return png_info
