# Correspondencia con Google Merchant Center 5874003439

**No enviado. No guardar una política parcial ni retirar exclusiones.** Esta preparación no cambia la cuenta ni el feed. La URL prevista solo se introducirá como política publicada cuando exista autorización y responda con el texto aprobado, accesible sin registro.

Referencia oficial: [configuración de políticas de devolución](https://support.google.com/merchants/answer/14011730?hl=es); [atributo returns y sus valores](https://support.google.com/merchants/answer/17081382?hl=en).

| Campo del formulario | Correspondencia de CONECTATECH | Valor listo / pendiente |
|---|---|---|
| País y moneda | Ecuador; USD | `EC`; `USD` |
| URL | Página permanente de la política | `https://conectatech-ec.github.io/cambios-devoluciones-garantias/`; **prevista, no publicada** |
| Aceptación de devoluciones | Derechos para defectuosos y no defectuosos cuando proceda la ley | Selección: **Sí, acepto devoluciones de productos defectuosos y no defectuosos**. No elegir «no acepto» ni «solo defectuosos» como política general. |
| Aceptación de cambios | Existen cambios legales y facilidades voluntarias | **Sí, acepto cambios**. Los cambios voluntarios y sus restricciones se explican en la página; no eliminan los cambios legales. |
| Estado del producto | Mismo estado de recepción en art.45; defectos se atienden por su régimen | No seleccionar automáticamente «sin abrir»: falta confirmar la correspondencia exacta entre la operativa y las opciones de Google. |
| Plazo de devolución | Término legal quince días desde recepción, con naturaleza/estado exigidos | Base legal `15`, tipo `termino_legal_dias`. Campo numérico de Google **sin completar** hasta verificar cómputo. No ingresar3 o7, ni confundir este plazo con 1año/30días de garantía. |
| Método de devolución | Atención en local/contacto; recepción física o por transporte no confirmada | Pendiente: confirmar en tienda, envío u otros métodos realmente disponibles. No activar etiquetas/transportista inexistentes. |
| Gastos de devolución | Según causa y responsabilidad; error de tienda no se traslada improcedentemente | Pendiente: costo real para devolución sin defecto/error; forma de cubrir gastos cuando corresponden a tienda. No insertar `0.00 USD` por ausencia de datos. |
| Etiqueta de devolución | No confirmada | Pendiente. No elegir descarga, incluida en caja o a cargo del cliente sin comprobarlo. |
| Tarifa de reposición/aprovisionamiento | No aprobada | Pendiente; no inventar tarifa, porcentaje ni afirmar que existe. Confirmar también si no se cobra. |
| Procesamiento del reembolso | No se indicó un plazo operativo real | Pendiente: método y plazo. No usar como sustituto los3/7 comerciales ni el límite del art.71 que corresponde a supuestos concretos. |
| Excepciones por categoría/SKU | Solo condiciones verdaderas compatibles con la ley | No configurar `NO_RETURNS` para celulares/tablets/TV. Una excepción de garantía no es una excepción de devolución. No añadir `return_policy_label` hasta existir políticas reales aprobadas. |

Si una opción del formulario no expresa fielmente las condiciones legales, **no guardar una equivalencia falsa**. Confirmar cómputo/operativa o consultar soporte de Merchant Center antes de introducir el campo. No se añade un bloque JSON-LD `MerchantReturnPolicy` con datos incompletos ni atributos `returns` al feed.

Secuencia tras aprobación: publicar texto y enlaces con revisión sobre main actualizado → comprobar HTTPS y accesibilidad → completar los campos reales en Envíos y devoluciones → revisar estado/diagnósticos de Google. La aprobación de esta política no cierra por sí sola compra online, stock o envíos del proyecto Merchant. Mantener `Shopping_ads` y `Free_listings` excluidos hasta completar todos los requisitos y recibir autorización de activación.
