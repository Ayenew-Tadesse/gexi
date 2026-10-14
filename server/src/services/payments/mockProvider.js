// A fake payment provider for development and tests: no Chapa account needed.
// The "checkout page" is a simple screen in our own app with "Pay" and "Cancel" buttons.
import { config } from '../../config.js';
import { db } from '../../db/knex.js';

export const mockProvider = {
  name: 'mock',

  async initialize({ txRef }) {
    return { checkoutUrl: `${config.appUrl}/dev/mock-pay?tx_ref=${encodeURIComponent(txRef)}` };
  },

  async verify(txRef) {
    const payment = await db('payments').where({ tx_ref: txRef }).first();
    if (!payment) return { status: 'failed' };
    const mockStatus = payment.raw_response?.mock_status;
    if (mockStatus === 'success') {
      return { status: 'success', amountSantim: payment.amount_santim, currency: 'ETB', reference: `MOCK-${txRef}`, raw: payment.raw_response };
    }
    if (mockStatus === 'failed') return { status: 'failed', raw: payment.raw_response };
    return { status: 'pending' };
  },

  async refund({ txRef, amountSantim }) {
    return { ok: true, reference: `MOCK-REFUND-${txRef}-${amountSantim}` };
  },
};
