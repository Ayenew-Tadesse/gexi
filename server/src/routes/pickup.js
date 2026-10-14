// Pickup staff: find an order by code or phone number and hand it over.
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/knex.js';
import { parse } from '../lib/validate.js';
import { idParam } from '../lib/http.js';
import { normalizePhone } from '../lib/phone.js';
import { badRequest } from '../lib/errors.js';
import { requireRole } from '../middleware/auth.js';
import { handOver } from '../services/orders.js';

const router = Router();
router.use(requireRole('pickup'));

router.get('/lookup', async (req, res) => {
  const code = String(req.query.code || '').trim();
  const phoneRaw = String(req.query.phone || '').trim();
  const q = db('orders').join('users', 'users.id', 'orders.customer_id')
    .select('orders.id', 'orders.order_number', 'orders.status', 'orders.total_santim', 'orders.ready_at', 'orders.pickup_deadline',
      'orders.picked_up_at', 'users.name as customer_name', 'users.phone as customer_phone')
    .orderBy('orders.id', 'desc')
    .limit(20);
  if (code) {
    if (!/^\d{6}$/.test(code)) throw badRequest('invalid_code', 'A pickup code has 6 digits.');
    q.where('orders.pickup_code', code).whereIn('orders.status', ['ready_for_pickup', 'packed', 'received_at_warehouse', 'awaiting_dropoff']);
  } else if (phoneRaw) {
    const phone = normalizePhone(phoneRaw);
    if (!phone) throw badRequest('invalid_phone', 'Enter a valid phone number.');
    q.where('users.phone', phone).whereNotIn('orders.status', ['pending_payment', 'cancelled']);
  } else {
    throw badRequest('missing_query', 'Enter a pickup code or a phone number.');
  }
  const orders = await q;
  const items = orders.length
    ? await db('order_items').whereIn('order_id', orders.map((o) => o.id)).where('item_status', 'received')
      .select('order_id', 'title', 'quantity')
    : [];
  // The pickup code itself is never returned: the customer must say it.
  res.json({ items: orders.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id) })) });
});

router.post('/orders/:id/handover', async (req, res) => {
  const { code } = parse(z.object({ code: z.string().trim().regex(/^\d{6}$/, 'A pickup code has 6 digits') }), req.body);
  await handOver(idParam(req), code, req.user.id);
  res.json({ ok: true });
});

export default router;
