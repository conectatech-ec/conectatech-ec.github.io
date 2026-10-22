#!/usr/bin/env python3
"""Genera una revisión del catálogo real; no cambia main, fichas, feeds ni datos."""
import csv,html,json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
config=json.loads((ROOT/'importacion/pilotos/titulos-pro-20.json').read_text());selected=config['productos'];out=ROOT/'revision/titulos-pro-20';out.mkdir(parents=True,exist_ok=True)
base=subprocess.check_output(['git','show',config['base']+':index.html'],cwd=ROOT).decode();after=(ROOT/'index.html').read_text();rx=r'const products=(\[[\s\S]*?\]);\s*\n'
original=json.loads(re.search(rx,base)[1]);products=[next(p for p in original if p['sku']==s) for s in selected]
assert len(products)==20
for mode,source in [('antes',base),('despues',after)]:
 source=re.sub(rx,lambda m:'const products='+json.dumps(products,ensure_ascii=False,separators=(',',':'))+';\n',source,count=1)
 source=source.replace('<head>','<head><base href="https://conectatech-ec.github.io/">',1)
 def css(m):
  file=m[1].split('?')[0].lstrip('/');return '<style>'+ (ROOT/file).read_text()+'</style>'
 source=re.sub(r'<link rel="stylesheet" href="(/assets/[^\"]+)">',css,source)
 def script(m):return '<script>'+(ROOT/m[1].split('?')[0].lstrip('/')).read_text().replace('</script','<\\/script')+'</script>'
 source=re.sub(r'<script src="(/assets/[^\"]+)"\s*></script>',script,source)
 # La copia de revisión enfoca el catálogo; conserva controles y tarjetas originales.
 source=source.replace('</head>','<style>body{scroll-behavior:auto}main{padding-bottom:24px}.ct-hero,.ct-gift-unified,.trustbar,.ct-discover,.ct-commerce-strip,#destacados{display:none!important}</style></head>')
 (out/('catalogo-'+mode+'.html')).write_text(source)
rows=[]
for sku,e in selected.items():
 p=next(p for p in products if p['sku']==sku);rows.append({'SKU':sku,'Grupo':e['grupo'],'Nombre original593':e['nombre593'],'Título actual':e['tituloAnterior'],'Primera propuesta':e['tituloPrimeraPropuesta'],'Nueva propuesta identificable':e['titulo'],'Subtítulo final':e['subtitulo'],'Condición discreta':e.get('condicionTarjeta',''),'Corrección anterior':e['tituloCorreccionAnterior'],'Estado de enriquecimiento':e['estadoEnriquecimiento'],'Marca preservada':e['marca'],'Modelo preservado':e['modelo'],'Promo contado':f"{p['promo']:.2f}",'PVP':f"{p['pvp']:.2f}",'Stock':p['stock'],'URL':e['url']})
with (out/'titulos-antes-despues.csv').open('w',newline='',encoding='utf-8-sig') as f:
 w=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator="\n");w.writeheader();w.writerows(rows)
(out/'datos-comparacion.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print('Revisión real preparada: 20 productos, mismas fotos y datos; antes/después.')
