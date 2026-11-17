#!/usr/bin/env python3
"""Nuevas pruebas: normalizador original → corte/recibo → publicador original.
No modifican producción, Excel reales ni otros proyectos.
"""
import copy,csv,hashlib,importlib.util,io,json,os,shutil,tempfile,unittest,zipfile
from datetime import datetime,timezone
from pathlib import Path
from xml.sax.saxutils import escape

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('preparar_revision_593',HERE/'preparar-revision-comercial-593.py')
h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
NOW=datetime(2026,11,16,22,30,tzinfo=timezone.utc)
N=1000

def workbook(folder,hour,*,cash=10,stock=1,duplicate=False,remove=0,formula=False,modified=True):
    folder.mkdir(parents=True,exist_ok=True);path=folder/'Reporte-Inventario.xlsx'
    stamp=f'2026-11-16T{hour:02d}:00:00Z'
    core=f'<core xmlns:dcterms="http://purl.org/dc/terms/"><dcterms:created>{stamp}</dcterms:created>'+ (f'<dcterms:modified>{stamp}</dcterms:modified>' if modified else '')+'</core>'
    headers={'B':'Stock','C':'Producto','D':'Cod. Principal','F':'Tipo','J':'Categoría','Q':'V. TOTAL','X':'PVP','Y':'PVP % IVA'}
    def xmlrow(number,values,form=False):
        cells=[]
        for col,value in values.items():
            cells.append(f'<c r="{col}{number}" t="inlineStr">'+('<f>1+1</f>' if form and col=='Q' else '')+f'<is><t>{escape(str(value))}</t></is></c>')
        return f'<row r="{number}">'+''.join(cells)+'</row>'
    rows=[xmlrow(4,headers)]
    order=list(range(N-remove))+([0] if duplicate else [])
    for number,index in enumerate(order,5):
        sku=f'TEST{index:04d}';values={'B':stock if index==0 else 1,'C':'Producto '+sku,'D':sku,'F':'PRODUCTO','J':'TELEFONOS','Q':cash if index==0 else 10,'X':'12.00','Y':'1.80'}
        rows.append(xmlrow(number,values,formula and index==0))
    sheet='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+''.join(rows)+'</sheetData></worksheet>'
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr('docProps/core.xml',core);z.writestr('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="INVENTARIO" sheetId="1"/></sheets></workbook>');z.writestr('xl/worksheets/sheet1.xml',sheet)
    return path

def baseline_csv():
    s=io.StringIO();w=csv.DictWriter(s,fieldnames=['sku','nombre','stock','promo_contado','pvp_final','categoria','tipo']);w.writeheader()
    for i in range(N):w.writerow({'sku':f'TEST{i:04d}','nombre':f'Producto TEST{i:04d}','stock':1,'promo_contado':'10.00','pvp_final':'13.80','categoria':'TELEFONOS','tipo':'PRODUCTO'})
    return s.getvalue()

def base_cut(excel):
    return {'fecha_corte':'2026-11-16','fuente':'Reporte-Inventario.xlsx','sha256_original':h.digest(excel),'cantidad_sku_original':N,'cantidad_sku_web':N,'productos':{f'TEST{i:04d}':{'stock':1,'promo_centavos':1000,'pvp_centavos':1380} for i in range(N)},'verificacion':dict(stock_cambiado=0,disponibilidad_cambiada=0,promo_cambiado=0,pvp_cambiado=0,precios_productos_cambiados=0)}

def state_of(cut):
    result={'tipo_corte':'comercial','fecha_corte':cut['fecha_corte'],'origen_sha256':cut['sha256_original'],'sku_web':N,'referencia':'datos-593/corte-comercial-publico-validado.json'}
    if 'revision_fuente' in cut:result['revision_fuente']=copy.deepcopy(cut['revision_fuente'])
    return result

def catalog_of(cut):
    return {'fecha_corte':cut['fecha_corte'],'fuente_sha256':cut['sha256_original'],'productos':[{'sku':sku,'nombre':'Producto '+sku,'stock':p['stock'],'promo':p['promo_centavos']/100,'pvp':p['pvp_centavos']/100,'categoria':'Telefonos','url':'https://conectatech-ec.github.io/productos/'+sku.lower()+'-producto/'} for sku,p in cut['productos'].items()]}

class PrepareOriginal(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.loader=h.original_validator(os.environ.get('NORMALIZADOR_593_ORIGINAL'))
        cls.normalizer=cls.loader.__enter__()
    @classmethod
    def tearDownClass(cls):cls.loader.__exit__(None,None,None)
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='593-integration-fixture-');self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
        self.previous=workbook(self.root/'old',15);self.cut=base_cut(self.previous);self.state=state_of(self.cut);self.catalog=catalog_of(self.cut);self.csv=baseline_csv()
    def run_prepare(self,excel,**kwargs):
        inputs={'state':self.state,'previous':self.cut,'catalog':self.catalog,'baseline_csv':self.csv,'received_at':'2026-11-16T16:02:00.708074Z','normalizer':self.normalizer,'previous_excel':self.previous,'now':NOW}
        inputs.update(kwargs);return h.prepare(excel,**inputs)
    def fake_repo(self,catalog):
        root=self.root/'publisher';(root/'scripts').mkdir(parents=True,exist_ok=True)
        for name in ['aplicar-corte-comercial-593.cjs','revisiones-comerciales-593.cjs','proteger-inventario-593.cjs','politica-publicacion-web.cjs']:
            shutil.copyfile(HERE/name,root/'scripts'/name)
        products=[{'sku':p['sku'],'stock':p['stock'],'promo':p['promo'],'pvp':p['pvp'],'name':p['nombre'],'imageUrl':'/approved.webp'} for p in catalog['productos']]
        (root/'index.html').write_text('const products='+json.dumps(products)+';\n');return root
    def test_original_normalizer_then_real_publisher_accepts_two_same_day_revisions(self):
        first=workbook(self.root/'first',16,cash=11,stock=0);root=self.fake_repo(self.catalog)
        input_before={str(p):h.digest(p) for p in [self.previous,first,root/'index.html']}
        one=self.run_prepare(first,repo=root)
        self.assertEqual(one['productos']['TEST0000'],{'stock':0,'promo_centavos':1100,'pvp_centavos':1380});self.assertEqual(one['revision_fuente']['secuencia'],1);self.assertEqual(one['revision_fuente']['generado_en'],'2026-11-16T16:00:00.000Z');self.assertEqual(one['revision_fuente']['recibido_en'],'2026-11-16T16:02:00.708Z');self.assertEqual(one['revision_fuente']['anterior_sha256'],self.cut['sha256_original'])
        for p,sha in input_before.items():self.assertEqual(h.digest(p),sha)
        state=state_of(one);catalog=catalog_of(one);root=self.fake_repo(catalog)
        second=workbook(self.root/'second',17,cash=12,stock=2)
        two=self.run_prepare(second,state=state,previous=one,catalog=catalog,previous_excel=first,received_at='2026-11-16T17:02:00Z',repo=root)
        self.assertEqual(two['revision_fuente']['secuencia'],2);self.assertEqual(two['revision_fuente']['anterior_sha256'],one['sha256_original']);self.assertEqual(two['productos']['TEST0000']['pvp_centavos'],1380)
    def test_same_sha_preserves_whole_previous_cut_without_new_receipt(self):
        before=copy.deepcopy(self.cut);out=self.run_prepare(self.previous,received_at='2026-11-16T19:00:00Z');self.assertEqual(out,before);self.assertNotIn('revision_fuente',out)
    def test_previous_sha_mismatch_rejects_bootstrap(self):
        candidate=workbook(self.root/'first',16)
        with self.assertRaisesRegex(ValueError,'PREVIOUS_XLSX_SHA_MISMATCH'):self.run_prepare(candidate,previous_excel=candidate)
    def test_no_prior_workbook_cannot_invent_bootstrap_order(self):
        candidate=workbook(self.root/'first',16)
        with self.assertRaisesRegex(ValueError,'PREVIOUS_XLSX_REQUIRED_FOR_INTRADAY_BOOTSTRAP'):self.run_prepare(candidate,previous_excel=None)
    def test_old_export_uploaded_late_does_not_replace_current(self):
        candidate=workbook(self.root/'old-again',14,cash=11)
        with self.assertRaisesRegex(ValueError,'EXPORT_NOT_STRICTLY_NEWER'):self.run_prepare(candidate,received_at='2026-11-16T20:00:00Z')
    def test_incomplete_report_rejected_by_original_guard(self):
        candidate=workbook(self.root/'partial',16,remove=700)
        with self.assertRaisesRegex(ValueError,'REPORT_BELOW_MINIMUM|INCOMPLETE_FULL'):self.run_prepare(candidate)
    def test_duplicate_sku_rejected_by_original_validation(self):
        candidate=workbook(self.root/'duplicates',16,duplicate=True)
        with self.assertRaisesRegex(ValueError,'DUPLICATE_SKU'):self.run_prepare(candidate)
    def test_formula_in_candidate_not_promoted(self):
        candidate=workbook(self.root/'formula',16,formula=True)
        with self.assertRaisesRegex(ValueError,'FORMULA_IN_COMMERCIAL_FIELD'):self.run_prepare(candidate)
    def test_uncertain_core_timestamp_not_filled_from_reception(self):
        candidate=workbook(self.root/'no-modified',16,modified=False)
        with self.assertRaisesRegex(ValueError,'REPORT_CUT_DATE_UNCONFIRMED'):self.run_prepare(candidate)
    def test_canonical_source_link_conflict_is_rejected(self):
        candidate=workbook(self.root/'first',16)
        with self.assertRaisesRegex(ValueError,'PREVIOUS_CUT_STATE_MISMATCH'):self.run_prepare(candidate,state={**self.state,'origen_sha256':'f'*64})
    def test_old_csv_identity_recovered_only_from_verified_previous_excel(self):
        candidate=workbook(self.root/'first',16)
        stale=self.csv.replace('Producto TEST0000','Nombre antiguo TEST0000')
        out=self.run_prepare(candidate,baseline_csv=stale);self.assertEqual(out['cantidad_sku_web'],N)
        with self.assertRaisesRegex(ValueError,'IDENTITY_NAME_CHANGED_REVIEW'):self.run_prepare(candidate,baseline_csv=stale,previous_excel=None)
    def test_unverified_validator_code_never_executes(self):
        folder=self.root/'untrusted';folder.mkdir();(folder/'report_identity.py').write_text("raise RuntimeError('UNTRUSTED_CODE_EXECUTED')")
        with self.assertRaisesRegex(ValueError,'ORIGINAL_VALIDATOR_SHA_MISMATCH'):
            with h.original_validator(folder/'normalizar_593.py'):self.fail('Should not import unverified source')

if __name__=='__main__':unittest.main()
