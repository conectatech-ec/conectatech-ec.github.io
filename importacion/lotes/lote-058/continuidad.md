# Continuidad: 30 SKU nuevos

Lote 057: diez tarjetas. Lote 058: diecinueve memorias USB y una tarjeta. Fuentes propias de Drive por SKU, todas las vistas agrupadas usando el inventario válido. Descarga anónima verificada; caché privada conservada. Imágenes individuales asistidas por IA, inspeccionadas contra fuentes propias y WebP finales revisados. No son fotografías ópticas nuevas. Se conservan maestros y originales.

Procedimiento existente: fichas-verificadas.json y editorial.csv → importar-productos.py → procesar-imagenes.py → aplicar-datos-contrato.py → generar-seo.cjs → verificar-movil.cjs y verificar-catalogo.cjs → validar-contrato.py (prepublicacion) → CI de rama → main → Pages → verificar-publicacion.py → registrar-actualizaciones.py → validar-contrato.py (publicacion) → registrar-resultados-lote.py. No se desarrolla un servicio nuevo.

Reglas: datos comerciales y URLs invariantes; originalidad según Registro del propietario, nunca inferida por logotipo. AAA explícito en TARJ002, FLAS003, FLAS004 y FLAS016. FLAS035 representa dos colores disponibles; venta por unidad. Productos con imágenes siempre preceden a productos sin imagen en los seis modos; orden secundario conserva la elección del usuario. Modo predeterminado recientes y fechas reales verificadas sitúan nuevos productos primero.

Las excepciones se registran en reportes/lote-058/pendientes.json. La publicación sólo se considera terminada después de comparar HTTP público con HTML y tres WebP locales y confirmar Pages.
