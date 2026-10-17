# Piloto de colaboradores CONECTATECH

Implementación aislada: Worker + Assets privados + contrato D1. No desplegado. No modifica catálogo, fábrica, feeds, Sistema 593 ni Worker de Alex. La rama es `colaboradores/piloto-20261016`; no fusionar automáticamente.

## Ejecutar las verificaciones

Node 24 y Python 3.12, sin instalar dependencias:

```sh
cd colaboradores
npm test
npm run check
```

Las pruebas usan SQLite en memoria, identidad inyectada exclusivamente desde `tests/fixture.mjs` y precios artificiales ($10/$12). No son precios comerciales. El Worker exportado usa siempre Cloudflare Access y no acepta cabeceras de prueba. La prueba de Access firma y verifica JWT RSA realmente.

`tests/ui-check.mjs` comprueba la interfaz en Chromium contra el Worker y SQLite con datos controlados. Su configuración de Playwright/rutas corresponde al entorno de ejecución y no es una URL pública. No se suben cuentas ni datos de prueba al servidor.

## Recursos reutilizados

Base auditada `1dbad9ea5b69666dff6b3fc0cfd464185cb66e2e`, confirmada en GitHub. `seo-contenido.json`, `seo-pages.json`, contratos e imágenes aprobadas alimentan `data/piloto-editorial.json`. Tres productos: POWE003, ADAP005, HUB001. Sus imágenes sin caja se reutilizan por URL y se registran con SHA-256. No se copian originales ni se regenera la fábrica.

`ventas/index.html` es una herramienta pública de cotización/CSV, no un CRM privado. La exportación comercial existente incluye cantidades exactas; el nuevo servicio construye respuestas con lista explícita de campos y omite existencias, evidencia interna y costos.

Hay tres banners históricos listados en `reportes/banners-prioritarios.json` para otros SKU. Su mero estado «generado» no prueba aprobación vigente; no se usan para estos tres productos. `banner:null` muestra honestamente su ausencia. Sin catálogo PDF confirmado. No se fabrica material visual sin autorización/fidelidad demostrada.

## Inventario: bloqueo deliberado

Falta `Reporte-Inventario al 16-10-2026.xlsx`. No se ha sustituido con el CSV histórico ni con el corte del 10/10. Por ello no hay precios comerciales cargados, anuncios reales vigentes ni enlaces comerciales desplegados. Las fichas editoriales sí están preparadas.

El importador estándar lee el primer tab del XLSX, exige mapeo explícito de cuatro encabezados y rechaza duplicados, fórmulas, precios no numéricos, columnas ambiguas y vigencia de más de 48 horas. Los otros campos, incluidos costos, nunca salen al SQL. La disponibilidad se reduce a booleano. No altera Sistema 593.

Ejemplo de archivo de mapeo (ajustar encabezados a la exportación real, no asumirlos):

```json
{"sku":"ENCABEZADO SKU","promo":"ENCABEZADO PROMO CONTADO","pvp":"ENCABEZADO PVP","stock":"ENCABEZADO EXISTENCIAS"}
```

```sh
python scripts/import_inventory.py 'ruta/Reporte-Inventario al 16-10-2026.xlsx' \
  --mapping work/columnas.json --valid-until 'FECHA_ISO_UTC_FUTURA' \
  --output work/importacion.sql
```

Solo genera SQL comercial para revisión/aplicación posterior. Deshabilita productos ausentes o agotados y cambia PREPARADO/APROBADO a PENDIENTE cuando cambian precio, disponibilidad o contenido. La huella comercial permite conservar material sin cambios aunque cambie el archivo o la cantidad positiva de existencias. Cada fuente queda identificada por hash en auditoría. Solo se importan productos editoriales aprobados; ampliar esa lista requiere revisar sus contratos. No se programa lectura de archivos privados del repositorio público.

## Acceso y autorización

Cloudflare Access valida firma RSA, emisor, audiencia, caducidad y antigüedad de la sesión. El servicio comprueba además `members.active` en cada solicitud: permite revocación inmediata independiente del JWT. Identifica cuentas por `sub`, nunca por correo o cabecera sin verificar. Configurar la duración de sesión de Access a un máximo de 24 h.

Roles:

- ADMINISTRADOR: consolidado, aprobación de material, confirmación de venta, revocación y eliminación.
- COLABORADOR: productos asignados y sus propias oportunidades/resultados.
- SUPERVISOR: productos asignados y oportunidades de colaboradores enumerados expresamente en `supervision`.

No hay registro abierto. El administrador incorpora cuentas individuales mediante el proceso existente de Access y un INSERT parametrizado en D1 con el `sub` verificado, el rol y un identificador comercial sin datos personales. Asigna SKU en `assignments` y miembros supervisados en `supervision`. No se inventa una cuenta autorizada. No almacenar correos/PII en esta rama pública.

Las mutaciones requieren el mismo Origin y JSON. Hay consultas parametrizadas, CSP, no-store, revocación, caducidad de referencias y límites por HMAC diario de IP (no se almacena IP cruda). Solo alias, no teléfonos, cédulas ni datos sensibles. Un alias todavía puede ser dato personal si el operador introduce un nombre; la instrucción visible exige un código comercial.

## Enlaces, oportunidades y Alex

POST `/api/material` genera texto, referencia HMAC de siete días e imagen aprobada; no publica. La landing `/r?t=...` verifica producto vigente, miembro activo y asignación. Sus datos vienen de `/api/reference`. No se registra nada por una visita. POST `/api/interest` requiere consentimiento, registra consulta deduplicada y devuelve un código para comunicar al asesor. No recoge datos de contacto; el cliente debe abrir un canal oficial por su cuenta. La referencia acredita procedencia del enlace, no identidad del comprador ni autoría final de una venta.

GET/POST `/api/opportunities`, PATCH `/api/opportunities/:id` permiten seguimiento secuencial y cancelación. Registro manual usa clave de idempotencia y evita alias duplicados activos por miembro/producto. Solo el administrador puede confirmar venta después de verificar un comprobante externo, informando referencia única e importe; no existe integración para validar comprobantes de Sistema 593. No se aceptan saltos de etapa ni clics/mensajes como ventas. Comisiones quedan SIN_POLITICA con importe NULL; no se fijan porcentajes.

GET `/api/publications`, PATCH `/api/publications/:id`: preparación y aprobación administrativa comprobadas. PUBLICADO/FINALIZADO quedan reservados al futuro adaptador oficial, que aún no está implementado ni autorizado; no se simulan como hechos. La publicación personal sigue siendo manual mediante Meta. No se habilita programación oficial, solicitudes de permisos, pagos ni reservas efectivas.

POST `/api/alex/resolve` es un contrato optativo inactivo (`ALEX_ENABLED` ausente). Requiere HMAC con secreto independiente en `X-Alex-Signature`, firmado sobre `X-Alex-Time + '.' + cuerpo_JSON_exacto`, y ventana de 60 s. Resuelve exclusivamente una referencia válida que el canal haya transmitido realmente. No asume que Messenger transmite `ref` o el token; no recibe eventos de Meta ni envía mensajes. No se modifica el Worker de Alex ni su personalidad. La integración de conversación, botones y traspaso humano depende del Worker existente y permisos pendientes.

DELETE `/api/opportunities/:id` permite borrado administrativo. `scheduled()` elimina registros según retención configurada (90 días por defecto), comisiones relacionadas y límites caducados. Al desplegar, configurar cron diario; sin cron no hay eliminación automática. El identificador no personal y el evento de eliminación sobreviven solo hasta el límite de auditoría. No hay exportación pública de clientes.

## Despliegue pendiente, costo autorizado $0

No hay credenciales Cloudflare, cuenta/plan/cuotas observados, configuración Access, D1 ni identidad de colaborador autorizado. No se creó servicio, base de datos, dominio, secreto ni facturación. Workers/Access/D1 Free son una arquitectura propuesta; sus cuotas actuales no se comprobaron y no se afirma su disponibilidad en esta cuenta. Wrangler no viene instalado y no se descargó de un destino no permitido.

Para activar con los accesos existentes: comprobar plan Free y cuotas reales de Workers, Assets, Access, D1 y Actions; mantener límites que rechazan exceso sin pasar a planes pagos; no activar plan de consumo. Usar una aplicación Access independiente para el piloto. Proteger todas las rutas excepto `/r`, `/api/reference`, `/api/interest`, `/reference.js`, `/style.css` y, solo al autorizar Alex, `/api/alex/resolve`. Las rutas privadas siguen verificando JWT en el propio Worker.

Después de comprobar autorización y gratuidad, configurar un Worker nuevo aislado, binding D1, migración, inventario vigente, miembros/asignaciones, ACCESS_TEAM, ACCESS_AUD, PUBLIC_ORIGIN HTTPS, REFERRAL_SECRET aleatorio de al menos 32 bytes, RETENTION_DAYS=90 y cron diario. ALEX_SECRET solo cuando corresponda. `DEPLOYMENT_ENABLED` se mantiene false hasta completar configuración y prueba de permisos. No ejecutar `wrangler deploy` sobre un Worker existente, ni activar `workers_dev`/preview antes de configurar Access. Comprobar que los Assets pasan siempre por Worker. Probar cuenta autorizada y tres productos desde fuera de la cuenta administrativa antes de compartir URL.

GitHub Actions incluido es manual y restringido a esta rama; no despliega ni escribe en main. No fue ejecutado, porque no se comprobaron cuotas. El funcionamiento cloud persistente y la prueba con un colaborador real siguen pendientes de configuración, no se sustituyen por las pruebas locales.
