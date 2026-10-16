# Fase 2 — piloto con mínimo privilegio

El piloto privado ya está desplegado y verificado por HTTPS con inferencia IA real para los tres SKU. Evidencia: [despliegue-verificado.json](generated/fase2/despliegue-verificado.json) y [Actions 38849611908](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/38849611908). El Worker activo sirve la release `253b67ce`. Las cinco pruebas de acceso sin token/token incorrecto devolvieron 401; respuestas y tarjetas de tres SKU devolvieron 200. No se modificó main ni producción.

Después de verificarlo se volvió a dejar `activar:false` para impedir nuevos uploads accidentales; esto NO apaga el Worker. D1, persistencia de solicitudes y envíos comerciales siguen deshabilitados. El resto del documento describe la preparación y restricciones del piloto.

La guía vigente de conexión y permisos es [CONECTAR-CLOUDFLARE.md](CONECTAR-CLOUDFLARE.md). Reemplaza todas las instrucciones previas que pedían Billing Read, Workers Scripts Edit para toda la cuenta o D1 Edit.

## Resultado conservado

Las ejecuciones previas [38837941972](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/38837941972), [38837992776](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/38837992776) y [38840192055](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/38840192055) aprobaron. Se conservan los tres SKU, los archivos de generación, los medios verificados y las pruebas originales.

`e2e.mjs` ejecuta el handler completo para MICR27, POWE003 y ADAP005 con feed y medios públicos reales. La evidencia `real_data_worker_in_process` significa código ejecutado con fuentes reales, no servidor HTTPS desplegado ni inferencia IA real. Los archivos `generated/fase2/SKU.html` son tarjetas HTML con fotografías aprobadas y precios consultados; solo MICR27 dispone además de banner de imagen vigente. No se reconstruyó catálogo ni se generaron nuevas fotografías.

## Runtime y costo

El Worker proporcionará recepción HTTPS bajo demanda, sin laptop. Actions realiza CI y despliegue, no recibe chats. La demostración inicial usa únicamente Worker y binding Workers AI Free. IA clasifica intención; las cifras y fotografías provienen de datos estructurados. El despliegue no necesita D1 ni cron y ya no los configura.

El runtime consulta el feed actual con caché solicitada de hasta 60 segundos, conserva su fecha original y rechaza datos de más de 24 horas, fechas futuras, duplicados o precios inválidos. Un SKU ausente deja de tener disponibilidad; nunca reutiliza stock histórico. Cambios de identidad o hash de medios bloquean la respuesta hasta revalidar el bundle. Los textos/especificaciones siguen ligados al snapshot aprobado, por lo que cambios editoriales necesitan actualización del piloto, sin modificar el catálogo.

Workers Free tiene cuota de 100000 solicitudes diarias y CPU limitada; Workers AI ofrece 10000 neuronas diarias compartidas por cuenta. No son disponibilidad ilimitada ni un número fijo de chats. Ante cuota agotada se acepta error/degradación, nunca upgrade. La comprobación de plan y ausencia de facturación por consumo se hace en el panel por el propietario, confirmada en `CF_FREE_ONLY_CONFIRMED=true`. El script no tiene acceso a facturación y no puede verificar cambios posteriores del plan.

Fuentes oficiales: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [roles por Worker](https://developers.cloudflare.com/workers/authorization/workers/).

## Permisos y despliegue

Token: únicamente Editor sobre el Worker individual existente `conectatech-comercial-piloto`. El propietario crea el marcador inicial desde el panel; el token no necesita crear otros Workers. Debe usar workers.dev y no tener Routes/Custom Domains del catálogo. No se piden Billing, D1, DNS, Pages, R2 o KV.

El workflow permite únicamente `automatizacion/piloto-cloud-3sku-20261015`, usa environment exclusivo y GITHUB_TOKEN `contents:read`. El script comprueba la misma rama, el nombre fijo y la URL exacta. Su cliente solo permite leer settings, subir código y escribir secreto de ese Worker; otras rutas API se rechazan antes de la petición.

`--check` solo lee settings del Worker existente. Con `activar:false` no hay upload. Una activación futura debe superar la prueba HTTPS real y `REQUIRE_REAL_AI=true` para los tres SKU; una simulación de IA no cuenta. El upload REST todavía requiere verificación contra la cuenta real. No se publicará como sistema comercial definitivo.

## API y persistencia pendiente

`/chat`, `/ready`, `/banners/SKU` exigen Bearer PILOT_TOKEN. No colocarlo en una web pública o URL. `/health` muestra solo salud básica. `/ready` comprueba feed y bindings; no implica que IA o D1 hayan superado una prueba real. Los banners HTML privados usan los medios y precios verificados.

El código de solicitudes y webhooks se conserva, pero sin DB `/interesados` y la recepción persistente Meta devuelven 503. No se guardan solicitudes ni se afirma reserva de stock. D1 serviría para persistencia y deduplicación; se deja para una fase separada y no está autorizado por este despliegue.

Meta exige cuentas/Apps oficiales, permisos específicos, validación de firma y verificación de costos de mensajería antes de cualquier envío. La preparación HMAC/challenge y de payloads oficiales sigue en `channels.mjs`; no se envían mensajes. Marketplace personal no tiene bot ni publicación masiva. La WebStore y el feed Meta existentes se conservan.

## Pruebas y recuperación

Ejecutar `python automatizacion/build.py`, `node automatizacion/tests/worker.test.mjs`, `node automatizacion/tests/live.test.mjs`, `python automatizacion/tests/deploy_test.py` y `node automatizacion/e2e.mjs`. Tests de despliegue comprueban exclusión de Billing/D1/otros Workers antes de red, confirmación manual del plan, URL fija, rama, bindings y esquema SQLite para futura persistencia.

Los artifacts no contienen secretos ni clientes reales. Una modificación de medios requiere revalidar el snapshot; errores explícitos nunca renuevan fechas artificialmente. No hay monitor externo ni rollback automático. `activar:false` impide futuros uploads, pero no apaga un Worker ya publicado; suspensión requeriría una acción separada sobre ese piloto.
