# Lote 042 — continuidad

Cuatro SKU: SOPO060 y SOPO023 (exclusión Yantech), ADAP004 y ADAP005 (portadas nuevas y editorial). Fuentes de Drive y clasificación AAA cotejadas. Doce originales preservados y verificados por SHA. Los dos adaptadores se retoman por la nueva autorización de retoque comercial con IA; no se declara recuperación óptica de detalles ni certificaciones.

La corrección SOPO023 parte de la fotografía pública anterior y su original de Drive. No reutiliza ni aprueba el maestro de revision/premium-001.

Política permanente en reglas-sku.json: todas las imágenes comerciales Yantech sin texto ni logotipo. Se conocen SOPO060, SOPO023 y TARJ004; TARJ004 sigue sin portada y requiere identificar el material de venta. Registrar cada nuevo SKU Yantech identificado con reglas_sku.py --marca Yantech. No borrar originales.

Reanudar según lote-activo. No regenerar los cuatro maestros: manifiesto-aprobados.json enlaza bytes, fuentes y revisión. Ejecutar contrato y QA; tras Pages, verificar-publicacion.py, registrar-actualizaciones.py y registrar-resultados-lote.py. Registrar fecha de publicación sólo mediante HTTP real. Conservar 3 columnas escritorio/2 móvil.

El CSV editorial contiene únicamente ADAP004/005; para reproducir, copiar temporalmente sus maestros del manifiesto a un directorio privado con nombres ADAP004.png y ADAP005.png. No importar imágenes de fuentes externas ni alterar finanzas.

## Cierre verificado

Los cuatro SKU están publicados y verificados por HTTP y Chromium sobre Pages. Evidencia: `reportes/lote-042-resultados.json`, `reportes/lote-042-http.json` y `reportes/lote-042/qa-publico/`. Las fechas efectivas se registraron tras HTTP en `actualizaciones-sku.json`. No repetir este lote ni dar por aprobados los maestros premium-001. Continuar desde la cola permanente; TARJ004 conserva la excepción Yantech y sus pendientes.
