# Recuperación comercial del feed — 7 de noviembre de 2026

Preparación independiente sobre `integracion/google-merchant-20261016`. Costo adicional **$0**. No se modifica main, PR #313, PR #363, el XML publicado, la Fábrica SIGNATURE ni la automatización. No se fusiona, despliega o activa ningún producto. Los 999 artículos del XML preparado conservan **Shopping_ads y Free_listings excluidos**.

## Resultado de los 1.199 SKU

| Categoría | SKU | Interpretación |
|---|---:|---|
| Ya incluidos en el feed | 315 | Se conservan todos sus campos. La generación normal reproduce byte por byte el XML publicado. |
| Recuperables técnicamente | **684** | Se pueden añadir al XML de validación con las aprobaciones web ya existentes: 651 disponibles y 33 agotados, con su disponibilidad real. |
| Pendientes de aprobación comercial | **5** | Cuatro maestros premium pendientes de aprobación por SHA/fidelidad y una colisión de identidad. |
| No elegibles en su estado actual | **195** | Falta de portada/contrato, producción anulada, stock negativo o controles documentales incompletos. No se inventan datos para incluirlos. |
| Total | **1.199** | Cada SKU aparece exactamente una vez. |

Cobertura técnica preparada: **999/1.199 (83,3%)**, frente a 315 actuales. Incluye 958 disponibles y 41 agotados. Un artículo agotado puede mantenerse en el XML con `out_of_stock`; no se presenta como comprable.

**684 es recuperación técnica del feed, no aprobación de Google ni autorización para activar fichas gratuitas.** Los bloqueos globales de compra, entrega, devoluciones y fuente Data Hub de PR #313 siguen aplicando también a los 315 anteriores. PR #363 mantiene su alcance y su lista histórica de 307 candidatos; no se amplía ni se modifica desde esta entrega.

## Qué causaba las exclusiones y qué se recuperó

| Motivo original | Casos | Recuperados | Reserva justificada |
|---|---:|---:|---|
| Imagen no coincidente | 428 | **428** | 0 |
| Publicación no verificada | 249 | **245** | 4 maestros premium |
| Producto no aprobado | 194 | 0 | 193 no elegibles actuales y 1 colisión de identidad |
| Fotografía no aprobada | 4 | **4** | 0 |
| Título no coincidente | 2 | **2** | 0 |
| Identidad pendiente | 4 | **4** | 0 |
| Enlaces de ficha no coincidentes | 1 | **1** | 0 |
| Revisión del corte ausente | 1 | 0 | Stock −1 en el corte validado |
| Sin contrato | 1 | 0 | MICR27 |
| Total excluidos | **884** | **684** | **200** |

### Portadas: 428 recuperadas

Se reutiliza el mismo controlador de fotografía aprobada que usa la web (`fotografia-direccion.cjs`), sin ejecutarlo como generador ni editar imágenes. El controlador valida SKU autorizado, revisión visual y hashes de maestro, portada anterior, originales y versiones conservadas. Los 428 contratos siguen aprobados; la divergencia era entre su ruta histórica y la portada vigente aprobada.

`leer-aprobaciones.cjs` obtiene una lectura aislada de ese controlador. `conciliacion.py` comprueba además el vínculo entre contrato, metadata histórica y registro de sustitución. Solo proyecta en memoria la ruta actualmente aprobada y conserva las fuentes originales. El generador sigue exigiendo imagen coherente, hash, dimensiones/formato y coincidencia con la ficha; la prueba HTTPS verifica de nuevo los bytes públicos.

PROT003 tiene una excepción explícita del renderer: aprobación del propietario ligada al maestro SHA `ec2a21e15462f82bed2c87963ee69e46fc961ad998613a9176be5341f3393f53`. Su registro contiene la aprobación y la publicación por SHA, aunque no el campo moderno `revision_visual`. Se reconoce esa prueba exacta, verificando maestro/versiones y la imagen que realmente sirve la ficha. No se extiende a otros SKU ni se fabrica una revisión visual nueva.

### Publicación: 245 recuperadas, cuatro reservas

Los 249 contratos apuntan a informes existentes con hash coincidente. En 245 casos se recupera el esquema histórico: el informe contiene el SKU solicitado exacto, URL correcta, estado `publicado_verificado`, HTTP200, fotografía no pendiente y versiones comprobadas con SHA. Dos contratos conservaban `APROBADO_LOCAL`, aunque su informe ya acreditaba publicación. La normalización ocurre en memoria; no se escribe `VERIFICADO` en contratos ni se renuevan fechas históricas.

MOUS039, SOPO009, SOPO023 y SOPO058 siguen usando precisamente los bytes de maestros reservados en `premium-activo.json`. No se confunden con las fotografías posteriores de sus metadatos. Se conserva el bloqueo porque falta la aprobación visual completa vinculada al SHA y/o la fidelidad resuelta. Una aprobación histórica sin los datos exigidos no se convierte en aprobación vigente.

### Excepciones existentes, sin nuevas decisiones comerciales

- CHIP001/002/004 y JUGU142: la presentación sellada ya está autorizada por SKU en el registro y la confirmación del propietario con hash. Se preserva `contiene_caja=true`; se reconoce la excepción, sin declarar falsamente que no hay empaque.
- CHIP003: el propietario confirmó Tigo y conservar el empaque Tuenti. Se reutiliza el nombre de la ficha/contrato aprobado, sin renombrar el dato original593 ni alterar la fotografía o el stock0.
- CUBO024: se reconoce el título Premium expresamente aprobado que aplica el renderer.
- COBE004, JUGU104, JUGU133 y PARL002: la discrepancia está tratada como `NO_DECLARAR`, con SKU identificado, ficha/unidad verificadas y marca/modelo no declarados. Se comprueba que el valor dudoso no aparezca en los campos enviados ni en marca/modelo de la ficha. Una discrepancia abierta sigue bloqueando. El contrato original conserva íntegra su observación.

## Aprobaciones que realmente faltan

Solo se registran como decisiones pendientes por SKU:

| SKU | Falta real |
|---|---|
| MOUS039 | Resolver fidelidad y completar aprobación visual por SHA del maestro activo. |
| SOPO009 | Resolver fidelidad y completar aprobación visual por SHA del maestro activo. |
| SOPO023 | Completar la aprobación exigida por SHA/fecha/evidencia del maestro activo. |
| SOPO058 | Completar la aprobación exigida por SHA/fecha/evidencia del maestro activo. |
| TELF012 | Resolver la colisión documentada Samsung Galaxy A17 / Redmi A7 Pro y verificar SKU/variante. El stock0 no cambia. |

Los otros 195 no se envían a una aprobación genérica:

- 191 carecen de portada comercial activa y contrato. Requieren completar producción/documentación con fuentes propias; títulos editoriales u originalidad confirmada no sustituyen la fotografía.
- BILL006: producción anulada por el propietario, stock0 y sin portada; no se reencola.
- TELF001: contrato `REVISAR`, sin portada comercial aprobada, revisión visual ni derechos de imagen completos. Hace falta una imagen apta antes de aprobar una ficha.
- CAMA010: stock **−1** en catálogo y corte comercial público del 06/11. El CSV histórico con stock1 no es una fuente alternativa vigente. Se conserva la exclusión y el dato comercial.
- MICR27: falta contrato verificable de identidad, unidad y publicación; la imagen de referencia del fabricante no sustituye estos controles. No se crea otro SKU MICR027.

Estas son condiciones del snapshot analizado, no prohibiciones permanentes de Merchant ni una afirmación de que falten originales en Drive.

## Data Hub y límites de activación

Se conserva la fuente comercial publicada593, su fecha y hashes, y se consulta el estado del Data Hub documentado en PR #313, commit `8dc215b43d43b21d08c77a9bf77608055a9b45ef`. No se modifica su código, fuente privada, atestaciones ni despliegue, ni se usa el catálogo como sustituto de sus controles de identidad.

Ese PR documenta `CHECKOUT_SOURCE_EMPTY` al combinar la base compilada del 21/10 con el corte público del 06/11 sin nombres de fuente atestados. Un ensayo TLS aislado con nombres de una transcripción593 admitió 957 SKU y dejó 31 de los 307 candidatos anteriores bloqueados. No acredita la fuente privada efectiva ni el hash binario del XLSX y no es una compra HTTPS en producción.

Para activar fichas gratuitas siguen pendientes el cierre operativo/comercial de PR #313 y la autorización/control de destinos de PR #363. Esta recuperación no declara que los 684 adicionales superen ya el checkout del Data Hub. Se deberá comprobar el conjunto final contra su fuente vigente, con sus controles intactos, cuando se autorice esa fase. No se habilitan campañas ni Google Ads.

## Lotes y evidencia revisable

- [Conciliación CSV de los 1.199 SKU](recuperacion-20261107/conciliacion-1199.csv).
- [Conciliación JSON con evidencias por SKU](recuperacion-20261107/conciliacion-1199.json).
- [Resumen, reservas y hashes](recuperacion-20261107/resumen.json).
- [Comprobaciones de conservación](recuperacion-20261107/comprobaciones.json).
- [XML completo preparado, con ambos destinos excluidos](recuperacion-20261107/productos-recuperados.xml).
- [14 lotes de altas](recuperacion-20261107/lotes): 13 de 50 SKU y uno de 34, con XML y manifiesto/evidencia. Son conjuntos disjuntos y no repiten los 315 anteriores. Pueden revisarse de forma independiente sin esperar a resolver los 200 reservados.

SHA-256 del XML preparado: `e86c9ede76827138b69d12d025e9119fd5781e8efe6550ed7e48d53e896362ab`.

Se aprobaron **25 pruebas unitarias** (12 existentes y 13 de recuperación), y se verificaron por HTTPS las **999 fichas y sus imágenes**. Se compararon todos los campos de los 315 anteriores, se comprobó la partición exacta de 1.199 SKU y la unión de los lotes, y se conservaron ambos destinos excluidos en los 999 artículos. El XML publicado no se reemplazó.

## Reproducir en desarrollo

Usar una copia de main `9f702e4231d2642c1e4760b1e3cd5494cf75a89e`, y como línea base el XML de la rama de feed `3b0b943009d65f3031b47f8b1ba23e5c1c8d3d7e` (315 artículos). Preparar la revisión limitada desde el corte público en una copia dentro de `work/`, mediante `preparar_fuente.prepare`; no sobrescribir `fuentes/vigente.json` ni actualizar marcadores de automatización.

```sh
python -m unittest discover -s google-merchant -p 'test_*.py' -v
node --check google-merchant/leer-aprobaciones.cjs
python google-merchant/recuperar.py --root ../fuente-vigente --inventory work/inventario-limitado.json --published-feed work/productos-publicados.xml --output work/recuperacion --verify-public
```

La ejecución normal de `generar.py` no habilita esta conciliación. El nuevo comando exige salida explícita fuera de la fuente web y no escribe `productos-ec.xml`, no llama APIs de escritura, no publica ramas ni cambia el workflow. Antes de guardar valida que no hayan cambiado las evidencias, contratos, fichas e imágenes. La aplicación operativa de estos lotes queda pendiente de autorización posterior; ninguna aprobación de esta preparación equivale a desplegar la tienda o activar fichas gratuitas.
