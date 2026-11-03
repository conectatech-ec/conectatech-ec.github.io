AVANCE — RED COMERCIAL CONECTATECH

**Resultado: ensayo local parcial; activación bloqueada por evidencia real.** Rafa/COL001 es el único activo existente; COL002 reservado e inactivo; capacidad 10. Cero publicaciones, mensajes externos, ventas registradas en 593 o comisiones. Main, producción y las otras ramas intactas.

| Tramo probado | Resultado |
|---|---|
| Anuncio existente de Rafa → consulta local → COL001 | Referencia firmada y aislamiento comprobados; no se duplica Work |
| Biblioteca SIGNATURE real | Manifiesto y PNG leídos; entrega bloqueada: corte anterior, SHA diferente y no-enviar activo |
| ALEX existente | Motor generateAlex probado localmente, respuesta de respaldo; sin inferencia pagada ni envío. Permisos actuales del canal no releídos |
| Venta 593 → atribución | Bloqueado: falta lector acreditado de ventas confirmadas y comprobante real correlacionado. No se sustituyó con una venta ficticia |

[Resultado del ensayo](pilot/integration-result.json). Los archivos reales de Drive y del Hub se capturaron mediante lectores autorizados y se reprodujeron localmente con el motor existente; no es una prueba de entrega en Meta ni de una venta real. Solo el ensayo de consulta usa memoria efímera. Los dobles de ventas de las pruebas unitarias no salen de esas pruebas. La generación de validate:pilot ahora registra **cero ventas de control**.

**Cambios mínimos para activar, todavía NO aplicados:**

1. La Fábrica debe reconciliar el manifiesto existente con el corte vigente y el SHA del banner actual de TELF017, revisar el material y resolver su bloqueo de entrega. No basta cambiar un SHA o una bandera. No se actualizó ese archivo compartido.
2. Enlazar readConfirmed593Sale(id) a una fuente de ventas real de 593, autorizada y sin costo, mediante el host existente. La interfaz normalizada del consumidor exige {id,status:'CONFIRMADA',currency:'USD',totalCents,evidenceDigest,lines:[{sku,quantity,amountCents}]}. Es un contrato interno del piloto, **no una API oficial de 593 descubierta**. Faltan ese binding y un comprobante real con evidencia de atribución a Rafa; no faltan rutas del inventario.
3. Montar wireExistingHost() en el host existente con su autenticación, env.DB/eventos_canal, cifrado y lectores; conectar signatureLibraryReaders a los accesos ya autorizados de la biblioteca. Validar identidad individual, ruta de referencias y permiso del canal ALEX. Mantener ownerAuthorizedPilotWrites:false hasta aprobación del despliegue.

El lector SIGNATURE usa el formato real de prototipos/banners-pro-movil/Code.gs en codex/banners-pro-publico-20261027, mediante BANNERS_PRO_CONFIG.manifestId y carpetas existentes. Revalida bytes, aprobación, precios, vigencia, carpeta y versión; no exporta enlaces/IDs privados. El validador de ventas solo lee, descarta datos personales y rechaza pendientes/anuladas. preview-sale no escribe; confirm-sale vuelve a leer la fuente. Comisiones siguen nulas.

Pruebas: npm test (52 Node + 3 Python), npm run check, npm run validate:pilot. Abrir pilot/validacion.html desde archivos descargados. Para repetir el ensayo con lectores del host: npm run verify:integration -- --host-module /ruta/local/lectores-existentes.mjs --require-ready; devuelve código 2 mientras haya bloqueos. Sin lectores devuelve bloqueo explícito. No se versionan entradas privadas ni credenciales. No desplegar el Worker ni ejecutar las migraciones D1 de la propuesta histórica.
