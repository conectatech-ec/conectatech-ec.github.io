Piloto exclusivo de20SKU — no integrar ni publicar sin revisión del propietario.
Fuente canónica: titulos-pro-20.json. El objeto products de593 no se modifica.
1. node scripts/preparar-titulos-pro.cjs
2. python3 scripts/preparar-revision-titulos.py
3. Servir el repositorio porHTTP local. BASE_PILOTO puede cambiar laURL de pruebas.
4. node scripts/verificar-piloto-titulos.cjs (Chromium real;360/390/520/1280).
5. python3 scripts/entregar-revision-titulos.py
6. node scripts/verificar-entrega-titulos.cjs (catálogos reales incrustados;20+20fotos).
Revisión: revision/titulos-pro-20/index.html; tablaCSV y PNG completos en la misma carpeta.
El HTML se puede descargar y abrir con conexión a Internet para sus fotos originales.
Reversión: activo:false y regenerar datos, o retirar el SKU de productos. Sin entrada,
fallo de carga o piloto desactivado devuelve la tarjeta anterior sin tocar productos.
Vista temporal anterior: ?titulos=original. La lista admite sólo20SKU explícitos en este
piloto. El motor soporta incorporación por mapas, pero el guard impide ampliación masiva
sin cambiar expresamente el alcance autorizado. No tocar main,feeds,SEO,fichas ni precios.
