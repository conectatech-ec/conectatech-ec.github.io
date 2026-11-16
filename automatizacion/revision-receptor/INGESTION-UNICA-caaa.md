# Ingestión privada única del reporte recibido

Dirección General aprobó expresamente `caaa9a78fe8479f87197005e352489b65230c174d79401ed7bbe4febbcc7de76` y confirmó carga en el receptor original (`received`, pending true). Tamaño autorizado 179716 bytes, generación 15-11-2026 20:49:34 Quito (`2026-11-16T01:49:34Z`), caducidad 16-11-2026 20:49:34 Quito (`2026-11-17T01:49:34Z`).

Se reutiliza exactamente el permiso técnico de PR #384, con identificador NUEVO `DG-593-INGEST-caaa9a78-ONCE` y padre fijado `94364da412fcb55f5f449c4c26c0a8e8bd8c0b23`. Se reemplazan exclusivamente SHA, corte, generación y caducidad autorizados. No se reutiliza el identificador ni el contexto consumido anterior. Primer intento, mismo workflow/entorno/rama, revisión vigente, costo cero y ambas banderas false siguen siendo obligatorios.

La única ejecución autentica la lectura del receptor de SHA `699ac61bcf8311ac72bdf56c723e3c562882517909c443d9521d5b132624b869`, verifica el reporte pendiente y SHA antes de claim, conserva la reserva del mismo job y comprueba bytes reales (hash y tamaño exacto). La normalización original comprueba integridad/fecha/vigencia, sin sustituir el archivo ni saltar controles. Se mantienen los fences de bundle/settings/estado/fuente y sólo puede actualizarse central-data en un PUT, sin reintentos.

Tras verificar `current:true` y SHA/fechas exactas, se ejecutan la verificación original y el cierre original `processed`. Se agrega lectura de su recibo por SHA, con status processed, validación true y metadatos coincidentes; las anotaciones exponen sólo campos depurados, nunca cantidades o costos. No hay otra instalación ni bootstrap. No se publica a otros destinos.

Las suites anteriores no se repiten; sólo se concilian estáticamente los parámetros nuevos con la autorización y se adapta el corte del fixture, sin ejecutar la batería. El QA asociado se cancelará antes de pruebas; la batería original continúa omitida.

Main, las atestaciones/aislamientos de los 922/36 SKU, SIGNATURE, Sistema 593 y Sincronización multicanal no se modifican ni suspenden. No se habilitan banderas, checkout, fichas ni publicidad. El recibo real se conserva en el PR con ejecución, intento, SHA, fechas, current y recepción procesada; ante fallo se detiene sin otro PUT. Costo adicional USD 0.
