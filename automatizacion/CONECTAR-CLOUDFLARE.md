# Permisos definitivos — despliegue aislado

La cuenta Workers Free fue confirmada por el propietario. Activación permanece `false`. Esta guía reemplaza la solicitud anterior de Workers Scripts Edit, D1 Edit y Billing Read.

## Token mínimo

| Recurso | Rol | Alcance |
|---|---|---|
| Individual Worker | Editor / Individual Workers Editor | Exclusivamente `conectatech-comercial-piloto` |

No agregar permisos a nivel de todos los Workers de la cuenta, Billing Read/Write, D1, Workers Routes, DNS, Pages, KV, R2 o administración general. Tampoco Workers AI Read/Edit para llamadas REST: la IA del piloto se usa mediante binding del Worker. Si Cloudflare exige otro permiso para el binding, revisar el error concreto sin ampliarlo automáticamente.

Cloudflare permite roles por Worker existente. Editor puede actualizar/desplegar ese Worker y sus secretos; no permite crear otros Workers. **La rama de GitHub no restringe por sí sola un token Cloudflare**: seleccionar expresamente el Worker individual. No sustituirlo por Workers Scripts Edit para toda la cuenta. Si la interfaz no ofrece alcance individual, detener la creación del token y revisar esa pantalla; no conceder acceso amplio como alternativa.

Fuente oficial: [Workers roles and permissions](https://developers.cloudflare.com/workers/authorization/workers/).

## Preparación en el panel, antes del token

1. Comprobar Workers **Free**, sin plan pagado, prueba convertible, créditos ni facturación por consumo. Se mantiene el costo autorizado $0. Esta comprobación es manual: el script ya no consulta Billing ni certifica el plan mediante API. Repetirla antes de cada despliegue; nunca actualizar el plan al agotar cuotas.
2. Crear desde el panel un Worker de prueba llamado exactamente `conectatech-comercial-piloto`, sin integración de repositorios ni dominios del catálogo. Para poder seleccionar un Worker individual debe existir primero. El propietario lo crea usando su sesión del panel, sin dar permisos de creación al token de CI. Dejar un marcador sin datos comerciales, por ejemplo una respuesta HTTP 503 «Piloto aún no activado». Usar únicamente workers.dev gratuito, sin Routes ni Custom Domains. No se declara sistema comercial definitivo.
3. Copiar su dirección HTTPS con formato `https://conectatech-comercial-piloto.SUBDOMINIO.workers.dev`. No lleva tokens ni parámetros. Crear después un token de API con **Editor limitado a ese Worker individual**, dentro de la cuenta corporativa. Usar una caducidad razonable. Guardarlo directamente en el secreto GitHub del siguiente paso.

## GitHub: secretos y restricción de rama

En [Settings → Environments](https://github.com/conectatech-ec/conectatech-ec.github.io/settings/environments), abrir `conectatech-piloto-gratis` y elegir **Deployment branches and tags → Selected branches and tags**. Permitir exclusivamente `automatizacion/piloto-cloud-3sku-20261015`, sin reglas amplias ni main.

Configurar dentro de ese environment:

| Tipo | Nombre | Valor |
|---|---|---|
| Secret | CLOUDFLARE_API_TOKEN | Token Editor limitado al Worker individual. |
| Secret | PILOT_TOKEN | Valor aleatorio exclusivo de mínimo 32 caracteres; autentica las consultas privadas del piloto. |
| Variable | CLOUDFLARE_ACCOUNT_ID | Account ID de la cuenta corporativa. |
| Variable | CLOUDFLARE_PILOT_URL | URL HTTPS workers.dev del piloto, sin barra final. |
| Variable | CF_FREE_ONLY_CONFIRMED | `true` solo tras verificar en el panel plan Free y ausencia de facturación por consumo. |

El token se pega únicamente en GitHub Secrets; no en chat, repositorio, Issues o artifacts. No usar Global API Key ni instalar una integración que autorice escritura de GitHub a Cloudflare. El GITHUB_TOKEN del workflow mantiene `contents:read`; no puede escribir main. El workflow y el script también rechazan cualquier rama distinta de la del piloto.

## D1: justificación y decisión separada

D1 se había propuesto para persistir interesados, pedidos, reservas y eventos de canal con deduplicación. No es necesario para recibir consultas HTTPS, leer el feed, generar las tres respuestas comerciales, verificar medios o ejecutar IA gratuita.

**Decisión actual: no solicitar D1 y no activarlo en este despliegue.** El script no lista, crea ni consulta bases, no aplica esquemas ni incorpora binding DB. `/interesados` y la recepción persistente de eventos Meta devuelven 503 explícito por almacenamiento no configurado; no simulan que un interesado quedó guardado. El esquema y pruebas anteriores se conservan para una fase de persistencia.

Si se retoma esa fase, puede provisionarse una base del piloto y aplicar su esquema desde el panel. La documentación de Cloudflare indica que desplegar un binding D1 no requiere permisos D1 separados en el token de CI; sí los requieren las operaciones directas sobre la base. Cualquier propuesta de permisos adicionales se justificará por esa operación concreta antes de solicitarlos. No vincular bases de producción.

## Comprobación y activación posterior

La comprobación `deploy_free.py --check` solo consulta settings del Worker existente. No lee Billing, D1 ni listas de cuenta. Si falta la confirmación manual del plan u otro dato, no emite ninguna petición cloud. Su resultado no demuestra inferencia IA ni persistencia.

El cliente API tiene una lista cerrada de tres operaciones: GET settings, PUT del código y PUT del secreto, todas sobre el nombre fijo del piloto. Bloquea operaciones de facturación, bases, otros Workers, rutas y cron antes de emitir HTTP. El script no habilita workers.dev: queda configurado en el panel para el piloto.

La conexión se verifica con `activar:false`. Después de conectar los secretos, avisar «Environment y secretos listos» sin valores. Solo entonces se podrá actualizar el Worker y probar su HTTPS e inferencia IA reales. El servicio seguirá como piloto privado autenticado; no se activan canales comerciales, stock reservado ni pagos.
