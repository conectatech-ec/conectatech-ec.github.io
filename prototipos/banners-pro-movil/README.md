# CONECTATECH BANNERS PRO MÓVIL
Prototipo independiente de solo lectura para Issue #91. Sin despliegue; main, producción y archivos comerciales intactos.

## Resultado verificado
Reutiliza el backend y la interfaz previos de BANNERS PRO, con configuración privada fuera del repositorio público. Búsqueda instantánea, categorías, recientes, vista ampliada, descarga PNG/PDF y Web Share con fallback de descarga. Se comprueba vigencia antes de ampliar, descargar y compartir.
Se corrigió el filtro de PDF: exige los estados exactos APROBADO_DRIVE_VERIFICADO o APROBADO_VERIFICADO_DRIVE observados en el manifiesto, además de publicación VERIFICADO/APROBADO, fecha/huella del corte, ID y checksum coincidentes. NO_APROBADO no se acepta.
19 comprobaciones de autorización/contrato aprobadas con Node. Verificación del manifiesto privado real contra el corte público del 26-10-2026 y SHA de cinco PNG originales y un PDF descargados de Drive. Integración con runtime Google simulado: 5 banners y 1 PDF servidos con bytes idénticos.
Chromium emulado 412×915: búsqueda SKU/marca/modelo, cinco imágenes a 1200px, filtro, descarga PNG/PDF, ausencia de desbordamiento y errores JS, bloqueo de ID arbitrario y versión anterior, revalidación antes de descarga y actualización en pantalla. Web Share comprobado con API simulada. Las capturas y fixtures privadas no se publican en este repositorio.

## Cuenta y privacidad
El propietario confirmó que ambos teléfonos usan la misma cuenta empresarial. Se entrega configuración privada para esa cuenta; no se necesita su correo personal en Apps Script. Una identidad compartida no permite revocar a cada trabajador por separado.
No hay contraseñas, correos de usuarios, IDs privados, manifiestos ni banners en el código público. No se usan GitHub Pages, triggers nuevos ni sincronizaciones horarias. La revisión cada 60 segundos solo opera con la pantalla visible. Archivos en memoria de sesión, sin service worker ni almacenamiento persistente comercial.
Las miniaturas usan los originales; cinco PNG suman unos 4 MB. Medir rendimiento en Android físico antes de aceptarlo.

## Instalación privada pendiente
No implementar producción sin aprobación de Supervisión General.
Crear un proyecto Apps Script independiente bajo la cuenta empresarial, copiar Code.gs, Index.html y appsscript.json. El paquete privado entregado incluye una función de configuración inicial para evitar copiar IDs manualmente. No subir ese archivo privado al repositorio.
La propiedad BANNERS_PRO_CONFIG contiene users, manifestId, rootId, approvedFolders y hubUrl. La única URL de corte admitida es https://conectatech-ec.github.io/datos-593/estado-ultimo-corte.json .
MYSELF/USER_DEPLOYING limita la instalación a la cuenta propietaria compartida. Session.getActiveUser().getEmail() debe ser esa cuenta; vacío o ajeno se rechaza. No retirar el control ante fallos.
El propietario puede obtener una URL /dev mediante Implementar > Probar implementaciones, restringida a editores. No agregar trabajadores como editores para dar acceso comercial. La herramienta conectada no ofrece creación/despliegue de Apps Script; falta autorización Google inicial y URL real.
Para evitar conflictos de varias cuentas, usar un perfil de Chrome exclusivo para la cuenta empresarial; comprobar avatar/correo antes de crear el proyecto. No depender de índices /u/0 o /u/1, que cambian según sesión.
El Site previo reservado sigue con versión 0, sin URL preview/live. Las URL desplegadas de Sites son producción y quedan fuera de esta entrega.

## Contrato existente
No se crea otra fuente de precios/inventario. Se compara fecha_datos/fuente_593_sha256 del manifiesto con fecha_corte/origen_sha256 del Hub.
Productos piloto TELF001, REL046, TARJ018, FLAS003, TELE001: estado APROBADO, material_vigente_verificado y disponibilidad_comercial verdaderos; publicacion_drive VERIFICADO con fecha/huella y checksum coincidentes. Carpeta, MIME, SHA y versión del original se validan en servidor.
PDF: estados exactos arriba, fecha_datos del corte y publicacion_drive.ligero verificada; ID y SHA iguales al archivo ligero. Diseño pendiente, corte anterior, alteración o aprobación ausente bloquean la entrega.
La galería no regenera materiales, cambia precios ni modifica la fábrica.

## Repetir pruebas
node prototipos/banners-pro-movil/contract.test.cjs
Las pruebas QA con originales requieren fixtures privadas externas y Playwright ya instalado; no incorporarlas al Git público. El servidor QA solo escucha en 127.0.0.1, usa una sesión SIMULADA y nunca debe desplegarse.
El Git remoto por CLI no estuvo accesible por conexión fallida al proxy. La rama y los commits se prepararon con el conector GitHub, sin tocar el checkout activo.

## Aceptación aún pendiente
OAuth y lectura de Drive desde Apps Script real, rechazo de una cuenta ajena, acceso desde ambos Android, añadir a pantalla de inicio, rendimiento y envío recibido en WhatsApp. Web Share abre el selector del sistema; no fuerza WhatsApp. La URL de prueba controlada aún no existe.
