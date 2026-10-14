// Chapa payments (Telebirr, CBE Birr, cards). Uses CHAPA_SECRET_KEY from the environment.
// Use a TEST key (CHASECK_TEST-...) during development: no real money moves.
// Docs: https://developer.chapa.co
import { config } from '../../config.js';
import { santimToBirrString } from '../../lib/money.js';

const BASE = 'https://api.chapa.co/v1';

async function chapaFetch(path, options = {}) {
  if (!config.chapaSecretKey) throw new Error('CHAPA_SECRET_KEY is not set');
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.chapaSecretKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export const chapaProvider = {
  name: 'chapa',

  async initialize({ txRef, amountSantim, customer, returnUrl, callbackUrl, orderNumber }) {
    const [firstName, ...rest] = (customer.name || 'Customer').split(' ');
    const payload = {
      amount: santimToBirrString(amountSantim),
      currency: 'ETB',
      tx_ref: txRef,
      first_name: firstName,
      last_name: rest.join(' ') || firstName,
      // Chapa expects 09xxxxxxxx / 07xxxxxxxx
      phone_number: customer.phone.replace('+251', '0'),
      return_url: returnUrl,
      customization: { title: 'Gexi', description: `Order ${orderNumber}` },
    };
    if (callbackUrl) payload.callback_url = callbackUrl;
    const { ok, body } = await chapaFetch('/transaction/initialize', { method: 'POST', body: JSON.stringify(payload) });
    if (!ok || body.status !== 'success' || !body.data?.checkout_url) {
      const msg = typeof body.message === 'string' ? body.message : JSON.stringify(body.message || body);
      throw new Error(`Chapa initialize failed: ${msg}`);
    }
    return { checkoutUrl: body.data.checkout_url };
  },

  async verify(txRef) {
    const { ok, body } = await chapaFetch(`/transaction/verify/${encodeURIComponent(txRef)}`);
    if (!ok) return { status: 'pending', raw: body };
    const data = body.data || {};
    const status = data.status === 'success' ? 'success' : data.status === 'failed' ? 'failed' : 'pending';
    return {
      status,
      amountSantim: Math.round(Number(data.amount) * 100),
      currency: data.currency,
      reference: data.reference,
      raw: body,
    };
  },

  async refund({ txRef, amountSantim, reason }) {
    const { ok, body } = await chapaFetch(`/refund/${encodeURIComponent(txRef)}`, {
      method: 'POST',
      body: JSON.stringify({ reason, amount: santimToBirrString(amountSantim) }),
    });
    if (!ok || body.status !== 'success') {
      return { ok: false, error: typeof body.message === 'string' ? body.message : 'Chapa refund failed' };
    }
    return { ok: true, reference: body.data?.ref_id || body.data?.reference || 'chapa-refund' };
  },
};
