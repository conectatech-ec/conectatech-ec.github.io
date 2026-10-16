# Operación y paso a conversaciones reales

Página autorizada: CONECTATECHec, **105549695770538**. Aplicación: Jotacellcomunicapp, actualmente en Desarrollo. Callback:

`https://conectatech-comercial-piloto.conectatech-ecu.workers.dev/webhooks/meta`

## Lo que hace esta versión

Recibe el challenge HTTPS, verifica la firma HMAC del cuerpo, filtra por Página y PSID autorizado, deduplica durablemente y prepara respuestas con datos vigentes del catálogo. La recepción de Página continúa cerrada con `META_INGRESS_ENABLED=false` hasta confirmar probadores y suscripción. Configurar los secretos no publica la app ni abre automáticamente la recepción. Un challenge que pasa desde Actions demuestra el funcionamiento del endpoint con el secreto configurado; no demuestra que Meta verificó la app o entregó un mensaje.

No existe cliente de Graph Send API ni Page Access Token en el Worker. Registrar una aprobación **no envía** nada. Para las primeras respuestas, una persona debe revisar el borrador, confirmar precio/stock vigentes y enviarlo en la conversación correspondiente desde la bandeja oficial de la Página. El piloto no guarda PSID ni texto libre y por ello tampoco puede reconstruir el destinatario a partir del borrador.

## Completar la conexión en Meta sin exponer secretos

1. Conservar Desarrollo y añadir los probadores en los roles de la app; deben aceptar la invitación. No habilitar Live para saltar una restricción de pruebas.
2. Guardar los PSID de esos probadores para **esta Página** en el secreto GitHub `META_TEST_SENDER_IDS`. No son el ID general del perfil. Si es necesario obtenerlos, utilizar la herramienta oficial Graph API Explorer con el token de la Página y los permisos autorizados que exige Conversations API (`pages_messaging`, `pages_manage_metadata`, `pages_read_engagement`): consultar `/{PAGE_ID}/conversations?platform=messenger&fields=participants`, localizar únicamente la conversación de prueba y guardar privadamente su ID de participante distinto del Page ID. No exportar participantes ni resultados a logs, repositorio o chat. `pages_read_engagement` se justifica para esta consulta oficial de conversaciones, no para el Worker receptor; comprobar primero si el token ya dispone de ese permiso. Si Meta no concede esa consulta, detener esa consulta y revisar el acceso de la Página; no ampliar permisos por ensayo y error.
3. En Webhooks del objeto Page, introducir el callback anterior y pegar el mismo valor de `META_VERIFY_TOKEN` directamente desde el gestor privado. Pulsar **Verify and save**. El token secreto nunca se coloca en instrucciones públicas.
4. En Messenger de la app, asociar CONECTATECHec y suscribir la Página al campo **messages**. Configurar el callback de la app y suscribir una Página son dos operaciones distintas. Utilizar la interfaz oficial; no hace falta entregar un Page Access Token a Codex para ese paso. Si se usa el edge `/{PAGE_ID}/subscribed_apps`, comprobar el permiso `pages_manage_metadata` requerido para esa operación.
5. Confirmar la lista de pruebas y la suscripción antes de habilitar la recepción del piloto. El gate del servidor seguirá rechazando cualquier modo distinto de `development-only` y cualquier emisor fuera de la lista incluso si alguien cambia el modo en Meta.
6. Tras habilitar deliberadamente solo las pruebas, enviar «precio MICR27», «disponibilidad POWE003» y «comprar ADAP005» desde una cuenta autorizada. Comprobar en el espacio development los borradores y métricas. Una prueba sintética del espacio CI no cuenta como entrega de Meta.

## Operación privada y aprobación humana

Todas estas rutas exigen `Authorization: Bearer PILOT_TOKEN` en la cabecera, nunca en la URL. Por defecto usan el almacén de probadores. `?scope=ci` selecciona exclusivamente pruebas técnicas sintéticas.

| Método y ruta | Resultado |
|---|---|
| GET /messenger/status | Solo booleanos de configuración; no devuelve valores secretos |
| GET /messenger/test-results | Últimos 30 eventos, SKU, borradores y decisión; sin identidad ni texto del cliente |
| GET /messenger/metrics | Conteos diarios de consultas, borradores, pendientes, fallos, reintentos, duplicados y decisiones |
| POST /messenger/review | Registra aprobación/rechazo del contenido exacto, sin envío |

La revisión recibe JSON con `event_ref`, `result_digest` y `decision` (`aprobado` o `rechazado`), obtenidos del resultado privado. Si falta el borrador, cambió su contenido o expiró, devuelve 409. No modifica el borrador ni el stock. Precio/stock siguen siendo referenciales y requieren reverificación antes del envío manual.

`consultas_con_sku` mide interés potencial, no pedidos, ventas ni personas únicas. `messages_sent` y `confirmed_orders` permanecen en cero. No se presentan borradores como respuestas enviadas. Los datos operativos y revisiones caducan con los eventos a los siete días; los conteos diarios también se depuran. CI y development nunca comparten métricas ni eventos.

## Requisitos para clientes ajenos a los roles de la app

No están acreditados por el Page ID, el App Secret ni el challenge. El panel de la cuenta debe demostrar:

- Página asociada a la app y suscripción `messages` activa; usuario administrador autorizado para esa Página.
- Permiso **pages_messaging** y nivel de acceso aprobado que permita atender usuarios externos; tramitar **Advanced Access / App Review** cuando lo exija Meta. Para gestionar la suscripción por API, **pages_manage_metadata** con el nivel aplicable. No se solicitan `ads_management`, facturación, `business_management`, perfiles de usuarios ni permisos de catálogo para este receptor.
- Verificación empresarial requerida por Meta para ese acceso y modo público/Live habilitable; no confundir verificación de empresa con suscripción de pago Meta Verified. Los requisitos específicos deben confirmarse en el panel de esta app; esta sesión no puede leerlo.
- Política de privacidad pública y mecanismo/instrucciones de eliminación de datos, información del negocio y contacto, más instrucciones y grabación reproducibles solicitadas por App Review. Preparar una conversación de prueba con permiso real, revisión humana, foto/banner, deduplicación y tratamiento de errores. No enviar claves ni datos reales de clientes en el video.
- Antes de abrir recepción pública: prueba de entrega real desde Meta, revisión de seguridad y autorización del nivel de acceso. La versión actual está fijada a Desarrollo y allowlist; pasar a público requiere un cambio explícito y verificable, no editar una variable Live a ciegas.

Para enviar por API posteriormente se necesitará un **Page Access Token** de esta Página con `pages_messaging`, almacenado como secreto y validado sin mostrarlo. El envío deberá exigir aprobación humana del contenido vigente y una interacción válida dentro de la ventana estándar de **24 horas**, revalidada inmediatamente antes de enviar, deduplicación de envío y permisos todavía vigentes. Esta versión no implementa envíos ni excepciones de ventana. No se usan etiquetas para promociones ni se asume que una aprobación humana extiende la ventana. La automatización posterior de preguntas frecuentes seguirá esos mismos controles y respetará solicitudes de baja.

Hasta ese momento, los clientes reales pueden continuar siendo atendidos por personas en la bandeja oficial existente; el piloto no intercepta ni responde esas conversaciones.

## Servicio y costo

El Worker atiende HTTPS bajo demanda continuamente en la nube; las alarmas durables procesan trabajo pendiente. No depende de Actions programado como receptor ni de una laptop. Solo se usa el Worker existente con SQLite Durable Objects Free y las cuotas gratuitas previamente confirmadas. El tope local es 100 eventos/día por espacio, además de los límites de Cloudflare Free. Alcanzar las cuotas puede suspender el servicio; no hay compra automática de capacidad ni garantía SLA del plan gratuito. Ningún código de esta integración activa planes o consulta Billing.

Fuentes primarias: [Messenger de Meta: requisitos y ventana de atención](https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api), [Conversations API: acceso y PSID](https://www.postman.com/meta/messenger-platform-api/folder/22794852-255610cd-47f5-4f4d-b3fa-71aec360be9a), [revisión oficial de Messenger](https://developers.facebook.com/docs/messenger-platform/app-review/), [permisos](https://developers.facebook.com/docs/permissions/), [verificación empresarial](https://developers.facebook.com/docs/development/release/business-verification/). Las páginas de Meta Developers devolvieron 429 al consultarlas en esta sesión; los requisitos que dependen del estado de la cuenta siguen sujetos a comprobación en su panel, sin presumir aprobación.
