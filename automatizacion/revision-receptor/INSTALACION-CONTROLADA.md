# Instalación única autorizada del receptor 593

Dirección General autoriza preparar y ejecutar una única instalación privada del receptor y, sólo si es demostrablemente segura, su reversión específica. No autoriza ingestión ni actualización de la fuente comercial.

## Artefactos y evidencia fijados

- Plan autenticado aprobado: [42966770891](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/42966770891), intento 1, job `130345674038` y anotación `DataHub receptor plan`.
- Commit del paquete público que se instala: `e5ac06df086130a6776205250dd4d96c65882797`.
- SHA-256 de ese paquete público: `6287802a95e7cb1ecc86316ff5f7de24f9c29dcf856388ecda4e0193d37e3e76`.
- Base activa conocida: `c51cf151763663cd7df94b94c5bde641eff82ceeaf56894d5943de59777ae195`.
- Plantilla aprobada: `c0975c3d31421ce91d147c84f2c80e85523bd40ae540a2595530826e9eb53845`.
- **Módulo renderizado que se instala:** `699ac61bcf8311ac72bdf56c723e3c562882517909c443d9521d5b132624b869`.

Las dos marcas corresponden al paquete aprobado, recuperado con `git show` y cuya huella se vuelve a calcular. El código nuevo del instalador no se presenta como si formara parte del receptor/paquete aprobado. No se modifica la plantilla del receptor ni se toma ningún otro módulo del checkout para sustituirlo en producción.

## Permiso exclusivo y ejecución

Se utiliza el workflow original `central-593.yml`, el mismo job, entorno `conectatech-piloto-gratis`, transportes y actualizador acotado. No hay workflow, Worker, servicio ni infraestructura nuevos.

El paso de recepción ejecuta `scoped_content.py --install-receiver`. El permiso público no es una credencial y sólo se acepta si:

1. La ejecución es un `push` de la rama piloto original, intento `1`, desde el workflow original fijado al mismo `github.sha` del checkout.
2. Su único padre inmediato es el commit aprobado de PR #368 y sigue siendo la revisión actual de la rama. Esto limita el permiso al commit de instalación; una ejecución posterior o repetida no puede volver a instalar.
3. La confirmación Free existente es `true`; las configuraciones local y vigente mantienen `activar:false` y `datahub_scoped_content_enabled:false`, sin rotación Meta ni costo permitido distinto de cero.

No se promueve el permiso general de escritura. Los modos `bootstrap` e `ingest` siguen cerrados. El paso `reporte` tiene además `if:false && ...`; los pasos comerciales dependientes no se ejecutan. El instalador devuelve `ready:false` incluso tras verificar correctamente la instalación. No adquiere reservas, procesa Excel, dispara acciones del receptor ni llama a la recepción de archivos.

## Comprobación inmediata y única escritura

El instalador recupera el paquete público aprobado y valida su SHA. Captura en RAM bundle/settings/estado/fuente, vuelve a planificar con la base conocida, comprueba la inversa exacta y rechaza cualquier diferencia concurrente. El candidato conserva todos los módulos, cabeceras, MIME y entrypoint ajenos al receptor, además de la fuente completa. El paquete comprimido debe quedar bajo un presupuesto conservador de 2.990.000 bytes dentro del límite Free de 3 MB. No añade bindings ni recursos de pago; usa el Worker y namespace SQL existentes, y el Free ya confirmado por el propietario.

Reutiliza `ScopedDeployer.commit`: comprueba de nuevo bundle, settings, bindings, fuente y estado inmediatamente antes del PUT, después de revalidar la autorización y revisión. El wrapper del transporte cuenta intentos incluso ante pérdida de respuesta: **máximo un intento de instalación**, nunca se repite el PUT por propagación o error.

Después usa la implementación original de `--check-ingest` (comparación completa del módulo y marcas, concordancia con el status HTTP y nueva comparación de bundle/settings) y vuelve a contrastar bundle, fuente y estado contra el candidato exacto. Todo se mantiene dentro del mismo proceso para conservar la captura anterior durante una recuperación eventual. Las lecturas de propagación están acotadas; no son reintentos de escritura.

La transición SQL es únicamente la aditiva ya documentada en PR #368. El instalador no ejecuta consultas SQL ni llama a las rutas comerciales que procesan o eliminan el Excel. No borra tablas ni registros. La inicialización aditiva se aplica por el receptor en su namespace cuando éste se inicialice, conforme al módulo aprobado; no se afirma una migración anticipada por el mero PUT del código.

## Recuperación autorizada, sin rollback global

La captura anterior permanece sólo en RAM; el receptor anterior es además recuperable del fixture/commit público fijado y su coincidencia real quedó acreditada en el plan anterior. No se serializan módulos privados ni secretos.

Si falla la verificación tras intentar instalar, primero se comprueba qué bundle está realmente activo. Si es el anterior, no se repite la instalación ni se efectúa una escritura de recuperación. Si hay una versión desconocida o cualquier cambio ajeno, se informa bloqueo y no se escribe.

Sólo si están activos exactamente el candidato y los settings originales, y fuente/estado/Messenger siguen coincidiendo, se prepara la inversa ya probada. Se revalida la autorización/revisión y se vuelve a comprobar la ausencia de deriva antes de **un único PUT de recuperación** del receptor. Se verifica la restitución completa; nunca se reintenta esa escritura. Ante duda o pérdida de respuesta se informa bloqueo. No se restauran datos comerciales, borran recibos ni revierten otros módulos. La reversión de código no borra la tabla aditiva ni deshace eventos comerciales ajenos.

## Validación local afectada

97 pruebas aprobadas: instalador/recuperación/autorización (19), actualizador (45), integración (8), receptor (11), planificación (14). Incluyen pérdida de respuesta, propagación con un solo PUT, reversión exacta, rechazo de cambios concurrentes, revocación del permiso, presupuesto Free, bloqueo de intentos posteriores y cierre de ingestión. No se repiten las auditorías concluidas ni las regresiones del módulo aprobado que no cambia.

El resultado se entrega mediante la anotación segura `DataHub receptor instalacion`, con commit y SHA del módulo, cuentas de intentos, comprobación de compatibilidad y conservación de componentes. Un fallo informa `BLOQUEADO` y no afirma preservación que no pueda verificarse.

`main`, PR comerciales, Sistema 593, SIGNATURE y Sincronización multicanal 593 no se modifican ni suspenden. Costo adicional: **USD 0**, con runner estándar de repositorio público y recursos Free existentes. Tras verificar el receptor, el siguiente paso será revisar aprobación/vigencia del Excel y preparar una autorización separada para una ingestión privada; no ejecutarla aquí.
