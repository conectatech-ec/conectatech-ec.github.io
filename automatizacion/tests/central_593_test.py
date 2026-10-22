import importlib.util,json,sys,tempfile,unittest,zipfile,xml.sax.saxutils as esc
from datetime import datetime,timedelta,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from normalizar_593 import normalize,adapters,HEADERS
NOW=datetime.now(timezone.utc);LOCAL=NOW.astimezone(timezone(timedelta(hours=-5)))
def workbook(folder,rows,when=NOW,bad_header=False,extra=False):
 date=when.astimezone(timezone(timedelta(hours=-5))).strftime('%d-%m-%Y');path=Path(folder)/('Reporte-Inventario '+date+'.xlsx')
 def cell(c,n,v):return '<c r="'+c+str(n)+'" t="inlineStr"><is><t>'+esc.escape(str(v))+'</t></is></c>'
 header='<row r="4">'+''.join(cell(c,4,'bad' if bad_header and c=='Q' else v) for c,v in HEADERS.items())+'</row>'
 content=header+''.join('<row r="'+str(i)+'">'+''.join(cell(c,i,v) for c,v in row.items())+'</row>' for i,row in enumerate(rows,5))
 with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Inventario"/></sheets></workbook>')
  z.writestr('xl/worksheets/sheet1.xml','<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+content+'</sheetData></worksheet>')
  z.writestr('docProps/core.xml','<core xmlns:dcterms="http://purl.org/dc/terms/"><dcterms:created>'+when.isoformat()+'</dcterms:created></core>')
  if extra:z.writestr('xl/externalLinks/externalLink1.xml','forbidden')
 return path
def row(sku='TEST001',**overrides):return {'B':'7','C':'Producto verificado','D':sku,'F':'PRODUCTO','J':'Accesorios','Q':'2.50','X':'2.50','Y':'0.37','M':'PRIVATE_COST_MUST_NOT_EXPORT',**overrides}
BASE='sku,nombre,stock,promo_contado,pvp_final,categoria\nTEST001,Producto verificado,9,2.50,2.87,Accesorios\n'
WEB={'fechaCatalogo':NOW.isoformat(),'productos':[{'sku':'TEST001','nombre':'Producto verificado','promo':2.50,'pvp':2.87,'stock':9,'url':'https://conectatech-ec.github.io/productos/test001/'}]}
class Central593(unittest.TestCase):
 def test_exact_exported_prices_trace_dates_and_no_private_fields(self):
  with tempfile.TemporaryDirectory() as folder:
   d,r=normalize(workbook(folder,[row()]),BASE,WEB,now=NOW)
   p=d['products'][0];self.assertEqual(p['prices'],{'currency':'USD','promo_cash_cents':250,'pvp_card_cents':287});self.assertEqual(p['provenance']['cells']['pvp_vat'],'Y5');self.assertEqual(d['source']['cut_date'],LOCAL.date().isoformat());self.assertEqual(r['comparison_last_published_593']['change_counts']['stock_quantity_private'],1)
   serial=json.dumps([d,r]);self.assertNotIn('PRIVATE_COST',serial);self.assertNotIn('"stock":',serial);self.assertNotIn('"quantity":',serial)
 def test_only_conflicting_skus_block_and_zero_stock_is_not_an_ad(self):
  with tempfile.TemporaryDirectory() as folder:
   d,r=normalize(workbook(folder,[row(),row('TEST002',B='-1'),row('TEST003',Q='0'),row('TEST004',B='0'),row('SERV001',F='SERVICIO')]),BASE,WEB,now=NOW)
   by={p['sku']:p for p in d['products']};self.assertEqual(by['TEST001']['availability'],'in_stock');self.assertEqual(by['TEST004']['availability'],'out_of_stock');self.assertEqual(r['blocked_count'],3)
   channels=adapters(d,Path(folder)/'out');self.assertEqual(channels['active_products'],1)
 def test_duplicates_and_variant_changes_never_get_old_images_or_prices(self):
  with tempfile.TemporaryDirectory() as folder:
   d,r=normalize(workbook(folder,[row(),row(),row('TEST002',C='Samsung A17 256 GB')]),BASE,WEB,now=NOW);self.assertIn('DUPLICATE_SKU',d['products'][0]['blocked_reasons'])
   base=BASE.replace('Producto verificado','Samsung A17 128 GB');d,r=normalize(workbook(folder,[row(C='Samsung A17 256 GB')]),base,WEB,now=NOW);self.assertIn('VARIANT_CHANGED_REVIEW_MEDIA',d['products'][0]['blocked_reasons'])
 def test_old_future_bad_schema_and_external_links_rejected(self):
  with tempfile.TemporaryDirectory() as folder:
   for options in [{'when':NOW-timedelta(days=2)},{'when':NOW+timedelta(days=1)},{'bad_header':True},{'extra':True}]:
    with self.subTest(options=options),self.assertRaises(ValueError):normalize(workbook(folder,[row()],**options),BASE,WEB,now=NOW)
 def test_adapters_share_source_and_exclude_price_mismatches_and_quantities(self):
  with tempfile.TemporaryDirectory() as folder:
   d,r=normalize(workbook(folder,[row()]),BASE,WEB,now=NOW,media={'TEST001':'https://conectatech-ec.github.io/imagenes/test001/test.webp'});out=Path(folder)/'out';ch=adapters(d,out);self.assertEqual(ch['meta_google_candidate_rows'],1)
   for name in ['alex','web_catalog','banner_factory','pdf_categories']:self.assertEqual(json.loads((out/(name+'.json')).read_text())['source_sha256'],d['source']['sha256'])
   self.assertNotIn('sale_price',(out/'google.csv').read_text());d['products'][0]['web']['price_matches']=False;self.assertEqual(adapters(d,out)['meta_google_candidate_rows'],0)
 def test_actual_report_contract_is_sanitized_and_pilot_is_available(self):
  d=json.loads((ROOT/'central/current.json').read_text());r=json.loads((ROOT/'central/validation.json').read_text());self.assertEqual(r['unique_sku'],1554);self.assertEqual(r['blocked_count'],5);self.assertEqual(r['comparison_16_oct']['status'],'not_available_not_inferred');self.assertEqual(len(d['products']),1556)
  p={p['sku']:p for p in d['products']};self.assertEqual(p['TELF011']['prices']['promo_cash_cents'],18590);self.assertEqual(p['TELF012']['prices']['pvp_card_cents'],29988);self.assertEqual(p['POWE014']['availability'],'blocked');self.assertEqual(p['TELF019']['availability'],'out_of_stock');self.assertEqual(p['HUB003']['prices'],None)
if __name__=='__main__':unittest.main()
