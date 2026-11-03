# Entrega para aprobación — cambios, devoluciones y garantías

Estado: **BORRADOR NO PUBLICADO**. Rama preparada separadamente; no modifica main, producción, feed Merchant, datos593, fotos, banners ni Worker de Alex. Costo adicional $0.

## Archivos de revisión

- `POLITICA-COMPLETA.md`: texto público breve generado para lectura y aprobación; la revisión final03/11 sustituye la redacción extensa y retira cortesías1–3/7.
- `../cambios-devoluciones-garantias/index.html`: página estática móvil/escritorio; navegación, pie y canal oficial. URL permanente prevista: `https://conectatech-ec.github.io/cambios-devoluciones-garantias/`. No presentarla como pública antes de aprobación y despliegue.
- `politica.json`: única fuente de condiciones, contactos, reglas por categoría y excepciones SKU; incluye las condiciones de envíos/pagos recuperadas el03/11.
- `../compra/envios-pagos.html`: vista de revisión generada con tarifa nacional, sobrecostos a cargo de tienda, contraentrega Quito y anticipo nacional. Enlazada desde la compra.
- `garantias.mjs`: resolver y mensajes cortos portables, sin llamadas de red ni cambios del Worker.
- `alex-fuente.json`: fuente de respuestas y reglas de escalamiento. **No integrada**; coordinar con la sesión de Alex antes de importar.
- `garantias-catalogos.csv`: etiquetas y cobertura para banners o catálogos; no modifica los actuales.
- `VERIFICACION-LEGAL.md`: fuentes oficiales, reforma2022 y límites de la comprobación.
- `GOOGLE-MERCHANT-CENTER.md` y `merchant-center.json`: correspondencia por campo y bloqueos; no enviados a Google.

## Garantías configurables

Llamar `garantia(config, {sku, categoriaGarantia, categoriaCatalogo})`. No se adivina la categoría por prefijo SKU. `categoriaGarantia` es una clasificación explícita documentada: celulares, accesorios, tablets, televisores, computacion u otros. Los alias actuales solo reconocen denominaciones exactas indicadas en JSON; clasificar las demás categorías antes de usarlas masivamente en Alex/PDF. Una categoría desconocida devuelve «plazo indicado para cada artículo», nunca cero garantía.

Precedencia: excepción SKU aprobada y documentada → regla de categoría → plazo por artículo. Para ampliar una categoría se cambia el valor; para un SKU se registra categoría, valor, unidad, `aprobada:true` y evidencia. No se permiten plazos menores ni cambios de unidad sin revisión. Los textos de garantía se calculan desde datos: celulares1año conserva exactamente «1 año de garantía».

Ejemplo de **estructura**, no regla real que se deba publicar:

```json
{"SKU_DOCUMENTADO":{"categoria":"accesorios","valor":90,"unidad":"dia","aprobada":true,"evidencia":"Referencia a autorización real del propietario"}}
```

Después de cambiar datos autorizados: `node politicas/construir.mjs`. Reutiliza los mismos textos en página, documento, CSV y fuente de Alex. No reconstruye el catálogo ni toca precios/inventario. Una modificación legal requiere actualizar evidencia, versión y pruebas, no solo cambiar un número.

## Enlaces preparados sin reescribir fichas comerciales

El `index.html` de esta rama incorpora únicamente el enlace de política en el pie; su catálogo JSON permanece idéntico al snapshot base. El generador de fichas de esta rama llama al helper idempotente `enlaces.cjs` para que conserve el enlace en futuras generaciones. **No se ha ejecutado el generador comercial**: tiene otros efectos y no es necesario para añadir enlaces.

Las fichas actuales se mantienen intactas durante esta revisión. `preparar-enlaces.cjs --root COPIA_AISLADA` produce una simulación con hashes; se probó sobre1.171 archivos sin escrituras. Tras aprobar la política y reconciliar con main fresco, su modo `--aplicar` añade solo el enlace a las fichas existentes y al pie. Está bloqueado mientras `estado` no sea `APROBADA` y `publicar` no sea `true`. Así no se sobrescribe la producción paralela de SKU con una copia antigua de sus fichas.

## Pendientes imprescindibles antes de publicación

1. Cerrar la redacción operativa y aprobar la publicación posterior. La razón social recuperada de593 es VELASCO VALDERRAMA JOSE RAFAEL: ya está incorporada, no volver a solicitarla.
2. Confirmar recepción de devoluciones en local y/o transporte, gastos cuando no hay defecto/error, etiqueta/transportista si aplica, si existe tarifa de reposición, y método/plazo operativo real del reembolso. No se inventó ninguno.
3. Cerrar el cómputo del término legal de15 días para su correspondencia exacta con Google. La página conserva el texto legal; no se reemplazó por3/7 días ni se aseguró sin evidencia que los días sean naturales/hábiles.

Para garantía por otros productos y excepciones SKU: mantener el plazo real ya documentado en cada artículo. No asignar uno masivo sin confirmación.

## Publicación posterior, solo con aprobación

Revisar cambios concurrentes contra main fresco; conservar los contratos y medios actuales. Confirmar pendientes → aprobar versión y quitar el aviso de revisión/noindex mediante un cambio revisado → aplicar solo enlaces con hashes vigentes → comprobar móvil, HTTPS y canal oficial → configurar Google con los valores reales. La URL pública de política, la configuración Merchant y la integración del Worker de Alex siguen separadamente pendientes de autorización. No se solicita ni se da por hecha coordinación con otra sesión que no se puede controlar desde este chat.

La revisión03/11 se integra en el PR313 de compra directa. Recupera la tarifa nacional inicial $6.90 para todos los productos con sobrecosto a cargo de tienda y el plazo informado1–3 días; falta el cómputo operativo de entrega y las zonas Quito. No modifica producción ni configura Merchant. Las exclusiones del feed siguen intactas.
