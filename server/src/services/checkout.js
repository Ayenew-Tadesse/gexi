// Starting a payment and confirming it with the payment provider.
import crypto from 'node:crypto';
import { db } from '../db/knex.js';
import { config } from '../config.js';
import { clock } from '../lib/clock.js';
import { randomToken } from '../lib/codes.js';
import { AppError, conflict, notFound } from '../lib/errors.js';
import { paymentProvider } from './payments/index.js';
import { createOrder, markOrderPaid, cancelOrder } from './orders.js';

/** Create a payment for a pending order and get the provider's checkout link. */
export async function startPayment(order, customer) {
  if (order.status !== 'pending_payment') throw conflict('not_payable', 'This order is not waiting for payment.');
  const provider = paymentProvider();
  const txRef = `${order.order_number}-${randomToken(4)}`;
  await db('payments').insert({ order_id: order.id, provider: provider.name, tx_ref: txRef, amount_santim: order.total_santim });
  const returnUrl = `${config.appUrl}/checkout/return?tx_ref=${encodeURIComponent(txRef)}`;
  const callbackUrl = config.apiPublicUrl ? `${config.apiPublicUrl}/api/payments/chapa/webhook` : undefined;
  const { checkoutUrl } = await provider.initialize({
    txRef, amountSantim: order.total_santim, customer, returnUrl, callbackUrl, orderNumber: order.order_number,
  });
  await db('payments').where({ tx_ref: txRef }).update({ checkout_url: checkoutUrl });
  return { txRef, checkoutUrl };
}

/** Checkout: create the order (reserving stock) and start the payment. */
export async function checkout(customer, lines) {
  const order = await createOrder(customer.id, lines);
  try {
    const { checkoutUrl, txRef } = await startPayment(order, customer);
    return { orderId: order.id, orderNumber: order.order_number, checkoutUrl, txRef };
  } catch (err) {
    console.error('Payment start failed:', err.message);
    await cancelOrder(order.id, null, 'Payment could not be started');
    throw new AppError(502, 'payment_unavailable', 'We could not reach the payment service. Please try again in a moment.');
  }
}

/**
 * Ask the provider whether a payment succeeded. This is the only way an order becomes "paid":
 * we never trust the browser or a webhook on its own.
 */
export async function confirmPayment(txRef) {
  const payment = await db('payments').where({ tx_ref: txRef }).first();
  if (!payment) throw notFound('Payment not found.');
  if (payment.status === 'success') return { status: 'success', orderId: payment.order_id };

  const result = await paymentProvider(payment.provider).verify(txRef);
  if (result.status === 'success') {
    if (result.amountSantim !== payment.amount_santim || (result.currency && result.currency !== 'ETB')) {
      await db('payments').where({ id: payment.id }).update({ status: 'failed', raw_response: result.raw ?? null, updated_at: clock.now() });
      console.error(`Payment ${txRef}: amount mismatch (expected ${payment.amount_santim}, got ${result.amountSantim})`);
      return { status: 'failed', orderId: payment.order_id };
    }
    const updated = await db('payments').where({ id: payment.id, status: 'pending' })
      .update({ status: 'success', provider_reference: result.reference, raw_response: result.raw ?? null, verified_at: clock.now(), updated_at: clock.now() });
    if (updated) await markOrderPaid(payment.order_id, { reference: result.reference });
    return { status: 'success', orderId: payment.order_id };
  }
  if (result.status === 'failed') {
    await db('payments').where({ id: payment.id, status: 'pending' }).update({ status: 'failed', updated_at: clock.now() });
  }
  return { status: result.status, orderId: payment.order_id };
}

/** Chapa signs webhooks with HMAC-SHA256 using the webhook secret. */
export function validChapaSignature(rawBody, headers) {
  if (!config.chapaWebhookSecret) return true; // not configured: we still re-verify every payment with Chapa
  const expected = crypto.createHmac('sha256', config.chapaWebhookSecret).update(rawBody || '').digest('hex');
  const given = [headers['x-chapa-signature'], headers['chapa-signature']].filter(Boolean);
  return given.some((sig) => sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}
