"""Evita reintroducir una marca excluida o reutilizar una revisión de otros bytes."""
import copy
import unittest
from reglas_sku import compatible, rule, image_title

class BrandGate(unittest.TestCase):
    def test_portada_galeria_y_banner(self):
        r=rule('SOPO060');h='a'*64
        p={'contiene_caja':False,'sha256':h}
        self.assertFalse(compatible(r,p,True))
        self.assertFalse(compatible(r,p,False))
        p['revision_marcas']={'Yantech':{'sha256_maestro':h,'sin_texto':True,'sin_logotipo':True,'evidencia':'Revisión visual'}}
        self.assertTrue(compatible(r,p,True))
        emitted=copy.deepcopy(p);emitted['sha256_original']=emitted.pop('sha256')
        self.assertTrue(compatible(r,emitted,True))
        p['sha256']='b'*64
        self.assertFalse(compatible(r,p,True))
        emitted['revision_marcas']['Yantech']['sin_logotipo']=False
        self.assertFalse(compatible(r,emitted,True))
        self.assertEqual(image_title(r,'Soporte YAN TECH T8-02'),'Soporte T8-02')
        self.assertEqual(image_title(r,'Yantech soporte'),'soporte')
        self.assertEqual(image_title(r,'Soporte Monster'),'Soporte Monster')

    def test_identificados_y_otras_marcas(self):
        self.assertIn('Yantech',rule('SOPO023')['marcas_excluidas_imagen'])
        self.assertIn('Yantech',rule('TARJ004')['marcas_excluidas_imagen'])
        self.assertNotIn('Yantech',rule('ADAP004').get('marcas_excluidas_imagen',[]))

if __name__=='__main__':unittest.main()
