"""Identidad editorial por fotos propias: no aprueba ni publica una portada."""
import json,csv,hashlib,re
from pathlib import Path

def validate_source_assignment(sku, source, row):
 if source['nombre'].startswith(sku):return True
 # Un nombre de archivo equivocado sólo se admite con asignación expresa
 # del propietario, ligada al ID, nombre original y SHA exactos de cada foto.
 assignment=row.get('asignacionFotosConfirmadaPorPropietario',{})
 assert assignment.get('skuDestino')==sku and assignment.get('fuente')=='Confirmación expresa del propietario en este chat',sku
 assert assignment.get('confirmacion') and assignment.get('prefijoErroneo')!=sku,sku
 assert source['nombre'].startswith(assignment['prefijoErroneo']),sku
 expected=assignment.get('archivos',{}).get(source['id'])
 assert expected=={'nombre':source['nombre'],'sha256':source['sha256']},sku
 return True

def validate(sku,entry,product):
 proof=entry['verificacionReferenciaPropia'];assert proof['modo']=='FOTOS_PROPIAS_IDENTIDAD_SIN_PORTADA'and proof['noApruebaFotografiaComercial']is True,sku
 p=Path(proof['evidencia']);raw=p.read_bytes();assert hashlib.sha256(raw).hexdigest()==proof['sha256Evidencia'],sku
 row=json.loads(raw)['productos'][sku];assert row['sku']==sku and row['nombre593']==entry['nombre593']and entry['tituloAnterior']==product['name'],sku
 assert row['revisionVisualManual']=='VERIFICADA'and row['sinDiscrepanciasDeIdentidad']is True and row['sinAfirmarLicenciaOFabricanteNoVerificado']is True,sku
 assert [entry['titulo'],entry['subtitulo']]==[row['titulo'],row['subtitulo']],sku
 assert entry['evidenciaAtributos']['atributos']==row['atributosObservados'],sku
 # La ausencia de portada pertenece al momento de esta edición. Una futura foto
 # se valida por el controlador fotográfico general, sin invalidar esta identidad.
 assert not entry['foto']and not entry['sha256Foto']and not entry['marca']and not entry['modelo'],sku
 assert len(row['fuentesPropias'])>=2,sku
 for s in row['fuentesPropias']:
  assert validate_source_assignment(sku,s,row)and s['mimeType'].startswith('image/')and re.fullmatch('[a-f0-9]{64}',s['sha256']),sku
  assert s['url'].startswith('https://drive.google.com/file/d/'+s['id']+'/'),sku
 current=next(r for r in csv.DictReader(Path('datos-593/inventario-publico.csv').open())if r['sku']==sku);assert current['nombre']==row['nombre593'],sku
 return True
