# Causa exacta y único delta propuesto

La lectura autenticada [44006715609](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/44006715609)
terminó correctamente: ejecución `15c604b6235ff24e619fb125b438ad105909496b`,
job `133783729918`, entorno `conectatech-piloto-gratis`, Worker
`conectatech-comercial-piloto`, release conservado
`acfc00763dfbc7ac34c2c62f9ccecea4f613c870`. Hubo **cero PUT**; los jobs de
ingestión e instalación fueron omitidos. El permiso anterior sigue consumido.

## Diferencia comprobada

El instalador anterior sólo reconocía el Worker original completo o el Worker
completo de la base piloto de PR #388. El Worker activo resulta de aplicar los
parches selectivos públicos de colaboradores y SIGNATURE al host original. Esa
combinación legítima no figuraba entre sus dos SHA admitidos.

El módulo activo se reconstruyó byte por byte desde la fuente pública
`c761f91fe16bcbab32a827ba96486fb387435fe0` (mismo Worker que el release original)
y las funciones `patch_worker` de `deploy_alex_collaborators.py` y
`patch_live_worker` de `deploy_alex_variants.py`. Se conservan exactamente las
rutas de colaboradores y la entrega privada SIGNATURE.

Frente a la base de PR #388, la diferencia del Worker está en el import
`renderBanner` y la implementación previa de `/banners/:SKU`. La rama incluye
`renderValidatedBanner`, `refreshAlexCatalog` y otra implementación de esa ruta.
El delta propuesto conserva la ruta activa completa. El diff exacto está en
`worker.mjs.diff`; no se incorpora el cambio de banners de la rama.

`messenger-store.mjs` coincide exactamente con la base compilada de PR #388:
no tiene diferencias. Su fuente pública es
`cc05f6d77adef1ff36f3b9d0e6f75d801517553b`.

| Módulo | SHA-256 activo | SHA-256 candidato inactivo |
| --- | --- | --- |
| worker.mjs | d16c5fe25fe0288a6835da8510b88c4239a18f6ff82979d24d018d335f15dc62 | 57226559e6ab2a151e2ff9297a6dea0805bd3fbbbf7126716c0a298efa55794e |
| messenger-store.mjs | 07238457b4a0c272cb62db7389ff1eb042ee987df56900529c4705e2e2673cae | f77dd1a5e253beef8a52fdd3a43b01f4e995c68953566f7c3052c6eb099c3047 |

`resultado-44006715609.json` conserva el recibo real. `base-activa/` contiene los
dos módulos recuperados; `candidato-base-activa/` sus únicos candidatos. Son
artefactos de revisión y pruebas; no constituyen otro Worker ni forman parte de
la lista de empaquetado. Sólo se exportaron tras probar identidad pública exacta.
El bundle privado completo y los valores de bindings permanecieron en RAM.

## Delta único, sin instalación

Identidad del delta:
`30230fcaacec6af22f2f642bf6175f03f7c316488bc57af6b4c363475d028d35`.
El manifiesto `delta-base-activa.json` fija los ocho módulos y sus SHA.

Se añaden los mismos seis módulos checkout de PR #388, procedentes de PR #313,
sin cambiar un byte. Sólo se aplican los ganchos ya aprobados a los dos módulos
activos. El instalador propuesto reconoce exclusivamente los dos SHA autenticados
y exige además los SHA posteriores exactos. No se amplía la aceptación a otras
versiones históricas ni a cualquier combinación de parches.

La lectura comprobó estabilidad de bundle y settings y preservación de los servicios
anteriores. La planificación conserva cada otro módulo, receptor, fuente privada,
entrypoint y configuración. No modifica bindings, permisos, inventario, aprobaciones,
políticas o datos comerciales. No hay migración, reconstrucción o ingestión.

## Comprobaciones relacionadas

```sh
python automatizacion/tests/checkout_install_test.py
python automatizacion/tests/checkout_active_base_test.py
node --test automatizacion/tests/checkout_active_candidate.test.mjs
```

18 comprobaciones relacionadas: 12 de los controles de instalación/recuperación
afectados, 5 de comparación y una del host/objeto activos con el delta. Se reutilizan
las 71 pruebas aceptadas; no se ejecuta la batería completa.

Se comprueban SHA antes/después, ganchos e inversa exactos, rechazo de cualquier
base/candidato distinto, conservación de colaboradores/SIGNATURE/banners, límites
de escritura y recuperación condicionada. La prueba local del candidato devuelve
503 para compra deshabilitada y 401 para administración sin token; no crea tablas
checkout en SQLite. No hay pruebas comerciales ni pedidos remotos.

## Autorización técnica mínima pendiente

Autorizar exclusivamente integrar esta propuesta en la rama piloto y activar el
**nuevo** permiso `DG-CHECKOUT-ACTIVE-44006715609-ONCE`, limitado al delta anterior,
para un máximo de un PUT en el Worker existente. El permiso propuesto está en
`enabled:false`, con padre de activación aún sin fijar. El permiso consumido se
conserva íntegro en `previous_permission`; no se reutiliza ni se rearma.

Tras autorización se fijaría el commit padre aprobado y se cambiaría únicamente
el control a habilitado para la ejecución original. Antes del PUT: releer bundle,
settings, SHA activos, receptor y fuente; confirmar ausencia de concurrencia y
recursos Free; conservar y verificar respaldo cifrado. Si cambia alguna identidad,
detener sin escribir. No se sustituye el Worker entero por el de la rama.

Después: comparar el delta exacto y todos los módulos no propios, configuración,
fuente, receptor y servicios; comprobar cierre HTTP de compra y administración.
Si falla, sólo se permite la inversa específica con candidato/settings exactos y
sin cambios concurrentes. Nunca rollback global, restauración de datos o reintento
de instalación. El límite original de un intento y la recuperación condicionada
permanecen vigentes.

`CHECKOUT_CONFIG.enabled:false`, `deliveries:[]`, `activar:false` y
`datahub_scoped_content_enabled:false` se conservan. La nueva autorización no
incluye compras públicas, entregas, fichas gratuitas, anuncios, fuentes 593 ni
ingestión. Main y Worker no se modificaron. Costo adicional: **$0**, sin Ads.
