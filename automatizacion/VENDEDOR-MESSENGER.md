# Vendedor Messenger del piloto — 16 de octubre de 2026

La instrucción vigente del propietario autoriza envíos automáticos oficiales con costo $0 cuando existan permisos y pruebas. Sustituye la prohibición histórica de salida del prototipo. Nunca autoriza saltar restricciones de Meta, abrir main ni modificar el catálogo.

## Implementado

- Transporte oficial `POST https://graph.facebook.com/v26.0/105549695770538/messages`, Bearer secreto y `messaging_type: RESPONSE`. Sin etiquetas para saltar la ventana de 24 horas; sin Messenger de pago, WhatsApp ni Instagram activos.
- Verificación del token mediante identidad de Página, aplicación y depuración oficial con App Secret. `pages_messaging` debe estar concedido y el token vigente. Este control no acredita Advanced Access ni modo Live.
- Atención restringida a PSID probadores confirmados: secreto GitHub existente o promoción privada de la vinculación de un solo uso. Nunca se autorregistra un cliente por escribir un SKU.
- PSID cifrado con AES-GCM; clave derivada del secreto privado. No se guardan textos libres ni se exportan identidades. Eventos y resultados durante siete días; lista autorizada hasta revocación del operador. Hasta 20 probadores y 100 consultas en 24 horas. Las consultas fuera de la lista no llegan a IA ni a la cola.
- Workers AI Free clasifica intención, con respuesta determinista de respaldo. Precio, existencias, especificaciones y beneficios salen de fuentes aprobadas. Nunca se incorporan cifras generadas por IA.
- Fuente comercial de main exclusivamente en lectura, máximo 24 horas. Fotos verificadas por SHA-256. MICR27 reutiliza el banner existente únicamente mientras coincidan sus precios aprobados; los otros SKU usan sus fotografías. No se inventan banners ni condiciones de entrega, garantía, compatibilidad, reservas o ventas confirmadas.
- Deduplicación persistente por evento y parte. Ante timeout, 5xx o resultado ambiguo de Graph, se detiene el vendedor y no se reintenta automáticamente. Un envío en curso puede terminar después de una parada.
- «vendedor», garantías, compatibilidad incierta o datos no verificables dejan una consulta pendiente de atención humana. La automatización de esa conversación se pausa 24 horas. La bandeja oficial de la Página sigue siendo el canal del vendedor humano; no hay notificaciones externas configuradas.
- Registro de aceptación Graph y entrega son distintos. Una respuesta HTTP de Send API no equivale a recepción: se requiere `message_deliveries` firmado y correlacionado. No se afirma lectura humana.
- Pruebas CI aisladas: el transporte se bloquea por namespace aun si recibe credenciales reales. Los fixtures nunca se presentan como conversaciones de Meta.

## Operación

Panel: https://conectatech-comercial-piloto.conectatech-ecu.workers.dev/messenger/setup

Entrar con PILOT_TOKEN desde el gestor privado. Crear frase tras confirmar rol de probador y enviarla desde esa cuenta por Messenger a CONECTATECHec. **Registrar probador y habilitar prueba** promueve el PSID cifrado sin mostrarlo, verifica permisos y habilita solo esa lista. GitHub también realiza este paso si encuentra una vinculación vigente. Si no existe, deja preparada la activación automática del probador: la frase firmada y válida registra la lista y habilita las pruebas; el siguiente mensaje con SKU recibe respuesta. La parada desarma esta activación. Nunca se autorregistra un cliente por escribir un SKU.

Enviar MICR27, POWE003 y ADAP005 desde el probador, una consulta por mensaje. El botón **Actualizar vendedor** muestra conteos de mensajes aceptados y entregados. **DETENER RESPUESTAS** pausa inmediatamente la cola pendiente; una solicitud Graph que ya salió puede concluir. Los trabajos pausados no se reenvían al reactivar.

Las rutas `/messenger/seller/status`, `/results`, `/enable`, `/disable`, `/promote` requieren Bearer PILOT_TOKEN, nunca query ni almacenamiento del navegador. No utilizar App Secret ni Page token como clave del panel. No hay acceso público a PSID ni respuestas privadas.

`META_INGRESS_ENABLED=false` conserva cerrado el antiguo receptor de borradores. El vendedor de probadores tiene un control durable separado y visible en `/messenger/status` y `/messenger/seller/status`. No existe habilitación oculta de clientes reales.

## Lo que solo puede autorizarse en Meta

La inspección real de GitHub confirmó el token de Página y `pages_messaging`. La lectura de `subscribed_apps` dio 403/código 200 por falta de `pages_manage_metadata`. Esto **no prueba ausencia de suscripción**. No se amplían permisos para obtener PSID o enviar respuestas. La suscripción de la Página y, para acreditar recepción, `message_deliveries`, se gestionan desde la app con los permisos ya disponibles. Solicitar el permiso de metadatos solo si se decide administrar suscripciones por API y Meta lo requiere.

Para usuarios ajenos a los roles: completar el acceso exigido por Meta, App Review/Advanced Access y el modo público aplicable. Ver APP-REVIEW-MESSENGER.md. Cambiar una variable no sustituye esa aprobación. Esta versión protege deliberadamente el modo probadores y no abre clientes reales sin acreditación.

## Costo

Únicamente Worker existente, SQLite Durable Object del mismo piloto, Workers AI en Free y GitHub Actions del repositorio público. Sin Billing Read, D1, servidores, suscripciones ni upgrades. Al agotarse las cuotas gratuitas, el servicio puede detenerse; no cambia a planes pagados. El funcionamiento cloud no depende del equipo local. No se promete capacidad ilimitada ni disponibilidad por encima del nivel gratuito.
