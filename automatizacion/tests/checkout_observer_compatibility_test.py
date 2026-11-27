"""Cross-integration checks only: PR416 installer + PR396 source evidence.

No provider, Google, receiver or GitHub writes. All inventory inputs are synthetic.
"""
import contextlib,hashlib,importlib.util,io,json,os,shutil,subprocess,tempfile,unittest,zipfile
from dataclasses import replace
from datetime import datetime,timedelta,timezone
from pathlib import Path
from types import SimpleNamespace
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[2]
REFERENCE=Path(os.environ['OBS593_REFERENCE']).resolve()
PRODUCER=Path(os.environ['CHECKOUT_593_PRODUCER']).resolve()
VALIDATOR=Path(os.environ['NORMALIZADOR_593_ORIGINAL']).resolve().parent
def module(name,path):
    s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
install=module('observer_install',REFERENCE/'install-receiver.py')
repair=module('observer_repair',REFERENCE/'repair-auth.py')
entry=module('observer_entry',REFERENCE/'publisher-entry.py')
fixtures=module('observer_source_fixture',PRODUCER/'test-preparar-revision-comercial-593.py')
from scoped_content import Part,Bundle
sha=lambda b:hashlib.sha256(b).hexdigest()
def original(name):return subprocess.check_output(['git','show','60f05e9f3c566a9f3b75193b2746b6cf4e194d3d:automatizacion/'+name],cwd=ROOT)

class Compatibility(unittest.TestCase):
    def bundle(self):
        shared=(ROOT/'automatizacion/revision-checkout/fuente-automatica-593/shared-hub.mjs').read_bytes()
        bodies={'worker.mjs':(REFERENCE/'base/worker-installed.mjs').read_bytes(),
            'commercial-reception.mjs':(REFERENCE/'base/commercial-reception-installed.mjs').read_bytes(),
            'shared-hub.mjs':shared,'checkout-entry.mjs':original('checkout-entry.mjs'),
            'checkout-store.mjs':original('checkout-store.mjs'),
            'central-data.mjs':b'PRIVATE SYNTHETIC SOURCE PRESERVED',
            'source-attestations.mjs':b'PRIVATE SYNTHETIC LEGACY APPROVALS PRESERVED'}
        return Bundle('worker.mjs',tuple(Part(n,n,'application/javascript+module',b) for n,b in bodies.items()))
    def test_observer_installation_preserves_source_fix_checkout_and_private_source(self):
        before=self.bundle();after=install.candidate(before,install.load_patch(),Part,Bundle)
        a=install.modules(before);b=install.modules(after)
        for name in set(a)-{'worker.mjs','commercial-reception.mjs'}:self.assertEqual(a[name],b[name])
        self.assertEqual(sha(b['shared-hub.mjs'].body),'10ebe491335d008fec039e43b1ce7547d9ed45c69f2b6230b92ff8125b7018a9')
    def test_observer_recovery_preserves_source_correction_and_later_unrelated_work(self):
        before=self.bundle();after=install.candidate(before,install.load_patch(),Part,Bundle)
        current=replace(after,parts=(*after.parts,Part('another-service.mjs','another-service.mjs','application/javascript+module',b'NEW UNRELATED SYNTHETIC SERVICE')))
        recovered=install.recover(before,after,current,Bundle)
        self.assertEqual(install.modules(recovered)['shared-hub.mjs'],install.modules(before)['shared-hub.mjs'])
        self.assertIn('another-service.mjs',install.modules(recovered))
        self.assertEqual(install.modules(recovered)['checkout-entry.mjs'],install.modules(before)['checkout-entry.mjs'])
    def test_identity_adapter_repair_preserves_checkout_and_permanent_source_fix(self):
        before=self.bundle();installed=install.candidate(before,install.load_patch(),Part,Bundle)
        body=install.modules(installed)['observer-auth.mjs'].body
        updated=repair.change(installed,sha(body),body+b'\n// synthetic auth-only update\n',Bundle)
        for name in ['shared-hub.mjs','checkout-entry.mjs','checkout-store.mjs','commercial-reception.mjs']:
            self.assertEqual(install.modules(updated)[name],install.modules(installed)[name])
    def test_old_three_module_checkout_reproduces_the_specific_incompatibility(self):
        with tempfile.TemporaryDirectory() as t:
            folder=Path(t)
            for n in ['normalizar_593.py','report_identity.py','inventory_completeness.py']:shutil.copyfile(VALIDATOR/n,folder/n)
            with self.assertRaisesRegex(ValueError,'ORIGINAL_VALIDATOR_SHA_MISMATCH data_hub_593.py'):
                with fixtures.h.original_validator(folder/'normalizar_593.py'):pass
    def test_coordinated_workflow_includes_exact_fourth_original_module(self):
        import yaml
        w=yaml.safe_load((REFERENCE/'publicar-corte-comercial-593.compat.yml').read_text())
        self.assertEqual(w['concurrency'],{'group':'publicacion-stock-593-web','cancel-in-progress':False})
        steps=w['jobs']['publicar']['steps']
        checkout=next(s['with'] for s in steps if s.get('with',{}).get('path')=='original-validator')
        self.assertEqual(checkout['ref'],'79f4e4fb77e30fd3a8a7ebac009cd8204a3b4c95')
        self.assertIn('/automatizacion/data_hub_593.py',checkout['sparse-checkout'].splitlines())
        with fixtures.h.original_validator(VALIDATOR/'normalizar_593.py') as original_validator:
            self.assertTrue(callable(original_validator.identity_signature))
    def test_original_observer_entry_runs_new_preparer_and_preserves_source_evidence(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);now=datetime.now(timezone.utc).replace(microsecond=0)
            old=fixtures.workbook(root/'old',15);new=fixtures.workbook(root/'new',16,cash=11,stock=2)
            def retime(path,when):
                with zipfile.ZipFile(path) as z:parts={n:z.read(n) for n in z.namelist()}
                value=when.isoformat().replace('+00:00','Z')
                parts['docProps/core.xml']=('<core xmlns:dcterms="http://purl.org/dc/terms/"><dcterms:created>'+value+'</dcterms:created><dcterms:modified>'+value+'</dcterms:modified></core>').encode()
                with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
                    for n,b in parts.items():z.writestr(n,b)
            retime(old,now-timedelta(hours=2));retime(new,now-timedelta(hours=1))
            cut=fixtures.base_cut(old);cut['fecha_corte']=(now-timedelta(hours=2)).astimezone(ZoneInfo('America/Guayaquil')).date().isoformat()
            catalog=fixtures.catalog_of(cut)
            repo=fixtures.PrepareOriginal.fake_repo(SimpleNamespace(root=root),catalog)
            shutil.copyfile(PRODUCER/'preparar-revision-comercial-593.py',repo/'scripts/preparar-revision-comercial-593.py')
            (repo/'datos-593').mkdir();(repo/'exportaciones').mkdir()
            (repo/entry.CUT).write_text(json.dumps(cut));(repo/entry.STATE).write_text(json.dumps(fixtures.state_of(cut)))
            (repo/'exportaciones/catalogo-ventas.json').write_text(json.dumps(catalog))
            (repo/'datos-593/inventario-publico.csv').write_text(fixtures.baseline_csv())
            work=root/'private';work.mkdir();shutil.copyfile(new,work/'Reporte-Inventario.xlsx');shutil.copyfile(old,work/'previous.xlsx')
            identity=sha(new.read_bytes());before={str(p):sha(p.read_bytes()) for p in [old,new,repo/'index.html']}
            instance=entry.Entry(repo,work,root/'unused-transport',VALIDATOR,identity)
            entry.save(instance.journal,{'sha256':identity,'lease_until':(now+timedelta(hours=1)).timestamp()*1000,'received_at':(now-timedelta(minutes=59)).isoformat().replace('+00:00','Z'),'original_name':'Reporte-Inventario.xlsx'})
            with contextlib.redirect_stdout(io.StringIO()):instance.prepare()
            result=json.loads((repo/entry.CUT).read_text())
            self.assertEqual(result['sha256_original'],identity)
            self.assertEqual(result['evidencia_checkout']['source_sha256'],identity)
            self.assertEqual(result['productos']['TEST0000'],{'stock':2,'promo_centavos':1100,'pvp_centavos':1380})
            for p,digest in before.items():self.assertEqual(sha(Path(p).read_bytes()),digest)

if __name__=='__main__':unittest.main()
