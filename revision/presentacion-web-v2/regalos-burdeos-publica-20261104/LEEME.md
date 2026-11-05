# Regalos compactos — publicación comprobada

El propietario aprobó expresamente la propuesta: «si apruebo y aplica». [PR 357](https://github.com/conectatech-ec/conectatech-ec.github.io/pull/357), fusionada y publicada.

- Propuesta visual aprobada: `076d30ae59ff52ef15256af7e0f9b7c01e2622f4`; su CSS permanece idéntico.
- Cabeza final con aprobación y caché CSS v32: `ea1e049ecce8a00aab974d46fe3fb13edbfd262d`. CI [41965392034](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/41965392034) correcto.
- Integración normal: `b80e6544a389e7f96fd3bddddf793fb3d98b2fc5`, sobre main actualizado `93eb7760ef7852a38538d5a9bcb0479552d101e5`. El único cambio de index es la versión del CSS, de v31 a v32.
- Fuente publicada: `8b72b3009738988f3d29fc2be7ab472faceb3954`. Frente a la integración sólo añade el informe SEO automático, sin cambiar la página ni sus recursos.
- [Pages 41965706618](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/41965706618), intento 1: build, deploy y report-build-status correctos.
- [Sección pública](https://conectatech-ec.github.io/?presentacion=regalos-v32#regalos-tienda).

189 comprobaciones públicas correctas en Chromium 154, en 1440/1100/900/768/600/390/360/320 px. El HTML, CSS v32 y PNG original servidos coinciden por SHA con la fuente aprobada. El navegador de la modalidad pública descarga exclusivamente los recursos HTTPS públicos, sin sustituciones por archivos locales. Se compara su presentación y contenido con la fuente aprobada: sección, encabezado, vitrina, destacados, confianza, catálogo, pie, productos y metadatos.

Altura pública: 641,5 px en escritorio 1440 (antes 802,9; −20,1 %); 446,0 px en móvil 390 (antes 560,5; −20,4 %); 424,5 px en móvil 320 (antes 534,9; −20,6 %). La reducción en los ocho tamaños va de 20,1 a 23,1 %. Fondo exterior de degradado, sin imagen decorativa. Banner completo y original, sin recortar; legible y ampliable.

En escritorio, móvil y móvil pequeño se comprueba apertura y cierre del banner, misma imagen original ampliada, condiciones desplegadas sin recorte y destino correcto del botón WhatsApp. El enlace externo se intercepta para verificarlo sin enviar mensajes. Capturas reales y medidas/huellas en este directorio. La comparación antes/después aprobada se conserva en `../regalos-burdeos-20261104/`.

La exportación multicanal tiene un fallo preexistente en `scripts/test-orden-categorias-secundario-meta.cjs:63`: «Missing expected rejection». Se comprobó la misma incidencia antes del cambio (41900348206, job 126820754850) y después (41965565386, job 127041656810). No se modifican ni se reintentan sus integraciones. Esta incidencia no impide la publicación de Pages ni las comprobaciones de presentación.

Esta rama sólo archiva evidencia; no fusionarla ni desplegarla. Se conservan banner, montos, regalos, condiciones, marca y fuente originales, encabezado, fotografías, títulos, SKU, stock, precios, fechas de publicación, SIGNATURE, Data Hub, 593 y demás automatizaciones. Sin servicios nuevos; costo adicional $0.
