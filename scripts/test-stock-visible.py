#!/usr/bin/env python3
"""Regresión: una sincronización real retira/restaura el aviso sin tocar fotos/títulos."""
import importlib.util, json, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('sync593',ROOT/'scripts/sync-corte-593.py')
sync=importlib.util.module_from_spec(spec);spec.loader.exec_module(sync)
products=json.loads(sync.RX.search((ROOT/'index.html').read_text())[1])
slugs=json.loads((ROOT/'seo-pages.json').read_text())
for sku in ['TELF005','BILL006']:
 p=next(p for p in products if p['sku']==sku)
 original=(ROOT/'productos'/slugs[sku]/'index.html').read_text()
 text=original; old=p.copy()
 for stock in [2,0,0,3,0]:
  new={**p,'stock':stock}
  text=sync.patch_page(text,new,old,'21/10/2026');old=new
  schema=json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>',text,re.S)[1])
  assert schema['offers']['availability'].endswith('InStock' if stock else 'OutOfStock')
  assert text.count('Stock: 0 · No disponible')==(0 if stock else 1),sku
  assert re.findall(r'<img\b[^>]*>',text)==re.findall(r'<img\b[^>]*>',original)
  assert re.findall(r'<(?:h1|title)\b[^>]*>.*?</(?:h1|title)>',text,re.S)==re.findall(r'<(?:h1|title)\b[^>]*>.*?</(?:h1|title)>',original,re.S)
  assert schema['offers']['price']==f"{p['promo']:.2f}"
 print(sku+': reposición y agotamiento correctos; fotos/títulos/precio conservados')
