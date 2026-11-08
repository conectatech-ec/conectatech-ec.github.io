# Compra directa — preparación del 3 de noviembre de 2026

Rama `merchant/compra-directa-20261103`, base `5131e09133336a996c810cb68fcdcfc9ebd08204`. No publicar ni habilitar destinos de Merchant desde esta entrega. Costo adicional autorizado $0.

## Alcance ejecutado

- Flujo en `/compra/`: catálogo existente, cantidades, entrega, pago, total revisado antes de confirmar, registro durable de un pedido sintético y comprobante. WhatsApp es ayuda opcional.
- Lee 1198 SKU del catálogo y el corte validado593 de 02/11, sin regenerar ni aplicar inventario. Nombres y fotografías pasan por lectores ya existentes. No hay nuevo inventario, Data Hub ni servicio contratado.
- `preview.mjs` integra temporalmente el botón de compra en fichas existentes, conservando sus URL, imágenes y precios. El generador incorpora el mismo gancho, deshabilitado por defecto en `config.json`; devuelve HTML idéntico cuando está apagado.
- Pedidos de prueba fuera del repositorio y de la superficie estática. Registro atómico, deduplicación, rechazo de sobreventa dentro de las pruebas, precio y fuente revalidados. Nunca registra pago realizado.
- Etapa inicial: únicamente Quito con contraentrega. Nacional y transferencia permanecen deshabilitados, sin bloquear la preparación del MVP local. Contraentrega es el método probado. Transferencia queda deshabilitada sin cuenta e instrucciones comerciales verificadas. No se conectó Google Ads.
- Parte de `politicas/` y `cambios-devoluciones-garantias/` de `revision/politica-garantias-20261016` (87d7a9937b7a938bb69ae2c4a99a39bd0010cb61). Mantiene plazos comerciales y los derechos legales separados; no inventa costos, reembolsos ni plazos operativos. La revisión del 03/11 completa la razón social y la aceptación de devolución por error de tienda, e incorpora envíos/pagos en la misma fuente `politica.json`. La etiqueta pendiente de aprobación se conserva porque falta cerrar la operativa. La nueva página `/compra/envios-pagos.html` se enlaza desde entrega, aceptación de condiciones y pie de compra.

## Ejecutar sin producción

Node24, sin instalación de dependencias. `npm run dev` inicia solo el servidor de QA. En Work usar `sites-preview start RUTA_ABSOLUTA`, que administra el servidor. `npm run test:compra` y `npm run test:politicas` ejecutan controles existentes y nuevos.

El servidor sirve únicamente el catálogo, recursos públicos y las páginas de prueba. Nunca sirve `.git`, código de servidor, configuración ni registros. Usa datos ficticios. En la demostración actual la tarifa Quito $3.50 y ETA1–4 días son fixtures explícitos, no una zona o promesa aprobada. No trasladarlos a Merchant ni producción. El corte no es stock en tiempo real.

## Conexión técnica indispensable

El Data Hub existente está en `correccion/datahub-integracion-segura-20261103` (169f3832032afd02d27ccd3bb7bad54d3fa4c4c0). Su `/interesados` solo guarda solicitudes pendientes cuando hay DB; no confirma ventas ni reserva existencias. No se modificó su Worker ni se creó almacenamiento cloud.

La transacción y los ganchos preparados están descritos en `servidor/INTEGRACION-DATAHUB.md`. La conexión ejecutable al mismo Worker y Durable Object está preparada en `servidor/checkout-*.mjs`, con parche verificado contra la rama operativa74729149. Registra pedidos COD durables/cifrados, deduplica y deriva cantidades pendientes sin crear inventario. No se ha aplicado ni desplegado. La conciliación con593 se acredita mediante referencia operativa; no se promete reserva nativa ni tiempo real. Faltan configuración comercial real y comprobación HTTPS posterior a autorización de publicación.

## Condiciones recuperadas, sin volver a solicitarlas

- Responsable: **VELASCO VALDERRAMA JOSE RAFAEL**, razón social indicada para 593 el 26/08 y corroborada en el contexto comercial del 16/10. No se añaden RUC ni números bancarios al repositorio.
- Servientrega nacional: **$6.90**, pago anticipado de producto + envío y plazo informado **1–3 días hábiles** (propietario, 17/10/2026 01:40 y 01:46 UTC). A las 01:50 indicó dejar inicialmente $6.90 para todos los productos y asumir cualquier sobrecosto. Se conserva como regla comercial inicial, incluso para pesados: ya no se pide una nueva lista de SKU elegibles ni se carga el excedente al cliente. Una modificación futura no altera pedidos confirmados.
- Quito: contraentrega. Se recuperó un cobro de **$3.50 IVA incluido** al cliente (01/10/2026 19:44:08UTC), con transportista$5, referido a una proforma particular; no es una tarifa general autorizada. El rango posterior $2.90 a $25/$30 tampoco define zonas. La configuración operativa sigue vacía hasta fijar cobertura y plazo.
- Transferencia/depósito anticipado antes del despacho: presente en la pieza comercial existente de envíos nacionales. No se recuperó una instrucción bancaria completa; los planes de tarjeta de Alex no son datos de una cuenta receptora. No se traslada la promoción de tarjetas de octubre a noviembre ni se incorpora una pasarela.
- Aprobación expresa03/11: celulares y tablets, 1 año; accesorios y demás productos, 30 días, por defectos de fabricación y funcionamiento en condiciones normales de uso. Sin cambios ni devoluciones voluntarias por preferencias personales. Redacción aprobada, operativa y publicación pendientes. Devolución aceptada si el error es de la tienda. Derechos legales conservados por separado.

Estos datos se guardan en `politicas/politica.json`; `node politicas/construir.mjs` genera las páginas de revisión. No configuran automáticamente rutas operativas ni habilitan pagos. La tarifa del fixture sigue siendo sintética.

## Decisiones comerciales realmente pendientes

1. **Entrega:** zonas/tarifas exactas y plazo Quito. Para Quito falta el calendario que permita calcular fecha estimada. Nacional queda preparado y deshabilitado; sus pendientes no se piden para comenzar Quito.
2. **Devoluciones:** recibir en local, por envío o ambos; quién paga el retorno cuando no corresponde asumirlo a la tienda; existencia o ausencia de cargo de reposición; medio y máximo operativo de reembolso. Los derechos y gastos legalmente exigibles no quedan sujetos a una decisión comercial. No se pregunta nuevamente por garantías, aceptación por error ni razón social.
La primera fase Quito usa contraentrega: no pide datos bancarios, contratación ni pasarela. Las instrucciones bancarias sólo se completarán cuando se autorice avanzar con nacional.

La conexión DataHub está codificada y probada localmente. Aplicación del parche, despliegue HTTPS, configuración de cobertura y verificación pública siguen pendientes; no se presentan como hechos.

## Merchant Center: puerta de activación

Cuenta5874003439; fuente10791678121. El XML existente descargado el03/11 contiene370 productos, SHA256 `dd9e188add0555910ca703a9aa223019f3882bccacf4a61a71bf9fa9e9d1fb84`. Conserva exclusiones `Shopping_ads` y `Free_listings`. No se revalidó ni regeneró el feed.

**Recepción acreditada en Merchant el03/11:** última actualización03/11/2026 10:00AM,370 productos actualizados,5 nuevos, todos los atributos reconocidos y archivo sin errores. Se recuperó la sesión del navegador Work; no fue necesario forzar otra actualización ni crear otra fuente. Diagnósticos: ninguna incidencia de productos y «No issues for you to fix» en problemas de configuración/políticas de cuenta. Esto no constituye habilitación ni aprobación de fichas gratuitas.

Evidencia directa: https://merchants.google.com/mc/products/sources/detail?a=5874003439&afmDataSourceId=10791678121&tab=processing&hl=en . El servicio de envío existente indicaba1–4 días; no se modifica hasta mapear correctamente el plazo comercial1–3 a preparación y tránsito. Devoluciones sigue sin enviarse: requiere URL pública real y campos completos.

Antes de solicitar activación: compra real completa y persistida, precio y disponibilidad coherentes, total y ETA reales, política pública y coherente, dominio verificado y cobertura real. La política en la web es requerida; configurarla también en Merchant es recomendado y no justifica inventar un equivalente numérico de términos legales. Solo tras autorización de publicación y verificación HTTPS se retira exclusivamente la exclusión Free_listings de productos realmente aptos. Mantener Shopping_ads excluido. Ecuador no aparecía disponible para fichas gratuitas locales en la comprobación previa; no activar anuncios locales como sustituto.

Google admite contraentrega, facturación o pago al recoger: https://support.google.com/merchants/answer/10249082?hl=es . No se encontró confirmación explícita equivalente para transferencia bancaria en la documentación revisada; no se declara aceptación garantizada. Requisitos de sitio: https://support.google.com/merchants/answer/12160471?hl=es . Devoluciones: https://support.google.com/merchants/answer/14011730?hl=es . Revisión03/11/2026. La conformidad técnica no garantiza aprobación de Google.

Revisión de política final03/11: página breve en cuatro apartados, sin cortesías, plazos voluntarios ni cargos nuevos. Se mantienen el término legal15 días y garantías1año/30días; faltan medios de recepción, gastos reales y método/plazo de reembolso. No se crean documentos adicionales.

Continuidad06/11: estructura de políticas aprobada. Texto comercial exacto en `/garantias/` y condiciones en la URL independiente existente, enlazadas en el pie. Plazo de reembolso propuesto7 días, pendiente de aprobación; propuesta30 rechazada. El cómputo de15 términos legales no tiene equivalencia numérica confirmada. Cuenta Merchant pendiente de nueva sesión empresarial. La integración Data Hub se vuelve a verificar sobrec92ed56ca378e950babbb38d078d29f442ff78c9, conservando los cambios SIGNATURE existentes.
