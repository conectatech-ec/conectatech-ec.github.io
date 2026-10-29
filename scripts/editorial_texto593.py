"""Valida edición conservadora del nombre593 sin aprobar fotos ni atributos nuevos."""
import csv,json,hashlib,re
from pathlib import Path

def validate(sku,entry,product):
 proof=entry['verificacionTexto593']
 assert proof['modo']=='NOMBRE_593_SIN_ATRIBUTOS_NUEVOS' and proof['sinAtributosAdicionales'] is True,sku
 source=Path(proof['snapshot']);raw=source.read_bytes();assert hashlib.sha256(raw).hexdigest()==proof['sha256Snapshot'],sku
 snapshot=json.loads(raw);row=snapshot['identidades'][sku]
 assert row['sku']==sku and row['nombre']==entry['nombre593'] and entry['tituloAnterior']==product['name'],sku
 assert hashlib.sha256(json.dumps(row,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()==proof['sha256Identidad'],sku
 current=next(r for r in csv.DictReader(Path('datos-593/inventario-publico.csv').open())if r['sku']==sku)
 assert current['nombre']==row['nombre'],sku
 assert not entry['modelo'] and not entry['marca'] and not entry['modelosBusquedaVerificados'],sku
 numbers=lambda text:{v.replace(',','.')for v in re.findall(r'\d+(?:[.,]\d+)?',text)}
 assert numbers(entry['titulo']+' '+entry['subtitulo'])<=numbers(row['nombre']),sku+' cifra nueva no documentada'
 assert proof['fotoPendienteAlEditar'] is True,sku
 assert entry['fuentes']==['datos-593/inventario-publico.csv#'+sku,proof['snapshot']+'#'+sku],sku
 return True
