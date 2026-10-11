import json,hashlib,re,sys
from pathlib import Path
lot=sys.argv[1];L=Path('importacion/lotes')/lot;R=Path('reportes')/lot;m=json.load(open(L/(sys.argv[2] if len(sys.argv)>2 else 'manifiesto-aprobados.json')));report=json.load(open(R/'qa-local/movil.json'));assert not report['errores_herramienta'];rows={x['sku']:x for x in report['resultados']};assert len(rows)==len(report['resultados'])
for sku in m['skus']:
 r=rows[sku];assert r['estado']=='VERIFICADO' and not r['errores'] and all(v is True for v in r['verificaciones'].values())
 for file,digest in [('archivo','sha256'),('archivo_html','sha256_html')]:assert hashlib.sha256(Path(r[file]).read_bytes()).hexdigest()==r[digest]
 p=Path(m['contratos'][sku]);c=json.loads(p.read_text());assert r['url']==c['url_publica'];c['validaciones']['movil']=r;p.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n')
b=json.load(open('.produccion-privada/lote-062/baseline.json'));p=json.loads(re.search(r'const products\s*=\s*(\[.*?\]);',Path('index.html').read_text(),re.S)[1]);a={x['sku']:x for x in b['productos']};assert len(p)==len(a)
for x in p:
 for k in ['sku','category','stock','promo','pvp','priority','role']:assert x.get(k)==a[x['sku']].get(k),(x['sku'],k)
expected_titles={s:json.load(open(m['contratos'][s]))['titulo_comercial'] for s in m['skus']}
for x in p: assert x['name']==expected_titles.get(x['sku'],a[x['sku']]['name']),(x['sku'],'titulo')
assert json.load(open('seo-pages.json'))==b['urls']
seo=json.load(open('seo-contenido.json'))
for sku,old in b['seo'].items():
 if old.get('descripcion') and sku not in m['skus']:assert seo[sku]['descripcion']==old['descripcion'],sku
for name,digest in b['originales'].items():assert hashlib.sha256(Path(name).read_bytes()).hexdigest()==digest,name
(R/'invariantes.json').write_text(json.dumps({'productos_verificados':len(p),'datos_comerciales_urls_intactos':True,'descripciones_anteriores_intactas':True,'originales_previos_intactos':len(b['originales'])},indent=2)+'\n')
print({'moviles_validados':len(m['skus']),'productos_inmutables':len(p)})
