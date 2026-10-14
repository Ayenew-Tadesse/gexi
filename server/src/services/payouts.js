// Payouts to vendors and agents. They are created when an order is picked up, never earlier.
import { clock } from '../lib/clock.js';
import { runInTx } from '../lib/tx.js';
import { badRequest } from '../lib/errors.js';
import { completeIfSettled } from './orders.js';

/** One vendor payout and one agent payout per item the customer actually received. */
export async function createPayoutsForOrder(trx, orderId) {
  const items = await trx('order_items').where({ order_id: orderId, item_status: 'received' });
  const now = clock.now();
  const rows = [];
  for (const item of items) {
    rows.push({ payee_type: 'vendor', payee_id: item.vendor_id, order_id: orderId, order_item_id: item.id, amount_santim: item.vendor_amount_santim, created_at: now, updated_at: now });
    if (item.agent_commission_santim > 0) {
      rows.push({ payee_type: 'agent', payee_id: item.agent_id, order_id: orderId, order_item_id: item.id, amount_santim: item.agent_commission_santim, created_at: now, updated_at: now });
    }
  }
  if (rows.length) await trx('payouts').insert(rows).onConflict(['payee_type', 'order_item_id']).ignore();
  return rows.length;
}

/** Admin marks payouts as paid (after sending money by Telebirr/bank). Orders whose payouts are all paid become "completed". */
export async function markPayoutsPaid(payoutIds, by, reference) {
  if (!Array.isArray(payoutIds) || payoutIds.length === 0) throw badRequest('no_payouts', 'Select at least one payout.');
  return runInTx(async (trx) => {
    const now = clock.now();
    const updated = await trx('payouts')
      .whereIn('id', payoutIds)
      .where({ status: 'due' })
      .update({ status: 'paid', paid_at: now, paid_by: by, reference: reference || null, updated_at: now })
      .returning(['id', 'order_id']);
    const orderIds = [...new Set(updated.map((p) => p.order_id))];
    for (const orderId of orderIds) await completeIfSettled(trx, orderId, by);
    return { updated: updated.length, ordersChecked: orderIds.length };
  });
}
