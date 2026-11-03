# Compra directa — preparación del 3 de noviembre de 2026

Rama `merchant/compra-directa-20261103`, base `5131e09133336a996c810cb68fcdcfc9ebd08204`. No publicar ni habilitar destinos de Merchant desde esta entrega. Costo adicional autorizado $0.

## Alcance ejecutado

- Flujo en `/compra/`: catálogo existente, cantidades, entrega, pago, total revisado antes de confirmar, registro durable de un pedido sintético y comprobante. WhatsApp es ayuda opcional.
- Lee 1198 SKU del catálogo y el corte validado593 de 02/11, sin regenerar ni aplicar inventario. Nombres y fotografías pasan por lectores ya existentes. No hay nuevo inventario, Data Hub ni servicio contratado.
- `preview.mjs` integra temporalmente el botón de compra en fichas existentes, conservando sus URL, imágenes y precios. El generador incorpora el mismo gancho, deshabilitado por defecto en `config.json`; devuelve HTML idéntico cuando está apagado.
- Pedidos de prueba fuera del repositorio y de la superficie estática. Registro atómico, deduplicación, rechazo de sobreventa dentro de las pruebas, precio y fuente revalidados. Nunca registra pago realizado.
- Contraentrega es el método probado. Transferencia queda deshabilitada sin cuenta e instrucciones comerciales verificadas. No se conectó Google Ads.
- Reutiliza íntegros `politicas/` y `cambios-devoluciones-garantias/` de `revision/politica-garantias-20261016` (87d7a9937b7a938bb69ae2c4a99a39bd0010cb61). Mantiene plazos comerciales y los derechos legales separados; no inventa costos, reembolsos ni plazos operativos. La etiqueta pendiente de aprobación original se conserva porque faltan esos campos.

## Ejecutar sin producción

Node24, sin instalación de dependencias. `npm run dev` inicia solo el servidor de QA. En Work usar `sites-preview start RUTA_ABSOLUTA`, que administra el servidor. `npm run test:compra` y `npm run test:politicas` ejecutan controles existentes y nuevos.

El servidor sirve únicamente el catálogo, recursos públicos y las páginas de prueba. Nunca sirve `.git`, código de servidor, configuración ni registros. Usa datos ficticios. En la demostración la tarifa Quito $2.90 y ETA 1–4 días son fixtures explícitos, no una zona o promesa aprobada. No trasladarlos a Merchant ni producción. El corte no es stock en tiempo real.

## Conexión técnica indispensable

El Data Hub existente está en `correccion/datahub-integracion-segura-20261103` (169f3832032afd02d27ccd3bb7bad54d3fa4c4c0). Su `/interesados` solo guarda solicitudes pendientes cuando hay DB; no confirma ventas ni reserva existencias. No se modificó su Worker ni se creó almacenamiento cloud.

Implementar la transacción descrita en `servidor/INTEGRACION-DATAHUB.md` dentro de la infraestructura existente antes de permitir pedidos reales. El motor de prueba está deliberadamente cerrado para modo producción. No basta cambiar una bandera. Faltan persistencia operativa autorizada, reserva coordinada con tienda física, HTTPS y control de acceso/abuso. La prueba local no acredita esos requisitos.

## Datos comerciales aún necesarios

1. Zonas/tarifas exactas y plazo de entrega Quito; SKU aptos para tarifa nacional $6.90 y tratamiento explícito de bultos pesados. Sin tarifa determinada no hay confirmación.
2. Datos bancarios comerciales e instrucciones para transferencia, si se ofrecerá; contraentrega puede ser el primer método porque Google la enumera expresamente.
3. Operativa de devoluciones: recepción en local/por envío, quién paga sin error de tienda, cargo de reposición (o ninguno), medio y plazo real de reembolso. Identidad legal del responsable y aviso de datos de pedidos.

## Merchant Center: puerta de activación

Cuenta5874003439; fuente10791678121. El XML existente descargado el03/11 contiene370 productos, SHA256 `dd9e188add0555910ca703a9aa223019f3882bccacf4a61a71bf9fa9e9d1fb84`. Conserva exclusiones `Shopping_ads` y `Free_listings`. No se revalidó ni regeneró el feed.

La recepción de370 en Google está pendiente: el navegador mostró la cuenta cerrada. No confundir el archivo de370 con una importación acreditada. Recuperar la sesión y actualizar/verificar la fuente existente; no crear otra.

Antes de solicitar activación: compra real completa y persistida, stock/precio firmes, total y ETA reales, política pública y coherente, devolución configurada sin datos inventados, origen/dominio verificado, últimos diagnósticos. Solo tras autorización de publicación y verificación HTTPS se retira exclusivamente la exclusión Free_listings de productos realmente aptos. Mantener Shopping_ads excluido. Ecuador no aparecía disponible para fichas gratuitas locales en la comprobación previa; no activar anuncios locales como sustituto.

Google admite contraentrega, facturación o pago al recoger: https://support.google.com/merchants/answer/10249082?hl=es . No se encontró confirmación explícita equivalente para transferencia bancaria en la documentación revisada; no se declara aceptación garantizada. Requisitos de sitio: https://support.google.com/merchants/answer/12160471?hl=es . Devoluciones: https://support.google.com/merchants/answer/14011730?hl=es . Revisión03/11/2026. La conformidad técnica no garantiza aprobación de Google.
