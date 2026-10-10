## Estándar aprobado para todos los SKU — 10 de octubre de 2026

El propietario inspeccionó POWE003 y ADAP005 publicados y aprobó conservar este formato y las reglas fotográficas para todos los SKU. Referencias por hash en `importacion/estandar-comercial-aprobado.json`. Reutilizar `scripts/ficha-beneficios.cjs`: beneficios concretos y verificados en recuadros azul/verde, especificaciones y detalles desplegables. Acabado fotográfico limpio, atractivo y de producto nuevo; mostrar conexiones y controles sólo con referencias suficientes. Aplicar incrementalmente a las nuevas fichas y al actualizar existentes; no regenerar imágenes que ya cumplen.

Producción autorizada sin pedir nueva aprobación rutinaria: agrupar varios SKU aptos, reutilizar investigaciones cerradas, preparar antes de QA/publicación y continuar con otros cuando haya una excepción. Calidad y contrato v3 se mantienen; no prometer completar todos los SKU sin fuentes. Precios, stock, SKU, URLs, tarjetas 3/2, encabezado y banners intactos. Esta aprobación NO incluye los cinco maestros pendientes de premium-001.

## Prioridad comercial permanente — producto nuevo y beneficios primero

Orden del propietario 2026-10-10: pensar siempre desde el punto de vista vendedor. Embellecer y pulir fotografías propias para un acabado de producto nuevo: eliminar polvo, huellas, manchas de manipulación y luz pobre; preservar textura real, modelo, color comercial y hardware. Preferir ángulos que expliquen el producto (puertos, entradas/salidas, controles) cuando todas esas caras tengan referencias suficientes. Analizar cajas y vistas adicionales antes de elegir composición. No inventar caras ocultas, especificaciones ni garantías. Si la condición de venta fuese usada, no ocultarla.

Las fichas deben mostrar primero beneficios claros y características esenciales en recuadros legibles azul/verde; detalles técnicos, compatibilidad y contenido en apartados desplegables accesibles. Botones únicamente para acciones reales. Mantener las tarjetas compactas 3/2, encabezado y banners. Los beneficios se guardan con fuentes y especificaciones de respaldo en el contrato; aplicarlos incrementalmente a cada ficha revisada. POWE003: panel USB-A/USB-C/pantalla visible. ADAP005: limpieza y acabado impecable.

## Excepción más reciente — imágenes Yantech sin marca

Orden expresa del propietario (2026-10-10): retirar el nombre Yantech / YAN TECH y su logotipo de todas las imágenes comerciales de sus productos. Conservar originales intactos y geometría/hardware. Esta excepción prevalece sobre conservar logotipos exclusivamente para Yantech. Registrar cada SKU identificado con `scripts/reglas_sku.py --marca Yantech --sku SKU --evidencia FUENTE --aplicar`; `reglas-sku.json` conserva la política general y el historial. Revisar cada maestro y guardar `revision_marcas.Yantech` con SHA-256, sin_texto, sin_logotipo y evidencia; el pipeline rechaza medios y banners sin esa revisión. No modificar nombres, precios, stock o URL por esta excepción visual.

# Fuentes auténticas y acabado comercial — orden vigente

El propietario cambió la estrategia el 2026-10-10 y adjuntó `Reporte-visual-CONECTATECH(2).html`. Se inspeccionaron sus seis imágenes: luz de estudio, producto limpio, volumen natural y perspectiva comercial. Esta orden prevalece sobre la espera global y la cuadrícula 5/2 anteriores.

1. Identificar cada SKU usando 593, Registro y todas las fotos necesarias de sus cajas. Reutilizar identidad y fuentes ya cerradas; consultar únicamente cambios.
2. Priorizar la imagen auténtica del modelo y variante exactos en fabricante o distribuidor. Reutilizar permisos documentados por fuente. No confundir acceso público con permiso ni afirmar licencias inexistentes.
3. Revisar hasta tres fuentes y dedicar aproximadamente tres minutos a la búsqueda inicial por SKU. Si los permisos externos no están resueltos, registrar `PENDIENTE_DERECHOS`, conservar la evidencia y seguir otro SKU. No enviar solicitudes a terceros ni detener la cola esperando respuestas.
4. Usar las fotografías propias autorizadas como alternativa. Se permite edición asistida por IA con mayor libertad en iluminación, balance de blancos, brillo, contraste, saturación natural, fondo, limpieza, encuadre y sombras. Mostrar un acabado atractivo de producto nuevo. No es necesario copiar dominantes de color o iluminación de la caja. Mantener el color de la variante comercial, modelo, hardware, logotipo, puertos y accesorios reales; no ocultar una condición usada confirmada como si fuera nueva.
5. Todos SIN CAJA. No usar una foto de producto de marca original para un AAA distinto. Original/Caja original del Registro sigue acreditando clasificación comercial por instrucción del propietario.
6. Producir únicamente medios aptos, completar contrato v3, revisión visual, tamaños responsivos, QA real móvil/escritorio y verificación HTTP de Pages. La fecha reciente se registra sólo después de publicación verificada de un cambio real.

## Presentación

Tres columnas en escritorio, dos en móvil; fotografía más grande con `contain`. Nombre breve, PROMO CONTADO destacada, PVP secundario sin tachar y acceso a la ficha. No incorporar especificaciones largas en las tarjetas. Conservar encabezado y banners. No renovar fechas de SKU por este cambio general de CSS.

## Continuidad

`estrategia-comercial.json` guarda esta política y el límite operativo de 30 candidatos; es un máximo, no una cuota de publicación. No forzar volumen ni regresar a un pendiente sin nueva evidencia. `cola-drive.json`, contratos y reportes continúan siendo la base incremental.

La rama `revision/premium-001` y sus cinco propuestas se conservan sin merge. El comentario del propietario no se registra como aprobación individual de esos maestros: las serigrafías de MOUS039 y textura de SOPO009 siguen pendientes. Los nuevos SKU validados pueden avanzar sin esperar a ese lote. El control `premium_guard.py` conserva el bloqueo de sus hashes pendientes y mantiene las validaciones del contrato para la producción nueva.

Reanudar desde main actual, esta estrategia, `lote-activo.json` y las huellas de cola. Publicar sólo resultados aptos y registrar pendientes concretos; no declarar fotos publicadas por un commit.
