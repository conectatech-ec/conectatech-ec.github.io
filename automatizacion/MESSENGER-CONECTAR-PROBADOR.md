> Corrección de vinculación 16-10-2026: recargar el panel después del despliegue. Usar «Copiar frase»; solo la última frase creada es válida durante diez minutos. «Mostrar PSID» permanece deshabilitado hasta una captura real y no es necesario cuando el registro automático ya lo guardó. El panel distingue captura, registro automático, caducidad y código reemplazado. Los recibos distinguen formato incorrecto, nonce no vigente, eco de Página, standby y eventos sin texto, sin guardar el contenido. No abrir META_INGRESS_ENABLED para resolver la vinculación. Evidencia en generated/fase2/vinculacion-diagnosticada.json.

> Actualización 16-10-2026: la implementación vigente de envío autorizado, lista de probadores y parada está en [VENDEDOR-MESSENGER.md](VENDEDOR-MESSENGER.md). Las restricciones de salida descritas abajo corresponden al prototipo anterior. No acreditan el estado del vendedor actual.

# Vincular probador y comprobar entrega desde Meta

Panel del piloto:

`https://conectatech-comercial-piloto.conectatech-ecu.workers.dev/messenger/setup`

Callback de Meta, ya verificado por el propietario:

`https://conectatech-comercial-piloto.conectatech-ecu.workers.dev/webhooks/meta`

## Paso de cuenta imprescindible

En Jotacellcomunicapp, conservar Desarrollo y vincular CONECTATECHec, Página **105549695770538**, al producto/caso de uso Messenger con el campo **messages**. El probador debe tener un rol aceptado en la app. Esto requiere la cuenta administradora de Meta; esta sesión no dispone de una conexión a esa cuenta ni de un Page Access Token. Configurar el callback de la app no sustituye suscribir la Página. Usar el acceso ya autorizado; si Meta requiere nuevos permisos, dejar esa operación pendiente y comunicar solo el nombre del permiso/código genérico del error.

La prueba de envío de una frase por la propia cuenta del probador tampoco puede delegarse mediante herramientas sin su sesión de Messenger. No hace falta inspeccionar registros generales de Cloudflare, consultar conversaciones de clientes ni ampliar permisos para obtener su PSID.

## Obtener el PSID con una frase de un solo uso

1. Abrir el panel del piloto y conectar con **PILOT_TOKEN** desde el gestor privado. El token no se incluye en la URL ni se guarda en localStorage, cookies o repositorio. No pegar App Secret o Verify Token en esa pantalla.
2. Confirmar que se usará una cuenta probadora autorizada con rol aceptado. Crear el código. El panel muestra una frase `CONECTATECH-PRUEBA …` válida diez minutos. No publicarla ni compartirla en el chat de Codex.
3. Desde esa cuenta, enviar la frase exacta a **CONECTATECHec en Messenger**. El Worker exige firma HMAC válida de la app, Página y recipient correctos, timestamp reciente y coincidencia con el código privado. Este mensaje solo vincula al probador; no procesa consultas comerciales ni genera envíos.
4. Cuando el panel indique vinculación, pulsar **Mostrar PSID una sola vez**. Guardarlo directamente en el secreto GitHub **META_TEST_SENDER_IDS** del environment **conectatech-piloto-gratis**. Varios PSID se separan por comas. El servidor elimina el PSID al mostrarlo; el panel lo oculta al cerrar sesión o al cumplirse diez minutos de sesión.
5. Confirmar únicamente que el secreto quedó configurado. No pegar PSID, frase ni tokens en el chat. El PSID no se agrega automáticamente a la lista de recepción. La recepción comercial y los envíos continúan bloqueados; cualquier apertura posterior de pruebas requiere autorización explícita.

No se solicitan `pages_read_engagement` ni acceso a conversaciones para este procedimiento. El PSID se recibe del evento oficial firmado, exclusivamente cuando coincide con el código secreto creado por el propietario.

## Qué evidencia se conserva

`GET /messenger/receipts`, con Bearer PILOT_TOKEN, devuelve recibos del propio Worker: hora UTC, POST `/webhooks/meta`, HTTP, firma verdadera/falsa/no evaluada, motivo y coincidencia de Página. No incluye cuerpo, cabeceras, IP, texto, MID, nombre, teléfono, PSID o credenciales. El panel muestra la hora de Guayaquil.

- `external_https`: solicitud al callback sin la autenticación privada de CI; una firma válida acredita la clave de la app. Correlacionar con la prueba enviada por el propietario; no atribuir automáticamente el aviso histórico de Meta a otro evento.
- `authorized_ci_probe`: comprobación HTTPS hecha por GitHub con la clave configurada y su autenticación privada. No prueba origen Meta.
- `synthetic_ci`: fixtures internos, en almacenamiento CI separado. No prueban entrega de Messenger.

Con la recepción cerrada, un Page POST firmado devuelve **200**, motivo `ingress_disabled`, sin encolar consultas. Esto ya funciona sin allowlist, evitando el 503 anterior. Una frase de vinculación válida produce `pairing_claimed` y tampoco encola consultas. Firma incorrecta devuelve **403**. Una firma no evaluada se conserva como null, nunca como verificada.

Se mantienen como máximo 50 recibos con firma válida y 10 con firma inválida/no evaluada, durante siete días. Los recibos de firma inválida tienen además tope de admisión de 100 por día para limitar abuso. Los identificadores de recibo son aleatorios y no derivan de personas o mensajes. La evidencia de casos rechazados no expulsa los recibos válidos. La consulta privada muestra los últimos 50.

El PSID de vinculación es la única excepción temporal al almacén sin identidades: queda cifrado mediante AES-GCM bajo una clave derivada de PILOT_TOKEN, durante un máximo de diez minutos, con código no reversible y consumo único. No se registra en logs ni artifacts. Se borra por consumo, cancelación, sustitución del código o expiración. No sirve para enviar mensajes desde esta versión.

## Diagnóstico por GitHub y Cloudflare sin permisos nuevos

El job `preparar` de una ejecución del workflow **Activar piloto cloud gratuito** con `activar:false` y `sincronizar_meta_verify_token:false` puede repetirse para leer configuración y recibos actuales sin desplegar ni enviar nada, siempre en la rama del piloto y el environment autorizado. Publica únicamente evidencia filtrada en `diagnostico-meta-solo-lectura`. Permite a Codex continuar el diagnóstico sin pedir al propietario que inspeccione Cloudflare manualmente. Elegir una ejecución con despliegue/rotación omitidos, porque GitHub puede volver a ejecutar jobs dependientes al reintentar un job; no usar una activación histórica para una lectura.

Durante el ensayo HTTPS, se intenta abrir un tail temporal del mismo Worker con el token Editor existente. Se exportan solo POST del callback y los campos de diagnóstico permitidos. Se descartan cabeceras, query strings, cuerpos y demás logs; la URL privada del tail permanece en memoria. Se elimina únicamente esa sesión al finalizar. Una denegación no provoca ampliación de permisos. El tail es observación en vivo, no recuperación de invocaciones pasadas. Fuente: [API Start Worker Tail, que admite Individual Workers Editor](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/tail/methods/create/).

Todo usa el Worker existente y su Durable Object SQLite Free. No se crean nuevos Workers, D1, destinos de logs, planes, suscripciones, tareas de facturación ni permisos de cuenta. `META_INGRESS_ENABLED=false` se conserva y no existe cliente Graph Send API. No se modifica main ni el catálogo público.
