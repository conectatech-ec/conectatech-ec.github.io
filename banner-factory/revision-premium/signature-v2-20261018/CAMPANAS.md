# Campaña aprobada BLACK MONTH 2026

Reutiliza tema_campana.py del motor SIGNATURE. No es una segunda fábrica.

Diseño aprobado por el propietario: cinta negra, dorada y roja debajo del logo.
El archivo PNG compartido no contiene fotos, precios ni datos privados de la biblioteca.

Vigencia: 01/11/2026–30/11/2026 inclusive, America/Guayaquil.
Desde 01/12/2026 00:00 Ecuador, la capa deja de aplicarse. Una pieza que ya lleva sello
debe restaurarse desde el recorte limpio original, verificado con SHA256. restore_campaign
sólo repone el rectángulo del sello; conserva actualizaciones de precio/fecha fuera de él.
No pintar el fondo ni reconstruirlo con IA.

## Integración con el renderer existente

1. Cargar Campaign.from_mapping una vez por lote; usar el asset aprobado cacheado.
2. Usar el layout phone_centered sólo donde coincidan los bboxes reales. Para otras
   categorías, suministrar protected_regions del renderer y dynamic_bboxes.
3. Reservar espacio debajo del logo dentro del renderer si hay colisión; nunca estampar
   encima de títulos. Una pieza bloqueada no detiene el lote.
4. Antes de guardar la versión temática, conservar el original limpio y su recorte,
   el ID Drive y revisión/hashes. Mantener los demás metadatos PNG.
5. Evaluar needs_campaign_refresh en el ciclo existente incluso si no cambian precios.
   Al vencer, aportar clean_base; quitar la clave de campaña del PngInfo al retirarla.
6. Reutilizar el publicador existente con respaldo, sustitución in situ y readback.
   No marcar VERIFICADO sólo por ejecutar el generador.
7. Conservar PNG aprobados agotados en sus carpetas. Excluirlos solamente del PDF.
   PDF conserva portada aprobada y un banner por página; no usar Portadas V2 rechazadas.
8. Revalidar corte y disponibilidad del Data Hub. No cambiar precios ni fecha comercial
   al aplicar sólo el sello. La sincronización de datos la realiza el renderer original.

## Estado real

Hay recurso y código de campaña en esta rama, sin cambios en main ni en sincronización
central. La conexión al renderer/publicador original y la actualización real de Drive
siguen pendientes: el entorno está caído y no se acreditó una credencial persistente
de escritura Drive en Actions. No existe retirada automática desplegada por este cambio.
El responsable central debe conectar el selector al ciclo ya autorizado; no crear cron.

Los ejemplos de pruebas son sintéticos. No reemplazan la revisión visual de cada familia.
