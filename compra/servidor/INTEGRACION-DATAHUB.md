# Conexión preparada al Data Hub, sin desplegar

Código ejecutable para recibir pedidos contraentrega en el **Worker existente** y el mismo Durable Object `MESSENGER_TEST_INBOX` / `messenger-development`. No se creó otro Worker, D1, binding, Data Hub ni inventario. La demostración local conserva sus pedidos de prueba.

Base exacta del parche: `automatizacion/piloto-cloud-3sku-20261015`, SHA **747291490f6cd836ec06d14dcb252e53a8a5e02d**, observado el 03/11/2026. Conserva los cambios actuales de Alex; no sustituye el Worker por la rama de corrección anterior.

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
