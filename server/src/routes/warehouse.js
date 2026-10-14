// Warehouse staff: receive and check items, pack orders, send them to the pickup point, return items to vendors.
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/knex.js';
import { parse } from '../lib/validate.js';
import { idParam } from '../lib/http.js';
import { requireRole } from '../middleware/auth.js';
import {
  receiveItem, rejectItem, packOrder, sendToPickup, markItemReturned, getOrderDetail,
} from '../services/orders.js';

const router = Router();
router.use(requireRole('warehouse'));

const itemColumns = ['order_items.id', 'order_items.order_id', 'order_items.title', 'order_items.quantity', 'order_items.item_status',
  'order_items.rejection_reason', 'orders.order_number', 'orders.status as order_status', 'orders.dropoff_deadline',
  'vendors.id as vendor_id', 'vendors.name as vendor_name', 'vendors.phone as vendor_phone', 'vendors.location_description as vendor_location'];

function itemsQuery() {
  return db('order_items')
    .join('orders', 'orders.id', 'order_items.order_id')
    .join('vendors', 'vendors.id', 'order_items.vendor_id')
    .select(...itemColumns, db.raw(
      '(select small_url from product_images pi where pi.product_id = order_items.product_id order by pi.sort_order, pi.id limit 1) as image_url',
    ));
}

async function ordersWithItems(status) {
  const orders = await db('orders').where({ status }).orderBy('updated_at').select('id', 'order_number', 'status', 'updated_at', 'pickup_code');
  const items = orders.length
    ? await itemsQuery().whereIn('order_items.order_id', orders.map((o) => o.id)).where('order_items.item_status', 'received')
    : [];
  return orders.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id) }));
}

router.get('/summary', async (_req, res) => {
  const [awaiting, toPack, packed, returns] = await Promise.all([
    db('order_items').join('orders', 'orders.id', 'order_items.order_id')
      .where({ 'orders.status': 'awaiting_dropoff', item_status: 'awaiting_dropoff' }).count('* as n').first(),
    db('orders').where({ status: 'received_at_warehouse' }).count('* as n').first(),
    db('orders').where({ status: 'packed' }).count('* as n').first(),
    db('order_items').where({ item_status: 'return_pending' }).count('* as n').first(),
  ]);
  res.json({ awaiting: Number(awaiting.n), toPack: Number(toPack.n), packed: Number(packed.n), returns: Number(returns.n) });
});

router.get('/awaiting-dropoff', async (_req, res) => {
  const items = await itemsQuery()
    .where('orders.status', 'awaiting_dropoff')
    .where('order_items.item_status', 'awaiting_dropoff')
    .orderBy('orders.dropoff_deadline');
  res.json({ items });
});

router.post('/items/:id/receive', async (req, res) => {
  await receiveItem(idParam(req), req.user.id);
  res.json({ ok: true });
});

router.post('/items/:id/reject', async (req, res) => {
  const { reason } = parse(z.object({ reason: z.string().trim().min(3, 'Please describe the problem').max(255) }), req.body);
  await rejectItem(idParam(req), req.user.id, reason);
  res.json({ ok: true });
});

router.get('/ready-to-pack', async (_req, res) => {
  res.json({ items: await ordersWithItems('received_at_warehouse') });
});

router.post('/orders/:id/pack', async (req, res) => {
  await packOrder(idParam(req), req.user.id);
  res.json({ ok: true });
});

router.get('/packed', async (_req, res) => {
  res.json({ items: await ordersWithItems('packed') });
});

router.post('/orders/:id/send-to-pickup', async (req, res) => {
  await sendToPickup(idParam(req), req.user.id);
  res.json({ ok: true });
});

router.get('/returns', async (_req, res) => {
  res.json({ items: await itemsQuery().where('order_items.item_status', 'return_pending').orderBy('order_items.updated_at') });
});

router.post('/items/:id/returned', async (req, res) => {
  await markItemReturned(idParam(req), req.user.id);
  res.json({ ok: true });
});

router.get('/orders/:id', async (req, res) => {
  const order = await getOrderDetail(idParam(req));
  delete order.pickup_code;
  res.json({ order });
});

export default router;
