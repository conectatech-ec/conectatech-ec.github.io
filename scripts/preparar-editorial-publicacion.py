"""Compila mapas incrementales verificados, sin tocar productos, precios ni páginas."""
import json,re,hashlib,unicodedata,subprocess
from pathlib import Path
from editorial_texto593 import validate as validate_text593
cfg=json.loads(Path('importacion/editorial/publicados.json').read_text());manifest=json.loads(Path('importacion/editorial/lotes/lote-'+cfg['loteActual']+'.json').read_text());html=Path('index.html').read_text();products=json.loads(re.search(r'const products=(\[[\s\S]*?\]);\s*\n',html)[1]);by={p['sku']:p for p in products};queue=json.loads(Path('reportes/editorial-selectivo/clasificacion-1170.json').read_text());states={e['sku']:e['estado'] for e in queue['cola']}
assert len(manifest['skus'])<=30 and len(set(manifest['skus']))==len(manifest['skus'])
assert cfg['criterioAprobado'] and cfg['excluirPrefijos']==['TELF','TABL']
norm=lambda s:re.sub('[^a-z0-9]','',unicodedata.normalize('NFD',s.lower()).encode('ascii','ignore').decode())
seen={};seo=json.loads(Path('seo-contenido.json').read_text())
effectivePhotos=json.loads(subprocess.check_output(['node','scripts/editorial-fotografia-efectiva.cjs'],text=True))
for sku,e in cfg['productos'].items():
 assert sku in by and not sku.startswith(('TELF','TABL')),sku
 lot=Path('importacion/editorial/lotes/lote-'+e['lote'].split('-')[-1]+'.json');m=json.loads(lot.read_text());assert len(m['skus'])<=30 and sku in m['skus'],sku
 assert e['titulo']==m['productos'][sku]['titulo'] and e['subtitulo']==m['productos'][sku]['subtitulo'],sku
 assert by[sku]['category'].lower() not in ['telefonos','tablets','celulares'],sku
 assert states[sku]=='MEJORAR TÍTULO' and e['tituloAnterior']==by[sku]['name'],sku
 assert e['titulo'] and isinstance(e['subtitulo'],str) and e['fuentes'],sku
 assert not re.search(r'producto gen[eé]rico|compatible\s*\(AAA\)',e['titulo']+' '+e['subtitulo'],re.I),sku
 assert norm(e['titulo']) not in seen,(sku,seen.get(norm(e['titulo'])));seen[norm(e['titulo'])]=sku
 for other in products:
  if other['sku']!=sku and other['sku'] not in cfg['productos']:assert norm(e['titulo'])!=norm(other['name']),(sku,other['sku'])
 assert all(not (len(norm(v))>=4 and norm(v) in norm(e['titulo'])) for v in e['subtitulo'].split('·')),sku
 # El renderer usa la portada vigente, incluida una corrección aprobada por la sesión fotográfica.
 # Se comprueban URL y bytes contra el registro fotográfico actual; la referencia editorial anterior es histórica.
 if e.get('verificacionTexto593'):validate_text593(sku,e,by[sku])
 if by[sku].get('imageUrl'):
  photo=effectivePhotos[sku]['imagenProfesional']['versiones']['1200']
  assert effectivePhotos[sku]['imagen']==by[sku]['imageUrl'],sku
  if photo['url']!=effectivePhotos[sku]['imagen']:
   approved=json.loads(Path('importacion/premium-activo.json').read_text())['productos'][sku]
   assert approved['aprobacion_visual']['aprobado_por_propietario'] is True,sku
   assert approved['ruta_publicada']==effectivePhotos[sku]['imagen'],sku
   assert approved['sha256_maestro']==hashlib.sha256(Path(approved['ruta_publicada'].lstrip('/')).read_bytes()).hexdigest(),sku
  assert photo['sha256']==hashlib.sha256(Path(photo['url'].lstrip('/')).read_bytes()).hexdigest(),sku
 else:
  assert e.get('verificacionTexto593') and not effectivePhotos[sku].get('imagen'),sku
 assert e['condicionTarjeta']==('De terceros' if seo[sku]['reglaSKU']['autenticidad']=='genérico/compatible' else ''),sku
 if cfg.get('criterioCodigosTecnicosFueraDeTitulos'):
  forbidden=cfg['criterioCodigosTecnicosFueraDeTitulos']
  for code in forbidden:
   # M2 no equivale al modelo comercial de consola M26/M27. Mantener el control
   # de referencias cortas completas sin confundirlas con otra identidad.
   text=e['titulo']+' '+e['subtitulo']
   match=re.search(r'(?<![A-Za-z0-9])'+re.escape(code)+r'(?![A-Za-z0-9])',text,re.I) if len(code)<=3 else code.casefold() in text.casefold()
   assert not match,(sku,code)
 if e.get('publicacionVerificada'):
  v=e['publicacionVerificada'];report=Path(v['informe']);assert report.is_file() and hashlib.sha256(report.read_bytes()).hexdigest()==v['sha256Informe'],sku
  data=json.loads(report.read_text());assert data['estado']=='VERIFICADO_HTTP_CHROMIUM' and sku in data['skus'],sku
# Cambios de ficha separados: no crean títulos ni resuelven la cola editorial.
for sku,u in cfg.get('actualizacionesFicha',{}).items():
 assert sku in by and not sku.startswith(('TELF','TABL')),sku
 assert u['autenticidad']==seo[sku]['reglaSKU']['autenticidad'],sku
 assert u['condicionTarjeta']==('De terceros' if u['autenticidad']=='genérico/compatible' else ''),sku
 if sku in cfg.get('tandaActual',{}).get('fichasCondicionActualizadas',[]):assert u['tituloTarjetaConservado']==cfg['productos'].get(sku,{}).get('titulo',by[sku]['name']),sku
 v=u.get('publicacionVerificada')
 if v:
  raw=Path(v['informe']).read_bytes();r=json.loads(raw)
  assert hashlib.sha256(raw).hexdigest()==v['sha256Informe'] and r['estado']=='VERIFICADO_HTTP_CHROMIUM' and sku in r['skus'],sku
# Regla expresa de marca: sólo títulos/subtítulos/tooltip; originales y búsqueda se conservan.
for sku,e in cfg['productos'].items():
 for brand in cfg.get('marcasOmitidasEnTitulosSubtitulos',[]):assert norm(brand) not in norm(e['titulo']+' '+e['subtitulo']),(sku,brand)
for p in products:
 if any(norm(brand) in norm(p['name']) for brand in cfg.get('marcasOmitidasEnTitulosSubtitulos',[])):
  assert p['sku'] in cfg['productos'],p['sku']
  assert 'Marca de referencia' in seo[p['sku']]['caracteristicas'],p['sku']
out='window.CONECTATECH_TITULOS_PRO_DATOS='+json.dumps(cfg,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')+';\n';Path('assets/editorial-titulos-datos.js').write_text(out)
# Versionar sólo estos tres recursos evita servir datos de un lote anterior.
for name in ['editorial-titulos-datos.js','editorial-titulos.js','editorial-titulos.css']:
 digest=hashlib.sha256(Path('assets',name).read_bytes()).hexdigest()[:12]
 html=re.sub(r'(/assets/'+re.escape(name)+r')(?:\?v=[a-f0-9]+)?',lambda m:m[1]+'?v='+digest,html)
Path('index.html').write_text(html)
print('Compilados',len(cfg['productos']),'SKU; máximo30/lote,0celulares/tablets y fechas sólo tras verificación pública.')
