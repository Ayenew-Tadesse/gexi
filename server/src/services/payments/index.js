// Picks the payment provider from PAYMENT_PROVIDER ("mock" or "chapa").
import { config } from '../../config.js';
import { mockProvider } from './mockProvider.js';
import { chapaProvider } from './chapaProvider.js';

const providers = { mock: mockProvider, chapa: chapaProvider };

export function paymentProvider(name = config.paymentProvider) {
  const p = providers[name];
  if (!p) throw new Error(`Unknown PAYMENT_PROVIDER "${name}"`);
  return p;
}
