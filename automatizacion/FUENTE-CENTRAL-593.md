# CONECTATECH — fuente central comercial 593

La fuente normalizada es [central/current.json](central/current.json). Usa una sola política de normalización y seis adaptadores; no sustituye feeds, catálogo, fábrica de imágenes ni catálogos PDF en producción. Solo Alex del Worker piloto está conectado ahora.

## Corte importado y comparación

Reporte recibido: `Reporte-Inventario 21-10-2026.xlsx`, SHA-256 `84568d5865cb0f09380d200e6d08172a8820d4aaec5c970c0f7be53e3c68ffc8`. Generado por el reporte a las 19:25:22 de Quito del 21 de octubre (00:25:22 UTC del 22). La fecha de publicación se registra aparte y nunca renueva la vigencia. Caduca a las 19:25:22 de Quito del 22 de octubre si no llega otro corte validado.

1.554 SKU únicos: 1.553 productos y un servicio; sin duplicados. 1.140 productos disponibles y no conflictivos; 409 productos sin disponibilidad y no conflictivos. Se excluyen cinco registros del reporte: POWE014 por stock negativo; FLAS024 y FLAS026 por cambio Exodia/DataTraveler; MOUS010 por cambio inalámbrico/alámbrico; ENVI001 por ser servicio. No se pide confirmación manual de los demás productos.

El corte del 16 no se encontró en los adjuntos accesibles, el repositorio ni las cuentas Drive conectadas. No se inventa esa comparación. Contra la fuente publicada del 10: siete SKU nuevos (ADAP100, ADAP101, CABL173, CARG071, DISC010, FLAS040, PARL045), dos ausentes (AUDI078, HUB003; no se afirma descontinuación), 100 modificados, cuatro precios contado y siete PVP distintos. La comparación separada con el feed del 21 a las 23:46 UTC detecta cuatro contado y cinco PVP distintos. El informe conserva el commit de la referencia comparada.

[Informe de diferencias y bloqueos](generated/fase2/central-importacion-21-10-2026.json) · [Validación completa sin cantidades](central/validation.json) · [Pruebas HTTPS](generated/fase2/central-cloud-verificado.json).

## Contrato y privacidad

Normalizador: [normalizar_593.py](normalizar_593.py), biblioteca estándar de Python. No ejecuta fórmulas ni utiliza el Excel como instrucciones. Valida estructura, fecha, integridad ZIP, SKU único, nombres/variantes, precios y disponibilidad. Bloquea el SKU conflictivo; rechaza un archivo con esquema inválido, futuro, vencido o incompleto. El corte anterior más reciente conserva prioridad: un archivo anterior no puede sustituirlo automáticamente.

Precios exactos: Promo contado = Q (V. TOTAL); PVP final = X + Y (IVA exportado como importe). No vuelve a aplicar porcentajes ni inventa fórmulas de financiación. Cada producto registra hoja, fila, celdas y valores de precio de origen. El Excel completo, compras, utilidades, márgenes, seriales y cantidades internas no entran al repositorio ni a los artefactos. La disponibilidad pública es `in_stock`, `out_of_stock` o `blocked`. Se respeta la política existente de venta de pilas de botón por unidad.

Los dos SKU ausentes tienen guardas de exclusión en la fuente (1.556 registros de consulta en total, sin contarlos como SKU del Excel). Eso impide recuperar sus precios desde datos anteriores. Alex usa el mismo contrato para IA y respaldo; el campo interno de compatibilidad de disponibilidad es un booleano, nunca la cantidad del ERP.

## Seis adaptadores, una fuente

[Manifiesto de canales](central/channels.json). Alex, catálogo web, fábrica de banners y PDF por categorías apuntan a la fuente central y seleccionan sus SKU; no repiten reglas de precios. Meta y Google tienen CSV candidatos derivados de la misma fuente. Hay 907 referencias con enlaces, imagen, categoría y precios coincidentes con la web de referencia. Otros 233 disponibles quedan fuera de esos candidatos mientras falte compatibilidad o publicación previa.

No se exporta Promo contado como una oferta incondicional a los feeds automáticos. Google utiliza `in_stock`; Meta, `in stock`. No se inventan marcas, GTIN ni identificadores. Antes de publicar hay que comprobar requisitos de identificadores, coherencia del precio estructurado y forma de pago en la página de destino y autorización de la cuenta. Nada se envía todavía a Commerce Manager o Merchant Center. Las fotografías y los PDF existentes no se reconstruyen.

## Recepción de un solo archivo, todo en la nube

Panel: https://conectatech-comercial-piloto.conectatech-ecu.workers.dev/commercial/upload . El propietario introduce PILOT_TOKEN exclusivamente en el campo privado. No se guarda en el navegador ni se comparte en el chat. El archivo se cifra en el Durable Object SQLite existente y se conserva un máximo de 24 horas; tras procesamiento verificado se elimina el original. El área de pruebas de recepción está separada y no puede disparar GitHub.

Workflow: `.github/workflows/central-593.yml`, job `ingresar`, rama `automatizacion/piloto-cloud-3sku-20261015`, environment `conectatech-piloto-gratis`. Descarga el archivo por HTTPS privado, verifica su hash, aplica el normalizador único, prepara los seis destinos y actualiza solo el Worker piloto. Un error conserva la última fuente desplegada. Los fallos de validación devuelven códigos sin datos privados; fallos transitorios permiten relanzar el job sin subir otro archivo. Los artefactos contienen solo resultados depurados durante siete días.

El receptor y el job están preparados y probados. El disparo desatendido requiere una configuración de cuenta aún ausente: `COMMERCIAL_ACTIONS_TOKEN`. Token fine-grained GitHub limitado al repositorio `conectatech-ec/conectatech-ec.github.io`, Actions: Read and write y Metadata: Read obligatorio; sin Contents write, administración ni facturación. Guardarlo como secreto del environment existente y sincronizarlo mediante el despliegue del piloto. El Worker permite únicamente relanzar el job del normalizador en la rama autorizada. Actions es un permiso de repositorio, no de rama; no presentarlo como un token que GitHub limite por rama. Nunca poner su valor en documentos o mensajes.

Sin ese token, la carga queda pendiente y el job puede relanzarse desde GitHub/las herramientas autorizadas. No se presenta como un disparo automático ya conectado. No se añade un cron a main: los workflows programados de GitHub no sirven para ejecutar esta rama aislada como servicio permanente. El receptor HTTPS sí permanece disponible en Workers Free.

## Última versión válida y reversión

Los archivos rechazados no despliegan ni cambian la fuente vigente. La escritura del normalizador se prepara antes de sustituir `current.json`; un cambio de origen conserva `last-valid.json`. Git mantiene las versiones del corte inicial y Cloudflare las versiones del Worker. Antes de subir código, el desplegador conserva un corte más reciente que ya exista en el Worker; evita restaurar por accidente el archivo anterior del repositorio.

Una reversión requiere seleccionar el JSON validado anterior y una autorización explícita de operación. Se puede configurar `source_rollback_confirmed:true` y `rollback_source_sha256` igual al hash del archivo elegido en la rama del piloto. El desplegador no conserva la fuente más reciente solo para esa reversión identificada. No se habilita ahora. La fecha original y la caducidad se conservan: una reversión jamás rejuvenece precios antiguos.

## Integración directa con Sistema 593

Se revisaron https://593sistemas.com/ y https://593sistemas.com/contacto y no se encontró documentación pública de API de inventario o exportación programada. Eso no demuestra que la cuenta del propietario carezca de esa función. No se inicia sesión, se extraen credenciales, se presupone un endpoint ni se contacta al proveedor desde esta sesión.

Para retirar también la exportación manual hace falta documentación oficial de la instancia utilizada: API de lectura o reporte programable cloud, autenticación, paginación, fechas/zonas, límites y confirmación de que está incluido sin costo adicional. No contratar un módulo ni una prueba. Hasta entonces, la entrada es un único Excel; no depende de programas ejecutándose en la laptop y no exige confirmar precios por producto.

## Alcance de las pruebas

La importación real se ejecutó sobre el Excel adjunto en el entorno cloud. Veinte consultas reales por HTTPS verificaron ambos A17, tres SKU originales, un SKU nuevo y exclusiones. No utilizaron IA, no enviaron mensajes a Messenger y no acreditan por sí mismas recepción visual en el perfil probador. La recepción de archivo se probó con un payload sintético en el ámbito CI; no se afirma que el Excel original haya atravesado todavía la recepción por navegador y el disparo automático, cuya credencial sigue pendiente.

Costo adicional autorizado: $0. Sin main, producción del catálogo, clientes externos, cuotas ampliadas ni servicios pagos.
