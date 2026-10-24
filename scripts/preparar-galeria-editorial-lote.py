"""Comparativas de tarjetas reales; no genera ni edita fotografías."""
import json,re,subprocess,csv
from pathlib import Path
cfg=json.loads(Path('importacion/editorial/publicados.json').read_text());lot=json.loads(Path('importacion/editorial/lotes/lote-'+cfg['loteActual']+'.json').read_text());out=Path('revision/editorial-lote-'+cfg['loteActual']);out.mkdir(exist_ok=True,parents=True)
base=subprocess.check_output(['git','show',lot['base']+':index.html']).decode();after=Path('index.html').read_text();rx=r'const products=(\[[\s\S]*?\]);\s*\n';ps=json.loads(re.search(rx,after)[1]);selected=[next(p for p in ps if p['sku']==s) for s in lot['skus']]
for mode,source in [('antes',base),('despues',after)]:
 source=re.sub(rx,lambda m:'const products='+json.dumps(selected,ensure_ascii=False,separators=(',',':'))+';\n',source,count=1)
 source=re.sub(r'(const|let) pageSize\s*=\s*24',r'\1 pageSize=36',source)
 # Sólo en revisión se alinea la secuencia de SKU para comparar las mismas tarjetas.
 source=source.replace('const updatedAt=p=>', 'sortSelector.value="catalogo";\nconst updatedAt=p=>',1)
 source=source.replace('<head>','<head><base href="https://conectatech-ec.github.io/">',1)
 def css(m):return '<style>'+Path(m[1].split('?')[0].lstrip('/')).read_text()+'</style>'
 def js(m):return '<script>'+Path(m[1].split('?')[0].lstrip('/')).read_text().replace('</script','<\\/script')+'</script>'
 source=re.sub(r'<link rel="stylesheet" href="(/assets/[^\"]+)">',css,source);source=re.sub(r'<script src="(/assets/[^\"]+)"\s*></script>',js,source)
 source=source.replace('</head>','<style>.ct-hero,.ct-gift-unified,.trustbar,.ct-discover,.ct-commerce-strip,#destacados{display:none!important}body{scroll-behavior:auto}</style></head>')
 (out/('catalogo-'+mode+'.html')).write_text(source)
rows=[]
for p in selected:
 e=cfg['productos'][p['sku']];rows.append({'SKU':p['sku'],'Antes':p['name'],'Después':e['titulo'],'Subtítulo':e['subtitulo'],'Promo contado':p['promo'],'PVP':p['pvp'],'Stock':p['stock'],'URL':e['url']})
with (out/'antes-despues.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator='\n');w.writeheader();w.writerows(rows)
print('Comparativa preparada:30SKU reales,0celulares/tablets,fotografías y datos intactos.')
