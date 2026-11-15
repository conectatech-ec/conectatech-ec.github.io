# Propuesta final de permiso único — INACTIVO

Preparación exclusiva desde PR #371, commit piloto `2df80f8db06b0eb1663342f4eda6f9b2f948cc4e`. No se instala, no se hace PUT, no se ejecutan workflows ni se fusiona este borrador. Las banderas comerciales permanecen false y Sincronización multicanal 593 no se modifica ni suspende.

## Identidad exacta propuesta para instalar

Se selecciona el **artefacto previamente aprobado**, sin actualizar silenciosamente sus marcas al commit del instalador. Ambas referencias contienen exactamente la misma plantilla pública, SHA-256 `c0975c3d31421ce91d147c84f2c80e85523bd40ae540a2595530826e9eb53845`. Sólo difieren las dos constantes renderizadas; por ello sus SHA de módulo no coinciden.

| Identidad | Previamente aprobada, SELECCIONADA | Candidato calculado por PR #371, NO seleccionado |
| --- | --- | --- |
| Commit/marca `COMMERCIAL_PROCESSOR_RELEASE` | `e5ac06df086130a6776205250dd4d96c65882797` | `2df80f8db06b0eb1663342f4eda6f9b2f948cc4e` |
| Paquete/marca `COMMERCIAL_PROCESSOR_CODE_SHA256` | `6287802a95e7cb1ecc86316ff5f7de24f9c29dcf856388ecda4e0193d37e3e76` | `4def4c9a1c494610726bcee73d1735ab389d82000bd40d788c04496a58bb2aad` |
| SHA-256 completo de `commercial-reception.mjs` renderizado | **`699ac61bcf8311ac72bdf56c723e3c562882517909c443d9521d5b132624b869`** | `6077f9d354542373712b6e3bbe87f3c39eea88fd391e049a21f53ba383a2f688` |

Las huellas de ambos paquetes se recalcularon desde sus objetos Git públicos con la lista original `CRITICAL_FILES`; ambas coinciden. La comparación de las plantillas es byte por byte. No se consultó nuevamente el Worker. La evidencia real de base/ausencia de deriva sigue siendo [43358135089](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/43358135089), intento 1, job `131664967929`. La base exigida inmediatamente antes de una futura escritura será `c51cf151763663cd7df94b94c5bde641eff82ceeaf56894d5943de59777ae195`; no se presupone que siga activa por el mero paso del tiempo.

## Permiso nuevo preparado y separado de los artefactos

En el actualizador original:

- `RECEIVER_INSTALL_PERMISSION_ENABLED=False`: deniega antes de Git/lecturas remotas/transporte. Sigue false en los archivos ejecutables de este borrador.
- `RECEIVER_INSTALL_PARENT=2df80f8db06b0eb1663342f4eda6f9b2f948cc4e`: padre de la única integración futura autorizable, separado de `APPROVED_RECEIVER_RELEASE=e5ac06df...`.
- Identificador público nuevo propuesto: `DG-593-RECEPTOR-POST371-UNICO`. No es una credencial, no está añadido al entorno del workflow y no se solicita ningún secreto.
- El identificador anterior `DG-593-INSTALL-e5ac06df-ONCE` queda identificado como consumido y nunca satisface el nuevo control, incluso con habilitación simulada en pruebas.

Permanecen los requisitos de primer intento (`GITHUB_RUN_ATTEMPT=1`), evento push, workflow original, SHA de checkout/workflow idénticos, rama piloto original, padre exacto y revisión vigente inmediatamente antes de escribir. No se acepta reejecución ni avance posterior de la rama. Si cambia el padre, detenerse y obtener aprobación nueva; no actualizarlo automáticamente.

El workflow ejecutable sigue en `--plan-receiver`, sin identificador de instalación, y el reporte sigue con `if:false`. Ni fusionar el código inactivo ni proporcionar sólo el identificador permite escribir. `activar:false`, `datahub_scoped_content_enabled:false`, sincronización de token false y costo máximo cero son exigencias vigentes, no valores que este borrador promueva.

## Cambio exacto pendiente de aprobación

[ACTIVACION-PENDIENTE.patch](ACTIVACION-PENDIENTE.patch) es un artefacto de revisión, **NO aplicado**. Muestra los únicos cambios adicionales que necesitarían autorización:

1. Habilitar el permiso interno exclusivo del receptor, sin tocar las banderas comerciales.
2. Cambiar el paso del workflow original a `--install-receiver` e inyectar su nuevo identificador público sólo en ese paso, con el mismo entorno `conectatech-piloto-gratis`.
3. Disponer de cinco commits de historia para recuperar el paquete aprobado: integración futura, PR #371, PR #370, PR #369 y PR #368.

No se debe fusionar este borrador inactivo y después aplicar el parche a ciegas: el padre de la activación habría cambiado. La ruta propuesta es revisar ahora y, sólo tras autorización explícita de instalación, aplicar el parche en **este mismo PR**, verificar que el piloto siga exactamente en `2df80f8...` y realizar una única integración squash. Si el propietario decide otra secuencia, se revisará y aprobará el nuevo padre antes de cualquier activación. No se crea otro workflow, Worker ni infraestructura.

## Controles de operación y recuperación, conservados

El mecanismo sigue siendo `ScopedDeployer.install_receiver`/`commit` y el transporte original. El permiso inactivo no altera su alcance:

- Recuperar paquete aprobado, verificar sus huellas y renderizar el módulo seleccionado. Capturar bundle/settings/bindings/estado/Messenger/fuente en RAM. Exigir base conocida, ausencia de deriva, comparación exacta e inversa antes de escribir.
- Revalidar autorización, revisión y captura inmediatamente antes de **un único intento de PUT de instalación**. Reemplazar sólo `commercial-reception.mjs`; conservar entrypoint, nombres, MIME, cabeceras, todos los demás módulos y `central-data.mjs` completo. No cambiar rutas, permisos, settings ni servicios.
- Verificación posterior por la implementación original de `--check-ingest`, ambas marcas concordantes con el cuerpo y status, fuente anterior intacta y estado/Messenger conservados. Presupuesto compartido de 12 lecturas de propagación y diagnóstico diferenciado del fallo inicial/recuperación, sin datos privados.
- Ante fallo, no repetir la instalación. Recuperar exclusivamente el receptor sólo si bundle/settings actuales coinciden exactamente con el candidato y no existe deriva de fuente/estado ni permisos. **Máximo un intento de PUT de recuperación**, verificando la restitución íntegra; ante duda, detenerse. Sin rollback global, borrado de tablas o restauración de datos comerciales.
- La evolución de almacenamiento es sólo la aditiva contenida en el módulo ya aprobado. El instalador no procesa reportes, adquiere reservas ni solicita eliminación de Excel. Revertir código no elimina recibos ni deshace eventos ajenos.
- Mantener el costo cero confirmado por el entorno y presupuesto comprimido conservador de 2.990.000 bytes; no añadir bindings, recursos ni servicios de pago.

## Comprobaciones nuevas, sin repetir las anteriores

Se prepararon y ejecutaron **6 comprobaciones nuevas exclusivamente sintéticas**: permiso deshabilitado antes de acceso externo; separación padre/artefacto con habilitación sólo simulada; rechazo de identificador consumido/reintentos; rechazo de padre incorrecto/banderas abiertas/costo no cero; conciliación exacta de ambas identidades; workflow de lectura sin identificador y banderas cerradas. No se invocó el instalador ni ningún transporte real. La comprobación positiva del antiguo permiso se adapta al nuevo requisito de inactividad; no se repite esa suite ni las pruebas ya aceptadas.

## Autorización mínima que deberá aprobar el propietario

«Autorizo la activación revisada y una única instalación privada de `commercial-reception.mjs` con SHA-256 `699ac61bcf8311ac72bdf56c723e3c562882517909c443d9521d5b132624b869`, paquete/marcas `e5ac06df086130a6776205250dd4d96c65882797` / `6287802a95e7cb1ecc86316ff5f7de24f9c29dcf856388ecda4e0193d37e3e76`, desde base activa `c51cf151...`, mediante el permiso `DG-593-RECEPTOR-POST371-UNICO` y una integración cuyo padre sea exactamente `2df80f8db06b0eb1663342f4eda6f9b2f948cc4e`. Autoriza máximo un PUT de instalación y, sólo cuando sea demostrablemente segura, una reversión específica con máximo un PUT de recuperación. Mantener ambas banderas comerciales false y todos los pasos comerciales bloqueados. Detener ante cualquier discrepancia o deriva, sin reintentos. No autoriza ingestión, fuentes 593, checkout, fichas ni Merchant Center; costo adicional USD 0».

Esta autorización **no se ha concedido ni ejecutado en esta etapa**. Main, rama piloto publicada, Worker, fuentes, los 922 SKU conciliados, los 36 aislados, SIGNATURE y Sincronización multicanal 593 permanecen intactos por esta preparación. No se contacta ni modifica Sistema 593.
