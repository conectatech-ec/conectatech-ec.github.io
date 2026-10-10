# Contrato verificable por SKU — manifiesto versión 3

El contrato conserva la identidad, las fuentes y los valores comerciales por SKU. No sustituye la investigación ni genera autorizaciones. `Original`/`Caja original` del Registro acreditan originalidad comercial conforme a la confirmación del propietario; la regla guardada en `reglas-sku.json` debe coincidir. Todos los medios comerciales son SIN CAJA. Las versiones 1 y 2 históricas conservan su comportamiento; utilizar versión 3 para los nuevos lotes.

## Archivos persistentes

Guardar cada contrato en `importacion/contratos/SKU.json`. El manifiesto existente incorpora:

```json
{
  "version": 3,
  "skus": ["SKU"],
  "imagenes": {"SKU": []},
  "aprobaciones": {"SKU": {
    "estado": "REVISAR",
    "identidad_verificada": false,
    "ficha_verificada": false,
    "uso_comercial_permitido": false
  }},
  "contratos": {"SKU": "importacion/contratos/SKU.json"}
}
```

`imagenes` conserva el formato actual del procesador: fuente, ruta, hash, posición, revisión de regla y revisiones visuales. `contratos` también acepta objetos de contrato embebidos o la ruta de un único mapa por SKU. Las aprobaciones nunca se deducen de que exista una URL o un logotipo. El registro permanece en Git; los originales de identificación continúan en Drive y los archivos privados no se publican.

## Estructura de contrato

Ejemplo de estructura **pendiente**. Sustituir los marcadores mediante evidencia real; no cambiar estados únicamente para superar la validación.

```json
{
  "sku": "SKU",
  "nombre_original": "Nombre de la base al iniciar el enriquecimiento",
  "titulo_comercial": "Título preciso propuesto",
  "tipo": "generico",
  "marca": null,
  "modelo": null,
  "variante": "Color/variante observados",
  "categoria_original": "Categoría vigente en index.html",
  "categoria_comercial": "Categoría vigente en index.html",
  "precio_contado": 0,
  "pvp": 0,
  "stock": 0,
  "unidad_venta": {
    "descripcion": "Unidad de venta pendiente de confirmar",
    "cantidad": 1,
    "verificada": false,
    "fuente": "datos-593/inventario-publico.csv"
  },
  "fotografias_fuente": [{"url": "https://drive.google.com/file/d/ID/view", "sha256": "HASH_REAL"}],
  "fuentes_tecnicas": ["https://drive.google.com/file/d/ID/view"],
  "imagen_principal": "/imagenes/sku/SKU-01.webp",
  "imagenes_secundarias": [],
  "derechos_imagen": {
    "estado": "PENDIENTE",
    "tipo": "propia",
    "evidencia": "Anotar la autorización aplicable del propietario o la licencia específica",
    "fuente": "https://drive.google.com/file/d/ID/view",
    "fecha_verificacion": "2026-10-10",
    "archivos": [{"sha256": "HASH_REAL_COMERCIAL", "fuente": "https://drive.google.com/file/d/ID/view"}]
  },
  "especificaciones": [{
    "nombre": "Color", "valor": "Valor observado",
    "fuentes": ["https://drive.google.com/file/d/ID/view"],
    "estado": "POR_VERIFICAR", "publicar": false
  }],
  "estado_calidad": "REVISAR",
  "estado_publicacion": "PENDIENTE",
  "url_publica": "https://conectatech-ec.github.io/productos/SLUG_EXISTENTE/",
  "fecha_verificacion": "2026-10-10",
  "validaciones": {
    "base_593": {
      "archivo": "datos-593/inventario-publico.csv", "sha256": "HASH_DEL_CSV_COMPLETO",
      "fila": {"sku": "SKU", "nombre": "COPIA_LITERAL", "stock": "0", "precio_general": "0", "iva": "15", "tipo": "PRODUCTO", "categoria": "COPIA_LITERAL", "clasificacion": "COPIA_LITERAL"}
    },
    "identidad": {
      "sku_verificado": false,
      "marca_no_declarada": true,
      "modelo_no_declarado": true,
      "variante_verificado": false,
      "fuentes": ["https://drive.google.com/file/d/ID/view"],
      "discrepancias_pendientes": []
    },
    "ficha": {"verificada": false, "fuente": "https://drive.google.com/file/d/ID/view"}
  }
}
```

Los importes y stock son copias exactas del catálogo, nunca valores calculados por este proceso. La fila 593 debe copiarse **entera**, con los textos originales que devuelve `csv.DictReader` y el hash del CSV vigente. El precio `precio_general` de 593 tiene otra base que PROMO CONTADO: el validador no los equipara ni recalcula IVA/PVP; protege el snapshot literal y compara el stock de ambos orígenes. Una discrepancia de stock bloquea únicamente ese SKU.

`tipo` admite `original` o `generico`, consistente con la regla comercial y su evidencia. Para originales se documentan `marca`, `modelo`, `variante` y sus indicadores `marca_verificado`, `modelo_verificado`, `variante_verificado` en `validaciones.identidad`. Cada fuente de identidad debe estar en `fotografias_fuente` con SHA-256.

Para cualquier producto sin marca/modelo legibles, registrar `null` y `marca_no_declarada:true` / `modelo_no_declarado:true`. Añadir `sku_verificado:true` y documentar la identificación en las fotografías fuente. Esto omite la afirmación; no inventa una marca ni afirma que se identificó el modelo. La clasificación comercial original/genérico es independiente y se conserva. La variante visible se sigue comprobando. Si existe un nombre base dudoso, puede conservarse la discrepancia sin atribuir ese modelo al producto:

```json
{
  "sku_verificado": true,
  "modelo_no_declarado": true,
  "discrepancias_pendientes": [{
    "campo": "modelo",
    "tratamiento": "NO_DECLARAR",
    "valor_catalogo": "Camaro",
    "descripcion": "El modelo de la base no pudo confirmarse; el título describe el juguete real sin atribuir un vehículo",
    "fuente": "https://drive.google.com/file/d/ID/view"
  }]
}
```

Solo se admite esa omisión para marca/modelo no declarados, con identidad de SKU inequívoca y evidencia fotográfica. Si la denominación dudosa vuelve a aparecer en título, descripción o especificaciones publicables, el gate la bloquea. Las demás discrepancias de identidad impiden publicar.

Las especificaciones son una lista de `{nombre,valor,fuentes,estado,publicar}`. Toda afirmación publicable requiere `VERIFICADO` y fuentes que consten en el contrato. Los datos desconocidos pueden conservarse con `publicar:false`; no se deben exportar como atributos, beneficios, garantía, compatibilidad o contenido de venta. Una revisión editorial explícita cubre título y descripción; el script no puede deducir la veracidad de lenguaje natural.

Derechos: `estado:AUTORIZADO`; `tipo:propia|licencia|permiso_fabricante|permiso_distribuidor`; evidencia descriptiva, procedencia y fecha. `archivos` vincula cada hash y fuente del manifiesto con el permiso. La autorización del propietario permite sus fotos; no transfiere derechos sobre una imagen externa encontrada. El validador comprueba que exista evidencia documentada y se refiera a esos bytes; la revisión de su contenido corresponde al operador.

Para migrar una categoría sin inventarla, el manifiesto puede incluir `categorias_comerciales: {"Categoría original": {"nombre":"Categoría comercial", "verificada":true, "fuente":"importacion/archivo-con-la-decision.json"}}`. La categoría original permanece en el contrato. El validador no modifica filtros ni categorías por sí mismo.

## Fases y controles que se ejecutan

1. **Preparación local.** Verificar contrato, autenticidad, identidad/variante, unidad, fuente/derechos, especificaciones, SKU único, URL estable y finanzas. El procesador verifica recorte, revisión, hash original, resolución útil mínima 500 × 1000 (en cualquier orientación), SIN CAJA, calidad visual revisada y genera WebP 1200/600/300 sin ampliar. Valida dimensiones y hashes de las salidas antes de escribir. Un SKU bloqueado conserva su portada vigente compatible y permite continuar otros SKU. Un SKU duplicado en v3 no aplica ninguna de sus apariciones.

```sh
python scripts/validar-contrato.py --manifiesto importacion/lotes/LOTE/manifiesto.json --fase preparacion
python scripts/procesar-imagenes.py --manifiesto importacion/lotes/LOTE/manifiesto.json --aplicar --reporte reportes/LOTE-imagenes.json
```

`--aplicar` escribe **localmente**, no demuestra publicación ni exige todavía la captura móvil: la ficha y los medios deben existir antes de poder renderizarlos. Los originales/medios aprobados se reutilizan por huella; los borradores bloqueados siguen disponibles con `--borradores .produccion-privada/borradores`. Una salida `aplicado_local` jamás se cuenta como publicada.

2. **Contenido y preview.** Importar el contenido editorial verificado usando el sistema existente, generar SEO/exportaciones y servir los archivos locales. Abrir la ficha real en un navegador móvil (p. ej. ancho 390) con los medios nuevos. Comprobar carga, encuadre, contenido, precios y ausencia de desbordamiento. Guardar captura y el hash de los bytes exactos de `productos/SLUG/index.html`; no un HTML de ejemplo, reconstruido o de otra versión. Registrar solo después de revisar:

```json
{
  "movil": {
    "estado": "VERIFICADO", "sku": "SKU",
    "url": "https://conectatech-ec.github.io/productos/SLUG/",
    "archivo": "reportes/capturas/SKU-movil.png", "sha256": "HASH_CAPTURA_REAL",
    "ancho_viewport": 390, "ancho_documento": 390,
    "fecha": "2026-10-10T06:00:00Z",
    "archivo_html": "productos/SLUG/index.html", "sha256_html": "HASH_HTML_REAL"
  }
}
```

Añadir ese objeto dentro de `validaciones`. La captura debe existir y coincidir con su hash, el viewport debe medir 320–600 px y el documento no puede excederlo. El HTML revisado debe conservar su hash, SKU y ruta de portada.

3. **Gate antes de publicar.** Este comando exige todos los controles anteriores, todos los archivos y captura móvil. Compara el título y las características realmente aplicadas en catálogo/SEO con las del contrato y comprueba que ambos vinculen la portada. Incluir también `descripcion` en el contrato permite comparar literalmente la descripción revisada; siempre exige una descripción aplicada y comercialmente verificada. Verifica rutas internas de enlaces y recursos presentes en el HTML y sintaxis de WhatsApp, sin enviar mensajes. Los enlaces HTTP externos diferentes de WhatsApp no se confunden con comprobaciones HTTP hechas: requieren comprobación adicional cuando se introduzcan.

```sh
python scripts/validar-contrato.py --manifiesto importacion/lotes/LOTE/manifiesto.json --fase prepublicacion --reporte reportes/LOTE-prepublicacion.json
```

El comando entrega un resultado por SKU. Publicar únicamente los aprobados; un estado pendiente de otro SKU no autoriza ignorar su error. El workflow que hace commit/push debe ejecutar este gate y seleccionar los aprobados. No usar la aprobación local del procesador como sustituto de este control.

4. **Verificación después de desplegar Pages.** Ejecutar el verificador HTTP existente. Guardar en cada contrato `validaciones.publicacion_http:{archivo:"reportes/LOTE-http.json",sha256:"HASH_REPORTE_REAL"}`. El reporte debe mostrar esa ficha con HTTP 200, precios/stock correctos y las tres versiones de cada imagen con sus hashes. El HTML servido debe coincidir con el hash del HTML revisado en móvil.

```sh
python scripts/verificar-publicacion.py --sku SKU1 SKU2 --reporte reportes/LOTE-http.json
python scripts/validar-contrato.py --manifiesto importacion/lotes/LOTE/manifiesto.json --fase publicacion --reporte reportes/LOTE-contratos.json
```

Solo la última fase puede devolver `PUBLICADO_VERIFICADO`. Ni una captura local, ni un commit, ni HTTP 200 con imagen pendiente bastan. Los comandos no reescriben automáticamente las evidencias ni elevan el estado persistente del contrato: registrar el resultado real después del control. Fechas y evidencias antiguas no aprueban otro HTML porque se comparan hashes.

## Pruebas

`python scripts/test-contrato.py` verifica datos financieros intactos, aislamiento por SKU, bloqueo de duplicados, falta de permiso, permisos para otro hash, especificaciones no verificadas, cambio de snapshot 593, evidencia móvil, integridad de miniaturas, verificación HTTP y reutilización sin regenerar. Sus archivos sintéticos son fixtures, no evidencia de producción. También ejecutar los tests incremental y de producción para mantener compatibilidad v1/v2.

## Beneficios comerciales (opcional, incremental)

`beneficios` admite hasta cuatro objetos con `valor`, `titulo`, `descripcion`, `especificaciones` (nombres verificados), `fuentes` y `estado: VERIFICADO`. El gate bloquea referencias sin respaldo. Revisión editorial obligatoria: las frases deben expresar beneficios reales sin promesas nuevas. Aplicar-datos-contrato traslada únicamente el texto público a SEO; el generador activa recuadros y apartados desplegables solo en esos SKU. El navegador comprueba coincidencia y apertura con teclado. Registrar-actualizaciones incluye estos textos en la huella semántica, sin renovar SKU no modificados.
