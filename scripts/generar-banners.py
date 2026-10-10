#!/usr/bin/env python3
"""Banners prioritarios: fondo ilustrado, producto y logo originales sin regenerar."""
import argparse,hashlib,json,textwrap
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from reglas_sku import ROOT,rule,compatible,image_title
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--sku',nargs='+',required=True);a=p.parse_args()
media=json.loads((ROOT/'importacion/medios.json').read_text());seo=json.loads((ROOT/'seo-contenido.json').read_text())
aliases=json.loads((ROOT/'importacion/alias-sku.json').read_text());report=[]
def font(size,bold=False):return ImageFont.truetype('DejaVuSans'+('-Bold' if bold else '')+'.ttf',size)
for raw in a.sku:
 sku=aliases.get(raw,raw);r=rule(sku);m=media.get(sku,{});cover=next((i for i in m.get('imagenes',[]) if i['posicion']==1),None)
 if not cover or m.get('revision_regla')!=r['revision'] or not compatible(r,cover,True):
  report.append({'sku':sku,'estado':'pendiente','motivo':'No existe portada aprobada compatible con regla vigente'});continue
 photo=Image.open(ROOT/cover['versiones']['1200']['url'].lstrip('/')).convert('RGB')
 if hashlib.sha256((ROOT/cover['versiones']['1200']['url'].lstrip('/')).read_bytes()).hexdigest()!=cover['versiones']['1200']['sha256']:raise ValueError('Portada modificada')
 # Las capas contienen los píxeles aprobados; nunca se renderiza el producto con IA.
 out=Image.open(ROOT/'imagenes/marca/fondo-promocional-original.png').convert('RGB').resize((1200,1200))
 d=ImageDraw.Draw(out);logo=Image.open(ROOT/'imagenes/marca/logo-original.png').convert('RGBA');logo.thumbnail((150,150));out.paste(logo,(48,38),logo)
 d.text((220,65),'CONECTATECH',font=font(44,True),fill='white');d.text((221,125),'Todo en tecnología en un solo lugar.',font=font(22),fill='#c8e4f4')
 name=image_title(r,seo[sku]['nombre']);title=textwrap.wrap(name,width=19)
 y=255
 for line in title:d.text((50,y),line,font=font(31,True),fill='white');y+=43
 d.text((50,y+26),'SKU '+sku,font=font(20),fill='#a6eb62')
 d.rounded_rectangle((463,266,1160,1000),radius=28,fill='white')
 photo.thumbnail((680,680));out.paste(photo,(470,295))
 d.text((510,1023),'Tecnología para tu día a día',font=font(24,True),fill='#0a315b')
 if cover.get('referencia_fabricante') or cover.get('referencia_distribuidor'):d.text((510,1062),'Imagen de referencia del '+('fabricante' if cover.get('referencia_fabricante') else 'distribuidor'),font=font(17),fill='#435971')
 d.text((50,1137),'conectatech-ec.github.io',font=font(25),fill='white')
 path=ROOT/f'imagenes/{sku.lower()}/{sku}-promo.webp';out.save(path,'WEBP',quality=92,method=6)
 m['banner']={'url':'/'+str(path.relative_to(ROOT)),'revision_regla':r['revision'],'portada_sha256':cover['versiones']['1200']['sha256'],
 'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'ancho':1200,'alto':1200,'precios_incrustados':False}
 report.append({'sku':sku,'estado':'generado','archivo':m['banner']['url']})
(ROOT/'importacion/medios.json').write_text(json.dumps(media,ensure_ascii=False,indent=2)+'\n')
(ROOT/'reportes/banners-prioritarios.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False))
