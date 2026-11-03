// Consumer of the existing factory's esquema_version=2 manifest and Drive files.
// All I/O is supplied by the existing authorized library host. No copy or upload.
const sha256 = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
const cents = value => /^\d+\.\d{2}$/.test(String(value)) ? Math.round(Number(value) * 100) : null;
const metadata = file => ({id:file?.id, mime:file?.mime_type || file?.mimeType, parents:file?.parent_ids || file?.parents || [], modified:file?.modified_time || file?.modifiedTime, trashed:file?.trashed});

export function createExistingSignatureReader({readManifest, readFileMetadata, readFileBytes, approvedFolders, assetUrlFor = null, clock = Date.now}) {
  if (![readManifest, readFileMetadata, readFileBytes].every(x => typeof x === 'function') || !Array.isArray(approvedFolders) || !approvedFolders.length) throw Error('EXISTING_SIGNATURE_READERS_REQUIRED');
  async function inspect(product) {
    const manifest = await readManifest();
    if (manifest?.esquema_version !== 2 || !Array.isArray(manifest.productos) || manifest.productos.length > 5000) throw Error('SIGNATURE_MANIFEST_SCHEMA');
    const matches = manifest.productos.filter(p => p.sku === product.sku);
    const reasons = [];
    const status = {sku:product.sku, visualApproved:false, integrityVerified:false, currentSource:false, deliveryAllowed:false, reasons};
    if (matches.length !== 1) { reasons.push(matches.length ? 'DUPLICATE_SKU' : 'SKU_NOT_IN_LIBRARY'); return {status, asset:null}; }
    const p = matches[0], publication = p.publicacion_drive;
    status.visualApproved = p.estado === 'APROBADO' && p.aprobacion_comercial === 'APROBADO' && publication?.estado_aprobacion === 'APROBADO';
    status.currentSource = manifest.fuente_593_sha256 === product.sourceDigest && p.fuente_593_sha256 === product.sourceDigest && publication?.sha256_fuente === product.sourceDigest && manifest.fecha_datos === p.fecha_datos && publication?.fecha_corte === p.fecha_datos;
    if (!status.visualApproved || p.material_vigente_verificado !== true || publication?.estado_publicacion !== 'VERIFICADO') reasons.push('APPROVAL_REQUIRED');
    if (!status.currentSource) reasons.push('SOURCE_MISMATCH');
    if (cents(p.precio_contado) !== product.priceCents || cents(p.pvp) !== product.pvpCents) reasons.push('PRICE_MISMATCH');
    if (!product.available || p.disponibilidad_comercial !== true || p.activo !== true) reasons.push('UNAVAILABLE');
    if (!Number.isFinite(Date.parse(product.validUntil)) || Date.parse(product.validUntil) <= clock()) reasons.push('SOURCE_EXPIRED');
    if (manifest.no_enviar_a_compradores !== false || manifest.mensajeria_activada !== true || p.apto_envio !== true) reasons.push('FACTORY_NO_SEND');
    if (!/^[a-f0-9]{64}$/.test(p.banner_sha256 || '') || publication?.checksum_archivo !== p.banner_sha256 || !/^[A-Za-z0-9_-]+$/.test(publication?.id_drive || '')) {
      reasons.push('FILE_REFERENCE_INVALID'); return {status, asset:null};
    }
    const id = publication.id_drive, before = metadata(await readFileMetadata(id));
    if (before.id !== id || before.trashed !== false || before.mime !== 'image/png' || !before.parents.some(x => approvedFolders.includes(x)) || !before.modified) {
      reasons.push('FILE_OUTSIDE_APPROVED_LIBRARY'); return {status, asset:null};
    }
    const bytes = await readFileBytes(id);
    if (!(bytes instanceof Uint8Array) || bytes.byteLength < 8 || bytes.byteLength > 10 * 1024 * 1024 || '137,80,78,71,13,10,26,10' !== Array.from(bytes.subarray(0, 8)).join(',')) {
      reasons.push('FILE_CONTENT_INVALID'); return {status, asset:null};
    }
    const actualHash = await sha256(bytes), after = metadata(await readFileMetadata(id));
    if (JSON.stringify(before) !== JSON.stringify(after)) reasons.push('FILE_CHANGED_DURING_READ');
    if (actualHash !== p.banner_sha256) reasons.push('FILE_SHA_MISMATCH');
    status.integrityVerified = actualHash === p.banner_sha256 && !reasons.includes('FILE_CHANGED_DURING_READ');
    status.expectedSha256 = p.banner_sha256;
    status.observedSha256 = actualHash;
    status.manifestSourceDigest = manifest.fuente_593_sha256;
    if (!reasons.length && typeof assetUrlFor !== 'function') reasons.push('EXISTING_AUTHORIZED_ASSET_ROUTE_REQUIRED');
    const url = !reasons.length ? await assetUrlFor({sku:p.sku, sha256:actualHash, modified:before.modified}) : null;
    if (!reasons.length && (typeof url !== 'string' || !url.startsWith('https://') || /drive\.google\.com|googleusercontent\.com/.test(url))) reasons.push('PRIVATE_OR_INVALID_ASSET_ROUTE');
    status.deliveryAllowed = reasons.length === 0;
    // No private IDs, folder names, URLs, manifest body or original bytes escape.
    return {status, asset:status.deliveryAllowed ? {productSku:p.sku, sourceDigest:product.sourceDigest, priceCents:product.priceCents, url, sha256:actualHash, approved:true, containsBox:false} : null};
  }
  return {inspect, async asset(product) { return (await inspect(product)).asset; }};
}
