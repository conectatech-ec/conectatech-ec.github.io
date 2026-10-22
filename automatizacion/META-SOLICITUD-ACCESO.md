# CONECTATECH / Alex — material para revisión de Messenger

Preparación inicial del 16 de octubre de 2026, ampliada el 21 de octubre (Quito). La última confirmación administrativa del propietario indica que la verificación legal fue enviada y estaba EN REVISIÓN; no volver a solicitar su envío. Este documento prepara la solicitud distinta de acceso avanzado de pages_messaging, todavía sin aprobación. Se presenta desde la cuenta administradora de la aplicación existente; no se crea otra app ni se cambia de plan. [Evidencia de la conversación real](generated/fase2/alex-cloud-verificado.json).

**Actualización del panel confirmada por el propietario:** acceso estándar de pages_messaging y modo Desarrollo. [Registro](meta-access-status.json). El dato ya está disponible: solicitar acceso avanzado desde esa fila y completar los requisitos que muestre Meta; no volver a pedir el nivel actual. La apertura a compradores externos sigue bloqueada y el probador continúa activo.

[Verificación HTTPS y permisos existentes](generated/fase2/meta-review-readiness-verificado.json): privacidad y eliminación HTTP 200; cinco rutas privadas HTTP 401 sin credenciales. Sin inferencias, envíos ni despliegues durante esa comprobación. El nivel de acceso avanzado y modo Live siguen sin acreditarse desde el panel.

## Campos y enlaces que ya podemos completar

| Campo | Valor |
| --- | --- |
| Identidad visible del servicio | Alex, tu asesor de CONECTATECH |
| Página | CONECTATECHec |
| Conversación | https://m.me/105549695770538 |
| Privacidad | https://conectatech-comercial-piloto.conectatech-ecu.workers.dev/privacy |
| Instrucciones de eliminación | https://conectatech-comercial-piloto.conectatech-ecu.workers.dev/data-deletion |
| Callback existente | https://conectatech-comercial-piloto.conectatech-ecu.workers.dev/webhooks/meta |
| Permiso que se debe revisar | pages_messaging, nivel necesario para personas sin rol en la app |
| Página web comercial existente | https://conectatech-ec.github.io/ |

No cambiar el callback ni el token de verificación: ya funcionan. El nombre técnico actual de la aplicación se conserva para localizarla en el panel; la experiencia del comprador utiliza CONECTATECH y Alex.

## Descripción del caso de uso — texto para adaptar al formulario

Alex atiende consultas iniciadas por personas en Messenger de la Página CONECTATECHec. Utilizamos pages_messaging para recibir esas consultas y responder dentro de la ventana estándar de 24 horas con asesoría comercial sobre productos del catálogo propio. El piloto incluye el micrófono JBL Quantum Stream, la batería portátil Philco FLP8202CV y el adaptador de enchufe Europa a Latino. El servicio se conecta únicamente a nuestra Página; no incorpora Páginas de terceros ni comercializa una plataforma de integración para otros negocios.

La generación de lenguaje interpreta necesidades, preguntas de seguimiento y presupuesto. Los precios, disponibilidad, condiciones de pago e imágenes se validan contra fuentes comerciales aprobadas. La memoria contextual se cifra y vence tras 24 horas de inactividad. El comprador puede solicitar atención por una persona y eliminar el contexto. No confirmamos pagos, inventario reservado ni fechas de entrega sin validación comercial.

Necesitamos el nivel de acceso autorizado por Meta para atender a personas que escriban a la Página sin tener un rol en nuestra aplicación. El permiso concedido al token y una conversación de un probador ya están comprobados; eso no acredita por sí solo el acceso avanzado ni el modo Live. No utilizamos Marketplace personal, campañas proactivas, etiquetas para eludir la ventana ni funciones de pago de Meta.

## Tratamiento de datos — texto para adaptar

Procesamos el mensaje entrante, el identificador de Messenger necesario para responder y el contexto mínimo de la consulta. Cloudflare Workers AI genera lenguaje con los hechos comerciales aprobados; la conversación también está sujeta al tratamiento de Meta en Messenger. Antes de procesar con IA y persistir texto se omiten patrones de correo, teléfonos y datos sensibles. No solicitamos contraseñas, documentos ni datos de tarjetas. La minimización por patrones no detecta necesariamente cualquier dato escrito.

El contexto cifrado dura 24 horas de inactividad; los intereses, derivaciones y referencias mínimas para deduplicación pueden durar hasta siete días. La lista cifrada de probadores es un control independiente y se conserva hasta revocación. Los registros técnicos y el repositorio no publican mensajes, PSID ni credenciales. «Olvida esta conversación» elimina el contexto y el interés asociado; no borra el historial de Meta. La Página oficial recibe solicitudes adicionales de privacidad.

## Instrucciones para demostrar el flujo

La conversación del probador ya demostró recepción de texto y fotografía y una respuesta correcta de pagos con tarjeta, confirmada por el propietario. Para una grabación solicitada por Meta, mostrar la conversación real desde el perfil autorizado y la Página correcta. No reemplazar esa evidencia por el chat privado /alex ni por fixtures técnicos.

1. Mostrar CONECTATECHec en Messenger y la consulta «Busco una batería portátil para mi celular, tengo presupuesto de 40 dólares».
2. Mostrar la respuesta de Alex, la fotografía correcta y las opciones nativas. El precio debe corresponder al feed vigente; no fijar cifras en el guion.
3. Mostrar «¿Y con tarjeta cuánto cuesta?» y la respuesta PVP como base, con intereses cuando correspondan.
4. Si el panel exige demostrar contexto o planes: «¿Y con Pichincha a seis meses?». Octubre: hasta seis sin intereses; doce con intereses. No presentar los planes como renovados tras octubre.
5. Si el formulario pide probar el control humano, hacerlo al final: «Quiero hablar con una persona» deja pendiente la atención y pausa esa conversación. «Olvida esta conversación» borra el contexto y permite reiniciar después. No afirmar que una persona ya atendió si no lo hizo.

No mostrar contraseñas, tokens, PSID, pestañas de secretos ni otras conversaciones. Se puede registrar una conversación ya existente sin generar nuevos mensajes. La grabación y los datos reales del negocio deben cargarse directamente en Meta, no en el repositorio público ni en este chat.

## Acceso del revisor: condición pendiente si Meta lo solicita

El Worker conserva una lista de probadores permitidos. Un revisor que no esté autorizado no recibirá respuestas, aunque conozca la URL de Messenger. No presentar el servicio como libremente accesible ni entregar PILOT_TOKEN al revisor: esa clave permite operar el piloto y consultar datos privados.

Usar únicamente la modalidad de cuentas o acceso de prueba que indique el panel de Meta. Una vez definido el revisor o perfil de prueba autorizado, se preparará su acceso restringido mediante el flujo de vinculación existente. La frase de vinculación actual caduca a los diez minutos; no incluir una frase efímera en una revisión asíncrona como si fuera acceso permanente. Si Meta requiere otro mecanismo de acceso verificable, resolverlo antes de presentar la solicitud, sin abrir la automatización a clientes generales.

### Procedimiento operativo para el acceso autorizado

1. El administrador utiliza en App Review la modalidad de acceso que solicite Meta. Si exige una cuenta de prueba con capacidad real de usar Messenger, la cuenta debe tener un rol de **probador aceptado** en la app. No suponer que un usuario sintético de Graph puede utilizar Messenger ni que un revisor desconocido tiene ese rol automáticamente. No solicitar administrador/desarrollador cuando basta probador; no crear perfiles falsos ni compartir la cuenta personal del propietario.
2. Antes de presentar una revisión asíncrona, el responsable de esa cuenta envía una frase nueva de `/messenger/setup` desde Messenger. **Solo el propietario abre el panel con PILOT_TOKEN** y genera la frase tras confirmar el rol. La frase privada dura diez minutos, se consume una vez y registra el PSID cifrado automáticamente. El revisor no necesita el panel, PILOT_TOKEN ni el PSID. La cuenta queda autorizada para conversar después de caducar la frase.
3. Probar desde esa misma cuenta el enlace de CONECTATECHec antes del envío a revisión. Si Meta exige credenciales de prueba, proporcionarlas únicamente mediante los campos privados del formulario oficial y usando la cuenta de prueba que Meta autorice; nunca publicar credenciales, OTP o códigos de recuperación en documentos, repositorio, video o chat. No entregar tokens del servidor.
4. Si el formulario exige que el revisor use una cuenta propia no identificada, **ese acceso sigue pendiente**: no abrir la lista de remitentes ni dar por válido el acceso del propietario como sustituto. Solicitar en el canal oficial el mecanismo de prueba compatible con Desarrollo. La sesión conectada no puede añadir roles ni presentar App Review en la interfaz administrativa.
5. Registrar la fecha de la prueba y los resultados sanitizados del Worker. Mantener la parada del operador disponible; conservar el límite de 100 mensajes entrantes en 24 horas móviles, presupuesto de IA y ventana de Messenger. La autorización de la cuenta en Meta y la lista del Worker son dos controles distintos, ambos necesarios.
6. Durante la revisión, abrir Messenger directamente: no pegar frases caducadas ni claves administrativas en las instrucciones. Al finalizar, el administrador revoca el rol de prueba temporal en Meta; la revocación del registro cifrado del Worker debe hacerse mediante una operación específica, sin borrar los demás probadores ni ampliar acceso general.

Guion reproducible: «Hola, busco un Samsung A17» → elegir 128 GB → «¿Qué batería tiene?» → «¿Y de contado?» → «¿Y con tarjeta?» → «¿Contraentrega en Quito?» → «¿Y envíos nacionales?» → pulsar una opción nativa → pedir atención humana al final. Mientras el corte comercial 593 no esté vigente, contado y tarjeta deben decir **requiere confirmación**. La memoria, fotografía del modelo exacto, botones, asesoría y logística sí deben funcionar. No grabar importes antiguos como vigentes ni modificar fechas para el video.

Esta integración no tiene un flujo de Facebook Login para incorporar negocios externos. Si Meta exige una grabación de ese flujo como condición del caso de uso, informar el requisito concreto para implementarlo oficialmente; no afirmar que ese inicio de sesión ya existe.

## Acciones que requieren la cuenta del propietario

En https://developers.facebook.com/apps/ abrir la aplicación existente, después App Review / Permisos y funciones o el caso de uso Messenger. Revisar pages_messaging y el modo de la aplicación. Si el panel pide revisión, usar los textos anteriores y completar solo los datos empresariales y requisitos que muestre. No contratar Meta Verified ni servicios de pago. Ningún token de GitHub permite presentar aquí una solicitud como administrador de Meta.

No solicitar permisos de anuncios, facturación, perfiles ni pages_manage_metadata solo para volver a diagnosticar una vinculación que ya está probada. Si el panel exige un permiso dependiente, identificar su necesidad antes de ampliarlo. No afirmar la suscripción de message_deliveries: la recepción está confirmada visualmente y Graph API aceptó los envíos, pero no existe un recibo automático de entrega acreditado.

La bandeja de borradores con aprobación humana ya está implementada para probar con el remitente autorizado: [funcionamiento y controles](ALEX-MEJORAS-CONTEXTO.md). Después de acreditar el nivel concedido y modo necesario, la primera apertura comercial debe reutilizarla para recepción y generación con aprobación humana antes del envío. El transporte actual acepta exclusivamente probadores en modo Desarrollo; no basta con cambiar el modo en Meta o borrar una lista. Hace falta el cambio controlado correspondiente en la rama del piloto, conservando parada, firma, frescura, deduplicación, cuota gratuita y ventana de 24 horas.

Referencias oficiales: [Messenger Platform de Meta](https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api), [referencia de permisos](https://developers.facebook.com/docs/permissions/), [revisión de Messenger](https://developers.facebook.com/docs/messenger-platform/app-review/). Los campos efectivos los determina el panel de la aplicación.
