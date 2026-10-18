#!/usr/bin/env python3
"""Document layout using approved images unchanged. No photo editing or image regeneration."""
import json,html,io
from PIL import Image
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
ROOT=Path(__file__).resolve().parents[1]
pdfmetrics.registerFont(TTFont('DejaVu','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuBold','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
items=json.loads((ROOT/'paquete/lote.json').read_text())['items']
navy=HexColor('#112e35');green=HexColor('#27664c');muted=HexColor('#61766c');paper=HexColor('#f4f6f3')
def text(c,x,y,value,size=10,font='DejaVu',color=navy):c.setFillColor(color);c.setFont(font,size);c.drawString(x,y,value)
def para(c,x,y,value,width,size=10,lines=3):
 p=Paragraph(html.escape(value),ParagraphStyle('p',fontName='DejaVu',fontSize=size,leading=size*1.3,textColor=navy));_,h=p.wrap(width,1000);p.drawOn(c,x,y-h);return h
def photo(c,p,x,y,w,h):
 image=Image.open(ROOT/'paquete'/p['image_file']).convert('RGB');image.thumbnail((600,600));buffer=io.BytesIO();image.save(buffer,format='JPEG',quality=88,optimize=True);buffer.seek(0)
 c.drawImage(ImageReader(buffer),x,y,w,h,preserveAspectRatio=True,anchor='c')
def card(c,p,x,y,w,h,small=False):
 c.setFillColor(HexColor('#ffffff'));c.setStrokeColor(HexColor('#dce4da'));c.roundRect(x,y,w,h,9,fill=1,stroke=1)
 pad=13 if not small else 10
 text(c,x+pad,y+h-23,p['sku']+' · PREPARADO',8 if not small else 7,color=muted)
 ph=h*.48;photo(c,p,x+pad,y+h-40-ph,w-pad*2,ph)
 title_y=y+h-50-ph;para(c,x+pad,title_y,p['title'],w-pad*2,11 if not small else 8.5)
 text(c,x+pad,y+42 if not small else y+30,'$'+p['price']+' contado',17 if not small else 13,'DejaVuBold',green)
 text(c,x+pad,y+24 if not small else y+15,'PVP $'+p['pvp'],9 if not small else 8,color=muted)
folder=ROOT/'galeria';folder.mkdir(exist_ok=True)
c=canvas.Canvas(str(folder/'galeria-30.pdf'),pagesize=(595.28,841.89));c.setTitle('CONECTATECH PRO · 30 anuncios preparados');c.setAuthor('CONECTATECH')
for start in range(0,30,6):
 c.setFillColor(paper);c.rect(0,0,596,842,fill=1,stroke=0)
 text(c,28,804,'CONECTATECH PRO',20,'DejaVuBold');text(c,28,783,'30 PREPARADOS / 0 APROBADOS / 0 PUBLICADOS',10,color=green)
 text(c,28,766,'Inventario 16-10-2026 · Revisión antes de publicación externa',9,color=muted)
 for n,p in enumerate(items[start:start+6]):
  col=n%2;row=n//2;card(c,p,28+col*276,520-row*237,263,225)
 text(c,28,25,'Material preparado, no publicado · Entrega y categoría oficial por confirmar',8,color=muted);text(c,520,25,str(start//6+1)+'/5',9)
 c.showPage()
c.save()
# One-sheet visual overview of all 30.
c=canvas.Canvas(str(folder/'vista-30.pdf'),pagesize=(1200,1900));c.setFillColor(paper);c.rect(0,0,1200,1900,fill=1,stroke=0)
text(c,30,1858,'CONECTATECH PRO',32,'DejaVuBold');text(c,30,1828,'30 preparados · 0 aprobados · 0 publicados · Inventario 16-10-2026',16,color=green)
for n,p in enumerate(items):card(c,p,30+(n%5)*234,1533-(n//5)*300,220,286,True)
text(c,30,20,'Galería para revisión. Vigencia y condiciones en la bandeja. Sin publicaciones externas.',12,color=muted);c.save()
