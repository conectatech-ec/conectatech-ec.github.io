# CONECTATECH BANNERS PRO MÓVIL
Prototipo independiente de solo lectura para Issue #91. No desplegado. No modificar main ni publicar por GitHub Pages.

## Estado verificable de esta entrega
Se reutilizaron el backend y la interfaz de la instalación previa de BANNERS PRO. Se separó la configuración privada del código público. Se revalida la vigencia al ampliar, descargar y compartir, y se muestra la fecha del archivo. El filtro PDF exige APROBADO exacto: NO_APROBADO ya no pasa por coincidencia parcial. No se publican imágenes, manifiestos, correos ni IDs privados.
Sintaxis de frontend/backend comprobada en el runtime JavaScript disponible y 11 comprobaciones de autorización/aprobación ejecutadas. Para repetir con Node: node prototipos/banners-pro-movil/contract.test.cjs.
Estas comprobaciones NO prueban OAuth, Drive en nube, vigencia actual de los cinco originales ni WhatsApp en Android. Los reportes de pruebas anteriores son evidencia histórica, no pruebas repetidas en esta entrega.

## Instalación pendiente, privada y sin servicios nuevos de pago
No ejecutar implementación de producción sin aprobación de Supervisión General.
1. Crear un proyecto Apps Script independiente en la cuenta propietaria de la biblioteca; copiar Code.gs, Index.html y appsscript.json.
2. Configurar BANNERS_PRO_CONFIG como propiedad de script (JSON privado, nunca en GitHub):
   users: array de uno o dos correos Google autorizados;
   manifestId: ID del manifiesto vigente existente;
   rootId: ID de la biblioteca oficial;
   approvedFolders: array de IDs de carpetas verificadas dentro de la biblioteca;
   hubUrl: https://conectatech-ec.github.io/datos-593/estado-ultimo-corte.json
3. La configuración MYSELF/USER_DEPLOYING incluida sirve únicamente cuando ambos teléfonos usan la misma identidad propietaria. No equivale a dos usuarios revocables individualmente. Para dos identidades distintas hace falta validar la política de acceso Google antes de cambiar la implementación. No ampliar acceso a cualquiera.
4. Para una prueba previa al despliegue, el propietario puede usar Implementar > Probar implementaciones y obtener la URL /dev restringida a editores. Requiere autorización inicial de Google; no añadir trabajadores como editores solo para darles acceso a la galería. El conector disponible no crea ni despliega proyectos Apps Script.
5. El acceso se rechaza si Session.getActiveUser().getEmail() está vacío o no autorizado. Debe comprobarse en el runtime real. No retirar este control para hacer funcionar una instalación.

## Contrato de lectura reutilizado
El manifiesto existente contiene fecha_datos, fuente_593_sha256, productos y catalogos. Se compara fecha/huella con el corte publicado, sin guardar otra fuente de precios/inventario.
Cada producto debe tener estado APROBADO, material_vigente_verificado y disponibilidad_comercial verdaderos; publicacion_drive con estado_publicacion VERIFICADO, fecha_corte y sha256_fuente coincidentes y checksum_archivo igual a banner_sha256. Se exige SKU piloto e ID, carpeta, MIME, SHA y versión del original verificables.
Piloto previsto: TELF001, REL046, TARJ018, FLAS003, TELE001. Solo aparecen si el manifiesto actual y los bytes cumplen el contrato. La documentación previa afirma que estos cinco se usaron en sus pruebas; esta sesión aún no pudo comprobar los bytes privados.
PDF: estado APROBADO exacto y archivo version ligero, URL Drive y SHA válido. Si el productor usa otro estado, solicitar su contrato; no ampliar con búsquedas parciales. No inferir vigencia por nombre o fecha de modificación.
No hay triggers, sincronización horaria, escritura comercial ni caché persistente de archivos en el teléfono. La revisión cada 60 segundos solo opera mientras la página está visible. Los archivos de la sesión se conservan temporalmente en memoria y se invalidan al cambiar de versión.
La interfaz usa los bytes originales para las miniaturas: cinco PNG pueden consumir varios MB. No hay pipeline de miniaturas adicional; medir velocidad en Android antes de declarar rendimiento aceptado.

## Demostración de aceptación pendiente
- Autenticar las identidades acordadas y rechazar una ajena y sesión vacía.
- Comprobar cinco originales aprobados contra el manifiesto/corte vigente y SHA.
- Buscar TELF001, ZTE y A56; validar resultados reales.
- Abrir imagen, descargar PNG y comparar SHA; descargar PDF.
- Compartir archivo desde Chrome hacia WhatsApp y confirmar adjunto recibido. Web Share abre el selector del sistema; no puede forzar WhatsApp. Fallback: descarga y envío manual.
- Verificar Añadir a pantalla de inicio en ambos Android (acceso directo, sin APK ni servicio offline).
- Cambiar una versión desde el productor autorizado y comprobar bloqueo de la anterior sin modificar aquí la fábrica.

## Dependencias detectadas
El entorno de ejecución de esta sesión permanece pendiente/offline; no fue posible abrir un checkout, ejecutar Node/Chromium ni materializar el manifiesto JSON para validar los originales.
El Site previo reservado tiene versión 0 y no tiene URL live/preview. Las URL desplegadas de Sites son producción y quedan fuera de la autorización actual.
Faltan confirmación de identidades y una URL privada de prueba generada por el propietario mediante el mecanismo Google autorizado. No se ha declarado una URL inventada ni una galería funcional en nube.
