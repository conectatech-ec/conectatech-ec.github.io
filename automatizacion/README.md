# Piloto comercial CONECTATECH — aislado y sin despliegue

**Conexión de la cuenta Free confirmada:** [CONECTAR-CLOUDFLARE.md](CONECTAR-CLOUDFLARE.md).

**Fase 2:** consultar [FASE2-ACTIVACION.md](FASE2-ACTIVACION.md) para los avances, evidencia integral, actualización de datos y conexión exacta de cuenta. Este documento conserva la auditoría y el estado histórico de la fase 1.

Regla financiera permanente: costo autorizado $0. Prohibidas contrataciones, pruebas convertibles, planes pagados, créditos y consumos facturables sin autorización previa explícita. Política legible por máquina en `politica-financiera.json`. No se ha activado ningún proveedor.

## Auditoría mínima y arquitectura

Se leyó el snapshot local `35271ccc8e69a87efb4fb1a3a6e8fbb42200ee04`, sin modificar la sesión del catálogo. Main remoto observado durante auditoría: `3f3c84f1018d0047c188e38f7b020cac19e43650`; continúa evolucionando y no se bloqueó. Este piloto no pretende incorporar sus nuevos recursos093.

Fuentes reutilizadas: `exportaciones/catalogo-ventas.json` (precios/stock, fecha 2026-10-15T22:32:46.405Z), `seo-contenido.json` (texto y foto), `importacion/medios.json` (hashes, reglas, banner) y `datos-593/inventario-publico.csv` (categoría maestra). El resumen existente registra 1160 artículos vendibles, 762 con imagen y 398 sin imagen; no se revisó ni reconstruyó todo el catálogo. El registro de medios contiene un solo banner entre los SKU vendibles. La auditoría selecciona MICR27, POWE003 y ADAP005; no vuelve a fotografiarlos.

El exportador existente invoca un módulo que aplica reglas y su workflow hace checkout/push a main. NO se ejecuta. El adaptador nuevo solo lee fuentes y escribe `automatizacion/generated/`. Ningún workflow anterior se modifica.

Flujo propuesto: fuentes existentes → build Python sin dependencias → bundle con 3 SKU y anuncios → Worker privado bajo demanda → D1 privado para solicitudes. Workers AI opcional clasifica intención; precios, fotos, stock y respuestas comerciales provienen siempre de datos estructurados. No se permite texto libre del modelo como cotización. Si IA falla/cuota agotada, responde el motor determinista y registra fallo sin datos personales. No es un agente autónomo general ni una demostración de inferencia real: pruebas usan dobles de AI/D1.

La arquitectura puede atender 24/7 dentro de cuotas, sin laptop; aún NO está desplegada ni activa. Los niveles gratuitos no garantizan SLA ni disponibilidad ilimitada.

## Lo funcional y sus pruebas

Ejecutar desde la raíz: `python automatizacion/build.py` y `node automatizacion/tests/worker.test.mjs` (Node 22+). `generated/revision.html` muestra los 3 anuncios y sus medios. `verificacion-http.json` acredita 7 respuestas HTTP 200 y hashes exactos de 3 fotos y 1 banner. Las pruebas comprueban datos, alias MICR027, vencimiento, restricciones de contenido, autenticación, caída de IA, inyección, consentimiento y deduplicación/conflictos. No hay clientes reales en los fixtures.

API privada: `GET /health`, `POST /chat` con `{ "sku":"MICR27", "message":"precio y entrega" }`; `POST /interesados` con `{ "sku":"MICR27", "tipo":"reserva", "entrega":"retiro", "cantidad":1, "contacto":"contacto autorizado", "consent":true }`. Ambos POST requieren `Authorization: Bearer <PILOT_TOKEN>`; interesados además `Idempotency-Key` único de 16–80 caracteres. Guardar token exclusivamente en secretos del proveedor. No poner el token en una web pública.

Solicitudes admiten interés/pedido/reserva y retiro/contraentrega Quito/envío nacional. Devuelven siempre pendiente de confirmación: NO descuentan stock, confirman pago, prometen transporte ni constituyen reserva de inventario. El diseño opcional D1 conserva datos 30 días; está deshabilitado en el despliegue inicial de mínimo privilegio. Sin DB la API devuelve 503 y no guarda solicitudes. Clave única evita duplicados; reutilizarla con otro contenido devuelve 409. Reintentar fallos con la misma clave. Logs contienen solo código de evento y ruta; no contactos ni tokens.

Solo MICR27 tiene banner vigente: el generador exige coincidencia de revisión y hash de portada, y rechaza banners con precio incrustado. Los otros dos usan foto aprobada y `banner:null`. No se crearon imágenes. No hay relaciones verificadas de upsell/accesorios en el piloto: se pide necesidad/modelo y no se inventa compatibilidad. No se añaden promociones fuera de Promo Contado real.

## Opciones gratuitas y límites consultados

- GitHub Actions: runners estándar gratis en repos públicos; artifacts consumen almacenamiento, retención del piloto 7 días. Workflow limitado a push de esta rama, lectura y build/test; sin commits, deploy, secrets ni publicaciones. No es un servidor de chat. Cron solo corre desde default branch, puede demorarse y se desactiva por inactividad en repos públicos; por ello NO se habilitó un cron engañoso en esta rama.
- Cloudflare Workers Free: hasta 100000 solicitudes/día y CPU limitada; D1 Free: 5 millones de filas leídas/día, 100000 escritas/día, 5 GB totales. IA: 10000 neuronas/día, no equivale a un número fijo de mensajes. Free rechaza exceso; NO actualizar a Paid. Modelo opcional `@cf/meta/llama-3.2-3b-instruct`, sujeto a disponibilidad. Confirmar en la cuenta que no existen facturación ni mecanismos de cargo antes de activar. No se ha comprobado alta de cuenta ni requisito de tarjeta para este usuario.
- n8n Community: licencia de uso interno y software sin costo, pero necesita servidor permanente y mantenimiento; no es garantía de hosting gratis y no es OSI open source. n8n Cloud es prueba/planes pagados; descartado para costo permanente $0. Alternativa del piloto: Python/JS y servicios bajo demanda.
- Google Apps Script + Sheets privado: alternativa sin servidor dedicado con cuotas y límites de ejecución; requiere cuenta, autorización y diseño de seguridad. No implementado ni conectado aquí.

Fuentes oficiales consultadas: https://developers.cloudflare.com/workers/platform/limits/ ; https://developers.cloudflare.com/d1/platform/pricing/ ; https://developers.cloudflare.com/workers-ai/platform/pricing/ ; https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows ; https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job ; https://n8n.io/pricing/ . Límites verificados para la arquitectura propuesta; revisar nuevamente antes de activación.

## Activación pendiente (sin ejecutar)

Seguir exclusivamente [CONECTAR-CLOUDFLARE.md](CONECTAR-CLOUDFLARE.md): Worker individual existente, token Editor solo para ese recurso y confirmación del plan desde el panel. No crear D1, no pedir Billing y no configurar cron. El procedimiento histórico de activación mediante permisos de cuenta queda reemplazado. La cuenta Free existe; faltan los secretos.

El runtime de fase 2 consulta precios/stock actuales del feed público y comprueba medios. No renueva fechas artificialmente. Persiste pendiente la conexión y prueba HTTPS/IA reales; no hay monitoreo externo continuo.

## Canales y seguridad

Marketplace personal queda como captación manual autorizada: anuncios preparados, sin API masiva, scraping ni automatización de cuentas personales. El feed Meta existente se conserva sin duplicar catálogo. Messenger de Página comercial y WhatsApp Business Cloud API requieren permisos, webhooks con firma, configuración de cuenta, políticas y ventanas de mensajería; no están conectados. WhatsApp no se asume universalmente gratis y no se habilitan plantillas facturables. WebStore puede consumir el asistente mediante un backend seguro futuro, sin reconstruir catálogo. No existe publicación externa automática en este piloto.

Antes de exposición pública faltan autenticación de clientes, control de abuso/cuotas, verificación de webhooks, reglas comerciales de compatibilidad/transporte, auditoría legal de datos y pruebas reales de cuenta cloud/IA. El endpoint actual está diseñado para prueba privada con token; no es apto para pegarlo directamente en una tienda pública. Mantener datos personales y secretos fuera de este repo público y sus artifacts.
