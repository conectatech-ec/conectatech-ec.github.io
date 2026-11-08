# Conexión preparada al Data Hub, sin desplegar

Código ejecutable para recibir pedidos contraentrega en el **Worker existente** y el mismo Durable Object `MESSENGER_TEST_INBOX` / `messenger-development`. No se creó otro Worker, D1, binding, Data Hub ni inventario. La demostración local conserva sus pedidos de prueba.

Base exacta del parche: **acfc00763dfbc7ac34c2c62f9ccecea4f613c870**, revisión de código observada en `/health`. El parche incorpora únicamente los ganchos de checkout al Worker, el objeto de almacenamiento y el empaquetador de esa revisión. La revisión declarada por `/health` no acredita que el bundle activo carezca de cambios posteriores de alcance limitado.

## Conexión implementada

- `checkout-core.mjs`: validaciones compartidas con el motor local probado.
- `checkout-shared-source.mjs`: `readSharedHub(central)` existente más el mismo corte público validado de 593, con versión, precio y cantidad coherentes, solo en memoria.
- `checkout-edge.mjs`: HTTPS, CORS exacto para `https://conectatech-ec.github.io`, JSON limitado, cuotas y rutas administrativas privadas. No entrega tokens al navegador.
- `checkout-store.mjs`: cotizaciones y pedidos en SQLite existente, transacciones y claves únicas, contacto cifrado con `seal/unseal` existente, sin datos personales en recibos públicos ni logs.
- `checkout-entry.mjs`: importa los módulos reales del Data Hub. El parche añade ganchos en Worker, constructor y fetch del DO, y los seis módulos al empaquetador existente.

`checkout-config.mjs` permanece `enabled:false`, `deliveries:[]`, nacional deshabilitado. En ese estado no crea tablas. Faltan cobertura/códigos postales, SKU cubiertos, tarifa total, plazo y calendario de entrega aprobados. Los días de la semana y festivos se configuran expresamente; no se presume lunes a viernes. No usa $3,50 de una proforma particular como tarifa general de Quito ni convierte los fixtures en condiciones comerciales. Nacional y transferencia quedan fuera del MVP Quito; esto no modifica las políticas ya aprobadas para esos canales.

## Contrato con la web

| Ruta | Contrato |
|---|---|
| `GET /api/compra/catalogo` | `mode:datahub`, `enabled:true` solo con configuración completa; entregas con códigos postales. |
| `POST /api/compra/cotizacion` | `{items:[{sku,quantity}],deliveryId,payment:"cod",postalCode}`. Importes en centavos, total, fecha estimada y `quoteId`; rechaza precios enviados por cliente. |
| `POST /api/compra/pedidos` | `{quoteId,customer:{name,phone,email,city,address,postalCode},consent:true}` + `Idempotency-Key`. Recibo: `status:pedido_recibido_contraentrega`, `paymentStatus:pending_cod`, `liveOrder:true`, `paid:false`, `stockReservedIn593:false`. |
| `GET /api/compra/admin/pedidos` | Autenticación privada existente `PILOT_TOKEN`. No hay lectura pública de pedidos. |
| `POST /api/compra/admin/actualizar` | Misma autenticación; `{id,action,reference,sourceHash?}`, acciones `cancelar`, `conciliar_593`, `entregado`. |

El código postal verifica la zona declarada, no geocodifica la calle. El endpoint real y su URL en el cliente siguen sin desplegar/configurar.

## Cantidades y conciliación

Registrar el pedido **no reserva de forma nativa en 593**. Se relee el corte y se descuentan las cantidades de órdenes web pendientes, derivadas del registro de órdenes. Las ventas de tienda física entre cortes siguen dependiendo de la operativa existente; no se presenta stock en tiempo real como obligación adicional de Google.

Un corte nuevo no borra pendientes. `conciliar_593` exige un hash distinto al corte del pedido, generación acreditada posterior a la orden y una referencia de que el operador ya contabilizó la orden; entonces deja de descontarse una segunda vez. Esa acreditación es operativa: el reporte de existencias no contiene IDs de pedidos. Se guardan hash y referencia. La secuencia se verifica con generated_at de la fuente existente; se rechazan respuestas antiguas aunque nunca se hayan visto. Si sólo existe una cota de inicio del día de Quito, versiones distintas del mismo día quedan bloqueadas por orden temporal no acreditado. No se ordenan hashes ni se inventan versiones. `entregado` requiere conciliación previa. Cancelar libera solo la cantidad web pendiente; no escribe inventario 593.

No falta una supuesta API obligatoria de reserva para recibir pedidos. Falta **publicar el código dentro del Worker existente**, configurar cobertura/tarifa/plazo reales, conectar el cliente a su URL y verificar el recorrido HTTPS. Ninguna activación, envío de mensajes ni cambio de Merchant se realizó desde estos módulos.

## Límites y verificación

Cuotas del MVP: 1.000 solicitudes/día, 30 por cliente/hora, 30 pedidos/día y 300 pendientes. No sustituyen las cuotas compartidas de la cuenta Free. Contactos de órdenes cerradas se eliminan a los 30 días desde cierre al llegar la siguiente solicitud; las activas no se borran ni liberan automáticamente. Recibos operativos sin contacto se conservan. No se añade cron ni servicio pagado.

`node --test compra/tests/*.test.mjs` incluye SQLite real (`node:sqlite`), cifrado real, persistencia tras reinicio, concurrencia, fallo real de INSERT, cobertura/origen, cuotas, cambio de corte y conciliación. Son verificaciones locales, no pruebas ejecutadas en Cloudflare ni aprobación de Google.

```sh
node compra/servidor/preparar-integracion.mjs --prepare
node compra/servidor/preparar-integracion.mjs --check /ruta/a/rama-independiente-datahub
```

El parche y manifiesto SHA son revisables. `--check` rechaza cambios concurrentes en Worker, DO o empaquetador. `--apply-local` solo escribe en rama independiente que supere hashes y no contenga módulos checkout; no hace commit/push/deploy ni admite main. Preparación siempre deshabilitada. No se ha ejecutado sobre la rama operativa.

Referencia técnica contrastada: [Cloudflare SQLite Durable Objects: SQL y transactionSync](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/). Las transacciones de producción usan transactionSync; BEGIN/COMMIT solo aparecen en el adaptador de pruebas Node SQLite.

## Prueba de compatibilidad con el corte real del piloto

Se ejecutó localmente `readSharedHub` y el lector de checkout del PR, usando los módulos y la base compilada de la rama operativa `c92ed56` y los archivos reales de `main` en `9f702e4`: puntero, corte del 06/11 y presentación del catálogo. Se sirvieron copias exactas al lector mediante un transporte local, sin escribir datos comerciales.

El lector reconoció el corte y la presentación. La base compilada del 21/10 contiene 1.556 SKU. De estos, 375 no están en el corte web y los otros 1.181 carecen de verificación de identidad aceptada para ese hash. El corte web no aporta `source_name` y el Worker no tiene una atestación aplicable para esas identidades en el corte probado. El checkout devolvió `CHECKOUT_SOURCE_EMPTY`. Este resultado describe la combinación de artefactos de GitHub ensayada. El empaquetador puede conservar una fuente privada vigente distinta, que aún debe verificarse en el Worker real.

Usar la actualización de fuente existente del Data Hub, con el reporte 593 verificado y su evidencia de identidad, o acreditar que la fuente privada vigente ya coincide. Repetir el cruce con los 307 candidatos y comprobar catálogo, cotización, pedido sintético y lectura administrativa en una prueba HTTPS autorizada. Conservar el bloqueo de identidad y no utilizar la presentación web como sustituto de 593. La compatibilidad sintáctica del parche y las pruebas SQLite no cierran este punto.

## Reproducción HTTPS aislada con el corte del 06/11

Se recuperó la revisión de 593 de las 20:59 de Quito. Los 1.199 SKU del corte público coincidieron con esa revisión en stock y precios. El conector entregó una transcripción, por lo que queda pendiente comprobar el hash binario del XLSX original. En una copia local se incorporó únicamente el nombre original de las filas coincidentes. Con la base compilada del 21/10 y los controles intactos, el lector admitió 957 SKU (923 con stock). De los 307 candidatos, 276 pasaron el cruce y 31 quedaron bloqueados: 18 ausentes en esa base, 11 con `web.price_matches=false` y 2 con diferencia de identidad.

```sh
node compra/tests/ensayo-https.mjs SNAPSHOT LLAVE_TLS CERT_TLS MODULO_CIFRADO SKU
```

El snapshot es la salida local de `readCheckoutSource`. El certificado local debe incluir 127.0.0.1 y el módulo debe exportar el cifrado `seal/unseal` del Worker. Con ADAP004 se verificaron catálogo y cotización (200), confirmación (201), consulta sin autorización (401), consulta autorizada después de reabrir SQLite (200) y reintento idempotente. El ensayo usa TLS de loopback, envío sintético y almacenamiento desechable. No cambia la fuente, las tarifas ni la configuración activa.

Para cerrar la prueba contra el Worker existente, falta contrastar la fecha y el hash de la fuente privada mediante el GET autenticado de catálogo ya disponible. Si está desactualizada, preparar la normalización 593 existente en una rama independiente con el XLSX exacto y verificar de nuevo las 31 exclusiones antes de considerar la activación.

## Prueba aislada sobre el código de la revisión en servicio

Se aplicó el parche sobre una rama temporal del código `acfc0076`. El ensayo HTTPS pasó por `worker.fetch`, el binding simulado y la clase real `MessengerTestInbox` con SQLite en disco. Solo en esa copia se activó una zona sintética y se interceptaron las tres lecturas web del corte del 06/11. Con ADAP004 se obtuvieron catálogo y cotización 200, confirmación 201, consulta sin clave 401 y consulta autorizada 200 tras reabrir SQLite. El reintento devolvió el mismo recibo y quedó una sola fila de pedido. El parche del PR sigue con el checkout deshabilitado.

Antes de cualquier despliegue, usar la inspección autenticada existente para contrastar el bundle y sus ajustes activos y leer `GET /commercial/catalog/status`. Registrar únicamente metadatos de fuente y revisión. Comparar los módulos afectados contra el manifiesto y conservar cualquier módulo o ajuste activo adicional. La prueba local no valida el bundle privado actual ni autoriza un despliegue completo con la copia de GitHub.

## Conciliación incremental con PR #364

CHIP001, CHIP002, CHIP004 y JUGU142 tienen portada autorizada en el PR #364. Los bytes HTTP de sus cuatro URL coinciden con los SHA-256 documentados allí. La presentación pública del corte ensayado traía `approved_media: null` para esos SKU. Al añadir únicamente esas cuatro portadas a una copia aislada de la presentación, el lector existente admitió los cuatro y conservó los 918 disponibles ya conciliados. Resultado del ensayo ampliado: 922 de 958 disponibles. Queda incorporar esas excepciones por SKU en el exportador existente con sus controles de evidencia y hash. No se modificaron el exportador ni sus salidas públicas en esta prueba. Los otros 36 siguen bloqueados (18 por ausencia de la base ensayada, 15 por marca previa de precio y 3 por identidad).

La inspección autenticada de Actions [41731714022](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/41731714022/job/126250486996) es histórica y omite fecha y huella de la fuente. La comprobación actual requiere el transporte existente `privateRequest` de `automatizacion/central-http.mjs`, ejecutado donde ya está inyectado `PILOT_TOKEN`, con `GET /commercial/catalog/status` y `GET /health`. Registrar solo `cut_date`, `generated_at`, `source_sha256`, `current` y `release`, distinguiendo el hash del reporte de la revisión del Worker. El acceso protegido no está disponible en la sesión que hizo este ensayo. No usar un flujo de despliegue para obtener esos metadatos.

## Preparación de la presentación y del piloto

El exportador reconoce las cuatro portadas selladas del PR #364 por SKU y hash exacto, usando el registro de excepciones y la confirmación del propietario. Se siguen comprobando el enlace del CSV, la revisión visual y los hashes del original y sus variantes. La excepción no cambia los CSV, los datos 593 ni los criterios de identidad del checkout.

Para los 36 pendientes, validar primero las 18 ausencias y las 15 marcas de precio contra el catálogo privado vigente. Para las tres diferencias de identidad, exigir evidencia vinculada al corte antes de considerar el SKU. Mantenerlos fuera de la compra mientras no pasen los controles.

Piloto de contraentrega desde Multicentro: tarifa propuesta de USD 5 solo en la zona y los turnos confirmados por el repartidor. Incorporar códigos postales, días de reparto y plazo máximo cuando haya confirmación. Mantener la configuración de entrega vacía y deshabilitada mientras tanto. Dirección General aprobó el máximo operativo de siete días calendario para reembolsos procedentes, sujeto a verificar capacidad de acreditación y respetar plazos obligatorios menores.
