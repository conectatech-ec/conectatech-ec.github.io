# Preparación de acceso a clientes externos — CONECTATECH / Alex

## Estado acreditado por API

Token de CONECTATECHec válido, tipo PAGE, aplicación coincidente, `pages_messaging` concedido. Eso habilita la validación con probadores con rol aceptado. No acredita App Live, aprobación de Advanced Access ni revisión empresarial. Esta sesión no dispone de la sesión administrativa de Meta ni de un API para presentar App Review en nombre del propietario.

## Conversación probadora acreditada

16 de octubre de 2026, 14:57–14:58 de Ecuador: dos consultas externas con firma válida y HTTP 200, ambas procesadas por Alex con el modelo generativo real; Graph API aceptó dos textos y una imagen con HTTP 200. El probador confirmó la recepción en Messenger. [Evidencia sin identificadores ni mensajes privados](generated/fase2/alex-cloud-verificado.json). No hay recibo automático message_deliveries ni una grabación de pantalla creada por esta sesión.

## Acción de cuenta imprescindible para compradores externos

En Meta for Developers → Jotacellcomunicapp → App Review / Permissions and Features o el caso de uso Messenger que muestre el panel:

1. Comprobar `pages_messaging` y solicitar el nivel de acceso que Meta exija para personas externas a roles. No pedir permisos de anuncios, facturación ni perfiles.
2. Completar la verificación empresarial que el panel solicite; no contratar Meta Verified. Proporcionar datos reales del negocio, contacto, política pública de privacidad e instrucciones/mecanismo de eliminación de datos revisados por el propietario. No inventar identidad legal, dirección ni plazos legales.
3. Adjuntar instrucciones y grabación de una conversación real autorizada: consulta natural del JBL Quantum Stream, respuesta con fuente vigente y fotografía/banner, luego la batería Philco y el adaptador Europa a Latino; seguimiento con «¿Y ese cuánto cuesta?», tarjeta y planes vigentes; transferencia a vendedor y parada. No mostrar secretos, identificadores personales ni conversaciones de clientes. No usar fixtures CI como grabación probatoria.
4. Verificar que la Página, además del webhook de la app, está vinculada y suscrita a `messages`. Añadir `message_deliveries` para confirmar entrega si la configuración oficial lo permite. No ampliar permisos automáticamente. Gestionar este enlace en la interfaz de Meta evita conceder `pages_manage_metadata` solo para un diagnóstico.
5. Tras aprobación, conservar evidencia del nivel concedido y del modo Live/público requerido. Solo entonces retirar el filtro de probadores mediante un cambio controlado y nueva prueba externa. El propietario ya pidió habilitar funciones autorizadas; no se requerirá repetir autorización comercial, pero sí acreditar el permiso de Meta.

## Texto propuesto para la revisión

«CONECTATECH responde consultas iniciadas por personas en Messenger de su Página. Alex utiliza generación de lenguaje real con memoria contextual cifrada de 24 horas y hechos comerciales verificados. Utiliza pages_messaging para contestar dentro de la ventana estándar con información de tres productos del catálogo propio: precios y disponibilidad actualizados, fotografías aprobadas y opciones de entrega pendientes de confirmación. No envía campañas ni mensajes proactivos fuera de ventana. El usuario puede pedir atención por una persona. Existen deduplicación persistente, bloqueo de fuentes vencidas, parada del operador y registros mínimos con eliminación operativa a siete días. La prueba se realiza con cuentas autorizadas y aisladas de clientes.»

Esto es un borrador de justificación, no una solicitud presentada ni aprobada. URLs preparadas en el Worker: `https://conectatech-comercial-piloto.conectatech-ecu.workers.dev/privacy` y `https://conectatech-comercial-piloto.conectatech-ecu.workers.dev/data-deletion`. Revisar los datos reales de negocio y los campos exigidos por Meta antes de presentar la revisión. La verificación de empresa no es Meta Verified de pago; no contratar servicios. Código y operación: VENDEDOR-MESSENGER.md.

Fuentes oficiales:
- https://developers.facebook.com/docs/messenger-platform/
- https://developers.facebook.com/docs/messenger-platform/app-review/
- https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api
