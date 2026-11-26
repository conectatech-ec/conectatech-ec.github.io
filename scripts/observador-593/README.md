# Observador empresarial 593

Cuenta operativa: CONECTATECH. Implementación y activación autorizadas por el propietario el 26/11/2026. Costo adicional $0.

El observador único de Apps Script está en LIVE y utiliza un activador de cinco minutos creado el 26/11/2026 a las 18:20:29 Quito. Script ID: 1fVduRW85WiM9ynx34FEqFZB2TE_WmF-ANgjAD1TPPmM-vDOcfByhtJuW. Handler: observar593. Trigger ID: 1371424341912190976. Google conserva los permisos ya autorizados.

## Flujo compartido

El observador lee los metadatos de la carpeta empresarial y, sólo ante un cambio, descarga el XLSX y verifica su SHA. Entrega la fuente al receptor original y éste solicita el mismo workflow publicar-corte-comercial-593.yml. Se conservan normalizador, adaptador, validadores, exportadores, reservas por SHA, grupo publicacion-stock-593-web y push CAS sin force. Un recibo processed exige fuente exacta y commit publicado verificable en main.

El supervisor horario original 6adad3f094348191a06cddc02be4686c permanece habilitado con su calendario anterior. Su respaldo usa observar593 y el mismo receptor; no inicia el antiguo ingreso piloto ni un publicador separado. ScriptLock evita solapamientos de Apps Script y las reservas/cooldown protegen recepción y publicación. La falta de evidencias exigidas por el validador mantiene la fuente retenida para resolución por el supervisor, sin rebajar controles.

SIGNATURE, checkout y los módulos ajenos no forman parte del delta. Los originales privados permanecen temporalmente fuera del checkout. Las dos bases públicas en base/ son fixtures de prueba del delta, no otro receptor operativo.

## Evidencia de activación

- PR416 integrado: d01b1fdb550d46c32599b5c46c31fbded641c0a8.
- 69 pruebas CI aprobadas en run45899624048, cabeza 32ee93658bf226cc50feea2fa4917bf1d130a685, más 4 pruebas de configuración en run45909948587.
- Receptor instalado mediante run45897858422 y adaptadores propios reparados mediante run45899331248. La corrección usa redirect:manual y rechaza 3xx porque Cloudflare no admite redirect:error.
- Credencial empresarial Actions de alcance fino guardada por el propietario, limitada al repositorio. Readback run45909502939 confirmó su binding. El primer helper informó fallo después de instalarlo; no se repitió la escritura. El helper ahora acepta HTTP 200/201 sólo con success=true.
- Prueba real de despacho con esa credencial: solicitud 23:13:48.774743Z, HTTP 204; publicador original run45909678099, resultado 23:15:10.473Z, success y cero escrituras comerciales.
- Habilitación del receptor run45909948587: 23:16:37.392741Z, HTTP 201 success; preservados 42 módulos y las demás opciones.
- Prueba Google→receptor 23:20:09.230Z: 363 ms, contrato CT593_OBSERVER_V1, receptor listo y sin pendiente.
- Preflight LIVE 23:20:28.458Z→23:20:28.841Z: 383 ms, un archivo sin cambios, cero descarga/envío.
- Tres ciclos automáticos consecutivos quedaron completados a partir de los inicios 18:21:18, 18:26:18 y 18:31:18 Quito, separados por 300 segundos. Sus duraciones totales fueron 2,769 s, 3,072 s y 2,092 s; sondeos de 383 ms, 893 ms y 289 ms, respectivamente. Todos registraron automatic=true, un archivo sin cambios, cero descarga y cero envío. El detalle consta en estado-implementacion.json. El tiempo de sondeo del JSON es distinto de la duración total de plataforma mostrada por Google.

Los sondeos del mismo R6 acreditan la ejecución por temporizador y la deduplicación. Todavía no acreditan la cadena integral de una fuente nueva: la siguiente subida auténtica debe registrar disponibilidad, detección, recepción, validación y publicación. No se fabrica un reporte de prueba ni se reprocesa R6 para obtener esa evidencia.

## Límites y operación

Apps Script aplica un freno propio de 320 ejecuciones y 30 min de ejecución por 24 h, además de los límites gratuitos de Google. El receptor conserva una única fuente pendiente, tamaño máximo 1 MB, retención 24 h, lease 15 min y límite 8 intentos con espera. Se mantiene CF_FREE_ONLY_CONFIRMED=true y el entorno original conectatech-piloto-gratis.

La credencial Actions caduca el 24/02/2027. El supervisor existente registra la renovación; el valor no se guarda en código, logs ni este documento. No se extrae la credencial del conector GitHub.

Para detener únicamente la detección se usa pausar593, que fija CT593_MODE=PAUSED. La reanudación requiere LIVE y CT593_ACTIVATION_READY=CT593_OBSERVER_V1; activar593 reconoce el trigger guardado y no lo duplica. No borrar módulos ni alterar sistemas ajenos como mecanismo de pausa.

## Pruebas del delta

Desde esta carpeta: python patch-receiver.py; node test-observer.cjs; node test-observer-auth.mjs; node test-integration.mjs; python test-publisher-entry.py; python test-install-receiver.py; python test-repair-auth.py.

Las pruebas usan datos sintéticos y no sustituyen la evidencia de las ejecuciones reales. candidate/ se genera únicamente para pruebas; los módulos privados ajenos no se guardan ni publican.
