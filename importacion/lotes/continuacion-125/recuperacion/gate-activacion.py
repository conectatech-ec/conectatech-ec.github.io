import json,re,subprocess,hashlib
from pathlib import Path
W=Path('work/produccion125');R=Path('reportes/continuacion-125');S='TECL028';rx=r'const products=(\[[\s\S]*?\]);\s*\n'
g=lambda *x:subprocess.check_output(['git',*x])
read=lambda p:json.loads(Path(p).read_text())
ci=read(W/'ci-activacion.json');assert ci['resultado']=='success';head=ci['head'];assert head==g('rev-parse','HEAD').decode().strip()
res=read(R/'recursos-http.json');assert res['verificados']==3 and all(x['estado']=='VERIFICADO'for x in res['resultados'])
main=g('rev-parse','origin/main').decode().strip();tree=g('merge-tree','--write-tree',main,head).decode().splitlines()[0]
changed=g('diff','--name-only',main,tree).decode().splitlines();slug=read('seo-pages.json')[S];pdp='productos/'+slug+'/index.html'
allowed={'index.html','seo-contenido.json','importacion/cola-drive.json','importacion/medios.json','importacion/contratos/'+S+'.json','importacion/lote-activo.json',pdp}
assert all(p in allowed or p.startswith('importacion/lotes/continuacion-125/')or p.startswith('reportes/continuacion-125/')for p in changed),changed
old=g('show',main+':index.html').decode();new=g('show',tree+':index.html').decode();b={p['sku']:p for p in json.loads(re.search(rx,old)[1])};a={p['sku']:p for p in json.loads(re.search(rx,new)[1])}
assert len(a)==len(b)==1198 and all(a[s]==b[s]for s in b if s!=S)
assert {k for k in set(a[S])|set(b[S])if a[S].get(k)!=b[S].get(k)}=={'imageUrl','specs','searchTerms'}
assert re.sub(rx,'const products=[];\n',old)==re.sub(rx,'const products=[];\n',new)
for f in ['seo-contenido.json','importacion/medios.json','importacion/cola-drive.json']:
 x=json.loads(g('show',main+':'+f));y=json.loads(g('show',tree+':'+f));x=x.get('productos',x);y=y.get('productos',y);assert all(y[s]==v for s,v in x.items()if s!=S),f
for f in ['assets/catalogo-publicado.js','importacion/actualizaciones-sku.json','importacion/editorial/publicados.json','datos-593/inventario-publico.csv','datos-593/corte-comercial-publico-validado.json','importacion/reglas-sku.json','seo-pages.json']:
 assert g('show',main+':'+f)==g('show',tree+':'+f),f
assert hashlib.sha256(g('show',tree+':'+pdp)).hexdigest()==hashlib.sha256(Path(pdp).read_bytes()).hexdigest()
report={'main':main,'head':head,'tree':tree,'CI':ci,'recursosHTTP':3,'otrosProductosYFechasConservados':1197,'preciosStock593URLsReglasConservados':True,'archivosPropios':changed}
(W/'gate-activacion-main.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('Gate activación:CI finalSUCCESS;3WebP públicos;1197otrosproductos/PDPs,fechas,finanzas yURLs conservados.')
