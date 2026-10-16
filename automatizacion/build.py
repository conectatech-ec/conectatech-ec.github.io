"""Read-only adapter: never imports the catalogue exporter (it mutates media)."""
import csv, hashlib, html, json, subprocess
from datetime import datetime, timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'automatizacion/generated'
SKUS=['MICR27','POWE003','ADAP005']
BASE='https://conectatech-ec.github.io'
def read(path): return json.loads((ROOT/path).read_text())
def build():
    feed=read('exportaciones/catalogo-ventas.json')
    sales={p['sku']:p for p in feed['productos']}
    if len(sales)!=len(feed['productos']): raise ValueError('Duplicate SKU')
    media=read('importacion/medios.json'); content=read('seo-contenido.json')
    categories={r['sku']:r['categoria'] for r in csv.DictReader((ROOT/'datos-593/inventario-publico.csv').open())}
    products=[]
    for sku in SKUS:
        p=sales[sku]; m=media[sku]; c=content[sku]
        photo=m['imagenes'][0]['versiones']['1200']
        if c['imagen']!=photo['url'] or m['imagenes'][0]['revision_regla']!=m['revision_regla']: raise ValueError('Stale media '+sku)
        if p['promo']<=0 or p['stock']<=0: raise ValueError('Unavailable '+sku)
        banner=m.get('banner')
        if banner and (banner['revision_regla']!=m['revision_regla'] or banner['portada_sha256']!=photo['sha256'] or banner.get('precios_incrustados')): banner=None
        row={**p,'nombre':c.get('nombre',p['nombre']),'categoria':categories[sku], 'descripcion':c['descripcion'], 'caracteristicas':c.get('caracteristicas',{}), 'foto':BASE+photo['url'], 'foto_sha256':photo['sha256'], 'banner':BASE+banner['url'] if banner else None, 'banner_sha256':banner['sha256'] if banner else None, 'condicion':m['regla']['autenticidad'], 'revision_regla':m['revision_regla']}
        row['anuncio']=f"{row['nombre']}\n{row['descripcion']}\nPROMO CONTADO ${p['promo']:.2f} · PVP ${p['pvp']:.2f}\nSKU {sku} · Stock referencial: {p['stock']}. Sujeto a confirmación.\n{p['url']}"
        row['id_contenido']=hashlib.sha256(json.dumps(row,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
        products.append(row)
    result={'fuente_fecha':feed['fechaCatalogo'],'fuente_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'productos':products,'relaciones':{},'nota':'Sin compatibilidades, promociones o mejoras de gama inventadas. Relaciones pendientes de validación comercial.'}
    OUT.mkdir(exist_ok=True)
    (OUT/'catalogo.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    (OUT/'anuncios.txt').write_text('\n\n'.join(p['anuncio'] for p in products)+'\n')
    cards=''.join('<article><h2>'+html.escape(p['nombre'])+'</h2><img width="280" src="'+p['foto']+'"><p>'+html.escape(p['anuncio']).replace('\n','<br>')+'</p>'+ ('<a href="'+p['banner']+'">Banner existente verificado</a>' if p['banner'] else '<p>Sin banner vigente en el registro; se reutiliza la fotografía aprobada.</p>')+'</article>' for p in products)
    (OUT/'revision.html').write_text('<!doctype html><html lang="es"><meta charset="utf-8"><title>Piloto CONECTATECH</title><style>body{font:16px system-ui;max-width:1000px;margin:2rem auto}article{padding:2rem;border:1px solid #ddd;margin:1rem}img{object-fit:contain}</style><h1>Revisión privada del piloto · 3 SKU</h1><p>Contenido preparado. Sin publicación ni reserva de stock.</p>'+cards+'</html>')
    print(json.dumps({'sku':SKUS,'banners_vigentes':sum(bool(p['banner']) for p in products),'fecha_fuente':feed['fechaCatalogo']}))
if __name__=='__main__': build()
