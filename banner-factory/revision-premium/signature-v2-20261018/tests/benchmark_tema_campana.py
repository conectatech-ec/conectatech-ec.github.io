"""Medición sintética de la capa; no atribuye tiempos al motor productivo."""
import json
from pathlib import Path
import statistics
import sys
from time import perf_counter

from PIL import Image, ImageFont

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from tema_campana import Campaign, apply_campaign, clear_cache, cache_size

cfg = json.loads((HERE / "campana-tematica.json").read_text())
campaign = Campaign.from_mapping(cfg)
font = ImageFont.truetype("DejaVuSans.ttf", 18)
base = Image.new("RGBA", (1200, 1200), (4, 16, 33, 255))
clear_cache()
start = perf_counter()
apply_campaign(base, campaign, generated_at="2026-11-03", font=font,
               font_revision="fuente-sintetica-prueba:18:normal")
cold_ms = (perf_counter() - start) * 1000
times, copies = [], []
for _ in range(120):
    start = perf_counter()
    image, record = apply_campaign(base, campaign, generated_at="2026-11-03",
                                   font=font, font_revision="fuente-sintetica-prueba:18:normal")
    times.append((perf_counter() - start) * 1000)
    start = perf_counter()
    _ = base.copy()
    copies.append((perf_counter() - start) * 1000)
ordered = sorted(times)
print(json.dumps({
    "tipo": "MEDICION_SINTETICA_NO_LOTE_PRODUCTIVO",
    "lienzo": [1200, 1200], "iteraciones": len(times),
    "sello_pixeles": 224 * 32, "fraccion_lienzo": (224 * 32) / (1200 * 1200),
    "primer_sello_ms": round(cold_ms, 4),
    "capa_cache_mediana_ms": round(statistics.median(times), 4),
    "capa_cache_p95_ms": round(ordered[int(len(ordered) * .95) - 1], 4),
    "copia_base_mediana_ms": round(statistics.median(copies), 4),
    "sellos_cacheados": cache_size(),
    "limitacion": "No incluye generación original, PNG, PDF, Drive ni cola del motor real."
}, ensure_ascii=False))
