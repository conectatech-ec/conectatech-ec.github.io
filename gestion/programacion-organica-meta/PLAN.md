# Programación comercial orgánica de CONECTATECH en Meta

Versión para revisión del 28 de octubre de 2026. Estado: PREPARADO, PENDIENTE DE AUTORIZACIÓN FINAL. No se crearon borradores, publicaciones ni programaciones en Meta.

## Decisión y alcance

Usar la interfaz oficial gratuita de Meta Business Suite para preparar y, sólo tras la autorización final, programar tres campañas orgánicas con foto y texto en la Página de Facebook y el perfil profesional de Instagram de CONECTATECH. El piloto comprende tres piezas y seis destinos. Costo adicional previsto: $0; trabajo manual con herramientas y material existentes, sin suscripciones, anuncios ni infraestructura nueva.

Destinos confirmados por Dirección General: Página empresarial Facebook CONECTATECHec e Instagram @conectatech.ec, https://www.instagram.com/conectatech.ec/ . Ambas cuentas están vinculadas al portafolio comercial Conectatech según confirmación del propietario. La URL o ID exactos de Facebook y los permisos efectivos se comprobarán dentro de la cuenta antes de activar; no se inventan enlaces. Esta comprobación no detiene la preparación. La consulta de los productos del Catálogo Maestro existente no crea publicaciones orgánicas ni demuestra su estado en Planner.

Trabajar en la rama `codex/meta-programacion-comercial-20261028`, sin integrar a main. No intervenir en MARKETPLACE ACTIVACIÓN, Fábrica de Banners, ALEX o Disponibilidad Inteligente. No ejecutar sincronizadores, regeneradores, feeds ni cambios de catálogo. No crear una base, integración, aplicación, automatización, tarea periódica o nuevo calendario conectado.

## Fuentes y responsabilidades

Sistema 593 y el Data Hub existente conservan la autoridad sobre precio y disponibilidad. El flujo sólo los consulta. No se identificó un acceso independiente verificable al Data Hub; las comprobaciones actuales deben hacerlas el responsable comercial y el operador en sus accesos existentes. No reemplazarlo por este expediente.

Se reutilizaron las fuentes estables del repositorio: `datos-593/corte-stock-validado.json` (stock del 27/10/2026), `datos-593/corte-comercial-publico-validado.json` (precios del 26/10/2026), `importacion/contratos/{SKU}.json`, `exportaciones/contenido-multicanal.csv` y `exportaciones/meta-catalogo-piloto.csv`. El corte histórico de los contratos no sustituye al corte de stock más reciente. No recalcular PVP ni IVA.

Catálogo Maestro documentado: ID 1036301566100990. Conservar el único feed existente: https://conectatech-ec.github.io/exportaciones/meta-catalogo-piloto.csv . El ID procede de la configuración del repositorio; no fue comprobado en Commerce Manager. Si la cuenta no coincide, detener y resolver; no crear otro catálogo.

Medios: una copia sin edición del maestro PNG aprobado de CABL113 y dos banners de la biblioteca oficial, TARJ003-Signature-1200.png y REL046-Signature-1200.png. El paquete privado de revisión contiene las copias, la procedencia y las huellas. No se altera la biblioteca. El banner CABL113 se retiene porque contiene «hasta 3A» sin especificación publicable en el contrato vigente; se usa su foto aprobada sin esa cifra.

Dirección General aprueba piezas, medios, destinos y fechas. El responsable comercial comprueba 593, Data Hub y vigencia. El operador con permisos en Meta programa y lee de vuelta los resultados. Una persona puede asumir ambos roles operativos, pero debe completar cada control.

## Auditoría de las funciones oficiales

Auditoría parcial. No hay conector Meta ni navegador disponible; la política de red del entorno permite GitHub y Drive, y excluye los hosts Meta. No se leyó la documentación oficial actual ni se accedió a Business Suite. La tabla es una guía de capacidades conocidas y verificaciones pendientes, no una certificación de la cuenta o de límites vigentes. No se fijan límites numéricos de anticipación ni se promete aceptación del formato sin probarlo en el compositor.

| Función | Uso en el piloto | Comprobación en la cuenta |
|---|---|---|
| Crear publicación con imagen y texto | Tres piezas orgánicas de feed | Que el compositor permita publicar en cada activo |
| Elegir Facebook e Instagram y adaptar texto | Versiones distintas por plataforma | Perfil profesional vinculado, ID/URL y permisos de contenido |
| Planificador y contenido programado | Revisar fechas y colisiones | Consultar también otras campañas y publicaciones nativas |
| Programar para más tarde | Fecha y hora específicas | Zona, rango admitido y controles efectivos de la interfaz |
| Borradores | No necesarios para esta preparación local | Opcional sólo si se autoriza guardarlos en Meta |
| Editar, reprogramar o eliminar pendientes | Correcciones y suspensión por agotados | Operación disponible por formato y destino |
| Estadísticas | Medir resultados por plataforma | Alcance, interacciones, clics u otras métricas realmente disponibles |
| Reels, Stories y etiquetas de producto | Fuera del piloto | No son requisitos; no activar funciones nuevas |

Accesos oficiales para cerrar la revisión con la sesión empresarial: https://business.facebook.com/ , https://www.facebook.com/business/tools/meta-business-suite , https://www.facebook.com/business/help/ y https://help.instagram.com/ . Son referencias de acceso, sin lectura verificada en esta sesión.

No se implementan APIs de publicación: requerirían una autorización e integración adicionales y no aportan valor al piloto manual. Los conectores oficiales de GitHub y Google Drive sólo se usan para preparar el expediente; la programación futura se realiza en la interfaz nativa de Meta.

## Frecuencia y calendario inicial

Dos campañas por semana como máximo para este piloto, separadas al menos 72 horas en cada red. Cada campaña se distribuye una vez en cada destino. Las horas son hipótesis para comparar, no horarios óptimos demostrados. Revisar la agenda global; si ya hay una promoción comercial cercana, desplazar la pieza sin comprimir el calendario. No sumar publicaciones automáticas de Stories o Reels.

| Pieza | Producto | Fecha propuesta | Hora Guayaquil | UTC | Destinos |
|---|---|---|---|---|---|
| P01 | CABL113, cable USB-C de 1 m | Martes 03/11/2026 | 12:30 | 17:30 | Facebook e Instagram |
| P02 | TARJ003, microSDXC HP de 64 GB | Viernes 06/11/2026 | 18:30 | 23:30 | Facebook e Instagram |
| P03 | REL046, Infinix XWATCH H4 | Martes 10/11/2026 | 12:30 | 17:30 | Facebook e Instagram |

Zona obligatoria: America/Guayaquil, UTC−05:00. Intervalos: 78 y 90 horas. Fechas sujetas a autorización y validación de la agenda real. Si una fecha vence o requiere cambio, obtener aprobación de la nueva fecha; no publicar inmediatamente ni desplazar las tres en bloque por defecto. Tras el piloto no se dejan recurrencias activas.

## Controles de stock y duplicados

En cada control consultar las fuentes vigentes: SKU exacto, venta permitida, stock comercial disponible, precio contado, PVP, unidad de venta, variante, medio y vigencia. Guardar sólo la referencia y hora de esa consulta; no copiar el inventario ni añadir columnas al Data Hub.

El responsable comercial valida al aprobar y el operador valida inmediatamente antes de programar, el día anterior a cada salida y entre 30 y 60 minutos antes de la hora prevista. Si no hay una persona disponible para esa revisión, no activar la pieza. Si existe agotado, reserva que impide vender, fuente desactualizada o discrepancia, poner EN_ESPERA y cancelar/reprogramar el pendiente. No anunciar cantidades del corte histórico. Meta no se trata como control de inventario: no se promete cancelación automática al agotarse.

Para deduplicar, revisar Publicadas, Programadas, Borradores y Planificador de ambos destinos y otras acciones orgánicas existentes, incluidas las realizadas directamente en Instagram. Buscar SKU, nombre, texto y medio. No repetir el mismo SKU en el mismo destino dentro de 14 días durante el piloto; si existe una campaña previa, retener o sustituir con nueva aprobación. Revisar también futuros pendientes, aunque estén fuera de esos 14 días. Misma pieza en Facebook e Instagram es distribución prevista, no duplicado.

La clave de revisión es pieza + SKU + medio/texto + destino; la fecha por sí sola no justifica repetir. Las huellas del medio y de cada texto en el expediente ayudan a comparar, pero no sustituyen la inspección del historial de Meta. El cruce social no pudo comprobarse en esta sesión.

## Procedimiento para activar en Meta

Los nombres de controles pueden variar según idioma o versión. Si una opción no aparece, detener ese paso y consultar la ayuda oficial desde la cuenta; no sustituirla por una integración externa.

1. Abrir Business Suite con el usuario autorizado, seleccionar la empresa de CONECTATECH y confirmar la Página de Facebook y el perfil profesional de Instagram vinculados. Registrar URL/ID reales en las seis filas del calendario y comprobar permisos para contenido. No modificar vínculos o accesos como parte de este piloto.
2. Abrir Contenido y Planificador. Completar la deduplicación y revisar la agenda global. Consultar el Catálogo Maestro existente en Commerce Manager para comprobar ID, SKU, enlace, imagen y disponibilidad; contrastar con 593/Data Hub. Una discrepancia bloquea la pieza, no autoriza reparar fuentes aquí.
3. Completar la revisión comercial actual y abrir los archivos del paquete. Verificar nombre y SHA-256 del medio, texto de cada destino y precio dentro de los banners. Si un banner ya no coincide, retenerlo; no modificar la Fábrica ni tapar el precio. Una foto alternativa requiere aprobar la nueva pieza.
4. Presentar a Dirección General la versión exacta: P01–P03, huellas de medios/textos, fechas/horas/zona y URL/ID de cada destino. Registrar la autorización explícita. La aprobación del plan o de un banner histórico no sustituye la autorización de programar estas piezas. Hasta aquí no guardar nada en Meta.
5. Tras esa autorización, abrir Crear publicación. Elegir únicamente los dos activos confirmados. Adjuntar el PNG de la pieza y pegar su Facebook.txt e Instagram.txt usando la personalización por plataforma, si aparece. Si no permite textos distintos, usar dos compositores, uno por destino; no dejar además una copia cruzada.
6. Ver las dos previsualizaciones: SKU y producto correctos, una unidad, texto completo, precios, imagen sin recorte, color no garantizado en REL046 y lectura clara del banner. Añadir el texto alternativo si el compositor lo permite. Usar el enlace de ficha en Facebook; Instagram invita a mensaje con el SKU y no depende de un enlace clicable en el pie ni de cambiar la biografía. Confirmar en las dos vistas que no se activa promoción pagada.
7. Elegir Opciones de programación o Programar para más tarde. Introducir la fecha y hora aprobadas para cada destino. Leer la zona que muestra la interfaz y cotejar el instante UTC del calendario. Si Meta no admite ese intervalo o medio, detener; no cambiar fechas o archivos sin revisión. No pulsar Publicar ahora.
8. Pulsar Programar una sola vez para esa pieza. Esperar el resultado. Si hay demora, timeout o estado ambiguo, no repetir el clic ni crear otra publicación: conciliar primero con Programadas, Planificador y Publicadas.
9. Abrir la pieza resultante en Contenido → Programadas o Planificador. Leer por separado para Facebook e Instagram: cuenta exacta, fecha completa, hora/zona, texto, imagen y estado. Registrar ID o URL de gestión que Meta exponga y evidencia de lectura (captura o referencia privada). Si no muestra ID, conservar captura y ruta de acceso, sin inventarlo. Marcar PROGRAMADO_VERIFICADO sólo tras esta lectura.
10. Repetir con las otras dos piezas. Deben quedar tres campañas, con seis destinos verificados; Meta puede agrupar tarjetas. Si Facebook quedó correcto e Instagram falló, reparar sólo Instagram después de conciliar; conservar la programación correcta.
11. Ejecutar los controles previos a la salida. Si cambia stock, precio, color o vigencia, eliminar/cancelar la programación pendiente o reprogramarla desde Meta según las opciones disponibles. Reabrir para comprobar que ya no saldrá en la fecha anterior y registrar el motivo. Una nueva oferta, medio o fecha necesita la aprobación correspondiente.
12. Después de la hora, comprobar la publicación real en cada perfil y guardar el permalink. Si no aparece, marcar ERROR/EN_REVISION y consultar el resultado antes de reintentar. Registrar PUBLICADO_VERIFICADO sólo cuando el permalink y el contenido se lean correctamente.

## Estados y errores sin duplicar el Data Hub

Planner/Contenido de Meta será la fuente operativa de las publicaciones reales. `calendario-piloto.csv` es una hoja de trabajo limitada a seis destinos; no es inventario, base, importador ni sincronización. Después de aprobar, completar y conservar una sola copia privada junto al expediente o en la bitácora operativa existente. No escribir ID de gestión, capturas, tokens o incidencias internas en el repositorio público. No crear otro registro paralelo si ya existe uno para estas piezas.

Estados: PREPARADO_PENDIENTE_AUTORIZACION → AUTORIZADO → PROGRAMADO_PENDIENTE_VERIFICACION → PROGRAMADO_VERIFICADO → PUBLICADO_VERIFICADO. Alternativas: EN_ESPERA, ERROR, CANCELADO. Un mensaje incierto se registra como EN_REVISION y exige conciliación; no equivale a fallo definitivo. Cada cambio conserva responsable, hora, referencia de autorización y evidencia. En responsable se identifica al operador; en historial_estados se añaden transiciones fechadas sin borrar entradas anteriores. error_y_accion describe la incidencia y la acción correctiva. Un estado real sólo se asigna por lectura de Meta.

| Incidencia | Acción exacta |
|---|---|
| Stock insuficiente, fuente incierta o precio cambiado | Retener y cancelar pendiente; validar y pedir aprobación de la nueva pieza |
| Cuenta incorrecta o falta de permisos | No programar; resolver con administrador por el canal habitual |
| Medio rechazado o recorte problemático | Retener; usar alternativa aprobada, sin conversión o rediseño improvisado |
| Timeout o resultado incierto | Buscar primero la operación existente en ambas redes; no duplicar |
| Éxito parcial en una red | Registrar ambas situaciones y reparar sólo el destino que falta |
| Duplicado encontrado | Conservar la pieza autorizada correcta; cancelar el excedente y leer de vuelta |

## Medición y decisión de continuidad

Revisar cada destino a las 48 horas y realizar una evaluación conjunta el 17/11/2026, una semana después de la tercera pieza. Es una revisión manual, no una tarea creada. Usar Insights de Meta y las consultas comerciales que ya registre el negocio. Anotar alcance, interacciones, guardados si aparecen, clics disponibles en Facebook, mensajes/consultas que mencionen SKU y señales negativas que Meta muestre. No atribuir ventas sin evidencia ni comparar números absolutos entre redes como si fueran equivalentes.

Mantener dos campañas semanales si el piloto genera consultas útiles y la operación puede revisar stock y responder. Reducir a una o pausar ante quejas de saturación, errores comerciales o falta de capacidad de atención. Considerar tres sólo tras al menos cuatro semanas de datos, mejora consistente dentro de cada plataforma y nueva aprobación. Tres piezas no bastan para afirmar causalidad o fijar un horario óptimo.

## Condiciones de cierre y autorización

Preparación terminada cuando textos, precios de corte, medios, calendario, huellas y procedimiento coincidan. Activación pendiente mientras falten URL/ID exactos de Facebook, comprobación efectiva de cuenta/funciones, deduplicación real, revisión actual de 593/Data Hub y autorización final. La Página CONECTATECHec e Instagram @conectatech.ec ya están identificados por Dirección General; el vínculo con el portafolio Conectatech está confirmado por el propietario.

Modelo de autorización a completar: «Autorizo programar P01 CABL113, P02 TARJ003 y P03 REL046, versión 28/10/2026 y huellas del expediente, en la Página Facebook CONECTATECHec ([URL/ID exacto confirmado en Meta]) y https://www.instagram.com/conectatech.ec/, el 03/11/2026 12:30, 06/11/2026 18:30 y 10/11/2026 12:30, America/Guayaquil, sólo si siguen vigentes precio, stock, medios y controles. Sin publicidad pagada». La firma o respuesta debe ser explícita; no se presume por silencio.
