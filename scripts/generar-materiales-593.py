#!/usr/bin/env python3
"""Genera PDFs comerciales y prepara insumos de banners/SIGNATURE desde el corte publicado.
No reinterpreta precios del 593 ni aprueba creatividades nuevas automaticamente.
"""
import argparse, hashlib, io, json, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT=Path(__file__).resolve().parents[1]
CUT=ROOT/'datos-593/estado-ultimo-corte.json'
OUT=ROOT/'catalogos-593'
BRAND='#0a315b'
CATEGORIES={
 'telefonos-tablets': ['Telefonos','Tablets'],
 'audio': ['Audifonos','Parlantes','Microfonos','Radios','Barras'],
 'computacion': ['Monitores','Mouse','Teclados','Flash','Discos','Webcams','Proyectores','Hub','Switch','Routers'],
 'carga-conectividad': ['Adaptadores','Cables','Cargadores','Cubos','Powerbanks','Conectividad','Antenas'],
 'accesorios': ['Estuches','Micas','Soportes','Protectores','Case','Fundas','Correas','Relojes','Tripodes','Stylus','Airtags']
}
TITLES={'telefonos-tablets':'TELÉFONOS Y TABLETS','audio':'AUDIO','computacion':'COMPUTACIÓN',
 'carga-conectividad':'CARGA Y CONECTIVIDAD','accesorios':'ACCESORIOS','general':'CATÁLOGO GENERAL'}
def load():
 s=(ROOT/'index.html').read_text(encoding='utf-8')
 m=re.search(r'const products=(\[[\s\S]*?\]);\s*\n',s)
 if not m:raise ValueError('No hay productos en index.html')
 products=json.loads(m.group(1))
 state=json.loads(CUT.read_text(encoding='utf-8'))
 pages=json.loads((ROOT/'seo-pages.json').read_text(encoding='utf-8'))
 if not re.fullmatch(r'20\d\d-\d\d-\d\d',state['fecha_corte']):raise ValueError('Corte no válido')
 if len(products)!=state['sku_web']:raise ValueError('Corte y catálogo con SKU distintos')
 if sum(p['stock']>0 for p in products)!=state['con_stock']:raise ValueError('Corte y stock no coinciden')
 if len(set(p['sku'] for p in products))!=len(products):raise ValueError('Duplicados')
 for p in products:
  if not isinstance(p.get('promo'),(float,int)) or not isinstance(p.get('pvp'),(float,int)):raise ValueError('Precio ausente')
  if p['sku'] not in pages:raise ValueError('URL sin ficha')
 return products,state,pages
def photo(p):
 link=p.get('imageUrl') or ''
 if not re.fullmatch(r'/imagenes/[a-z0-9_/-]+\.(webp|png|jpg|jpeg)',link,re.I):return None
 path=(ROOT/link.lstrip('/')).resolve()
 if not path.is_relative_to(ROOT.resolve()) or not path.exists():return None
 return path
def fmt(v):return '$'+f'{v:,.2f}'.replace(',','X').replace('.',',').replace('X','.')
def font():
 try:
  regular='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
  bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
  pdfmetrics.registerFont(TTFont('Catalogo',regular))
  pdfmetrics.registerFont(TTFont('CatalogoBold',bold))
  return 'Catalogo','CatalogoBold'
 except Exception:return 'Helvetica','Helvetica-Bold'
def wrap_text(c,string,width,size,name,limit=3):
 result=[];line=''
 for token in str(string).split():
  nxt=(line+' '+token).strip()
  if pdfmetrics.stringWidth(nxt,name,size)<=width:line=nxt
  else:
   if line:result.append(line)
   line=token
 if line:result.append(line)
 if len(result)>limit:
  result=result[:limit]
  while result[-1] and pdfmetrics.stringWidth(result[-1]+'…',name,size)>width:result[-1]=result[-1][:-1]
  result[-1]+='…'
 return result
def image_obj(p):
 path=photo(p)
 if not path:return None
 try:
  with Image.open(path) as im:
   im=ImageOps.exif_transpose(im).convert('RGBA')
   im.thumbnail((440,360),Image.Resampling.LANCZOS)
   canvas=Image.new('RGB',(440,360),'white')
   canvas.paste(im,((440-im.width)//2,(360-im.height)//2),im)
   out=io.BytesIO();canvas.save(out,format='JPEG',quality=77,optimize=True)
   out.seek(0);return ImageReader(out)
 except Exception:return None
def draw_cover(c,title,items,state,regular,bold):
 W,H=(595.28,841.89);c.setFillColorRGB(.027,.079,.165);c.rect(0,0,W,H,fill=1,stroke=0)
 logo=ROOT/'logo-conectatech.png'
 if logo.exists():c.drawImage(str(logo),W/2-104,H-290,width=208,height=208,mask='auto',preserveAspectRatio=True)
 c.setFillColorRGB(1,1,1);c.setFont(bold,23);c.drawCentredString(W/2,H-345,'CONECTATECH')
 c.setFillColorRGB(.40,.88,.55);c.setFont(bold,16);c.drawCentredString(W/2,H-390,title)
 c.setFillColorRGB(.82,.89,.98);c.setFont(regular,12)
 c.drawCentredString(W/2,H-420,'Tu mundo más conectado')
 c.drawCentredString(W/2,125,f"{len(items)} referencias · Corte del {state['fecha_corte']}")
 c.setFont(regular,9)
 c.drawCentredString(W/2,95,'Precios y disponibilidad sujetos a confirmación en tienda')
 c.drawCentredString(W/2,79,'Quito · Contraentrega · Envíos nacionales')
 c.linkURL('https://conectatech-ec.github.io/',(0,0,W,H),relative=0)
 c.showPage()
def draw_item(c,p,slug,x,y,w,h,regular,bold):
 c.setFillColorRGB(.97,.985,1);c.roundRect(x,y,w,h,9,fill=1,stroke=0)
 c.setFillColorRGB(.75,.82,.91);c.roundRect(x,y,w,h,9,fill=0,stroke=1)
 ob=image_obj(p)
 if ob:c.drawImage(ob,x+8,y+h-139,width=w-16,height=112,preserveAspectRatio=True,anchor='c',mask='auto')
 else:
  c.setFillColorRGB(.45,.5,.58);c.setFont(regular,8);c.drawCentredString(x+w/2,y+h-79,'Imagen en preparación')
 c.setFillColorRGB(.07,.20,.37)
 for idx,line in enumerate(wrap_text(c,p['name'],w-20,9,bold,3)):c.setFont(bold,9);c.drawString(x+10,y+h-152-idx*13,line)
 c.setFillColorRGB(.10,.46,.28);c.setFont(bold,13);c.drawString(x+10,y+46,fmt(p['promo']))
 c.setFont(regular,8);c.setFillColorRGB(.25,.34,.47);c.drawString(x+10,y+31,'PROMO CONTADO')
 c.setFont(regular,9);c.drawString(x+10,y+17,'PVP '+fmt(p['pvp']))
 c.setFont(regular,7);c.drawRightString(x+w-10,y+17,p['sku'])
 link='https://conectatech-ec.github.io/productos/'+slug+'/'
 c.linkURL(link,(x,y,x+w,y+h),relative=0)
def generate_pdf(name,items,state,pages,regular,bold):
 OUT.mkdir(exist_ok=True)
 path=OUT/('CONECTATECH-'+name+'.pdf')
 c=canvas.Canvas(str(path),pagesize=(595.28,841.89),pageCompression=1)
 c.setTitle('CONECTATECH - '+TITLES[name]);c.setAuthor('CONECTATECH')
 c.setSubject('Corte comercial del '+state['fecha_corte'])
 draw_cover(c,TITLES[name],items,state,regular,bold)
 W,H=595.28,841.89
 colw=268;cardh=230
 for offset in range(0,len(items),6):
  c.setFillColorRGB(.027,.079,.165);c.rect(0,H-52,W,52,fill=1,stroke=0)
  c.setFillColorRGB(1,1,1);c.setFont(bold,11);c.drawString(20,H-31,TITLES[name])
  c.setFont(regular,8);c.drawRightString(W-20,H-31,'Corte '+state['fecha_corte'])
  for k,p in enumerate(items[offset:offset+6]):
   col=k%2;row=k//2
   x=20+col*287;y=H-72-(row+1)*cardh-row*11
   draw_item(c,p,pages[p['sku']],x,y,colw,cardh,regular,bold)
  c.setFillColorRGB(.3,.39,.53);c.setFont(regular,8)
  c.drawCentredString(W/2,19,'CONECTATECH · Factura y garantía · Precios sujetos a confirmación')
  c.showPage()
 c.save()
 return {'archivo':str(path.relative_to(ROOT)),'bytes':path.stat().st_size,
  'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'productos':len(items),'paginas':1+(len(items)+5)//6}

def _pixfont(size,bold=False):
 path='/usr/share/fonts/truetype/dejavu/DejaVuSans'+('-Bold' if bold else '')+'.ttf'
 return ImageFont.truetype(path,size)
def banner_revisar(p,state):
 asset=photo(p)
 if not asset:return None
 background=ROOT/'imagenes/marca/fondo-promocional-original.png'
 logo=ROOT/'imagenes/marca/logo-original.png'
 if not background.exists() or not logo.exists():raise ValueError('Falta arte original de marca')
 with Image.open(background) as b:
  im=ImageOps.fit(b.convert('RGB'),(1200,1200),method=Image.Resampling.LANCZOS)
 with Image.open(logo) as l:
  mark=l.convert('RGBA');mark.thumbnail((150,150),Image.Resampling.LANCZOS)
 im.paste(mark,(35,30),mark)
 d=ImageDraw.Draw(im)
 d.rounded_rectangle((35,208,1165,1125),radius=32,fill=(7,27,57),outline=(67,191,144),width=3)
 title=str(p['name'])
 words=title.split();lines=[];line=''
 for word in words:
  t=(line+' '+word).strip()
  if d.textbbox((0,0),t,font=_pixfont(39,True))[2]<=1020:line=t
  else:
   if line:lines.append(line)
   line=word
 if line:lines.append(line)
 for i,line in enumerate(lines[:2]):d.text((72,239+i*52),line,font=_pixfont(39,True),fill='white')
 with Image.open(asset) as pimg:
  pimg=ImageOps.exif_transpose(pimg).convert('RGBA')
  pimg.thumbnail((710,625),Image.Resampling.LANCZOS)
  white=Image.new('RGB',(725,630),'white')
  white.paste(pimg,((725-pimg.width)//2,(630-pimg.height)//2),pimg)
  im.paste(white,(420,346))
 d=ImageDraw.Draw(im)
 d.text((72,445),'PROMO CONTADO',font=_pixfont(29,True),fill=(182,243,213))
 d.text((72,491),fmt(p['promo']),font=_pixfont(56,True),fill='white')
 d.text((72,582),'PVP '+fmt(p['pvp']),font=_pixfont(28),fill=(213,224,240))
 d.text((72,691),'SKU '+p['sku'],font=_pixfont(22),fill=(197,220,236))
 d.text((72,905),'Actualizado al '+state['fecha_corte'],font=_pixfont(22),fill='white')
 d.text((72,957),'Confirma disponibilidad antes de comprar',font=_pixfont(17),fill=(203,221,240))
 d.text((72,1058),'CONECTATECH · Quito · Factura y garantía',font=_pixfont(19,True),fill='white')
 output=ROOT/'banners-593-revision';output.mkdir(parents=True,exist_ok=True)
 target=output/(p['sku']+'-revision.png')
 im.save(target,format='PNG',optimize=True)
 return {'sku':p['sku'],'archivo':str(target.relative_to(ROOT)),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
  'fecha_corte':state['fecha_corte'],'estado':'REVISION_PRIVADA','publicado':False,'apto_envio':False}

def main():
 p=argparse.ArgumentParser();p.add_argument('--catalogos',action='store_true');p.add_argument('--insumos',action='store_true');p.add_argument('--banners',action='store_true')
 a=p.parse_args();products,state,pages=load();active=[p for p in products if p['stock']>0 and p['promo']>0 and p['pvp']>0]
 groups={key:[p for p in active if p['category'] in categories] for key,categories in CATEGORIES.items()}
 known=set(sum((lst for lst in CATEGORIES.values()),[]))
 groups['otros']=[p for p in active if p['category'] not in known]
 groups['general']=active
 OUT.mkdir(parents=True,exist_ok=True)
 common={'fecha_corte':state['fecha_corte'],'fuente_sha256':state['origen_sha256'],'sku_publicados':len(products),
         'con_existencias':len(active),'banners_signature_aprobados_automaticamente':False,
         'costo_adicional':'0','advertencia':'Las piezas SIGNATURE individuales requieren hash de aprobación creativa.'}
 results=[]
 if a.catalogos or not a.insumos:
  regular,bold=font()
  for key,rows in groups.items():
   if rows and key!='otros':results.append(generate_pdf(key,rows,state,pages,regular,bold))
   elif rows and key=='otros':results.append(generate_pdf('general',rows,state,pages,regular,bold)) if False else None
  summary={**common,'catalogos':results}
  (OUT/'manifest.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 if a.insumos or not a.catalogos:
  rows=[{'sku':p['sku'],'titulo':p['name'],'categoria':p['category'],'promo_contado_centavos':round(p['promo']*100),
     'pvp_centavos':round(p['pvp']*100),'disponible':True,'imagen_publica':p.get('imageUrl') or None,
     'url_producto':'https://conectatech-ec.github.io/productos/'+pages[p['sku']]+'/',
     'revision_creativa':'PENDIENTE','apto_envio':False} for p in active]
  payload={**common,'estado':'INSUMOS_VALIDOS_PENDIENTE_FABRICA','productos':rows}
  dest=ROOT/'exportaciones/insumos-signature-593.json'
  dest.parent.mkdir(exist_ok=True);dest.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
 if a.banners:
  previews=[x for x in (banner_revisar(p,state) for p in active if p['category'] in ('Telefonos','Tablets')) if x]
  (ROOT/'banners-593-revision/manifest.json').write_text(json.dumps({'fecha_corte':state['fecha_corte'],'fuente_sha256':state['origen_sha256'],'estado':'REVISION_PRIVADA','publicacion_automatica':False,'banners':previews},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({'fecha_corte':state['fecha_corte'],'catalogos':len(results),'sku_activos':len(active),
  'archivos_pdf':[x['archivo'] for x in results]},ensure_ascii=False))
if __name__=='__main__':main()
