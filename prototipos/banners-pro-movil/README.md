# BANNERS PRO — autenticación Google en servidor
Corrección aislada de autenticación; sin cambios en la fábrica, main, producción o biblioteca oficial.

OAuth authorization-code con cliente confidencial, PKCE, state y nonce. El servidor verifica el ID token con Google tokeninfo y valida issuer/audience/azp/exp/iat/sub/email_verified/nonce y whitelist antes de emitir una sesión opaca. No usa Session como identidad del visitante ni acepta correos o JWT enviados por el navegador. ID/access tokens Google y client secret nunca se entregan al cliente ni se registran.

La sesión aleatoria dura como máximo30min y su registro se guarda por SHA256 en ScriptCache. Su pérdida niega acceso. Whitelist y epoch se verifican en cada llamada. Login usa binding secreto mantenido en memoria del navegador y entrega de sesión de un solo uso; state por sí solo no permite obtenerla. Todas las operaciones de Drive exigen sesión. Código e interfaz deben actualizarse juntos.

La pantalla de login puede abrir con ANYONE_ANONYMOUS y ejecución USER_DEPLOYING; ello no autoriza lecturas privadas. El OAuth del visitante solicita solo openid/email. Los permisos Drive readonly pertenecen al desplegador empresarial. Mantener los originales privados.

Ver ACTUALIZAR-AUTENTICACION.txt para la configuración OAuth y actualización de la implementación existente que conserva /exec. Se mantiene la configuración privada previa; el segundo correo debe autorizarse expresamente. No crear otro proyecto Apps Script ni otra implementación.

Pruebas: node auth.test.cjs; node contract.test.cjs. QA del navegador usa OAuth SIMULADO y originales privados fuera de Git; no desplegar qa/server.cjs. La verificación real contra Google requiere /exec, client ID, secreto guardado por propietario y consentimiento configurado. Aún no aplicada a la instancia desplegada.

Dependencias de runtime: UrlFetchApp debe poder acceder por HTTPS a oauth2.googleapis.com/token y /tokeninfo y al Hub oficial. Fallos de Google, cuota o caché se rechazan de forma cerrada. Los errores de autenticación son genéricos y exceptionLogging está en NONE. Tokeninfo se usa únicamente al iniciar sesión; no se cachean tokens Google.
