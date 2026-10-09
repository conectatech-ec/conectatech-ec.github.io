#!/usr/bin/env python3
"""Comprueba fichas e imágenes servidas por HTTP contra el catálogo local."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urljoin
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]

class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.capture=False; self.schema=''; self.canonical=None; self.images=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=='script' and a.get('type')=='application/ld+json': self.capture=True
        if tag=='link' and a.get('rel')=='canonical': self.canonical=a.get('href')
        if tag=='img': self.images.append(a.get('src'))
    def handle_endtag(self, tag):
        if tag=='script': self.capture=False
    def handle_data(self, data):
        if self.capture: self.schema+=data

def get(url):
    with urlopen(Request(url, headers={'User-Agent':'ConectaTech-publication-check/1.0','Cache-Control':'no-cache'}), timeout=30) as r:
        if r.status != 200: raise ValueError('HTTP '+str(r.status))
        return r.read(), r.status

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sku', nargs='+', default=['CARG050','MICR027','CARG016'])
    parser.add_argument('--base', default='https://conectatech-ec.github.io')
    parser.add_argument('--reporte', default='reportes/verificacion-publicacion.json')
    args=parser.parse_args()
    html=(ROOT/'index.html').read_text()
    products={p['sku']:p for p in json.loads(re.search(r'const products=(\[[\s\S]*?\]);\s*\n',html)[1])}
    urls=json.loads((ROOT/'seo-pages.json').read_text())
    seo=json.loads((ROOT/'seo-contenido.json').read_text())
    aliases=json.loads((ROOT/'importacion/alias-sku.json').read_text())
    def check(raw):
        sku=aliases.get(raw,raw)
        result={'solicitado':raw,'sku':sku}
        try:
            p=products[sku]; c=seo[sku]
            canonical='https://conectatech-ec.github.io/productos/'+urls[sku]+'/'
            url=args.base.rstrip('/')+'/productos/'+urls[sku]+'/'
            result['url']=url
            data,status=get(url); page=Page(); page.feed(data.decode())
            schema=json.loads(page.schema)
            for label, actual, expected in (
                ('sku',schema.get('sku'),sku),('nombre',schema.get('name'),c['nombre']),
                ('precio',schema['offers']['price'],f"{p['promo']:.2f}"),
                ('moneda',schema['offers']['priceCurrency'],'USD'),
                ('stock',schema['offers']['availability'],'https://schema.org/'+('InStock' if p['stock']>0 else 'OutOfStock')),
                ('canonical',page.canonical,canonical)):
                if actual != expected: raise ValueError(f'{label}: {actual!r} != {expected!r}')
            if ('$'+f"{p['pvp']:.2f}".replace('.',',')) not in data.decode(): raise ValueError('PVP visible incorrecto')
            image_url=urljoin('https://conectatech-ec.github.io',c['imagen'])
            if image_url not in page.images or schema['image'] != [image_url]: raise ValueError('Referencia de imagen incorrecta')
            image_data,image_status=get(args.base.rstrip('/')+c['imagen'])
            if hashlib.sha256(image_data).hexdigest()!=c['imagenOriginal']['sha256']: raise ValueError('La imagen no coincide con el original')
            result.update(estado='publicado_verificado' if args.base=='https://conectatech-ec.github.io' else 'verificado_local',http=status,http_imagen=image_status,
                          promo=p['promo'],pvp=p['pvp'],stock_catalogo=p['stock'],imagen=image_url,
                          resolucion=f"{c['imagenOriginal']['ancho']}x{c['imagenOriginal']['alto']}",sha256_imagen=c['imagenOriginal']['sha256'])
        except Exception as exc:
            result.update(estado='error',error=str(exc))
        return result
    with ThreadPoolExecutor(max_workers=3) as pool: results=list(pool.map(check,args.sku))
    report={'fecha':datetime.now(timezone.utc).isoformat(),'resultados':results,
            'publicados':sum(x['estado']=='publicado_verificado' for x in results),
            'errores':sum(x['estado']=='error' for x in results)}
    dest=Path(args.reporte);dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))
    return 1 if report['errores'] else 0

if __name__=='__main__': raise SystemExit(main())
