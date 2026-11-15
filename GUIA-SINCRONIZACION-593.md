## Exclusión de publicación por marca — orden15nov2026

STEREN está excluida de la web, sus fichas, sitemap y exportaciones. Aplicar `scripts/politica-publicacion-web.cjs` en los generadores existentes. ENCH003, FLAS013, FLAS014, FLAS017, FLAS033 y FOCO004 no se publican, aunque tengan stock o aparezcan en un Excel posterior.

El corte validado del Hub conserva su inventario completo y los SKU históricos: al preparar un corte nuevo, cubrir la unión de sus SKU canónicos anteriores y los SKU web actuales; no obtener la cobertura únicamente del catálogo visible. Conservar los valores593 de los excluidos. El publicador reconstruye su comparación desde el histórico Git existente; no modificar el inventario para retirar productos de la web. SIGNATURE y originales permanecen intactos.

# CONECTATECH — Sincronización autorizada desde 593

Fuente vigente: `datos-593/REFERENCIA-OFICIAL.md`.

La exportación vigente incorpora los importes finales explícitos `promo_contado` y `pvp_final` además de `sku,nombre,stock,precio_general,iva,tipo,categoria,clasificacion`. No volver a calcular PVP con la fórmula histórica.

La solicitud expresa del propietario autorizó el corte 10-10-2026. Se conserva el Excel original fuera del repositorio público. La carga depurada verificable está en `datos-593/corte-2026-10-10.json.gz`. El script de aplicación rechaza fuentes alteradas, SKU duplicados y sobrescrituras de precios concurrentes.

El workflow de este corte se limita a sus datos y es idempotente. No constituye autorización general para importar otras exportaciones. Las futuras sincronizaciones requieren un nuevo corte validado y autorización, y conservan precios explícitos, fotos, títulos, URLs y registros de revisión. Las altas se procesan aparte.
