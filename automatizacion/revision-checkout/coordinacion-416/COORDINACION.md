# Coordinación de instalaciones #396 / #416 — 26/11/2026

## Estado comprobado

- #396 conserva la corrección permanente preparada: `shared-hub.mjs` candidato SHA-256 `10ebe491335d008fec039e43b1ce7547d9ed45c69f2b6230b92ff8125b7018a9`. No está instalado.
- #416 integrado mediante `d01b1fdb550d46c32599b5c46c31fbded641c0a8`, cabeza `32ee93658bf226cc50feea2fa4917bf1d130a685`: CI satisfactorio en 45899624048. El receptor se instaló en 45897858422 y los adaptadores se actualizaron en 45899331248. La sonda de lectura del publicador terminó satisfactoriamente en 45899753088. No repetir esas instalaciones.
- Lectura autenticada posterior: ejecución 45900222616, job 140183904518. Cero escrituras al Worker; todos los jobs de instalación, ingestión, credenciales y checkout fueron omitidos. Se usaron exclusivamente el entorno y el inspector existentes.
- El despacho automático aún no está habilitado: `dispatch_secret_available:false`, `automatic_trigger_configured:false`; bandeja sin reporte pendiente. La credencial personal requerida se gestiona en WORK — SINCRONIZACIÓN. La sonda satisfactoria no acredita tres ciclos automáticos ni activador de cinco minutos funcionando.

Las seis pruebas usaron los módulos de fba553f1…; se comprobó que el último commit 32ee9365… sólo cambia una línea del workflow, README y checkpoint, sin cambiar esos módulos ni el instalador. Las identidades seleccionadas, recibos, hashes y grupos de concurrencia constan en `compatibilidad.json`. No se guardan cuerpos privados ni credenciales en estos artefactos.

## Compatibilidad y correcciones indispensables

1. **Módulos distintos.** #416 modifica `worker.mjs` y `commercial-reception.mjs`, y añade/actualiza `observer-auth.mjs` y `observer-dispatch.mjs`. La reparación permanente #396 modifica solamente `shared-hub.mjs`. Las pruebas cruzadas del instalador y la inversa reales de #416 preservaron el lector corregido, los módulos del checkout y la fuente privada sintética; la reparación de autenticación también los conservó.
2. **Falta un módulo del validador en el workflow.** El preparador de #396 reutiliza la función `data_hub_593.identity` del mismo commit original. La descarga sparse de #416 incluye sólo tres archivos. Se reprodujo el fallo exacto `ORIGINAL_VALIDATOR_SHA_MISMATCH data_hub_593.py`; `observador416-validadores.patch` agrega únicamente `/automatizacion/data_hub_593.py`, con el mismo PIN `79f4e4fb77e30fd3a8a7ebac009cd8204a3b4c95`. Su hash esperado es `4072336099a31a81a64685b1e2c60b7354246721a815a3d73b1688e6bf0bb50d`.
3. **Dos copias del workflow.** El despacho usa la rama piloto, mientras que el checkout del publicador obtiene main. La línea del cuarto archivo debe estar en el workflow de la rama piloto y en main, conservando todos los cambios de #416. Ambas copias observadas tienen SHA `c07d5c9ec1d6f23a4dd2217bd0837e787199907caa7cb2cea5c3186c30264612`; el candidato con esa única línea es `ee982017317151bd4e6d0dfd9028d6459f35302a22d77d07ddf8c387eec31736`.
4. **Registro histórico activo distinto de la copia del repositorio.** La lectura comprobó `source-attestations.mjs` SHA `a8686008f2386c8839af0b90d3c408dffa932faf1e6803cec940404959148ece`. El manifiesto se actualiza a esa base real, sin sustituirla por la copia pública compilada `e32bfd…`. El contenido histórico permanece intacto.
5. **Comprobadores antiguos del checkout.** `worker.mjs` activo ahora es `e0dc4f7303447e45d57fb94933030597dbfda2dabfb0f2bb94ac85229f8393ec`, no la identidad 57226559… anterior a #416. Un ejecutor que aún exija esa base debe detenerse y reconciliar su comprobación, sin retirar el control ni reinstalar el checkout. Los dos módulos originales del checkout conservan sus hashes. Sus ventanas del 25/11 ya vencieron; esta coordinación no renueva permisos temporales ni habilita la prueba.

El parche de preparador de #396 continúa siendo `d57ad14e70b1bceba868a83dce34cc6eed8ddb7a495d020ef2ce2c5e9ee1e197`, sobre el archivo original SHA `944bfd31a1089469e6decdfd2d1a0249473e38a8d31e122ed2fa3ff7689e0cd7`. No se ha aplicado a main.

## Orden de instalación propuesto

1. Conservar la integración instalada de #416 y dejar finalizar su configuración legítima en la tarea responsable. No reemplazar su workflow por versiones anteriores de #396. La comunicación de coordinación quedó en #416, comentario 7204001295.
2. Tras autorización, agregar primero el cuarto archivo al workflow de la rama piloto. Esa ampliación de checkout es compatible con el preparador anterior y no cambia permisos. Esperar a que terminen las ejecuciones antiguas de publicación con tres módulos. Integrar después en main el parche del preparador y la misma línea de workflow en un único cambio técnico. Conservar inputs, reservas, CAS, supervisor y publicación original.
3. Completar la evidencia del corte vigente con su original validado, por el preparador existente. El observador deduplica los SHA ya publicados y no los descarga otra vez: no forzar reenvíos, reservas ni estados pendientes para llenar esos metadatos. Si se requiere completar el corte actual, usar el camino de metadatos del preparador, sin modificar generación, recibo, secuencia o valores comerciales. Los siguientes cortes la generarán por el flujo ordinario.
4. Sólo entonces efectuar la reparación del lector con el transporte original, dentro del grupo **`comercial-cloud-piloto`, `cancel-in-progress:false`**, que ya utiliza #416. Leer de nuevo bundle y settings, confirmar las identidades activas seleccionadas, el registro histórico intacto, la evidencia vigente y la ausencia de cambios concurrentes; conservar respaldo cifrado recuperable y límites gratuitos. Un PUT máximo, sustituyendo solamente `shared-hub.mjs`.
5. Verificar lector, resto del bundle/settings, receptor/adaptadores, fuente privada y cierre comercial. Ante fallo, un PUT máximo de recuperación específica del lector, condicionado a que su candidato y la base capturada sigan siendo los esperados. No restaurar el bundle previo a #416 ni reemplazar otros módulos. No iniciar dos escritores del Worker simultáneamente.
6. Retomar por separado la prueba sintética #396 después de renovar su ventana e identidades de ejecución bajo autorización específica. Esta autorización de fuente no instala módulos temporales ni autoriza pedidos públicos.

La publicación de cortes mantiene su grupo existente **`publicacion-stock-593-web`, `cancel-in-progress:false`**, las reservas por SHA y el CAS sin force. Son controles para datos; no sustituyen el bloqueo de despliegues del Worker. El supervisor horario y el observador deben conservar la misma bandeja y publicador, sin otro inventario.

## Pruebas y evidencias

**Seis pruebas nuevas de compatibilidad aprobadas**, sin repetir las 29 de fuente ni las suites anteriores del observador:

- Instalador #416 preserva la corrección permanente, checkout y fuente privada sintética.
- Su inversa preserva la corrección y trabajo ajeno posterior.
- La reparación de autenticación preserva lector y checkout.
- Tres archivos reproducen el rechazo del cuarto módulo original faltante.
- El workflow coordinado conserva grupo/PIN e incluye los cuatro módulos correctos.
- La entrada real del publicador #416 ejecuta el preparador modificado con un XLSX sintético recién generado, conserva su evidencia y no modifica originales ni index de publicación.

La diferencia del workflow es exactamente una línea y aplica/revierte sobre las dos copias observadas. El código permanente y sus 29 pruebas se conservan, sin recompilar ni instalar el checkout original de ocho módulos.

## Autorización definitiva solicitada para la fuente

Aprobar el paquete técnico descrito en esta coordinación y el manifiesto actualizado: integración del preparador y la línea de validador en ambas ramas, metadatos de un corte original vigente, y un único PUT del lector candidato 10ebe491… con un PUT de recuperación específica sólo ante fallo seguro. La autorización caduca como base técnica si cambian las identidades de módulos seleccionadas; debe reconciliarse antes de escribir, sin eliminar controles.

No comprende completar credenciales personales, modificar sus permisos, activar el observador por fuera de su tarea, instalar otra vez #416, modificar la fuente privada, habilitar checkout, fichas o Ads. No se ha instalado nada desde esta coordinación. Costo adicional $0.
