# Procedimiento utilizado: lote 062

Se reutiliza el entorno validado y los importadores existentes. No se desarrollan servicios, APIs o una nueva automatización.

1. Recuperar la cola normalizada por inventario de SKU válidos, reutilizar caché y analizar conjuntamente todas las fotografías. Las cajas son referencias, nunca fotos finales.
2. Identificar marca, modelo y variante; registrar discrepancias. Una denominación del vehículo representado no atribuye fabricante/licencia del juguete. No declarar material o prestaciones sin fuente.
3. Generar imágenes individuales mediante la herramienta nativa con referencias propias. Comparar físicamente cada maestro antes de aprobarlo. Conservar originales y propuestas rechazadas fuera de la selección publicable. JUGU092 primera propuesta rechazada: edición corregida sobre fotografía directa; no publicar las variantes nuevas con clasificación contradictoria. AUDI074 rechazado por la herramienta: pendiente, sustitución por AUDI100.
4. Preparar 50 nuevos contratos y un anexo de 16 correcciones/títulos. Generar WebP de 1200/600/300 píxeles mediante procesar-imagenes.py. Reutilizar hashes de fotos ya aprobadas para cambios exclusivos de título; no regenerarlas. Dos fotografías individuales para cada smartwatch REL046/REL050.
5. Importar únicamente contenido editorial; validar igualdad de todos los precios, PVP, stock, SKU, categorías originales, prioridades, roles, URLs y hashes de originales anteriores. Conservar descripciones ajenas a la selección.
6. Ejecutar nueve pruebas incrementales, QA de fichas móvil/escritorio, galerías y catálogo, contratos antes de integrar main. Destacados: teléfonos Honor TELF024/TELF023, JBL Flip 7 PARL042 y Riversong REL050, todos con existencias y foto local cargada.
7. Validar rama candidata, integrar sin force push, esperar Pages, cotejar URLs y bytes publicados. Registrar fechas de actualización exclusivamente desde verificación HTTP real; los productos con fotos se mantienen primero en los seis modos del catálogo.
8. Verificar Pages desde GitHub Actions con TLS normal y consolidar recibos, cantidades reales y pendientes. Una imagen preparada o un commit no equivalen a una publicación verificada.

Los scripts de este directorio documentan la preparación efectuada; las rutas privadas requieren la caché de referencias del entorno. No son un servicio ni un sistema nuevo. Los contratos incluyen fuentes públicas, hashes y evidencia de revisión. FLAS005 usa la inscripción editorial solicitada con USB 2.0 / 128 GB verificados; no se afirma que sea grabado de fábrica.
