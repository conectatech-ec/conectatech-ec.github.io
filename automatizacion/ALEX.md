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


## Vigencia comercial y límites — comprobación del 21 de octubre de 2026 (Quito)

El máximo de **100 mensajes entrantes por 24 horas móviles** está en `messenger-seller.mjs`, constante `PILOT_INCOMING_LIMIT`. Es una protección interna del piloto, no una cuota impuesta por Messenger. No tiene un ajuste desde el panel ni un secreto: modificarlo exige un cambio de código, revisión y autorización; esta corrección conserva 100. La ventana libera cada mensaje al cumplir 24 horas, no a medianoche. Se revalida después de operaciones asíncronas para impedir superar el tope con entregas simultáneas. Duplicados no consumen otro cupo. El estado privado indica origen interno, usados, restantes y próxima liberación.

El presupuesto de IA es independiente: reserva preventiva de 8.000 neuronas/día UTC, 80 por intento, máximo 100 intentos reservados. Es una estimación interna, no la medición del proveedor. Las preguntas claras de catálogo usan `CATALOG_FIRST` y no consumen una inferencia, aunque su mensaje sí cuenta para admisión. No se elevó ninguno de los dos límites ni se activó facturación. El tope entrante continúa siendo un bloqueo de capacidad para más de 100 consultas al día, incluso si queda IA.

La publicación multicanal utiliza `new Date()` para `fechaCatalogo`: volver a generar fotos, categorías o fichas renueva esa fecha sin actualizar el inventario 593. El feed publicado el 21 de octubre a las 23:46 UTC aún coincide con el CSV cuyo último cambio es del 11 de octubre a las 04:42 UTC. La fecha de una exportación no demuestra una consulta reciente al ERP.

Alex consulta automáticamente el historial público **del archivo de inventario**, fija el CSV a ese commit inmutable y compara SKU único, variante publicada, Promo contado, PVP y stock con el catálogo web. Conserva las dos fechas; la vigencia efectiva usa la más antigua y exige menos de 24 horas. El corte oficial se toma además de `datos-593/REFERENCIA-OFICIAL.md` en ese mismo commit: actualmente declara el 10-10-2026. Al no tener hora de extracción, se usa conservadoramente el inicio del día en Quito. Se exige que tanto el corte como el commit y el feed sean recientes; un cambio de categoría en el CSV tampoco puede renovar el corte. Si falta la referencia o su fecha es inválida, se bloquea la cotización. La fecha del commit es evidencia del cambio del archivo publicado, no una certificación independiente del momento de extracción del ERP. Los datos de una nueva exportación deben proceder del flujo validado de 593 existente, no de tocar fechas o categorías para renovar precios. No existe en este piloto una conexión directa autenticada al ERP ni un job que produzca cortes nuevos de 593.

La consulta se realiza al responder y al reverificar los importes antes de enviar. Se solicita caché de una hora para procedencia/CSV inmutable y de un minuto para el feed; no constituye un SLA de propagación de GitHub/CDN. GitHub API público puede limitar peticiones; si falla o devuelve una fecha inválida/futura, se bloquean únicamente las afirmaciones económicas y existencias vigentes. No se añade un token con permisos ni un servicio de pago para evitar ese límite.

Cada nueva fuente que publique el proceso existente se incorpora sin confirmar precios artículo por artículo: solo se habilita la cotización cuando el corte es reciente y ambas fuentes coinciden. Si no se publica un corte real actualizado, la automatización no puede fabricarlo. El pipeline del piloto comprueba las fuentes y guarda el artefacto `vigencia-comercial-593`, sin escribir en main ni ejecutar el exportador del catálogo. No se ha añadido una tarea programada a main: la sincronización del receptor ocurre bajo demanda en el Worker, disponible permanentemente.

Las consultas de características verificadas, fotografías exactas, retiro y logística siguen funcionando sin IA. Un importe pendiente no deriva automáticamente la conversación a una persona. No se confirman cantidades ni se muestran banners con importes vencidos.


## Alex Pro: objeciones y continuidad comercial — 22 de octubre de 2026 UTC

La conversación real del probador mostró una promoción de Pacífico tras negar que tuviera esa tarjeta. El recibo de las 00:15:05 UTC corresponde a `verified_catalog`, no a una inferencia fallida. La cuota privada tenía 94 reservas disponibles. El texto original no puede reconstruirse de los registros: el piloto borra la entrada cifrada después del envío y solo conserva hechos comerciales y métricas sanitizadas. La frase facilitada por el propietario se reprodujo de forma sintética y produjo exactamente el error antes de corregirlo.

Causas y cambios:

- La selección de promociones por nombre de banco precedía a la negación. Ahora la interpretación distingue banco rechazado, banco elegido y banco consultado. Una objeción no puede ofrecer el plan rechazado, ni mediante el respaldo ni mediante el modelo.
- El respaldo no conservaba cambios de banco/plazo y el camino generativo confundía consultas con preferencias. Ambos actualizan ahora la misma memoria antes de contestar. Se guardan por separado el banco elegido, el último banco consultado y sus plazos; un cambio explícito limpia términos anteriores. Preguntar hipotéticamente por otra tarjeta no altera la elección.
- El prompt incluía ofertas bancarias ajenas al tema actual. Ahora solo recibe las relevantes; el renderizado excluye bancos rechazados y resúmenes que los incluyan. Los bancos sin un plan autorizado requieren confirmación: no heredan las condiciones del banco anterior.
- El respaldo no reconocía posponer o retomar una compra. Ahora conserva contexto, acepta continuar después y no convierte esa intención en una compra ni muestra cierre mientras el comprador prefiera esperar.
- El identificador de producto confundía una pregunta sobre la batería del teléfono con una nueva búsqueda de powerbank. Las características y pronombres conservan el foco cuando no hay una petición de cambiar producto.

El botón nativo «Otra tarjeta» genera una solicitud de nuevo banco, conserva el SKU interno y no repite el precio o la promoción anterior. No pide número de tarjeta, CVV ni datos sensibles. La memoria sigue cifrada, con caducidad y borrado existentes. Las consultas sobre importes vencidos siguen requiriendo confirmación; las características y opciones de entrega continúan útiles. No se modifican las políticas bancarias autorizadas, precios, fuentes maestras, cuotas, clientes externos ni catálogo.

Pruebas y alcance:

- `generated/fase2/alex-objeciones-simuladas.json`: cuatro recorridos completos de 21 turnos, incluidos agotamiento de reserva, proveedor caído, contrato de modelo simulado deliberadamente incorrecto y catálogo sintético vigente. Ninguno acredita un modelo real o una conversación de Messenger. Los importes de la fuente sintética prueban la lógica y no certifican vigencia comercial real.
- `alex-objections-e2e.mjs`: dos conversaciones privadas HTTPS con la misma secuencia, una con el binding real de Workers AI y otra con IA deshabilitada expresamente; incluye pulsación nativa después de rechazar Pacífico. Nunca fabrica eventos de Meta ni envía esos guiones por Graph. Las aserciones comprueban variante, presupuesto, preferencias más allá del historial corto, descarte persistente, precio exacto si está verificado o confirmación si no, logística sin promesas, pausa y reanudación.
- Messenger requiere una entrada externa con firma válida posterior al nuevo despliegue y una respuesta registrada por Graph. HTTP 200 de envío no acredita recepción visual. La conversación real corregida queda pendiente hasta recibir evidencia del perfil autorizado; los resultados HTTPS no la sustituyen.

La cuenta Meta sigue restringida a probadores. Las instrucciones de App Review y las URLs de privacidad/eliminación se conservan. No abrir compradores externos, aumentar topes ni contratar servicios para esta corrección.
