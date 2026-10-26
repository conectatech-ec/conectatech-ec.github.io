# Presentación web CONECTATECH

Esta capa se carga al final del `index.html` vigente con cinco referencias. No sustituir el catálogo por las instantáneas de revisión. Los productos, sus objetos, títulos, fotos, precios, stock, orden de publicaciones, fichas y WhatsApp siguen perteneciendo a los componentes existentes.

## Cambiar la temporada

Editar únicamente `config.js`, propiedad `tema`:

- `automatico`: Halloween en octubre; Black Month en noviembre; Black Friday el último viernes de noviembre y su fin de semana; Navidad en diciembre; identidad azul/verde fuera de esas fechas.
- `halloween`, `black-month`, `black-friday`, `navidad` o `identidad`: fijar un ambiente manualmente.

El calendario usa `America/Guayaquil`. Revalida la fecha cada minuto y al volver a la pestaña. No necesita jobs, servidores ni servicios pagos. El calendario cambia sólo la presentación; no crea descuentos ni modifica condiciones de compra. `calendario` y `temas` permiten añadir futuras campañas; para periodos entre años se admiten intervalos como 12-15 a 01-06.

Las vistas `/revision/presentacion-web-v2/despues.html?temporada=navidad` permiten revisar ambientes sin cambiar la configuración del sitio. El parámetro de prueba no se aplica en la tienda principal.

## Selección de portada

`productosPortada` contiene exclusivamente SKU existentes. El carrusel toma título y subtítulo editoriales vigentes, fotografía, ficha, Promo Contado y PVP del catálogo actual. Omite automáticamente los no elegibles según disponibilidad inteligente y los que no tengan imagen. Si no queda ningún elegido, oculta la vitrina. Cambiar esta selección no altera el orden del catálogo ni fechas editoriales.

Autoplay cada 3 segundos, vuelta automática al primero tras el último producto, precarga de imágenes, flechas, indicadores, pausa, teclado y gestos táctiles. Un barrido de circuito breve termina cada cambio; `efectoTecnologico:false` lo desactiva. Pausa con foco/hover/pestaña oculta y respeta movimiento reducido. La inicialización es idempotente.

## Marca y banner

El logo `/logo-conectatech.png` conserva exactamente sus bytes. La marca visible reutiliza uniformemente los trazos del encabezado que está en «Marca y encabezado aprobados» de Drive: no se redibuja ni se reemplaza con Arial, Sora u otra fuente. El PNG aprobado está copiado sin cambios. La marca visible usa ahora una instancia transparente de los nodos vectoriales del maestro aprobado: los mismos trazos, gradientes y transformaciones, sin su rectángulo de fondo. El maestro y el emblema original no se editan. Los archivos del proyecto SIGNATURE permanecen intactos. Sora es la fuente de interfaz y su licencia OFL está incluida; no sustituye la marca.

`banner-regalos-original.png` es una copia exacta del archivo entregado por el propietario, «Banner promo regalos WEB.png», Drive ID 14h8P9JIrLkETdymi9Nm44Ui7uA1iQLIP. Se muestra completo, sin filtros ni recorte, y permite ampliación. Se conserva «MÍNIMA DE» en el arte original conforme a la tolerancia expresada por el propietario el 25/10/2026; el texto y las condiciones de la web mantienen su preferencia «compras superiores a». No se inventan condiciones ni se eliminan las restricciones existentes.

Costo adicional: $0. No editar generadores, inventario, fotografías, títulos, SIGNATURE ni WhatsApp desde esta capa.

## Ambientación sin etiquetas

La sección superior se denomina **hero de portada** o **banner principal** y contiene la vitrina con carrusel. Halloween utiliza una ilustración ambiental original de aspecto fotográfico: calabaza gigante iluminada, luna, árboles, murciélagos, telarañas y reflejos ámbar. En escritorio el fondo ocupa toda la sección, con el mensaje de marca a un lado y una tarjeta comercial única al otro: fotografía real, título, Promo Contado, PVP y acciones contiguos. En móvil se presenta la escena completa y se mezcla gradualmente con el contenido. Las imágenes de los productos permanecen íntegras, con su fondo original. No se recortan ni se generan productos nuevos. Una calabaza propia con transparencia corona el emblema, con su base integrada al borde superior; el logo original queda por encima y conserva su tamaño y rótulo. Se reserva espacio superior durante Halloween. La altura real del encabezado alimenta el margen de las anclas para conservar la navegación. El calendario retira esta ambientación al cambiar de temporada.

El catálogo muestra cinco productos por fila desde 1200 px, tres entre 601 y 1199 px y dos hasta 600 px. El encabezado de regalos dice «En esta temporada tu compra tiene un regalo», con antetítulo y mensaje principal destacados; no cambia los montos ni las condiciones.

## Jerarquía de las tarjetas

Categoría y SKU comparten una franja secundaria; el título mantiene su texto editorial y usa 14 px en escritorio y 12 px en móvil, con mayor peso. Se elimina su altura mínima reservada: el subtítulo queda a 3 px del título, sin renglones vacíos. Se conservan imágenes, datos, enlaces, disponibilidad, orden y cinco columnas/dos en móvil. No se editan componentes editoriales ni sus datos.

Referencia de composición indicada por el propietario: https://techtogoec.com/. Orienta el protagonismo comercial del producto; las ilustraciones, colores, recursos y composición de CONECTATECH son propios.

## Procedencia de la ambientación inmersiva

`halloween-escena-original.webp` y `halloween-calabaza-corona.webp` son recursos decorativos originales generados con la herramienta integrada `image_gen`. No contienen productos ni textos comerciales. Sus PNG fuente permanecen intactos en el espacio de trabajo; los WebP sólo optimizan su entrega en web. Se conserva la transparencia de la corona. No se utiliza el arte del sitio de referencia ni se editan logo, imágenes del catálogo o banner promocional. Sin servicios adicionales de pago.

## Vitrina orientada a compra

Cada transición agrupa fotografía y datos en una sola tarjeta, sin el mensaje de marca intercalado. Usa dos columnas en escritorio y fotografía completa arriba con título, precios y acciones debajo en móvil. El botón «Comprar por WhatsApp» reutiliza exactamente `availabilityContact(p)` del catálogo vigente; no construye mensajes, números ni destinos nuevos y conserva la consulta de disponibilidad. «Ver ficha del producto», la fotografía y el título conservan `productHref(p)`. La tarjeta se pausa al recibir hover o foco y, ahora, al tocarla en móvil; el botón de reproducción permite reanudarla. Fuera de esa interacción sigue avanzando cada tres segundos y vuelve al primero. Los enlaces de diapositivas inactivas siguen inertes.


## Rotación diaria de vitrina y Destacados

`config.js` → `rotacionDiaria` controla ambas selecciones. Está activa: cinco productos en la vitrina y cinco complementarios en Destacados. El módulo puro `rotacion.js` genera un plan determinista por fecha local de Quito a partir de los productos vigentes elegibles: stock disponible según el motor existente, fotografía publicada local, ficha existente y precios comerciales válidos. El catálogo, sus objetos, categorías, precios y fechas no se escriben ni reordenan.

La planificación combina familias comerciales y rangos de precios existentes; da una preferencia moderada a actualizaciones de los últimos 21 días y abre cada selección con una familia visual de `categoriasApertura` cuando hay candidatos. No afirma popularidad, ventas ni descuentos nuevos. El historial se reproduce desde 2026-01-01 para todos los visitantes; se evita repetir un SKU en ambas secciones durante siete días con el mismo conjunto elegible. Si no hay suficientes candidatos, se libera primero el día más antiguo; nunca se duplican productos en la selección del día. El plan del día es estable mientras no cambien el catálogo, las disponibilidades o la configuración. No necesita almacenamiento local, cuentas, tareas externas ni servicios pagos. El cálculo queda memorizado para comprobaciones y fechas posteriores de la misma página.

Un temporizador calcula la siguiente medianoche en `America/Guayaquil`; se revalida además cada minuto y al volver a la pestaña. Los productos que dejan de ser elegibles o cuya fotografía no carga se excluyen y sustituyen. La renovación limpia temporizadores y listeners del carrusel anterior para conservar flechas, pausa, gestos y efectos sin duplicarlos. El alto del carrusel se adapta a los títulos y subtítulos vigentes completos, incluyendo cambios de fuente y pantalla.

Para impulsar una campaña, añadir SKU existentes a `fijadosVitrina` o `fijadosDestacados`. Las fijaciones válidas tienen prioridad y pueden repetirse entre días por decisión expresa; si están agotadas, sin fotografía o sin ficha, se omiten. Una misma fijación no se muestra en ambas secciones. Para desactivar la automatización, `activa:false` conserva `productosPortada` como selección manual de la vitrina; Destacados usa una selección disponible complementaria.

Destacados conserva los componentes `productImage`, `nameHTML`, `statusHTML`, `productHref` y `availabilityContact` actuales. Su presentación usa cinco columnas en escritorio, tres en tamaños intermedios y dos en móvil; la quinta tarjeta móvil ocupa la fila completa con foto e información contiguas. Promo Contado es principal y PVP secundario. Marca, títulos/subtítulos, fotos, fichas, WhatsApp, orden editorial y datos593 intactos.
