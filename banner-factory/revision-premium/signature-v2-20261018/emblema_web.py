"""Compositor del emblema web oficial sobre el encabezado SIGNATURE existente.

No descarga, publica ni altera datos comerciales. Usa los dos PNG originales
por hash; conserva el rótulo, el eslogan y todos los píxeles fuera del encabezado.
La retirada exacta se realiza con restore_campaign y la base privada original.
"""
from functools import lru_cache
import hashlib
import io
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops, ImageOps

HEADER_SIZE=(215,190)
LOGO_SIZE=118
LOGO_AT=(57,33)
ERASE_BOX=(29,7,204,178)

def _bytes(path,expected):
    data=Path(path).read_bytes()
    if hashlib.sha256(data).hexdigest()!=expected:
        raise ValueError("El recurso no coincide con la huella aprobada")
    return data

@lru_cache(maxsize=8)
def _tile(art_bytes,logo_bytes):
    with Image.open(io.BytesIO(art_bytes)) as source:
        if source.format!="PNG" or source.size!=(1254,1254):
            raise ValueError("Se requiere el PNG transparente oficial de 1254 x 1254")
        art=source.convert("RGBA")
    if art.getextrema()[3][0]!=0:raise ValueError("Emblema sin transparencia real")
    with Image.open(io.BytesIO(logo_bytes)) as source:
        mark=ImageOps.contain(source.convert("RGBA"),(LOGO_SIZE,LOGO_SIZE),Image.Resampling.LANCZOS)
    if mark.size!=(LOGO_SIZE,LOGO_SIZE):raise ValueError("Logo original no cuadrado")
    mask=Image.new("L",(LOGO_SIZE*4,LOGO_SIZE*4))
    ImageDraw.Draw(mask).ellipse((0,0,LOGO_SIZE*4-1,LOGO_SIZE*4-1),fill=255)
    mark.putalpha(ImageChops.multiply(mark.getchannel("A"),mask.resize(mark.size,Image.Resampling.LANCZOS)))
    tile=Image.new("RGBA",HEADER_SIZE)
    tile.alpha_composite(mark,LOGO_AT)
    # Relaciones originales utilizadas por portada.css en la web.
    fw,fh=round(LOGO_SIZE*1.27),round(LOGO_SIZE*1.34)
    fx,fy=round(LOGO_AT[0]-LOGO_SIZE*.1284),round(LOGO_AT[1]-LOGO_SIZE*.0513)
    frame=art.resize((fw,fh),Image.Resampling.LANCZOS)
    for py in range(fh):
        for px in range(fw):
            tx,ty=px+fx-LOGO_AT[0],py+fy-LOGO_AT[1]
            if 0<=tx<LOGO_SIZE and 0<=ty<LOGO_SIZE and mark.getpixel((tx,ty))[3]>0:
                frame.putpixel((px,py),(0,0,0,0))
    tile.alpha_composite(frame,(fx,fy))
    if tile.getbbox()[3]>188:raise ValueError("Emblema invade títulos")
    return tile

def tile_from_repository(repo, campaign):
    repo=Path(repo).resolve()
    paths=[]
    for relative,expected in ((campaign.asset_path,campaign.asset_sha256),
                              (campaign.logo_path,campaign.logo_sha256)):
        p=(repo/relative).resolve()
        if not p.is_relative_to(repo):raise ValueError("Recurso fuera del repositorio")
        paths.append(_bytes(p,expected))
    # Se comprueban los bytes antes de reutilizar la caché.
    return _tile(*paths).copy()

def decorate_header(image,tile):
    if image.size!=(1200,1200) or tile.size!=HEADER_SIZE:
        raise ValueError("Geometría no validada")
    source=image.convert("RGBA")
    out=source.copy()
    # Sólo se retira la antigua instancia circular del encabezado. Se interpola
    # el fondo local; el original completo permanece en la base de retirada.
    for y in range(7,178):
        left,right=source.getpixel((16,y)),source.getpixel((210,y))
        for x in range(29,204):
            if ((x-116)/84)**2+((y-92)/85)**2<=1:
                rgb=tuple(round(left[c]+(right[c]-left[c])*(x-16)/194) for c in range(3))
                out.putpixel((x,y),rgb+(source.getpixel((x,y))[3],))
    out.alpha_composite(tile,(0,0))
    return out
