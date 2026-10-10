import copy, hashlib, importlib.util, json, tempfile, unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
def module(name,file):
 s=importlib.util.spec_from_file_location(name,ROOT/'scripts'/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
pipeline=module('pipeline','procesar-imagenes.py');queue=module('queue_drive','sincronizar-cola-drive.py')

class IncrementalTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name);(self.root/'importacion').mkdir()
  rule={'revision':1,'presentacion':'sin caja','autenticidad':'por verificar','instrucciones':'','evidencia_autenticidad':''}
  (self.root/'index.html').write_text('const products='+json.dumps([{'sku':'TEST001','name':'Prueba','promo':7.25,'pvp':8.5,'stock':3}])+';\n')
  for path,value in [('seo-contenido.json',{'TEST001':{}}),('seo-pages.json',{'TEST001':'test001'}),('importacion/alias-sku.json',{}),('importacion/medios.json',{}),('importacion/reglas-sku.json',{'productos':{'TEST001':rule}})]:
   (self.root/path).write_text(json.dumps(value))
  source=self.root/'source.png';Image.new('RGB',(1200,1200),'#135570').save(source)
  self.item={'posicion':1,'archivo':'source.png','sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'revision_regla':1,'modelo_revisado':True,'calidad_revisada':True,'sin_datos_privados':True,'fondo_aprobado':True,'contiene_caja':False,'fuente':'Fotografía de prueba'}
  self.manifest={'version':2,'skus':['TEST001'],'imagenes':{'TEST001':[self.item]},'aprobaciones':{'TEST001':{'estado':'APROBADO','identidad_verificada':True,'ficha_verificada':True,'uso_comercial_permitido':True}}}
 def runjob(self):
  (self.root/'manifest.json').write_text(json.dumps(self.manifest))
  pipeline.run(SimpleNamespace(root=self.root,manifiesto='manifest.json',reporte='report.json',aplicar=True,borradores=None))
  return json.loads((self.root/'report.json').read_text())
 def test_second_run_reuses_bytes(self):
  self.runjob();before=(self.root/'index.html').read_bytes()
  with patch.object(pipeline,'process',side_effect=AssertionError('No regenerar')):
   r=self.runjob()
  self.assertEqual(r['resumen']['imagenes_reutilizadas'],1);self.assertEqual(before,(self.root/'index.html').read_bytes())
 def test_invalid_update_preserves_valid_cover_and_finance(self):
  self.runjob();before=pipeline.editorial.read_catalog(self.root)[1]
  self.item['contiene_caja']=True;r=self.runjob();after=pipeline.editorial.read_catalog(self.root)[1]
  self.assertEqual(before,after);self.assertEqual(r['productos'][0]['estado'],'pendiente')
 def test_no_rights_cannot_publish(self):
  self.manifest['aprobaciones']['TEST001']['uso_comercial_permitido']=False
  r=self.runjob();self.assertEqual(r['resumen']['imagenes_listas'],0)
  self.assertFalse(pipeline.editorial.read_catalog(self.root)[1][0].get('imageUrl'))
 def test_small_image_cannot_publish(self):
  f=self.root/'source.png';Image.new('RGB',(160,160),'red').save(f);self.item['sha256']=hashlib.sha256(f.read_bytes()).hexdigest()
  self.assertEqual(self.runjob()['resumen']['imagenes_listas'],0)
 def test_queue_incremental_and_mismatch(self):
  files=[{'id':'aaa','nombre':'TEST001_20261010_010203.jpg','modificado':'1'}];rows=[['Fecha','SKU','Archivo','URL','Tipo','Presentación'],['','TEST001',files[0]['nombre'],'https://drive.google.com/file/d/aaa/view','Caja original','Con caja']]
  first=queue.synchronize(files,rows,[{'sku':'TEST001'}],{},{});second=queue.synchronize(files,rows,[{'sku':'TEST001'}],{},first)
  self.assertEqual(second['cambios'],[]);self.assertEqual(second['productos']['TEST001']['autenticidad'],'por verificar')
  files[0]['modificado']='2';self.assertEqual(queue.synchronize(files,rows,[{'sku':'TEST001'}],{},second)['cambios'],['TEST001'])
  rows[1][1]='OTHER001';self.assertEqual(queue.synchronize(files,rows,[{'sku':'TEST001'}],{},second)['productos']['TEST001']['estado'],'BLOQUEADO')

if __name__=='__main__':unittest.main()
