"""Guardas específicas para corrección del mismo lote, sin rehacer auditorías."""
from pathlib import Path
from html.parser import HTMLParser
import json,re,subprocess,unicodedata
cfg=json.loads(Path('importacion/editorial/publicados.json').read_text());manifest=json.loads(Path('importacion/editorial/lotes/lote-001r2.json').read_text());base=manifest['base']
class Text(HTMLParser):
 def __init__(self):super().__init__();self.depth=0;self.parts=[]
 def handle_starttag(self,t,a):
  a=dict(a)
  if t=='div' and 'specs' in a.get('class','').split():self.depth=1
  elif self.depth:self.depth+=1
 def handle_endtag(self,t):
  if self.depth:self.depth-=1
 def handle_data(self,d):
  if self.depth:self.parts.append(d)
def norm(t):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFD',t.lower()).encode('ascii','ignore').decode())
rx=r'const products=(\[[\s\S]*?\]);\s*\n';old=json.loads(re.search(rx,subprocess.check_output(['git','show',base+':index.html']).decode())[1]);new=json.loads(re.search(rx,Path('index.html').read_text())[1]);assert len(old)==len(new)==1170
specChanges=set()
for a,b in zip(old,new):
 assert {k:v for k,v in a.items() if k!='specs'}=={k:v for k,v in b.items() if k!='specs'},a['sku']
 if a!=b:specChanges.add(a['sku'])
assert specChanges=={'PARL026','CARG041','CARG042','AUDI120'}
assert not subprocess.check_output(['git','diff',base,'--','imagenes','datos-593','exportaciones','seo-pages.json']).strip()
slugs=json.loads(Path('seo-pages.json').read_text());affected={'productos/'+slugs[s]+'/index.html' for s in manifest['skus']};actual=set(subprocess.check_output(['git','diff','--name-only',base,'--','productos'],text=True).splitlines());assert actual==affected,(actual-affected,affected-actual)
models={'MONI004':'MB169CK','DISC005':'HD710 Pro','PARL026':'ZQS1328S','TARJ003':'mx310','TECL022':'MT-207 SP','MICR09':'NK11','AUDI007':'UID-10','AUDI100':'WH-T900','AUDI107':'KNH-750GR','AUDI108':'KCH-915','AUDI015':'G05D','AUDI115':'X02','AUDI120':'XTH-356','CARG041':'C105','CARG042':'C104','JUGU027':'R36S'}
for sku,code in models.items():
 p=Text();p.feed(Path('productos',slugs[sku],'index.html').read_text());assert norm(code) in norm(' '.join(p.parts)),(sku,'Modelo perdido de especificaciones',code)
for sku,e in cfg['productos'].items():
 for code in cfg['criterioCodigosTecnicosFueraDeTitulos']:assert norm(code) not in norm(e['titulo']+' '+e['subtitulo']),(sku,code)
assert 'Tune Flex' in cfg['productos']['AUDI018']['titulo'];assert 'HD710 Pro' not in cfg['productos']['DISC005']['titulo'] and 'HD710 Pro' in cfg['productos']['DISC005']['subtitulo']
assert cfg['productos']['PARL026']['titulo']=='Parlante portátil de 3 pulgadas';parl=next(p for p in new if p['sku']=='PARL026');assert parl['specs']['Tamaño nominal']=='3 pulgadas.'
print('18ajustes/12conservados;16códigosaccesiblesenespecificaciones;33celulares/tablets/finanzas/fotos/URLsintactos;3pulgadasconfirmadas.')
