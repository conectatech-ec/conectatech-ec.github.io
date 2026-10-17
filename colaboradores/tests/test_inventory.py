import unittest, tempfile, zipfile, datetime, json, sqlite3, importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('inventory',Path(__file__).parents[1]/'scripts/import_inventory.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class ImportTests(unittest.TestCase):
 def workbook(self, path, price='10', stock='2', duplicate=False):
  def row(n,values):return '<row>'+''.join(f'<c r="{col}{n}" t="inlineStr"><is><t>{v}</t></is></c>' for col,v in zip('ABCDE',values))+'</row>'
  headers=row(1,['Código','Contado','PVP','Existencia','Costo privado'])
  record=['POWE003',price,'12',stock,'987654.32']
  sheet='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+headers+row(2,record)+(row(3,record) if duplicate else '')+'</sheetData></worksheet>'
  with zipfile.ZipFile(path,'w') as z:
   z.writestr('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Inventario" sheetId="1" r:id="rId1"/></sheets></workbook>')
   z.writestr('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>')
   z.writestr('xl/worksheets/sheet1.xml',sheet)
 def test_import_and_stock_zero_and_cost_exclusion(self):
  with tempfile.TemporaryDirectory() as tmp:
   path=Path(tmp)/'Reporte-Inventario al 16-10-2026.xlsx';self.workbook(path)
   mapping={'sku':'Código','promo':'Contado','pvp':'PVP','stock':'Existencia'}
   editorial=json.loads((Path(__file__).parents[1]/'data/piloto-editorial.json').read_text());until=int(datetime.datetime.now(datetime.timezone.utc).timestamp())+86400
   sql=module.build(path,mapping,editorial,until);self.assertNotIn('987654',sql);self.assertNotIn('Costo privado',sql)
   db=sqlite3.connect(':memory:');db.executescript((Path(__file__).parents[1]/'migrations/0001.sql').read_text());db.executescript(sql);self.assertEqual(db.execute('select promo,available from products').fetchone(),(10,1))
   old=db.execute('select inventory_digest from products').fetchone()[0]
   self.workbook(path,stock='5');db.executescript(module.build(path,mapping,editorial,until));self.assertEqual(db.execute('select inventory_digest from products').fetchone()[0],old)
   self.workbook(path,stock='0');db.executescript(module.build(path,mapping,editorial,until));self.assertEqual(db.execute('select available from products').fetchone()[0],0)
   self.workbook(path,duplicate=True)
   with self.assertRaises(ValueError):module.build(path,mapping,editorial,until)
   with self.assertRaises(ValueError):module.build(path,mapping,editorial,1)
 def test_reject_legacy_csv(self):
  with self.assertRaises(ValueError):module.build(Path('inventario-publico.csv'),{},[],0)

 def test_real_layout_header_offset_and_explicit_tax_amount(self):
  with tempfile.TemporaryDirectory() as tmp:
   path=Path(tmp)/'Reporte-Inventario al 16-10-2026.xlsx';self.workbook(path,price='33.01')
   with zipfile.ZipFile(path) as z:parts={n:z.read(n) for n in z.namelist()}
   sheet=parts['xl/worksheets/sheet1.xml'].decode().replace('<sheetData>','<sheetData><row><c r="A1" t="inlineStr"><is><t>INVENTARIO</t></is></c></row><row></row><row></row>').replace('</row></sheetData>','<c r="F5" t="inlineStr"><is><t>4.95</t></is></c></row></sheetData>').replace('<t>Costo privado</t></is></c></row>','<t>Costo privado</t></is></c><c r="F4" t="inlineStr"><is><t>IVA PVP</t></is></c></row>')
   parts['xl/worksheets/sheet1.xml']=sheet.encode()
   with zipfile.ZipFile(path,'w') as z:
    for n,b in parts.items():z.writestr(n,b)
   mapping={'sku':'Código','promo':'Contado','pvp':'PVP','pvp_tax':'IVA PVP','stock':'Existencia'}
   until=int(datetime.datetime.now(datetime.timezone.utc).timestamp())+86400
   editorial=json.loads((Path(__file__).parents[1]/'data/piloto-editorial.json').read_text())
   sql=module.build(path,mapping,editorial,until)
   db=sqlite3.connect(':memory:');db.executescript((Path(__file__).parents[1]/'migrations/0001.sql').read_text());db.executescript(sql)
   self.assertEqual(db.execute('select promo,pvp from products').fetchone(),(33.01,16.95))
