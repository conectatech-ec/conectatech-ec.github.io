# TELF017 — anuncio real y preparación comercial

[Anuncio aportado por el propietario](https://www.facebook.com/share/1H2BLNTXjW/) → TELF017 → Redmi 15C 128 GB. La asociación se registra en `association.json`; publicación confirmada por el propietario. La consulta pública independiente fue limitada por Facebook y no acreditó el ID canónico del anuncio ni ajustes privados de la cuenta. No se solicita acceso a mensajes del perfil personal.

## Qué funciona ahora

`lead.mjs` reconoce únicamente ese enlace, evita atribuir enlaces de otros dominios/anuncios y no fuerza 128 GB cuando el comprador solicita otra capacidad. El enlace a WhatsApp incluye nombre comercial y anuncio, sin códigos internos visibles ni historial privado. Abrirlo no envía nada: el comprador debe pulsar Enviar. Eso inicia la conversación con el número empresarial ya publicado en la web; no acredita atención de Alex en WhatsApp.

`candidate.json` es una vista derivada de TELF017 de la versión normalizada del reporte del 27-10-2026. Se usó el **normalizador único existente**, sin modificarlo. El corte se generó el 27 a las 23:41:08 Quito y su vigencia de 24 horas termina el 28 a las 23:41:08 Quito. Contado $159,90; PVP tarjeta $199,88, antes de intereses cuando correspondan. Disponibilidad positiva en ese corte; no se exportan cantidades. El original completo y la normalización completa permanecen privados, fuera del repositorio.

El Data Hub publicó después un puntero del 27 con el mismo SHA del candidato, pero el archivo de datos consultado continúa en el 26 y el puntero ya no incluye la referencia exigida por el adaptador desplegado. La reproducción de solo lectura devuelve SHARED_HUB_VERSION_MISMATCH: Alex vuelve a su respaldo del 21 y bloquea la cotización. No se modificó ese Hub, no se desplegó este candidato en Alex ni se modificaron las automatizaciones existentes. `public-hub-status.json` distingue ambas versiones. `prepared.json` y `prepared.txt` contienen una respuesta utilizable mientras el candidato siga vigente; `prepare.mjs` vuelve a comprobar su caducidad antes de generar otra respuesta y reutiliza los hechos comerciales de Alex.

La ficha pública de TELF017 se comprobó por HTTPS sin iniciar sesión, HTTP 200. El banner privado TELF017-Signature-1200.png está aprobado y sus bytes se descargaron mediante Drive autorizado: SHA-256 idéntico al manifiesto, `f93111ef2785304656bbe214cf2bdf7c1c142e28bd1b481f0eaef46e1df11ce0`. Los precios impresos coinciden con el nuevo candidato. Por precio no hace falta regenerarlo; hace falta revalidarlo contra la nueva versión y liberar su entrega. La biblioteca sigue bloqueando envío a compradores. No se copió la imagen al repositorio, no se publicó su enlace privado ni se retiraron sus controles.

## Marketplace nativo

Meta documenta respuestas automáticas nativas con IA durante la creación de anuncios, pero su disponibilidad depende de la cuenta. El enlace público no expone esa configuración y las herramientas no tienen una sesión del perfil personal. Por ello, **disponibilidad en esta cuenta: no verificada**. No se habilitó Meta AI ni se confundió con Alex. La única comprobación personal imprescindible es revisar en la gestión del anuncio si Meta ofrece esa opción.

`native-safe-reply.txt` es un borrador de derivación sin precios ni promesas de existencias, para no dejar una respuesta fija afirmando disponibilidad cuando caduque un reporte. No se instaló en la cuenta. No usar automatización de navegador, cookies personales, scraping de bandejas o bots de WhatsApp Web.

## WhatsApp autorizado y prueba

Para atención automática hacen falta identidad WABA/número y permisos oficiales `whatsapp_business_messaging`; `whatsapp_business_management` corresponde a la administración/lectura de activos cuando sea necesaria. No son permisos de Messenger ni los concede un token de Página. Antes de conectar, comprobar las condiciones gratuitas efectivas de la cuenta y evitar plantillas/campañas, renovaciones o facturación. No se contrata nada.

El nuevo workflow `marketplace-telf017.yml` es un observador aislado, con `contents: read`, sin despliegue ni envíos. Reutiliza el entorno existente y PILOT_TOKEN para una consulta privada de demostración. Solo si ya se le proporcionan token/número WhatsApp hace una lectura GET de identidad; no utiliza el token de Página como sustituto ni activa planes. La ausencia de esas credenciales en este observador no prueba que no existan en otro sistema; no hay una conexión acreditada aquí.

`e2e.test.mjs` prueba la cadena con datos sintéticos locales: HMAC, número de negocio, atribución, candidato y bloqueo fuera de ventana. No genera eventos falsos en el webhook público y no acredita entrega real. `e2e-plan.json` enumera deduplicación, aprobación inicial, ventana, versión de datos y recibos que faltan para dar por terminada una conexión oficial. No esperamos una conversación desde otra cuenta para completar esta preparación.

El workflow compara por HTTPS el Hub publicado y la vista de Alex ya existente. Puede observar el corte antiguo en Alex y el nuevo candidato preparado: no presenta esa diferencia como una sincronización terminada.

Fuentes oficiales: [respuestas nativas de Meta](https://about.fb.com/news/2026/03/facebook-marketplace-new-meta-ai-tools-make-selling-faster-and-easier/), [enlaces WhatsApp con mensaje prellenado](https://faq.whatsapp.com/5913398998672934), [Cloud API de WhatsApp](https://developers.facebook.com/docs/whatsapp/cloud-api/overview/).

Rama independiente existente. Sin cambios de producción, otras sesiones, workflows existentes, Worker desplegado o permisos. Costo adicional autorizado $0.

## Bloqueo técnico comprobado sin otra cuenta

El observador HTTPS obtuvo HTTP 200 de la vista privada y foco TELF017, pero Alex respondió con fuente del 21 y precio bloqueado. El reporte del 27 sí está validado y vigente en la preparación. Un puntero nuevo por sí solo no prueba que el archivo completo ni el consumidor estén sincronizados. El observador nuevo compara fecha, SHA y referencia de ambos; no marca completa la integración.

Para que Alex use los importes preparados hace falta publicar/entregar una versión coherente del Hub mediante el flujo autorizado o promover el corte ya validado al piloto con aprobación. No se aplicó un parche al Worker ni a los procesos de la otra sesión. Esto es independiente de probar una conversación de cliente.
