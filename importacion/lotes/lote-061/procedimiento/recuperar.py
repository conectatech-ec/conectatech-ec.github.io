import json,re,urllib.request,shutil,hashlib,concurrent.futures
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
root=Path.cwd();d=root/'.produccion-privada/lote-059';q=json.load(open('importacion/cola-drive.json'))['productos'];p=json.loads(re.search(r'const products\s*=\s*(\[.*?\]);',Path('index.html').read_text(),re.S)[1]);targets=['FLAS009','FLAS038','MICR08','TELF017','TELF018','TELF019','TELF020','TELF023','TELF024','TELF010','TELF011','TELE002','TELE003','JUGU081','JUGU106','JUGU068','JUGU092','JUGU133','JUGU042','JUGU075','JUGU104','JUGU088','JUGU134','JUGU095','JUGU116','JUGU036','REL069','REL046','REL065','REL041','REL059','REL031','REL050','REL012','REL067','REL016','REL063','REL034','REL060','REL070','REL062','REL033','REL014','REL038','REL066','REL057','REL042','REL056','AUDI112','AUDI097','AUDI055','AUDI109','AUDI119','AUDI081','AUDI104','AUDI113','AUDI091','AUDI088','AUDI067','AUDI034','AUDI028','PARL039','PARL040','PARL042','PARL038','FLAS005','CARG018','CARG033','CARG053','CARG054','CARG055','CARG014','CARG019']
cache={}
for f in (root/'.produccion-privada').rglob('*'):
 if f.is_file() and f.suffix.lower() in ('.jpg','.jpeg','.png','.webp'):cache.setdefault(f.name,f)
results=[]
def get(task):
 s,f=task;t=d/'fuentes'/s/f['nombre'];t.parent.mkdir(parents=True,exist_ok=True)
 if not t.exists():
  cached=cache.get(f['nombre']) or cache.get(s+'-'+f['id']+'.jpg')
  if cached:shutil.copy2(cached,t);mode='cache'
  else:
   url='https://drive.google.com/uc?export=download&id='+f['id'];req=urllib.request.Request(url,headers={'User-Agent':'CONECTATECH/1.0'})
   with urllib.request.urlopen(req,timeout=40) as r:b=r.read();status=r.status
   t.write_bytes(b);mode='drive-publico'
 else:mode='cache'
 with Image.open(t) as im:im.verify()
 return {'sku':s,'nombre':f['nombre'],'archivo':str(t.relative_to(root)),'metodo':mode,'sha256':hashlib.sha256(t.read_bytes()).hexdigest()}
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 tasks=[(s,f) for s in targets for f in q[s]['fotos']]
 for future in [pool.submit(get,t) for t in tasks]:
  try:results.append(future.result())
  except Exception as e:print('ERROR',str(e)[:160],flush=True)
(d/'descargas.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
for s in targets:
 files=list((d/'fuentes'/s).glob('*'));w=1000;cellw=500;cellh=460;out=Image.new('RGB',(w,((len(files)+1)//2)*cellh),'#eee');draw=ImageDraw.Draw(out)
 for i,f in enumerate(files):
  im=ImageOps.exif_transpose(Image.open(f)).convert('RGB');im.thumbnail((490,425));out.paste(im,(i%2*cellw,(i//2)*cellh+30));draw.text((i%2*cellw+5,i//2*cellh+4),f.name,fill='black')
 out.save(d/(s+'-referencias.jpg'))
(d/'seleccion.json').write_text(json.dumps(targets));print('Fuentes descargadas/verificadas',len(results),'SKU',len(targets),flush=True)
