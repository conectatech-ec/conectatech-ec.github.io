# Vitrina móvil: avance y reanudación

Estado: corrección preparada en rama aislada. Sin autorización para fusionar ni desplegar.

## Diagnóstico comprobado

Los archivos de la web pública activan `manualPause=true` al recibir un `pointerdown` táctil sobre una ficha. Ese estado sólo se borra con el botón de reproducción; soltar el dedo o terminar un deslizamiento no lo borra. Por eso una interacción normal, incluida una que inicia un desplazamiento de página, deja detenida la vitrina.

La reproducción con los recursos públicos por HTTPS y Chrome DevTools Protocol táctil produjo esta secuencia: producto0 al cargar, producto1 a3100ms, producto2 después de deslizar y el mismo producto2 doce segundos después, con `pausado=true` y el botón «Reanudar transición automática». La configuración publicada era3000ms. `diagnostico-publico.json` y `fuentes-publicas.json` conservan los resultados y hashes de los dos módulos públicos.

El foco persistente de los controles tras tocarlos también podía mantener la pausa. Ahora sólo el foco de teclado y el hover de dispositivos que admiten hover conservan sus pausas accesibles.

## Corrección mínima

Tres archivos funcionales: `config.js` fija4000ms; `portada.js` separa pausa explícita, interacción táctil y preferencia de movimiento reducido; `index.html` cambia únicamente las versiones de esas dos referencias JS.

Al terminar un toque, gesto o cancelación, el siguiente avance se programa cuatro segundos después. Se conserva la pausa elegida con el botón, los deslizamientos en ambos sentidos y los controles. Una imagen pendiente de decodificación no sustituye a la visible mientras el usuario interactúa. El carrusel sigue usando sus mismos nodos, fotografías y transición de0,4s; no cambia su diseño.

## Pruebas y evidencia

`pruebas.json`:50 comprobaciones de navegador correctas. Incluyen4000ms sin adelanto, cinco productos y retorno al primero, deslizamientos, mantener el dedo, controles táctiles y foco posterior, pausa explícita, cancelación, multitáctil, ausencia de reinicio en la actualización por minuto, escritorio/hover/teclado, movimiento reducido y preparación asíncrona de imagen durante una interacción.

`vitrina-movil-4s.webm`: grabación de Chromium con emulación táctil Android y reloj en ejecución real. Contiene un deslizamiento manual y la continuación automática hasta volver al primer producto. `video-mediciones.json` conserva los cambios observados y la transición CSS. Sólo se retiró el relleno del grabador ajeno al viewport.

Integridad:1170 objetos comerciales idénticos al padre. El índice completo es idéntico al normalizar las dos versiones JS. CSS, marca, imágenes, precios, stock, SKU, títulos, enlaces y archivos de producción SKU no se editan.

### Ejecutar la regresión

Se necesita Playwright y Chromium ya instalados. No instala paquetes ni inicia servicios. Usa los archivos reales de esta rama y simula únicamente las entradas del navegador y el reloj; la prueba no escribe datos del catálogo.

```sh
node revision/presentacion-web-v2/qa-vitrina-movil/pruebas.cjs
```

Si las herramientas están en otra ruta, definir `VITRINA_PLAYWRIGHT` con el módulo de Playwright y `CHROME_PATH` con el ejecutable. Los resultados de una ejecución nueva se escriben en el directorio temporal o en `VITRINA_QA_OUTPUT`.

## Alcance de la validación Android

Se comprobó Chromium146 con perfil Pixel7, eventos táctiles nativos de CDP y viewport móvil, además de escritorio. No hay teléfono Android, ADB ni emulador Android de sistema disponibles en este entorno. Por tanto, **la prueba en Chrome Android físico queda pendiente**; la emulación no se presenta como una prueba en un dispositivo real. No se despliega para suplir esa limitación sin autorización del propietario.
