# Importación de fichas e imágenes por SKU

La plantilla contiene los **1.165 SKU actuales**. El importador enriquece fichas existentes; no crea SKU ni modifica precios, PVP o existencias. La sincronización de valores sigue separada en `scripts/sincronizar-593.cjs`, usando únicamente una exportación validada del Sistema 593.

## Preparar un lote

1. Copiar `plantilla-1165-productos.csv` o generar una plantilla actual con `python scripts/importar-productos.py --plantilla importacion/plantilla.csv`.
2. Guardar fotos originales en una carpeta. Nombres automáticos: `CARG050.png`, `CARG016.jpeg`, `MICR27.jpeg`. Se acepta `MICR027` exclusivamente por el alias explícito. Los demás SKU no se aproximan ni se rellenan con ceros.
3. Completar nombre comercial, descripción, características como objeto JSON, fuente y términos de búsqueda. En `imagen_principal` puede ponerse un nombre de archivo exacto para desambiguar varias fotos. Si está vacío, debe existir una sola foto con el SKU como nombre.
4. Marcar `verificado=SI` solo después de comprobar que modelo, variante, datos e imagen coinciden. Los `NO` quedan pendientes. La revisión visual de identidad y de números de serie/IMEI es humana: el importador verifica archivo y resolución, no reconoce productos.

No subir exportaciones privadas de 593, costos, clientes, IMEI o números de serie. La plantilla solo admite ocho columnas editoriales y rechaza columnas adicionales de precios, stock u otros datos.

## Ejecutar

Requisitos: Python 3.12+, Node 22 y `python -m pip install -r importacion/requirements.txt`.

```bash
python scripts/importar-productos.py --csv importacion/lote.csv --imagenes importacion/imagenes
python scripts/importar-productos.py --csv importacion/lote.csv --imagenes importacion/imagenes --aplicar
node scripts/generar-seo.cjs
node scripts/exportar-canales.cjs
```

El primer comando simula. Si existe cualquier error, incluso al final del lote, no se aplica ningún producto. El reporte `reportes/importacion-productos.json` separa preparados, aplicados localmente, sin cambios, pendientes y errores. **Aplicado no significa publicado:** hay que subir el commit y comprobar GitHub Pages.

Las fotos se copian byte por byte, con nombre basado en SHA-256 para evitar caché antigua. JPEG/PNG/WebP estáticos, máximo 20 MB, lado menor de al menos 500 px y lado mayor de al menos 800 px. No se amplían miniaturas, no se regeneran imágenes y no se adivinan características. Estos límites detectan imágenes pequeñas, no garantizan que una foto esté enfocada. Las URLs existentes y el SKU de 593 se conservan.

En GitHub: **Actions → Importar fichas e imágenes por SKU → Run workflow**. Indicar rutas del CSV y carpeta ya cargados al repositorio. La opción `aplicar=false` simula y entrega un reporte descargable; `true` genera y publica el lote válido. Un push concurrente detiene la publicación en vez de sobrescribirlo; volver a ejecutar contra la nueva versión. No hay horario recurrente ni conexión en tiempo real al Sistema 593.

Para comprobar una publicación:

```bash
python scripts/verificar-publicacion.py --sku CARG050 MICR027 CARG016
```

Verifica respuesta HTTP, SKU, nombre, precios, disponibilidad, canonical y bytes de la imagen publicada. La primera publicación puede tardar en reflejarse en Pages; repetir la comprobación cuando finalice su despliegue.

## Lote inicial y siguientes lotes

`lote-001.csv` documenta los tres productos. Sus originales publicados están en `imagenes/<sku>/original-<hash>.*`; el CSV inicial conserva los nombres de los archivos recibidos como referencia. Para repetirlo desde GitHub, usar `lote-001-repetible.csv` y carpeta `imagenes`.

Para el resto, usar lotes de 50–100 fotos identificadas por SKU. El script procesa también la plantilla completa. No marca como terminadas las 1.162 fichas restantes: conservan lo existente hasta incorporar imágenes y contenido revisados. Las seis imágenes externas que ya existían requieren su propia revisión de calidad y variante.

## Producción profesional vigente

Desde el piloto profesional, el importador editorial ya no publica directamente la foto cruda. Conserva el original y selecciona únicamente medios compatibles con las reglas permanentes. Para tratamiento, excepciones, miniaturas, lotes y banners seguir **[SISTEMA-PROFESIONAL.md](SISTEMA-PROFESIONAL.md)**. Este flujo sustituye la recomendación anterior de copiar fotos sin tratamiento.
