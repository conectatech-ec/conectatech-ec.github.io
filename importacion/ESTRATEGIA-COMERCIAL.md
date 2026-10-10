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
