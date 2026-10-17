# Google Merchant Center — 5874003439

Costo $0. Ecuador / español / USD. Solo validación: todos los artículos excluyen `Shopping_ads` y `Free_listings`.

URL pública estable:

`https://raw.githubusercontent.com/conectatech-ec/conectatech-ec.github.io/refs/heads/feeds/google-merchant-ec/google-merchant/productos-ec.xml`

## Corte corregido16, archivo completo privado

El propietario aportó `Reporte-Inventario al 16-10-2026.xlsx`. La lectura local valida sus 1.553 referencias únicas. El archivo completo, cantidades internas, costos, márgenes y los precios distintos de los ya públicos no se suben a GitHub.

`fuentes/vigente.json` contiene exclusivamente una revisión limitada a los 674 SKU del feed público anterior: disponibilidad derivada del corte16, indicador de coincidencia de precio y el mismo precio ya público de la web cuando coincide con el corte. Conserva fecha de corte, procedencia y hashes. No contiene cantidades de inventario. SKU sin revisión limitada quedan excluidos; no se deduce su disponibilidad.

El generador lee la web vigente en una copia separada. Reutiliza título, descripción, fotografía, URL y precio; no modifica la web, main, Meta, SKU, banners ni Alex. Exige contrato y fotografía aprobados. Si la disponibilidad del corte16 o el precio validado contradicen la ficha, excluye ese SKU. No convierte una reducción de cantidad con disponibilidad positiva en una ausencia de stock, ni inventa unidades. No usa el stock del corte10 como sustituto.

Todos los enlaces, precio visible/estructurado e imágenes del resultado se comprueban por HTTPS. Las exclusiones y evidencias se publican junto al XML, sin cantidades ni precios internos. XML válido no equivale a aprobación de Google.

## Ejecución cloud

```
python -m unittest discover -s google-merchant -p test_feed.py
python google-merchant/generar.py --root fuente-vigente --inventory google-merchant/fuentes/vigente.json --output google-merchant --verify-public
python google-merchant/preconexion.py --root fuente-vigente --output google-merchant
```

GitHub Actions ejecuta este flujo en Linux público gratuito, obtiene el main actual de solo lectura y escribe exclusivamente en `feeds/google-merchant-ec`. Cambios en la revisión limitada o en `solicitud-actualizacion.json` lo disparan. La tarea cloud de ChatGPT puede renovar solo el marcador y revisar su resultado sin laptop; su estado real se confirma en Automatizaciones. El schedule nativo de GitHub de esta rama aislada no se activa ni se modifica main.

El proceso no inventa nuevos cortes ni refresca sus fechas. Una nueva exportación real autorizada requiere revisión privada antes de renovar la fuente limitada. Si fallan todas las comprobaciones, no se reemplaza el feed anterior: consultar fecha y estado de Actions para no presentar un resultado antiguo como actual.

[Requisitos y acciones en Merchant Center](REQUISITOS-MERCHANT.md). Estado de dominio, compra, envíos y devoluciones: `preconexion.json`. No se retiran las exclusiones sin cerrar requisitos y contar con autorización de activación.
