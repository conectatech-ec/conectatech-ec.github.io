const origin = 'https://conectatech-ec.github.io';
const sha = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(n => n.toString(16).padStart(2, '0')).join('');

// Joins the existing verified Data Hub to the exact published 593 cut, in memory.
// Quantities are neither imported nor persisted in the checkout database.
export async function readCheckoutSource({readSharedHub, central, fetcher = fetch}) {
  const hub = await readSharedHub(central, fetcher);
  if (hub.shared_hub_status?.state !== 'verified') throw Error('CHECKOUT_SOURCE_UNVERIFIED');
  const get = async file => {
    const response = await fetcher(origin + '/' + file, {redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(10000)});
    if (!response.ok) throw Error('CHECKOUT_SOURCE_UNAVAILABLE');
    const text = await response.text();
    if (text.length > 1500000) throw Error('CHECKOUT_SOURCE_SIZE');
    return JSON.parse(text);
  };
  const [pointer, cut] = await Promise.all([get('datos-593/estado-ultimo-corte.json'), get('datos-593/corte-comercial-publico-validado.json')]);
  if (pointer.referencia !== 'datos-593/corte-comercial-publico-validado.json' ||
      pointer.origen_sha256 !== cut.sha256_original || cut.sha256_original !== hub.source.sha256 ||
      pointer.fecha_corte !== cut.fecha_corte || cut.fecha_corte !== hub.source.cut_date ||
      !cut.productos || Array.isArray(cut.productos) || Object.keys(cut.productos).length !== pointer.sku_web ||
      cut.cantidad_sku_web !== pointer.sku_web) throw Error('CHECKOUT_SOURCE_VERSION_MISMATCH');
  const products = [];
  for (const p of hub.products) {
    const row = cut.productos[p.sku];
    if (!row || p.availability === 'blocked' || p.blocked_reasons.length || !p.web?.price_matches) continue;
    if (!Number.isSafeInteger(row.stock) || row.stock < 0 ||
        row.promo_centavos !== p.prices?.promo_cash_cents || row.pvp_centavos !== p.prices?.pvp_card_cents ||
        (row.stock > 0) !== (p.availability === 'in_stock')) throw Error('CHECKOUT_SOURCE_PRODUCT_MISMATCH');
    const presentation = hub.presentation?.products?.[p.sku];
    const image = presentation?.approved_media?.url || p.web.image_url;
    const name = presentation?.display_title || p.name;
    if (!p.web.url?.startsWith(origin + '/productos/') || !image?.startsWith(origin + '/imagenes/')) continue;
    products.push({sku: p.sku, name, image, url: p.web.url, stock: row.stock,
      priceCents: row.promo_centavos, pvpCents: row.pvp_centavos});
  }
  if (!products.length) throw Error('CHECKOUT_SOURCE_EMPTY');
  return {cutDate: cut.fecha_corte, sourceHash: cut.sha256_original,
    sourceGeneratedAt: hub.source.generated_at,
    sourceTimestampBasis: hub.source.timestamp_basis || 'validated_central_source',
    version: await sha(JSON.stringify([cut.sha256_original, products.map(p => [p.sku, p.stock, p.priceCents])])),
    source: 'Corte validado de 593 compartido con el Data Hub', products};
}
