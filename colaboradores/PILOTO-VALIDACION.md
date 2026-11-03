AVANCE — RED COMERCIAL CONECTATECH

**Piloto técnico listo para validar con Rafa Valderrama como único colaborador activo existente. COL002 reservado, sin nombre ni cuenta. Capacidad: 10. Sin activaciones ni publicaciones.**

| Componente | Resultado |
|---|---|
| Autenticación, roles, firma de referencias | Reutilizados del piloto anterior |
| Anuncios | Código único, deduplicación y asociación al anuncio real de Rafa ya registrado por la sesión ALEX; no duplica Work |
| Fuente comercial | Adaptadores del contrato central existente y de sourceToAlex; presentación conectatech.alex.presentation.v1 |
| Material | Foto/ficha/precio existentes; sin fábrica, catálogo ni Hub nuevos |
| Seguimiento | Referencia firmada → consulta con consentimiento → etapas → comprobante confirmado; aislamiento y revocación |
| Registro | Adaptador probado contra la tabla eventos_canal del DB existente, sin DDL ni otra base; cifrado del host obligatorio |
| Comisiones | Estructura preparada, política/importe nulos; no porcentajes inventados |
| ALEX | Contexto de atribución separado de autorización para enviar; sin acceso al Marketplace personal |

**Validar:** desde colaboradores, ejecutar `npm run validate:pilot`, `npm test`, `npm run check`. Abrir [pilot/validacion.html](pilot/validacion.html) desde los archivos descargados. El anuncio de referencia de Rafa existe según la confirmación del propietario conservada en `marketplace-telf017/association.json`; su ID canónico independiente no está acreditado. La consulta y venta del caso ejecutado son **datos controlados, no ventas reales**. COL002 no recibe materiales ni operaciones en el escenario de validación. GitHub muestra HTML como código; no se ha desplegado el visor ni probado visualmente en navegador.

**Rutas localizadas, sin pedirlas al propietario:** [contratos y ramas](pilot/existing-integration-refs.json). Data Hub/ALEX están en `automatizacion/piloto-cloud-3sku-20261015`: shared-hub.mjs, central-source.mjs, marketplace-telf017/lead.mjs y alex-channel-readiness.mjs. SIGNATURE: `integracion/signature-pdf-banners-593-20261023`, generador generar-materiales-593.py, insumos y manifiestos existentes. Se mantienen sus ramas intactas; no se afirma haber contactado otras conversaciones de Codex.

La vigencia del Hub se conserva: corte 02/11; generación original 02/11 22:48:22 UTC y caducidad 03/11 22:48:22 UTC. El snapshot de prueba no es una fuente maestra y no contiene cantidades de stock ni costos. Leer o probar no renueva esa fecha. Las pruebas usan reloj fijo para ser reproducibles; producción debe usar su reloj real.

**Bloqueos concretos pendientes:** (1) la biblioteca SIGNATURE encontrada conserva `live_registry_connection_verified:false`, `no_send_to_buyers:true` y `messaging_enabled:false`: no se envían borradores; (2) el Hub acreditado publica inventario/precios, pero los contratos encontrados no acreditan lectura de ventas confirmadas de 593; el adaptador no inventa esa API. El acceso y despliegue privados permanecen como están. No se solicitaron credenciales.

`src/pilot/existing-events-ledger.mjs` reutiliza la tabla eventos_canal de automatizacion/schema.sql mediante CAS y cifrado proporcionado por el host. No crea tablas; no modifica registros de otros canales. `wireExistingHost()` conecta el lector real de ALEX, env.DB/eventos_canal, seal/unseal y la autenticación del host; `mountInExistingHub()` prepara el manejador en el mismo host; por defecto solo revisión, sin escrituras. No ejecutar las migraciones D1 ni desplegar el Worker de la propuesta histórica de esta carpeta.

**Conservación:** 0 cambios en main, Data Hub, fuente 593, catálogo maestro, SIGNATURE, Worker ALEX, operativo de Rafa o cuentas adicionales. COL002 sigue inactivo. Costo adicional $0.
