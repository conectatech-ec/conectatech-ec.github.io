# CONECTATECH — contrato del Data Hub comercial

Sistema 593 → Data Hub central validado → adaptadores por canal.

Rama independiente: `automatizacion/piloto-cloud-3sku-20261015`. Este contrato no autoriza cambios en main, otras ramas, producción, clientes externos o planes de pago. El corte 21-10-2026 ya está importado y cargado en Alex del Worker piloto. No se exige confirmar manualmente cada precio.

## Punto de lectura común para todas las sesiones

- `central/current.json`: única fuente financiera y de disponibilidad por SKU. `source_name` es el nombre oficial de 593; `name` conserva el alias comercial de compatibilidad existente. La fecha de origen nunca se reemplaza por la fecha de publicación.
- `central/hub.json`: versión, corte, validación, caducidad, firma comercial y estado verificado de cada destino. La versión es `593-v1-<SHA256 del Excel>`; cambiar la política de normalización requiere versionar también su identificador.
- `central/enrichment.json`: fotos, banners, nombres comerciales, descripciones y especificaciones existentes, enlazados por SKU y firma de identidad. No admite precios, stock ni disponibilidad como sustitutos del registro de 593. Los cambios de identidad/variante retiran medios incompatibles. No cambia fotografías originales.
- `central/changes.json`: diferencias comerciales por SKU y categorías afectadas. No contiene cantidades internas. Un cambio de cantidad que mantenga la misma disponibilidad no obliga a generar otra imagen.
- `central/adapters/`: descriptores para Alex, catálogo, WebStore, SIGNATURE, PDF y WhatsApp; CSV candidatos Meta/Google. Todos referencian la misma versión. Los CSV no son fuentes maestras ni acreditan que la plataforma los importó.

El campo `web` de `current.json` se conserva como índice derivado de compatibilidad para el piloto existente; no es autoridad financiera ni una segunda base de reglas. La capa complementaria es el punto de intercambio de medios para nuevas integraciones. Los consumidores deben leer la fuente oficial antes que cualquier precio histórico incrustado en una ficha, anuncio, banner o PDF.

El snapshot de la rama no se considera actualizado indefinidamente: el workflow tiene solo lectura y no hace commits para cada Excel. La fuente cloud activa está en `/commercial/catalog` del Worker existente, con autenticación privada; `/commercial/catalog/status` identifica el SHA y la vigencia. Los candidatos y el manifiesto de cada actualización quedan en los artefactos del job `ingresar`. Otras sesiones pueden obtener esos artefactos con la integración GitHub autorizada y comprobar la versión antes de integrar, sin copiar PILOT_TOKEN entre proyectos ni recurrir a un feed antiguo. No publicar el endpoint privado ni compartir su clave con clientes. La adopción en la rama de cada canal requiere su flujo de integración autorizado.

## Actualización e invalidación

El importador único valida Excel, fechas, precios exactos y SKU/variantes. `write_bundle()` prepara fuente, adaptadores, capa complementaria, cambios y manifiesto antes de sustituir el puntero `current.json`. Compara con la versión válida anterior, incluida la del Worker cuando sea más reciente que la rama. Conserva `last-valid.json` para reversión sin rejuvenecer su fecha. Un archivo rechazado no sustituye la fuente vigente.

`changes.signature.invalidate_or_regenerate_only` y `changes.pdf_categories.invalidate_or_regenerate_only` son listas de trabajo. Para un producto agotado, bloqueado o ausente hay que retirar/inutilizar publicidad y ofertas antiguas, no generar un anuncio de venta. Solo regenerar medios con información vigente y una plantilla aprobada. El plan no activa la fábrica SIGNATURE ni toca sus archivos. Las fotografías originales no se regeneran. Las categorías antiguas y nuevas se incluyen cuando cambia la clasificación.

El primer plan compara el corte del 21 con el inventario completo publicado del 10, cuya referencia queda identificada por SHA. No simula una comparación con el archivo del 16, que no está disponible. Las futuras recepciones comparan contra la fuente central anterior, no contra una fecha fija.

## Entrega por canal y evidencia

| Canal | Preparación | Evidencia imprescindible para darlo por actualizado |
|---|---|---|
| Web | Descriptor y candidato central | Leer las páginas/feed públicos y comprobar precios, disponibilidad y versión adoptada |
| Futura WebStore | Descriptor del mismo contrato | Lectura de la versión en el carrito/API y comprobación de importes; no existe conexión activa |
| Alex Messenger | Fuente central cargada en el piloto | HTTPS privado compara SHA y firma comercial completas; conversación Messenger se prueba aparte |
| SIGNATURE | Lista de SKU afectados y capa de medios | Recibo del generador, revisión de recursos y comprobación del manifiesto de salida |
| PDF categorías | Categorías afectadas | Comprobar versión y datos de los documentos generados/publicados |
| Meta Commerce | CSV candidato | Importación oficial y resultados de procesamiento/errores de la cuenta |
| Google Merchant | CSV candidato | Procesamiento oficial y diagnóstico de productos de la cuenta |
| WhatsApp Business | Descriptor; conexión futura | Permisos oficiales, importación/consulta de la versión y prueba autorizada de canal |

Un recibo exige versión y firma comercial exactas, `received:true`, `processed:true`, hora y evidencia. Preparar, subir un archivo o recibir HTTP 200 sin verificar su procesamiento no basta. Los adaptadores no se marcan exitosos automáticamente. Un nuevo corte invalida los recibos anteriores. Los destinos pendientes aparecen en `alerts` y en el resumen de GitHub Actions; no se envían correos ni mensajes a terceros desde este proceso. Actualmente solo puede comprobarse la fuente cargada de Alex; la recepción visual en Messenger es evidencia distinta.

## Automatización y seguridad

Recepción única: https://conectatech-comercial-piloto.conectatech-ecu.workers.dev/commercial/upload . Acceso con PILOT_TOKEN en campo privado, sin pegarlo en el chat. Original cifrado, máximo 24 horas y eliminación después de procesamiento verificado. No se publica el Excel completo, costos, márgenes ni cantidades.

No crear un PAT como requisito. Ya se puede procesar con los secretos existentes y relanzar `ingresar` desde la sesión GitHub autorizada o las herramientas conectadas. El job tiene `contents: read`, checkout sin persistir credenciales y no hace push. Se prepara todo en el runner; solo despliega el piloto existente. No se ejecutan los workflows de producción de main, que publican y necesitan permisos más amplios.

El disparo sin intervención después de subir el archivo no está conectado. La programación de Actions requiere incorporar un consumidor en la rama predeterminada y necesita autorización para modificar main. Una GitHub App es alternativa al PAT para disparo inmediato, pero Actions: write no se restringe por rama y podría relanzar workflows de producción en el repositorio compartido. No se amplían permisos ni se crea esa App ahora. Detalles y fuentes oficiales en [FUENTE-CENTRAL-593.md](FUENTE-CENTRAL-593.md).

No se encontró documentación pública suficiente para una API/exportación programada de 593. Esto no demuestra que no exista en la cuenta: faltan documentación oficial y acceso de lectura autorizado, incluido sin costo. No se presupone acceso a la laptop ni se automatiza su interfaz.

## Alcance de comprobaciones

Las pruebas de dos XLSX sintéticos acreditan importación única, nueva versión, propagación de candidatos, invalidación por SKU/categoría y conservación de última versión válida. No acreditan destinos externos. El job verifica por HTTPS la fuente realmente cargada en Alex con secretos ya existentes. El recorrido de un nuevo Excel real desde recepción hasta todos los canales sigue pendiente; `fully_automated` permanece falso.

Presupuesto adicional $0. Sin publicación de producción ni acceso de compradores externos.
