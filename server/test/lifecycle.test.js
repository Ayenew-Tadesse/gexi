// Order lifecycle: status changes, refunds, payouts and deadlines.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '../src/db/knex.js';
import { clock, HOUR, DAY } from '../src/lib/clock.js';
import * as orders from '../src/services/orders.js';
import { markPayoutsPaid } from '../src/services/payouts.js';
import { updateSettings } from '../src/services/settings.js';
import { resetDb, makeUser, makeCatalog, order, items, stockOf } from './helpers.js';

let customer;
let staff;
let catalog;

beforeEach(async () => {
  await resetDb();
  customer = await makeUser('customer');
  staff = await makeUser('warehouse');
  catalog = await makeCatalog([10000, 25000]);
});

afterAll(() => db.destroy());

/** Create and pay for an order (payment row included, as the real flow does). */
async function paidOrder(lines = [[0, 1], [1, 2]]) {
  const o = await orders.createOrder(customer.id, lines.map(([i, quantity]) => ({ productId: catalog.products[i].id, quantity })));
  await db('payments').insert({ order_id: o.id, provider: 'mock', tx_ref: `T-${o.id}`, amount_santim: o.total_santim, status: 'success' });
  await orders.markOrderPaid(o.id);
  return order(o.id);
}

async function readyOrder(lines) {
  const o = await paidOrder(lines);
  for (const it of await items(o.id)) await orders.receiveItem(it.id, staff.id);
  await orders.packOrder(o.id, staff.id);
  await orders.sendToPickup(o.id, staff.id);
  return order(o.id);
}

const history = (orderId) => db('order_status_history').where({ order_id: orderId, order_item_id: null }).orderBy('id').pluck('to_status');

describe('checkout', () => {
  it('uses database prices, copies the split, and reserves stock', async () => {
    const o = await orders.createOrder(customer.id, [{ productId: catalog.products[0].id, quantity: 3 }]);
    expect(o.status).toBe('pending_payment');
    expect(o.total_santim).toBe(30000);
    const [item] = await items(o.id);
    expect(item.vendor_amount_santim + item.agent_commission_santim + item.platform_fee_santim).toBe(30000);
    expect(item).toMatchObject({ vendor_amount_santim: 25500, agent_commission_santim: 1500, platform_fee_santim: 3000 });
    expect(await stockOf(catalog.products[0].id)).toBe(7);
  });

  it('refuses to sell more than is in stock', async () => {
    await expect(orders.createOrder(customer.id, [{ productId: catalog.products[0].id, quantity: 11 }])).rejects.toMatchObject({ code: 'cart_problem' });
  });

  it('refuses hidden products', async () => {
    await db('products').where({ id: catalog.products[0].id }).update({ status: 'hidden' });
    await expect(orders.createOrder(customer.id, [{ productId: catalog.products[0].id, quantity: 1 }])).rejects.toMatchObject({ code: 'cart_problem' });
  });

  it('uses the agent commission override', async () => {
    const special = await makeCatalog([10000], { agentOverride: 8 });
    const o = await orders.createOrder(customer.id, [{ productId: special.products[0].id, quantity: 1 }]);
    const [item] = await items(o.id);
    expect(item).toMatchObject({ vendor_amount_santim: 8500, agent_commission_santim: 800, platform_fee_santim: 700 });
  });

  it('keeps the percentages an order was sold with when settings change later', async () => {
    const o = await orders.createOrder(customer.id, [{ productId: catalog.products[0].id, quantity: 1 }]);
    await updateSettings({ vendor_pct: 80, agent_pct: 10, platform_pct: 10 });
    const [item] = await items(o.id);
    expect(Number(item.agent_pct)).toBe(5);
    expect(item.vendor_amount_santim).toBe(8500);
  });
});

describe('happy path', () => {
  it('goes from payment to completed, logging every step', async () => {
    const o = await paidOrder();
    expect(o.status).toBe('awaiting_dropoff');
    expect(o.pickup_code).toMatch(/^\d{6}$/);
    expect(o.dropoff_deadline.getTime() - o.paid_at.getTime()).toBe(48 * HOUR);

    const [a, b] = await items(o.id);
    await orders.receiveItem(a.id, staff.id);
    expect((await order(o.id)).status).toBe('awaiting_dropoff'); // still waiting for the second item
    await orders.receiveItem(b.id, staff.id);
    expect((await order(o.id)).status).toBe('received_at_warehouse');

    await orders.packOrder(o.id, staff.id);
    await orders.sendToPickup(o.id, staff.id);
    const ready = await order(o.id);
    expect(ready.status).toBe('ready_for_pickup');
    expect(ready.pickup_deadline.getTime() - ready.ready_at.getTime()).toBe(7 * DAY);

    // No payouts before pickup
    expect(await db('payouts').where({ order_id: o.id })).toHaveLength(0);

    const pickup = await makeUser('pickup');
    await orders.handOver(o.id, ready.pickup_code, pickup.id);
    expect((await order(o.id)).status).toBe('picked_up');

    const payouts = await db('payouts').where({ order_id: o.id });
    expect(payouts).toHaveLength(4); // vendor + agent for each item
    const vendorTotal = payouts.filter((p) => p.payee_type === 'vendor').reduce((s, p) => s + p.amount_santim, 0);
    const agentTotal = payouts.filter((p) => p.payee_type === 'agent').reduce((s, p) => s + p.amount_santim, 0);
    expect(vendorTotal).toBe(Math.round(60000 * 0.85));
    expect(agentTotal).toBe(Math.round(60000 * 0.05));

    // Paying only some payouts does not complete the order
    const admin = await makeUser('admin');
    await markPayoutsPaid([payouts[0].id], admin.id, 'REF1');
    expect((await order(o.id)).status).toBe('picked_up');
    await markPayoutsPaid(payouts.slice(1).map((p) => p.id), admin.id, 'REF2');
    expect((await order(o.id)).status).toBe('completed');

    expect(await history(o.id)).toEqual([
      'pending_payment', 'paid', 'awaiting_dropoff', 'received_at_warehouse', 'packed', 'ready_for_pickup', 'picked_up', 'completed',
    ]);
    const handoverLog = await db('order_status_history').where({ order_id: o.id, to_status: 'picked_up' }).first();
    expect(handoverLog.changed_by).toBe(pickup.id);
  });

  it('confirming payment twice is harmless', async () => {
    const o = await paidOrder();
    const again = await orders.markOrderPaid(o.id);
    expect(again.alreadyPaid).toBe(true);
    expect(await history(o.id)).toEqual(['pending_payment', 'paid', 'awaiting_dropoff']);
  });

  it('sends SMS to the customer and the vendor', async () => {
    const o = await paidOrder();
    const sms = await db('sms_log').orderBy('id');
    expect(sms.map((s) => s.template).sort()).toEqual(['order_confirmed', 'vendor_dropoff']);
    expect(sms.find((s) => s.template === 'vendor_dropoff').to_phone).toBe(catalog.vendor.phone);
    expect(sms.find((s) => s.template === 'order_confirmed').message).toContain(o.order_number);
  });

  it('texts the pickup code when the order is ready', async () => {
    const o = await readyOrder();
    const sms = await db('sms_log').where({ template: 'ready_for_pickup' }).first();
    expect(sms.message).toContain(o.pickup_code);
  });
});

describe('rules that must not be broken', () => {
  it('cannot pack an order before everything is received', async () => {
    const o = await paidOrder();
    await expect(orders.packOrder(o.id, staff.id)).rejects.toMatchObject({ code: 'invalid_transition' });
  });

  it('cannot hand over with the wrong code', async () => {
    const o = await readyOrder();
    const wrong = o.pickup_code === '000000' ? '111111' : '000000';
    await expect(orders.handOver(o.id, wrong, staff.id)).rejects.toMatchObject({ code: 'wrong_code' });
    expect((await order(o.id)).status).toBe('ready_for_pickup');
  });

  it('cannot hand over twice', async () => {
    const o = await readyOrder();
    await orders.handOver(o.id, o.pickup_code, staff.id);
    await expect(orders.handOver(o.id, o.pickup_code, staff.id)).rejects.toMatchObject({ code: 'invalid_transition' });
  });

  it('cannot receive the same item twice', async () => {
    const o = await paidOrder();
    const [a] = await items(o.id);
    await orders.receiveItem(a.id, staff.id);
    await expect(orders.receiveItem(a.id, staff.id)).rejects.toMatchObject({ code: 'invalid_transition' });
  });
});

describe('quality check failures', () => {
  it('refunds only the rejected item and the rest continues', async () => {
    const o = await paidOrder();
    const [a, b] = await items(o.id);
    await orders.rejectItem(a.id, staff.id, 'Broken seal');
    await orders.receiveItem(b.id, staff.id);
    expect((await order(o.id)).status).toBe('received_at_warehouse');

    const refunds = await db('refunds').where({ order_id: o.id });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ order_item_id: a.id, amount_santim: 10000, reason: 'rejected', status: 'processed' });

    // Rejected item never produces payouts
    await orders.packOrder(o.id, staff.id);
    await orders.sendToPickup(o.id, staff.id);
    await orders.handOver(o.id, (await order(o.id)).pickup_code, staff.id);
    const payouts = await db('payouts').where({ order_id: o.id });
    expect(payouts.every((p) => p.order_item_id === b.id)).toBe(true);
  });

  it('cancels the whole order when every item is rejected', async () => {
    const o = await paidOrder();
    for (const it of await items(o.id)) await orders.rejectItem(it.id, staff.id, 'Wrong colour');
    expect((await order(o.id)).status).toBe('cancelled');
    const refunds = await db('refunds').where({ order_id: o.id });
    expect(refunds.reduce((s, r) => s + r.amount_santim, 0)).toBe(o.total_santim);
  });

  it('requires a reason', async () => {
    const o = await paidOrder();
    const [a] = await items(o.id);
    await expect(orders.rejectItem(a.id, staff.id, '  ')).rejects.toMatchObject({ code: 'reason_required' });
  });
});

describe('deadlines', () => {
  it('cancels unpaid orders after the timeout and puts stock back', async () => {
    const o = await orders.createOrder(customer.id, [{ productId: catalog.products[0].id, quantity: 4 }]);
    expect(await stockOf(catalog.products[0].id)).toBe(6);
    clock.advance(20 * 60_000);
    await orders.processDeadlines();
    expect((await order(o.id)).status).toBe('pending_payment');
    clock.advance(11 * 60_000);
    await orders.processDeadlines();
    expect((await order(o.id)).status).toBe('cancelled');
    expect(await stockOf(catalog.products[0].id)).toBe(10);
  });

  it('refunds a payment that arrives after the order timed out', async () => {
    const o = await orders.createOrder(customer.id, [{ productId: catalog.products[0].id, quantity: 1 }]);
    await db('payments').insert({ order_id: o.id, provider: 'mock', tx_ref: `T-${o.id}`, amount_santim: o.total_santim, status: 'success' });
    clock.advance(31 * 60_000);
    await orders.processDeadlines();
    const result = await orders.markOrderPaid(o.id);
    expect(result.late).toBe(true);
    const refund = await db('refunds').where({ order_id: o.id }).first();
    expect(refund).toMatchObject({ amount_santim: 10000, reason: 'late_payment', status: 'processed' });
  });

  it('vendor misses the drop-off window: missing items refunded, received ones continue', async () => {
    const o = await paidOrder();
    const [a, b] = await items(o.id);
    await orders.receiveItem(a.id, staff.id);
    clock.advance(47 * HOUR);
    await orders.processDeadlines();
    expect((await order(o.id)).status).toBe('awaiting_dropoff');
    clock.advance(2 * HOUR);
    await orders.processDeadlines();
    expect((await order(o.id)).status).toBe('received_at_warehouse');
    expect((await items(o.id)).find((i) => i.id === b.id).item_status).toBe('missed_dropoff');
    const refund = await db('refunds').where({ order_id: o.id }).first();
    expect(refund).toMatchObject({ order_item_id: b.id, amount_santim: 50000, reason: 'missed_dropoff' });
  });

  it('vendor misses the drop-off window with nothing received: order cancelled and fully refunded', async () => {
    const o = await paidOrder();
    clock.advance(49 * HOUR);
    await orders.processDeadlines();
    const after = await order(o.id);
    expect(after.status).toBe('cancelled');
    const total = (await db('refunds').where({ order_id: o.id })).reduce((s, r) => s + r.amount_santim, 0);
    expect(total).toBe(o.total_santim);
    expect(await db('sms_log').where({ template: 'order_cancelled' })).toHaveLength(1);
  });

  it('respects a changed drop-off window', async () => {
    await updateSettings({ dropoff_window_hours: 12 });
    const o = await paidOrder();
    clock.advance(13 * HOUR);
    await orders.processDeadlines();
    expect((await order(o.id)).status).toBe('cancelled');
  });

  it('sends a reminder, then expires uncollected orders with the fee kept', async () => {
    await updateSettings({ expiry_fee_santim: 5000 });
    const o = await readyOrder();
    clock.advance(5 * DAY);
    await orders.processDeadlines();
    expect(await db('sms_log').where({ template: 'pickup_reminder' })).toHaveLength(0);
    clock.advance(DAY + HOUR);
    await orders.processDeadlines();
    expect(await db('sms_log').where({ template: 'pickup_reminder' })).toHaveLength(1);
    await orders.processDeadlines();
    expect(await db('sms_log').where({ template: 'pickup_reminder' })).toHaveLength(1); // only once
    expect((await order(o.id)).status).toBe('ready_for_pickup');

    clock.advance(DAY);
    await orders.processDeadlines();
    expect((await order(o.id)).status).toBe('expired');
    const refund = await db('refunds').where({ order_id: o.id }).first();
    expect(refund).toMatchObject({ amount_santim: 55000, fee_santim: 5000, reason: 'expired' });
    expect((await items(o.id)).every((i) => i.item_status === 'return_pending')).toBe(true);
    expect(await db('payouts').where({ order_id: o.id })).toHaveLength(0);

    // Warehouse hands the items back; stock goes back on sale
    const stockBefore = await stockOf(catalog.products[1].id);
    for (const it of await items(o.id)) await orders.markItemReturned(it.id, staff.id);
    expect(await stockOf(catalog.products[1].id)).toBe(stockBefore + 2);
  });
});

describe('admin cancel', () => {
  it('refunds every active item and returns received goods to the vendor', async () => {
    const admin = await makeUser('admin');
    const o = await paidOrder();
    const [a] = await items(o.id);
    await orders.receiveItem(a.id, staff.id);
    await orders.cancelOrder(o.id, admin.id, 'Customer asked to cancel');
    expect((await order(o.id)).status).toBe('cancelled');
    const its = await items(o.id);
    expect(its.map((i) => i.item_status)).toEqual(['return_pending', 'cancelled']);
    const total = (await db('refunds').where({ order_id: o.id })).reduce((s, r) => s + r.amount_santim, 0);
    expect(total).toBe(o.total_santim);
  });

  it('cannot cancel an order that was already picked up', async () => {
    const admin = await makeUser('admin');
    const o = await readyOrder();
    await orders.handOver(o.id, o.pickup_code, staff.id);
    await expect(orders.cancelOrder(o.id, admin.id, 'x')).rejects.toMatchObject({ code: 'invalid_transition' });
  });
});
