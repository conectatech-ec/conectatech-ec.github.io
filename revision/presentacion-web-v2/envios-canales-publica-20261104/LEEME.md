# Envíos y canales oficiales — comprobación pública

Cambio de presentación del pie de página, PR [355](https://github.com/conectatech-ec/conectatech-ec.github.io/pull/355). Esta rama conserva la evidencia; no requiere fusionarse a main ni volver a desplegar.

- Corrección: `a0b27e6f2454323e0b99c45f990574f4f71bac3a`.
- Integración: `24bac20c0d4408c405eb50db0b086ebcc356ac4f` sobre main `2d41b31303840a1f45e3ffb28ec5046cc2ab15be`; el diff de index se limita a tres versiones de recursos de presentación. Conserva los 25 cambios de productos paralelos.
- Publicación: `cc71c0f3b356148fe410c9766a90c4060ba7f197`, [Pages 41894988228, intento 2](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/41894988228), correcto. Frente al estado integrado y auditado, el commit sólo añade el informe SEO.
- [Pie público](https://conectatech-ec.github.io/?presentacion=envios-oficiales-v31#contacto-oficial).
- [Comparación real antes/después](https://conectatech-ec.github.io/revision/presentacion-web-v2/envios-canales.html), HTTP 200.

`resultado.json` contiene 174 comprobaciones correctas, hashes de recursos públicos y medidas en 1440, 1100, 900, 768, 390 y 320 px. El navegador usa Chromium 154. Los recursos de la modalidad pública se descargan exclusivamente por HTTPS desde github.io; la referencia corresponde al main publicado, incluidos los cambios paralelos. Se conserva la esfera y el rótulo original, sin cambiar sus dimensiones. Se comparan encabezado, vitrina, destacados, catálogo, objetos comerciales y metadatos.

Se comprueban clics en ambos botones de WhatsApp y las tres redes a 1440/390 px mediante navegación interceptada: se verifica la URL de destino, sin enviar mensajes ni acceder a cuentas. Esto no certifica disponibilidad de servicios externos. El enlace al catálogo se comprueba esperando el desplazamiento suave real del navegador; el reloj JavaScript está pausado para estabilizar la rotación comercial y no controla el compositor.

Contactos y redes cotejados con configuración comercial existente e imagen del propietario. No se inventan tarifas, plazos, transportistas ni envíos gratuitos. Sin cambios en fotografías, títulos, precios, SKU, stock, publicación real o integraciones de otras sesiones.

Validación local archivada en `../envios-canales-20261104/resultado.json`: 186 comprobaciones. Controles existentes: 42 + 1567 + 264 correctos; CI de la corrección 41891728978 correcto.

El workflow ajeno de exportación del catálogo conserva un fallo previo en `scripts/test-orden-categorias-secundario-meta.cjs:63`, «Missing expected rejection». Ocurría antes de esta integración (41891503171) y después (41892030829). No se ha intervenido en esa integración ni se han reintentado sus acciones.
