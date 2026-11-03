// Mount inside the existing ALEX Worker, after its existing operator auth.
// No new service, account, database, transport or collaborator credential.
import {wireExistingHost} from './wire-existing-host.mjs';
import {hmac} from '../worker.mjs';
export const COLLABORATORS_PREFIX = '/commercial/collaborators/';
const routes = new Set(['status','results','material','advertisements','references','preview-sale','confirm-sale','opportunity']);
const json = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});

export function createAlexHostBridge({isAuthorized, readAlexCatalog, seal, unseal, limitedText, bindingsForEnv = async () => ({})}) {
  if (![isAuthorized,readAlexCatalog,seal,unseal,limitedText,bindingsForEnv].every(f => typeof f === 'function')) throw Error('EXISTING_ALEX_FUNCTIONS_REQUIRED');
  return async function handle(req,env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith(COLLABORATORS_PREFIX)) return null;
    // Service authentication identifies the operator, never Rafa or Jessy.
    if (!await isAuthorized(req,env)) return json({error:'Unauthorized'},401);
    if (env.COLLABORATORS_REVIEW_ENABLED !== 'true') return json({error:'COLLABORATORS_REVIEW_NOT_ENABLED'},503);
    const route = url.pathname.slice(COLLABORATORS_PREFIX.length);
    if (!routes.has(route)) return json({error:'NOT_FOUND'},404);
    if (!env.DB || typeof env.PILOT_TOKEN !== 'string' || env.PILOT_TOKEN.length < 32) return json({error:'EXISTING_PRIVATE_HOST_BINDINGS_REQUIRED'},503);
    if (!['GET','POST'].includes(req.method)) return json({error:'METHOD'},405);
    if (req.method === 'POST') {
      if (req.headers.get('Origin') !== url.origin || req.headers.get('Sec-Fetch-Site') === 'cross-site' || !req.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'ORIGIN'},403);
      let raw;
      try { raw = await limitedText(req,8192); } catch { return json({error:'BODY_TOO_LARGE_OR_INVALID'},413); }
      req = new Request(req,{body:raw});
    }
    try {
      const bindings = await bindingsForEnv(env);
      const mounted = wireExistingHost({
        db:env.DB,
        readAlexCatalog:sku => readAlexCatalog(sku,env),
        seal:value => seal(JSON.stringify(value),env.PILOT_TOKEN),
        unseal:async value => JSON.parse(await unseal(value,env.PILOT_TOKEN)),
        authenticateExistingSession:async request => ({id:'EXISTING_ALEX_OPERATOR',role:'ADMINISTRADOR',verified:await isAuthorized(request,env)}),
        referralSecret:await hmac(env.PILOT_TOKEN,'conectatech:collaborators:references:v1'),
        readConfirmed593Sale:bindings.readConfirmed593Sale || null,
        salesSourceVerified:bindings.salesSourceVerified === true,
        signatureLibraryReaders:bindings.signatureLibraryReaders || null,
        // This revision cannot enable writes, dispatch messages or grant channel
        // access via request data, environment switches or collaborator consent.
        ownerAuthorizedPilotWrites:false, verifiedAlexChannels:[], referenceLandingUrl:null
      });
      if (route === 'status' && req.method === 'GET') return json({mode:'REVIEW_ONLY',operatorAccess:'EXISTING_HOST_OPERATOR_ONLY',collaboratorLoginEnabled:false,productionWritesEnabled:false,externalSendEnabled:false,sales:mounted.integrations.sales(),signatureReaderBound:mounted.integrations.signatureReaderConnected});
      return await mounted.dispatch(req);
    } catch { return json({error:'COLLABORATORS_REVIEW_UNAVAILABLE'},503); }
  };
}
