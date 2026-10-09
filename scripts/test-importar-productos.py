import csv
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('importer',ROOT/'scripts/importar-productos.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class ImportTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        for file in ['index.html','seo-contenido.json','seo-pages.json','importacion/alias-sku.json']:
            target=self.root/file;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy(ROOT/file,target)
        with (ROOT/'importacion/lote-001-repetible.csv').open(encoding='utf-8-sig') as f: self.rows=list(csv.DictReader(f))
        self.before=module.financial(module.read_catalog(self.root)[1])
    def run_batch(self, rows, extra=None, images=None):
        target=self.root/'lote.csv'
        with target.open('w',newline='',encoding='utf-8-sig') as f:
            writer=csv.DictWriter(f,fieldnames=module.FIELDS+(extra or []));writer.writeheader();writer.writerows(rows)
        result=subprocess.run(['python3',str(ROOT/'scripts/importar-productos.py'),'--root',str(self.root),'--csv',str(target),'--imagenes',str(images or ROOT/'imagenes'),'--aplicar','--reporte',str(self.root/'report.json')],capture_output=True,text=True)
        return result,json.loads((self.root/'report.json').read_text())
    def test_apply_idempotent_preserves_all_1165_prices_and_stock(self):
        result,report=self.run_batch(self.rows);self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(len(report['aplicados']),3)
        self.assertEqual(self.before,module.financial(module.read_catalog(self.root)[1]))
        result,report=self.run_batch(self.rows);self.assertEqual(len(report['sin_cambios']),3)
        self.assertEqual(len(report['aplicados']),0)
    def test_alias_collision_aborts_whole_batch(self):
        duplicate=dict(self.rows[1],sku='MICR27')
        result,report=self.run_batch(self.rows+[duplicate]);self.assertNotEqual(result.returncode,0)
        self.assertEqual(report['aplicados'],[])
        self.assertFalse((self.root/'imagenes').exists())
    def test_unknown_sku_aborts(self):
        rows=[dict(self.rows[0],sku='INEXISTENTE')]
        result,report=self.run_batch(rows);self.assertNotEqual(result.returncode,0)
    def test_financial_column_rejected(self):
        result,report=self.run_batch([dict(self.rows[0],stock='999')],['stock'])
        self.assertNotEqual(result.returncode,0);self.assertEqual(report['aplicados'],[])
    def test_image_path_escape_rejected(self):
        result,report=self.run_batch([dict(self.rows[0],imagen_principal='../index.html')]);self.assertNotEqual(result.returncode,0)
    def test_pixelated_thumbnail_rejected(self):
        folder=self.root/'fotos';folder.mkdir();Image.new('RGB',(120,120)).save(folder/'CARG050.png')
        result,report=self.run_batch([dict(self.rows[0],imagen_principal='')],images=folder)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('Resolución insuficiente',report['errores'][0]['motivo'])
        self.assertEqual(report['aplicados'],[])
    def test_all_catalog_rows_processed_as_pending(self):
        rows=[dict.fromkeys(module.FIELDS,'') for _ in self.before]
        for row,sku in zip(rows,self.before):row.update(sku=sku,verificado='NO')
        result,report=self.run_batch(rows);self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(len(report['pendientes']),1165);self.assertEqual(report['errores'],[])

if __name__=='__main__':unittest.main()
