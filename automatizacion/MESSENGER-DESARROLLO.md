# Messenger de Meta — Jotacellcomunicapp en Desarrollo

**Estado:** receptor cerrado desplegado, pruebas sintéticas por HTTPS aprobadas y recepción real deshabilitada. [Evidencia](generated/fase2/messenger-desplegado-verificado.json). Handshake con el token real y entrega desde Meta pendientes de configuración segura. Nuevos uploads cerrados con `activar:false`; el Worker sigue activo.

Callback HTTPS exacto:

`https://conectatech-comercial-piloto.conectatech-ecu.workers.dev/webhooks/meta`

Alcance: recibir únicamente pruebas de la Página CONECTATECHec, validar firma, reconocer MICR27/MICR027, POWE003 y ADAP005, preparar borradores comerciales y consultar su resultado con autenticación. Nunca se envía un mensaje por Graph API, no se publica la app ni se procesan clientes no autorizados. No se modifica main ni el catálogo.

**Control adicional:** todos los despliegues fijan `META_INGRESS_ENABLED=false`. Los eventos de Página autenticados se ignoran sin almacenar hasta una habilitación deliberada posterior. Las pruebas internas usan solo el espacio CI y no abren la recepción de Meta. Configurar secretos o completar el challenge no cambia ese control.

## Configuración segura

En GitHub → Settings → Environments → `conectatech-piloto-gratis`, agregar:

| Tipo | Nombre | Contenido |
|---|---|---|
| Secret | META_VERIFY_TOKEN | Valor aleatorio de al menos 32 caracteres generado por un gestor de contraseñas. No reutilizar PILOT_TOKEN ni App Secret. |
| Secret | META_APP_SECRET | App Secret de Jotacellcomunicapp, desde Meta Developers → App Settings → Basic. |
| Secret | META_TEST_SENDER_IDS | Lista separada por comas de PSID de los probadores autorizados para esa Página; no son IDs generales del perfil de Facebook. |
| Variable | META_PAGE_ID | ID numérico de CONECTATECHec; el nombre de la Página no sustituye al ID. |

El propietario puede compartir únicamente el Page ID en chat si necesita ayuda. Nunca compartir App Secret, Verify Token, PILOT_TOKEN ni PSID aquí. No colocar secretos en commits, URLs de documentación, artifacts, Issues o capturas públicas.

El workflow autorizado copia esos secretos al mismo Worker mediante su token Editor existente. Conserva secretos remotos conocidos entre versiones. No utiliza permisos Billing/D1 ni solicita Page Access Token. `META_MODE=development-only` queda fijado por código de despliegue, sin opción de envío en vivo. Si falta algún elemento, el receptor falla de forma cerrada o ignora eventos ajenos; no se asume que esté conectado a Meta.

Alternativa manual: una vez desplegado el receptor, en Cloudflare → Workers & Pages → `conectatech-comercial-piloto` → Settings → Variables and Secrets, guardar los tres secretos como **Secret** y Page ID como variable, exclusivamente en este Worker. Avisar para verificar la conexión. No agregar permisos al token CI para hacerlo.

## Configuración de Webhooks en Meta

1. Conservar **Jotacellcomunicapp en Desarrollo**. No pulsar publicar/Live ni autorizar mensajería masiva.
2. En la configuración de Webhooks del objeto **Page**, introducir el Callback URL anterior. En **Verify token**, pegar directamente el mismo valor privado guardado como META_VERIFY_TOKEN desde el gestor de contraseñas. No se recupera por chat ni desde el repositorio.
3. Meta enviará GET con `hub.mode=subscribe`, `hub.verify_token` y `hub.challenge`. El endpoint devuelve el challenge como texto exacto con HTTP 200 si el token coincide; devuelve 403 con token ausente/incorrecto. No requiere Authorization Bearer porque Meta no lo envía en ese handshake.
4. Para las pruebas recibidas, seleccionar el campo `messages`. No suscribir campos adicionales innecesarios. Mantener usuarios de prueba con roles de la app y acceso permitido a la Página según Meta. La configuración de webhook de la app no prueba por sí sola que la Página esté suscrita o que los permisos estén otorgados: comprobarlo en el panel de Meta antes de una prueba real.
5. Enviar desde un probador permitido una consulta como «precio MICR27». El PSID debe estar previamente en META_TEST_SENDER_IDS. Si Meta ofrece un payload sintético desde su consola, sus IDs deben corresponder a la Page/allowlist para poder procesarlo; de lo contrario se ignora deliberadamente. Las pruebas de consola no demuestran por sí solas un mensaje enviado por una persona.
6. Consultar privadamente `GET /messenger/test-results` con el mismo Bearer PILOT_TOKEN del piloto. No insertar ese token en la URL ni en una página pública. Verificar el borrador preparado y que `outbound_enabled=false`. Ninguna respuesta aparecerá automáticamente en Messenger: en esta fase solo se prepara y verifica.

Para habilitar una prueba posterior de envío haría falta revisar por separado la autorización de Página, `pages_messaging`, la ventana de atención y cualquier permiso de suscripción efectivamente exigido por Meta, por ejemplo `pages_manage_metadata`. No se solicitan ni utilizan esos tokens/permisos de envío en este cambio.

## Seguridad y aislamiento

POST verifica `X-Hub-Signature-256` mediante HMAC-SHA256 con META_APP_SECRET sobre el cuerpo UTF-8 exacto antes de parsear o almacenar eventos. Un cuerpo modificado o una firma ausente/incorrecta devuelve 403. Límite del cuerpo 64 KB y máximo 10 mensajes de prueba por lote.

Solo se acepta objeto Page, Page ID configurado, recipient Page correcto y PSID de la allowlist, sin ecos. Se ignoran mensajes de más de 24 horas y timestamps futuros anómalos. El modo Desarrollo en Meta es una protección adicional; la allowlist del servidor mantiene el aislamiento aunque cambie una configuración de la app. Los otros clientes se ignoran sin almacenar sus mensajes ni responderles.

El almacén recibe únicamente huella HMAC del identificador de evento y SKU reconocidos. **HMAC no es cifrado reversible.** No conserva texto libre, teléfono, nombre, PSID, App Secret ni Verify Token. Borradores contienen texto comercial del catálogo, precio, stock referencial, foto verificada y banner de imagen vigente cuando existe (MICR27). Para todos los SKU prepara una tarjeta nativa de Messenger con la fotografía y enlace público de la ficha; no trata una tarjeta HTML privada como imagen de Messenger.

## Deduplicación, errores y costo $0

Un Durable Object `MessengerTestInbox`, con backend SQLite y binding MESSENGER_TEST_INBOX del mismo Worker, mantiene unicidad de la huella por 7 días. La deduplicación no depende de memoria de proceso o caché regional. La inserción se confirma antes del ACK a Meta. Un fallo de almacenamiento devuelve 503 para que Meta pueda reintentar; duplicados no crean otro borrador.

El procesamiento usa alarmas durables con hasta tres intentos y reintento espaciado. Si falla el feed o un hash de fotografía cambió, queda un código genérico `SOURCE_OR_MEDIA_FAILED`, sin texto del usuario ni secretos. Las alarmas también limpian registros caducados. Tope local: 100 eventos/día por espacio; al excederlo se rechaza la admisión. Una caída después del ACK conserva el evento pendiente para el siguiente procesamiento durable.

Existen espacios separados `messenger-development` para Meta y `messenger-ci` para fixtures sintéticos. `POST /messenger/self-test` y `GET /messenger/test-results?scope=ci` exigen Bearer PILOT_TOKEN. La prueba CI genera firmas sintéticas con una clave de prueba derivada del token privado; **no afirma que Meta entregó un mensaje real ni que el App Secret quedó validado**. Los reportes lo identifican explícitamente. Si META_VERIFY_TOKEN está configurado en GitHub, se prueba además el handshake HTTPS con ese token sin imprimirlo.

Durable Objects SQLite está incluido en Workers Free: al exceder las cuotas gratuitas falla, sin actualización de plan por el sistema. No se usan namespaces KV de pago, D1, Queues, servidores, planes facturables ni permisos de facturación. El rol Editor limitado al Worker ya cubre su Durable Object; no se amplía el token. El trabajo permanece sujeto a CF_FREE_ONLY_CONFIRMED=true, verificado por el propietario en el panel.

Fuentes oficiales: [Durable Objects Free](https://developers.cloudflare.com/durable-objects/platform/pricing/), [permisos heredados del Worker](https://developers.cloudflare.com/workers/authorization/durable-objects/), [documentación oficial de Meta Messenger en Postman](https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api).

## Estado de verificación

Las pruebas locales de seguridad y SQLite no sustituyen la prueba en Cloudflare. El workflow despliega solo el Worker autorizado, verifica primero el piloto existente por HTTPS y después el receptor sintético firmado, deduplicación y preparación durable de los tres SKU. La recepción real desde Jotacellcomunicapp continúa pendiente hasta introducir secretos/Page ID/PSID y completar el handshake y una prueba real desde Meta en Desarrollo. No se declara app publicada ni envío a clientes.
