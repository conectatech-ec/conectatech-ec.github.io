> Actualización posterior del propietario: `ESTRATEGIA-COMERCIAL.md` rige la producción nueva. Este documento conserva la revisión pendiente de premium-001; no bloquea los demás SKU aptos. Sus propuestas siguen sin aprobación individual.

# Prioridad vigente: cinco propuestas premium antes de publicar

Orden del propietario del 2026-10-10: calidad y fidelidad antes que cantidad. Sustituye el escalado automático de 30/50/100 SKU y la publicación sin revisión del primer lote. No rehacer el piloto ni modificar el catálogo compacto.

## Estado persistente

- `premium-activo.json`: lote premium-001, cinco SKU, hashes de maestros y aprobaciones explícitas. Estado inicial `ESPERANDO_APROBACION_VISUAL`.
- `cola-premium.json`: mejoras visuales pendientes; conserva el estado público anterior. La cola Drive y los 15 pendientes de lote-040 permanecen intactos.
- Rama `revision/premium-001`: `revision-premium/lote-001/Comparativa-premium-CONECTATECH.html`, maestros PNG, imágenes anteriores, vistas JPEG, fuentes y prompts.
- No integrar esta rama completa a main: contiene propuestas sin aprobación, destinadas a revisión, no a Pages.
- El lote-040 continúa publicado y verificado. No renovar sus fechas por esta revisión.

## Referencia realmente inspeccionada

`Reporte-visual-CONECTATECH(1).html`, recuperado de los entregables existentes, contiene las seis referencias MOUS041, TECL028, CABL107, CARG070, POWE014 y AUDI108. Se inspeccionaron las seis imágenes completas. Se adopta luz suave, volumen, contorno limpio, perspectiva y encuadre; no se copian sus píxeles externos ni se presume permiso comercial.

## Lote actual

MOUS039, SOPO009, SOPO058 y SOPO023 comparan una imagen publicada real con la propuesta. AUDI028 no tenía fotografía publicada: su comparación utiliza la fotografía propia recibida y lo señala expresamente. Teléfonos permanecen pendientes por fuentes autorizadas; POWE004 está parcialmente fuera de encuadre; CARG025 y POWE017 solo permiten examinar empaques/blíster. No rellenar cupos inventando detalles ni presentar un empaque como producto fotografiado.

Los cinco maestros son ediciones asistidas por IA de fotografías propias, no fotografías oficiales externas. La autorización de uso del material propio está documentada; no implica que toda modificación generativa sea fiel. MOUS039 requiere revisar serigrafías/iconos pequeños y SOPO009 el patrón de textura de la base. Esos dos SKU mantienen `fidelidad_resuelta:false`. Los otros tres están listos para aprobación visual, no aprobados ni publicados.

## Cómo reanudar

1. Leer main actual, este documento y premium-activo. Recuperar la rama de revisión sin sobrescribir main ni trabajo ajeno.
2. Mostrar el comparativo guardado; no regenerar propuestas intactas por una ejecución programada. Mantener los originales de identificación en Drive y su copia privada local.
3. Esperar aprobación expresa del propietario. Guardar el texto o referencia de la aprobación, fecha y SHA-256 del maestro. Una aprobación de estilo no resuelve por sí sola un detalle físico discrepante.
4. Resolver únicamente las observaciones de fidelidad afectadas. Una edición posterior invalida la aprobación del hash anterior.
5. Cuando corresponda, registrar `estandar_aprobado_por_propietario:true`, estado `APROBADO_PARA_APLICAR` y aprobaciones por SKU. No establecer esos valores automáticamente para superar controles.
6. Copiar solamente los maestros aprobados a un lote de producción versión 3, completar contrato, generar WebP 1200/600/300 sin presentar detalle generativo como resolución óptica recuperada. Mantener modelo, finanzas, existencias, SKU y URL.
7. Ejecutar los controles de contrato, navegador real móvil/escritorio y hashes HTTP de Pages. Solo entonces registrar publicación y fecha semántica. Las imágenes deben sustituirse en tarjetas, búsquedas, fichas y galerías sin agrandar tarjetas.
8. Conservar fases 5 → 10 → 20 → 50 → 100 como progresión condicionada a aprobación del estándar y calidad consistente. La preselección siguiente no autoriza empezar ni publicar otro lote mientras éste espera decisión.

`scripts/premium_guard.py` bloquea `procesar-imagenes.py --aplicar` y el workflow de publicación hasta contar con aprobación ligada al SKU y los bytes exactos. Se prueba rechazo de estados pendientes, cambios de maestro, aprobación del operador, SKU ajenos, problemas de fidelidad, galerías no revisadas y aumento de volumen. Se permiten inspección y simulación sin publicar.

Las propuestas y reportes no cambian la web pública. No afirmar trabajo en segundo plano cuando la sesión terminó. La automatización conserva este bloqueo y no notifica repetidamente sin novedades.
