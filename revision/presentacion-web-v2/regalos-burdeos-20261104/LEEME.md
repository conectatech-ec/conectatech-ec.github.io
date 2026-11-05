# Regalos — propuesta burdeos, negro y dorado

**Pendiente de aprobación visual del propietario. No fusionar ni desplegar.** Orden expresa: preparar la comparación y conservar producción hasta su aprobación.

Abrir `comparacion.html` en el navegador. Es un archivo autónomo: incorpora capturas reales de escritorio, móvil y móvil pequeño, la marca original y una prueba interactiva de la sección con el banner y las condiciones existentes. Funciona sin conexión y no requiere servicios ni costo adicional. Los botones del selector muestran ambas capturas a la misma escala; se pueden ampliar. «Probar propuesta» permite abrir el banner original y desplegar las condiciones. Su acceso a WhatsApp conserva el destino oficial y, si se pulsa, requiere conexión.

La implementación propuesta sólo añade un bloque de CSS a `assets/presentacion-web/estilos.css`, con selectores exclusivos de `.pw-campaign.pw-campaign--compact`. Sustituye el fondo decorativo exterior por un degradado burdeos/negro, bordes dorados discretos y sombra suave. Compacta encabezado, márgenes, leyenda y franja de accesos. En móvil el domicilio ocupa una fila completa; condiciones y consulta comparten la siguiente. Al abrir condiciones se usa una columna para mostrar el texto completo. No se alteran nodos, textos ni listeners de producción.

| Ancho | Altura actual | Propuesta | Reducción |
| --- | ---: | ---: | ---: |
| 1440 px | 802,9 px | 641,5 px | 20,1 % |
| 1100 px | 802,9 px | 641,5 px | 20,1 % |
| 900 px | 802,9 px | 641,5 px | 20,1 % |
| 768 px | 727,8 px | 577,0 px | 20,7 % |
| 600 px | 692,3 px | 532,3 px | 23,1 % |
| 390 px | 560,5 px | 446,0 px | 20,4 % |
| 360 px | 539,3 px | 424,7 px | 21,2 % |
| 320 px | 534,9 px | 424,5 px | 20,6 % |

En escritorio la imagen completa pasa de 778 a 658 px de ancho y sigue centrada; no se recorta ni deforma. En móvil de 390 px pasa de 340 a 346 px. Se conserva la ampliación del original. La leyenda y el botón mantienen sus textos y destinos.

Base: `93eb7760ef7852a38538d5a9bcb0479552d101e5`. El HTML público, CSS v31 y PNG original se cotejaron por SHA-256 con esa base; están documentados en `procedencia.json`. Son comparaciones del diseño publicado, sin productos ni promociones ficticias.

Validación: 114 comprobaciones Chromium 154 en ocho anchos. Integridad de HTML, textos, condiciones, imágenes, URLs, productos, metadatos y secciones ajenas; carga del banner completo, ausencia de desbordamientos, condiciones desplegables, ampliación/cierre y destino de consulta WhatsApp. El enlace externo se comprueba con navegación interceptada, sin enviar mensajes. `resultado.json` conserva medidas, comprobaciones y huellas SHA de datos comparados, evitando duplicar el catálogo. `comparacion-verificada.json` documenta controles del archivo entregable sin peticiones externas.

El encabezado, logo original, fuente Ethnocentric, vitrina, destacados, catálogo, fotografías promocionales originales, montos, regalos, condiciones comerciales, SIGNATURE, Data Hub, 593 y automatizaciones no se modifican. `index.html` permanece intacto; no hay nueva versión pública del CSS. Tras aprobación, integrar sobre main actualizado y hacer únicamente el cambio selectivo de versión necesario para la caché, manteniendo avances de otras sesiones.
