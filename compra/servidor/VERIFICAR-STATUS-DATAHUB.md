# Consulta privada de status — 8 de noviembre de 2026

**Resultado: verificación autenticada todavía no realizada. Mecanismo mínimo preparado para aprobación. Costo adicional $0.** No se ejecutó ningún workflow, no se llamó al Worker ni se modificaron main, Data Hub, inventario, políticas, precios, despliegue o secretos.

## Comprobación concreta de acceso

Se consultaron únicamente metadatos de GitHub Actions:

- Existe `conectatech-piloto-gratis`. Su política permite exclusivamente la rama `automatizacion/piloto-cloud-3sku-20261015`.
- La API de listado de nombres de secretos devuelve HTTP403 `Resource not accessible by integration`. No se obtuvo ningún valor. Este error no demuestra que el secreto falte: el workflow original referencia `secrets.PILOT_TOKEN` del entorno.
- La sesión cloud no tiene secretos ni identidad saliente configurados para el Worker. No se busca el token en logs, artefactos o archivos, ni se solicita/copiará desde otro entorno.
- El transporte original en `c92ed56ca378e950babbb38d078d29f442ff78c9:automatizacion/central-http.mjs` admite `/commercial/catalog/status`, rechaza cuerpo en rutas de lectura, usa GET, autenticación en cabecera y `redirect:error`. Su SHA256 es `eeaa847164b5e1e40a177cadadda30fb542b1f8e3cb482b6dd47003641462b8a`.
- Ningún workflow encontrado llama exclusivamente ese endpoint. `comercial-cloud.yml` contiene preparación adicional, sincronización, despliegue y activaciones: **no se ejecuta ni reejecuta**, aunque una configuración diga `activar:false`. Tampoco se reejecutan jobs ajenos como atajo para obtener el secreto.

Por tanto, fecha, versión, vigencia y SHA **actuales de la fuente privada siguen sin acreditar**. No se reutiliza el snapshot estático de octubre como resultado autenticado actual. Los 999 preparados y 922 conciliados para checkout no resuelven este acceso.

## Adaptación mínima dentro de PR #313

`verificar-status-datahub.mjs` importa el transporte original después de verificar su hash y realiza una sola llamada con ruta constante e input vacío. No contiene operaciones de despliegue, sincronización, subida, confirmación, escritura al Worker ni lecturas alternativas. El token sigue inyectado exclusivamente por Actions como variable de entorno del paso; nunca se pasa por argumentos ni se imprime.

El sobre base64 se procesa solo en memoria. La salida permite únicamente fechas, SHA, versión derivada conforme al contrato `593-v1-<SHA>`, vigencia declarada y vigencia a la hora de consulta, y revisión del procesador si el endpoint la devuelve. No imprime catálogo, cantidades, precios, cabeceras, errores privados ni la respuesta completa. Los fallos se convierten en un código fijo. No hay reintentos ni fallback a otro endpoint.

**La revisión del procesador no es la del Worker.** El status conocido no devuelve `release` del Worker. Se informa `worker_release:null`; no se llama a `/health` porque esta instrucción autoriza exclusivamente el GET de status. Si la versión de fuente se deriva del SHA, se identifica expresamente como derivada y no como un campo recibido.

`datahub-status.yml.propuesta` es texto inerte fuera de `.github/workflows`. Tiene solo `workflow_dispatch`, un job limitado a la rama admitida, permisos `contents:read` y el entorno existente. No instala servicios ni solicita tokens de Cloudflare. No usa `comercial-cloud.yml`, artefactos ni permisos de escritura.

## Ruta exacta para la ejecución posterior

1. Revisar y aprobar el comando y la propuesta en este PR. El código del verificador está fijado a `26d699298a2a9c470b64811c3a0684da1e8c2932`, y el transporte a `c92ed56ca378e950babbb38d078d29f442ff78c9`. No sustituir estos SHA por ramas móviles. La propuesta ya identifica el código exacto para su revisión; sigue inerte y no autoriza ejecutarlo.
2. GitHub exige que un workflow `workflow_dispatch` exista en la rama predeterminada para admitir despacho manual. **Hoy ese archivo no existe en main**. La instalación requiere una autorización futura específica de registro en main y de instalación del mismo archivo como `.github/workflows/datahub-status.yml` en la rama piloto permitida. No se ha hecho: la prohibición de modificar main de esta entrega se respeta. No cambiar las políticas del entorno, copiar secretos, abrir acceso a la rama del PR ni añadir triggers automáticos para eludirlo.
3. Tras esa aprobación e instalación, desde Actions seleccionar `Verificar únicamente status privado Data Hub` → `Run workflow` → rama `automatizacion/piloto-cloud-3sku-20261015`. Equivalente: `gh workflow run datahub-status.yml --ref automatizacion/piloto-cloud-3sku-20261015`. **Este comando es documentación, no se ejecutó.** Nunca despachar `comercial-cloud.yml`.
4. El paso de lectura recibe el `PILOT_TOKEN` ya configurado mediante `secrets.PILOT_TOKEN`, y ejecuta únicamente `node verifier/compra/servidor/verificar-status-datahub.mjs transport/automatizacion/central-http.mjs`. No introducir valores de credenciales en chat, comandos, inputs o archivos.
5. Conservar URL/run ID, commit revisado y el JSON filtrado de metadatos. Una respuesta autenticada puede acreditar una fuente caducada: no actualizarla ni rejuvenecer fechas dentro de este mecanismo. SHA de fuente, versión de normalización y revisión del procesador deben distinguirse. Este GET tampoco acredita por sí solo compatibilidad de identidad, precios o compra.

Si se mantiene la prohibición de registrar el workflow en main, el despacho manual desde Actions queda sin habilitar. Esta entrega conserva el mecanismo preparado y no lo sustituye por una ejecución automática ni por un flujo con despliegue.

Validación local: cinco pruebas del verificador (ruta única, filtrado, fallos, metadatos y transporte no revisado), sintaxis Node y una prueba sintética con el transporte original y fetch simulado que comprueba un único GET sin cuerpo ni redirecciones. Ninguna prueba emplea credenciales reales ni acceso al Worker.
