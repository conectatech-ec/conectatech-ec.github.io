set -e
source /workspace/.conectatech-tools/activate.sh
export NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/environment-proxy-ca.crt
export NODE_OPTIONS="$NODE_OPTIONS --use-env-proxy --use-system-ca --require=/workspace/conectatech-ec.github.io/work/correcciones-108/runtime-proxy.cjs"
python - <<'PY'
import json,re,urllib.request,time
from pathlib import Path
assert json.loads(Path('work/produccion125/activacion-servida.json').read_text())['estado']=='HTML_ESPERADO_SERVIDO'
assert not Path('reportes/continuacion-125/http-publicacion.json').exists(),'Prueba primaria ya existe; conservar y revisar antes de repetir.'
expected=next(x for x in json.loads(re.search(r'const products=(\[[\s\S]*?\]);\s*\n',Path('index.html').read_text())[1])if x['sku']=='TECL028')
for attempt in range(40):
 try:
  with urllib.request.urlopen('https://conectatech-ec.github.io/',timeout=35)as response:root=response.read().decode()
  actual=next(x for x in json.loads(re.search(r'const products=(\[[\s\S]*?\]);\s*\n',root)[1])if x['sku']=='TECL028')
  assert all(actual.get(k)==expected.get(k)for k in ['sku','name','stock','promo','pvp','imageUrl'])
  break
 except (OSError,AssertionError,StopIteration):time.sleep(15)
else:raise SystemExit('La portada del catálogo todavía no incorporaTECL028;no generar prueba primaria.')

PY
python scripts/verificar-publicacion.py --sku TECL028 --reporte reportes/continuacion-125/http-publicacion.json
node scripts/verificar-movil.cjs --sku TECL028 --base https://conectatech-ec.github.io --salida reportes/continuacion-125/qa-publica/movil.json --capturas reportes/continuacion-125/qa-publica/movil --desktop
