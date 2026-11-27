# Recuperación privada de las altas136

Estado de esta copia: **26 de noviembre de 2026, 19:41:30 America/Guayaquil (UTC−05:00)**.

Cuatro candidatos exactos: PARL017, MOUS047, PET001 y TECL034. Hay tres recursos aprobados: PARL017, MOUS047 y PET001. TECL034 conserva `verified.visual=false` y queda pendiente por fidelidad de las teclas; no tiene recurso aprobado en este paquete. No se cuenta como alta ni publicación.

**R7 sigue sin validación global acreditada.** La lectura selectiva del reporte y los tres recursos preparados no acreditan la actualización global ni una publicación web. Fuente esperada: Reporte-Inventario.xlsx del 26 de noviembre de 2026; exportación original 19:09:48 Guayaquil (27 de noviembre, 00:09:48 UTC), secuencia7, SHA-256 `a6b1797b33e6c69ed9b261a5d7cd05948730599a4e29df06958fb4306a147711`.

Esta copia conserva el trabajo revisado para reanudarlo. No contiene el XLSX, originales privados, identificadores de Drive, enlaces firmados ni costos. No crea un motor, tarea, receptor, publicador ni despliegue nuevo. El guardado posterior en `archivo/**` corresponde al operador.

## Contenido

- `facts.json`: cuatro fichas comerciales revisadas; conserva el pendiente visual de TECL034.
- `recursos-locales.json`: metadatos, rutas públicas y SHA de los tres recursos aprobados. No regenerar sus maestros.
- `preparar-alta136.py`: helper selectivo de una sola activación; esquema completo de inputs en su documentación inicial. Usa la carpeta privada genérica `/tmp/conectatech-altas-136` y exige `--xlsx` explícito.

## Reanudación

Esperar a que el flujo593 original valide y publique el mismo R7. **No reingresar el archivo, invocar observar593 o el publicador, ni modificar receptor, configuración, PIN o módulos originales para desbloquear este trabajo.** Si la fuente publicada ya fuera otra, detener esta preparación y revisar la fuente vigente; no sustituir manualmente el SHA o el recibo.

Recuperar los inputs privados legítimos en `/tmp/conectatech-altas-136`: estos tres archivos operativos y `referencias/SKU/refs.json` con sus originales de identificación y SHA. Usar el XLSX exacto desde una ruta privada expresada con `--xlsx`; este paquete no lo incluye. Conservar los recursos versionados `r136` y los maestros ya revisados mediante los mecanismos existentes. El recibo `reportes/continuacion-136/recursos-http.json` debe acreditar los tres tamaños de cada seleccionado, HTTP200 y SHA exacto.

Sólo después de que el estado y el corte globales acrediten R7, desde la raíz de la rama independiente y con una cabeza fresca revisada, simular únicamente los tres candidatos aprobados:

```bash
python /tmp/conectatech-altas-136/preparar-alta136.py \
  --sku PARL017 MOUS047 PET001 \
  --xlsx /ruta/privada/Reporte-Inventario.xlsx \
  --validador /ruta/privada/validador-original/normalizar_593.py \
  --base-head SHA_COMPLETO_DE_LA_CABEZA_FRESCA_REVISADA
```

`--validador` es opcional: acepta el archivo original o su carpeta cacheada; sin él, `original_validator()` descarga y verifica sus cuatro módulos por los SHA originales. La simulación no modifica el repositorio. Después de revisar su resultado y cumplir todas sus guardas, el mismo comando con `--aplicar` prepara archivos locales; no publica.

El helper exige la fuente R7 exacta, reproduce íntegra la atestación de checkout anterior y amplía su cobertura con las funciones originales. Conserva firmas previas, tiempos, secuencia y validadores. Actualiza únicamente la fila CSV preexistente de PARL017, añade los otros seleccionados, preserva los valores ajenos y `loteActual062`, y calcula incrementos dinámicos `+3` desde la base fresca. No inventa las columnas593 J/K ni agrega campos de estado.

Continuar con los mecanismos originales: compilar editorial, generar sólo los tres PDP seleccionados, validar contratos con el manifiesto136 y completar QA móvil, HTTP/Chromium públicos y CI de cabeza final. Registrar fechas o prioridad sólo después de esas pruebas. Conservar la selección comercial inicial de Recomendados. La preparación y el archivado no acreditan publicidad ni publicación.

Esta activación136 es única: después de aplicarla, no reutilizar el helper para añadir TECL034 ni sobrescribir sus informes o backup. Mantener ese pendiente para un lote independiente revisado.

Ajuste de precisión comercial: la referencia no confirma si se incluye un collar. La unidad descrita es un localizador; no afirmar inclusión ni exclusión de accesorios que no están documentados. La imagen aprobada muestra sólo el dispositivo.
