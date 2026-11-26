# Corrección automática de evidencia 593 — preparada, no instalada

El bloqueo comprobado en la ejecución 45727303649 no era falta de stock de ADAP004. El corte público sólo transportaba stock y precios; el lector dependía de identidades y fechas registradas para SHA históricos.

## Delta mínimo

1. **Un módulo del Worker: `shared-hub.mjs`.** Valida la evidencia publicada por el normalizador original y consume su fecha interna. `source-attestations.mjs` conserva exactamente su formato, contenido y aprobaciones históricas; no se agregan excepciones por SHA. Cambiar únicamente ese registro estático no permite reconocer exportaciones futuras.
2. **Un archivo del productor existente:** `scripts/preparar-revision-comercial-593.py`, mediante `publicador593.patch`. Reutiliza el normalizador y la función `data_hub_593.identity` originales, fijados por commit/SHA. Añade `evidencia_checkout` dentro del mismo corte público validado. No cambia el parser, el workflow, precios, stock, SKU, nombres públicos, secuencia o fecha del corte.

No se crea otro archivo de inventario, Data Hub, servicio, credencial, ruta HTTP o permiso. No se modifica el Excel, la fuente privada compilada, SIGNATURE ni las políticas.

## Reconocimiento de cada nuevo corte

La preparación ordinaria genera automáticamente compromisos SHA de identidad por SKU, vinculados al SHA del XLSX, generación interna, vencimiento exacto a 24 horas, secuencia, validador y proyección completa de stock/precios. No exporta nombres ERP, costos ni columnas privadas. Estos compromisos aportan integridad; la autoridad continúa siendo la publicación oficial del flujo 593 existente, por HTTPS en el origen fijo.

El lector exige coincidencia entre el puntero, corte, recibo y evidencia, y compara cada compromiso con la identidad privada que ya conoce. Un nombre o variante diferente continúa bloqueado; las restricciones anteriores no se limpian automáticamente. Los productos nuevos no se incorporan a la base privada por aparecer en el documento público.

También comprueba el catálogo público vigente y sus stock/precios: las retiradas comerciales, incluida STEREN, no quedan anuladas por una prueba de identidad válida. Una exportación ausente o inconsistente impide comprar. Los productos agotados conservan stock cero. La evidencia no activa compras, pagos, entregas, fichas gratuitas o Ads.

Si falta evidencia para un SHA nuevo, se informa `SHARED_HUB_ATTESTATION_REQUIRED`; no se inventa una hora de generación a partir del inicio del día, de Drive o del commit. No se amplía vigencia. Se conserva la continuidad anterior sin presentarla como una fuente recién verificada. La detección de regresión en el isolate se conserva y añade control de secuencia; no se afirma persistencia nueva entre reinicios.

## Corte actual sin evidencia

El mismo preparador puede completar sólo esos metadatos desde el **original cuyo SHA ya esté publicado**, mientras continúe vigente. Relee el original con el validador existente y exige igualdad de filas, cantidades e importes con el corte. Mantiene intactos su recibo, secuencia y generación; no lo republica como inventario nuevo. Si expiró o cambió el SHA, este camino se detiene. Para los siguientes cortes, la evidencia se genera en la preparación ordinaria, sin autorizaciones manuales por SHA añadidas por esta propuesta.

## Pruebas nuevas

**29 aprobadas: 6 del productor original y 23 del consumidor/integración.** Incluyen dos revisiones sucesivas sin modificar el registro histórico; cruce Python → corte → lector real de checkout; ADAP004; conservación de 36 aislados sintéticos; retirada STEREN aun con identidad válida; stock cero; cambios de nombre/RAM; alteración de precios, stock, SHA, recibo o cobertura; validador desconocido; límite exacto de 24 horas; fuente futura; mutación durante el hash; retrocesos; y caída del catálogo sin renovación de vigencia. Son datos sintéticos, no pedidos ni cortes comerciales reales.

Los dos parches aplican y revierten exactamente sobre sus bases públicas. El artefacto compilado pasó comprobación de sintaxis y coincide con el hash del manifiesto. Las suites históricas y pruebas remotas no se repitieron en esta preparación.

Para reproducir: aplicar `publicador593.patch` en un checkout de la web existente; ejecutar `checkout_source_producer_test.py` con `CHECKOUT_593_PRODUCER` apuntando a sus scripts, `NORMALIZADOR_593_ORIGINAL` a los cuatro módulos públicos fijados en el preparador y `CHECKOUT_593_CROSS_FIXTURE` a un JSON sintético temporal. Con el mismo último valor, ejecutar `node --test automatizacion/tests/checkout-source-attestation.test.mjs`.

## Autorización técnica propuesta

Se requiere aprobar conjuntamente el parche del productor y el único módulo de runtime identificados en `manifest.json`:

- Integrar el parche en el archivo original del flujo 593 y completar únicamente la evidencia del corte validado, usando su original vigente. Mantener todos los valores comerciales. La actualización ordinaria futura conservará este mismo mecanismo.
- Mediante el transporte protegido existente, leer el bundle/settings y exigir el SHA anterior de `shared-hub.mjs`, el registro histórico intacto y ausencia de cambios concurrentes. Conservar respaldo cifrado recuperable. Si cualquier identidad difiere, detener antes de escribir.
- Un máximo de **un PUT** para sustituir sólo `shared-hub.mjs`. No usar el desplegador completo. Verificar todos los demás módulos, settings, fuente privada, receptor y cierre público. En caso de fallo, permitir un PUT de recuperación específica únicamente si el módulo y el resto del bundle/settings siguen siendo los esperados; no restaurar globalmente sobre cambios concurrentes.
- Retomar por separado los dos módulos temporales y la única prueba sintética del PR #396, exclusivamente con fuente/evidencia válidas y una ventana todavía autorizada. Esta propuesta no extiende la ventana del 25/11 a las 23:27:09 de Quito ni permite reutilizar permisos vencidos. No se declara completada la prueba remota.

La huella anterior del lector se calculó desde su código público de referencia; su coincidencia activa debe comprobarse por el acceso protegido **antes de instalar**. No se repitió una captura privada para esta preparación. El parche del productor se comprobó contra la versión pública vigente; si cambia antes de integrar, debe reconciliarse el delta.

No se ha modificado main ni instalado el candidato. Costo adicional USD 0. Checkout público cerrado; sin pedidos reales, activaciones o Ads.
