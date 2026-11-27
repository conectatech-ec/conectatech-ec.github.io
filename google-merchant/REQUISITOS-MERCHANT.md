# Conexión a Merchant Center 5874003439

Preparación técnica; no es una política comercial de la tienda ni autoriza publicaciones.

## Acciones del propietario en Merchant Center

1. Entrar a la cuenta **5874003439** con el usuario autorizado. Configuración → Información de empresa → Tienda online: usar exactamente **https://conectatech-ec.github.io/**, sin www. Comprobar separadamente los estados **Verificado** y **Reclamado**.
2. Existe el recurso público `https://conectatech-ec.github.io/google8bb019c7a5a192ed.html`. Su contenido es `google-site-verification: google8bb019c7a5a192ed.html`. Consultar el resultado HTTPS en `preconexion.json`. Si Google reconoce la propiedad, completar **Reclamar**. Si solicita otro archivo/tag, facilitar su nombre/contenido exacto o usar un usuario que ya sea propietario verificado en Search Console y miembro de Merchant Center. No compartir contraseñas. No asumir que este archivo pertenece a la cuenta indicada ni retirar una reclamación de otra cuenta sin identificarla.
3. Productos → Fuentes de datos → Añadir archivo desde URL: pegar la URL estable del feed, elegir **Ecuador / español / USD** y configurar descarga diaria. Los nombres del menú pueden variar. No habilitar Google Ads ni retirar las exclusiones `Shopping_ads` y `Free_listings`.
4. Revisar procesamiento, errores por artículo y estado de la cuenta. El feed tiene exclusiones expresas: los artículos permanecen sin publicación para esos destinos. No interpretar la aceptación del XML como aprobación comercial.

URL exacta:

`https://raw.githubusercontent.com/conectatech-ec/conectatech-ec.github.io/refs/heads/feeds/google-merchant-ec/google-merchant/productos-ec.xml`

## Datos indispensables antes de retirar las exclusiones

| Área | Evidencia disponible | Falta confirmar |
|---|---|---|
| Inventario | Corte corregido 593 **16/10/2026**, archivo adjunto del propietario, hash y revisión limitada sin cantidades | Próximo corte cuando cambien existencias/precios; no hay API de 593 en tiempo real. Resolver discrepancias de disponibilidad con fichas sin que esta integración modifique producción. |
| Precio | Precio web reutilizado solo si coincide con Q V. TOTAL del corte16. PVP final = X + importe Y de IVA, únicamente para comparación | Precio final accesible al comprador, método de pago contado, cargos obligatorios y total antes de confirmar. No convertir PVP ni aplicar fórmulas históricas. |
| Compra | Fichas con consulta/compra por WhatsApp; panel interno de cotizaciones | Proceso completo de pedido y confirmación en el sitio con entrega estimada. Contraentrega puede ser un medio de pago; una consulta o cotización no acredita compra completa. |
| Envíos | Texto existente: contraentrega en Quito, consulta de cobertura/costo | Zonas concretas, exclusiones, tarifas, mínimos si existen, preparación y tránsito. No suponer cobertura nacional, envío gratuito ni plazos. Ecuador no está en la lista general de países donde shipping es obligatorio para fichas gratuitas, pero los gastos y condiciones de compra deben ser claros. |
| Devoluciones | Referencias a garantía y consulta comercial | Política pública verdadera: si se aceptan devoluciones, plazo, condiciones, procedimiento, costos, reembolso y contacto. Garantía y devolución son conceptos distintos. No inventar días ni aceptación/rechazo. |
| Empresa | Nombre, contacto y dirección existentes en web | Comprobar en la cuenta datos de empresa, contacto, país y diagnóstico. Esta integración no tiene sesión ni credenciales de Merchant Center. |
| Identificadores e imágenes | SKU y fotos aprobadas reutilizados, revisión HTTPS y hashes | GTIN/MPN auténticos si Google los exige; no fabricar `identifier_exists=no`. Revisar políticas de imágenes y metadatos de IA cuando corresponda. |

Las condiciones comerciales pendientes requieren información real del propietario. No se han publicado nuevas políticas, creado checkout, realizado pedidos de prueba ni modificado banners/Alex/SKU.

## Flujo cloud sin laptop ni modificaciones en main

Código y fuentes depuradas: `integracion/google-merchant-20261016`. Cada ejecución de GitHub Actions lee el HEAD actual de main en una copia separada y usa exclusivamente la revisión limitada `google-merchant/fuentes/vigente.json` para disponibilidad y validación de los precios ya públicos. Las columnas financieras privadas no se publican.

Un cambio de la revisión limitada o de `google-merchant/solicitud-actualizacion.json` dispara la validación HTTPS en la nube. Una tarea de ChatGPT programada puede renovar únicamente ese marcador para ejecutar el flujo sin depender de los schedules de main. Su creación y estado deben comprobarse en el resultado de la herramienta de automatizaciones; este archivo no los presupone. No usa una laptop ni contrata servicios.

El flujo conserva fechas y hashes reales del corte; no inventa inventario nuevo. Actualizar información del corte exige otra exportación real autorizada y su revisión privada y actualización limitada en esta rama. Si el flujo falla, comprobar Actions y la fecha de la última validación antes de usar el feed: no se debe presentar un archivo anterior como recién verificado.

Fuentes oficiales: [verificación y reclamación](https://support.google.com/merchants/answer/11586344?hl=es), [compra completa](https://support.google.com/merchants/answer/10249082?hl=es), [fichas gratuitas](https://support.google.com/merchants/answer/13889434?hl=es), [devoluciones](https://support.google.com/merchants/answer/14011730?hl=es).

La revisión automática rechazó publicar el CSV interno completo. Se conservó privado: la fuente pública se limita a disponibilidad de artículos del feed y precios que ya constan en la web, sin cantidades internas ni precios nuevos.
