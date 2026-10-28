import csv,json,tempfile,unittest
from pathlib import Path
from reglas_sku import registration_rules,commercial_brand,source_resolution_allowed

class OwnerPolicy(unittest.TestCase):
 def test_native_principal_requires_exact_owner_pin(self):
  digest='a'*64
  r={'principal_propietario':{'sha256':digest,'usar_pixels_nativos':True,'evidencia':'Portada elegida expresamente por el propietario'}}
  self.assertTrue(source_resolution_allowed(600,600,digest,r))
  self.assertFalse(source_resolution_allowed(600,600,'b'*64,r))
  self.assertFalse(source_resolution_allowed(300,300,digest,r))
  self.assertFalse(source_resolution_allowed(600,600,digest,{}))
 def test_five_brands_aaa_only_and_other_brands_original(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);(root/'datos-593').mkdir();(root/'importacion').mkdir()
   products={'AUDI001':'JBL Tune','AUDI002':'Samsung Galaxy Buds','AUDI003':'Apple AirPods','AUDI004':'Bose QuietComfort','AUDI005':'Lenovo Thinkplus','AUDI006':'Sony WH','CARG001':'Yantech USB C','TELF001':'Samsung Galaxy A17'}
   with (root/'datos-593/inventario-publico.csv').open('w') as f:
    w=csv.DictWriter(f,fieldnames=['sku','nombre']);w.writeheader();w.writerows({'sku':s,'nombre':n} for s,n in products.items())
   (root/'importacion/reglas-sku.json').write_text(json.dumps({'productos':{s:{} for s in products}}))
   policy={'confirmado_por_propietario':True,'modo':'ORIGINAL_POR_DEFECTO_EXCEPTO_MARCAS_AAA','marcas_excepcion_aaa':['JBL','SAMSUNG','APPLE','BOSE','LENOVO'],'fecha_confirmacion':'2026-10-11','documento_url':'https://docs.google.com/spreadsheets/d/test','valores_tipo':{}}
   rows=[['Fecha','SKU','Archivo','URL','Tipo','Presentación']]+[['',s,s+' - PRINCIPAL.png','','AAA (genérico)' if s!='TELF001' else 'Caja original','Sin caja'] for s in products]
   updates,issues=registration_rules(rows,list(products),{},policy,root);result={x['sku']:x['autenticidad'] for x in updates};self.assertFalse(issues)
   for s in list(products)[:5]:self.assertEqual(result[s],'genérico/compatible')
   for s in list(products)[5:]:self.assertEqual(result[s],'original verificado')
   # Una confirmación individual posterior prevalece sobre caja/defecto y marca.
   policy['confirmaciones_sku_propietario']={'AUDI006':{'autenticidad':'genérico/compatible','evidencia_autenticidad':'Confirmación expresa: Sony de esteSKU esAAA.'}}
   updates,_=registration_rules(rows,list(products),{},policy,root)
   result={x['sku']:x for x in updates}
   self.assertEqual(result['AUDI006']['autenticidad'],'genérico/compatible')
   self.assertEqual(result['AUDI006']['evidencia_autenticidad'],policy['confirmaciones_sku_propietario']['AUDI006']['evidencia_autenticidad'])
   self.assertEqual(result['TELF001']['autenticidad'],'original verificado')
 def test_unknown_brand_is_not_assumed_protected(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);(root/'importacion').mkdir();(root/'importacion/reglas-sku.json').write_text('{"productos":{"TEST001":{}}}')
   self.assertIsNone(commercial_brand('TEST001',root))

 def test_owner_sam_alias_respects_registration_condition(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);(root/'datos-593').mkdir();(root/'importacion').mkdir()
   products={'CARG001':'CARGADOR POWER TRIO SAM','CARG002':'CARGADOR 45W SAM','CARG003':'CARGADOR SAMSON','CARG004':'CARGADOR XIA'}
   with (root/'datos-593/inventario-publico.csv').open('w') as f:
    w=csv.DictWriter(f,fieldnames=['sku','nombre']);w.writeheader();w.writerows({'sku':s,'nombre':n}for s,n in products.items())
   (root/'importacion/reglas-sku.json').write_text(json.dumps({'productos':{s:{}for s in products}}))
   self.assertEqual(commercial_brand('CARG001',root),'SAMSUNG')
   self.assertIsNone(commercial_brand('CARG003',root))
   self.assertIsNone(commercial_brand('CARG004',root))
   policy={'confirmado_por_propietario':True,'modo':'ORIGINAL_POR_DEFECTO_EXCEPTO_MARCAS_AAA','marcas_excepcion_aaa':['JBL','SAMSUNG','APPLE','BOSE','LENOVO'],'fecha_confirmacion':'2026-10-27','documento_url':'https://docs.google.com/spreadsheets/d/test','valores_tipo':{}}
   rows=[['Fecha','SKU','Archivo','URL','Tipo','Presentación']]+[['',s,s+' - PRINCIPAL.png','','Caja original'if s=='CARG002'else'AAA (genérico)','Sin caja']for s in products]
   updates,issues=registration_rules(rows,list(products),{},policy,root);self.assertFalse(issues);result={x['sku']:x['autenticidad']for x in updates}
   self.assertEqual(result['CARG001'],'genérico/compatible')
   for s in ['CARG002','CARG003','CARG004']:self.assertEqual(result[s],'original verificado')

if __name__=='__main__':unittest.main()
