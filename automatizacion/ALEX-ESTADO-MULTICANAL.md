# Alex único: estado verificado el 3 de noviembre de 2026

Rama `automatizacion/piloto-cloud-3sku-20261015`. Sin cambios en main, fuentes maestras, catálogo público, Worker desplegado ni conversaciones externas. Costo nuevo autorizado y utilizado: $0. No se crearon cuentas, suscripciones, servidores, Data Hub, asistentes ni tokens nuevos.

## Resultado ejecutado

- [Primera comprobación HTTPS y una inferencia real](generated/fase2/alex-scale-cloud-primera-verificacion.json), [Actions 41587719916](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/41587719916): aprobado. Modelo Cloudflare Workers AI `@cf/meta/llama-3.1-8b-instruct-fp8-fast`, respuesta generativa verdadera, sin error. La comprobación privada no entró en Graph ni envió mensajes a Messenger.
- [Correcciones de la rama contra el Hub real y observación del Worker](generated/fase2/alex-scale-cloud-verificado.json), [Actions 41588334688](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/41588334688): aprobado. [Regresión CI del mismo código](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/41588334531): aprobada.
- Las conversaciones HTTPS del Worker existente y las conversaciones ejecutadas con código pendiente de la rama están separadas en el informe. Estas últimas no constituyen un despliegue. Ninguna es prueba de recepción en Messenger, Instagram, WhatsApp ni Marketplace.
- En la segunda comprobación se omitió deliberadamente otra inferencia: la variable de ejecución única ya no estaba habilitada. El motivo genérico del script en ese recibo no significa cuota agotada. La nueva versión del observador distingue explícitamente esta omisión.
- El Worker observado sigue en release `81288c55384a584d15b6f3aa87f6c644add857f8`. Su recepción general permanece cerrada y su transporte para probadores conserva el estado habilitado anterior. No se cambió el modo de revisión humana.

## Hub y correcciones concretas

El contrato público actual es coherente: metadatos y documento de productos coinciden en el corte **2026-11-02**, SHA `265843da6b15038d055535ecdd9ed0b421c947caad27e52c584f16e8bbc6fc80`. La incompatibilidad observada en octubre ya estaba corregida por avances posteriores; no se volvió a escribir el Hub.

Generación acreditada del reporte: **2 de noviembre, 17:48:22 de Quito**. Caducidad original: **3 de noviembre, 17:48:22 de Quito**. Leer, validar o publicar otra vez no extiende ese plazo. Esto es disponibilidad según el último corte, no una consulta transaccional en tiempo real a Sistema 593.

Dentro de las 1.556 identidades de la fuente compilada, la adaptación actual deja 1.166 registros comercialmente válidos y detecta 16 con bloqueos de identidad/variante. Esos números no son cantidades de inventario ni el total del maestro actual: nuevos SKU sin identidad acreditada no se incorporan por aproximación. Los bloqueos restantes incluyen ausentes y otras reglas comerciales. Se conserva la evidencia previa de identidad del corte del 2 de noviembre; no se acredita automáticamente un SHA futuro.

La prueba HTTPS verificó importes exactos, sin revelar cantidades:

| Producto | Promo contado | PVP tarjeta |
|---|---:|---:|
| Redmi 15C 128 GB | $159,90 | $199,88 |
| Redmi 15C 256 GB / 4 GB | $175,90 | $219,88 |
| Samsung A17 128 GB | $185,90 | $232,38 |
| Samsung A17 256 GB | $239,90 | $299,88 |

Estos importes documentan la prueba con ese corte, no renuevan su vigencia. En plazos con intereses, el monto final requiere confirmación. Las promociones bancarias autorizadas para octubre no se extendieron a noviembre.

Cambios preparados y probados en la rama, **todavía sin desplegar**:

1. `shared-hub.mjs`: reintento único de la pareja de documentos sin caché cuando una publicación parcial genera versiones distintas. Conserva una copia de la última fuente validada dentro del mismo isolate, con fecha y caducidad originales. Un reinicio todavía depende del fallback compilado; no se afirma persistencia entre reinicios. No admite un corte anterior a la última versión observada, ni mezcla precios entre versiones.
2. `alex-catalog.mjs`: diagnóstico seguro distingue lectura verificada, última versión del isolate y fallback compilado. No oculta la fecha antigua bajo una sincronización supuestamente exitosa.
3. `alex.mjs`: una comparación explícita de dos teléfonos utiliza características verificadas de ambos. El fallback anterior simplemente enumeraba nombres. Ejemplo comprobado con datos del Hub: A17, batería 5000 mAh; Redmi 15C, batería 6000 mAh.
4. Los bancos con promociones vencidas reciben una respuesta sobre condiciones por confirmar; se conserva la preferencia y no se vuelve al folleto del producto. Los plazos con intereses se explican condicionalmente, sin cuotas inventadas.
5. `RAM` exige límites de palabra: antes coincidía dentro de «muéstrame» y desplazaba la petición de fotografía hacia una respuesta de memoria.
6. Se reconoce «No compraré todavía», sin preguntar pago/entrega ni anunciar una reserva. Se puede retomar con el producto y banco anteriores.

Las pruebas adicionales incluyen 12 turnos de noviembre y comparaciones en respaldo y contrato generativo, además de las conversaciones existentes de 21 turnos bajo cuota agotada, proveedor no disponible, salida adversaria y fuente sintética vigente. Las fixtures están identificadas como simulaciones y no acreditan mensajes reales.

## Motor único y adaptadores

`Sistema 593 → Hub validado → readSharedHub/sourceToAlex → generateAlex/factBook → adaptador oficial del canal`.

El modelo generativo y el respaldo comparten hechos, memoria y reglas comerciales existentes. Presentación pública y enriquecimiento verificable se enlazan por SKU; no sustituyen precios ni identidad oficiales. La biblioteca SIGNATURE privada conserva su validación y autorización de envío separadas. No se regeneraron imágenes ni se modificaron sus fuentes.

`alex-channel-readiness.mjs` es un evaluador de preparación y derivaciones, **no otro motor ni un transporte desplegado**. Prepara hasta diez orígenes legítimos y mantiene la separación de memoria mediante HMAC por canal, cuenta empresarial e identificador del remitente. No fusiona personas entre plataformas ni concede autorización a partir de un enlace de campaña. Solo Rafa/TELF017 está registrado realmente; los otros nueve orígenes del test son sintéticos.

## Canales y bloqueos

| Canal | Qué funciona ahora | Qué falta antes de compradores externos |
|---|---|---|
| Messenger de CONECTATECHec | Worker y `messages` de la app activos; token PAGE válido y `pages_messaging`; probador existente habilitado | Evidencia actual de acceso avanzado y modo Live, suscripción de la Página, acceso de revisión autorizado, conversación real posterior a los cambios y aprobación del propietario |
| Instagram profesional | Evaluación preparada para reutilizar el mismo motor | El GET autorizado de la Página devolvió HTTP 200 sin `instagram_business_account`. No acredita inexistencia de Instagram ni descarta Instagram Login. Faltan cuenta profesional autorizada, permiso de mensajería de la ruta elegida, webhook y transporte probado |
| WhatsApp Business | Enlace consentido al número empresarial ya público; requiere que el comprador envíe el mensaje | El environment de esta prueba no proporcionó token, phone ID ni WABA ID. Faltan acreditación del activo, permisos, webhook, adaptador de salida y gratuidad efectiva de la modalidad. No prueba ausencia de esas credenciales en otras integraciones |
| Marketplace personal de Rafa | Anuncio TELF017 asociado, texto y enlaces de derivación preparados | No se acreditó API oficial para leer/responder su buzón personal. Disponibilidad de Meta AI nativo en su cuenta aún no verificada. No existe un token de Página que sustituya ese acceso |

La lectura de `subscribed_apps` devuelve HTTP 403 porque el token no tiene `pages_manage_metadata`. **No se solicitó ampliarlo**: se puede comprobar la vinculación de la Página desde el panel oficial. La app sí devuelve su webhook activo, campo `messages` y callback correcto. Un scope concedido no prueba acceso avanzado ni App Live. La última confirmación administrativa disponible sigue siendo estándar/Desarrollo y verificación empresarial enviada; no se inventó un nuevo estado del panel.

Privacidad y eliminación públicas: `/privacy` y `/data-deletion` del Worker respondieron HTTP 200 sin sesión. Las rutas privadas comprobadas respondieron HTTP 401 sin token. El acceso del revisor debe seguir [el procedimiento existente](META-SOLICITUD-ACCESO.md), sin entregar PILOT_TOKEN, contraseñas personales ni una frase efímera como credencial permanente.

## Marketplace: uno a diez orígenes

[Meta anuncia respuestas nativas con Meta AI](https://about.fb.com/news/2026/03/facebook-marketplace-new-meta-ai-tools-make-selling-faster-and-easier/): usan datos del anuncio y se configuran en la interfaz de publicación. Esa función no demuestra disponibilidad en Ecuador o en Rafa, no conecta el Data Hub y no convierte a Meta AI en Alex.

La vía preparada para diez propietarios/perfiles legítimos es usar sus funciones nativas cuando estén disponibles y ofrecer derivación voluntaria a la Página o al WhatsApp del negocio. Cada anuncio conserva su asociación interna a SKU; el comprador debe iniciar/enviar el mensaje en el canal de destino. No se trasladan chats privados ni se autoriza automáticamente al remitente. No se asume que crear perfiles adicionales permita usar Marketplace. No se han conectado diez buzones a una API ni se ha acreditado un programa oficial que permita hacerlo.

Para Rafa, la única verificación privada que estas herramientas no pueden hacer es comprobar si su gestión del anuncio muestra la opción nativa de Meta AI. El siguiente destino con Alex ya operativo es Messenger de la Página, sujeto a probador/roles hasta completar permisos. El enlace de WhatsApp abre el chat del negocio, **no acredita respuesta de Alex por WhatsApp**.

## Capacidad y costo

Se conservan los límites internos: 100 mensajes entrantes por 24 horas móviles y 8.000 neuronas reservadas por día UTC, con 80 por intento generativo (hasta 100 reservas). No son 100 conversaciones ni 100 mensajes por cada perfil. El respaldo ahorra IA, pero no elimina el límite de entrada. Aumentar orígenes no multiplica esas cuotas.

[Workers AI Free](https://developers.cloudflare.com/workers-ai/platform/pricing/) ofrece 10.000 neuronas/día; el exceso en Free falla, sin activar Paid. El reinicio es 00:00 UTC, 19:00 de Quito. No se cambió de modelo ni se compraron créditos. El saldo interno es una reserva preventiva, no el medidor del proveedor.

[WhatsApp](https://business.whatsapp.com/products/platform-pricing) distingue mensajes de servicio dentro de 24 horas de categorías cobrables. Una eventual integración de $0 debe impedir plantillas cobrables y envíos fuera de la ventana, y verificar las condiciones de la cuenta. No se activó facturación para obtener acceso.

La ampliación externa queda pendiente de permisos y aprobación expresa del propietario. Los cambios funcionales de esta rama necesitan aplicación controlada al Worker antes de atribuirles resultados reales en Messenger. El observador no puede desplegar: `contents: read`, sin token Cloudflare, sin credenciales GitHub nuevas, sin trabajo sobre main y sin Graph sends.

Fuentes oficiales consultadas: [Messenger de Meta](https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api), [Instagram de Meta](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api). Las páginas técnicas directas de developers.facebook.com devolvieron 429; no se presentaron como inspeccionadas.
