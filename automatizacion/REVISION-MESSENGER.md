# Estado de revisión de Messenger

La versión está preparada en la rama del piloto, con `activar:false`. El push con activación fue rechazado por la revisión automática antes de enviar la rama: habría desplegado código Messenger y Durable Object sobre el Worker activo antes de verificar permisos, secretos y funcionamiento integral.

Se continúa con la alternativa segura: publicar el código en la rama para CI, sin subir código a Cloudflare ni crear namespaces. El Worker desplegado en la fase anterior permanece sin cambios. Las pruebas de CI no se presentarán como recepción real de Jotacellcomunicapp.

La propuesta concreta pendiente es actualizar exclusivamente `conectatech-comercial-piloto` con receptor de Desarrollo, crear su Durable Object SQLite Free para deduplicación y preparar borradores sin enviar por Graph API. No hay Page Access Token ni código de Send API. Los secretos Meta y la allowlist son necesarios para procesar eventos reales de la app; sin ellos el receptor falla de forma cerrada.

Callback previsto: `https://conectatech-comercial-piloto.conectatech-ecu.workers.dev/webhooks/meta`. La ruta de la versión anterior no constituye evidencia de esta nueva integración. Las instrucciones de secretos y configuración de Meta están en MESSENGER-DESARROLLO.md.

Se requiere resolver la aprobación del despliegue y completar la configuración segura solicitada. No se publica la app ni se activa mensajería de clientes.
