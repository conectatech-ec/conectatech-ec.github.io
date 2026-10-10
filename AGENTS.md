## Excepción más reciente — imágenes Yantech sin marca

Orden expresa del propietario (2026-10-10): retirar el nombre Yantech / YAN TECH y su logotipo de todas las imágenes comerciales de sus productos. Conservar originales intactos y geometría/hardware. Esta excepción prevalece sobre conservar logotipos exclusivamente para Yantech. Registrar cada SKU identificado con `scripts/reglas_sku.py --marca Yantech --sku SKU --evidencia FUENTE --aplicar`; `reglas-sku.json` conserva la política general y el historial. Revisar cada maestro y guardar `revision_marcas.Yantech` con SHA-256, sin_texto, sin_logotipo y evidencia; el pipeline rechaza medios y banners sin esa revisión. No modificar nombres, precios, stock o URL por esta excepción visual.

# CONECTATECH — mantenimiento del catálogo

## Prioridad más reciente — estrategia comercial y tres columnas

- Leer `importacion/ESTRATEGIA-COMERCIAL.md` y `estrategia-comercial.json`. Orden posterior del propietario: obtener imágenes auténticas del modelo identificado; retoque más comercial de fotos propias; no detener la cola por permisos externos. Registrar la excepción y seguir otro SKU.
- Tres columnas en escritorio y dos en móvil. Fotos más protagonistas, detalles únicamente en ficha, cambios reales publicados primero. Precios, existencias, SKU y URLs intactos.
- La espera del lote premium-001 se limita a sus propuestas sin aprobación: no bloquea nuevos SKU aptos bajo la nueva estrategia. No dar por aprobados sus cinco maestros ni cambiar sus banderas para publicar.
- Mantener contrato v3 y QA. Flexibilizar iluminación, color y presentación no permite cambiar modelo, variante vendida, puertos, botones ni accesorios.

## Prioridad histórica — aprobación del lote premium-001

- Leer `importacion/PREMIUM.md` y `importacion/premium-activo.json` antes de producir o publicar. La orden del propietario suspende producción masiva y exige cinco propuestas tecnológicas sin juguetes, con comparación antes/después y aprobación visual explícita antes de sustituir fotos públicas.
- Esta prioridad prevalece sobre los tamaños de lote y permisos de publicación automática descritos más abajo. Mantener tarjetas compactas, datos comerciales y URLs.
- No confundir una imagen generada de aspecto nítido con fidelidad demostrada. Revisar hardware, logotipos, microtextos y textura; no cerrar observaciones mediante una bandera sin evidencia.
- No mezclar `revision/premium-001` completa en main. Conservar maestros y comparación en la rama de revisión. No aplicar hasta aprobación por SKU y SHA-256; `premium_guard.py` debe pasar.

- Leer `importacion/SISTEMA-PROFESIONAL.md` antes de importar fotos o modificar publicaciones.
- Las excepciones expresadas por el propietario se registran permanentemente en `importacion/reglas-sku.json`. No dejarlas solo en el chat, un prompt o un banner. Usar `scripts/reglas_sku.py`; conservar historial y revisiones.
- Autenticidad y presentación son atributos independientes. Nunca deducir originalidad de logotipos o cajas. Si no hay evidencia, mantener `por verificar`.
- Aplicar las reglas vigentes a portadas, vistas, catálogo, exportaciones y banners. SIN CAJA excluye empaques; nunca extraer la ilustración de una caja y presentarla como foto real del producto.
- Los originales son inmutables. No regenerar detalles, texto, conectores, accesorios o proporciones. Conservar el logotipo original. Si la fuente es insuficiente, buscar una referencia auténtica del modelo/variante exactos o dejar el SKU pendiente.
- MICR027 es alias de MICR27. No crear otro SKU ni otra variante por aproximación.
- Política vigente del propietario (2026-10-10): TODOS los SKU SIN CAJA. Sustituye las instrucciones históricas de CARG050 y MICR27. Conservar esas instrucciones en el historial, no aplicarlas a publicaciones nuevas.
- No cambiar precios, PVP, stock ni información de 593 mediante importaciones editoriales o visuales. Un cambio comercial requiere validación explícita. PROMO CONTADO por encima de PVP, sin tachar PVP y sin precios en la foto principal.
- Mantener las URLs estables. Publicado significa comprobar HTTP, datos y archivos servidos; generar archivos o hacer commit no basta.
- No marcar lotes pendientes como terminados. El lote de 20 dejó 18 pendientes; continuar desde el reporte y no repetir trabajo ya validado.
- Banners solo para SKU priorizados. Las nuevas instrucciones invalidan medios con revisión antigua, incluidos banners.
- Ejecutar controles pertinentes al cambio y actualizar el reporte. No pedir autorización para ajustes técnicos reversibles ya comprendidos en la tarea; consultar si hay ambigüedad comercial o riesgo de identificar mal el producto.

## Prioridad vigente — producción por lotes (2026-10-10)

- Alimentar fotografías y fichas existentes. No rediseñar la web ni crear banners durante esta fase.
- Leer `importacion/PRODUCCION-MAESTRA.md`. Continuar piloto existente sin rehacerlo; estándar visual aprobado. Lotes nuevos de 20–30 SKU, después 50 y 100. Fotografías propias de Drive autorizadas para edición/publicación. Las excepciones de un SKU no detienen los demás. Usar contrato v3 y verificación local/móvil/HTTP antes de declarar publicado.
- Trabajar solo con SKU nuevos o modificados del lote recibido; reutilizar medios aprobados y vigentes, sin regenerarlos. Leer índices existentes para buscar SKU no implica revisar todo el catálogo.
- Registrar discrepancias de caja/modelo/variante antes de modificar nombres o características. No resolverlas por aproximación.
- Mostrar exclusivamente el producto, tanto original como genérico/compatible. La presentación de Sheets es histórica. Por confirmación expresa del propietario del 2026-10-10, los valores «Original» y «Caja original» de la columna Tipo del Registro acreditan autenticidad comercial. Guardar la fila y esa confirmación por SKU; no deducirla de la fotografía del empaque. AAA sigue siendo genérico/compatible. Valores contradictorios requieren revisión. Registrar por separado identidad/variante y derechos de uso de material externo.
- Reportar cada SKU con foto recibida, portada, presentación, contado, PVP, URL y estado. Solo marcar publicado después de verificar Pages.

## Catálogo compacto y revisión de publicaciones — orden vigente

- Conservar tamaños de tarjetas, columnas y distribución compacta aprobados. Tarjetas: foto, nombre breve, PROMO CONTADO, PVP sin tachar y acceso a ficha; nunca especificaciones ni descripciones extensas antes del clic.
- Foto, título y «Ver detalles» abren la URL estable de la ficha completa. Reutilizar las portadas aprobadas en tarjetas, búsquedas, filtros y galerías, con `object-fit: contain` y miniaturas responsivas.
- Orden predeterminado temporal: «Actualizados recientemente». Conservar orden original y demás opciones; el valor predeterminado se configura sin reconstruir el catálogo.
- Fecha efectiva por SKU únicamente tras un cambio comercial/editorial/fotográfico real publicado y verificado. Registrar huella semántica en `importacion/actualizaciones-sku.json`; una reverificación, importación sin cambios, fecha de creación o modificación financiera no renueva esa fecha.
- Verificar con `scripts/verificar-catalogo.cjs` en Chromium real móvil/escritorio: tarjetas compactas, ausencia de fichas técnicas antes del clic, orden, filtros, búsqueda, paginación, imagen correcta y navegación a ficha. Repetir comprobación pública tras Pages. No cambiar encabezado, portada ni banners.
