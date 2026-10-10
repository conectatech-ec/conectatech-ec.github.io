# Producción por SKU — vigente desde 2026-10-10

La orden vigente sustituye las presentaciones históricas: **todos los productos SIN CAJA**. El historial de reglas y los originales se conservan. No rediseñar el sitio, generar banners ni modificar precios, costos, stock o URLs.

## Fuentes y estados

- Drive: carpeta `1IUpFi6r9e_aURNWpJ7P23XowWphnpAoa`.
- Registro: documento `1ojxVboQxWpmm8m4nyp7TDoWRSvhzymYjjTCUY_3iG4I`, pestaña `Registro`, A:F. Lectura, nunca escritura automática.
- 593: `datos-593/inventario-publico.csv`, corte 2026-10-08. No es inventario en tiempo real.
- Reglas: `reglas-sku.json`; presentación y autenticidad independientes. "Caja original" no acredita originalidad. AAA se clasifica como genérico/compatible; no sustituirlo por la foto de una marca original.
- `APROBADO`: identidad, variante, fotografía, ficha y derecho de uso documentados. `REVISAR`: falta validación. `BLOQUEADO`: discrepancia o fuente insuficiente. Nunca publicar automáticamente los dos últimos.

## Operación incremental

1. Consultar metadatos de Drive con el conector conectado, paginando completamente. Comparar ID, nombre, tamaño y modificación; descargar bytes únicamente para SKU nuevos/modificados. Leer Registro A:F una vez. Conservar los snapshots fuera del repositorio público.
2. Normalizar Drive a una lista `{id,nombre,url,bytes,modificado}` y Registro a filas incluyendo cabecera. No incluir tokens ni enlaces de descarga temporales.
3. Ejecutar:

```sh
python scripts/sincronizar-cola-drive.py --inventario /ruta/drive.json --registro /ruta/registro.json --limite 10
```

La cola permanente `importacion/cola-drive.json` registra huellas por SKU. Una segunda entrada idéntica genera cero candidatos; un archivo ausente no borra originales. Los nombres `SKU.jpg`, `SKU_YYYYMMDD_HHMMSS.jpg` y `SKU-01.jpg` se vinculan solo al SKU exacto o alias explícito. No rellenar ceros ni crear productos por aproximación. Las vistas de anverso/reverso requieren inspección, no se deducen de una marca de tiempo.

4. Consultar todas las fotos del SKU cambiado, contrastar 593 y registrar modelo/variante, fuente y discrepancias. Guardar OCR o lecturas verificadas por SKU para reutilizarlas. La investigación y revisión visual todavía requieren al operador; la cola no inventa esas validaciones.
5. Recuperar el material autorizado del modelo exacto. Mantener fotos de identificación privadas en Drive, especialmente si contienen números de serie. Conservar fuente, hash y originales del material comercial. Los archivos de revisión local están en `.produccion-privada/` y se excluyen de Git.
6. Usar manifiesto versión 2 con `aprobaciones[SKU]`: `estado`, `identidad_verificada`, `ficha_verificada`, `uso_comercial_permitido`. No cambiar estos valores solo para desbloquear una publicación. La evidencia comercial de autenticidad se registra mediante `scripts/reglas_sku.py`; el logotipo no es evidencia.
7. Procesar:

```sh
python scripts/procesar-imagenes.py --manifiesto importacion/lotes/LOTE/manifiesto.json --reporte reportes/LOTE.json
# Solo cuando las comprobaciones estén completas:
python scripts/procesar-imagenes.py --manifiesto importacion/lotes/LOTE/manifiesto.json --reporte reportes/LOTE.json --aplicar
```

El procesador conserva los originales, no amplía el producto, centra sobre blanco y produce WebP 1200/600/300. Rechaza resolución útil insuficiente. La huella incluye fuente, revisión y ajustes: reutiliza versiones intactas. Una actualización fallida no elimina una portada vigente compatible. Detecta hashes cruzados y avisa sobre similitud perceptual sin decidir identidad automáticamente.

Los borradores bloqueados pueden prepararse con `--borradores .produccion-privada/borradores`; ese modo no los convierte en publicables. No subir ese directorio a Pages.

8. Importar únicamente el CSV editorial aprobado con `scripts/importar-productos.py`; no se admiten columnas financieras. Mantener categorías y URLs existentes; guardar categoría comercial propuesta como dato editorial antes de una migración de filtros.
9. Ejecutar pruebas de protección (`python scripts/test-incremental.py`), generar SEO y exportaciones existentes. Comparar precios/stock y hash de 593 con la base previa. Publicar cambios en `main` sin sobrescribir modificaciones concurrentes.
10. Esperar el despliegue de Pages y ejecutar `scripts/verificar-publicacion.py --sku ...`. Solo las fichas con imagen servida y hashes coincidentes cuentan como publicadas; HTTP 200 sin imagen sigue pendiente.

## Escalado y límites actuales

Piloto de 10, luego 50 y 100 cuando el piloto supere calidad y discrepancias comerciales. No avanzar por cantidad si no hay suficientes fuentes aprobadas. La detección incremental funciona con snapshots reales y está probada. No hay un sondeo desatendido de Drive configurado ni credenciales de Google en GitHub; no afirmar operación continua activa. La consulta conectada genera el próximo snapshot sin descargar otra vez el inventario completo.

Para teléfonos separar RAM física/virtual y confirmar variante. Para AAA no inferir autonomía/ANC/IP. Para PILA013 confirmar venta por unidad; un blíster no prueba cantidad vendida. Para juguetes no inventar modelo ni licencia.

## Piloto actual

`lotes/piloto-drive-010/` contiene la trazabilidad y propuestas editoriales. `reportes/piloto-drive-010.json` distingue portadas preparadas, pendientes y publicación real. Los derechos de las imágenes externas y la autenticidad comercial no se deducen de la disponibilidad pública. Las fichas no aprobadas permanecen como propuestas; no se han aplicado al catálogo.
