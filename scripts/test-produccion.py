import copy,hashlib,importlib.util,json,shutil,tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
from reglas_sku import ROOT,compatible
from PIL import Image
spec=importlib.util.spec_from_file_location('pipeline',ROOT/'scripts/procesar-imagenes.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ProductionTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
  for file in ['index.html','seo-contenido.json','seo-pages.json','importacion/alias-sku.json','importacion/reglas-sku.json','importacion/medios.json','importacion/piloto-imagenes.json']:
   dest=self.root/file;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/file,dest)
  self.manifest=json.loads((self.root/'importacion/piloto-imagenes.json').read_text())
  # Fixture histórica aislada: no depende de la política comercial vigente en producción.
  rules_path=self.root/'importacion/reglas-sku.json';rules=json.loads(rules_path.read_text());rules.pop('politica_general',None)
  for sku,items in self.manifest['imagenes'].items():
   rules['productos'][sku]['revision']=items[0]['revision_regla']
   rules['productos'][sku]['presentacion']='con caja' if sku=='CARG050' else 'sin caja'
  rules_path.write_text(json.dumps(rules))
  for images in self.manifest['imagenes'].values():
   for i in images:
    dest=self.root/i['archivo'];dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/i['archivo'],dest)
  self.before=m.editorial.financial(m.editorial.read_catalog(self.root)[1])
 def runjob(self):
  (self.root/'importacion/piloto-imagenes.json').write_text(json.dumps(self.manifest))
  m.run(SimpleNamespace(root=self.root,manifiesto='importacion/piloto-imagenes.json',aplicar=True,reporte='report.json'))
  self.assertEqual(self.before,m.editorial.financial(m.editorial.read_catalog(self.root)[1]))
  return json.loads((self.root/'report.json').read_text())
 def test_original_hashes_and_variants_and_idempotence(self):
  report=self.runjob();self.assertEqual(report['resumen']['imagenes_listas'],3)
  for images in self.manifest['imagenes'].values():
   for i in images:self.assertEqual(hashlib.sha256((self.root/i['archivo']).read_bytes()).hexdigest(),i['sha256'])
  for row in report['productos']:
   for size,v in row['imagen_profesional'].items():
    with Image.open(self.root/v['url'].lstrip('/')) as im:self.assertEqual(im.size,(int(size),int(size)))
  before=(self.root/'index.html').read_bytes();self.runjob();self.assertEqual(before,(self.root/'index.html').read_bytes())
 def test_without_box_cannot_reappear(self):
  self.manifest['imagenes']['CARG016'][0]['contiene_caja']=True
  r=self.runjob();row=next(x for x in r['productos'] if x['sku']=='CARG016');self.assertEqual(row['estado'],'pendiente')
  self.assertEqual(next(x for x in m.editorial.read_catalog(self.root)[1] if x['sku']=='CARG016')['imageUrl'],'')
 def test_rule_change_requires_new_review(self):
  path=self.root/'importacion/reglas-sku.json';r=json.loads(path.read_text());r['productos']['CARG050']['revision']+=1;r['productos']['CARG050']['presentacion']='sin caja';path.write_text(json.dumps(r))
  result=self.runjob();row=next(x for x in result['productos'] if x['sku']=='CARG050');self.assertEqual(row['estado'],'pendiente')
 def test_cross_sku_duplicate_blocked(self):
  self.manifest['imagenes']['MICR27']=[copy.deepcopy(self.manifest['imagenes']['CARG050'][0])]
  r=self.runjob();self.assertGreater(len(r['duplicados']),0);self.assertEqual(r['resumen']['imagenes_listas'],1)
 def test_thumbnail_rejected_not_upscaled(self):
  i=self.manifest['imagenes']['CARG050'][0];p=self.root/i['archivo'];Image.new('RGB',(150,150),'white').save(p);i['sha256']=hashlib.sha256(p.read_bytes()).hexdigest()
  row=next(x for x in self.runjob()['productos'] if x['sku']=='CARG050');self.assertIn('Resolución útil insuficiente','; '.join(row['pendientes']))
 def test_crop_cannot_leave_original(self):
  self.manifest['imagenes']['CARG050'][0]['recorte']=[-1,0,2000,2000]
  row=next(x for x in self.runjob()['productos'] if x['sku']=='CARG050');self.assertIn('fuera de imagen',row['pendientes'][0])
if __name__=='__main__':unittest.main()
