AVANCE — RED COMERCIAL CONECTATECH

# Incidencia TELF001 · diagnóstico del 26/10/2026

**Causa técnica comprobada: TELF001 queda fuera de la colección Teléfonos por clasificación editorial pendiente y etiqueta de colección vacía. No está eliminado del feed ni agotado en el último corte. La desaparición del catálogo general de WhatsApp no se puede atribuir definitivamente a esa exclusión sin comprobar el vínculo del número y la visibilidad del artículo en Meta.**

| Verificación solicitada | Resultado y alcance |
|---|---|
| Último corte validado Sistema 593 | TELF001 existe en el corte comercial 26/10/2026. Contado $139,90 y PVP $174,88 coinciden exactamente con lo autorizado. La disponibilidad es positiva en ese corte; no se leyó stock transaccional en tiempo real. |
| Data Hub | Se verificó el artefacto validado que consume la publicación, con fecha/hash coincidentes. No hay acceso autenticado ni endpoint acreditado del Data Hub para verificar su estado interno en vivo; no se da por inspeccionado. |
| Web | Ficha accesible por HTTPS 200, SKU y URL conservados, precio $139,90 y schema InStock. El índice y catálogo de ventas mantienen el PVP autorizado. |
| Feed Meta | TELF001 aparece exactamente una vez, con id TELF001, in stock, $139.90 USD y product_type Celulares. No se detectó sustitución de ID ni duplicado del modelo dentro del feed. |
| Exclusión | Sí: de la colección de teléfonos, no del feed general. El plan la documenta como PENDIENTE_APROBACIÓN. |
| Rechazo de Meta | No acreditado. PENDIENTE_APROBACIÓN es un estado editorial local, no el estado Elegible/Rechazado de Meta. La elegibilidad histórica comunicada por el propietario se conserva como antecedente, no como verificación actual. |
| Importación y sincronización | La última ejecución existente terminó con META_SINCRONIZADO y el mismo hash del CSV público actual. Upload 990027456790973, catálogo maestro 1036301566100990, fuente 974449225015463. Esto prueba sincronización registrada; no por sí solo la visibilidad individual del producto en WhatsApp. |
| Vínculo WhatsApp | Hay una confirmación histórica del propietario del orden de las seis colecciones en la aplicación. El registro no tiene WABA ID ni prueba de vínculo del número actualmente afectado. No se puede excluir una administración directa desde la app o un catálogo/número distinto sin esa comprobación. |
| Imagen | La URL externa actual se puede abrir y devuelve la imagen del producto. No se detectó una caída pública en esta consulta. El contrato editorial mantiene pendiente la portada comercial sin caja y su revisión; que la imagen responda no prueba su aprobación por Meta ni resuelve sus derechos. No se cambió ni regeneró. |

## Cadena causal reproducida

1. `seo-contenido.json` no tiene `comercialVerificado:true` para TELF001. Su contrato mantiene calidad REVISAR, publicación PENDIENTE y portada profesional pendiente. El contrato contiene datos financieros históricos; no se utilizaron para reemplazar los del corte autorizado.
2. `scripts/categorias-meta-web.cjs` asigna etiqueta únicamente cuando `comercialVerificado === true` y `imagenPendiente !== true`. Para TELF001 produce `custom_label_0: ""`.
3. El feed incluye el producto con precio y disponibilidad correctos, pero conserva esa etiqueta vacía.
4. El conjunto **29304551402566106**, Celulares y Smartphones, exige etiqueta `ct-web:celulares-y-smartphones` Y disponibilidad `in stock`. TELF001 no cumple la primera condición.
5. El plan de colecciones lo excluye como PENDIENTE_APROBACIÓN. La ejecución real de hoy verifica la colección con 19 SKU; TELF001 no está en la lista registrada. Estar disponible o haber sido Elegible en Meta no satisface automáticamente este filtro de pertenencia.

La actualización financiera autorizada no tiene una regla que elimine TELF001 por precio. La exclusión se explica por la clasificación/colección; no hay evidencia de que $139,90 haya causado un rechazo de políticas. Se distingue esta causa comprobada de otros motivos de invisibilidad general que aún requieren lectura del artículo Meta y del catálogo asociado a WhatsApp.

## Evidencia verificada

- [Corte comercial validado](https://github.com/conectatech-ec/conectatech-ec.github.io/blob/a25ed016a4d48be1de11eeb13542b1ed51886e00/datos-593/corte-comercial-publico-validado.json), fuente SHA-256 `f37f364dfb30f005bf07f5fb0d7052e8f1dad7e1ae73a9baeacc2ce88aa5eadc`.
- [Ficha conservada](https://conectatech-ec.github.io/productos/telf001-telefono-zte-a56-pro-128gb/) y [feed actual](https://conectatech-ec.github.io/exportaciones/meta-catalogo-piloto.csv), comprobados por HTTP. Hash del feed observado: `badede0d0708ca83a019e74a11e81994289ce662035a785a83c8a4242c1df2a7`.
- [Plan de conjuntos](https://github.com/conectatech-ec/conectatech-ec.github.io/blob/a25ed016a4d48be1de11eeb13542b1ed51886e00/exportaciones/meta-conjuntos-web.json) y [organización WhatsApp pendiente](https://github.com/conectatech-ec/conectatech-ec.github.io/blob/a25ed016a4d48be1de11eeb13542b1ed51886e00/exportaciones/whatsapp-organizacion-pendiente.json).
- [Ejecución real del 26/10](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/40405849574), job 121863271945. Logs consultados sin activar ni repetir workflows. META_SINCRONIZADO: fuente f37f..., feed badede..., upload 990027456790973, colección teléfonos SIN_CAMBIOS y 19 artículos. No se confundió un workflow exitoso de generación con una importación: el paso de sincronización devuelve un comprobante específico de Meta.
- [Estado histórico de integración](https://github.com/conectatech-ec/conectatech-ec.github.io/blob/a25ed016a4d48be1de11eeb13542b1ed51886e00/reportes/integracion-whatsapp/estado.json): la confirmación visual previa acredita orden de colecciones, no conteo completo ni vínculo WABA del número actual.

## Corrección mínima propuesta, no aplicada

**No borrar ni recrear TELF001, ni recrear la colección.** Resolver primero la lectura actual del artículo existente y la distinción entre aprobación Meta y aprobación editorial. Si se confirma que se desea incluirlo y se resuelve su revisión comercial, el cambio mínimo de pertenencia es asignar exclusivamente a TELF001:

```json
{"custom_label_0":"ct-web:celulares-y-smartphones"}
```

Conservar id/retailer_id TELF001, el ID Graph del artículo que se recupere (no inventado), URL, imagen, marca, stock, precio y todos los demás campos. No marcar `comercialVerificado:true` de forma artificial para salvar el filtro. No ampliar el filtro del conjunto ni relajar el clasificador para todos los productos.

**Persistencia:** un cambio aislado en Meta se sobrescribiría cuando la fuente actual vuelva a importar su etiqueta vacía. Por eso esta propuesta no se presenta como una solución permanente lista para desplegar. Una excepción comercial explícita por SKU o la aprobación editorial real debe resolverse en el proyecto de origen; no se modificó ese componente compartido bajo esta incidencia. Tampoco se añade una fuente suplementaria ni se cambia la sincronización central.

## Preparación y verificación aisladas

`simular.py` lee el CSV sin modificarlo y simula únicamente la etiqueta de TELF001. Resultado real: 966 filas antes/después; cambió 1 campo de 1 SKU; las otras 965 filas y todos los demás campos de TELF001 permanecen iguales. Con el mismo filtro de Teléfonos, pasa de no coincidir a coincidir. Es prueba de pertenencia al filtro, **no una publicación ni comprobación visual en WhatsApp**.

```sh
python simular.py RUTA_CSV_ACTUAL --output RUTA_PRIVADA_RESULTADO.json
python -m unittest discover -s tests -v
```

Tres pruebas aprobadas: aislamiento del cambio, bloqueo de SKU ausente/duplicado/precio/disponibilidad diferentes e idempotencia. El programa no contiene transporte de red, credenciales ni función de aplicación remota. No modifica precios, stock, imágenes, contratos, Data Hub, generadores, feed productivo, colecciones ni otros SKU.

## Comprobaciones pendientes antes de aplicar

1. Identificar el catálogo que usa el número afectado de WhatsApp: comprobar si es el maestro 1036301566100990 o un catálogo administrado directamente en la app. La confirmación histórica de orden no reemplaza esa comprobación.
2. Buscar **TELF001 por identificador** en Todos los productos de Commerce Manager y en el catálogo general de WhatsApp, además de la colección Teléfonos. Registrar ID Graph existente, elegibilidad, visibilidad/oculto y diagnóstico de imagen. No crear otro artículo si no aparece en la colección.
3. Resolver la aprobación editorial de la imagen o una excepción comercial expresa para este SKU, sin fingir una revisión ya realizada. Solo después autorizar la corrección de etiqueta y su persistencia desde el origen.
4. Verificar tras esa corrección: mismo ID y enlace, pertenencia a la colección, disponibilidad/precio, lectura visible en el número afectado y conservación después de la siguiente importación.

**Resultado de esta ejecución:** causa de exclusión de colección identificada; fuente y sincronización comprobadas; corrección mínima simulada; 0 despliegues, 0 cambios en Meta/WhatsApp y 0 cambios en componentes compartidos. La incidencia no se declara resuelta en la aplicación.
