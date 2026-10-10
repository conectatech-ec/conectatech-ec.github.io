> Actualización 2026-10-10: prevalece [PRODUCCION-MAESTRA.md](PRODUCCION-MAESTRA.md). Todos SIN CAJA; piloto retomado, lotes 20–30, después 50 y 100. Las presentaciones y tamaños de lote anteriores son históricos.

# Producción de imágenes por SKU

Las reglas permanentes viven en `importacion/reglas-sku.json`, versionadas en Git. Hay un registro para cada uno de los 1.165 SKU, con autenticidad, presentación, instrucciones, evidencia y revisión independientes. Los tres SKU prioritarios están **por verificar** en autenticidad. `MICR027` se resuelve a `MICR27`, el código de 593. Identificar modelo o leer un logotipo no certifica originalidad.

## Excepciones que sobreviven a las actualizaciones

Usar las cinco columnas de `reglas-ejemplo.csv`. Valores de autenticidad: `original verificado`, `genérico/compatible`, `por verificar`. Presentación: `con caja`, `sin caja`, `selección automática`. Campos vacíos conservan lo vigente; `[BORRAR]` borra instrucciones o evidencia. Para elevar a original verificado se exige evidencia explícita y validación comercial del responsable.

```bash
python scripts/reglas_sku.py --csv importacion/excepciones.csv
python scripts/reglas_sku.py --csv importacion/excepciones.csv --aplicar
```

Cada cambio incrementa la revisión y conserva antes/después en el historial. Las fotos y banners con revisión antigua dejan de ser elegibles hasta cotejarlos con la nueva instrucción. `sin caja` excluye empaque en cualquier vista comercial; `con caja` exige empaque en portada. Se conservan los originales. Las instrucciones en lenguaje natural se guardan completas y requieren revisión explícita; no se interpretan mediante conjeturas.

## Ingesta y producción

1. Subir originales sin modificarlos en una carpeta del repositorio. Nombres exactos `SKU.jpg`, `SKU-01.png`, `SKU-02.jpg`, `SKU-03.jpg`, `SKU-04.jpg`; también `_01`. Solo se aceptan alias registrados. No se aproxima el SKU.
2. Crear el manifiesto: `python scripts/registrar-fotos.py --carpeta importacion/entrada --salida importacion/lote.json`. Detecta desconocidos, duplicados SHA-256 y dimensiones. Conserva todos los archivos y deja las aprobaciones pendientes.
3. Revisar modelo/variante, enfoque, ausencia de datos privados, fuente y presencia de caja. Marcar campos de revisión solo con evidencia. Las posiciones 02, 03 y 04 son opcionales y no se rellenan artificialmente. No añadir precios ni existencias al manifiesto.
4. Si hace falta separar fondo, puede usarse un PNG transparente auténtico o una `silueta_revisada` de puntos del original. La máscara elimina el entorno manteniendo los píxeles interiores; no modifica perspectiva, logotipos, texto, conectores ni forma. `recorte` delimita coordenadas de la fuente. Un fondo o desenfoque no resoluble queda pendiente; no se reconstruye con IA.
5. `ajustes` admite brillo, contraste y nitidez entre 0,95 y 1,08. El valor predeterminado 1 conserva los colores cuando no se justifica corregirlos. Un balance de blancos problemático se deriva a retoque revisado; no hay corrección de color ciega.
6. Ejecutar simulación y luego aplicación:

```bash
python scripts/procesar-imagenes.py --manifiesto importacion/lote.json
python scripts/procesar-imagenes.py --manifiesto importacion/lote.json --aplicar
node scripts/generar-seo.cjs
node scripts/exportar-canales.cjs
python scripts/verificar-publicacion.py --sku CARG050 MICR027 CARG016
```

El importador editorial `importar-productos.py` sigue recibiendo títulos, descripciones y características confirmados. Archiva los originales pero solo referencia medios profesionales aprobados. La generación SEO y las exportaciones vuelven a aplicar las reglas para impedir que una importación anterior reintroduzca una caja excluida. `comercialVerificado` significa revisión editorial, nunca autenticidad del artículo.

## Calidad y tamaños

JPEG/PNG/WebP estático, máximo 20 MB y 40 megapíxeles. Fuente útil mínima: lado corto 500 y largo 1000 píxeles; después del recorte. Salida WebP 1200 × 1200, versiones 600 y 300, calidad 90. Producto contenido en 1008 × 1008, centrado, sin ampliación. El lienzo puede ser mayor que el contenido original: eso no aumenta su detalle. SHA-256 identifica originales y salidas; dHash avisa de similitud entre SKU. Ninguno identifica el modelo automáticamente.

Las fuentes, dimensiones, máscara, correcciones, revisión y huellas se guardan en `medios.json`. No hay ampliación generativa, cambio de texto o puertos. El piloto usa fuentes ya limpias o recortes revisados, por lo que no se aplicó una corrección de color injustificada.

## Banners selectivos

```bash
python scripts/generar-banners.py --sku CARG050 MICR027 CARG016
```

Solo genera los SKU solicitados con portada aprobada y regla vigente. El fondo de marca fue creado con la habilidad `imagegen`; foto y logotipo original se componen con píxeles existentes. El archivo `imagenes/marca/logo-original.png` se conserva intacto. No se dibuja ni regenera el producto. Los banners actuales no incrustan precios: pueden reutilizarse sin desactualizar importes. El catálogo destaca PROMO CONTADO y muestra PVP sin tachar. Si falta portada compatible, el banner queda pendiente.

Prompt del fondo (herramienta integrada, sin CLI): fondo cuadrado azul marino y verde, líneas de luz tecnológicas discretas, espacio para texto y zona clara para incorporar fotografías reales; sin productos, texto, logotipos ni precios. `fondo-promocional-original.png` conserva el resultado; el script es la receta reproducible de composición.

## Ejecución y control

GitHub Actions → **Producir catálogo profesional por SKU**. Admite manifiesto y CSV opcional de reglas. Por defecto simula; `aplicar=true` publica los productos válidos, conserva reporte por número de ejecución y comprueba HTTP, canonical, precio, PVP, disponibilidad, imágenes y banners contra sus huellas. Un error estructural bloquea escrituras del lote; un problema de foto deja ese SKU pendiente. Un push concurrente no se sobrescribe.

El script admite lotes de 20, 100 o el catálogo completo. No equivale a un servicio de búsqueda automática de imágenes: requiere originales vinculados y revisión de identidad. El lote de 20 real produjo dos portadas de cajas; tres fuentes desenfocadas y quince SKU sin original siguen pendientes. No se habilitó la ampliación a 100 por esta cobertura insuficiente. La prueba mide procesamiento local, no tiempo de fotografía, revisión humana, red o despliegue.

Pruebas de integridad: `python scripts/test-importar-productos.py` y `python scripts/test-produccion.py`. Validan conservación de precios/stock, repetibilidad, originales, miniaturas, duplicados, rutas y exclusión de empaque tras cambios de reglas.
