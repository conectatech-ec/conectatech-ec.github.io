import copy, hashlib, json, tempfile, unittest
from pathlib import Path
from premium_guard import validate

class PremiumApprovalTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name); (self.root/'importacion').mkdir()
        self.master = self.root/'master.png'; self.master.write_bytes(b'approved-master-bytes')
        self.digest = hashlib.sha256(self.master.read_bytes()).hexdigest()
        self.state = {'estado':'APROBADO_PARA_APLICAR','estandar_aprobado_por_propietario':True,'tamano_maximo':5,
                      'productos':{'SKU001':{'fidelidad_resuelta':True,'sha256_maestro':self.digest,'aprobacion_visual':{
                          'aprobado_por_propietario':True,'fecha':'2026-10-10','evidencia':'Explicit owner approval fixture','sha256':self.digest}}}}
        self.manifest = {'skus':['SKU001'],'imagenes':{'SKU001':[{'posicion':1,'archivo':'master.png','sha256':self.digest}]}}
    def check(self):
        (self.root/'importacion/premium-activo.json').write_text(json.dumps(self.state)); validate(self.root,self.manifest)
    def test_pending_blocks_all_publication(self):
        self.state['estado']='ESPERANDO_APROBACION_VISUAL'
        with self.assertRaisesRegex(ValueError,'suspendida'): self.check()
    def test_owner_approval_and_exact_bytes_allow(self): self.check()
    def test_changed_master_invalidates_approval(self):
        self.master.write_bytes(b'edited-after-owner-review')
        with self.assertRaisesRegex(ValueError,'bytes'): self.check()
    def test_operator_cannot_replace_owner_approval(self):
        self.state['productos']['SKU001']['aprobacion_visual']['aprobado_por_propietario']=False
        with self.assertRaisesRegex(ValueError,'propietario'): self.check()
    def test_unreviewed_sku_cannot_piggyback(self):
        self.manifest['skus'].append('SKU002')
        with self.assertRaisesRegex(ValueError,'SKU002'): self.check()
    def test_fidelity_issue_blocks_even_visual_approval(self):
        self.state['productos']['SKU001']['fidelidad_resuelta']=False
        with self.assertRaisesRegex(ValueError,'fidelidad'): self.check()
    def test_new_unapproved_gallery_image_is_rejected(self):
        self.manifest['imagenes']['SKU001'].append({'posicion':2,'archivo':'master.png','sha256':self.digest})
        with self.assertRaisesRegex(ValueError,'manifiesto'): self.check()
    def test_no_automatic_scaling(self):
        self.manifest['skus']=['SKU001']*6
        with self.assertRaisesRegex(ValueError,'tamaño'): self.check()

if __name__=='__main__': unittest.main()
