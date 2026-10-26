# Presentación web CONECTATECH

Esta capa se carga al final del `index.html` vigente con cuatro referencias. No sustituir el catálogo por las instantáneas de revisión. Los productos, sus objetos, títulos, fotos, precios, stock, orden de publicaciones, fichas y WhatsApp siguen perteneciendo a los componentes existentes.

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

La sección superior se denomina **hero de portada** o **banner principal** y contiene la vitrina con carrusel. Halloween utiliza una ilustración ambiental original de aspecto fotográfico: calabaza gigante iluminada, luna, árboles, murciélagos, telarañas y reflejos ámbar. En escritorio el fondo ocupa toda la sección, con fotografía real a un lado, mensaje central y título/precio al otro. En móvil se presenta la escena completa y se mezcla gradualmente con el contenido. Las imágenes de los productos permanecen íntegras, con su fondo original. No se recortan ni se generan productos nuevos. Una calabaza propia con transparencia corona el emblema, con su base integrada al borde superior; el logo original queda por encima y conserva su tamaño y rótulo. Se reserva espacio superior durante Halloween. La altura real del encabezado alimenta el margen de las anclas para conservar la navegación. El calendario retira esta ambientación al cambiar de temporada.

El catálogo muestra cinco productos por fila desde 1200 px, tres entre 601 y 1199 px y dos hasta 600 px. El encabezado de regalos dice «En esta temporada tu compra tiene un regalo», con antetítulo y mensaje principal destacados; no cambia los montos ni las condiciones.

## Jerarquía de las tarjetas

Categoría y SKU comparten una franja secundaria; el título mantiene su texto editorial y usa 14 px en escritorio y 12 px en móvil, con mayor peso. Se elimina su altura mínima reservada: el subtítulo queda a 3 px del título, sin renglones vacíos. Se conservan imágenes, datos, enlaces, disponibilidad, orden y cinco columnas/dos en móvil. No se editan componentes editoriales ni sus datos.

Referencia de composición indicada por el propietario: https://techtogoec.com/. Orienta el protagonismo comercial del producto; las ilustraciones, colores, recursos y composición de CONECTATECH son propios.

## Procedencia de la ambientación inmersiva

`halloween-escena-original.webp` y `halloween-calabaza-corona.webp` son recursos decorativos originales generados con la herramienta integrada `image_gen`. No contienen productos ni textos comerciales. Sus PNG fuente permanecen intactos en el espacio de trabajo; los WebP sólo optimizan su entrega en web. Se conserva la transparencia de la corona. No se utiliza el arte del sitio de referencia ni se editan logo, imágenes del catálogo o banner promocional. Sin servicios adicionales de pago.
