# Fuente 593 instalada y prueba privada pendiente — 26/11/2026

La autorización de Dirección General para bc581bf93ff39fcaff18863f91a5202a3325a8e8 se ejecutó exclusivamente sobre el lector permanente.

## Instalación comprobada

- Preflight autenticado: 45914385097; #416 activo y sin deriva de sus módulos.
- Workflow piloto compatible: 58628f56444ebff6e2b67d80144f6d5bac1ab92e. El publicador obtiene el preparador desde main para ambas rutas; no se crea una copia operativa distinta.
- Main: c74f8aae3d19794f95480ceb03ecee4fc009e160. Preparador corregido y cuarta dependencia original; únicamente evidencia de identidad añadida al mismo R6, con precios/stock/fecha/secuencia/recibo intactos. Pages 45914647802 terminó satisfactoriamente.
- Instalación: 45915507220, commit 4338d8d269c06a083d9878e4d891735995a43f20. Respaldo cifrado guardado antes del único PUT; artefacto 15161509022, disponible hasta 27/11/2026 19:14 Quito.
- `shared-hub.mjs` activo: SHA-256 `10ebe491335d008fec039e43b1ce7547d9ed45c69f2b6230b92ff8125b7018a9`.
- Verificación independiente de lectura: 45915784621, job 140234526238. Bundle exacto del candidato, 41 módulos restantes y fuente privada conservados. ADAP004: stock 11, contado $3,50, PVP $4,02. Compra pública 503, administración anónima 401. Cero pedidos sintéticos y reales.

El job inicial terminó en fallo porque su comparación completa de settings detectó `/annotations/workers/triggered_by`. La comparación posterior con el respaldo cifrado, íntegramente en RAM, aisló exactamente ese campo: todos los bindings y demás condiciones permanecen iguales. Cloudflare lo documenta como metadato que identifica la operación originaria del despliegue: https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/deployments/methods/list/ . No se borró ni modificó esta anotación ni se alteraron los comprobadores generales; no hizo falta recuperación ni otro PUT. El recibo conserva tanto el fallo inicial como la evidencia posterior y no declara igualdad literal de settings.

Las cuatro comprobaciones nuevas del ejecutor cubrieron identidad del artefacto, delta/inversa exactos, rechazo de deriva y rechazo de reintento. Las 29 pruebas de fuente y seis de compatibilidad se conservaron sin repetición.

## Fuente efectiva

R6, SHA `a2609eff408b43fbecaf75dc2b4e04624154a448f5c8cd30192cdf348d8875f4`, generado el 25/11 a las 21:31:39 Quito, vigente hasta el 26/11 a las 21:31:39 Quito. Su evidencia técnica cubre 1217 identidades de la proyección existente; ese número no representa productos habilitados para venta. Se conservan 922 conciliados, 36 aislados y las exclusiones comerciales.

Durante esta intervención entró otro SHA, a6b1797b33e6c69ed9b261a5d7cd05948730599a4e29df06958fb4306a147711. El publicador original 45915272181 rechazó su preparación con ORIGINAL_VALIDATOR_REJECTED y liberó la reserva. No se promovió, reintentó ni sustituyó R6; su revisión se comunicó a WORK — SINCRONIZACIÓN en #416. No se da por validado ese original ni se cambia su recepción.

## Nueva prueba propuesta, aún no autorizada

- Ventana propuesta hasta el **26/11/2026 a las 21:26:39 Quito** (27/11 02:26:39 UTC), cinco minutos antes del vencimiento R6; el ejecutor exige además margen previo de recuperación.
- Dos módulos temporales: checkout-entry.mjs y checkout-store.mjs. Respecto de la propuesta aceptada, sólo cambia testUntil en entry; store conserva sus bytes. No se renueva el identificador de idempotencia ni el permiso consumible de prueba.
- Un PUT temporal, un único POST sintético autenticado con ADAP004, persistencia y consulta administrativa separada, deduplicación y cancelación. Una reversión específica de ambos módulos, incluso ante fallo, conservando el lector permanente y #416. Sin reintentos automáticos.
- El ejecutor se ajusta a la nueva identidad del Worker, al recibo real de instalación de fuente y a la fecha interna R6, independiente del vencimiento de la ventana. Mantiene HTTPS, origen fijo, autenticación y rutas/métodos permitidos. Utiliza Node fetch como el transporte de lectura existente; la consulta Python urllib devolvió 403 y el transporte Node original respondió 200. No hay fallback de autenticación ni permisos nuevos.
- Antes de cualquier PUT temporal: nueva lectura de identidades, ausencia de deriva, respaldo cifrado recuperable y fuente/evidencia vigentes. Si cambia el corte, las identidades o vence la ventana, detener sin instalar. La aprobación anterior no se reutiliza.

La siguiente autorización debe identificar el commit renovado, los dos hashes, el hash de su parche y el ejecutor propuesto. No se ha instalado ningún módulo temporal ni ejecutado la prueba remota.

Checkout público, entregas y activación comercial cerrados. Sin Ads. Costo adicional $0.
