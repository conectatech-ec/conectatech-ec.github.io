#!/usr/bin/env python3
"""Diagnóstico limitado a datos públicos; no publica contratos ni cantidades."""
import json, re
from pathlib import Path
from collections import Counter
root=Path('fuente-vigente'); out=Path('google-merchant')
seo=json.loads((root/'seo-contenido.json').read_text())
products=json.loads(re.search(r'const products=(\[[\s\S]*?\]);\s*\n',(root/'index.html').read_text())[1])
products={p['sku']:p for p in products}
excluded=json.loads((out/'exclusiones.json').read_text())
report={'publicacion_habilitada':False,'conteos':dict(Counter(x['motivo'] for x in excluded)),'imagenes':[]}
for e in excluded:
    if e['motivo']!='imagen_no_coincide': continue
    sku=e['sku']; o=seo[sku]; p=products[sku]
    c=json.loads((root/'importacion/contratos'/f'{sku}.json').read_text())
    info=o.get('imagenProfesional',{})
    report['imagenes'].append(dict(sku=sku,catalogo=p.get('imageUrl'),editorial=o.get('imagen'),
        contrato=c.get('imagen_principal'),revision_visual=info.get('revision_visual'),
        contiene_caja=info.get('contiene_caja'),
        versiones=[dict(url=v.get('url'),sha256=v.get('sha256')) for v in info.get('versiones',{}).values()]))
(out/'diagnostico-activacion.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
