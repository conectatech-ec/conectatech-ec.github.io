# CONECTATECH — referencias de productos accesibles para Codex

## Archivo de referencia
- Índice por SKU: `importacion/fuentes-drive-sku.json` (2.829 imágenes, 1.011 SKU, 2 nombres sin SKU inequívoco al corte del 11-10-2026).
- Carpeta: https://drive.google.com/drive/folders/1IUpFi6r9e_aURNWpJ7P23XowWphnpAoa
- Cada fotografía contiene ID, nombre, tamaño, última modificación y URL de consulta.
- En el momento de crear este índice, la carpeta **todavía no tenía permisos públicos confirmados**. Los enlaces no son un reemplazo de permisos. Probar la descarga mediante HTTPS desde Codex sin credenciales antes de intentar producir.
- Este índice es **una instantánea**, no sincronización automática. Las nuevas fotos añadidas a Drive requieren renovar el índice o construir después una exportación programada. No afirmar que la carpeta se sincroniza sola.

## Semántica obligatoria de las fotos
Las fotos propias de Drive son **material de consulta**, no portadas definitivas: pueden mostrar cara frontal y reverso de cajas, texto de especificaciones, códigos, o imágenes impresas en empaques. Identificar modelo exacto y variante, comparar con páginas oficiales o material que permita reutilización. Nunca presentar una ilustración extraída de la caja como fotografía auténtica del producto. No suponer que todos los accesorios de una misma familia tienen el mismo hardware. Verificar puertos, color, forma, dimensiones, nombres y especificaciones antes de producir.

## Resultado esperado
La imagen final de cada SKU deberá mostrar solo el producto **sin caja**, con un acabado fotográfico de estudio SUPER PRO: composición vendedora, buena iluminación, blanco/trasparente donde proceda, detalle nítido, producto grande y protagonista, sin etiquetas de precio ni adornos. Para generar imágenes hay que usar herramientas de edición/generación de imágenes disponibles, no inventar accesorios, conectores ni textos diminutos. Las versiones comerciales no deben sustituir la clasificación original/AAA ni inducir al comprador a pensar que un compatible es original.

## Flujo acotado
1. Leer `AGENTS.md`, `importacion/PRODUCCION-MAESTRA.md`, `importacion/reglas-sku.json` y `importacion/fuentes-drive-sku.json`.
2. Elegir SKU existentes en la web, priorizando los que tengan más evidencias fotográficas y trabajo visual pendiente; nunca crear un SKU inexistente solo por su nombre de foto.
3. Descargar solo las referencias del lote y verificar que los bytes sean una imagen real y no HTML, 403 o una página de inicio de sesión; si faltan fuentes, seguir con otros SKU.
4. Contrastar identidad y rasgos con el producto exacto en fuentes verificadas y derechos válidos; registrar observaciones. Para AAA o genéricos, mostrar fielmente el producto vendido, no una supuesta marca original.
5. Crear/revisar propuestas premium del producto sin caja con fuente, pruebas de calidad y sin perder originales; optimizar WebP para la web.
6. Modificar únicamente referencias visuales aprobadas y metadatos necesarios; **no tocar precios, PVP, stock, títulos comerciales, descripciones o URLs**.
7. Corregir todo pipeline que pueda reinsertar imágenes antiguas; ejecutar QA y comprobar GitHub Pages antes de declarar publicado.
8. Mantener productos con imágenes pendientes, sin crear publicaciones incorrectas.

No almacenar tokens de acceso, cookies o respuestas privadas de Drive en este repositorio público. No modificar la carpeta de Google Drive.
