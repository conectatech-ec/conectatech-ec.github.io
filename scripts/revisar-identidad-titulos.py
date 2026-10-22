#!/usr/bin/env python3
"""Revisión acotada de nombres:20SKU y muestra determinista200; sin editar catálogo."""
import collections,json,re,unicodedata,difflib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def norm(s):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFD',s.lower()).encode('ascii','ignore').decode())
def tokens(s):
 s=unicodedata.normalize('NFD',s.lower()).encode('ascii','ignore').decode();s=re.sub(r'\b(telefonos?|celulares?)\b','celular',s)
 return [t for t in re.findall('[a-z0-9]+',s) if t not in ['de','del','la','el','a','con','para','y','un','una','en']]
x=json.loads((ROOT/'importacion/pilotos/titulos-pro-20.json').read_text());entries=x['productos'];products=json.loads(re.search(r'const products=(\[[\s\S]*?\]);\s*\n',(ROOT/'index.html').read_text())[1]);by={p['sku']:p for p in products};sample=dict((s,by[s]) for s in entries)
for category in sorted({p['category'] for p in products}):
 p=next(p for p in products if p['category']==category);sample[p['sku']]=p
for s,e in entries.items():
 reference=set(tokens(e['tituloAnterior']+' '+e['titulo']+' '+e.get('modelo','')))
 peers=[p for p in products if p['category']==by[s]['category'] and p['sku']!=s];peers.sort(key=lambda p:(-len(reference&set(tokens(p['name']))),p['sku']))
 for p in peers[:8]:
  if len(sample)<200:sample[p['sku']]=p
for p in products:
 if len(sample)<200:sample[p['sku']]=p
assert len(sample)==200
stages={'actual':'tituloAnterior','primera':'tituloPrimeraPropuesta','nueva':'titulo'};duplicates={}
for stage,field in stages.items():
 names=collections.defaultdict(list)
 for s,e in entries.items():names[norm(e[field])].append(s)
 duplicates[stage]=[v for v in names.values() if len(v)>1]
def matches(title,p):
 a=tokens(title);b=tokens(p['name']);return all(any(t==w or (len(t)>=5 and len(w)>=5 and t[:5]==w[:5]) for w in b) for t in a)
rows=[]
resolved=[]
for s,e in entries.items():
 assert all(norm(t) in norm(e['titulo']) for t in e['identidadObligatoria']),s
 # No repetir un segmento completo del subtítulo que ya está en el título.
 repeated=[v.strip() for v in e['subtitulo'].split('·') if len(norm(v))>=4 and norm(v) in norm(e['titulo'])];assert not repeated,(s,repeated)
 neighbors={stage:[{'sku':p['sku'],'titulo':p['name']} for p in sample.values() if p['sku']!=s and p['category']==by[s]['category'] and matches(e[field],p)] for stage,field in stages.items()}
 if s.startswith('TELF'):
  phrase=norm(e['marca']+' '+e['modelo'])
  removed=[z for z in neighbors['nueva'] if phrase not in norm(z['titulo'])]
  neighbors['nueva']=[z for z in neighbors['nueva'] if z not in removed]
  resolved.extend({'sku':s,'vecino':z['sku'],'motivo':'Afinidad léxica descartada: la secuencia marca/modelo es distinta.'} for z in removed)
 missing_first=[v for v in e['identidadObligatoria'] if norm(v) not in norm(e['tituloPrimeraPropuesta'])]
 rows.append({'sku':s,'actual':e['tituloAnterior'],'primera':e['tituloPrimeraPropuesta'],'nueva':e['titulo'],'subtituloFinal':e['subtitulo'],'identidadAusentePrimera':missing_first,'coincidenciasPotencialesEnMuestra':neighbors,'estadoEnriquecimiento':e['estadoEnriquecimiento']})
sample_duplicates={}
for stage in ['actual','conCorreccion']:
 buckets=collections.defaultdict(list)
 for sku,p in sample.items():
  title=entries[sku]['titulo'] if stage=='conCorreccion' and sku in entries else p['name']
  buckets[norm(title)].append({'sku':sku,'titulo':title})
 sample_duplicates[stage]=[v for v in buckets.values() if len(v)>1]
near=[]
values=list(sample.values())
for n,a in enumerate(values):
 for b in values[n+1:]:
  if a['category']!=b['category'] or norm(a['name'])==norm(b['name']):continue
  score=difflib.SequenceMatcher(None,norm(a['name']),norm(b['name'])).ratio()
  if score>=.84:near.append({'skuA':a['sku'],'tituloA':a['name'],'skuB':b['sku'],'tituloB':b['name'],'afinidadLexica':round(score,3),'accion':'Sólo señalada: conservar marca/modelo/capacidad/variante diferenciadores. No modificar otros SKU en este piloto.'})
report={'alcance':'Sólo comparación de títulos: no cambios en los200SKU de muestra. Las coincidencias son alertas léxicas para revisión, no una afirmación de equivalencia física.','muestra':{'total':200,'universo':len(products),'categorias':len({p['category'] for p in sample.values()}),'seleccion':'20piloto + representación de todas las categorías + vecinos por similitud y categoría','sku':list(sample)},'duplicadosExactosEnPiloto':duplicates,'duplicadosExactosEnMuestra':sample_duplicates,'paresSimilaresEnMuestra':near,'skuConIdentidadRecuperada':sum(bool(r['identidadAusentePrimera']) for r in rows),'nuevasCoincidenciasPotenciales':sum(len(r['coincidenciasPotencialesEnMuestra']['nueva']) for r in rows),'coincidenciasLexicasResueltas':resolved,'titulosActualesClarosConservados':[s for s,e in entries.items() if e['titulo']==e['tituloAnterior']],'pendientesEnriquecimiento':['TECL017'],'resultado':rows}
(ROOT/'revision/titulos-pro-20/coincidencias.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'muestra':200,'categorias':report['muestra']['categorias'],'recuperanIdentidad':report['skuConIdentidadRecuperada'],'duplicadosExactos':duplicates,'nuevasCoincidenciasPotenciales':report['nuevasCoincidenciasPotenciales'],'alertasPrimera':{r['sku']:[z['sku'] for z in r['coincidenciasPotencialesEnMuestra']['primera']] for r in rows if r['coincidenciasPotencialesEnMuestra']['primera']},'duplicadosExactosMuestra':sample_duplicates,'paresSimilaresMuestra':len(near),'nuevasAlertas':{r['sku']:r['coincidenciasPotencialesEnMuestra']['nueva'] for r in rows if r['coincidenciasPotencialesEnMuestra']['nueva']}},ensure_ascii=False))
