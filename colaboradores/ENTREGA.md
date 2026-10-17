# Entrega del piloto — 16 de octubre de 2026 (America/Guayaquil)

Estado: implementación en rama independiente, comprobada en pruebas de servicio; no desplegada.

## Implementado y probado

- Worker con JWT Cloudflare Access RSA, autorización de servidor, cuentas revocables y tres roles. Supervisor limitado a colaboradores autorizados expresamente.
- Panel adaptable con catálogo asignado, búsqueda, texto comercial, enlace individual e imagen aprobada. Oportunidades persistentes mediante contrato D1, estados, aprobaciones de material y resultados.
- Referencias HMAC caducables, validadas contra productos, cuentas y asignaciones. Consulta con consentimiento y deduplicación; una visita no registra venta.
- Confirmación de venta exclusiva de administrador con referencia de comprobante única e importe; comisiones sin porcentajes ni importes inventados.
- Importador XLSX selectivo con mapeo explícito, precios vigentes, disponibilidad booleana, bloqueo por caducidad y retiro de materiales desactualizados. Sin escribir en Sistema 593.
- Contrato de consulta para Alex, firmado e inactivo. No se tocó su Worker ni se solicitaron permisos de Meta.
- 14 pruebas Node aprobadas y 2 pruebas Python aprobadas. Incluyen autenticación RSA real, aislamiento, CSRF, revocación, manipulación de enlaces, deduplicación, etapas, venta administrativa, retención e inventario sin costos.

## Tres productos reales preparados editorialmente

1. POWE003: batería portátil Philco FLP8202CV 20.000 mAh.
2. ADAP005: adaptador de enchufe Europa a Latino negro.
3. HUB001: hub USB 3.0 de cuatro puertos USB-A.

Se reutilizan fichas e imágenes aprobadas sin caja; están registrados sus hashes y contratos. No hay banner confirmado para estos tres productos; no se regeneraron imágenes. Las pruebas generan anuncios/enlaces temporales para estos modelos usando precios artificiales y cuentas ficticias, exclusivamente en memoria. No son anuncios comerciales listos para publicar.

## Pendiente y motivo

- Inventario `Reporte-Inventario al 16-10-2026.xlsx`: no está en el entorno ni apareció en las búsquedas de Drive por nombre exacto y por «Reporte-Inventario». Se solicitó expresamente al propietario. Ningún CSV histórico fue importado en su lugar.
- Cuenta Cloudflare, Access, binding D1 y cuotas Free: el entorno informa cero credenciales y capacidades cloud configuradas. No se puede comprobar el plan gratuito ni desplegar un CRM privado persistente. Se dejó `DEPLOYMENT_ENABLED=false`.
- Colaborador autorizado: falta su cuenta individual configurada en Access y su asignación. Solo se probaron identidades controladas.
- Prueba visual: Chromium no completó la navegación en este entorno (ERR_ABORTED, tanto dominio de prueba como servidor local). El guion de prueba queda incluido; no se afirma validación visual/móvil ni flujo integral en navegador. La lógica del servicio sí pasa sus pruebas.
- API oficial de Meta, publicaciones/programación, recepción y conversación de Alex: inactivas. El estado PUBLICADO/FINALIZADO requiere futuro adaptador oficial y evidencia de publicación, no se simula.
- Catálogos PDF, reservas efectivas, pedidos e integración de comisiones operativas: pendientes. Se dejan contratos/estructura, no funcionalidades desplegadas.

## Revisión y continuidad

Todos los cambios están bajo `colaboradores/` más un workflow manual aislado. Ningún archivo de catálogo, inventario histórico, imágenes, feed, Alex o producción fue modificado. La base local se contrastó con el último commit visible de GitHub: `1dbad9ea5b69666dff6b3fc0cfd464185cb66e2e`.

No hay URL de demostración, no se creó infraestructura y no se generó costo nuevo. Se necesita el XLSX, acceso a la configuración existente de Cloudflare y una cuenta piloto autorizada para completar el despliegue gratuito y la prueba integral real. No enviar secretos por el chat; configurarlos mediante las conexiones/secretos del entorno.

Las instrucciones detalladas de operación y las limitaciones están en README.md. La entrega no equivale a autorización para fusionar a main ni desplegar en producción.
