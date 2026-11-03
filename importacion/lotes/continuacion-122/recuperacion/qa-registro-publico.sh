set -e
source /workspace/.conectatech-tools/activate.sh
export NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/environment-proxy-ca.crt
export NODE_OPTIONS="$NODE_OPTIONS --use-env-proxy --use-system-ca --require=/workspace/conectatech-ec.github.io/work/correcciones-108/runtime-proxy.cjs"
node scripts/verificar-catalogo.cjs --sku AUDI130 JUGU143 JUGU142 CABL173 CABL174 JUGU164 --base https://conectatech-ec.github.io --salida reportes/continuacion-122/qa-registro-publico/catalogo.json --capturas reportes/continuacion-122/qa-registro-publico/catalogo
BASE_PRIORIDAD=https://conectatech-ec.github.io REPORTE_PRIORIDAD=reportes/continuacion-122/prioridad-publica node work/produccion122/verificar-prioridad.cjs
