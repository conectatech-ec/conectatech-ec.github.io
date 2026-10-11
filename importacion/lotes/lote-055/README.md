# Lote 054 — continuidad y almacenamiento

Se corrige CARG058 (cable integrado en vueltas amplias y terminal T MagSafe 2); se producen DISC009 y TARJ003. Se conservan títulos existentes, todos los valores comerciales y las URLs estables. CARG059 y DISC003 ya tienen medios publicados: no se sustituyen ni se renuevan sus fechas.

Las referencias de Drive son material de identificación. Se revisaron conjuntamente todas las vistas, cuyos hashes figuran en contratos y continuidad.json. Los maestros son representaciones comerciales asistidas por IA, sin caja; no se presentan como fotografías ópticas recuperadas. En CARG058 la imagen oficial Apple se consultó únicamente para verificar geometría del terminal, sin republicar sus píxeles ni atribuir originalidad Apple al producto compatible.

Se reutilizaron el preparador del lote 053, importar-productos.py, procesar-imagenes.py y aplicar-datos-contrato.py. El manifiesto v3 vincula fuente, maestro, hash, autorización y revisión comercial. Las salidas WebP 1200/600/300 se verifican contra sus bytes; QA de ficha y catálogo comprueba móvil 390 y escritorio 1280. validar-contrato.py debe pasar antes de main. verificar-publicacion.py coteja HTML e imágenes HTTP con los archivos locales, y solo después registrar-actualizaciones.py registra cambios reales para ordenarlos primero.

No se crean servicios ni se desarrolla un sistema nuevo. Las excepciones de MICR08, TELF001, TELF018, TELF012 y TABL003 están en continuidad.json; no repetir investigaciones sin evidencia adicional. MONI005 dispone de dos referencias revisadas, pero aún no se ha producido ni aprobado. Los siguientes lotes siguen prioridades-comerciales.json, comenzando por celulares/tablets aptos y sin detenerse ante los bloqueados.
