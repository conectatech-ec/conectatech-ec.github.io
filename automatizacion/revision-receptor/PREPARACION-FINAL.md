# Preparación final: BLOQUEADO, sin nueva instalación

## Autorización limitada de continuación

Dirección General autoriza integrar PR #371 sólo en la rama piloto y ejecutar una única comprobación `--plan-receiver`. No autoriza instalar, reconstruir permisos, hacer PUT, bootstrap, ingestión ni cambiar banderas. Para cumplir la orden de no repetir pruebas aceptadas, esta etapa omite expresamente la batería automática del workflow original; el QA sintético asociado al merge se cancelará antes de sus pruebas. No se modifica el actualizador ni sus controles. La evidencia real y el resultado quedarán registrados en el PR, sin nuevas ejecuciones ante fallo.

Base de desarrollo: PR #370 integrado exclusivamente en la rama piloto, commit `7241f7feecd2acdd5915e880abc7f4feaa71dfd7`. Esta preparación no modifica esa rama publicada, main, Worker, configuración, los 922 SKU conciliados ni los 36 aislados.

## Evidencia nueva de lectura

Se ejecutó una sola vez el workflow manual existente `datahub-status.yml`, tras comprobar que su archivo coincide en main y piloto con SHA-256 `b96f6a64c6cc6d99d5f698c0ba0a10c3542846d60bd82147fcc562a59a7c4d7e`. Conserva los commits fijados del verificador/transporte, permisos de lectura, rama piloto y entorno `conectatech-piloto-gratis`.

[Ejecución 43153852770](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/43153852770), intento 1, job `130969110183`: **success**, finalizada el 11-11-2026 a las 23:18:00, hora de Guayaquil. El paso «Único GET autenticado y metadatos filtrados» terminó correctamente. El código fijado sólo solicita `GET /commercial/catalog/status` y exige HTTP 200 y esquema válido. Confirma funcionamiento del entorno y acceso de lectura por `PILOT_TOKEN`; no demuestra vigencia de datos ni permiso actual del token Cloudflare para leer bundles o escribir.

La política del entorno permite expresamente la rama piloto original. No se consultó de nuevo la API administrativa de Actions que había devuelto 403. No se ampliaron permisos ni se copiaron credenciales.

Ese verificador no comprueba el cuerpo del receptor ni /health, y no emite las fechas/hash mediante anotaciones o artefactos. Sus metadatos filtrados quedan en stdout; no se extrajeron de los logs, cuyo host de descarga no está autorizado en la política de red de este entorno. No se repitió la ejecución ni se buscan vías alternativas a esa restricción. Por tanto no se presenta como observado un SHA/versión actual del Worker ni una vigencia actual de la fuente privada.

## Receptor: comprobación exacta pendiente

La última evidencia completa sigue siendo la recuperación verificada de [43089679928](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/43089679928): receptor original de SHA `c51cf151763663cd7df94b94c5bde641eff82ceeaf56894d5943de59777ae195`. Es un antecedente; no se afirma que sea una nueva lectura del cuerpo activo.

El flujo original sigue instalado en modo `--install-receiver`, con permiso anterior consumido. Ejecutarlo de nuevo no es una comprobación válida de compatibilidad: debe quedar bloqueado. No se relanzó. Para comprobar ahora la base contra el instalador corregido hace falta aprobar el cambio de comando a `--plan-receiver` del presente borrador. No se aplica ni ejecuta aquí porque la instrucción vigente reserva los cambios de configuración para autorización expresa.

El borrador conserva el mismo workflow, job y entorno. Retira el identificador consumido del paso de lectura, mantiene `if:false` en reporte, ambas banderas cerradas y `ready:false` del plan. Aumenta el historial de checkout a cuatro commits para disponer de los objetos públicos fijados `d8725238...` y `e5ac06df...` usados por las pruebas. No cambia el actualizador, el receptor, secretos ni permisos. Las tres expectativas de pruebas se adaptan a esta etapa; **33 pruebas afectadas aprobadas** (8 integración, 11 receptor, 14 planificación). No se repiten las 117 aceptadas ni las auditorías.

## Fuente 593 accesible más reciente

Se buscó en Drive el reporte y archivos XLSX modificados después del corte conocido. No se encontró una exportación de inventario posterior entre las fuentes accesibles. Esto no demuestra ausencia de un archivo nuevo en Sistema 593 o en la bandeja privada inaccesible.

Original: [Reporte-Inventario.xlsx](https://drive.google.com/file/d/1XKAashd4ZJuOMP-rmNjeitcslq3ypXMv), 179431 bytes. Se descargaron los bytes originales nuevamente por Drive y se comprobó:

- SHA-256: `46eb92aa817c4f8dafe27b65fcc96280e90901cef0c1d2ba9ec2d7d763746f7f`.
- Creación/modificación internas coincidentes: **10-11-2026, 18:22:08 Guayaquil**.
- Vigencia máxima del contrato original: 24 horas; **venció el 11-11-2026 a las 18:22:08 Guayaquil**.
- Coincide con el SHA reconocido por Work/Dirección General y fijado en `CENTRAL_AUTHORIZED_SOURCE_SHA256` del paso de reporte deshabilitado. Esa identificación no constituye una autorización actual de ingestión ni elimina la caducidad.

Sólo se leyeron metadatos e integridad; el archivo vencido no se usa para normalizar, actualizar fuente, precios o inventario. No se renuevan timestamps. Hace falta una exportación original vigente y aprobación de su SHA mediante el flujo 593 antes de cualquier ingestión futura.

## Autorizaciones exactas pendientes

**Primera, sólo lectura:** «Autorizo integrar este borrador únicamente en `automatizacion/piloto-cloud-3sku-20261015` y ejecutar una sola comprobación `--plan-receiver` en `central-593.yml`, entorno `conectatech-piloto-gratis`, sin instalar, rearmar permisos, ejecutar bootstrap/ingest ni cambiar las banderas. Detener ante base desconocida, deriva o fallo de acceso». Esta aprobación no autoriza escritura al Worker.

**Después, únicamente si el plan real acredita la base y preservación:** presentar y aprobar un permiso nuevo de un solo uso, separado del commit de artefactos y anclado a la revisión realmente vigente tras la lectura. Debe identificar exactamente: base `c51cf151...`, paquete `e5ac06df086130a6776205250dd4d96c65882797`, huella pública `6287802a95e7cb1ecc86316ff5f7de24f9c29dcf856388ecda4e0193d37e3e76`, módulo objetivo `699ac61bcf8311ac72bdf56c723e3c562882517909c443d9521d5b132624b869`, primer intento del workflow original y coste cero. Autorizar como máximo un PUT de instalación y un PUT de recuperación específica si se demuestra segura; conservar captura previa, ambas banderas false, reporte deshabilitado, verificación posterior completa y las 12 lecturas compartidas de propagación con registros de fases/errores. No se configura ese permiso en este borrador.

La aprobación del receptor es independiente de una posterior ingestión. Antes de autorizar esta última se exige Excel original vigente, SHA concreto aprobado y reserva del mismo job; no se ejecuta ahora. No se autoriza checkout, productos, Merchant Center comercial ni Ads.

**Resultado:** BLOQUEADO para declarar el piloto listo: falta la comprobación actual del cuerpo del receptor y una fuente 593 vigente/aprobada. El entorno acredita una lectura autenticada, no todas las verificaciones necesarias para instalar. No hay bloqueo demostrado de Actions ni se solicita ninguna credencial. Sincronización multicanal 593 permanece sin modificación ni suspensión. **Costo adicional USD 0**; se reutilizan runner público estándar, Worker y recursos Free existentes.
