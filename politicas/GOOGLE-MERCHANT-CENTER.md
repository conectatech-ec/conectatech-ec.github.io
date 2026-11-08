# Correspondencia con Google Merchant Center 5874003439

**Estructura aprobada el 06/11; texto comercial conservado exactamente. Operativa y publicación pendientes. No enviado.** Esta preparación no cambia la cuenta ni el feed. La URL prevista solo se introducirá como política publicada cuando exista autorización y responda con el texto aprobado, accesible sin registro.

Referencia oficial: [configuración de políticas de devolución](https://support.google.com/merchants/answer/14011730?hl=es); [atributo returns y sus valores](https://support.google.com/merchants/answer/17081382?hl=en).

| Campo del formulario | Correspondencia de CONECTATECH | Valor listo / pendiente |
|---|---|---|
| País y moneda | Ecuador; USD | `EC`; `USD` |
| URL | Página permanente de la política | `https://conectatech-ec.github.io/cambios-devoluciones-garantias/`; **prevista, no publicada** |
| Aceptación de devoluciones | Derechos para defectuosos y no defectuosos cuando proceda la ley, sin cortesías | Selección: **Sí, acepto devoluciones de productos defectuosos y no defectuosos**. No elegir «no acepto» ni «solo defectuosos» como política general. |
| Aceptación de cambios | Existen cambios legales; las cortesías y plazos voluntarios se retiraron por instrucción03/11 | **Sí, acepto cambios**. La ausencia de cortesías no elimina los cambios legales. |
| Estado del producto | Mismo estado de recepción en art.45; defectos se atienden por su régimen | No seleccionar automáticamente «sin abrir»: falta confirmar la correspondencia exacta entre la operativa y las opciones de Google. |
| Plazo de devolución | Término legal quince días desde recepción, con naturaleza/estado exigidos | Base legal `15`, tipo `termino_legal_dias`. Campo numérico de Google **sin completar** hasta verificar cómputo. No restablecer plazos voluntarios ni confundir este término con la garantía: celulares/tablets 1 año y accesorios/demás productos 30 días. |
| Método de devolución | Local preferente y envío previamente coordinado | Preparado: `IN_STORE`, `BY_MAIL`. La modalidad de etiqueta debe representar el mecanismo real. |
| Gastos de devolución | Comprador cuando procede una devolución por decisión propia; obligaciones aplicables en fallas/errores | Sin promesa de gratuidad general. Precisar reparto obligatorio por causa antes de publicar. No asignar tarifa fija inexistente. |
| Etiqueta de devolución | No confirmada | Pendiente. No elegir descarga, incluida en caja o a cargo del cliente sin comprobarlo. |
| Tarifa de reposición/aprovisionamiento | Sin cargo, aprobado | `0 USD`, separado del costo de transporte. |
| Procesamiento del reembolso | Medio original cuando sea posible o transferencia acordada | Máximo operativo aprobado de 7 días calendario desde la recepción del producto devuelto hasta que el cliente reciba el abono. Antes de publicar, verificar capacidad de acreditación y respetar plazos obligatorios menores. |
| Excepciones por categoría/SKU | Solo condiciones verdaderas compatibles con la ley | No configurar `NO_RETURNS` para celulares/tablets/TV. Una excepción de garantía no es una excepción de devolución. No añadir `return_policy_label` hasta existir políticas reales aprobadas. |

Si una opción del formulario no expresa fielmente las condiciones legales, **no guardar una equivalencia falsa**. Confirmar cómputo/operativa o consultar soporte de Merchant Center antes de introducir el campo. No se añade un bloque JSON-LD `MerchantReturnPolicy` con datos incompletos ni atributos `returns` al feed.

Secuencia tras completar la operativa y autorizar la publicación: publicar texto y enlaces con revisión sobre main actualizado → comprobar HTTPS y accesibilidad → completar los campos reales en Envíos y devoluciones → revisar estado/diagnósticos de Google. La aprobación de esta política no cierra por sí sola compra online, stock o envíos del proyecto Merchant. Mantener `Shopping_ads` y `Free_listings` excluidos hasta completar todos los requisitos y recibir autorización de activación.

Para el MVP Quito: la web debe contener la operativa real. Añadir la política también en Merchant es recomendado; no convertir un campo numérico opcional en un compromiso comercial adicional. La documentación regional de Google indica Ecuador por provincia: no afirmar cobertura total Pichincha por preparar sólo Quito. Nacional permanece deshabilitado.

## Continuidad del 06/11

La página comercial preparada está en `/garantias/`; su cuerpo conserva exactamente el texto aprobado, sin el término de devolución. La URL previa `/cambios-devoluciones-garantias/` se reutiliza para los detalles, con enlace discreto desde el pie y desde garantías. Son páginas de revisión con noindex. La web debe exponer las condiciones completas cuando se autorice la publicación.

La [guía de fichas gratuitas](https://support.google.com/merchants/answer/13889434?hl=en) exige información en la web y recomienda agregarla en Merchant. Por ello la propuesta usa primero la web y no crea una política parcial en la cuenta. La [API](https://developers.google.com/merchant/api/reference/rest/accounts_v1/accounts.onlineReturnPolicies) define cada día como 24 horas desde entrega. No hay una equivalencia comprobada con el término ecuatoriano, ni autorización para sustituirlo por 15/21/30 días calendario. Confirmar criterio específico antes de completar ese campo.

La comprobación directa de la cuenta 5874003439 encontró sesión cerrada para la cuenta empresarial. No se verificó un recuento actual ni nuevos diagnósticos. Los 370 productos recibidos siguen siendo la última observación histórica, del 03/11. Recuperar sesión antes de afirmar el estado vigente.

## Cierre operativo del piloto

El dominio `conectatech-ec.github.io` figura **Verified** y **Claimed** en la cuenta 5874003439. La pantalla de incidencias de configuración y políticas muestra **No issues for you to fix**. SOPO012 todavía figura en revisión. El PR #363 contiene 307 candidatos de simulación, no fichas aprobadas. La compra real debe completar de forma segura el pedido en la web y confirmar total y fecha estimada. Contraentrega es un método admitido según la [guía de Google](https://support.google.com/merchants/answer/10249082?hl=en).

- **Cobertura Quito:** entregar la lista de sectores o códigos postales autorizados para contraentrega, y aclarar si se aplica alguna exclusión de productos. El catálogo de pedidos queda sin cobertura general hasta entonces.
- **Tarifa:** confirmar si los $3,50 de la referencia previa se aplican a todos los códigos del piloto o proporcionar la tarifa de cada zona.
- **Calendario:** confirmar días de reparto, regla para feriados y rango mínimo/máximo de entrega por zona. Si se usa hora de corte, precisarla y comprobarla antes de prometer una fecha.
- **Devoluciones:** mantener recepción preferente en local y envío coordinado. Se conserva el término publicado en el borrador, sin convertirlo a días de 24 horas ni guardar una política parcial en Merchant. Para una devolución por preferencia aplica el costo de envío aprobado cuando corresponda. Para falla o error, confirmar quién cubre el transporte en el caso concreto antes del despacho, sin cobrar al cliente gastos improcedentes. El medio original o la transferencia acordada ya están definidos. El máximo operativo de 7 días calendario está aprobado con la condición de verificar la acreditación dentro del plazo y respetar cualquier plazo obligatorio menor.
- **Datos:** el aviso de revisión enlaza antes de los campos y describe los datos y su conservación según el flujo ensayado. Para publicación falta confirmar el tratamiento contratado con Cloudflare, el régimen aplicable al alojamiento y los destinatarios concretos de entrega. Fuente: [artículo 12 de la LOPDP](https://www.gob.ec/sites/default/files/regulations/2025-01/01%20Ley%20Org%C3%A1nica%20de%20Protecci%C3%B3n%20de%20Datos%20Personales.pdf).
