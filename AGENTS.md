# CONECTATECH — mantenimiento del catálogo

- Leer `importacion/SISTEMA-PROFESIONAL.md` antes de importar fotos o modificar publicaciones.
- Las excepciones expresadas por el propietario se registran permanentemente en `importacion/reglas-sku.json`. No dejarlas solo en el chat, un prompt o un banner. Usar `scripts/reglas_sku.py`; conservar historial y revisiones.
- Autenticidad y presentación son atributos independientes. Nunca deducir originalidad de logotipos o cajas. Si no hay evidencia, mantener `por verificar`.
- Aplicar las reglas vigentes a portadas, vistas, catálogo, exportaciones y banners. SIN CAJA excluye empaques; nunca extraer la ilustración de una caja y presentarla como foto real del producto.
- Los originales son inmutables. No regenerar detalles, texto, conectores, accesorios o proporciones. Conservar el logotipo original. Si la fuente es insuficiente, buscar una referencia auténtica del modelo/variante exactos o dejar el SKU pendiente.
- MICR027 es alias de MICR27. No crear otro SKU ni otra variante por aproximación.
- CARG050: foto blanca aportada del cargador y su caja. CARG016: sin caja. MICR27: selección automática. Consultar siempre el registro por posibles actualizaciones posteriores.
- No cambiar precios, PVP, stock ni información de 593 mediante importaciones editoriales o visuales. Un cambio comercial requiere validación explícita. PROMO CONTADO por encima de PVP, sin tachar PVP y sin precios en la foto principal.
- Mantener las URLs estables. Publicado significa comprobar HTTP, datos y archivos servidos; generar archivos o hacer commit no basta.
- No marcar lotes pendientes como terminados. El lote de 20 dejó 18 pendientes; continuar desde el reporte y no repetir trabajo ya validado.
- Banners solo para SKU priorizados. Las nuevas instrucciones invalidan medios con revisión antigua, incluidos banners.
- Ejecutar controles pertinentes al cambio y actualizar el reporte. No pedir autorización para ajustes técnicos reversibles ya comprendidos en la tarea; consultar si hay ambigüedad comercial o riesgo de identificar mal el producto.
