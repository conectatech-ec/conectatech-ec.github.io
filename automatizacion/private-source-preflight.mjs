/** Read-only deployment gate. Never prints or persists catalog bodies. */
import {isDeepStrictEqual} from 'node:util';
import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const BASELINE_COMMIT = '5ac33f55880361096238cfec4c3155609264b632';
export const BASELINE_SHA = '84568d5865cb0f09380d200e6d08172a8820d4aaec5c970c0f7be53e3c68ffc8';
export const BASELINE_URL = `https://raw.githubusercontent.com/conectatech-ec/conectatech-ec.github.io/${BASELINE_COMMIT}/automatizacion/central/current.json`;
export const WORKER_ORIGIN = 'https://conectatech-comercial-piloto.conectatech-ecu.workers.dev';
const ALLOWED_PRIVATE_PATHS = new Set(['/health', '/commercial/catalog/status', '/commercial/catalog', '/messenger/status', '/messenger/seller/status']);
const EXPECTED = Object.freeze({schema:'conectatech.commercial.v1', source_sha256:BASELINE_SHA,
  cut_date:'2026-10-21', generated_at:'2026-10-22T00:25:22Z',
  expires_at:'2026-10-23T00:25:22Z', products:1556});

class GateError extends Error {
  constructor(code, diagnostic = undefined) { super(code); this.code = code; this.diagnostic = diagnostic; }
}
const fail = (code, diagnostic) => { throw new GateError(code, diagnostic); };
const summary = data => ({schema:data?.schema, source_sha256:data?.source?.sha256,
  cut_date:data?.source?.cut_date, generated_at:data?.source?.generated_at,
  expires_at:data?.expires_at, products:Array.isArray(data?.products) ? data.products.length : undefined});
const withoutPublishedAt = data => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('CATALOG_SHAPE');
  const result = {...data}; delete result.published_at; return result;
};
function safeDifferences(actual, baseline) {
  const categories = [];
  for (const key of ['schema','source','normalized_at','expires_at'])
    if (!isDeepStrictEqual(actual?.[key], baseline?.[key])) categories.push(key);
  const keys = new Set(['schema','source','normalized_at','expires_at','products','published_at']);
  if (Object.keys(actual || {}).some(key => !keys.has(key)) ||
      Object.keys(baseline || {}).some(key => !keys.has(key))) categories.push('other_top_level');
  let productMismatchCount = 0;
  if (!Array.isArray(actual?.products)) { categories.push('products_shape'); }
  else if (!isDeepStrictEqual(actual.products, baseline.products)) {
    categories.push('products');
    const n = Math.max(actual.products.length, baseline.products.length);
    for (let i=0;i<n;i++) if (!isDeepStrictEqual(actual.products[i], baseline.products[i])) productMismatchCount++;
  }
  return {categories, product_mismatch_count:productMismatchCount};
}
function validateStatus(status, expected, stage) {
  // Compare source metadata only. Operational fields such as current/published_at
  // may differ from the compiled JSON and are intentionally not interpreted.
  const count = Object.keys(EXPECTED).filter(key => status?.[key] !== expected[key]).length;
  if (count) fail(`STATUS_${stage}_SOURCE_MISMATCH`, {categories:['source_metadata'], mismatching_field_count:count});
}
function validateRelease(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_.-]{1,160}$/.test(value);
}

/** Inject getJson(url, {privateRequest}) in tests; all calls are fixed GETs. */
export async function auditPrivateSource({getJson, phase='pre', expectedRelease, previous, now=new Date(), sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))} = {}) {
  const receipt = {schema:'conectatech.private-source-gate.v1', phase, audit_only:true,
    ok:false, observed_at:now.toISOString(), baseline_commit:BASELINE_COMMIT,
    public_baseline:{...EXPECTED}, method:'GET',
    scope:'compiled_fallback_only', freshness_required:false,
    excluded_comparison_fields:['published_at'], catalog_body_recorded:false,
    guard_checks:'existing_marketplace_e2e', controls_and_quota:'existing_closed_ingress_probe'};
  try {
    if (!['pre','post'].includes(phase)) fail('PHASE_INVALID');
    if (typeof getJson !== 'function') fail('TRANSPORT_REQUIRED');
    if (phase === 'post' && !validateRelease(expectedRelease)) fail('EXPECTED_RELEASE_REQUIRED');
    if (previous !== undefined && (previous?.ok !== true || previous?.phase !== 'pre' ||
        previous?.baseline_commit !== BASELINE_COMMIT ||
        !isDeepStrictEqual(previous?.public_baseline, EXPECTED) ||
        typeof previous?.tester_transport_enabled !== 'boolean' || previous.general_reception_enabled !== false)) fail('PREVIOUS_RECEIPT_INVALID');
    const expectedTester = previous?.tester_transport_enabled ?? false;
    const baseline = await getJson(BASELINE_URL, {privateRequest:false});
    if (!isDeepStrictEqual(summary(baseline), EXPECTED)) fail('PUBLIC_BASELINE_CHANGED');
    const attempts = phase === 'post' ? 12 : 1;
    for (let attempt=1;attempt<=attempts;attempt++) {
      const health = await getJson(`${WORKER_ORIGIN}/health`, {privateRequest:true});
      if (health?.ok !== true || health?.pilot !== true || !validateRelease(health?.release)) fail('HEALTH_INVALID');
      if (health.meta_ingress_enabled !== false) fail('INGRESS_MUST_BE_CLOSED');
      if (typeof health.messenger_outbound !== 'boolean') fail('OUTBOUND_STATE_REQUIRED');
      if (phase === 'post' && health.messenger_outbound !== expectedTester) fail('TESTER_TRANSPORT_CHANGED');
      receipt.tester_transport_enabled = health.messenger_outbound;
      receipt.general_reception_enabled = false;
      receipt.observed_release = health.release;
      receipt.health_attempts = attempt;
      if (phase !== 'post' || health.release === expectedRelease) break;
      if (attempt === attempts) fail('RELEASE_MISMATCH');
      await sleep(2000);
    }
    const messaging = await getJson(`${WORKER_ORIGIN}/messenger/status`, {privateRequest:true});
    const seller = await getJson(`${WORKER_ORIGIN}/messenger/seller/status`, {privateRequest:true});
    if (messaging?.mode !== 'development-only' || messaging.reception_enabled !== false ||
        messaging.outbound_enabled !== receipt.tester_transport_enabled ||
        seller?.mode !== 'authorized-testers-only' || seller.enabled !== receipt.tester_transport_enabled || seller.live_customers_enabled !== false) fail('TESTER_SCOPE_MISMATCH');
    const before = await getJson(`${WORKER_ORIGIN}/commercial/catalog/status`, {privateRequest:true});
    validateStatus(before, EXPECTED, 'BEFORE');
    const catalog = await getJson(`${WORKER_ORIGIN}/commercial/catalog`, {privateRequest:true});
    receipt.catalog_http_200 = true;
    const after = await getJson(`${WORKER_ORIGIN}/commercial/catalog/status`, {privateRequest:true});
    validateStatus(after, EXPECTED, 'AFTER');
    // A read sequence never accepts an unannounced concurrent source replacement.
    if (!isDeepStrictEqual(summary(catalog), EXPECTED)) fail('CATALOG_SOURCE_MISMATCH', safeDifferences(catalog, baseline));
    if (!isDeepStrictEqual(withoutPublishedAt(catalog), withoutPublishedAt(baseline)))
      fail('CATALOG_BASELINE_MISMATCH', safeDifferences(catalog, baseline));
    receipt.source_stable = true;
    receipt.equal_except_published_at = true;
    receipt.original_expiry_preserved = true;
    receipt.previous_verified = previous !== undefined;
    receipt.ok = true;
  } catch (error) {
    receipt.error = error instanceof GateError ? error.code : 'READ_FAILED';
    if (error instanceof GateError && error.diagnostic) receipt.diagnostic = error.diagnostic;
  }
  return receipt;
}

/** No redirects, writes, sessions, queue processing, AI or Graph requests. */
export function makeGetter({token, fetchImpl=globalThis.fetch} = {}) {
  if (!token) fail('PILOT_TOKEN_REQUIRED');
  return async (url, {privateRequest} = {}) => {
    const parsed = new URL(url);
    if (privateRequest ? parsed.origin !== WORKER_ORIGIN || !ALLOWED_PRIVATE_PATHS.has(parsed.pathname) || parsed.search : url !== BASELINE_URL)
      fail('URL_NOT_ALLOWED');
    let response;
    try {
      response = await fetchImpl(url, {method:'GET', redirect:'error', signal:AbortSignal.timeout(45000),
        headers:privateRequest ? {Accept:'application/json', Authorization:`Bearer ${token}`} : {Accept:'application/json'}});
    } catch { fail('HTTP_REQUEST_FAILED'); }
    if (response.status !== 200) fail('HTTP_200_REQUIRED');
    if (!response.body) fail('BODY_REQUIRED');
    const chunks = []; let size=0;
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > 2_000_000) { await response.body.cancel?.().catch(() => {}); fail('BODY_TOO_LARGE'); }
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { fail('JSON_INVALID'); }
  };
}

async function main() {
  const args = process.argv.slice(2); const options = {};
  const allowed = new Set(['--phase','--expected-release','--report','--previous']);
  for (let i=0;i<args.length;i+=2) {
    if (!allowed.has(args[i]) || !args[i+1]) throw new Error('CLI_INVALID');
    options[args[i].slice(2)] = args[i+1];
  }
  let receipt;
  try {
    const previous = options.previous ? JSON.parse(await readFile(options.previous,'utf8')) : undefined;
    receipt = await auditPrivateSource({phase:options.phase || 'pre', expectedRelease:options['expected-release'],
      previous, getJson:makeGetter({token:process.env.PILOT_TOKEN})});
  } catch { receipt = {schema:'conectatech.private-source-gate.v1',audit_only:true,ok:false,error:'PREFLIGHT_SETUP_FAILED'}; }
  const text = JSON.stringify(receipt,null,2)+'\n';
  if (options.report) await writeFile(options.report,text,{mode:0o600});
  process.stdout.write(text);
  if (!receipt.ok) process.exitCode=1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => { process.stderr.write('PRIVATE_SOURCE_GATE_FAILED\n'); process.exitCode=1; });
