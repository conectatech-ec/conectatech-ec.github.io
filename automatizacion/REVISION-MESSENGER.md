# Estado de revisión de Messenger

La revisión automática rechazó el primer push que habría desplegado la recepción de Meta antes de verificar permisos, secretos y funcionamiento integral. Se conservó el Worker anterior mientras se preparaba una alternativa de menor riesgo.

Se añadieron un control de recepción cerrado por defecto (`META_INGRESS_ENABLED=false`), 34 pruebas y un ensayo integral HTTP/SQLite en CI. Tras comprobar esos controles, la revisión permitió instalar exclusivamente pruebas internas autenticadas y un Durable Object SQLite Free del mismo Worker. No se amplió el token, no se publicó la app ni se habilitaron mensajes de Página o Graph Send API.

La versión cerrada está desplegada y sus pruebas HTTPS pasaron en [Actions 38851281623](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/38851281623). Evidencia: [messenger-desplegado-verificado.json](generated/fase2/messenger-desplegado-verificado.json). Se volvió a dejar `activar:false` para impedir nuevos uploads accidentales; el servicio continúa activo.

La conexión real de Jotacellcomunicapp sigue pendiente de META_VERIFY_TOKEN, META_APP_SECRET, META_PAGE_ID y META_TEST_SENDER_IDS. La recepción de Página permanece expresamente deshabilitada incluso si se agregan esos valores. Antes de abrir pruebas de la Página deben comprobarse secretos, permisos y handshake real, manteniendo la app en Desarrollo y sin envíos.
