# Checkout de PR #313 integrado en la rama piloto

Alcance: código preparado, compra deshabilitada, sin despliegue. Rama de destino:
`automatizacion/piloto-cloud-3sku-20261015`.

## Identidad y cambio exacto

- Origen aprobado: PR #313, commit `e088cac0e316a768604c7fcd9e8d5cb6e52b99c9`.
- Base piloto: `53827d778c7731273d29ccc2891d6a06d41456f1`.
- Seis módulos `checkout-*.mjs` copiados **sin cambiar un byte** desde
  `compra/servidor/` a `automatizacion/`: config, core, edge, shared-source, store y entry.
- `worker.mjs`: importar entry; delegar rutas de compra; delegar administración
  solamente después de la autenticación existente del propietario.
- `messenger-store.mjs`: importar entry; inicializar checkout en el objeto existente;
  delegar `/web-checkout/`. Se conservan constructor, limpieza, alarmas y servicios previos.
- `deploy_free.py`: añadir únicamente los seis módulos a la lista de empaquetado.
  Esto no autoriza ni ejecuta el desplegador.

Los SHA-256 anteriores y posteriores, las sustituciones exactas y los archivos
protegidos figuran en `checkout-integration.json`. El cambio de runtime comprende
**seis módulos nuevos y dos módulos con ganchos**, sin sustituir los módulos
del receptor ni la fuente privada. Los módulos nuevos suman 28.181 bytes.
Las comprobaciones y este documento no forman parte del bundle del Worker.

Se adaptaron los ganchos del generador de PR #313 sobre la base piloto vigente;
no se sustituyeron worker, store o empaquetador por sus versiones antiguas.
No se incorporaron el frontend, las políticas ni los demás cambios de PR #313.
PR #313 permanece independiente y main no se modifica.

## Controles conservados

`CHECKOUT_CONFIG.enabled:false`, `deliveries:[]`, `activar:false` y
`datahub_scoped_content_enabled:false`. No hay cobertura o tarifas aprobadas
inventadas. La configuración cerrada devuelve 503 en compra y no crea tablas
checkout. Las consultas de pedidos siguen requiriendo autenticación: 401 sin ella.

Se reutilizan `MESSENGER_TEST_INBOX`, clase `MessengerTestInbox`, objeto
`messenger-development`, el lector compartido del Data Hub y el cifrado existente.
No se crean bindings, Worker, Durable Object, base, cron, workflow o servicio nuevos.

Se mantienen precios en centavos procedentes de la fuente, comprobación de stock
al cotizar y confirmar, transacción SQLite, claves únicas para pedido y cotización,
HMAC de cliente, cifrado de contacto, revalidación del corte, caducidad, cuotas,
conciliación 593 explícita y rechazo de identidades aisladas. Un pedido web no
reserva inventario en Sistema 593 ni acredita un pago o una entrega.

No cambia ningún archivo de fuentes, aprobaciones, precios, stock, imágenes o
políticas. Se conserva la protección existente de los 922 SKU conciliados y 36
aislados; este cambio no los reclasifica ni vuelve a aprobarlos. No se consulta ni
se repite la ingestión ya completada.

## Comprobaciones efectivas

```sh
node --test automatizacion/tests/worker.test.mjs automatizacion/tests/messenger.test.mjs automatizacion/tests/alex-signature-store.test.mjs automatizacion/tests/checkout-datahub-sqlite.test.mjs automatizacion/tests/checkout-pilot-integration.test.mjs
python automatizacion/tests/deploy_test.py
```

Resultado: **55 pruebas Node y 16 Python aprobadas**. Se reutilizan las 17 pruebas
SQLite de PR #313 cambiando solamente sus imports al código realmente integrado.
Las tres comprobaciones de integración cubren identidad/reversión exacta, cierre
del Worker y un ensayo HTTPS local completo. Las demás pruebas corresponden a los
ganchos afectados del Worker, Messenger, almacenamiento SIGNATURE y empaquetador.

El ensayo ejecuta los módulos reales Worker → Durable Object → lector Data Hub →
AES → SQLite en una copia temporal. Sólo esa copia recibe configuración habilitada,
zona, precios y productos sintéticos. Todo fetch externo se intercepta y admite
únicamente lecturas de fixtures; el HTTPS escucha exclusivamente en 127.0.0.1.

- Catálogo y cotización: 200; confirmación: 201; consulta autenticada: 200.
- Consulta sin autorización: 401; SKU aislado ausente del catálogo.
- Dos unidades de 250 centavos + entrega sintética de 290 = 790 centavos.
- Pedido cifrado conservado después de cerrar/reabrir SQLite.
- Misma confirmación tras reinicio: mismo recibo y exactamente un pedido.
- Registro sintético del receptor conservado sin cambios.
- Cero escrituras remotas; configuración real del repositorio sigue cerrada.

La prueba acredita integración del código y persistencia local real. **No es una
prueba del Worker remoto ni una aprobación de condiciones comerciales.**

## Instalación concreta pendiente de autorización

La única intervención técnica pendiente es instalar este delta inactivo en el
Worker piloto existente `conectatech-comercial-piloto`. No se ha intentado.
La autorización debe limitarse a los seis módulos y los ganchos de worker/store
enumerados en el manifiesto, con máximo un PUT de instalación y recuperación
específica condicionada. No incluye habilitar compra, fuentes, ingestión o campañas.

Se reutilizarían el transporte `CFClient`, captura `Bundle/Part`, comparación
`same_bundle`/`same_json`, codificación multipart y comprobaciones del actualizador
acotado existente. Los permisos de ingestión/instalación anteriores no se reutilizan.
Su autorización específica actual de `central-data.mjs` o receptor **no comprende
checkout**; no se amplía ni se activa ese control con este cambio.

Procedimiento delimitado para la autorización de instalación:

1. Capturar en memoria contenido, metadatos, configuración y estado del Worker;
   conservar respaldo privado de recuperación y sus hashes. Verificar plan gratuito
   y límites del bundle, ausencia de otra operación y banderas cerradas.
2. Construir el candidato desde esa captura: copiar los seis artefactos identificados
   y aplicar exclusivamente los ganchos del manifiesto a worker/store **activos**.
   Adaptar sólo el import de catálogo al formato compilado `./catalog.mjs` al usar
   el bundle remoto. No cargar íntegramente el worker piloto sobre otro worker vivo.
   Exigir anclas únicas, checkout ausente y correspondencia inversa exacta.
3. Conservar cada byte de los demás módulos, incluido `central-data.mjs`, el receptor
   instalado y sus marcas. Conservar entrypoint, settings, permisos, bindings,
   rutas y estado comercial. No hay migración ni borrado: checkout deshabilitado
   no crea tablas. Si la forma del bundle es incompatible, detenerse sin escribir.
4. Volver a leer inmediatamente antes del PUT; exigir igualdad completa con el
   respaldo y configuración. Un máximo de un intento, sin reintento de escritura.
   No ejecutar `deploy_free.py`, sincronización de secretos ni workflows de
   despliegue existentes para instalar este delta.
5. Leer y comparar bundle y settings posteriores: delta exacto de ocho módulos,
   fuente y receptor intactos, `/health` y servicios previos, compra cerrada 503,
   administración sin token 401. Cualquier discrepancia detiene la operación.

**Reversión específica:** sólo con el candidato instalado y configuración íntegros,
sin cambios concurrentes, retirar los seis módulos añadidos y aplicar la inversa
de los ganchos sobre worker/store. Comparar el resultado byte por byte con sus
dos módulos respaldados y conservar todos los demás módulos/datos actuales.
Releer antes de escribir y verificar después. Si no hay correspondencia exacta,
detenerse. No rollback global, restauración de inventario, borrado de pedidos ni
reutilización de una autorización consumida.

La integración Git usa `[skip ci]` en el commit y la fusión para evitar los workflows
automáticos que observan worker.mjs. No cambia workflows o banderas ni suspende
Sincronización multicanal 593. No se ejecuta ninguna GitHub Action por esta tarea.
Costo adicional de esta preparación y pruebas locales: **$0**, sin Ads.
