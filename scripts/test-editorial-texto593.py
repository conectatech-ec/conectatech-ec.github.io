"""La edición de nombres sin fotos no admite fuentes falsas ni cifras nuevas."""
import json,re,copy
from pathlib import Path
from editorial_texto593 import validate
cfg=json.loads(Path('importacion/editorial/publicados.json').read_text());ps={p['sku']:p for p in json.loads(re.search(r'const products=(\[[\s\S]*?\]);\s*\n',Path('index.html').read_text())[1])};entries={s:e for s,e in cfg['productos'].items()if e.get('verificacionTexto593')};assert len(entries)>=50
for s,e in entries.items():assert validate(s,e,ps[s])
s,e=next(iter(entries.items()));mutations=[lambda x:x.update(titulo=x['titulo']+' 987654W'),lambda x:x.update(nombre593='Nombre cambiado'),lambda x:x.update(modelo='MODELO-INVENTADO'),lambda x:x.update(fuentes=['fuente no declarada']),lambda x:x['verificacionTexto593'].update(sha256Snapshot='0'*64),lambda x:x['verificacionTexto593'].update(sinAtributosAdicionales=False),lambda x:x['verificacionTexto593'].update(sha256Identidad='0'*64)]
for change in mutations:
 sample=copy.deepcopy(e);change(sample)
 try:validate(s,sample,ps[s])
 except AssertionError:pass
 else:raise AssertionError('Se aceptó evidencia alterada')
print(f'Nombre593:{len(entries)} entradas comprobadas;7 alteraciones de evidencia/cifras/modelos rechazadas.')
from editorial_referencia_propia import validate as validate_reference
refs={s:e for s,e in cfg['productos'].items()if e.get('verificacionReferenciaPropia')}
for s,e in refs.items():
 assert validate_reference(s,e,ps[s])
 # El historial de identidad no impide una portada posterior de otra sesión;
 # su aprobación/SHA corresponde a los controles fotográficos del compilador.
 future=dict(ps[s],imageUrl='/portada-posterior-controlada-por-modulo-fotografico.webp')
 assert validate_reference(s,e,future)
 for mutate in [lambda x:x.update(titulo=x['titulo']+' Bluetooth'),lambda x:x['evidenciaAtributos']['atributos'].update(Conexion='Inventada'),lambda x:x.update(marca='FABRICANTE-NO-VERIFICADO'),lambda x:x.update(foto='/imagen-no-aprobada.webp'),lambda x:x['verificacionReferenciaPropia'].update(noApruebaFotografiaComercial=False)]:
  sample=copy.deepcopy(e);mutate(sample)
  try:validate_reference(s,sample,ps[s])
  except AssertionError:pass
  else:raise AssertionError('La referencia propia aceptó un atributo o portada no verificados:'+s)
if refs:print(f'Referencias propias:{len(refs)} identidades;atributos,marca yportada no acreditados rechazados.')
