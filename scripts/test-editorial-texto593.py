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
print('Nombre593:50 entradas comprobadas;7 alteraciones de evidencia/cifras/modelos rechazadas.')
