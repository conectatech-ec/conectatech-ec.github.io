# Fuente oficial del catálogo ConectaTech

## Referencia vigente
**Sistema 593 — Inventario exportado el 08-10-2026**.
Archivo público derivado (sin costos de compra): `datos-593/inventario-publico.csv`.

## Interpretación correcta
- La exportación de 593 contiene **1548 SKU únicos**.
- **1162** referencias cumplen el criterio preliminar de producto vendible con stock positivo y precio general positivo.
- La web contiene **1165 fichas**: las 1162 disponibles y 3 fichas agotadas conservadas por continuidad de enlaces e indexación.
- Las **44 referencias añadidas en la actualización** son *faltantes en la versión antigua del catálogo web*, **no altas nuevas demostradas en 593**.
- Se contrastaron SKU, stock y los dos precios calculados entre las 1165 fichas y este CSV: **sin discrepancias** al 08-10-2026.
- Clasificaciones y filtros usados previamente para crear el catálogo de 1121 artículos no sustituyen la exportación vigente.

## Reglas de sincronización
1. 593 manda para SKU, nombre operativo, stock y precio general.
2. Los precios web se calculan con la regla comercial vigente: promo contado = redondear(precio_general × 1,15); PVP = redondear(promo contado × 1,15).
3. La base SEO `seo-contenido.json` conserva contenido editorial y enlaces; una nueva importación jamás debe reemplazar fotos o contenido verificado sin revisión.
4. Un SKU sin stock conserva su ficha SEO cuando ya existe, se oculta en la navegación de compra y se señala como agotado.
5. Servicio ENVI001 y demás registros que no sean productos vendibles quedan fuera de los catálogos comerciales.
6. Costos de compra, datos personales y demás información interna NO se suben al repositorio público.
7. El siguiente archivo de 593 que se valide sustituirá este corte como nueva fuente vigente; **no hay sincronización en tiempo real** hasta implementar una conexión oficial.

**Estado:** fuente de referencia documentada; siguientes cambios de inventario requieren exportación 593 y validación previa.
