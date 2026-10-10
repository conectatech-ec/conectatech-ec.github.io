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
            p=products[sku]; c=seo.get(sku,{})
            canonical='https://conectatech-ec.github.io/productos/'+urls[sku]+'/'
            url=args.base.rstrip('/')+'/productos/'+urls[sku]+'/'
            result['url']=url
            data,status=get(url); page=Page(); page.feed(data.decode())
            schema=json.loads(page.schema)
            for label, actual, expected in (
                ('sku',schema.get('sku'),sku),('nombre',schema.get('name'),c.get('nombre',p['name'])),
                ('precio',schema['offers']['price'],f"{p['promo']:.2f}"),
                ('moneda',schema['offers']['priceCurrency'],'USD'),
                ('stock',schema['offers']['availability'],'https://schema.org/'+('InStock' if p['stock']>0 else 'OutOfStock')),
                ('canonical',page.canonical,canonical)):
                if actual != expected: raise ValueError(f'{label}: {actual!r} != {expected!r}')
            if not any(('$'+price) in data.decode() for price in (f"{p['pvp']:.2f}",f"{p['pvp']:.2f}".replace('.',','))): raise ValueError('PVP visible incorrecto')
            result.update(estado=('ficha_existente_imagen_pendiente' if c.get('imagenPendiente') or not c.get('imagen') else 'publicado_verificado') if args.base=='https://conectatech-ec.github.io' else 'verificado_local',http=status,
                          promo=p['promo'],pvp=p['pvp'],stock_catalogo=p['stock'],imagen_pendiente=bool(c.get('imagenPendiente') or not c.get('imagen')),
                          sha256_ficha=hashlib.sha256(data).hexdigest())
            if c.get('imagenPendiente') or not c.get('imagen'):
                if schema.get('image') or any('/imagenes/'+sku.lower()+'/' in (i or '') for i in page.images): raise ValueError('Se muestra imagen bloqueada por regla')
                if c.get('comercialVerificado') and 'Fotografía en actualización' not in data.decode():raise ValueError('Falta estado pendiente visible')
            else:
                image_url=urljoin('https://conectatech-ec.github.io',c['imagen'])
                if image_url not in [urljoin('https://conectatech-ec.github.io',i) for i in page.images if i] or [urljoin('https://conectatech-ec.github.io',i) for i in schema['image']] != [image_url]: raise ValueError('Referencia de imagen incorrecta')
                cover=c['imagenProfesional']; verified=[]
                for size,v in [(f"{i['posicion']:02d}-{k}",v) for i in c.get('galeria',[cover]) for k,v in i['versiones'].items()]:
                    image_data,image_status=get(args.base.rstrip('/')+v['url'])
                    if hashlib.sha256(image_data).hexdigest()!=v['sha256']: raise ValueError('Versión publicada distinta: '+size)
                    verified.append({'tamano':size,'http':image_status,'sha256':v['sha256']})
                if c.get('banner'):
                    v=c['banner'];payload,status=get(args.base.rstrip('/')+v['url'])
                    if hashlib.sha256(payload).hexdigest()!=v['sha256']:raise ValueError('Banner publicado distinto')
                    result['banner_verificado']={'url':args.base.rstrip('/')+v['url'],'http':status}
                result.update(imagen=image_url,versiones_verificadas=verified,resolucion='1200x1200')

        except Exception as exc:
            result.update(estado='error',error=str(exc))
        return result
    with ThreadPoolExecutor(max_workers=3) as pool: results=list(pool.map(check,args.sku))
    report={'fecha':datetime.now(timezone.utc).isoformat(),'resultados':results,
            'publicados':sum(x['estado']=='publicado_verificado' for x in results),
            'pendientes':sum(x['estado']=='ficha_existente_imagen_pendiente' for x in results),
            'errores':sum(x['estado']=='error' for x in results)}
    dest=Path(args.reporte);dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))
    return 1 if report['errores'] else 0

if __name__=='__main__': raise SystemExit(main())
