# Presentación comercial de imágenes secundarias

Orden del propietario, 4 de noviembre de 2026: retirar la secundaria de referencia de AUDI082 y evitar el mismo problema en cualquier SKU.

`galerias-calidad.json` registra la revisión visual de presentación de cada secundaria mediante SKU, URL y SHA-256 de la imagen ampliada y su miniatura. `galerias-calidad.cjs`, conectado al renderer existente de fichas, sólo muestra los pares revisados que siguen coincidiendo con sus archivos. Las secundarias desconocidas, reemplazadas o retiradas no aparecen. La política nunca filtra la portada ni modifica los registros originales de fotografía.

Para añadir una secundaria: comprobar que pertenece al producto, aporta una vista útil y tiene acabado comercial, foco, iluminación y fondo adecuados. Conservar las validaciones de identidad y fidelidad de fotografía. Registrar la revisión real y ambos hashes en `aprobadas`; no añadir aprobaciones masivas para hacer pasar las pruebas. Una fotografía técnica sin preparar no se vuelve comercial por recortarla. Una escena de uso bien presentada, como la pizarra JUGU057 revisada, no se descarta sólo porque incluya una mano.

`retiradas` conserva los recursos rechazados como evidencia. No borrar los archivos originales ni reactivar el mismo contenido con otro nombre. Los registros fotográficos históricos quedan intactos; la política se aplica al mostrar las secundarias de la ficha.

Validar con `node assets/presentacion-web/galerias-calidad-pruebas.cjs`. Para aplicar únicamente el filtro a HTML ya generado, usar `node assets/presentacion-web/aplicar-calidad-galerias.cjs`; conserva todos los bytes fuera de las galerías. La regeneración habitual de fichas aplica el mismo control automáticamente.
