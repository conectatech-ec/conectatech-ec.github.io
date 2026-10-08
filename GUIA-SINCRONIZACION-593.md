# ConectaTech — Actualización de catálogo desde Sistema 593

## Estado de la integración
- Sistema 593 es la fuente de existencias y precio general de productos.
- `datos-593/inventario-publico.csv` es una **copia pública depurada**, sin costos de compra ni datos privados.
- GitHub Actions comprueba automáticamente ese archivo cuando se modifica; la revisión **no publica cambios**.
- La publicación exige autorización explícita por `workflow_dispatch`: modo `APLICAR` y texto `APLICAR`.
- Tras aplicar, el workflow regenera la web, fichas SEO, sitemap y archivos multicanal; Meta consulta diariamente el feed piloto por URL.
- La exportación de 593 a este CSV **aún no es automática**. No se ha confirmado una API o programación de exportaciones de Sistema 593.

## Procedimiento seguro para una nueva toma
1. Descargar desde 593 el reporte completo de productos/inventario.
2. Preparar una copia **solo pública** en formato CSV UTF-8 y con estas columnas exactas:
   `sku,nombre,stock,precio_general,iva,tipo,categoria,clasificacion`.
   **Nunca subir al repositorio público el Excel completo, costos de compra, datos de clientes, RUC o credenciales.**
3. Sustituir `datos-593/inventario-publico.csv` con el archivo depurado. GitHub ejecutará automáticamente la validación de diferencias.
4. Revisar el artefacto `comparacion-inventario-593` de la acción **Sincronizar catalogo desde 593**.
5. Si las diferencias son correctas, ejecutar manualmente la acción con modo `APLICAR` y confirmación exacta `APLICAR`.
6. Verificar la web, las páginas SEO y el archivo `exportaciones/meta-catalogo-piloto.csv`. Meta leerá ese archivo según la programación definida en Commerce Manager.

## Reglas comerciales y técnicas
- SKU de 593 identifica los productos; evita duplicados.
- Solo nuevos registros `tipo=PRODUCTO`, stock positivo y precio general positivo entran al catálogo.
- Los existentes se conservan, incluso al quedar sin stock, preservando imágenes, descripciones y URLs SEO.
- Los servicios (por ejemplo ENVI001) no entran como nuevos productos.
- `promo` = redondeo comercial de `precio_general × 1,15`.
- `pvp` = redondeo comercial de `promo × 1,15`.
- Las fotos y SEO se conservan por SKU y están separadas de la fuente de 593.
- No hay publicación automática a Marketplace ni sincronización confirmada con el catálogo interno de WhatsApp Business.
- Para hacer **100 % automática** la fuente Sistema 593, se necesita comprobar si el proveedor ofrece API oficial de solo lectura o exportación programada autorizada. Nunca introducir claves privadas en archivos públicos.

## Archivo vigente
Exportación preparada el 08-10-2026. En caso de futuras ventas o ingresos, las existencias reales en 593 pueden haber cambiado; no considerar este CSV como datos en tiempo real.
