# Lectura remota corregida y comprobada

La ejecución [44154502551](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/44154502551)
validó dos veces el SHA **realmente obtenido de GitHub** con autenticación oficial
`GITHUB_TOKEN` y permisos `contents:read`:

`e53cb57b40e4e8bc2aad952e20780d2ca2ad0aa7`.

Ambas respuestas fueron HTTP 200 y coincidieron con el commit de ejecución. No se
tomó el SHA local como sustituto de la respuesta remota. Se conservaron comprobación
de tipo `commit`, formato SHA, tamaño, JSON estricto, ausencia de caché y rechazo
de cualquier cambio concurrente. El recibo íntegro está en
`resultado-44154502551.json`.

## Diagnóstico respaldado por evidencia

La función original `read_latest_revision()` consultaba una URL correcta y fija,
sin token GitHub. Su manejo de excepciones descartaba status/cabeceras HTTP y
errores de conexión, devolviendo `LATEST_PUBLIC_REVISION_READ_FAILED` para todos.
Por eso la ejecución 44146619274 no conservó el motivo HTTP o de conectividad
subyacente y no permite recuperarlo retrospectivamente.

La comparación en el nuevo runner dio:

| Lectura | HTTP | Límite comunicado | Restante |
| --- | --- | --- | --- |
| Anónima, reproducción acotada | 200 | 60 | 59 |
| Token oficial, primera validación | 200 | 5.000 | 4.995 |
| Token oficial, segunda validación | 200 | 5.000 | 4.994 |

No se reprodujo el error original. No hay evidencia para atribuir aquel fallo a
un 403, cuota agotada, URL incorrecta o falta de permisos. El defecto comprobado
era el transporte anónimo y la pérdida de diagnóstico; ambos quedaron corregidos.

## Cambio mínimo aplicado

PR #394 quedó integrado sólo en la rama piloto. `github_revision_read.py` aporta
un `opener` a la función original y añade exclusivamente el token oficial a un
GET de la misma URL. `scoped_content.py` sigue idéntico: no cambia el validador
protegido, sus restricciones ni los hashes del manifiesto aprobado.

El adaptador impide otros destinos, métodos o cuerpos, credenciales mezcladas,
redirecciones y token ausente. No tiene fallback anónimo ni reintentos. Los futuros
fallos conservarán códigos públicos diferenciados para autenticación, permisos,
cuota, HTTP, DNS, TLS o timeout; nunca mensajes, cuerpos o credenciales privados.

Los pasos existentes de preparación e instalación reciben el mismo token con
`contents:read`. La validación real usó el workflow original, el entorno
`conectatech-piloto-gratis` y un job que no recibe credenciales del Worker.
Ingestión, instalación y lectura de la base del Worker fueron omitidas.
Resultado: **cero solicitudes al Worker y cero PUT**.

Diez pruebas específicas del transporte aprobadas. Se reutilizan las 71 originales
y las 18 comprobaciones de PR #393, sin repetir sus baterías. Los ocho artefactos,
el delta `30230fcaacec6af22f2f642bf6175f03f7c316488bc57af6b4c363475d028d35`,
el receptor, Data Hub y demás servicios permanecen intactos.

## Única autorización de instalación pendiente

Sólo después de la validación real se preparó el permiso nuevo
`DG-CHECKOUT-GHREV-44154502551-ONCE`. Está **deshabilitado** y sin padre de
activación. Su propuesta conserva íntegro el permiso cerrado de la ejecución
44146619274 en `previous_permission`, con todo el historial anterior.

El control nuevo fija la ejecución de lectura satisfactoria y el SHA-256 del
adaptador autenticado probado:
`a58b1131759f079633c653341603f493bce0ef2b73f9fa8ea346b6196455da95`.

La autorización mínima comprende integrar esta propuesta sólo en la rama piloto
y habilitar ese permiso para **un máximo de un PUT** del mismo delta inactivo de
PR #393. Antes se fijaría el padre aprobado y se releerían revisión remota,
bundle, configuración y SHA activos; se conservaría el respaldo cifrado. Después
se comprobarían los ocho módulos, los demás servicios y el cierre del checkout.
Se mantiene únicamente la recuperación específica condicionada ya documentada.

No se autoriza ni ejecuta otro PUT en esta preparación. No se habilitan
`CHECKOUT_CONFIG.enabled`, entregas, `activar` o `datahub_scoped_content_enabled`.
Sin ingestión, main, nuevos servicios, fichas públicas, pagos o anuncios.
Costo adicional: **$0**.
