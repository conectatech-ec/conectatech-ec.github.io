# Autorización específica pendiente — prueba privada #396

Autorizar únicamente el paquete renovado y el ejecutor descritos en `autorizacion-prueba-renovada.json`, desde la base piloto `9dd6a9f2c8df5c508a8c128a13c798fa0e48abe7`, sin reutilizar permisos anteriores.

Artefactos inmutables: `e2b3237fd3709da3554081f5a0d026135e93bc54`.

| Módulo temporal | SHA-256 candidato |
| --- | --- |
| checkout-entry.mjs | 52f29578bf6b83f9da5bc4c2ab472b839f876c0688c213fbcbf449ee69efff53 |
| checkout-store.mjs | ff71a6caa354900b742c5b4be0a2f9c06ed2116b4b64f9947ddceaa9de4a295d |

Parche de módulos: `99ae311573baba50540a84063b754310206e98221f8e5e5a40d55c7916581bc1`.
Ejecutor: `b2f2cc9c7b43eb3bf1947b9648032910d638c78ba1c75f1c69db108c8e3a2bb9`.
Parche del workflow/ejecutor: `4c8d3bd6431abd8e4a90992a2f2e66935ed6badea5bc9fad10743a2d7077537e`.

Ventana máxima: **26/11/2026, 21:26:39 Quito**. El inicio exige al menos tres minutos de margen antes de ese límite. R6 vence cinco minutos después. Una aprobación tardía no extiende ninguna vigencia.

Alcance: lectura autenticada de identidades y fuente vigente; respaldo cifrado; un PUT temporal de ambos módulos; un único POST de prueba con ADAP004 y datos sintéticos; cotización, confirmación, persistencia, consulta administrativa en petición separada, deduplicación y cancelación; reversión específica mediante un PUT como máximo y comprobación de hashes originales, incluso ante fallo.

Conservar `shared-hub.mjs` instalado, los 41 módulos ajenos, #416, bindings, políticas, inventario, cierres comerciales y bloqueos existentes. Nada de reintentos automáticos ni pedidos de clientes. No instalar si cambió la base, la fuente o venció la ventana.

El cambio de runtime frente a la propuesta aceptada es sólo testUntil en entry; store conserva su identidad. El ejecutor se reconcilia con los hashes posteriores a #416 y la fuente instalada; usa Node fetch con idéntico alcance HTTPS/autenticado, porque la sonda urllib dio 403 y el transporte original Node dio 200. Cuatro comprobaciones nuevas de alcance pasaron sin tráfico remoto. Se conserva la comprobación estricta de settings del ejecutor, sin modificar los comprobadores generales.

**Pendiente de aprobación. No ejecutado.** Checkout público y entregas cerrados; sin Ads; costo adicional $0.
