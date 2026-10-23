# Disponibilidad web — integración

La web consume el stock ya integrado por el proceso central `datos-593/corte-stock-validado.json` → `scripts/aplicar-corte-stock.cjs` → catálogo. No importa otro inventario ni mantiene una base alternativa. El PR #89 incorporó el corte oficial 21/10/2026 (1.554 SKU fuente, 1.170 relacionados con la web). Esta capa no reaplica ni modifica ese corte.

`assets/disponibilidad-core.js` es el motor compartido de presentación comercial, derivado del motor aprobado. Clasifica stock positivo, cero, negativo, sin datos y descontinuado con evidencia. No aplica vencimientos al stock positivo. No representa una reserva ni confirma compras. La adaptación web no activa transportes de otros canales.

El catálogo muestra disponibles por defecto, permite incluir agotados y encuentra todos los estados al buscar. Las fichas conservan URL, contenido editorial, imágenes y valores financieros. Un agotado muestra «Temporalmente agotado», «Consulta cuándo estará disponible nuevamente» y el enlace de reposición a WhatsApp 0998576759. Los precios anteriores quedan conservados en el HTML, ocultos como oferta comercial. El stock negativo muestra «No disponible». No hay cantidades en los avisos comerciales. Los enlaces de consulta no envían mensajes automáticamente.

`scripts/generar-seo.cjs` aplica `scripts/disponibilidad-web.cjs` después de las plantillas vigentes: no sustituye fichas ni integra ramas editoriales. El proceso existente de nuevos cortes validados vuelve a generar estas fichas. Un stock 5 → 0 → 3 cambia estado y elegibilidad sin aprobación por SKU; conserva la misma URL. Si la validación del corte falla, el importador rechaza la escritura y mantiene el catálogo publicado. Los errores se registran en GitHub Actions, sin avisos técnicos al comprador. Debe mantenerse el control administrativo de esas ejecuciones; esta entrega no añade servicios ni notificaciones externas.

Publicar esta integración con `[solo-web]` en el mensaje de integración evita que el workflow general de exportación regenere otros canales por el cambio de presentación de `index.html`. No se desactivan los procesos preexistentes de otras sesiones. Alex, SIGNATURE, PDF, Meta, Merchant, WebStore y Marketplace no reciben activaciones por esta entrega.

Verificaciones locales:

```sh
node scripts/test-disponibilidad-web.cjs --base=COMMIT_ANTERIOR
node scripts/test-venta-cruzada.cjs
PLAYWRIGHT_MODULE=/ruta/playwright node scripts/verificar-disponibilidad-web.cjs
```

El último comando usa el servidor local de prueba en 127.0.0.1:8767; `--public` verifica GitHub Pages sin sustituir su HTML ni sus scripts. Intercepta exclusivamente el destino WhatsApp para comprobar la apertura y el mensaje sin enviar comunicaciones. Chromium debe estar instalado; `CHROMIUM_PATH` permite indicar su ruta.

La prueba de preservación compara los 1.170 productos, títulos, metadatos, imágenes, canonicals, schema y precios contra la base de integración. Las simulaciones se ejecutan en memoria. La prueba de navegador verifica escritorio y móvil, toda la paginación, búsquedas, filtro, fichas y enlaces. La publicación sólo se declara después de GitHub Pages exitoso y comprobación HTTP/Chromium pública.

Reversión: revertir el commit de esta capa y regenerar las fichas desde la plantilla anterior. No revertir el PR #89 ni los cortes posteriores. Si existen cambios editoriales posteriores, aplicar la reversión sólo al motor, ganchos y estilos, y regenerar desde el catálogo vigente; no recuperar fichas históricas completas.

QA de cortes sucesivos: las pruebas consultan la referencia indicada por `estado-ultimo-corte.json` y delegan en el importador central correspondiente. No fijan permanentemente fecha ni cantidades del corte inicial. Esto permite verificar la actualización comercial del 22/10/2026 incorporada por supervisión sin volver al corte anterior ni cambiar stock o precios desde esta capa.
