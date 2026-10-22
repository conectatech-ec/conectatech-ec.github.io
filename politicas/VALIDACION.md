# Validación de la entrega

- Base de revisión: main `428927813d794aaa1d1a37886327d326100e33a8`.
- Diez pruebas funcionales aprobadas: plazos y frase «1 año de garantía»; ausencia de categorías/SKU adivinados; ampliaciones por datos; excepción documentada; rechazo de reducciones/no aprobadas; protección del término legal; respuestas y escalamiento de Alex; enlaces idempotentes; Merchant bloqueado sin tarifas/plazos inventados; página de revisión completa.
- Chromium real: anchuras320,390,768,1280; ancho del documento igual al viewport; logo cargado; todos los destinos de navegación interna presentes; aviso de revisión y contenido de garantías/ley visibles; sin errores de página.
- [Ejecución cloud con capturas y reporte](https://github.com/conectatech-ec/conectatech-ec.github.io/actions/runs/38997314083). Artefacto `revision-politica`: capturas móvil/escritorio y JSON. Retención14días; el HTML y documentos quedan en la rama.
- La visualización se probó como archivo local dentro del runner, sin abrir el catálogo ni contactar el Worker/WhatsApp. No se afirmó comprobación HTTPS de una página que aún no se despliega.
- Catálogo JSON de `index.html`: idéntico al snapshot base; único cambio del documento es el enlace en el pie. Generador de fichas: envoltura idempotente para añadir el enlace; no se ejecutó.
- Fichas actuales: cero escrituras. Simulación local de enlaces en1.171 archivos, sin modificaciones. Los hashes de esa simulación no son autorización de despliegue: regenerarlos contra main vigente tras aprobación.
- Worker de Alex, banners, precios, inventario, originales593 y feed Merchant: no modificados por esta entrega. Sus exclusiones se conservan.
- Sin despliegue, sin fusión, sin servicios pagados y sin configuración enviada a Google.

Los artefactos web/documentales se regeneran desde `politica.json`; ejecutar `node politicas/construir.mjs` y `node politicas/test-politica.mjs` después de cambiar datos autorizados. La ejecución cloud usa permisos de lectura y solo adjunta capturas a Actions.
