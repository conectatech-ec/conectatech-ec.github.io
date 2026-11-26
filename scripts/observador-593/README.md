# Observador 593 en implementación

Autorización del propietario: 26/11/2026. Cuenta exclusiva CONECTATECH; costo adicional máximo $0.

El observador faltante fue reconstruido y guardado en Apps Script, sin activador. Su modo inicial es OBSERVE. No interpreta XLSX ni publica inventario. El transporte de identidad está preparado pero no instalado en el Worker: el sujeto Google debe comprobarse y fijarse tras el consentimiento.

Pruebas locales: `node test-observer.cjs` (17) y `node test-observer-auth.mjs` (14), todas aprobadas. Son pruebas sintéticas; no equivalen a funcionamiento automático.

La lectura autenticada del receptor existente terminó con HTTP 200 en el run 45885272046. Receptor vacío, despacho no configurado y credencial COMMERCIAL_ACTIONS_TOKEN ausente también en el entorno. La configuración CF_FREE_ONLY_CONFIRMED se mantiene true. No se modificaron módulos del Worker.

Pendiente: consentimiento OAuth de Google, credencial restringida de despacho, adaptación del receptor/publicador original y pruebas remotas. No fusionar ni activar este borrador hasta completar esos puntos. Mantener el supervisor horario con su entrada actual mientras se prepara el cambio a la recepción común.

El código no contiene credenciales ni IDs privados de carpetas. La configuración de carpeta permanece sólo en Script Properties. No modificar SIGNATURE ni checkout.
