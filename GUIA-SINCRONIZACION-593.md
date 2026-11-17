## Exclusión de publicación por marca — orden15nov2026

STEREN está excluida de la web, sus fichas, sitemap y exportaciones. Aplicar `scripts/politica-publicacion-web.cjs` en los generadores existentes. ENCH003, FLAS013, FLAS014, FLAS017, FLAS033 y FOCO004 no se publican, aunque tengan stock o aparezcan en un Excel posterior.

El corte validado del Hub conserva su inventario completo y los SKU históricos: al preparar un corte nuevo, cubrir la unión de sus SKU canónicos anteriores y los SKU web actuales; no obtener la cobertura únicamente del catálogo visible. Conservar los valores593 de los excluidos. El publicador reconstruye su comparación desde el histórico Git existente; no modificar el inventario para retirar productos de la web. SIGNATURE y originales permanecen intactos.

# CONECTATECH — Sincronización autorizada desde 593

Fuente vigente: `datos-593/REFERENCIA-OFICIAL.md`.

La exportación vigente incorpora los importes finales explícitos `promo_contado` y `pvp_final` además de `sku,nombre,stock,precio_general,iva,tipo,categoria,clasificacion`. No volver a calcular PVP con la fórmula histórica.

La solicitud expresa del propietario autorizó el corte 10-10-2026. Se conserva el Excel original fuera del repositorio público. La carga depurada verificable está en `datos-593/corte-2026-10-10.json.gz`. El script de aplicación rechaza fuentes alteradas, SKU duplicados y sobrescrituras de precios concurrentes.

El workflow de este corte se limita a sus datos y es idempotente. No constituye autorización general para importar otras exportaciones. Las futuras sincronizaciones requieren un nuevo corte validado y autorización, y conservan precios explícitos, fotos, títulos, URLs y registros de revisión. Las altas se procesan aparte.

## Revisiones ordinarias y ejecución urgente — orden16nov2026

Dirección General autoriza la validación general de cortes ordinarios y revisiones posteriores del mismo día; no se necesita añadir su SHA al código. Se conserva el publicador original, grupo `publicacion-stock-593-web`, revalidación contra `main` y push sin force. Los dos pares SHA autorizados históricamente son compatibilidad de cortes antiguos, no el mecanismo para cargas futuras.

El validador existente debe incluir `revision_fuente` en cada corte nuevo. Campos: `version:1`, `anterior_sha256` igual al último estado publicado, `secuencia` anterior+1 (inicial1), `generado_en` y `recibido_en` ISO UTC con Z, `evidencia:"XLSX_CORE_CREATED_EQUALS_MODIFIED"`. Reutilizar `report_identity.confirm_cut` del procesador ya existente para obtener hora de exportación y corroborar core.created==core.modified después de validar estructura. Drive.modifiedTime o la hora de descarga **no** acreditan hora de inventario. No publicar IDs, enlaces privados, costos ni Excel en este recibo.

Si el estado histórico aún carece de recibo, una revisión intradía requiere `anterior_confirmado:{sha256,generado_en,evidencia}` obtenido del XLSX privado previo cuyo SHA coincide con el estado. No inventar esa hora con la fecha del commit o recepción. Después el publicador conserva el recibo en el estado automáticamente. Dos revisiones sucesivas requieren una exportación estrictamente posterior, secuencia consecutiva, recepción posterior y enlace al SHA vigente. Un cambio concurrente obliga a releer/revalidar la fuente; no reparar el enlace simplemente sustituyendo un campo. SHA ya publicado históricamente se rechaza. Igual SHA vigente es idempotente y no renueva fechas. Las barreras de cobertura exacta/mínimo1000 continúan; se reutiliza también el control500/90%/500bajas, sin reducir las anteriores.

El estado registra `sku_modificados_comerciales`: sólo stock, Promo Contado o PVP realmente diferentes. La supervisión entrega a SIGNATURE esos SKU mediante issue91/recibos existentes; una fecha de corte distinta, recepción nueva o cambio de ZIP sin cambios comerciales no ordena regenerar toda la biblioteca. La Fábrica conserva su control independiente de nuevas fotografías aprobadas. Los precios siguen siendo importes finales593: Promo deQ y PVP deX+Y, sin IVA ni fórmulas adicionales. Exclusiones comerciales vigentes intactas.

**Detección:** actualmente sólo se verificó la supervisión horaria existente; el proyecto/activador real del observador Drive no está accesible en estas herramientas. No se ha instalado otro cron, receptor o publicador. La biblioteca piloto de120s no era un activador. Para alcanzar aproximadamente5min debe conectarse el adaptador del observador existente y sustituir su único trigger por `everyMinutes(5)`; no añadir otro. Son288escaneos de metadatos/día; sin cambio, cero descargas o Actions. Cuotas personales compartidas:90min/día de triggers,20.000UrlFetch/día. Tiempo de2–5s/escaneo consumiría9,6–24min/día, condicionado al consumo total real. No hay garantía de puntualidad exacta de triggers.

**SINCRONIZAR AHORA:** la tarea privada existente «Sincronización multicanal593» admite la ejecución inmediata nativa mediante `run_now`; debe reutilizar su misma entrada, validaciones, publicador y mutex. Si ya hay una ejecución en curso, esperar/reutilizarla; no lanzar otra. No se crea un botón en un panel ajeno ni una automatización adicional. `workflow_dispatch` del publicador sólo republica el corte validado ya recibido: no descubre Excel en Drive. El endpointretry del receptor tampoco descubre archivos nuevos. El observador podrá exponer el mismo handler en su control privado cuando su proyecto sea accesible; no se declara botón instalado.

Mediciones16nov: publicador2:06–3:01; GitHub Pages añade aproximadamente8–10min. Totales observados desde commit/merge del corte hasta Pages10:22–13:11. No hay timestamp de detección/validación suficiente para atribuir una latencia real desde Drive. Cinco minutos de detección no garantizan cinco minutos de publicación.

Rollback: revertir este cambio mediante PR normal. Conservar recibos y cortes actuales, no promover XLSX antiguo ni retirar exclusiones. El workflow y su mutex originales se mantienen; no se modificaron Cloudflare, triggers, Fábrica, Merchant ni Compras Inteligentes. La restauración del bloqueo anterior volvería a exigir revisión para nuevos SHA intradía, no autoriza restituir precios viejos.
