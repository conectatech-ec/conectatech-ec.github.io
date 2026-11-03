# Alex y la Red Comercial: prueba de personalidades

Un solo motor, modelo, cuota global y Data Hub. El simulador privado permite elegir COL001 Rafa Valderrama (voz masculina, jocosa/directa/comercial) o COL002 Jessy Fox (voz femenina, amable/cercana/comercial). Alex se identifica como asistencia virtual del colaborador, sin hacerse pasar por él o ella. Solo el propietario entra con la clave administrativa; no repartir PILOT_TOKEN como credencial de colaboradores.

Se reutilizan los IDs del registro [Red Comercial v2](https://github.com/conectatech-ec/conectatech-ec.github.io/blob/26485b6b1912be06dea5409e56fb28501436d59b/colaboradores/pilot/config.json), máximo diez. Rafa consta activo; COL002 reservado/inactivo. El nombre y tono de Jessy son un overlay autorizado para esta prueba; no se cambió su activación en la Red ni se creó otro registro CRM.

Memoria cifrada y borrado se aíslan por COL, canal y UUID. El selector acredita `operator_authenticated`, no firma Meta, propietario del perfil personal ni identidad del comprador. Texto, `remember`, un COL escrito en un mensaje y campos arbitrarios del navegador no cambian la atribución. Las oportunidades conservan `memberId`, COL, canal y etapa pendiente en el almacenamiento cifrado ya existente. No se crean ventas, reservas ni pagos confirmados. Estas oportunidades no se dan por entregadas al ledger de la Red.

## Conexión real preparada

`createNetworkBridge` reutiliza el contrato `network.alexContext({token,channel})` de la [Red existente](https://github.com/conectatech-ec/conectatech-ec.github.io/blob/26485b6b1912be06dea5409e56fb28501436d59b/colaboradores/src/pilot/network.mjs). El [wireExistingHost](https://github.com/conectatech-ec/conectatech-ec.github.io/blob/26485b6b1912be06dea5409e56fb28501436d59b/colaboradores/src/pilot/wire-existing-host.mjs) conserva autenticación por rol, cifrado, lectores 593 y ledger `eventos_canal`. No está montado en este Worker; su modo sigue REVIEW_ONLY y las escrituras autorizadas siguen desactivadas. No se añadió D1.

El host deberá verificar primero la firma y el activo oficial del evento. Después validará la referencia firmada vigente de la Red; esa referencia acredita procedencia comercial, no identidad del comprador. El adaptador resuelve el miembro desde el resultado interno de la Red, no desde un nombre declarado por el cliente. Rechaza canales personales, miembros no activos, ventas supuestamente confirmadas y comprobaciones de canal inválidas. No abre envíos, aun con un resultado válido.

| Canal | Mecanismo y condición pendiente |
|---|---|
| Messenger de Página | Activo de Página y HMAC acreditados, `pages_messaging` con acceso para compradores externos y modo público autorizado; vínculo servidor/referencia de la Red realmente recibida. No asumir que `m.me?ref` llega en todos los mensajes. |
| Instagram profesional | Cuenta Business/Creator autorizada, permiso de mensajes de la ruta oficial elegida, webhook y activo verificados; referencia validada o vínculo inequívoco servidor. |
| WhatsApp Business | WABA/número autorizados, webhook y permiso de mensajes; servicio dentro de la ventana gratuita verificada, sin plantillas cobrables ni facturación. |
| Marketplace personal | No se acreditó API oficial disponible para responder el Messenger personal de Rafa o Jessy. El permiso de Página no concede ese acceso. Usar funciones nativas disponibles o derivación consentida hacia canales empresariales, sin copiar historiales privados. |

Meta documenta que [Messenger Platform requiere Página y `pages_messaging`](https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api). Sus [respuestas nativas de Meta AI en Marketplace](https://about.fb.com/news/2026/03/facebook-marketplace-new-meta-ai-tools-make-selling-faster-and-easier/) usan información del anuncio; no conectan por sí mismas a Alex/593 y su disponibilidad en estas cuentas no está verificada.

Para operación externa, acreditar permisos oficiales, vincular activos/referencias, definir autenticación por rol para cada colaborador y recibir autorización del propietario. Una venta real seguirá requiriendo `readConfirmed593Sale` con estado CONFIRMADA y evidencia del sistema; no inferirla de un diálogo o de un botón.

## Medios

Cada perfil usa el mismo resolver de imágenes aprobadas por SKU/variante y el mismo control de vigencia. Se ofrece el medio verificado al presentar el producto o pedirlo, con deduplicación por conversación. El bloqueo de la biblioteca SIGNATURE permanece: no se copian enlaces privados ni se liberan banners por cambiar personalidad. La visualización de una fotografía aprobada no acredita envío de un SIGNATURE aún no liberado.
