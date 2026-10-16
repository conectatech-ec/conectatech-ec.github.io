# Conectar la cuenta Cloudflare Free confirmada

La cuenta y la cuota Free de 100000 solicitudes diarias fueron confirmadas por el propietario. Falta conectar el acceso técnico: el correo y la confirmación de plan no conceden permisos a GitHub Actions. El piloto permanece privado, en rama independiente y con `activar:false`.

## 1. Token limitado en Cloudflare

En [My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens), seleccionar **Create Token → Create Custom Token**. Nombre sugerido: `conectatech-piloto-github`.

Agregar exclusivamente permisos de **Account**, para la cuenta corporativa confirmada:

| Permiso | Nivel | Uso |
|---|---|---|
| Workers Scripts | Edit / Write | Subir únicamente el Worker del piloto, su secreto y cron; consultar workers.dev. |
| D1 | Edit / Write | Crear la base privada del piloto, aplicar esquema y registrar solicitudes. |
| Billing | Read | Leer las suscripciones y rechazar planes pagados/pruebas. No permite contratar ni modificar pagos. |

En **Account Resources**, elegir **Include → Specific account → cuenta corporativa**. No conceder Billing Write, permisos de zonas/DNS/Routes ni Global API Key. No hace falta instalar la app Cloudflare en GitHub ni autorizar acceso a todos los repositorios. Si hay una expiración corta razonable, usarla; al vencer se renueva la conexión, no el plan.

Los permisos Scripts y D1 abarcan recursos de la cuenta, no garantizan por sí solos aislamiento por nombre. El script restringe los nombres a `conectatech-comercial-piloto`; utilizar una cuenta de piloto sin otros Workers es la opción más limitada cuando la interfaz no permita granularidad por recurso.

Copiar el token **directamente al secreto de GitHub del paso 2**. No compartirlo por chat ni guardarlo en código. Guardar el Account ID (identificador, no token) del panel de Cloudflare. Comprobar que existe un subdominio gratuito workers.dev en Workers & Pages; no comprar ni conectar dominios del catálogo.

## 2. Environment exclusivo en GitHub

Abrir [Settings → Environments del repositorio](https://github.com/conectatech-ec/conectatech-ec.github.io/settings/environments), crear o abrir `conectatech-piloto-gratis`.

En **Deployment branches and tags → Selected branches and tags**, permitir exclusivamente:

`automatizacion/piloto-cloud-3sku-20261015`

Agregar dentro de ese environment:

| Tipo | Nombre exacto | Valor |
|---|---|---|
| Secret | CLOUDFLARE_API_TOKEN | Token personalizado del paso 1. |
| Secret | PILOT_TOKEN | Valor aleatorio exclusivo de 32 caracteres o más, generado por un gestor de contraseñas. Autentica el piloto; no es la clave de Cloudflare. |
| Variable | CLOUDFLARE_ACCOUNT_ID | Account ID de la cuenta corporativa. |
| Variable | CF_FREE_ONLY_CONFIRMED | `true`, únicamente con Workers Free confirmado y sin facturación por consumo. |

No colocarlos en Repository files, Issues, comentarios o URLs. El valor de los secrets no puede recuperarse mediante el conector de esta conversación; el runner autorizado los utiliza sin mostrarlos.

## 3. Comprobación sin publicar

Avisar en el chat: **«Environment y secretos listos»**, sin incluir sus valores. Se ejecutará el job `preparar` del workflow **Activar piloto cloud gratuito**. La comprobación `deploy_free.py --check` solo hace GET: suscripciones, workers.dev y lista D1. No crea base, no sube Worker, no ejecuta IA ni cambia planes. Si faltan configuraciones, muestra únicamente sus nombres y `ready:false`; ese resultado no significa conexión aprobada.

Con `activar:false`, incluso una conexión aprobada mantiene el despliegue omitido. La activación posterior cambia solo el archivo de control de esta rama; las pruebas HTTPS/IA reales deben aprobarse antes de declarar operativo el piloto. Nunca se publica como sistema comercial definitivo por conectar la cuenta.

La ejecución en GitHub usa runners estándar del repositorio público, sin ampliar permisos de GITHUB_TOKEN (`contents:read`). No se necesitan permisos de escritura en main ni integración de Pages. Los recursos cloud y las claves permanecen separados del catálogo.

Referencias oficiales de los permisos: [Workers subdomain](https://developers.cloudflare.com/api/resources/workers/subresources/subdomains/methods/get/), [D1](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/create/), [Billing Read para consultar suscripciones](https://developers.cloudflare.com/api/resources/accounts/subresources/subscriptions/methods/get/). Estos permisos son los que usa el despliegue preparado; si la interfaz exige otros, revisar la operación concreta antes de ampliarlos.
