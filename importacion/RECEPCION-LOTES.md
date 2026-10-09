# Recepción y producción del catálogo por SKU

Prioridad vigente: fotografías y fichas; sin cambios de diseño ni banners. Se reutiliza el sistema documentado en `SISTEMA-PROFESIONAL.md`.

## Primer lote

Lote `catalogo-005-001`, objetivo **5 SKU distintos**, inicialmente vacío. Manifiesto: `importacion/lotes/catalogo-005-001/manifiesto.json`. No ejecutar producción ni el piloto histórico mientras no existan fotografías vinculadas y revisadas. Los ejemplos del chat no son una orden de reprocesar esos productos.

El propietario puede adjuntar las cinco fotografías juntas o un ZIP y una relación inequívoca archivo → SKU. Si hay varias vistas del mismo producto, mantener el mismo SKU. El operador guarda las fotos en `importacion/lotes/catalogo-005-001/entrada/` únicamente después de revisar que no expongan datos privados. Si contienen datos privados, conservar el original en almacenamiento privado, fuera del repositorio público.

Información suficiente por producto:

- SKU exacto del Sistema 593, obligatorio.
- Foto frontal de caja con modelo/variante legibles; vista del producto si está disponible.
- Presentación o excepción: CON CAJA / SIN CAJA / AUTO, si corresponde.
- Confirmación comercial de ORIGINAL o GENÉRICO/COMPATIBLE, cuando se disponga de ella. Si falta, conservar la autenticidad vigente; no certificar por el logotipo.

No exigir precios ni stock al propietario: recuperar los existentes. No volver a solicitar autorización para productos que cumplen las reglas.

## Recepción, identificación y aprobación

1. Consultar solo las filas de los SKU recibidos en catálogo, exportaciones 593 disponibles, `seo-contenido.json`, `seo-pages.json`, `importacion/reglas-sku.json` y `importacion/medios.json`. Resolver únicamente alias registrados. No crear productos.
2. Conservar nombres originales en la procedencia y bytes originales sin cambios. Nombrar las copias de trabajo por SKU y posición. Registrar SHA-256, dimensiones y procedencia con `scripts/registrar-fotos.py`; este registro no constituye aprobación visual.
3. Antes de preparar candidatos para procesamiento, comparar contra medios aprobados: original, revisión de reglas, posición y tratamiento. Si todo sigue vigente, reutilizar las versiones existentes; excluir esas fotos de la regeneración y registrarlas como reutilizadas. Preservar vistas aprobadas al incorporar nuevas vistas: el procesador existente reemplaza la galería del SKU con las candidatas del manifiesto, por lo que no aplicar una galería parcial inadvertidamente.
4. Cotejar caja y base: marca, modelo exacto, variante, color y capacidad. Registrar discrepancias en el reporte con valor de la base, evidencia de la foto y decisión pendiente, antes de cambiar datos. Una foto de caja identifica el modelo; su ilustración no es una fotografía real del producto.
5. Guardar instrucciones y excepciones mediante `scripts/reglas_sku.py` en `importacion/reglas-sku.json`, conservando revisión e historial. Para SKU sin excepción previa: originales comercialmente confirmados, preferir producto y caja; genéricos, preferir producto real. Una presentación SIN CAJA excluye empaques. No fabricar una vista sin caja a partir de su ilustración.
6. Si falta material suficiente, buscar una imagen auténtica del mismo modelo/variante y registrar URL de procedencia. Si no existe fuente adecuada, dejar pendiente sin sustituir el modelo ni destruir una portada aprobada vigente. La autenticidad comercial pendiente no autoriza afirmar que el producto es original.
7. Separar SKU aprobados de pendientes antes de aplicar: el procesador puede retirar medios cuando recibe candidatos inválidos. No aplicar manifiestos de recepción sin revisión. Cada candidato debe acreditar identidad, calidad, fondo, privacidad, fuente y revisión de regla vigente.

## Producción con la infraestructura existente

- `scripts/registrar-fotos.py`: recepción por nombres SKU, resolución y duplicados.
- `scripts/reglas_sku.py`: excepciones persistentes e historial.
- `scripts/procesar-imagenes.py`: simulación, originales inmutables y WebP 1200/600/300; aplicar solo candidatos aprobados. Usar `--reporte reportes/catalogo-005-001-procesamiento.json` para preservar el historial.
- `scripts/importar-productos.py`: enriquecer únicamente los SKU recibidos con nombre, descripción y características verificadas; conservar URL, categoría y valores comerciales. Registrar fuentes.
- `scripts/generar-seo.cjs` y `scripts/exportar-canales.cjs`: regeneración técnica existente, sin nueva investigación de los demás productos. No ejecutar generación de banners ni sincronización financiera.
- GitHub Actions **Producir catálogo profesional por SKU**: indicar explícitamente el manifiesto revisado de este lote; no usar el piloto predeterminado. Conservar el reporte por ejecución y el historial.
- `scripts/verificar-publicacion.py --sku <SKU del lote>`: comprobar HTTP, imagen y datos financieros después de desplegar en Pages. Publicar sin sobrescribir cambios concurrentes.

Portada: fondo blanco/gris claro, encuadre centrado, escala uniforme, sin precios, promociones, marcas de agua añadidas ni detalles reconstruidos. Una imagen de 1200 px puede tener margen; no ampliar el producto para simular nitidez. Conservar las salidas aprobadas vigentes y comprobar precios, stock, categoría, SKU y URL antes/después del lote.

## Reporte y avance

Reporte de recepción: `reportes/catalogo-005-001.json`. Las filas se añaden solo al recibir SKU reales. Columnas: SKU, nombre comercial, fotografía recibida, portada profesional, presentación con/sin caja, contado, PVP, URL, estado y observaciones. Añadir procedencia, reutilización y discrepancias cuando correspondan.

Estados finales por SKU: **publicado**, **pendiente**, **requiere revisión**. Preparado o aplicado localmente no significa publicado. Distinguir autenticidad declarada de presentación visual y registrar cuando falta confirmación comercial.

Escala: 5 → 20 → 50 → 100. Evaluar calidad visual, identidad, tiempo y errores al cerrar cada lote; continuar automáticamente con el material disponible que cumpla el estándar. No contabilizar como terminados los SKU que aún no se han recibido.
