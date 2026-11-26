# Integración del observador empresarial 593

Autorización del propietario: 26/11/2026. Cuenta exclusiva CONECTATECH. Costo adicional máximo $0.

Google ya autorizó lectura de Drive, identificación empresarial, solicitudes externas y activadores. La primera comprobación real terminó correctamente; una observación manual tardó 2059 ms, encontró el SHA vigente y no envió ni publicó nada. El modo permanece OBSERVE y no existe activador instalado.

El delta enlaza el observador reconstruido con el receptor original y el mismo workflow publicar-corte-comercial-593.yml, grupo publicacion-stock-593-web. Reutiliza el normalizador original, el adaptador vigente, el prepare del publicador, las reservas existentes, el CAS sin force y los pasos de exportación. Los originales privados sólo viven temporalmente fuera del checkout. Un recibo processed exige commit publicado, fuente exacta y ascendencia en main. Una falta de XLSX previo exigido por el validador deja el caso al supervisor, sin rebajar controles.

Pruebas locales: 17 del observador, 14 de autenticación, 12 de recepción/despacho/concurrencia, 14 de entrada al publicador y 7 de instalación/reversión: 64 casos. Las pruebas nuevas usan datos sintéticos y no constituyen evidencia de ejecución automática.

La instalación modifica dos módulos existentes (worker.mjs, exclusivamente dos inserciones de enrutamiento, y commercial-reception.mjs) y añade dos adaptadores. El transporte original /content conserva bindings y todos los demás módulos. Antes de escribir comprueba los hashes exactos de ambas bases y una segunda captura completa. La inversa sólo restaura el delta propio y conserva trabajo ajeno concurrente.

Pendiente operativo: instalar/verificar integración, credencial empresarial restringida al repositorio con Actions escritura, sonda remota del publicador, habilitación controlada y tres ciclos temporizados reales. COMMERCIAL_ACTIONS_TOKEN no existe actualmente. COMMERCIAL_OBSERVER_READY debe establecerse en CT593_OBSERVER_V1 únicamente tras la sonda satisfactoria. Apps Script requiere asimismo CT593_MODE=LIVE y CT593_ACTIVATION_READY=CT593_OBSERVER_V1. No activar código incompleto.

Supervisor horario original 6adad3f094348191a06cddc02be4686c conserva su entrada y horario hasta completar el enlace común. SIGNATURE y checkout no se modifican. No se extrae la credencial de la conexión GitHub y no se amplían los permisos de Google.

## Pruebas

Desde esta carpeta: python patch-receiver.py; node test-observer.cjs; node test-observer-auth.mjs; node test-integration.mjs; python test-publisher-entry.py; python test-install-receiver.py.

Las dos bases públicas bajo base/ son fixtures del delta, verificadas contra los SHA del despliegue original. No son un despliegue paralelo ni un receptor ejecutable separado. candidate/ se genera sólo para pruebas. Los módulos privados ajenos nunca se guardan ni publican.
