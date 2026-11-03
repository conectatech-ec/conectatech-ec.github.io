// Validator of the existing Hub host callback readConfirmed593Sale(id).
// This is an internal consumer contract, NOT a claimed vendor API or a writer.
const fail = code => { throw Object.assign(new Error(code), {code}); };
const digest = /^[a-f0-9]{64}$/;
export function createConfirmedSalesReader({readConfirmed593Sale = null, sourceVerified = false} = {}) {
  const connected = sourceVerified === true && typeof readConfirmed593Sale === 'function';
  return {
    status: () => ({connected, readOnly:true, system:'593', reason:connected ? null : 'EXISTING_593_SALES_BINDING_NOT_VERIFIED'}),
    async read(id) {
      if (!connected) fail('EXISTING_593_SALES_BINDING_NOT_VERIFIED');
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) fail('SALE_ID');
      const sale = await readConfirmed593Sale(id);
      if (sale === null) return null;
      if (sale?.id !== id || sale.status !== 'CONFIRMADA' || sale.currency !== 'USD' || !Number.isSafeInteger(sale.totalCents) || sale.totalCents <= 0 || !digest.test(sale.evidenceDigest || '') || !Array.isArray(sale.lines) || !sale.lines.length || sale.lines.length > 1000) fail('UNVERIFIED_593_SALE');
      const lines = sale.lines.map(line => {
        if (!/^[A-Z0-9_-]{3,40}$/.test(line.sku || '') || !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isSafeInteger(line.amountCents) || line.amountCents <= 0) fail('UNVERIFIED_593_LINE');
        return {sku:line.sku, quantity:line.quantity, amountCents:line.amountCents};
      });
      if (lines.reduce((sum, line) => sum + line.amountCents, 0) > sale.totalCents) fail('UNVERIFIED_593_TOTAL');
      // Discard customer identity, payment details and unrelated private fields.
      return {id, status:'CONFIRMADA', currency:'USD', totalCents:sale.totalCents, evidenceDigest:sale.evidenceDigest, lines};
    }
  };
}
