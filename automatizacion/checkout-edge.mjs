const json = (data, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer'}});
export async function checkoutDigest(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('checkout:' + value)))].map(n => n.toString(16).padStart(2, '0')).join('');
}
export async function checkoutBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type') || '')) throw Error('CONTENT_TYPE');
  if (Number(req.headers.get('Content-Length')) > 12000) throw Error('BODY_SIZE');
  const reader = req.body?.getReader(); let size = 0, text = '';
  if (!reader) throw Error('BODY_EMPTY');
  const decoder = new TextDecoder('utf-8', {fatal: true});
  for (;;) { const {value, done} = await reader.read(); if (done) break; size += value.byteLength;
    if (size > 12000) { await reader.cancel(); throw Error('BODY_SIZE'); } text += decoder.decode(value, {stream: true}); }
  return JSON.parse(text + decoder.decode());
}
const publicPaths = new Map([['/api/compra/catalogo', 'GET'], ['/api/compra/cotizacion', 'POST'], ['/api/compra/pedidos', 'POST']]);
export async function checkoutPublic(req, env, config) {
  const url = new URL(req.url);
  if (!url.pathname.startsWith('/api/compra/') || url.pathname.startsWith('/api/compra/admin/')) return null;
  const origin = req.headers.get('Origin');
  if (url.protocol !== 'https:' || origin !== config.storefrontOrigin || origin !== 'https://conectatech-ec.github.io') return json({error: 'ORIGEN_NO_AUTORIZADO'}, 403);
  const headers = {'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer'};
  const reply = response => { const out = new Response(response.body, response); for (const [k, v] of Object.entries(headers)) out.headers.set(k, v); return out; };
  if (!publicPaths.has(url.pathname)) return reply(json({error: 'RUTA_NO_DISPONIBLE'}, 404));
  if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers});
  if (req.method !== publicPaths.get(url.pathname)) return reply(json({error: 'METODO_NO_DISPONIBLE'}, 405));
  if (!config.enabled || env.FREE_TIER_VERIFIED !== 'true' || !env.PILOT_TOKEN || !env.MESSENGER_TEST_INBOX || config.objectName !== 'messenger-development') return reply(json({error: 'COMPRA_NO_HABILITADA'}, 503));
  try {
    const body = req.method === 'POST' ? await checkoutBody(req) : null;
    // CF-Connecting-IP is supplied by the existing Cloudflare ingress, not forwarded from client JSON.
    const ip = req.headers.get('CF-Connecting-IP');
    if (!ip) return reply(json({error: 'INGRESO_NO_VERIFICADO'}, 503));
    const client = await checkoutDigest(new Date().toISOString().slice(0, 10) + ':' + ip, env.PILOT_TOKEN);
    const stub = env.MESSENGER_TEST_INBOX.get(env.MESSENGER_TEST_INBOX.idFromName(config.objectName));
    return reply(await stub.fetch('https://inbox/web-checkout/' + url.pathname.split('/').pop(), {method: 'POST',
      headers: {'Content-Type': 'application/json'}, body: JSON.stringify({body, key: req.headers.get('Idempotency-Key'), client})}));
  } catch { return reply(json({error: 'SOLICITUD_NO_PROCESADA'}, 503)); }
}

// Called only AFTER the existing Worker's PILOT_TOKEN authentication.
export async function checkoutAdmin(req, env, config) {
  const url = new URL(req.url);
  if (!['/api/compra/admin/pedidos', '/api/compra/admin/actualizar'].includes(url.pathname)) return null;
  if (url.protocol !== 'https:' || !env.PILOT_TOKEN || req.headers.get('Authorization') !== 'Bearer ' + env.PILOT_TOKEN) return json({error: 'Unauthorized'}, 401);
  if (!config.enabled || !env.MESSENGER_TEST_INBOX || config.objectName !== 'messenger-development') return json({error: 'COMPRA_NO_HABILITADA'}, 503);
  if (req.method !== (url.pathname.endsWith('/pedidos') ? 'GET' : 'POST')) return json({error: 'METODO_NO_DISPONIBLE'}, 405);
  try {
    const stub = env.MESSENGER_TEST_INBOX.get(env.MESSENGER_TEST_INBOX.idFromName(config.objectName));
    return await stub.fetch('https://inbox/web-checkout/admin/' + url.pathname.split('/').pop(), {method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({body: req.method === 'POST' ? await checkoutBody(req) : null})});
  } catch { return json({error: 'SOLICITUD_NO_PROCESADA'}, 503); }
}
