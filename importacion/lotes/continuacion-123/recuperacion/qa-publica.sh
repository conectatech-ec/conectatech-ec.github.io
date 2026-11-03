set -e
source /workspace/.conectatech-tools/activate.sh
export NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/environment-proxy-ca.crt
export NODE_OPTIONS="$NODE_OPTIONS --use-env-proxy --use-system-ca --require=/workspace/conectatech-ec.github.io/work/correcciones-108/runtime-proxy.cjs"
python scripts/verificar-publicacion.py --sku CHIP001 CHIP002 CHIP003 CHIP004 --reporte reportes/continuacion-123/http-publicacion.json
node scripts/verificar-movil.cjs --sku CHIP001 CHIP002 CHIP003 CHIP004 --base https://conectatech-ec.github.io --salida reportes/continuacion-123/qa-publica/movil.json --capturas reportes/continuacion-123/qa-publica/movil --desktop
BASE_EDITORIAL=https://conectatech-ec.github.io LOTE_EDITORIAL_VERIFICAR=123 node scripts/verificar-editorial-publicacion.cjs
