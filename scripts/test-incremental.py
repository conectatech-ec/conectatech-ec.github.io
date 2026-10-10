import copy, hashlib, importlib.util, json, tempfile, unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
def module(name,file):
 s=importlib.util.spec_from_file_location(name,ROOT/'scripts'/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
pipeline=module('pipeline','procesar-imagenes.py');queue=module('queue_drive','sincronizar-cola-drive.py')
rules=module('rules_registration','reglas_sku.py')

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
 def test_owner_classification_is_persistent_without_approving_photo_rights(self):
  policy={'confirmado_por_propietario':True,'fecha_confirmacion':'2026-10-10',
   'documento_url':'https://docs.google.com/spreadsheets/d/test','pestana':'Registro',
   'valores_tipo':{'Original':'original verificado','Caja original':'original verificado','AAA (genérico)':'genérico/compatible'}}
  rows=[['Fecha','SKU','Archivo','URL','Tipo','Presentación'],['','TEST001','TEST001.jpg','','Caja original','Con caja']]
  updates,issues=rules.registration_rules(rows,['TEST001'],{},policy)
  self.assertFalse(issues);self.assertEqual(len(rules.apply_rows(updates,True,self.root)),1)
  registered=rules.rule('TEST001',self.root)
  self.assertEqual(registered['autenticidad'],'original verificado');self.assertEqual(registered['presentacion'],'sin caja')
  self.assertIn('filas 2',registered['evidencia_autenticidad'])
  self.assertEqual(rules.apply_rows(updates,True,self.root),[])
  self.item['revision_regla']=registered['revision'];self.manifest['aprobaciones']['TEST001']['uso_comercial_permitido']=False
  self.assertEqual(self.runjob()['resumen']['imagenes_listas'],0)
 def test_original_generic_conflict_and_similar_sku_require_review(self):
  policy={'confirmado_por_propietario':True,'fecha_confirmacion':'2026-10-10',
   'documento_url':'https://docs.google.com/spreadsheets/d/test','pestana':'Registro',
   'valores_tipo':{'Original':'original verificado','Caja original':'original verificado','AAA (genérico)':'genérico/compatible'}}
  rows=[['Fecha','SKU','Archivo','URL','Tipo','Presentación'],['','TEST001','TEST001.jpg','','Original',''],['','TEST001','TEST001-02.jpg','','AAA (genérico)','']]
  updates,issues=rules.registration_rules(rows,['TEST001'],{},policy)
  self.assertFalse(updates);self.assertEqual(issues[0]['sku'],'TEST001')
  rows.pop();rows[1][2]='TEST01.jpg'
  self.assertFalse(rules.registration_rules(rows,['TEST001'],{},policy)[0])
  with self.assertRaises(ValueError):rules.registration_rules(rows,['TEST001'],{},{})
 def test_queue_saves_selected_registration_without_approving_publication(self):
  registry=rules.load(self.root);registry['politica_general']={'autenticidad_registro':{
   'confirmado_por_propietario':True,'fecha_confirmacion':'2026-10-10',
   'documento_url':'https://docs.google.com/spreadsheets/d/test','pestana':'Registro',
   'valores_tipo':{'Caja original':'original verificado'}}}
  (self.root/'importacion/reglas-sku.json').write_text(json.dumps(registry))
  files=[{'id':'aaa','nombre':'TEST001.jpg','modificado':'1'}]
  rows=[['Fecha','SKU','Archivo','URL','Tipo','Presentación'],['','TEST001','TEST001.jpg','https://drive.google.com/file/d/aaa/view','Caja original','Con caja']]
  for name,value in [('files.json',files),('rows.json',rows)]: (self.root/name).write_text(json.dumps(value))
  args=['queue','--inventario',str(self.root/'files.json'),'--registro',str(self.root/'rows.json'),
        '--estado',str(self.root/'state.json'),'--lote',str(self.root/'lot.json')]
  with patch.object(queue,'ROOT',self.root),patch('sys.argv',args):queue.main()
  self.assertEqual(rules.rule('TEST001',self.root)['autenticidad'],'original verificado')
  lot=json.loads((self.root/'lot.json').read_text());self.assertEqual(lot['skus'],['TEST001']);self.assertEqual(lot['aprobaciones'],{})
  before=(self.root/'importacion/reglas-sku.json').read_bytes()
  with patch.object(queue,'ROOT',self.root),patch('sys.argv',args):queue.main()
  self.assertEqual(before,(self.root/'importacion/reglas-sku.json').read_bytes())
  self.assertEqual(json.loads((self.root/'lot.json').read_text())['skus'],[])

if __name__=='__main__':unittest.main()
