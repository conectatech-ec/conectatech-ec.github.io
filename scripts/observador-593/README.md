# Integración del observador empresarial 593

Autorización del propietario: 26/11/2026. Cuenta exclusiva CONECTATECH. Costo adicional máximo $0.

Google ya autorizó lectura de Drive, identificación empresarial, solicitudes externas y activadores. La primera comprobación real terminó correctamente; una observación manual tardó 2059 ms, encontró el SHA vigente y no envió ni publicó nada. El modo permanece OBSERVE y no existe activador instalado.

El delta enlaza el observador reconstruido con el receptor original y el mismo workflow publicar-corte-comercial-593.yml, grupo publicacion-stock-593-web. Reutiliza el normalizador original, el adaptador vigente, el prepare del publicador, las reservas existentes, el CAS sin force y los pasos de exportación. Los originales privados sólo viven temporalmente fuera del checkout. Un recibo processed exige commit publicado, fuente exacta y ascendencia en main. Una falta de XLSX previo exigido por el validador deja el caso al supervisor, sin rebajar controles.

Pruebas CI: 17 del observador, 16 de autenticación, 12 de recepción/despacho/concurrencia, 14 de entrada al publicador, 7 de instalación/reversión y 3 de reparación acotada: 69 casos aprobados en run45899335780, cabeza fba553f16b4f5a20fd3476d3d5a6dbecfc9563a7. Estas pruebas usan datos sintéticos y no constituyen evidencia de ejecución automática.

La instalación modifica dos módulos existentes (worker.mjs, exclusivamente dos inserciones de enrutamiento, y commercial-reception.mjs) y añade dos adaptadores. El transporte original /content conserva bindings y todos los demás módulos. Antes de escribir comprueba los hashes exactos de ambas bases y una segunda captura completa. La inversa sólo restaura el delta propio y conserva trabajo ajeno concurrente.

Receptor instalado mediante run45897858422. La prueba remota detectó que Cloudflare no admite redirect:error; se corrigieron únicamente los dos adaptadores propios a redirect:manual con rechazo de respuestas 3xx (run45899331248). Ninguna redirección se sigue ni recibe credenciales. Prueba real Google -> receptor el 26/11/2026 a las 16:37:11 Quito: identidad aceptada en 633 ms, contrato correcto, receptor vacío y automatic_trigger_configured=false.

Pendiente operativo: credencial empresarial restringida al repositorio con Actions escritura, sonda remota del publicador, habilitación controlada y tres ciclos temporizados reales. COMMERCIAL_ACTIONS_TOKEN no existe actualmente. COMMERCIAL_OBSERVER_READY debe establecerse en CT593_OBSERVER_V1 únicamente tras la sonda satisfactoria. Apps Script requiere asimismo CT593_MODE=LIVE y CT593_ACTIVATION_READY=CT593_OBSERVER_V1. No activar código incompleto.

Supervisor horario original 6adad3f094348191a06cddc02be4686c conserva su entrada y horario hasta completar el enlace común. SIGNATURE y checkout no se modifican. No se extrae la credencial de la conexión GitHub y no se amplían los permisos de Google.

## Pruebas

Desde esta carpeta: python patch-receiver.py; node test-observer.cjs; node test-observer-auth.mjs; node test-integration.mjs; python test-publisher-entry.py; python test-install-receiver.py.

Las dos bases públicas bajo base/ son fixtures del delta, verificadas contra los SHA del despliegue original. No son un despliegue paralelo ni un receptor ejecutable separado. candidate/ se genera sólo para pruebas. Los módulos privados ajenos nunca se guardan ni publican.
