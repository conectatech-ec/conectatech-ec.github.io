# Google Merchant Center — 5874003439

Costo $0. Ecuador / español / USD. Solo validación: todos los artículos excluyen `Shopping_ads` y `Free_listings`.

## Corrección preparada — 7 de noviembre de 2026

**Preparación de desarrollo, sin activación.** El origen es la lista incondicional de destinos en `candidate()` de `generar.py`. El commit `e00c0f79e2fba5aa0a5ee29a0506a7f5b41f4548` añadió `Free_listings` el 16/10 para impedir publicaciones mientras faltaban compra completa y condiciones comerciales. La barrera adicional de `.github/workflows/google-merchant.yml` exige esa exclusión en cada artículo. Ambas protecciones operativas siguen vigentes; el bloqueo requiere cierre comercial y autorización, no solamente un XML válido.

La corrección preparada permite retirar **solo** `Free_listings` de una lista explícita de SKU en una simulación. Se aplica después de los mismos controles de contrato, identidad, unidad de venta, datos, fotografía, precio, disponibilidad y ficha; no admite SKU desconocidos, duplicados ni agotados. Conserva `Shopping_ads`, los restantes destinos y todos los otros campos. No aprueba automáticamente las condiciones comerciales.

La ejecución normal conserva exactamente el XML actual. La opción `--preview-free-listings LISTA.json` exige un `--output` explícito, escribe `productos-ec.preview.xml` y declara `publicacion_habilitada=false`, estado `SIMULACION_FICHAS_GRATUITAS_NO_PUBLICAR` y aprobación comercial no acreditada. **No entrega un XML al flujo operativo.** No se cambia el workflow, la rama del feed, la programación ni la configuración de compra. El cambio futuro del guard del workflow también requiere revisión y autorización: no basta con renombrar el archivo de simulación ni con borrar su comprobación.

Resultado sobre main `9f702e4231d2642c1e4760b1e3cd5494cf75a89e`, feed `3b0b943009d65f3031b47f8b1ba23e5c1c8d3d7e` y corte593 de **06/11/2026**:

| Comprobación | Normal / operativo | Escenario condicionado |
|---|---:|---:|
| Artículos en el XML | 315 | 315 |
| Disponibles con controles técnicos superados | 307 | 307 |
| Agotados, conservados sin habilitar | 8 | 8 |
| `Free_listings` excluido | 315 | 8 |
| `Shopping_ads` excluido | 315 | 315 |
| SKU omitidos por los controles, sin cambios | 884 | 884 |
| Otros campos modificados | 0 | 0 |
| Productos activados | 0 | 0 |

El XML normal reproduce **byte por byte** el publicado, SHA-256 `8dd8104f81b38892eaabd7abdbce0622fd746cbd1ea2f37e0480d9c32eecbb37`. Se comprobaron de nuevo por HTTPS las 315 fichas y sus imágenes. La simulación retira exactamente 307 nodos `g:excluded_destination` con valor `Free_listings`; SHA-256 `029efed561e87e09417f5eaed1ebde6476b74085a60e11b7b9c6af9ad570d666`. Las 884 reservas son idénticas al feed publicado, incluidos imágenes divergentes/no aprobadas, identidad, datos y publicación pendientes. No se corrigen sus causas en este trabajo.

[Lista exacta del escenario](revision-free-listings/sku-simulacion-20261107.json) y [evidencia, pruebas y condiciones de autorización](revision-free-listings/verificacion-20261107.json). La lista es un escenario técnico; **no es una aprobación comercial ni una lista autorizada para publicar**. Hoy ningún producto tiene acreditado el cierre comercial global. El conjunto final podrá ser menor que 307 y debe recalcularse con el corte y las fichas vigentes.

### Reproducir sin publicar

En una copia de desarrollo, preparar `fuente-vigente` desde el SHA de main indicado. Copiar la fuente limitada a `work/inventario-limitado.json` y ejecutar `preparar_fuente.prepare(Path('fuente-vigente'), Path('work/inventario-limitado.json'))`; esto actualiza únicamente la copia en `work/`. Luego:

```sh
python -m unittest discover -s google-merchant -p 'test_*.py' -v
python google-merchant/generar.py --root fuente-vigente --inventory work/inventario-limitado.json --output work/normal --verify-public
python google-merchant/generar.py --root fuente-vigente --inventory work/inventario-limitado.json --output work/simulacion --preview-free-listings google-merchant/revision-free-listings/sku-simulacion-20261107.json
```

Pruebas aprobadas: **17 del feed y 56 de compra/políticas de PR #313**, incluidas las dos del parche Data Hub sobre `c92ed56ca378e950babbb38d078d29f442ff78c9`. PR #313 no modifica los archivos del generador y esta corrección no modifica sus archivos. Sus controles de compra apagada conservan las 1198 fichas de su snapshot; la fuente vigente del feed contiene 1199 productos. No se mezclan ambos cortes ni se reduce el catálogo actual.

### Condiciones concretas para autorizar la activación

1. Cerrar el MVP de **Quito con contraentrega** de [PR #313](https://github.com/conectatech-ec/conectatech-ec.github.io/pull/313): pedido completo persistido en el Data Hub existente, confirmación/recibo y revalidación de precio/stock probados por HTTPS tras autorización de publicación. El parche preparado sigue sin aplicarse ni desplegarse. Completar el aviso operativo de datos. Las pruebas locales no acreditan ese despliegue.
2. Aprobar cobertura por zonas, tarifas finales, preparación/tránsito, días de despacho, hora de corte y calendario Quito. Mostrar total y fecha estimada antes de confirmar. **$3,50 es evidencia de una venta concreta**, no tarifa general; no equiparar Quito con toda Pichincha. Nacional y transferencia permanecen deshabilitados y no son requisitos para comenzar el MVP Quito.
3. Cerrar cómputo del término legal, gastos por causa y plazo operativo de reembolso; retirar `[plazo aprobado]`. Siete días sigue siendo propuesta y treinta fue rechazado. Publicar la política completa enlazada y conservar el texto de garantías aprobado. Configurar devoluciones también en Merchant es recomendado: no imponer una equivalencia numérica inventada de términos legales como requisito adicional.
4. Comprobar en Merchant **5874003439** dominio verificado/reclamado, empresa/contacto, Ecuador/español/USD, cobertura coherente y diagnósticos. Confirmar requisitos de identificadores e imágenes para los SKU finales; no fabricar GTIN/MPN ni `identifier_exists=no`. Retirar una exclusión no garantiza aprobación ni visibilidad de Google.
5. Revalidar main y corte593 vigentes por HTTPS; conservar reservas técnicas, comerciales y agotados mientras sus motivos persistan. Autorizar expresamente **lista final de SKU y SHA del XML**, exclusivamente fichas gratuitas y costo adicional **$0**.
6. Preparar y revisar el ajuste del guard del workflow para esa lista exacta, conservando comprobaciones HTTPS/hash y `Shopping_ads` en todos los artículos. Publicar únicamente en `feeds/google-merchant-ec` tras la autorización específica; no integrar este flujo en main ni desplegar la tienda por aprobar el feed. Comprobar después el procesamiento y diagnóstico de Merchant. No activar Google Ads, campañas ni servicios de pago.

## Documentación histórica de preparación

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

La tarea cloud «Actualizar feed ConectaTech» quedó creada y habilitada con recurrencia diaria, en zona America/Guayaquil. Su primera ejecución programada aún debe comprobarse; la ejecución inicial de GitHub Actions ya se verificó. Las nuevas altas de web sin revisión limitada del corte se reservan con `sin_revision_limitada_corte16`, aunque exista su fila en el Excel privado.

[Requisitos y acciones en Merchant Center](REQUISITOS-MERCHANT.md). Estado de dominio, compra, envíos y devoluciones: `preconexion.json`. No se retiran las exclusiones sin cerrar requisitos y contar con autorización de activación.
