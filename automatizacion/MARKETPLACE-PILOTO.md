# CONECTATECH — Alex para oportunidades de Marketplace

Piloto aislado: Redmi 15C 128 GB / 4 GB RAM (TELF017), ZTE Blade A56 Pro 128 GB (TELF001) e Infinix XWATCH H4 (REL046). Las otras variantes Redmi siguen separadas: TELF018, 256 GB / 4 GB RAM; TELF019, 256 GB / 8 GB RAM. No convertir RAM virtual en RAM física ni confundir el reloj con su cable H4 o una correa.

Demostración: https://conectatech-comercial-piloto.conectatech-ecu.workers.dev/marketplace/pilot . Introducir PILOT_TOKEN únicamente en el campo privado. El HTML no incluye secretos. La demostración conserva contexto en los Durable Objects existentes, aislada de los PSID y conversaciones reales; no envía a Graph API ni a WhatsApp. Las consultas deterministas no consumen IA. La IA generativa y los límites del vendedor existente permanecen intactos.

## Una fuente comercial

Alex lee el Data Hub compartido existente, `datos-593/estado-ultimo-corte.json` y su referencia fija `datos-593/corte-comercial-publico-validado.json`, ambos en la web oficial. No escribe allí ni crea otro sincronizador de 593. `shared-hub.mjs` adapta su contrato a la misma fuente interna utilizada por Alex; no calcula precios ni impone otra política comercial. Convierte cantidades en disponibilidad y nunca las devuelve al cliente.

El corte publicado del 26-10-2026 se contrastó con su original XLSX de Drive: 1.569 SKU únicos; 1.170 registros publicados comprobados sin diferencias de contado, PVP o disponibilidad. El archivo original no entra al repositorio. Las verificaciones de identidad se realizaron automáticamente por SKU, sin confirmaciones individuales. El timestamp original es 26-10-2026 11:15:47 Quito; el límite vigente de 24 horas vence el 27-10-2026 11:15:47 Quito. El reporte puede identificar productos después de esa hora, pero no autoriza precios ni existencias vigentes.

El snapshot compilado anterior conserva su fecha. Si ya existe un original más reciente validado en el Worker, un corte público anterior no lo sustituye. Cuando el SHA público coincide con el original compilado, se conserva este último completo. Para un SHA nuevo, se exige evidencia de identidad original por SKU o identidad oficial equivalente; un desconocido no hereda fotos/variantes. Si el contrato público solo ofrece fecha, se toma conservadoramente el inicio de ese día en Quito; la hora de descarga/publicación no rejuvenece datos. Un archivo/puntero inconsistente falla de forma segura.

Las fotografías y fichas públicas aprobadas se enlazan en la capa complementaria del Data Hub por SKU y variante. Redmi 128/256 y RAM física distinta mantienen fotos y características separadas. ZTE no tiene una fotografía pública nueva verificada en el registro consultado: no se inventa ni se publica su banner privado para cubrir esa ausencia.

## Tres canales diferentes

| Origen | Lo implementado | Lo que no se acredita |
|---|---|---|
| Marketplace personal | Borrador comercial seguro y derivación voluntaria a WhatsApp Business o Messenger de Página | Lectura de chats personales, publicación masiva o respuesta de Alex mediante una API personal |
| Messenger de Página | Reutiliza webhook firmado, memoria, token de Página, lista de probadores y transporte oficial existentes | Acceso general de clientes, aprobación avanzada de Meta o una entrega real de esta nueva conversación |
| WhatsApp Business | Enlace oficial con producto/variante en mensaje prellenado | Conexión de Alex a WhatsApp Cloud API o envío automático |

El comprador debe abrir el enlace y enviar el mensaje; no se transfieren automáticamente conversaciones, PSID ni datos personales entre canales. Un mensaje de Marketplace personal no se acepta como webhook Page. La vista privada permite cambiar el origen para comprobar la política; eso no simula una entrega real del proveedor.

Meta anunció respuestas nativas con IA en Marketplace: se pueden previsualizar y editar durante la creación del anuncio, si la cuenta tiene la función. La disponibilidad en esta cuenta/Ecuador no está verificada. Es una función de Meta distinta de Alex y utiliza los datos del anuncio, no una conexión acreditada con nuestro Data Hub. No habilitar respuestas que aseguren disponibilidad usando un anuncio vencido. El piloto entrega el texto de derivación como borrador, no modifica la cuenta personal.

## Biblioteca de banners

Se consultó el manifiesto privado existente de la fábrica, sin modificarlo. Los tres SKU principales tienen piezas visualmente APROBADAS con publicación y checksums registrados como VERIFICADOS al corte del 26. Sin embargo, el manifiesto mantiene `no_enviar_a_compradores=true`, `mensajeria_activada=false` y `apto_envio=false` en esas piezas. Además, la fuente comercial ya venció. No se sustituyen esas banderas para lograr una demostración.

`marketplace-library.json` contiene solo evidencia depurada de aprobación/corte/checksum y el estado de entrega; no exporta IDs, enlaces ni archivos privados de Drive. No se ha conectado una lectura servidor-servidor del manifiesto desde el Worker. Antes de entregar un banner se necesita corte vigente, coincidencia exacta de SKU/versión, liberación de entrega por la fábrica y lectura/hash del archivo real. Hasta entonces la respuesta distingue fotografía pública verificada de banner bloqueado. No se crea otra biblioteca, no se regeneran piezas y no se hacen públicos archivos de Drive.

## Permisos y pasos pendientes

1. **Datos:** recibir un reporte vigente mediante el punto de entrada del Data Hub. No pedir confirmación manual de cada precio ni ampliar el límite de vigencia. Los importes vencidos permanecen bloqueados mientras se puede orientar sobre características y logística verificadas.
2. **Messenger para compradores externos:** confirmar oficialmente App Live y el acceso adecuado/aprobación de `pages_messaging`, las condiciones de negocio exigidas por Meta y la suscripción de Página. Un scope en el token no acredita acceso avanzado. `pages_manage_metadata` se necesita para administrar suscripciones cuando corresponda; no se amplía si la suscripción existente funciona. Mientras tanto solo probadores autorizados, sin cambiar `META_INGRESS_ENABLED=false`.
3. **Marketplace personal:** comprobar en la propia cuenta si aparece la automatización nativa y revisar el borrador antes de habilitarla. No existe en este piloto una integración autorizada para que Alex lea esa bandeja; el token de Página no concede ese acceso.
4. **Banners:** liberar la entrega en el flujo de aprobación de la fábrica y conectar su lectura privada autorizada al Worker, con verificación de archivo/versión. No retirar protecciones de otra sesión ni ampliar la compartición de Drive.
5. **WhatsApp automatizado:** acreditar WABA/número, permisos oficiales `whatsapp_business_messaging` y, para administrar activos, `whatsapp_business_management`, webhook, ventana permitida y gratuidad efectiva de la cuenta antes de enviar. No activar plantillas, campañas, proveedores ni facturación. El enlace a la aplicación existente no requiere habilitar Cloud API y no demuestra que Alex atienda allí.

## Evidencia y límites

`tests/marketplace.test.mjs` prueba conversaciones completas, identificación numérica 15C, integridad del Hub, caducidad, separación de variantes, reloj/accesorios, límites de canal, acceso privado y banners no liberados. Son pruebas con fixtures/simuladas; las horas históricas de esos fixtures no autorizan ofertas actuales.

`marketplace-e2e.mjs` realiza consultas HTTPS reales al Worker con tres orígenes y tres productos, sigue una conversación contextual y prueba la ruta existente `/alex/chat`. No genera eventos personales falsos, no envía a Graph, no llama a WhatsApp ni consume IA. Una ejecución aprobada acredita únicamente este alcance; Messenger real, auto respuesta nativa y recepción en WhatsApp se verifican aparte.

El job de recepción 593 verifica un nuevo corte después de procesarlo; si no hay un archivo pendiente termina sin despliegue y no acredita una nueva versión recibida. Las alertas de vigencia del producto se conservan en las respuestas y diagnósticos.

Rama independiente `automatizacion/piloto-cloud-3sku-20261015`. Sin cambios en main, producción del catálogo, biblioteca SIGNATURE, permisos, cuotas o planes. Presupuesto adicional $0.

Fuentes oficiales consultadas el 27-10-2026:

- [Meta: respuestas nativas de Marketplace](https://about.fb.com/news/2026/03/facebook-marketplace-new-meta-ai-tools-make-selling-faster-and-easier/).
- [Meta: Messenger Platform](https://developers.facebook.com/docs/messenger-platform/overview/) y [colección oficial Meta](https://www.postman.com/meta/messenger-platform-api/overview).
- [WhatsApp: enlaces de chat y mensaje prellenado](https://faq.whatsapp.com/5913398998672934).
- [WhatsApp: precios oficiales de la plataforma](https://business.whatsapp.com/products/platform-pricing). La descripción general de ventanas gratuitas no sustituye comprobar la configuración efectiva de la cuenta; no se realizan envíos desde este piloto.

## Resultado cloud verificado

Despliegue e1aac3c7, [GitHub Actions 40582217261](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/40582217261), concluido correctamente. Nueve consultas producto/origen (3 × 3), conversación de diez turnos de comprador, selección de botón, consulta ambigua y ruta `/alex/chat` verificadas por HTTPS real. Evidencia: [marketplace-cloud-verificado.json](generated/fase2/marketplace-cloud-verificado.json). No son mensajes recibidos realmente desde Marketplace/Messenger/WhatsApp.

Token de Página válido y asociado a CONECTATECHec; scope pages_messaging concedido; webhook de la app activo y campo messages configurado. La lectura de suscripciones de la Página no queda acreditada con el token actual (no tiene pages_manage_metadata). No se amplió el token, y los scopes no prueban acceso avanzado ni App Live. La operación sigue restringida a los probadores configurados.

Las respuestas reales identificaron los tres modelos, conservaron el Redmi 128 GB y su foto, respondieron batería 6000 mAh desde la ficha, y bloquearon importes y banners del corte vencido. ZTE mantiene pendiente una fotografía pública verificada; no se reutilizó la de otro equipo. Los banners aprobados privados siguen bloqueados. Requiere un reporte vigente y liberación/conexión de la biblioteca antes de demostrar una entrega comercial de esos banners.
