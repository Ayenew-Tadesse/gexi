// The order lifecycle: every status change goes through this file.
// Each change is checked against the allowed transitions (lib/orderStatus.js) and written to order_status_history.
import { db } from '../db/knex.js';
import { runInTx } from '../lib/tx.js';
import { clock, HOUR, DAY } from '../lib/clock.js';
import { canTransition, OPEN_STATUSES } from '../lib/orderStatus.js';
import { splitSale, resolveSplit, expiryRefund } from '../lib/money.js';
import { sixDigitCode, orderNumberFor } from '../lib/codes.js';
import { formatBirr, formatDateTime } from '../lib/format.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { getSettings } from './settings.js';
import { sendSms } from './sms/index.js';
import { createRefund, processPendingRefunds } from './refunds.js';
import { createPayoutsForOrder } from './payouts.js';

// ---------- helpers ----------

async function logStatus(trx, { orderId, itemId = null, from, to, by = null, note = null }) {
  await trx('order_status_history').insert({
    order_id: orderId,
    order_item_id: itemId,
    from_status: from,
    to_status: to,
    changed_by: by,
    note,
    created_at: clock.now(),
  });
}

async function lockOrder(trx, orderId) {
  const order = await trx('orders').where({ id: orderId }).forUpdate().first();
  if (!order) throw notFound('Order not found.');
  return order;
}

async function moveOrder(trx, order, to, { by = null, note = null, extra = {} } = {}) {
  if (!canTransition(order.status, to)) {
    throw conflict('invalid_transition', `An order that is "${order.status}" cannot become "${to}".`);
  }
  const now = clock.now();
  const closing = ['completed', 'cancelled', 'expired'].includes(to) ? { closed_at: now } : {};
  await trx('orders').where({ id: order.id }).update({ status: to, updated_at: now, ...closing, ...extra });
  await logStatus(trx, { orderId: order.id, from: order.status, to, by, note });
  Object.assign(order, { status: to, ...closing, ...extra });
  return order;
}

async function moveItem(trx, item, to, { by = null, note = null, extra = {} } = {}) {
  await trx('order_items').where({ id: item.id }).update({ item_status: to, updated_at: clock.now(), ...extra });
  await logStatus(trx, { orderId: item.order_id, itemId: item.id, from: item.item_status, to, by, note });
  Object.assign(item, { item_status: to, ...extra });
}

async function customerOf(trx, order) {
  return trx('users').where({ id: order.customer_id }).first();
}

async function uniquePickupCode(trx) {
  for (let i = 0; i < 20; i++) {
    const code = sixDigitCode();
    const taken = await trx('orders').where({ pickup_code: code }).whereIn('status', OPEN_STATUSES).first();
    if (!taken) return code;
  }
  throw new Error('Could not generate a unique pickup code');
}

async function restoreStock(trx, item) {
  await trx('products').where({ id: item.product_id }).increment('stock_qty', item.quantity);
}

// ---------- checkout ----------

/**
 * Create an order from cart lines [{ productId, quantity }].
 * Prices and stock are always taken from the database, never from the browser.
 * Stock is reserved now and released if the customer does not pay in time.
 */
export async function createOrder(customerId, lines) {
  if (!Array.isArray(lines) || lines.length === 0) throw badRequest('empty_cart', 'Your cart is empty.');
  const merged = new Map();
  for (const { productId, quantity } of lines) {
    merged.set(productId, (merged.get(productId) || 0) + quantity);
  }

  return runInTx(async (trx) => {
    const settings = await getSettings(trx);
    const ids = [...merged.keys()].sort((a, b) => a - b);
    const products = await trx('products')
      .join('vendors', 'vendors.id', 'products.vendor_id')
      .whereIn('products.id', ids)
      .select('products.*', 'vendors.is_active as vendor_active')
      .forUpdate('products');
    const byId = new Map(products.map((p) => [p.id, p]));
    const overrides = new Map(
      (await trx('agent_profiles').whereIn('user_id', products.map((p) => p.agent_id))).map((a) => [a.user_id, a.commission_pct]),
    );

    const problems = [];
    for (const id of ids) {
      const p = byId.get(id);
      if (!p || p.status !== 'active' || !p.vendor_active) problems.push({ productId: id, reason: 'unavailable' });
      else if (p.stock_qty < merged.get(id)) problems.push({ productId: id, reason: 'not_enough_stock', available: p.stock_qty });
    }
    if (problems.length) throw conflict('cart_problem', 'Some items in your cart are no longer available.', problems);

    const items = ids.map((id) => {
      const p = byId.get(id);
      const quantity = merged.get(id);
      const lineTotal = p.price_santim * quantity;
      const { agentPct, platformPct } = resolveSplit(settings, overrides.get(p.agent_id));
      const split = splitSale(lineTotal, agentPct, platformPct);
      return {
        product_id: p.id,
        vendor_id: p.vendor_id,
        agent_id: p.agent_id,
        title: p.title_en,
        quantity,
        unit_price_santim: p.price_santim,
        line_total_santim: lineTotal,
        agent_pct: agentPct,
        platform_pct: platformPct,
        vendor_amount_santim: split.vendor,
        agent_commission_santim: split.agent,
        platform_fee_santim: split.platform,
        item_status: 'pending_payment',
      };
    });
    const total = items.reduce((sum, i) => sum + i.line_total_santim, 0);
    const now = clock.now();

    const [order] = await trx('orders')
      .insert({ customer_id: customerId, status: 'pending_payment', total_santim: total, created_at: now, updated_at: now })
      .returning('*');
    order.order_number = orderNumberFor(order.id);
    await trx('orders').where({ id: order.id }).update({ order_number: order.order_number });
    await trx('order_items').insert(items.map((i) => ({ ...i, order_id: order.id, created_at: now, updated_at: now })));
    for (const i of items) {
      await trx('products').where({ id: i.product_id }).decrement('stock_qty', i.quantity);
    }
    await logStatus(trx, { orderId: order.id, from: null, to: 'pending_payment', by: customerId, note: 'Order placed' });
    return order;
  });
}

// ---------- payment ----------

/**
 * Called once the payment provider confirms payment. Safe to call more than once (webhook + return page).
 * Moves the order to paid → awaiting_dropoff, creates the pickup code, and texts the customer and vendors.
 */
export async function markOrderPaid(orderId, { reference = null } = {}) {
  const result = await runInTx(async (trx, after) => {
    const order = await lockOrder(trx, orderId);
    if (order.status !== 'pending_payment') {
      // Paid after we already cancelled it for non-payment: give the money back.
      if (order.status === 'cancelled' && !order.paid_at) {
        await trx('orders').where({ id: order.id }).update({ paid_at: clock.now() });
        await createRefund(trx, { orderId: order.id, amount: order.total_santim, reason: 'late_payment', note: 'Payment arrived after the order timed out' });
        return { order, late: true };
      }
      return { order, alreadyPaid: true };
    }
    const settings = await getSettings(trx);
    const now = clock.now();
    const pickupCode = await uniquePickupCode(trx);
    const dropoffDeadline = new Date(now.getTime() + Number(settings.dropoff_window_hours) * HOUR);

    await moveOrder(trx, order, 'paid', { note: reference ? `Payment ${reference}` : 'Payment confirmed', extra: { paid_at: now, pickup_code: pickupCode } });
    await moveOrder(trx, order, 'awaiting_dropoff', { note: 'Waiting for vendors to drop off', extra: { dropoff_deadline: dropoffDeadline } });

    const items = await trx('order_items').where({ order_id: order.id });
    for (const item of items) await moveItem(trx, item, 'awaiting_dropoff');

    const customer = await customerOf(trx, order);
    after(() => sendSms({
      to: customer.phone,
      template: 'order_confirmed',
      lang: customer.preferred_language,
      vars: { orderNumber: order.order_number, total: formatBirr(order.total_santim) },
    }));

    const vendors = await trx('vendors').whereIn('id', [...new Set(items.map((i) => i.vendor_id))]);
    for (const vendor of vendors) {
      const list = items.filter((i) => i.vendor_id === vendor.id).map((i) => `${i.quantity} x ${i.title}`).join(', ');
      after(() => sendSms({
        to: vendor.phone,
        template: 'vendor_dropoff',
        vars: { items: list, orderNumber: order.order_number, deadline: formatDateTime(dropoffDeadline) },
      }));
    }
    return { order };
  });
  if (result.late) await processPendingRefunds();
  return result;
}

// ---------- warehouse ----------

/** After an item changes, see whether the whole order should move on (or be cancelled). */
async function reconcileDropoff(trx, order, by, after) {
  if (order.status !== 'awaiting_dropoff') return;
  const items = await trx('order_items').where({ order_id: order.id });
  const active = items.filter((i) => ['awaiting_dropoff', 'received'].includes(i.item_status));
  if (active.length === 0) {
    await moveOrder(trx, order, 'cancelled', { by, note: 'No items left to deliver' });
  } else if (active.every((i) => i.item_status === 'received')) {
    await moveOrder(trx, order, 'received_at_warehouse', { by, note: 'All items received' });
  }
}

async function lockItemWithOrder(trx, itemId) {
  const item = await trx('order_items').where({ id: itemId }).first();
  if (!item) throw notFound('Item not found.');
  const order = await lockOrder(trx, item.order_id);
  const fresh = await trx('order_items').where({ id: itemId }).forUpdate().first();
  return { item: fresh, order };
}

export async function receiveItem(itemId, by) {
  return runInTx(async (trx, after) => {
    const { item, order } = await lockItemWithOrder(trx, itemId);
    if (order.status !== 'awaiting_dropoff' || item.item_status !== 'awaiting_dropoff') {
      throw conflict('invalid_transition', 'This item is not waiting for drop-off.');
    }
    await moveItem(trx, item, 'received', { by, note: 'Passed quality check', extra: { received_at: clock.now() } });
    await reconcileDropoff(trx, order, by, after);
    return { item, order };
  });
}

/** Item failed the quality check: refund that item. If nothing is left, the order is cancelled. */
export async function rejectItem(itemId, by, reason) {
  if (!reason || !reason.trim()) throw badRequest('reason_required', 'Please give a reason for rejecting the item.');
  const result = await runInTx(async (trx, after) => {
    const { item, order } = await lockItemWithOrder(trx, itemId);
    if (order.status !== 'awaiting_dropoff' || item.item_status !== 'awaiting_dropoff') {
      throw conflict('invalid_transition', 'This item is not waiting for drop-off.');
    }
    await moveItem(trx, item, 'rejected', { by, note: reason, extra: { rejection_reason: reason.trim() } });
    await createRefund(trx, { orderId: order.id, itemId: item.id, amount: item.line_total_santim, reason: 'rejected' });
    await reconcileDropoff(trx, order, by, after);
    const customer = await customerOf(trx, order);
    after(() => sendSms({
      to: customer.phone,
      template: 'item_refunded',
      lang: customer.preferred_language,
      vars: { item: item.title, orderNumber: order.order_number, amount: formatBirr(item.line_total_santim) },
    }));
    return { item, order };
  });
  await processPendingRefunds();
  return result;
}

export async function packOrder(orderId, by) {
  return runInTx(async (trx) => {
    const order = await lockOrder(trx, orderId);
    return moveOrder(trx, order, 'packed', { by, note: 'Packed' });
  });
}

/** Packed order reaches the pickup point: start the pickup clock and text the customer their code. */
export async function sendToPickup(orderId, by) {
  return runInTx(async (trx, after) => {
    const order = await lockOrder(trx, orderId);
    const settings = await getSettings(trx);
    const now = clock.now();
    const deadline = new Date(now.getTime() + Number(settings.pickup_window_days) * DAY);
    await moveOrder(trx, order, 'ready_for_pickup', { by, note: 'At pickup point', extra: { ready_at: now, pickup_deadline: deadline } });
    const customer = await customerOf(trx, order);
    after(() => sendSms({
      to: customer.phone,
      template: 'ready_for_pickup',
      lang: customer.preferred_language,
      vars: {
        orderNumber: order.order_number,
        code: order.pickup_code,
        location: settings.pickup_location?.name || 'our pickup point',
        deadline: formatDateTime(deadline),
      },
    }));
    return order;
  });
}

/** Items from an expired order have been handed back to the vendor. Their stock goes back on sale. */
export async function markItemReturned(itemId, by) {
  return runInTx(async (trx) => {
    const { item } = await lockItemWithOrder(trx, itemId);
    if (item.item_status !== 'return_pending') throw conflict('invalid_transition', 'This item is not waiting to be returned.');
    await moveItem(trx, item, 'returned_to_vendor', { by, note: 'Returned to vendor' });
    await restoreStock(trx, item);
    return item;
  });
}

// ---------- pickup ----------

/** Hand the order to the customer. The pickup code must match. Payouts become due now. */
export async function handOver(orderId, code, by) {
  return runInTx(async (trx) => {
    const order = await lockOrder(trx, orderId);
    if (order.status !== 'ready_for_pickup') throw conflict('invalid_transition', 'This order is not ready for pickup.');
    if (String(code || '').trim() !== order.pickup_code) throw badRequest('wrong_code', 'The pickup code does not match.');
    await moveOrder(trx, order, 'picked_up', { by, note: 'Handed to customer', extra: { picked_up_at: clock.now() } });
    await createPayoutsForOrder(trx, order.id);
    return order;
  });
}

/** Called when payouts are marked paid. Once everything is paid, the order is completed. */
export async function completeIfSettled(trx, orderId, by) {
  const order = await lockOrder(trx, orderId);
  if (order.status !== 'picked_up') return order;
  const unpaid = await trx('payouts').where({ order_id: orderId }).whereNot({ status: 'paid' }).first();
  if (unpaid) return order;
  return moveOrder(trx, order, 'completed', { by, note: 'All payouts paid' });
}

// ---------- cancellations, deadlines ----------

/** Admin cancels an order. Paid orders are refunded for every item still active. */
export async function cancelOrder(orderId, by, note = 'Cancelled by admin') {
  const result = await runInTx(async (trx, after) => {
    const order = await lockOrder(trx, orderId);
    if (!canTransition(order.status, 'cancelled')) throw conflict('invalid_transition', 'This order can no longer be cancelled.');
    const items = await trx('order_items').where({ order_id: order.id }).forUpdate();
    let refunded = 0;
    for (const item of items) {
      if (item.item_status === 'pending_payment') {
        await moveItem(trx, item, 'cancelled', { by, note });
        await restoreStock(trx, item);
      } else if (['awaiting_dropoff', 'received'].includes(item.item_status)) {
        // Received items are still with us, so they go back to the vendor.
        await moveItem(trx, item, item.item_status === 'received' ? 'return_pending' : 'cancelled', { by, note });
        if (item.item_status === 'cancelled') await restoreStock(trx, item);
        await createRefund(trx, { orderId: order.id, itemId: item.id, amount: item.line_total_santim, reason: 'cancelled_by_admin' });
        refunded += item.line_total_santim;
      }
    }
    await moveOrder(trx, order, 'cancelled', { by, note });
    if (refunded > 0) {
      const customer = await customerOf(trx, order);
      after(() => sendSms({
        to: customer.phone,
        template: 'order_cancelled',
        lang: customer.preferred_language,
        vars: { orderNumber: order.order_number, amount: formatBirr(refunded) },
      }));
    }
    return order;
  });
  await processPendingRefunds();
  return result;
}

async function cancelUnpaidOrder(orderId) {
  return runInTx(async (trx) => {
    const order = await lockOrder(trx, orderId);
    if (order.status !== 'pending_payment') return;
    const items = await trx('order_items').where({ order_id: order.id });
    for (const item of items) {
      await moveItem(trx, item, 'cancelled', { note: 'Payment not completed in time' });
      await restoreStock(trx, item);
    }
    await moveOrder(trx, order, 'cancelled', { note: 'Payment not completed in time' });
  });
}

/** Vendor missed the drop-off window: refund every item that never arrived. */
async function handleMissedDropoff(orderId) {
  return runInTx(async (trx, after) => {
    const order = await lockOrder(trx, orderId);
    if (order.status !== 'awaiting_dropoff') return;
    const missing = await trx('order_items').where({ order_id: order.id, item_status: 'awaiting_dropoff' });
    let refunded = 0;
    for (const item of missing) {
      await moveItem(trx, item, 'missed_dropoff', { note: 'Vendor did not drop off in time' });
      await createRefund(trx, { orderId: order.id, itemId: item.id, amount: item.line_total_santim, reason: 'missed_dropoff' });
      refunded += item.line_total_santim;
    }
    await reconcileDropoff(trx, order, null, after);
    if (refunded > 0) {
      const customer = await customerOf(trx, order);
      const template = order.status === 'cancelled' ? 'order_cancelled' : 'item_refunded';
      after(() => sendSms({
        to: customer.phone,
        template,
        lang: customer.preferred_language,
        vars: {
          orderNumber: order.order_number,
          amount: formatBirr(refunded),
          item: missing.map((i) => i.title).join(', '),
        },
      }));
    }
  });
}

/** Customer did not collect in time: refund minus the fee, items go back to the vendor. */
export async function expireOrder(orderId, by = null) {
  return runInTx(async (trx, after) => {
    const order = await lockOrder(trx, orderId);
    if (order.status !== 'ready_for_pickup') return order;
    const settings = await getSettings(trx);
    const items = await trx('order_items').where({ order_id: order.id, item_status: 'received' });
    const paidForItems = items.reduce((s, i) => s + i.line_total_santim, 0);
    const { refund, fee } = expiryRefund(paidForItems, Number(settings.expiry_fee_santim));
    for (const item of items) await moveItem(trx, item, 'return_pending', { by, note: 'Not collected; return to vendor' });
    await moveOrder(trx, order, 'expired', { by, note: 'Not collected in time' });
    if (refund > 0 || fee > 0) {
      await createRefund(trx, { orderId: order.id, amount: refund, fee, reason: 'expired' });
    }
    const customer = await customerOf(trx, order);
    after(() => sendSms({
      to: customer.phone,
      template: 'order_expired',
      lang: customer.preferred_language,
      vars: { orderNumber: order.order_number, amount: formatBirr(refund) },
    }));
    return order;
  });
}

async function sendPickupReminder(orderId) {
  return runInTx(async (trx, after) => {
    const order = await lockOrder(trx, orderId);
    if (order.status !== 'ready_for_pickup' || order.pickup_reminder_sent_at) return;
    await trx('orders').where({ id: order.id }).update({ pickup_reminder_sent_at: clock.now() });
    const customer = await customerOf(trx, order);
    after(() => sendSms({
      to: customer.phone,
      template: 'pickup_reminder',
      lang: customer.preferred_language,
      vars: { orderNumber: order.order_number, code: order.pickup_code, deadline: formatDateTime(order.pickup_deadline) },
    }));
  });
}

/**
 * The background timer calls this every few minutes. It handles every time-based rule:
 * unpaid orders, missed drop-offs, pickup reminders and uncollected orders.
 */
export async function processDeadlines() {
  const now = clock.now();
  const settings = await getSettings();
  const counts = { unpaidCancelled: 0, missedDropoff: 0, reminders: 0, expired: 0 };

  const paymentCutoff = new Date(now.getTime() - Number(settings.payment_timeout_minutes) * 60_000);
  for (const { id } of await db('orders').where({ status: 'pending_payment' }).where('created_at', '<', paymentCutoff).select('id')) {
    await cancelUnpaidOrder(id);
    counts.unpaidCancelled++;
  }

  for (const { id } of await db('orders').where({ status: 'awaiting_dropoff' }).where('dropoff_deadline', '<', now).select('id')) {
    await handleMissedDropoff(id);
    counts.missedDropoff++;
  }

  const reminderAt = new Date(now.getTime() + Number(settings.pickup_reminder_hours_before) * HOUR);
  for (const { id } of await db('orders')
    .where({ status: 'ready_for_pickup' })
    .whereNull('pickup_reminder_sent_at')
    .where('pickup_deadline', '<', reminderAt)
    .where('pickup_deadline', '>=', now)
    .select('id')) {
    await sendPickupReminder(id);
    counts.reminders++;
  }

  for (const { id } of await db('orders').where({ status: 'ready_for_pickup' }).where('pickup_deadline', '<', now).select('id')) {
    await expireOrder(id);
    counts.expired++;
  }

  await processPendingRefunds();
  return counts;
}

// ---------- reading ----------

/** Full order with items, history, payments, refunds (for detail screens). */
export async function getOrderDetail(orderId) {
  const order = await db('orders').where({ id: orderId }).first();
  if (!order) throw notFound('Order not found.');
  const [items, history, refunds, customer, images] = await Promise.all([
    db('order_items')
      .join('vendors', 'vendors.id', 'order_items.vendor_id')
      .join('users as agent', 'agent.id', 'order_items.agent_id')
      .where({ order_id: orderId })
      .select('order_items.*', 'vendors.name as vendor_name', 'vendors.phone as vendor_phone', 'agent.name as agent_name')
      .orderBy('order_items.id'),
    db('order_status_history')
      .leftJoin('users', 'users.id', 'order_status_history.changed_by')
      .where({ order_id: orderId })
      .select('order_status_history.*', 'users.name as changed_by_name', 'users.role as changed_by_role')
      .orderBy('order_status_history.id'),
    db('refunds').where({ order_id: orderId }).orderBy('id'),
    db('users').where({ id: order.customer_id }).select('id', 'name', 'phone').first(),
    db('product_images').whereIn('product_id', db('order_items').where({ order_id: orderId }).select('product_id')).orderBy('sort_order'),
  ]);
  const imageFor = new Map();
  for (const img of images) if (!imageFor.has(img.product_id)) imageFor.set(img.product_id, img.small_url);
  for (const item of items) item.image_url = imageFor.get(item.product_id) || null;
  return { ...order, customer, items, history, refunds };
}
