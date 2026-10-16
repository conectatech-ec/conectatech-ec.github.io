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

Se conservan las pruebas anteriores. `tests/alex-upgrade.test.mjs` incorpora doce escenarios de correcciones, negaciones, brevedad, contexto exacto, botones, cuotas, aprobación, rechazo, cambio de cotización, caducidad, parada, orden, privacidad y aislamiento CI. Se utilizan SQLite y cifrado reales con transporte simulado en las pruebas unitarias, que no acreditan por sí solas una entrega en Messenger.

`alex-upgrade-e2e.mjs` comprueba los tres productos y el modelo real por HTTPS, memoria y correcciones, fotografía repetida bajo petición, características, regateo y precio con tarjeta. Nunca fabrica un evento de Meta ni envía mensajes desde el namespace de demostración. El resultado se guarda en generated/fase2/alex-context-upgrade.json. La prueba integral anterior `alex-e2e.mjs` se conserva como evidencia y herramienta de regresión.

Para la comprobación manual del nuevo flujo: activar aprobación en la bandeja, enviar desde el perfil autorizado una consulta nueva, revisar el borrador, aprobarlo y confirmar su recepción en Messenger. Después se puede volver al modo automático del probador. No compartir claves ni PSID.
