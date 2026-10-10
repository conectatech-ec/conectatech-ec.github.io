# Producción por SKU — vigente desde 2026-10-10

La orden vigente sustituye las presentaciones históricas: **todos los productos SIN CAJA**. El historial de reglas y los originales se conservan. No rediseñar el sitio, generar banners ni modificar precios, costos, stock o URLs.

## Fuentes y estados

- Drive: carpeta `1IUpFi6r9e_aURNWpJ7P23XowWphnpAoa`.
- Registro: documento `1ojxVboQxWpmm8m4nyp7TDoWRSvhzymYjjTCUY_3iG4I`, pestaña `Registro`, A:F. Lectura, nunca escritura automática.
- 593: `datos-593/inventario-publico.csv`, corte 2026-10-08. No es inventario en tiempo real.
- Reglas: `reglas-sku.json`; presentación y autenticidad independientes. El propietario confirmó el 2026-10-10 que «Original» y «Caja original» en Tipo acreditan originalidad comercial. Guardar la fila y la confirmación como evidencia. AAA se clasifica como genérico/compatible; no sustituirlo por la foto de una marca original.
- `APROBADO`: identidad, variante, fotografía, ficha y derecho de uso documentados. `REVISAR`: falta validación. `BLOQUEADO`: discrepancia o fuente insuficiente. Nunca publicar automáticamente los dos últimos.

## Operación incremental

1. Consultar metadatos de Drive con el conector conectado, paginando completamente. Comparar ID, nombre, tamaño y modificación; descargar bytes únicamente para SKU nuevos/modificados. Leer Registro A:F una vez. Conservar los snapshots fuera del repositorio público.
2. Normalizar Drive a una lista `{id,nombre,url,bytes,modificado}` y Registro a filas incluyendo cabecera. No incluir tokens ni enlaces de descarga temporales.
3. Ejecutar:

```sh
python scripts/sincronizar-cola-drive.py --inventario /ruta/drive.json --registro /ruta/registro.json --limite 30
```

La cola permanente `importacion/cola-drive.json` registra huellas por SKU. Los SKU no investigados permanecen en cola aunque el snapshot no cambie. El cierre del lote guarda la huella revisada; solo nueva evidencia vuelve a encolar un SKU cerrado. Un archivo ausente no borra originales. Los nombres `SKU.jpg`, `SKU_YYYYMMDD_HHMMSS.jpg` y `SKU-01.jpg` se vinculan solo al SKU exacto o alias explícito. No rellenar ceros ni crear productos por aproximación. Las vistas de anverso/reverso requieren inspección, no se deducen de una marca de tiempo.

4. Consultar todas las fotos del SKU cambiado, contrastar 593 y registrar modelo/variante, fuente y discrepancias. Guardar OCR o lecturas verificadas por SKU para reutilizarlas. La investigación y revisión visual todavía requieren al operador; la cola no inventa esas validaciones.
5. Recuperar el material autorizado del modelo exacto. Mantener fotos de identificación privadas en Drive, especialmente si contienen números de serie. Conservar fuente, hash y originales del material comercial. Los archivos de revisión local están en `.produccion-privada/` y se excluyen de Git.
6. Usar manifiesto versión 3 y contrato persistente por SKU (`CONTRATO-DATOS.md`) con `aprobaciones[SKU]`: `estado`, `identidad_verificada`, `ficha_verificada`, `uso_comercial_permitido`. No cambiar estos valores solo para desbloquear una publicación. La evidencia comercial de autenticidad se registra mediante `scripts/reglas_sku.py`; el logotipo no es evidencia. La cola aplica automáticamente la clasificación del Registro a los SKU nuevos/modificados seleccionados para el lote. Para un lote ya preparado: `python scripts/reglas_sku.py --registro /ruta/registro.json --sku SKU1 SKU2 --aplicar`. La columna Tipo es la autoridad comercial confirmada por el propietario; valores ausentes o contradictorios quedan para revisión. La autenticidad no aprueba por sí sola la variante ni los derechos de una fotografía externa.
7. Procesar:

```sh
python scripts/procesar-imagenes.py --manifiesto importacion/lotes/LOTE/manifiesto.json --reporte reportes/LOTE.json
# Solo cuando las comprobaciones estén completas:
python scripts/procesar-imagenes.py --manifiesto importacion/lotes/LOTE/manifiesto.json --reporte reportes/LOTE.json --aplicar
```

El procesador conserva los originales, no amplía el producto, centra sobre blanco y produce WebP 1200/600/300. Rechaza resolución útil insuficiente. La huella incluye fuente, revisión y ajustes: reutiliza versiones intactas. Una actualización fallida no elimina una portada vigente compatible. Detecta hashes cruzados y avisa sobre similitud perceptual sin decidir identidad automáticamente.

Los borradores bloqueados pueden prepararse con `--borradores .produccion-privada/borradores`; ese modo no los convierte en publicables. No subir ese directorio a Pages.

8. Importar únicamente el CSV editorial aprobado con `scripts/importar-productos.py`; no se admiten columnas financieras. Conservar categoría original y URL; asignar familia mediante `categorias-comerciales.json`. `--por-sku` permite continuar filas válidas y aísla duplicados o errores.
9. Ejecutar pruebas de protección (`python scripts/test-incremental.py`), generar SEO y exportaciones existentes. Comparar precios/stock y hash de 593 con la base previa. Preparar cambios en una rama `catalogo/**`: `validar-lote.yml` ejecuta Chromium móvil y el gate de prepublicación. Incorporar capturas y contratos verificados antes de publicar en `main`, sin sobrescribir cambios concurrentes.
10. Esperar el despliegue de Pages y ejecutar `scripts/verificar-publicacion.py --sku ...`. Solo las fichas con imagen servida y hashes coincidentes cuentan como publicadas; HTTP 200 sin imagen sigue pendiente.

## Escalado y límites actuales

El piloto de 10 se retoma sin regenerarlo. Lote nuevo de 30; seguir con 50 y 100 según cobertura y calidad. No avanzar por cantidad si no hay suficientes fuentes aprobadas. La detección incremental funciona con snapshots reales. El estado de operación continua se registra en `operacion-continua.json` solamente después de confirmar su programación. GitHub no guarda credenciales de Google: la consulta conectada genera el próximo snapshot sin descargar otra vez todas las fotografías.

Para teléfonos separar RAM física/virtual y confirmar variante. Para AAA no inferir autonomía/ANC/IP. Para PILA013 confirmar venta por unidad; un blíster no prueba cantidad vendida. Para juguetes no inventar modelo ni licencia.

## Piloto actual

`lotes/piloto-drive-010/` contiene la trazabilidad y propuestas editoriales. `reportes/piloto-drive-010.json` distingue portadas preparadas, pendientes y publicación real. La autenticidad comercial de los diez SKU quedó confirmada mediante Registro y la instrucción del propietario. Los derechos de las imágenes externas no se deducen de su disponibilidad pública. Las fichas no aprobadas permanecen como propuestas; no se han aplicado al catálogo.

## Cierre verificable y reanudación

Tras verificar la publicación, guardar el reporte por SKU y ejecutar `python scripts/registrar-resultados-lote.py --reporte reportes/LOTE-resultados.json`. Los pendientes conservan motivo y huella de sus fuentes: no se repite la investigación hasta nueva evidencia. Las capturas móviles y el reporte HTTP deben coincidir con los bytes de la ficha y las tres imágenes, según el contrato v3. Los originales de identificación con datos privados permanecen en Drive; solo maestros propios depurados y autorizados se incorporan a Git.

## Presentación compacta y fecha efectiva

Mantener las tarjetas actuales: cinco columnas en escritorio de 1280 px y dos en móvil de 390 px. No introducir especificaciones ni descripciones antes del clic. Foto, nombre y acceso de detalles abren la ficha completa existente. Los nuevos medios se reutilizan mediante el registro publicado y sus tres tamaños; nunca se regeneran sólo para cambiar la tarjeta.

El selector «Actualizados recientemente» es el orden temporal por defecto; los empates y SKU sin fecha conservan el orden base. También se conservan el orden original, nombre y precios ascendente/descendente. Búsqueda, filtros y paginación operan sobre el mismo conjunto, sin duplicados.

Después de la comprobación HTTP, ejecutar `scripts/registrar-actualizaciones.py` con el reporte real. El registro persistente y `assets/catalogo-publicado.js` sólo renuevan la fecha cuando cambia la huella de contenido publicado. Precios, stock, fuentes, fechas de QA y verificaciones repetidas no generan novedades. Publicar el registro actualizado y comprobar su presencia en Pages; no declarar terminado el orden por fecha antes de ello.

El workflow `validar-lote.yml` añade el navegador real de catálogo mediante `scripts/verificar-catalogo.cjs`, incluyendo escritorio/móvil, acceso a fichas, imágenes, orden, búsqueda, filtros y paginación. Conservar capturas y ejecutar la comprobación del catálogo público al terminar el despliegue.
