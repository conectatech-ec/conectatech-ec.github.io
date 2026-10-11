# Continuación recuperada — lote 063

Base verificada: main 7e81f4f9cdc8e44e70d3e69b245e710b6ffe6d4c, clon local en rama work sin cambios pendientes. Se conserva el lote 062 y sus recibos posteriores; resumen-provisional.json es histórico.

Se seleccionaron 20 SKU de audio sin producción previa ni medios registrados. Se descargaron 60 fotografías propias mediante el conector de Drive, guardadas en caché privada por SKU/nombre, y se inspeccionaron todas conjuntamente. No se reutilizan ilustraciones impresas como fotos de producto.

Cinco maestros comerciales aprobados: PARL016, PARL043, AUDI026, AUDI065 y AUDI095. Ediciones nativas desde fotografías directas, fondo blanco y limpieza; mismos cuerpos, posiciones y colores. Sin inventar iluminación encendida, accesorios ni caras ocultas. AUDI025 tiene propuesta conservada en privado pero rechazada por detalle generativo del circuito. Otros 14 SKU conservan pendientes de fuentes u obstrucciones. Motivos individuales en reportes/lote-063/pendientes.json.

El preparador reutiliza scripts/preparar-lote-054.py y el procedimiento del lote 062. Para repetir la preparación necesita .produccion-privada/lote-063/maestros.json, fichas-nuevas.json y fuentes por SKU; no repetir generación ni sobrescribir maestros revisados. La clasificación AAA u original sigue exclusivamente la evidencia Registro guardada y la confirmación comercial persistente.

Se simularon y aplicaron únicamente cinco contratos v3; procesar-imagenes.py creó versiones 1200/600/300; importar-productos.py aplicó el CSV editorial y aplicar-datos-contrato.py incorporó beneficios. generar-seo.cjs y exportar-canales.cjs son los existentes. No se desarrolló WebStore, banners o integraciones.

QA local real con scripts/verificar-movil.cjs y verificar-catalogo.cjs, Chromium instalado del entorno, servidor sólo en loopback. Cinco fichas verificadas, escritorio/móvil y catálogo 3/2, búsquedas, filtros, precios y navegación. Todos los contratos pasan prepublicación. Invariantes verifican 1165 SKU, precios, PVP, stock, categorías, prioridades, roles, URLs, 198 medios anteriores y originales intactos. El catálogo no renueva fechas hasta recibos HTTP de publicación efectiva.

El shell necesita permiso de red del entorno para sockets/proxy; con ese perfil la conexión TLS normal a GitHub y Pages funciona. No se modificaron proxy, política, credenciales o verificación TLS.

Publicación sólo después de CI candidato y comprobación del despliegue; los estados locales no cuentan como publicado. La rama de revisión premium-001 y sus observaciones se preservan.
