# BANNERS PRO — acceso público autorizado
El propietario autorizó expresamente que cualquier persona con el enlace vea y descargue los banners sin cuenta Google. El modo público excluye catálogos PDF y el enlace a la carpeta privada. Los originales, manifiesto y credenciales continúan en Drive privado; la galería sirve únicamente los cinco banners piloto que superen aprobación, vigencia, carpeta, MIME y SHA.

Instalación simplificada: reemplazar SOLO el contenido del archivo principal Código.gs/Code.gs por publico/Codigo-PUBLICO.txt. Incluye interfaz y backend; Index.html y Auth.gs anteriores dejan de intervenir en la galería pública. Mantener BANNERS_PRO_CONFIG. No requiere cliente ni secreto OAuth. Gestionar implementaciones > editar la implementación actual > Nueva versión, ejecutar como propietario empresarial y acceso Cualquiera. Conservar la misma /exec. No cambiar permisos de Drive.

Se probó el backend con cinco PNG reales y manifiesto, sin sesión, verificando SHA; se bloquearon PDF e ID arbitrario. Chromium móvil sin cookies: entrada directa, búsqueda, vista1200px, descarga idéntica y Web Share simulado. No aplicado a la implementación remota: el conector no opera Apps Script.

Los archivos modulares Code.gs/Auth.gs/Index.html también representan el modo público (desactivable mediante BANNERS_PRO_PUBLIC_BANNERS=false). Para instalación de un solo archivo usar exclusivamente el TXT indicado, que es deliberadamente público. No instalar ambos backends como archivos adicionales.
