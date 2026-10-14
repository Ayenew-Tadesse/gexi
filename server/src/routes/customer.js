// Customer area: checkout and order history.
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/knex.js';
import { parse } from '../lib/validate.js';
import { idParam } from '../lib/http.js';
import { notFound } from '../lib/errors.js';
import { requireLogin } from '../middleware/auth.js';
import { checkout, startPayment } from '../services/checkout.js';
import { getOrderDetail } from '../services/orders.js';

const router = Router();

router.post('/checkout', requireLogin, async (req, res) => {
  const { items } = parse(z.object({
    items: z.array(z.object({
      productId: z.number().int().positive(),
      quantity: z.number().int().min(1).max(50),
    })).min(1, 'Your cart is empty').max(50),
  }), req.body);
  res.status(201).json(await checkout(req.user, items));
});

router.get('/orders', requireLogin, async (req, res) => {
  const orders = await db('orders')
    .where({ customer_id: req.user.id })
    .orderBy('id', 'desc')
    .limit(50)
    .select('id', 'order_number', 'status', 'total_santim', 'created_at', 'pickup_deadline',
      db.raw('(select count(*)::int from order_items oi where oi.order_id = orders.id) as item_count'));
  res.json({ items: orders });
});

/** What a customer may see about their order: no money split, no staff names, no vendor details. */
function customerView(order) {
  return {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    total_santim: order.total_santim,
    pickup_code: ['awaiting_dropoff', 'received_at_warehouse', 'packed', 'ready_for_pickup'].includes(order.status) ? order.pickup_code : null,
    created_at: order.created_at,
    paid_at: order.paid_at,
    ready_at: order.ready_at,
    pickup_deadline: order.pickup_deadline,
    picked_up_at: order.picked_up_at,
    items: order.items.map((i) => ({
      id: i.id, product_id: i.product_id, title: i.title, quantity: i.quantity, unit_price_santim: i.unit_price_santim,
      line_total_santim: i.line_total_santim, item_status: i.item_status, image_url: i.image_url,
    })),
    history: order.history.filter((h) => !h.order_item_id).map((h) => ({ to_status: h.to_status, created_at: h.created_at })),
    refunds: order.refunds.map((r) => ({ amount_santim: r.amount_santim, fee_santim: r.fee_santim, reason: r.reason, status: r.status })),
  };
}

router.get('/orders/:id', requireLogin, async (req, res) => {
  const order = await getOrderDetail(idParam(req));
  if (order.customer_id !== req.user.id) throw notFound('Order not found.');
  res.json({ order: customerView(order) });
});

/** Try paying again for an order that is still waiting for payment. */
router.post('/orders/:id/pay', requireLogin, async (req, res) => {
  const order = await db('orders').where({ id: idParam(req), customer_id: req.user.id }).first();
  if (!order) throw notFound('Order not found.');
  res.json(await startPayment(order, req.user));
});

export default router;
