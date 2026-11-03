# Contrato pendiente del Data Hub existente

El motor entregado registra **pedidos de prueba**. `mode: "production"` permanece cerrado incluso si se pasa un registro de prueba. No modificar esa guarda para activar compras.

La fuente de catálogo continúa siendo el corte validado que ya publica 593 en la web. `catalogo.mjs` usa el validador existente, títulos aprobados y lector fotográfico existente; no escribe ningún inventario, feed ni Data Hub. El archivo privado de pruebas conserva únicamente pedidos sintéticos. Las cantidades pendientes se calculan desde esos pedidos para probar concurrencia, sin guardar una segunda tabla de existencias.

La infraestructura previa se localizó en `correccion/datahub-integracion-segura-20261103`, `automatizacion/shared-hub.mjs`, `automatizacion/worker.mjs` y `automatizacion/schema.sql`. `/interesados` devuelve una solicitud pendiente, no reserva ni confirma un pedido. No se cambió ni desplegó ese Worker, ni se creó una base de datos.

Antes de sustituir el registro de pruebas, el adaptador del Data Hub debe ofrecer una operación privada y atómica, por ejemplo `reserveAndRecordAtomic({idempotencyKey, expectedSourceVersion, expectedTotalCents, items, deliveryId, payment, customer, consent})` con estas garantías:

- Releer stock vendible, precio fijo y transporte aprobado desde sus fuentes autorizadas en la misma transacción que registra la orden y su reserva. Considerar otras ventas y reservas del canal web; un corte histórico por sí solo no resuelve la concurrencia con la tienda física.
- Rechazar cambios de precio, fuente, tarifa, destino o stock antes de confirmar; devolver una nueva cotización al comprador. No cobrar ni incrementar el total silenciosamente.
- Deduplicar la clave y devolver el recibo anterior únicamente al mismo contenido/cliente. Una clave con contenido distinto debe fallar. No exponer búsquedas anónimas de pedidos.
- Confirmar éxito solo después de la persistencia durable; incluir ID, precio total aceptado, estado de pago y fecha/intervalo estimado de entrega. La contraentrega no se marca como pagada.
- Guardar pedidos en el sistema operativo existente, sin importar otro catálogo ni guardar inventario en una nueva base. La reserva debe formar parte de la fuente central, con cancelación/liberación y plazo definido por la operativa comercial.
- Aplicar HTTPS, control de abuso y cuotas, origen permitido, protección CSRF cuando se usen cookies, retención/privacidad y acceso administrativo adecuado. Ningún secreto privado del Worker se entrega al JavaScript público.

No hay endpoint ni transacción central de pedidos verificada disponible en esta entrega. Es trabajo técnico pendiente con el responsable del Data Hub, no una integración declarada operativa. La activación debe reutilizar la infraestructura actual, conservar costo adicional $0 y esperar la autorización de publicación.

La tarifa local de $2,90 y el intervalo que presenta `TEST_DELIVERIES` son fixtures rotulados de prueba; no fijan una zona ni un plazo comercial. El envío nacional de $6,90 requiere selección explícita de SKU aptos y condiciones de entrega; no inferir peso a partir del nombre. Transferencia permanece cerrada sin datos bancarios e instrucciones aprobados. Devoluciones, destino/ETA real y publicación siguen siendo requisitos independientes.
