import hashlib,json
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
import sys
HERE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(HERE))
from fuente_visual_web import (verify_web_photo,source_changed,event_selection,
 regenerate_sku,VisualSourceError,_same_renderer_source)

class WebImageTests(unittest.TestCase):
 def setUp(self):
  self.tmp=TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  self.repo=Path(self.tmp.name);(self.repo/"imagenes/rel046").mkdir(parents=True)
  self.master=self.repo/"imagenes/rel046/original.png";self.master.write_bytes(b"master-approved")
  self.primary=self.repo/"imagenes/rel046/REL046-01.webp";self.primary.write_bytes(b"primary-published")
  self.row={"imagen":"/imagenes/rel046/REL046-01.webp","imagenProfesional":{"original":"/imagenes/rel046/original.png","sha256_original":hashlib.sha256(self.master.read_bytes()).hexdigest(),"revision_visual":True,"contiene_caja":False,"posicion":1,"versiones":{"1200":{"url":"/imagenes/rel046/REL046-01.webp","sha256":hashlib.sha256(self.primary.read_bytes()).hexdigest()}}}}
 def source(self):return verify_web_photo(self.repo,"REL046",self.row,"commit-current")
 def test_checks_both_actual_content_hashes(self):
  s=self.source()
  self.assertEqual(s.primary_sha256,hashlib.sha256(self.primary.read_bytes()).hexdigest())
  self.assertEqual(s.master_sha256,hashlib.sha256(self.master.read_bytes()).hexdigest())
 def test_old_url_cache_with_different_bytes_is_rejected(self):
  self.primary.write_bytes(b"cached-old-bytes")
  with self.assertRaises(VisualSourceError):self.source()
 def test_no_fallback_to_old_contract_or_alternative(self):
  self.master.unlink()
  with self.assertRaises(VisualSourceError):self.source()
 def test_unapproved_or_boxed_photo_rejected(self):
  self.row["imagenProfesional"]["revision_visual"]=False
  with self.assertRaises(VisualSourceError):self.source()
  self.row["imagenProfesional"]["revision_visual"]=True
  self.row["imagenProfesional"]["contiene_caja"]=True
  with self.assertRaises(VisualSourceError):self.source()
 def test_path_escape_rejected(self):
  self.row["imagenProfesional"]["original"]="/imagenes/../../outside.png"
  with self.assertRaises(VisualSourceError):self.source()
 def test_primary_descriptor_mismatch_rejected(self):
  self.row["imagen"]="/imagenes/otro.webp"
  with self.assertRaises(VisualSourceError):self.source()
 def test_unchanged_bytes_do_not_regenerate(self):
  s=self.source();old={"fuente_visual_web":s.manifest_fields(self.repo)}
  self.assertFalse(source_changed(old,s))
  old["fuente_visual_web"]["web_commit"]="another-commit-same-images"
  self.assertFalse(source_changed(old,s))
 def test_photo_event_does_not_need_a_new_593_file(self):
  event={"type":"imagen_web_aprobada","publicacion_verificada":True,"skus":["REL046","REL046","TELE002"]}
  self.assertEqual(event_selection(event,{"REL046"}),["REL046"])
 def test_unpublished_event_rejected(self):
  with self.assertRaises(VisualSourceError):
   event_selection({"type":"imagen_web_aprobada","publicacion_verificada":False,"skus":["REL046"]},{"REL046"})
 def test_reuses_original_renderer_with_exact_published_primary(self):
  s=self.source();orig=lambda *args:({"sku":"REL046"},{"old":True},self.master,{"old_specs":True})
  factory=SimpleNamespace(verified=orig)
  with _same_renderer_source(factory,s,self.repo):
   c,img,photo,specs=factory.verified(self.repo,"REL046",{}, {})
   self.assertEqual(photo,self.primary)
   self.assertEqual(img["sha256_original"],s.primary_sha256)
   self.assertEqual(specs,{"old_specs":True})
  self.assertIs(factory.verified,orig)
 def test_mutation_while_waiting_to_render_rejected(self):
  s=self.source();factory=SimpleNamespace(verified=lambda *a:({}, {}, self.master,{}))
  self.primary.write_bytes(b"new-unverified-image")
  with _same_renderer_source(factory,s,self.repo):
   with self.assertRaises(VisualSourceError):factory.verified(self.repo,"REL046",{}, {})
 def test_mass_rollout_requires_pilot_acceptance(self):
  with self.assertRaises(VisualSourceError):
   regenerate_sku(None,self.repo,"hub.json",self.repo/"out","PARL001",self.source())
