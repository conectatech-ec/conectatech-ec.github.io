# CONECTATECH — Sincronización autorizada desde 593

Fuente vigente: `datos-593/REFERENCIA-OFICIAL.md`.

La exportación vigente incorpora los importes finales explícitos `promo_contado` y `pvp_final` además de `sku,nombre,stock,precio_general,iva,tipo,categoria,clasificacion`. No volver a calcular PVP con la fórmula histórica.

La solicitud expresa del propietario autorizó el corte 10-10-2026. Se conserva el Excel original fuera del repositorio público. La carga depurada verificable está en `datos-593/corte-2026-10-10.json.gz`. El script de aplicación rechaza fuentes alteradas, SKU duplicados y sobrescrituras de precios concurrentes.

El workflow de este corte se limita a sus datos y es idempotente. No constituye autorización general para importar otras exportaciones. Las futuras sincronizaciones requieren un nuevo corte validado y autorización, y conservan precios explícitos, fotos, títulos, URLs y registros de revisión. Las altas se procesan aparte.
