#!/usr/bin/env python3
"""Vincula nombres SKU[-01..04] a un manifiesto de revisión; no adivina identidad."""
import argparse,hashlib,json,re
from pathlib import Path
from PIL import Image
from reglas_sku import ROOT,load,rule
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--carpeta',required=True);p.add_argument('--salida',required=True);a=p.parse_args()
folder=(ROOT/a.carpeta).resolve();dest=(ROOT/a.salida).resolve()
if not folder.is_relative_to(ROOT) or not dest.is_relative_to(ROOT):raise SystemExit('Rutas deben estar dentro del repositorio')
known=load()['productos'];aliases=json.loads((ROOT/'importacion/alias-sku.json').read_text());result={'skus':[],'imagenes':{},'sin_asignar':[],'duplicados':[]};hashes={}
for path in sorted(folder.rglob('*')):
 if not path.is_file() or path.suffix.lower() not in ('.jpg','.jpeg','.png','.webp'):continue
 if not path.resolve().is_relative_to(ROOT):raise SystemExit('Enlace fuera del repositorio')
 m=re.fullmatch(r'([A-Za-z]+[0-9]+)(?:[-_](0[1-4]))?',path.stem)
 if not m:result['sin_asignar'].append(str(path.relative_to(ROOT)));continue
 sku=aliases.get(m[1].upper(),m[1].upper())
 if sku not in known:result['sin_asignar'].append(str(path.relative_to(ROOT)));continue
 digest=hashlib.sha256(path.read_bytes()).hexdigest()
 if digest in hashes:result['duplicados'].append({'archivo':str(path.relative_to(ROOT)),'igual_a':hashes[digest]})
 hashes[digest]=str(path.relative_to(ROOT));r=rule(sku)
 try:
  with Image.open(path) as im:resolution=list(im.size)
 except Exception:resolution=None
 record={'archivo':str(path.relative_to(ROOT)),'sha256':digest,'posicion':int(m[2] or 1),'resolucion_detectada':resolution,
 'contiene_caja':None,'modelo_revisado':False,'calidad_revisada':False,'sin_datos_privados':False,'revision_regla':r['revision'],
 'fondo_aprobado':False,'fuente':'','instrucciones_vigentes':r['instrucciones']}
 if sku not in result['imagenes']:result['skus'].append(sku);result['imagenes'][sku]=[]
 result['imagenes'][sku].append(record)
dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'sku':len(result['skus']),'sin_asignar':len(result['sin_asignar']),'duplicados':len(result['duplicados'])}))
