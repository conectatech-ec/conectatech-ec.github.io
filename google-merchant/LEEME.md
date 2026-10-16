# Google Merchant Center — 5874003439

Costo: $0. País: Ecuador (`EC`). Idioma: español (`es`). Moneda: USD.
Estado: solo validación. Cada artículo excluye `Shopping_ads` y `Free_listings` hasta resolver stock, compra y políticas. No se activa ninguna publicación ni se conecta Google Ads.

## Feed y aislamiento

URL pública estable (se conserva al renovar el archivo):

`https://raw.githubusercontent.com/conectatech-ec/conectatech-ec.github.io/refs/heads/feeds/google-merchant-ec/google-merchant/productos-ec.xml`

El generador lee catálogo, inventario593, fichas y contratos existentes. No ejecuta el exportador Meta ni generadores de catálogo, no modifica sus fuentes y no cambia las sesiones de trabajo existentes. El workflow publica el XML y cuatro archivos de verificaciones solamente en `feeds/google-merchant-ec`, con árbol independiente y sin catálogo ni workflows. Nunca escribe en main ni despliega Pages.

## Ejecutar y validar

```sh
python -m pip install 'Pillow>=12.0,<13'
python -m unittest discover -s google-merchant -p test_feed.py
python google-merchant/generar.py --root /ruta/copia-fuente-vigente --output google-merchant --verify-public
python google-merchant/preconexion.py --root /ruta/copia-fuente-vigente --output google-merchant
```

Sin `--verify-public` el resultado es candidato local: no presentarlo como verificado por HTTPS.
El modo público verifica cada ficha, precio visible y estructurado, stock estructurado, imagen decodificable y hash de la fotografía servida. Excluye fallos por artículo y no reemplaza el feed si todos fallan. Los motivos y las evidencias quedan en JSON junto al XML. Se conserva el último feed ante un fallo global; revisar Actions porque ese archivo podría quedar desactualizado.

Se incluyen únicamente SKU con contrato aprobado y publicación verificada, unidad de venta e identidad verificadas, textos reales completos, precio coincidente en catálogo/maestro/ficha y fotografía aprobada con hash correcto y mínimo 250×250. Disponibilidad se deriva del stock registrado: positivo `in_stock`, cero `out_of_stock`; valores negativos, desconocidos o discrepantes se excluyen. Esto no convierte el inventario histórico en stock en tiempo real.

El precio es `promo_contado`, que coincide con la oferta y el precio principal visible; no se declara el PVP como precio anterior ni se inventa una oferta temporal. Los textos editoriales mantenidos con asistencia generativa se reutilizan sin reescritura como `structured_title` y `structured_description`, con `digital_source_type=trained_algorithmic_media`, según la especificación de Google. La condición se reutiliza únicamente si está explícita en la ficha. Marca solo si coincide literalmente entre contrato y datos estructurados y no es un producto clasificado como genérico. No se infieren marcas por título/SKU, ni GTIN/MPN, ni `identifier_exists=no`. Los identificadores faltantes pueden impedir que Google apruebe artículos: conseguir los identificadores auténticos antes de subsanar ese aviso.

## Actualización desde fuente vigente, sin escrituras en main

Cada ejecución obtiene el HEAD actual de `main` en una copia separada `fuente-vigente`, conserva su SHA en las evidencias y valida los datos servidos por HTTPS. El código de integración permanece en su rama y solo escribe el feed y las verificaciones en `feeds/google-merchant-ec`. No se importa un nuevo corte593 ni se aplican precios o existencias al catálogo.

El workflow se ejecuta al cambiar su código y queda preparado para ejecución manual. El schedule diario sigue **inactivo**: GitHub únicamente ejecuta schedules de la rama predeterminada y esta tarea prohíbe modificarla. No se confunde lectura automática de main durante una ejecución con actualización continua. Una programación autónoma sin cambiar main requiere un ejecutor independiente gratuito autorizado; no se ha creado ni contratado ninguno. No se fusiona el PR.

El XML queda en modo de validación con `excluded_destination` repetido para `Shopping_ads` y `Free_listings`. Importarlo no habilita estos artículos para esos destinos. No se retira la exclusión hasta comprobar la información comercial y contar con autorización de activación. Esto no desindexa ni controla el contenido del catálogo que Google pueda rastrear por otras vías.

El archivo `preconexion.json` documenta fecha de corte, coherencia de precios y stock, observaciones de compra/envíos/devoluciones y pasos pendientes de la cuenta. La referencia oficial confirma que los importes del corte incluyen IVA; no confirma stock actual ni que la compra final se cierre por ese precio. No se ha accedido a la cuenta Merchant Center.

## Comprobaciones antes de habilitar fichas gratuitas

1. Cuenta 5874003439: comprobar acceso, dominio `conectatech-ec.github.io` verificado y reclamado, empresa/contacto y destino Ecuador/español/USD. La existencia del archivo `google8bb019c7a5a192ed.html` no demuestra que esta cuenta ya tenga el dominio reclamado. Revisar estado de fichas gratuitas y diagnósticos en la cuenta; no confundir XML válido con aprobación.
2. Compra: la ficha revisada deriva a WhatsApp. Confirmar que la experiencia permite una compra directa que cumpla requisitos de Google, con precio y condiciones claros. No dar por habilitado un checkout online inexistente. No desarrollar ni modificar checkout en esta integración.
3. Precio final: confirmar que cualquier comprador del territorio atendido puede comprar por el precio contado enviado, impuestos/cargos obligatorios incluidos según corresponda, y que coincide al cerrar la compra. Comprobar condiciones del contado y otras formas de pago. No sustituirlo automáticamente por PVP ni inventar descuentos.
4. Stock: las fichas indican corte al 10/10/2026 y confirmación de disponibilidad. Verificar vigencia y frecuencia de actualización del maestro; el feed no consulta el inventario privado en vivo. Si la disponibilidad real no puede sostenerse, no habilitar esos artículos hasta confirmarla.
5. Envíos: la ficha menciona contraentrega en Quito y consulta de cobertura/costo. Obtener zonas, tarifas reales, manejo, tránsito y exclusiones. No asumir envío nacional a todo Ecuador ni envío gratuito. No se exporta `shipping` con ceros. Publicar y configurar los datos verdaderos cuando se autorice; no crear políticas en esta tarea.
6. Devoluciones: no se encontró una política completa en la ficha revisada. Preparar URL accesible con aceptación/rechazo de devoluciones, plazos, condiciones, procedimiento, costos y reembolso verdaderos; reflejarla en Merchant Center. No equiparar garantía a devoluciones ni inventar días.
7. Imágenes y producto: conservar fotos aprobadas; revisar metadatos IPTC requeridos por Google para imágenes creadas con IA cuando corresponda. La validación técnica de hash/tamaño no certifica propiedad intelectual, ausencia de falsificaciones ni todas las políticas de Google. Reservar los casos con identidad/autenticidad no resuelta.
8. Alta de fuente: Productos → fuentes de datos → archivo mediante URL (el nombre del menú puede variar), primero comprobar que el dominio está verificado y reclamado por la cuenta 5874003439; luego pegar la URL verificada del feed, seleccionar Ecuador/español/USD y revisar procesamiento manteniendo las exclusiones. No habilitar fichas gratuitas de estos artículos hasta cerrar los bloqueos. No habilitar Google Ads.

Referencias oficiales consultadas:

- [Especificación de datos de producto](https://support.google.com/merchants/answer/7052112?hl=es)
- [Precio](https://support.google.com/merchants/answer/6324371?hl=es)
- [Fichas gratuitas](https://support.google.com/merchants/answer/13889434?hl=es)
- [Requisitos editoriales y profesionales](https://support.google.com/merchants/answer/12079604?hl=es)
- [Políticas de devolución](https://support.google.com/merchants/answer/14011730?hl=es)

Ecuador admite español y USD según Google. No está en la lista general de países donde Google exige especificar tarifas mediante shipping para fichas gratuitas; aun así deben quedar claros los gastos y las condiciones reales de entrega antes de confirmar la compra. Una cuenta y un XML válidos no garantizan elegibilidad.

Siguiente paso de conexión: comprobar verificación y reclamación del dominio del catálogo dentro de Merchant Center 5874003439. Siguiente paso comercial: disponer de stock vigente y demostrar compra completa en el sitio; los enlaces de consulta por WhatsApp no lo acreditan. Contraentrega es admisible como método de pago, pero no sustituye el proceso de compra.
