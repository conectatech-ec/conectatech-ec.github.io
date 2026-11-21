import unittest, tempfile, json, hashlib, subprocess
from pathlib import Path
from preparar_fuente import prepare
class FuenteVigente(unittest.TestCase):
    def test_limited_source_and_regression(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); (root/'datos-593').mkdir()
            subprocess.run(['git','init','-q',str(root)],check=True)
            subprocess.run(['git','-C',str(root),'-c','user.name=QA','-c','user.email=qa@example.invalid','commit','--allow-empty','-qm','fixture'],check=True)
            records=[dict(sku='T1',availability='in_stock',precio_coincide_corte=True,precio_publico_validado='2.00')]
            (root/'index.html').write_text('const products=[{"sku":"T1"}];\n')
            target=root/'vigente.json'
            old=dict(fecha_corte='2026-10-22',referencias_exportadas=1,productos=records,sha256_productos=hashlib.sha256(json.dumps(records,sort_keys=True,separators=(',',':')).encode()).hexdigest())
            target.write_text(json.dumps(old))
            source=dict(fecha_corte='2026-11-02',sha256_original='a'*64,fuente='Reporte.xlsx',productos={'T1':dict(stock=0,promo_centavos=200,pvp_centavos=250),'PRIVADO':dict(stock=999,promo_centavos=900)})
            path=root/'datos-593/corte-comercial-publico-validado.json'; path.write_text(json.dumps(source))
            state=root/'datos-593/estado-ultimo-corte.json'; state.write_text(json.dumps(dict(fecha_corte=source['fecha_corte'],origen_sha256=source['sha256_original'])))
            result=prepare(root,target)
            self.assertEqual(result['fecha_corte'],'2026-11-02')
            self.assertEqual(result['productos'],[dict(sku='T1',availability='out_of_stock',precio_coincide_corte=True,precio_publico_validado='2.00')])
            self.assertNotIn('stock',result['productos'][0])
            source['fecha_corte']='2026-10-16';path.write_text(json.dumps(source))
            with self.assertRaises(ValueError): prepare(root,target)
