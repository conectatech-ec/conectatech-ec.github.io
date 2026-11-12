# Diagnóstico del fallo de instalación y parche pendiente de aprobación

## Evidencia existente, sin nuevas ejecuciones

Se revisaron únicamente los metadatos y anotaciones existentes de la [ejecución 43089679928](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/43089679928), intento 1, job `130763122290`, commit `d8725238f620e2a78c4328e8547031d2911d97d2`. Terminó el 11-11-2026 a las 14:43:04, hora de Guayaquil.

El recibo confirma `BLOCKED_RECOVERED`, un intento de instalación, uno de recuperación y restitución exacta del receptor anterior. Confirma además conservación de módulos ajenos, fuente y settings. Preflight correcto; pasos comerciales omitidos. No contiene el código ni la fase del error inicial.

**Causa exacta del fallo histórico: no determinable con la evidencia retenida.** `install_receiver()` descartó la excepción inicial y después cualquier excepción de recuperación. El estado final informa cómo terminó la recuperación, no qué la provocó. No existe un código inicial registrado que pueda extraerse ahora; no se descargan registros privados ni se consulta de nuevo el Worker.

El contador se incrementa antes de enviar el PUT, por lo que un intento contabilizado no acredita una respuesta satisfactoria. Incluso una pérdida de respuesta después de aplicar el cambio puede terminar con el mismo recibo. En cambio, un fallo antes de todo intento de escritura no explica este recibo concreto: no entra en su rama de recuperación.

## Reproducción local del código exacto que falló

La prueba `test_historical_aggregate_cannot_distinguish_three_different_initial_errors` carga sólo el código público del commit `d8725238...` desde los objetos Git locales y lo ejecuta contra fixtures en RAM. Tres escenarios distintos producen recibos históricos **idénticos**, incluido `BLOCKED_RECOVERED`:

1. El PUT se aplica pero se pierde su respuesta (`CF_HTTP_502` sintético).
2. El bundle está actualizado pero el status HTTP aún representa al receptor anterior.
3. La comprobación posterior observa marcas HTTP diferentes (`INGEST_RECEIVER_STATUS_MISMATCH`).

Esto demuestra la pérdida de información y la imposibilidad de elegir retrospectivamente una de esas causas. No confirma que ninguna de ellas sea la causa real de GitHub.

Se demuestra además un defecto concreto del flujo anterior: cuando bundle y fuente ya coinciden, comprueba la versión HTTP una vez y lanza `PROCESSOR_RELEASE_NOT_VERIFIED` inmediatamente, aunque todavía queden iteraciones del presupuesto de propagación. Por ello una respuesta HTTP transitoriamente antigua puede provocar una recuperación innecesaria. La primera comprobación tampoco valida la huella de código; esa validación quedaba para `check_ingest`.

## Cambio preparado en el actualizador original

El parche se limita a `scoped_content.py`, pruebas sintéticas y este documento. No cambia el receptor aprobado, sus marcas, los permisos de instalación, workflows, configuración, transportes ni presupuestos de PUT.

**Diagnóstico seguro:** conserva `initial_failure` y `recovery_failure` por separado, incluso después de recuperar correctamente o cuando la recuperación falla. Cada uno contiene fase y código público; cuando se observan marcas HTTP añade únicamente los estados `match`, `mismatch`, `absent` o `invalid`. No incluye los valores observados, cuerpos, excepciones completas, causas, trazas, URLs, credenciales ni datos de la fuente.

Los códigos proceden de una lista cerrada del protocolo público y de códigos HTTP numéricos acotados. Un mensaje desconocido se convierte en `SCOPED_CONTENT_FAILED`, incluso si sólo contiene mayúsculas y guiones bajos: una expresión regular por sí sola permitiría registrar un secreto con ese formato. Los sufijos se descartan. El formateador exterior también filtra campos añadidos a una excepción. El estado final `BLOCKED_RECOVERED` no sustituye ni se vuelve a etiquetar como error inicial.

| Fallo reproducido | Fase registrada | Código / conducta |
| --- | --- | --- |
| Rechazo o pérdida de respuesta del PUT | `installation_write` | `CF_HTTP_403`, `CF_HTTP_502`, etc.; nunca repetir el PUT |
| Bundle aún no visible al agotar lecturas | `bundle_propagation` | `SCOPED_PROPAGATION_FAILED` |
| HTTP sigue representando exactamente el receptor anterior | `http_propagation` | `RECEIVER_HTTP_PROPAGATION_TIMEOUT` al agotar el presupuesto |
| Versión o huella HTTP inesperadas | `receiver_http_stamps` | `PROCESSOR_RELEASE_NOT_VERIFIED` o `PROCESSOR_CODE_NOT_VERIFIED`; detener sin esperar |
| Marcas del módulo ausentes/no reconocidas | `receiver_bundle_stamps` | Código `INGEST_RECEIVER_STAMPS_REQUIRED_...` específico |
| Cuerpo del módulo incompatible | `receiver_body` | `INGEST_RECEIVER_INCOMPATIBLE` |
| Incoherencia de marcas en lectura posterior | `postcheck_http_stamps` | `INGEST_RECEIVER_STATUS_MISMATCH` |
| Captura o comparación final posterior | `postcheck_capture`, `postcheck_fence`, `post_install_fence` | Código público de la comprobación que falló |
| Recuperación insegura, PUT fallido o restitución no verificada | `recovery_precheck`, `recovery_write`, `recovery_verify`, etc. | Se conserva como segundo error, junto al inicial |

**Corrección acotada de propagación propuesta:** sólo durante la instalación del módulo aprobado, si la base es exactamente el receptor histórico conocido y el status HTTP coincide con todos los metadatos del status anterior derivados de la fuente capturada en RAM, continúa dentro de las mismas **12 iteraciones totales**, con el mismo intervalo. Las lecturas del bundle y del status comparten presupuesto; no son dos bucles independientes. No se concede otro PUT.

La ausencia de marcas por sí sola no basta: metadatos diferentes, campos adicionales, marcas parciales, versiones inesperadas o huellas incorrectas detienen la operación. Cada iteración mantiene las comprobaciones de bundle/settings/estado/Messenger/fuente. Sólo se acepta éxito con ambas marcas correctas y comparación completa satisfactoria. Si persiste el status anterior, se conserva su código de timeout y se aplica la misma recuperación condicionada original. La propagación normal de los otros modos no cambia.

La hipótesis de retraso HTTP queda así cubierta por una corrección probada sin presentarla como diagnóstico histórico confirmado.

## Pruebas y límites

**117 pruebas locales aprobadas:** 20 nuevas de diagnóstico y reproducción histórica, más las 97 existentes del instalador, autorización, recuperación, actualizador, integración, receptor y planificación.

Las nuevas cubren: respuestas de escritura perdidas antes/después de aplicar; timeout del bundle; retraso HTTP transitorio y persistente; presupuesto combinado de 12 lecturas; versiones, huellas o metadatos ajenos; errores posteriores; separación entre fallo inicial y de recuperación; rechazo de reversión ante código desconocido; fallos de escritura/verificación de recuperación; cero PUT antes de autorización; anotación CLI sin secretos y sin sobrescribir el error inicial. Las restauraciones se comparan contra el bundle original completo y se mantienen los límites de un intento por fase.

Se ejecutaron exclusivamente suites locales con transportes falsos y SQLite/fixtures previos. La reproducción histórica requiere los objetos Git públicos `d8725238...` y `e5ac06df...`, disponibles en este checkout. No se ejecutó ningún workflow ni petición autenticada al Worker, ni `bootstrap`, `ingest`, instalación o recuperación real.

## Integración autorizada del diagnóstico

Dirección General autoriza integrar PR #370 exclusivamente en la rama piloto, condicionado al cierre de escrituras. El permiso de instalación de PR #369 sigue consumido: exige un sucesor directo de PR #368 e intento 1; este parche **no lo renueva**. No procede usarlo para otro intento bajo la autorización anterior.

Comprobación específica de esta integración: los tres archivos del PR no coinciden con las rutas de `central-593.yml`, `comercial-cloud.yml` ni los demás workflows de escritura. Sólo coincide el QA sintético `comercial-piloto.yml`, sin entorno privado y con `contents:read`. No hay workflows asociados mediante `workflow_run` o `pull_request_target`. La integración omite CI mediante el mensaje del commit; se conserva además el bloqueo independiente por rutas y autorización consumida.

El workflow original, la configuración y la función `require_receiver_installation()` permanecen idénticos a la rama piloto previa. `activar:false`, `datahub_scoped_content_enabled:false` y costo máximo cero. El reporte conserva `if:false`; los pasos comerciales dependientes no pueden avanzar.

Cuatro comprobaciones sintéticas dirigidas, con cero construcciones de `CFClient` y cero peticiones remotas, acreditan:

- El sucesor del padre actual `d8725238f620e2a78c4328e8547031d2911d97d2` recibe `RECEIVER_INSTALLATION_REVISION_NOT_AUTHORIZED`.
- Repetir la ejecución consumida con intento 2 recibe `RECEIVER_INSTALLATION_NOT_AUTHORIZED`.
- `bootstrap` e `ingest` con las banderas cerradas reciben `SCOPED_WRITES_NOT_PROMOTED` antes del transporte.

Se conservan las 117 pruebas ya aceptadas y los registros diferenciados `initial_failure` y `recovery_failure`, con fases de propagación, marcas, comprobación posterior y recuperación. No se repiten las auditorías ni la instalación.

## Preparación mínima de una futura instalación, sin habilitarla

Una futura operación necesita una autorización nueva y específica. La intervención pendiente se limita a separar el ancla de autorización de instalación del commit de los artefactos aprobados: actualmente `APPROVED_RECEIVER_RELEASE` también fija el padre autorizado, por lo que no se debe cambiar ese valor para rearmar el permiso y terminar alterando la identidad del receptor.

El cambio futuro deberá presentar para aprobación un padre autorizado fijado al commit vigente tras PR #370, un identificador nuevo de permiso de un solo uso y el primer intento del workflow original. Esos valores no se configuran ni activan en este PR. Deben continuar las verificaciones de revisión vigente, origen de workflow y checkout, entorno original y plan Free, junto con ambas banderas y reporte deshabilitados.

Artefactos que se conservan como propuesta pendiente de esa autorización:

| Elemento | Valor fijado |
| --- | --- |
| Base del receptor que debe seguir activa antes de escribir | `c51cf151763663cd7df94b94c5bde641eff82ceeaf56894d5943de59777ae195` |
| Commit del paquete público aprobado | `e5ac06df086130a6776205250dd4d96c65882797` |
| SHA-256 de ese paquete | `6287802a95e7cb1ecc86316ff5f7de24f9c29dcf856388ecda4e0193d37e3e76` |
| SHA-256 del módulo renderizado objetivo | `699ac61bcf8311ac72bdf56c723e3c562882517909c443d9521d5b132624b869` |

La preparación futura deberá validar el nuevo permiso con pruebas sintéticas, conservar los objetos Git públicos necesarios para recuperar esos artefactos y garantizar la captura/comparación inmediata del bundle/settings/fuente antes de un máximo de un intento de instalación. Mantendrá la verificación completa en lectura, el límite compartido de 12 lecturas de propagación y la reversión específica condicionada a ausencia de concurrencia, con un máximo de un intento de recuperación. No autoriza ingestión ni borrado del Excel. Si la base o los artefactos cambian, detenerse y revisar el alcance antes de escribir.

La integración actual sólo incorpora el diagnóstico, sus pruebas y esta preparación documental. `main`, Worker, receptor vigente recuperado, fuente, configuración y procesos de Sincronización multicanal 593 no se modifican ni suspenden. No se activan checkout ni sistemas comerciales. **Costo adicional USD 0**, sin infraestructura, dependencias ni servicios nuevos.
