// Refunds to customers. A refund is first recorded as "pending", then sent to the payment provider.
// If the provider cannot do it automatically, it stays pending for the admin to complete by hand.
import { db } from '../db/knex.js';
import { clock } from '../lib/clock.js';
import { conflict, notFound } from '../lib/errors.js';
import { paymentProvider } from './payments/index.js';

export async function createRefund(trx, { orderId, itemId = null, amount, fee = 0, reason, note = null }) {
  const [refund] = await trx('refunds')
    .insert({ order_id: orderId, order_item_id: itemId, amount_santim: amount, fee_santim: fee, reason, note, created_at: clock.now(), updated_at: clock.now() })
    .returning('*');
  return refund;
}

/** Try to send every pending refund through the payment provider. Called after refunds are created and by the timer. */
export async function processPendingRefunds() {
  const pending = await db('refunds')
    .join('payments', function joinPayments() {
      this.on('payments.order_id', 'refunds.order_id').andOnVal('payments.status', 'success');
    })
    .where('refunds.status', 'pending')
    .whereNull('refunds.processed_by')
    .where((q) => q.whereNull('refunds.note').orWhereNot('refunds.note', 'like', 'Automatic refund failed%'))
    .select('refunds.*', 'payments.tx_ref', 'payments.provider');

  for (const refund of pending) {
    if (refund.amount_santim === 0) {
      await db('refunds').where({ id: refund.id }).update({ status: 'processed', processed_at: clock.now(), note: 'Nothing to refund (fee covers it)' });
      continue;
    }
    let outcome;
    try {
      outcome = await paymentProvider(refund.provider).refund({ txRef: refund.tx_ref, amountSantim: refund.amount_santim, reason: refund.reason });
    } catch (err) {
      outcome = { ok: false, error: err.message };
    }
    if (outcome.ok) {
      await db('refunds').where({ id: refund.id }).update({ status: 'processed', provider_reference: outcome.reference, processed_at: clock.now(), updated_at: clock.now() });
    } else {
      await db('refunds').where({ id: refund.id }).update({
        note: `Automatic refund failed: ${String(outcome.error).slice(0, 200)}. Please refund manually.`,
        updated_at: clock.now(),
      });
    }
  }
}

/** Admin confirms they refunded the customer by hand (e.g. Telebirr transfer). */
export async function markRefundProcessed(refundId, by, reference) {
  const refund = await db('refunds').where({ id: refundId }).first();
  if (!refund) throw notFound('Refund not found.');
  if (refund.status === 'processed') throw conflict('already_processed', 'This refund was already processed.');
  await db('refunds').where({ id: refundId }).update({
    status: 'processed',
    processed_by: by,
    processed_at: clock.now(),
    provider_reference: reference || 'manual',
    updated_at: clock.now(),
  });
  return db('refunds').where({ id: refundId }).first();
}
