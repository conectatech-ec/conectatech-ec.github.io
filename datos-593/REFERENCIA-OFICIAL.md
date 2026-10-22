# Fuente oficial del catálogo ConectaTech

**Sistema 593 — Inventario exportado el 10-10-2026**.

Archivo: Reporte-Inventario 10-10-2026.xlsx. SHA-256: e890cdd30f6d5a4a9f95c520eca8ddc67954633c8eabc9ad53ceb500e375ffd2.

1549 SKU en el corte (1548 productos y 1 servicio). Se sincronizan las 1165 fichas existentes, sin crear duplicados. AUDI092 y CABL172 se detectan con existencias pero quedan fuera de esta publicación de precios; requieren su alta comercial.

## Importes exactos, IVA incluido
- Promo Contado: columna Q, V. TOTAL.
- PVP final: columna X, PVP, más el importe de IVA de la columna Y, PVP % IVA. No es un porcentaje adicional: es el importe fiscal exportado.
- Stock: columna B.
- Columnas públicas nuevas: promo_contado y pvp_final. Sustituyen las fórmulas históricas. No calcular indiscriminadamente contado × 1,15 ni contado ÷ 0,80.
- Se respetan incluso diferencias de redondeo de un centavo del reporte.
- Solo datos comerciales: no subir el Excel completo, costos, márgenes, clientes, RUC ni credenciales.
- Conservar títulos, imágenes, especificaciones y URLs. Datos de corte, no tiempo real.
- Registrar primero los SKU con cambios reales de precio o existencias para revisión.

## Corte nuevo publicado sólo para existencias
- Fecha del corte de cantidades: **21-10-2026**.
- Fuente privada original: `Reporte-Inventario 21-10-2026.xlsx` con SHA-256 `84568d5865cb0f09380d200e6d08172a8820d4aaec5c970c0f7be53e3c68ffc8`.
- Extracto público sin costos: `datos-593/corte-stock-validado.json` (1554 SKU, de los cuales 1170 figuran en la web).
- La actualización automática se activa al integrar un **corte depurado y validado** en ese archivo; la fecha visible procede del archivo de estado generado sólo después de aplicar el corte.
- No se actualizan precios con esta operación. El origen y condiciones de precios vigentes siguen siendo los del corte financiero autorizado anterior; no confundir la fecha de existencias con una nueva aprobación de precios.
- Web primero. Alexa, SIGNATURE, PDFs, Meta, Google Merchant, WebStore y WhatsApp no se activan ni modifican por este flujo.
- Queda prohibido trasladar al repositorio público el Excel completo, costos, utilidades, datos personales o credenciales.
