# Receptor privado 593: cambio propuesto, pendiente de aprobación

Preparación del 11-11-2026. Sin despliegue, `bootstrap`, `ingest`, PUT al Worker ni cambios en `main`. No habilita checkout, Merchant Center ni anuncios. No cambia ni suspende Sincronización multicanal 593. Costo adicional: USD 0; no incorpora servicios, recursos ni dependencias.

## Evidencia autenticada y límite de la conclusión

La comprobación focalizada del flujo original terminó a las **2026-11-11 04:16:21 UTC** en el commit `a32e0142e11df6b89291d144735ed6ae86f60bda`:

- [Ejecución 42958107487](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/42958107487), job `130317926365`.
- Anotación autenticada: `INGEST_RECEIVER_STAMPS_REQUIRED_RELEASE_ABSENT_CODE_ABSENT`.
- Faltan en el módulo activo **ambos identificadores**, no sólo valores con formato incorrecto: `COMMERCIAL_PROCESSOR_RELEASE` (commit Git de 40 hexadecimales) y `COMMERCIAL_PROCESSOR_CODE_SHA256` (SHA-256 de 64 hexadecimales del paquete de código público).
- Las pruebas previas pasaron; normalización, ingestión, verificación comercial y eliminación del Excel quedaron omitidas. El cierre sin reserva terminó correctamente. La comprobación usa GET; no invoca el receptor de archivos, ni adquiere reserva ni realiza PUT. QA sintético asociado `42958107394`: correcto.

Esto **no demuestra** que todo el módulo activo sea idéntico al receptor histórico público. Tampoco demuestra compatibilidad completa de ingestión: la comprobación se detuvo antes de comparar el cuerpo completo y el estado HTTP. No se descargaron ni publicaron cuerpos privados.

## Cambio exacto que se somete a revisión

Se reutiliza el receptor ya preparado en `automatizacion/commercial-reception.mjs`, sin reconstruirlo ni modificarlo en este borrador. La adaptación eventual sustituiría **únicamente ese módulo** dentro del bundle activo mediante el mecanismo original de actualización acotada. Todos los otros módulos, incluido `central-data.mjs`, entrypoint, MIME, cabeceras ajenas y settings/bindings/permisos deben conservarse.

Artefactos públicos fijados:

| Artefacto | Referencia / SHA-256 |
| --- | --- |
| Original conocido | `cc05f6d77adef1ff36f3b9d0e6f75d801517553b:automatizacion/commercial-reception.mjs` |
| SHA-256 del original | `c51cf151763663cd7df94b94c5bde641eff82ceeaf56894d5943de59777ae195` |
| Plantilla revisada, con placeholders | `c0975c3d31421ce91d147c84f2c80e85523bd40ae540a2595530826e9eb53845` |
| Paquete público de esta preparación (`public_code_hash`) | `f46b10caf872d4d262f668e0c2827273bbd7a0e0098039fda8b2f3ed544fd66d` |

El diff completo está en [adaptacion-publica.patch](adaptacion-publica.patch): **110 líneas añadidas y 20 eliminadas** respecto de ese original conocido. No se presenta como una modificación de sólo dos constantes. Además de las marcas, contiene controles ya existentes en la plantilla revisada: historial por SHA, reservas con caducidad, comprobación de contenedor XLSX, nombres históricos/original y disparo fijado al commit del procesador. Conserva cifrado, bandeja única, retención de 24 horas, exportaciones originales y las mismas rutas/métodos. No añade rutas, permisos ni planificador.

Las marcas se renderizarían con el **commit realmente aprobado/instalado** y su `public_code_hash()`. El SHA del Excel y el SHA del módulo no sustituyen la huella del paquete. No se asigna una identidad de la plantilla nueva al código histórico: añadir sólo constantes deja la comparación de cuerpo incompatible, como verifica una prueba.

El receptor adaptado crea, cuando se inicializa en una ejecución futura autorizada, `commercial_receipts` únicamente en el namespace comercial y copia allí la identificación de la bandeja existente sin borrar el Excel cifrado. No cambia precios, SKU ni datos de la fuente. Las fechas/validaciones desconocidas del histórico permanecen vacías; no se inventan aprobaciones. Esta evolución de almacenamiento forma parte de la adaptación y requiere aprobación expresa de instalación.

## Preparación en el mecanismo original

Se añade a `automatizacion/scoped_content.py` el modo **`--plan-receiver`**. No hay workflow nuevo ni cambios en los workflows existentes en este borrador. El modo:

1. Exige la rama piloto original, la declaración Free y `activar: false`.
2. Funciona con `datahub_scoped_content_enabled: false`; no promueve la bandera ni llama a autorización de escritura.
3. Usa los mismos accesos GET y la captura en memoria del mecanismo original.
4. Acepta solamente el cuerpo público original de SHA fijado arriba y la plantilla revisada exacta. Cualquier diferencia desconocida produce `RECEIVER_BASELINE_NOT_REVIEWED`, sin convertir ausencia de marcas en autorización de reemplazo.
5. Construye en memoria el bundle candidato, comprueba la inversa y vuelve a comparar bundle/settings para detectar cambios concurrentes.
6. Emite únicamente un recibo de planificación, hashes de artefactos públicos y `worker_puts: 0`, `ready: false`, `ingest_ready: false`, `deployment_authorized: false`. No serializa la captura ni los módulos privados. El objeto de planificación oculta su contenido en `repr`.

No llama a `bootstrap`, `commit`, `ingest`, reservas, recepción de archivos ni dispatch. No se ha conectado este nuevo modo a un disparador. Los modos de escritura originales siguen requiriendo promoción expresa; este PR no les añade permisos ni excepciones.

## Pruebas locales

**183 pruebas aprobadas**, todas con datos sintéticos o código público y sin acceso al Worker:

- 64 existentes: `scoped_content_test.py` (45), `scoped_integration_test.py` (8), `ingest_receiver_test.py` (11).
- 16 nuevas: `receiver_plan_test.py` (12), `receiver-migration.test.mjs` (4).
- 103 de regresión: receptor y reservas (9), Worker (10), fuente/rutas privadas (4), Messenger (21), ingreso cerrado (14), continuidad del hub (4), preservación del receptor (6), preservación de fuente (14), integridad de inventario (12), sincronización 593 (9).

Incluyen aplicación y reversión del parche público byte por byte; preservación de todos los módulos ajenos y fuente; rechazo de cambios concurrentes de código/permisos; cierre sin promoción; rechazo del parche de sólo marcas; migración idempotente de la bandeja histórica con SQLite; preservación de registros ajenos de Messenger; rutas/exportaciones originales y campos de la fuente intactos.

La protección de checkout y otros módulos se fundamenta en la conservación byte por byte del bundle ajeno y en las regresiones del Worker; no se afirma haber probado una instalación real ni haber ejecutado el checkout publicado.

## Ruta de aprobación e instalación posterior

1. Revisar y aprobar este borrador contra la rama piloto; no fusionar a `main`. Mantener ambas banderas en `false` y el entorno `conectatech-piloto-gratis`.
2. Antes de autorizar una escritura, obtener **un plan autenticado focalizado** con `python automatizacion/scoped_content.py --plan-receiver` en el paso de lectura del workflow original y el commit fijado. Ese cambio de comando debe quedar revisado en el mismo flujo de desarrollo; no está instalado ni ejecutado aquí. El recibo debe confirmar la base conocida y cero escrituras. Si no coincide, detenerse: el parche adjunto no está aprobado para otra base. No repetir auditorías generales.
3. Dirección General debe autorizar por separado una instalación única del receptor y su transición de almacenamiento. La invocación de escritura aún no se prepara como ejecución habilitada. **No basta cambiar la bandera a `true` ni ejecutar el workflow completo:** eso puede habilitar la ingestión. Cualquier adaptación del workflow original para instalar el receptor deberá omitir expresamente reporte, ingestión, verificación comercial y eliminación del Excel, y conservar el cierre sin reserva.
4. En esa instalación futura, recapturar/comparar bundle, settings y fuente inmediatamente antes del único PUT; conservar el control de revisión y las verificaciones del actualizador original. Detenerse ante deriva o incompatibilidad, sin reintentos de escritura.
5. Confirmar con `--check-ingest` cuerpo completo, ambas marcas y su concordancia con `/commercial/catalog/status`, preservación de fuente, Messenger y restantes módulos. La ingestión seguirá cerrada. La aprobación/vigencia del Excel deberá comprobarse antes de una autorización posterior de ingestión; este trabajo no renueva ni altera esa evidencia.

## Reversión

La función pura `receiver_rollback_candidate` prepara únicamente la inversa en RAM. Exige que bundle/settings actuales sean exactamente los del candidato; ante cualquier modificación concurrente falla. Verifica que se reconstruyan todos los bytes anteriores. No hace llamadas ni sube nada.

Durante una instalación futura autorizada, conservar el módulo anterior en memoria hasta terminar verificaciones. Si se requiere reversión, detener procesamiento comercial y solicitar/usar la autorización específica de reversión del receptor; reemplazar sólo el módulo anterior y preservar fuente, settings y módulos ajenos. Nunca hacer rollback global del Worker ni sobrescribir concurrencia. Si terminó el proceso, el original puede recuperarse del commit público fijado **sólo si el plan autenticado había acreditado su coincidencia exacta**; recapturar y revisar antes de cualquier escritura.

La reversión de código no elimina la tabla aditiva de recibos ni deshace eventos comerciales que hubiesen ocurrido después. Este ensayo no los ejecuta. No se autoriza borrar tablas, archivos pendientes ni restaurar un Excel/fuente antiguos para simular una reversión completa.
