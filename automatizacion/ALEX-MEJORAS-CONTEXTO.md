# Alex: contexto y revisión privada — 16 de octubre de 2026

La verificación legal del negocio fue enviada por el propietario y está **EN REVISIÓN**, con estimación de Meta de aproximadamente dos días laborables. Es una estimación, no una aprobación ni un plazo garantizado. pages_messaging permanece en acceso estándar y la aplicación en Desarrollo. La implementación nueva conserva bloqueados a los remitentes externos.

## Cambios conversacionales

- El presupuesto explícito se reconoce también en expresiones como «presupuesto de cuarenta dólares» y decimales con coma. Una corrección de presupuesto reemplaza el valor anterior sin depender de que el modelo copie bien la cifra.
- Una elección explícita de pago reemplaza la anterior. Preguntar cuánto cuesta con tarjeta no cambia por sí solo la elección de contado.
- Se eliminan preguntas que repiten presupuesto, sector, banco, forma de pago o entrega ya informados. Cuando los hechos válidos y la pregunta exceden el límite breve, se elimina la pregunta opcional en lugar de perder toda la respuesta.
- «No quiero hablar con una persona todavía» mantiene la conversación; peticiones afirmativas, reclamos y asuntos sensibles continúan derivándose.
- Un nombre/modelo exacto prevalece sobre una palabra ambigua sobre características, para evitar enviar la batería Philco cuando preguntan sobre un producto JBL.
- Las respuestas rápidas cambian según foto, precio, pago o entrega. Después de una foto se puede pedir el precio de contado mediante una respuesta rápida nativa. Los identificadores siguen siendo internos.

## Bandeja de aprobación del probador

URL privada: https://conectatech-comercial-piloto.conectatech-ecu.workers.dev/alex/review . La página inicial no contiene datos privados. Usa PILOT_TOKEN únicamente en el campo de clave del panel, nunca secretos de Meta. La clave se conserva en memoria durante diez minutos y no en almacenamiento del navegador.

El modo de aprobación está **desactivado por defecto** para conservar las respuestas automáticas ya autorizadas del probador. Puede activarse desde ese panel, sin cambiar permisos de Meta ni habilitar compradores externos. Desactivarlo no aprueba los borradores pendientes.

Cuando se activa, la respuesta y su imagen se cifran, quedan pendientes y no llaman a Send API. La revisión muestra el contexto minimizado y el contenido por enviar. Aprobar exige el resumen SHA-256 de ese borrador concreto; rechazar no envía mensajes. La aprobación no vuelve a invocar IA ni cambia el texto aprobado.

Antes de enviar se revalidan precio, PVP, stock, identidad, medios, lista de probadores, parada del operador y ventana de 24 horas. Si cambia la cotización, el borrador se invalida sin enviar una nueva respuesta por su cuenta. «Generar nuevo borrador» consume una llamada de la cuota gratuita y exige otra aprobación. No se permite regenerar envíos parciales o de resultado incierto: requieren una consulta nueva para no duplicar mensajes.

Caducidad: quince minutos o el fin de la ventana de mensajería, lo que ocurra primero. Una consulta del mismo remitente espera la revisión anterior para conservar el orden, sin un ciclo de alarmas continuo. Pedir atención humana u olvidar la conversación revoca los borradores comerciales pendientes. La parada global permanece en /messenger/setup y bloquea las aprobaciones pendientes.

Esta bandeja está implementada para probadores; el transporte general de clientes sigue cerrado. Podrá reutilizarse para la primera etapa comercial con aprobación humana después de acreditar los permisos y hacer el cambio controlado de recepción. No se presenta como autorización ya concedida por Meta.

## Cuota gratuita visible

`GET /alex/quota`, con Bearer PILOT_TOKEN, muestra llamadas reservadas, llamadas restantes y próxima renovación. Es un contador preventivo del piloto, no el medidor real del proveedor. Mantiene 8.000 neuronas reservadas al día, ochenta por llamada y ningún respaldo de pago. La aprobación de un borrador existente no consume otra inferencia. No se han contratado recursos, suscripciones, bases externas ni servicios de pago.

## Verificación

Despliegue `5ddd50af`: [ejecución aprobada de GitHub Actions](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/38977601581) y [evidencia conservada](generated/fase2/alex-contexto-y-revision-verificado.json). Pasaron 98 pruebas automatizadas y doce turnos por HTTPS: diez inferencias generativas reales más transparencia y eliminación sin invocar el modelo. La comprobación por HTTPS no se presenta como una nueva entrega de Messenger. El probador ya había confirmado texto, imagen y pagos en la versión anterior; la aprobación humana desde Messenger de esta versión queda pendiente de su interacción personal.

Se conservan las pruebas anteriores. `tests/alex-upgrade.test.mjs` incorpora doce escenarios de correcciones, negaciones, brevedad, contexto exacto, botones, cuotas, aprobación, rechazo, cambio de cotización, caducidad, parada, orden, privacidad y aislamiento CI. Se utilizan SQLite y cifrado reales con transporte simulado en las pruebas unitarias, que no acreditan por sí solas una entrega en Messenger.

`alex-upgrade-e2e.mjs` comprueba los tres productos y el modelo real por HTTPS, memoria y correcciones, fotografía repetida bajo petición, características, regateo y precio con tarjeta. Nunca fabrica un evento de Meta ni envía mensajes desde el namespace de demostración. El resultado se guarda en generated/fase2/alex-context-upgrade.json. La prueba integral anterior `alex-e2e.mjs` se conserva como evidencia y herramienta de regresión.

Para la comprobación manual del nuevo flujo: activar aprobación en la bandeja, enviar desde el perfil autorizado una consulta nueva, revisar el borrador, aprobarlo y confirmar su recepción en Messenger. Después se puede volver al modo automático del probador. No compartir claves ni PSID.

## Mejora comercial posterior: conversación larga

El texto comercial de Alex deja de mostrar cantidades de inventario o «stock referencial». Con fuente vigente puede indicar que se confirma la disponibilidad antes de concretar; si la fuente está vencida o el producto no está disponible, bloquea la cotización. Los importes van primero con 💵 o 💳, los hechos se separan por saltos de línea y se usan 📍, 🛵 y 🛡️ para retiro, entrega y garantía. No se generan coberturas, fechas ni plazos de garantía.

La memoria mantiene además el indicador de saludo, un contador de turnos y los tres productos vistos recientemente. Aunque se recorten las últimas seis parejas de mensajes, se conservan presupuesto, pago, entrega, sector y referencias a productos. No se almacena una transcripción indefinida. Las opciones nativas siguen el contexto: foto, características, precio, elección tras comparación o continuación de compra. Pago y entrega conocidos permiten avanzar sin repetir esas preguntas. Una intención explícita de compra genera una solicitud sin confirmar; no un pedido, pago o reserva ya aceptados.

`tests/alex-commercial.test.mjs` comprueba 24 turnos con inferencia controlada, sin presentarlos como IA real. `alex-commercial-e2e.mjs` ejecuta una conversación distinta de 24 turnos por HTTPS, con 22 inferencias reales y dos controles seguros, cuatro selecciones nativas como mínimo, los tres productos, comparaciones, correcciones, garantía y borrado. Si falta cuota preventiva gratuita, espera de forma acotada su renovación; nunca incrementa límites ni activa pagos. El namespace privado no llama a Graph API.

La calidad de futuras conversaciones reales del probador se registra sin sus mensajes ni PSID: longitud, número de preguntas, presencia de saltos de línea, botones públicos y contador de turnos. HTTP 200 de Graph significa aceptación; recepción visual y recibos de entrega se mantienen como evidencias distintas. Ninguna prueba sintética se atribuye a Messenger real.

Para validar desde el perfil autorizado, mantener una conversación de al menos veinte consultas, alternando necesidad de batería, precio, botones, capacidad, regateo, pago y entrega, luego JBL, comparación de usos y adaptador. Terminar con intención de compra y garantía; pedir atención humana al final porque pausa la automatización. La prueba no necesita una nueva vinculación, PSID ni credenciales en este chat. Las herramientas de esta sesión no controlan el perfil personal del probador.

### Resultado real y límite pendiente

[Evidencia conservada de calidad comercial](generated/fase2/alex-calidad-comercial-evidencia.json). Las 104 pruebas automatizadas pasan. El último ensayo continuo ejecutó 24 turnos, con 22 inferencias reales, cuatro selecciones mediante payload nativo y los tres productos. Pasaron 23 turnos; la consulta sobre patrones del JBL recibió por error el retiro en tienda. Se conserva ese fallo: no se declara aprobado el ensayo completo.

La corrección está desplegada en `1f9659e6`: [despliegue y regresión aprobados](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/38985755529). Dos consultas nuevas por HTTPS verificaron precio/banner del JBL, memoria de contado/retiro y la explicación correcta de cardioide frente a omnidireccional. Esta regresión dirigida no equivale a repetir los 24 turnos.

Quedaron cuatro inferencias en el contador preventivo después de las comprobaciones; el límite de 8.000 neuronas reservadas no se amplió y no es el medidor real del proveedor. Renovación: 18 de octubre de 2026 a las 00:00 UTC, equivalente al 17 de octubre a las 19:00 de Quito. La repetición completa requiere 22 llamadas y queda pendiente por esa cuota. `alex_validation` vuelve a `conversation_24` al cerrar el disparador de despliegue, para que futuros cambios no hereden una excepción de prueba dirigida.

Para la comprobación inmediata en Messenger se reservaron esas cuatro llamadas: batería con presupuesto de cuarenta, botón de precio con tarjeta, consulta de precio del JBL y consulta de precio del adaptador. Se solicitó la confirmación visual al perfil autorizado; no se registra como realizada mientras no haya evidencia. El modo de compradores externos sigue bloqueado.
