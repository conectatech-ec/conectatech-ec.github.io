AVANCE — RED COMERCIAL CONECTATECH

| Categoría / conjunto | Productos del feed | Existencia / acción |
|---|---:|---|
| CELULARES | 23 | Existente, confirmado por propietario; conservar |
| CARGADORES | 47 | Pendiente de comprobar; no duplicar |
| CUBOS CARGADORES | 14 | Pendiente de comprobar; no duplicar |
| CABLES | 132 | Pendiente de comprobar; no duplicar |
| AUDIO | 131 | Agrupado dinámico preparado |
| SMARTWATCHES | 30 | Subconjunto preparado, filtros por verificar |
| COMPUTACIÓN | 129 | Agrupado dinámico preparado |
| POWERBANKS | 10 | Pendiente de comprobar; no duplicar |
| SOPORTES | 41 | Pendiente de comprobar; no duplicar |
| RELOJES | 33 | Conjunto general; incluye 3 no smartwatches |
| SIN CATEGORÍA | 27 | Revisar maestro; no asignar automáticamente |

**945 SKU auditados · 69 categorías con productos · 75 configuraciones preparadas (69 categorías + 6 agrupaciones/subconjuntos) · 0 conjuntos creados o modificados.** Las agrupaciones se superponen con las categorías; sus cantidades no se suman para obtener 945.

## Resultado de la auditoría

El feed público actual contiene 945 filas y 945 SKU distintos, coincidiendo con el total comunicado para el catálogo maestro **1036301566100990**. El nombre de fuente y la sincronización diaria se basan en confirmación del propietario: no se inspeccionó el programador privado de Commerce Manager. Solo se leyó la fuente pública, sin escribir en ella.

[Tabla completa de las 69 categorías y el grupo sin categoría](CATEGORIAS.md) · [Configuración por conjunto](data/conjuntos-config.json) · [Auditoría de cada SKU](data/revision-sku.csv) · [Plan de ejecución en seco](data/plan-seco.json).

### Hallazgos concretos

- **27 productos sin product_type.** También están sin categoría en el XLSX autorizado de referencia. No es una diferencia creada por el feed; hace falta revisar y autorizar el maestro antes de corregirlo. La lista completa de SKU está en auditoria.json y revision-sku.csv.
- **0 discrepancias de categoría feed frente al inventario del 16-10-2026** y 0 SKU ausentes de ese corte. Esto prueba consistencia con la fuente, no que todas las decisiones del maestro sean semánticamente correctas.
- **RELOJES contiene 33 SKU, de los cuales 30 coinciden con títulos de smartwatch.** REL043 es reloj digital, REL047 es reloj LED de pared/escritorio y REL001 es despertador. Se preparó el subconjunto SMARTWATCHES sin esos tres. REL071 sí dice smartwatch, pero tiene product_type vacío y queda pendiente de corregir la categoría con autorización.
- **AROD001**, luz LED MJ-88, aparece bajo AUDIFONOS. La asignación coincide con el maestro, pero se señala para revisión comercial; no se cambió. El plan bloquea propuestas de creación de AUDIFONOS y AUDIO hasta resolver ese caso, conservando los conteos del feed como evidencia.
- **REL042 / REL056** tienen variantes tipográficas «Smartwath» / «Smarwatch» en el título. Se contemplan en la simulación de Smartwatches; no se editó el catálogo.
- **CARGADORES contiene 47 SKU**, pero usar simplemente «contiene cargadores» seleccionaría **61**, porque también incluiría los 14 de CUBOS CARGADORES. La configuración preparada conserva reglas exactas para evitar esa mezcla. El grupo opcional CARGA Y ENERGÍA sí reúne expresamente cargadores, cubos, bases y powerbanks (76 SKU).
- Estilo: Celulares usa formato título y las demás categorías mayúsculas. No se detectaron categorías duplicadas por mayúsculas/acentos en esta instantánea. No se normalizaron nombres del feed.
- **15 categorías del maestro sin filas en el feed actual:** BALONES, CHIPS SIMCARD, CORREAS, DESTORNILLADORES, ENCHUFES, ESFEROS, ESTACIONES, ESTUCHES, FUNDAS, INVERSORES, LAPTOPS, MICAS, POPSOCKET, SERVICIO, SIMULADORES. No se crean conjuntos vacíos ni se afirma que esos productos estén agotados: pueden faltar por otros criterios del feed.

Hay **33 SKU distintos señalados para revisión**; algunas observaciones son de nombre o pertenencia a un subconjunto, no un diagnóstico definitivo de producto incorrecto. Las reglas heurísticas detectan casos evidentes y no sustituyen una revisión humana de especificaciones.

## Conjuntos dinámicos preparados

Las 69 categorías base usan coincidencia exacta con el campo product_type. Las seis propuestas adicionales son CARGA Y ENERGÍA (76), AUDIO (131), COMPUTACIÓN (129), ILUMINACIÓN (17), FOTOGRAFÍA Y VIDEO (27) y SMARTWATCHES (30). Todos incluyen lista de SKU esperados para comprobar la selección antes de aplicar.

Los JSON nativos de API son **candidatos no aceptados aún por Meta**. `api_filter_validated:false` evita afirmar que una sintaxis o campo se haya probado en la plataforma. La configuración neutral de reglas y la simulación local sí están comprobadas. No se reemplaza el filtro actual del conjunto CELULARES: se conserva el que confirmó el propietario («contiene celulares», 23).

## API oficial y acceso de nuestra cuenta

La API oficial existe: el [SDK mantenido por Meta, ProductCatalog](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/productcatalog.py) implementa lectura y creación en `/{catalog_id}/product_sets`, aceptando nombre y filtro; [ProductSet](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/productset.py) incluye lectura/actualización de conjuntos. Esto acredita una capacidad de Meta, no permiso para nuestra cuenta.

El entorno informa que no hay credenciales Meta configuradas. Se ejecutó la comprobación preparada y devolvió `NO_CREDENTIALS_CONFIGURED`; no hubo llamada autenticada. **No se puede determinar todavía si el token/app tiene catalog_management y acceso de administración al activo. No se declara que Meta lo prohíba.**

`scripts/preflight_api.py` solo hace GET: catálogo maestro, permisos y conjuntos con paginación. Los tokens se leen de META_CATALOG_ACCESS_TOKEN; nunca se imprimen, guardan ni envían en la URL. META_GRAPH_VERSION se exige explícita, sin adivinar la versión de la app. Guardar la respuesta en ruta privada. No se habilitaron destinos de red ni permisos adicionales para ejecutarlo con una cuenta.

Leer datos o encontrar catalog_management no basta para demostrar tareas de gestión del activo, aprobación de app o autorización del propietario. El plan no incluye campañas, creación de catálogos, cambios de fuente ni solicitudes de permisos. `apply_plan()` rechaza toda aplicación remota.

Referencias técnicas: [product_sets](https://developers.facebook.com/docs/marketing-api/reference/product-catalog/product_sets/) y [catalog_management](https://developers.facebook.com/docs/permissions/reference/catalog_management/) no pudieron leerse íntegramente en esta sesión; se utilizó como evidencia primaria el código oficial accesible del SDK. No se atribuyen a esas páginas requisitos específicos no recuperados.

## Aplicación manual preparada

1. Abrir el catálogo maestro **1036301566100990**, confirmar fuente y no crear otro catálogo.
2. Buscar el nombre y filtro antes de crear cada conjunto. CELULARES ya existe; conservarlo y recuperar su ID cuando sea posible. Para los demás, «pendiente» significa existencia no consultada, no inexistencia confirmada.
3. Usar data/conjuntos-config.json: nombre, categorías exactas, conteo y miembros esperados. Preferir igualdad/lista exacta de Tipo de producto si la interfaz lo permite. Si solo ofrece «contiene», comparar los SKU y los conteos; no aplicarlo a CARGADORES como si seleccionara solo 47.
4. Para agrupaciones, seleccionar cualquiera de sus categorías exactas. Para SMARTWATCHES, exigir RELOJES y los términos de título indicados. Si la interfaz no ofrece esos campos/operadores, conservar RELOJES como conjunto general y dejar Smartwatches pendiente; no incluir relojes convencionales bajo un nombre incorrecto.
5. Verificar previsualización y SKU contra la configuración antes de guardar. No guardar conjuntos vacíos. La selección se actualizará con el campo del feed, sin cambiar su sincronización.
6. Registrar ID real y filtro guardado para que el plan reutilice los existentes y detecte conflictos. No editar ni borrar conjuntos existentes automáticamente.

## Ejecución reproducible y pruebas

Python 3.12, sin instalar dependencias. Desde la raíz del repositorio:

```sh
python meta-conjuntos/scripts/auditar.py --feed RUTA_FEED_CSV --inventory RUTA_XLSX --reader colaboradores/scripts/import_inventory.py
python meta-conjuntos/scripts/planificar.py
python -m unittest discover -s meta-conjuntos/tests -v
```

El auditor lee XLSX fuera del repositorio y solo conserva categorías/evidencia saneada. No incluye costos ni cantidades exactas. El snapshot público se identifica por URL, fecha UTC y SHA-256 en auditoria.json. El plan tiene 75 registros; conserva CELULARES y deja como borrador las propuestas restantes hasta comprobar lo ya existente. Pruebas: 8 aprobadas, incluyendo conteos, aislamiento de Smartwatches, colisión de «contiene», deduplicación, conflictos y ausencia de credenciales.

## Próxima ejecución

Configurar la conexión oficial de solo lectura al catálogo o proporcionar una exportación saneada de conjuntos existentes para planificar sin duplicados. Comprobar tareas y filtros de la cuenta. Revisar los 27 SKU sin categoría y los casos señalados; toda corrección del maestro queda para autorización independiente. No se necesita crear un catálogo nuevo ni tocar la fuente diaria para preparar estos conjuntos.

**Costo adicional: $0. Main, producción, sincronización y campañas permanecen sin cambios.**
