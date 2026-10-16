# Alex, tu asesor de CONECTATECH

Activo solo para el probador registrado. [Evidencia de 86 pruebas y 13 intercambios HTTPS reales](generated/fase2/alex-cloud-verificado.json). Conversación real del probador acreditada: dos eventos externos firmados y procesados, dos respuestas generativas y una imagen aceptadas con HTTP 200 por Graph API. El probador confirmó que recibió texto e imagen; no existe recibo automático message_deliveries. Los recibos del piloto anterior se mantienen separados.

Worker existente: https://conectatech-comercial-piloto.conectatech-ecu.workers.dev . Rama exclusiva `automatizacion/piloto-cloud-3sku-20261015`. Sin cambios al catálogo ni a main.

[Mejoras de contexto, bandeja de aprobación y pruebas nuevas](ALEX-MEJORAS-CONTEXTO.md). La verificación legal está en revisión; no equivale a acceso avanzado.

## Conversar y detener

- El probador ya registrado escribe a CONECTATECHec en Messenger, por nombre o necesidad: «Busco una batería portátil», «¿Y esa cuánto cuesta?», «¿Con tarjeta?». No necesita copiar PSID ni volver a vincularse.
- La prueba privada en `/alex` usa únicamente `PILOT_TOKEN` en memoria durante diez minutos. No pegar secretos de Meta. Se comunica por HTTPS con el mismo motor y memoria aislada; nunca envía mensajes a Messenger.
- `/messenger/setup` conserva la parada de emergencia. API privada `POST /messenger/seller/disable` con Bearer PILOT_TOKEN: pausa cola y desarma nuevas vinculaciones. Una solicitud Graph ya en vuelo puede finalizar. No reintentar automáticamente un envío de resultado incierto.
- «Hablar con una persona» registra contexto pendiente y pausa respuestas de esa conversación durante 24 horas. No promete atención inmediata. La persona atiende desde la bandeja oficial de la Página. «Olvida esta conversación» borra memoria y oportunidad incluso durante esa pausa.
- `GET /alex/handoffs` privado permite consultar los últimos veinte contextos minimizados, sin PSID. No confirma pedidos, pagos ni reservas; WebStore aún no tiene integración transaccional.

## Modelo real y datos

Workers AI `@cf/meta/llama-3.1-8b-instruct-fp8-fast` interpreta el texto libre y el historial, selecciona hechos y genera cercanía, humor discreto y una pregunta pertinente. No exige menús. Devuelve un plan JSON; el servidor sustituye los hechos financieros, disponibilidad y características por textos verificados. No se aceptan cotizaciones libres del modelo. Ante salida inválida, cuota agotada o proveedor indisponible, se ofrece un respaldo seguro, sin precio inventado ni proveedor de pago.

Solo los tres productos aprobados tienen hechos: JBL Quantum Stream, Philco FLP8202CV y adaptador Europa a Latino. Los identificadores son internos. Otras consultas se aclaran o derivan sin inventar una ficha. Las ventajas provienen de las fichas aprobadas; precios y stock se leen del exportador existente en main, con antigüedad máxima de 24 horas y validación de identidad. No se renueva artificialmente la fecha ni se escribe al catálogo.

Se envía una imagen principal aprobada como tarjeta nativa Messenger con enlace a su ficha. El banner existente del JBL se utiliza solo si coinciden precio y stock; los otros productos usan sus fotografías verificadas por hash. No hay banners nuevos inventados. La imagen no se repite salvo petición expresa. Respuestas rápidas nativas: hasta tres opciones relevantes; el comprador conserva texto libre. No requieren `messaging_postbacks`.

## Tarjeta y logística aprobadas

El propietario confirmó que PVP es el precio con tarjeta. PROMO CONTADO corresponde a contado. Octubre de 2026, hora de Ecuador: Pacífico y Guayaquil / American Express, tres meses sin intereses; Diners y Pichincha, hasta seis meses sin intereses; doce meses con intereses. Otros plazos con intereses: PVP más intereses, cuya tasa, cuota y monto final deben confirmarse. No se calculan cuotas sin tasa. Estos planes se retiran automáticamente el 1 de noviembre a las 00:00 de Ecuador; no se presumen renovados.

Retiro: Av. 6 de Diciembre y La Niña, C.C. Multicentro Shopping, subsuelo, local 3, Quito. Contraentrega Quito y envío nacional sujetos a cobertura, tarifa y condiciones confirmadas; no se prometen fechas.

## Memoria y seguridad

Se reutiliza el Durable Object SQLite Free del mismo Worker. Texto minimizado y preferencias se cifran AES-GCM con clave derivada del secreto del piloto; TTL deslizante de 24 horas, seis intercambios recientes. La memoria recuerda foco de productos, presupuesto literal, sector, pago y entrega cuando aparecen en el texto. Las oportunidades pendientes duran siete días. Alarmas borran expirados; cada acceso también limpia. Rotar PILOT_TOKEN requiere prever que los datos cifrados anteriores no podrán descifrarse.

Correos, teléfonos largos y patrones de datos bancarios se eliminan antes de persistir y de enviar a IA. Esta minimización no garantiza detectar cualquier dato escrito; no solicitar datos sensibles. No se imprimen cuerpos, PSID ni secretos. La trazabilidad conserva referencias HMAC, estado, modelo, generación y conteos de imágenes, no las respuestas privadas. El identificador cifrado de un trabajo Alex terminado se elimina; la lista privada de probadores persiste hasta revocación. Privacidad pública en `/privacy`, eliminación en `/data-deletion`.

Firma SHA-256 validada sobre bytes originales, Página exacta, remitente previamente autorizado y ventana de 24 horas antes de cada envío. Deduplicación durable por evento y fragmento. Namespaces CI y demostración no acceden al transporte Graph. `META_INGRESS_ENABLED=false` y modo Desarrollo se conservan: el transporte del probador tiene un permiso separado y no habilita clientes generales.

## Costo y capacidad

Cuenta confirmada por el propietario como Free; no consultar Billing ni crear suscripciones. Cuota oficial Workers AI: 10.000 neuronas diarias; el nivel Free rechaza el exceso. Este motor reserva conservadoramente 80 por llamada y permite un máximo local de 8.000 reservadas/día, compartidas entre Messenger y demostraciones. Límite de prompt 14.000 bytes y salida 384 tokens. Según precios publicados del modelo (4.119 neuronas/M tokens de entrada y 34.868/M de salida), el margen cubre esos límites. Cien llamadas es un máximo preventivo del piloto, no una promesa de capacidad de la cuenta; otros usos pueden agotar antes la cuota del proveedor. No se realiza escalado de pago. El día de cuota cambia a las 19:00 de Ecuador (00:00 UTC).

Workers Free también limita solicitudes, CPU y almacenamiento de Durable Objects. El servicio permanece disponible en la nube dentro de esas cuotas, sin laptop y sin SLA ilimitado. GitHub Actions hace despliegues y verificaciones, no recibe conversaciones. No n8n Cloud, D1, servidor, tarjeta, créditos ni proveedor externo facturable.

## Verificación

`node automatizacion/tests/alex.test.mjs` verifica planes y caducidad Ecuador, fuente vencida, salida insegura, memoria cifrada, borrado durante derivación, cuota compartida e imágenes. Se conservan todas las pruebas previas.

`alex-e2e.mjs`, ejecutado desde Actions con secreto del entorno, hace inferencia real por HTTPS para tres productos y una conversación contextual; evidencia `generated/fase2/alex-real-ai.json`. Son consultas sintéticas identificadas como tales, sin fingir webhooks entrantes de Meta.

La evidencia de Messenger exige un evento externo firmado del probador, un trabajo Alex generativo con fragmentos Graph aceptados y, por separado, recibo de entrega o confirmación visual del probador. HTTP 200 de Send API no prueba lectura ni recepción visual. Requisitos de público externo en [APP-REVIEW-MESSENGER.md](APP-REVIEW-MESSENGER.md).

Fuentes: [cuotas y precio IA](https://developers.cloudflare.com/workers-ai/platform/pricing/), [límites Workers](https://developers.cloudflare.com/workers/platform/limits/), [Messenger oficial](https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api).
