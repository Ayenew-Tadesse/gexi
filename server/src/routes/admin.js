// Admin area: users, agents, vendors, products, orders, settings, payouts, refunds, reports and SMS log.
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/knex.js';
import { parse } from '../lib/validate.js';
import { idParam, pageParams, paginate, likeTerm } from '../lib/http.js';
import { normalizePhone } from '../lib/phone.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { requireRole } from '../middleware/auth.js';
import { hashPassword, publicUser, ROLES } from '../services/auth.js';
import { getSettings, updateSettings, DEFAULT_SETTINGS } from '../services/settings.js';
import { getOrderDetail, cancelOrder } from '../services/orders.js';
import { markPayoutsPaid } from '../services/payouts.js';
import { markRefundProcessed } from '../services/refunds.js';
import * as reports from '../services/reports.js';

const router = Router();
router.use(requireRole('admin'));

const phoneField = z.string().transform((v, ctx) => {
  const phone = normalizePhone(v);
  if (!phone) ctx.addIssue({ code: 'custom', message: 'Enter a valid Ethiopian mobile number' });
  return phone;
});
const pct = z.number().min(0).max(100);

router.get('/overview', async (_req, res) => {
  res.json(await reports.overview());
});

// ---------- users & agents ----------

router.get('/users', async (req, res) => {
  const q = db('users').leftJoin('agent_profiles', 'agent_profiles.user_id', 'users.id')
    .select('users.id', 'users.phone', 'users.name', 'users.role', 'users.is_active', 'users.created_at', 'users.preferred_language',
      'agent_profiles.commission_pct', 'agent_profiles.payout_method', 'agent_profiles.payout_account')
    .orderBy('users.id', 'desc');
  if (req.query.role) q.where('users.role', String(req.query.role));
  if (req.query.q) q.where((w) => w.whereILike('users.name', likeTerm(req.query.q)).orWhereILike('users.phone', likeTerm(req.query.q)));
  res.json(await paginate(q, pageParams(req.query, 50)));
});

const agentProfileFields = {
  commission_pct: pct.nullable().optional(),
  payout_method: z.string().trim().max(30).nullable().optional(),
  payout_account: z.string().trim().max(80).nullable().optional(),
};

async function checkAgentOverride(commissionPct) {
  if (commissionPct === null || commissionPct === undefined) return;
  const settings = await getSettings();
  if (Number(settings.vendor_pct) + commissionPct > 100) {
    throw badRequest('validation_error', 'Agent commission is too high for the current vendor share.', { commission_pct: 'Too high' });
  }
}

async function saveAgentProfile(userId, data) {
  const profile = Object.fromEntries(Object.entries(data).filter(([k]) => k in agentProfileFields));
  await db('agent_profiles').insert({ user_id: userId, ...profile }).onConflict('user_id').merge({ ...profile, updated_at: db.fn.now() });
}

router.post('/users', async (req, res) => {
  const data = parse(z.object({
    phone: phoneField,
    name: z.string().trim().min(2).max(120),
    role: z.enum(ROLES),
    password: z.string().min(6, 'Use at least 6 characters').max(100),
    ...agentProfileFields,
  }), req.body);
  if (await db('users').where({ phone: data.phone }).first()) throw conflict('phone_taken', 'This phone number already has an account.');
  if (data.role === 'agent') await checkAgentOverride(data.commission_pct);
  const [user] = await db('users')
    .insert({ phone: data.phone, name: data.name, role: data.role, password_hash: await hashPassword(data.password) })
    .returning('*');
  if (user.role === 'agent') await saveAgentProfile(user.id, data);
  res.status(201).json({ user: publicUser(user) });
});

router.patch('/users/:id', async (req, res) => {
  const id = idParam(req);
  const data = parse(z.object({
    name: z.string().trim().min(2).max(120).optional(),
    role: z.enum(ROLES).optional(),
    is_active: z.boolean().optional(),
    password: z.string().min(6).max(100).optional(),
    ...agentProfileFields,
  }), req.body);
  const user = await db('users').where({ id }).first();
  if (!user) throw notFound('User not found.');
  if (id === req.user.id && (data.is_active === false || (data.role && data.role !== 'admin'))) {
    throw badRequest('self_lockout', 'You cannot deactivate yourself or remove your own admin role.');
  }
  const changes = {};
  for (const k of ['name', 'role', 'is_active']) if (data[k] !== undefined) changes[k] = data[k];
  if (data.password) changes.password_hash = await hashPassword(data.password);
  if (Object.keys(changes).length) await db('users').where({ id }).update({ ...changes, updated_at: db.fn.now() });
  if ((data.role || user.role) === 'agent' && Object.keys(data).some((k) => k in agentProfileFields)) {
    await checkAgentOverride(data.commission_pct);
    await saveAgentProfile(id, data);
  }
  res.json({ user: publicUser(await db('users').where({ id }).first()) });
});

router.get('/agents', async (_req, res) => {
  const agents = await db('users').leftJoin('agent_profiles', 'agent_profiles.user_id', 'users.id')
    .where('users.role', 'agent')
    .select('users.id', 'users.name', 'users.phone', 'users.is_active', 'agent_profiles.commission_pct',
      'agent_profiles.payout_method', 'agent_profiles.payout_account',
      db.raw('(select count(*)::int from vendors v where v.agent_id = users.id) as vendor_count'),
      db.raw("(select count(*)::int from products p where p.agent_id = users.id and p.status = 'active') as active_products"),
      db.raw("(select coalesce(sum(amount_santim),0)::bigint from payouts po where po.payee_type = 'agent' and po.payee_id = users.id and po.status = 'due') as due_santim"),
      db.raw("(select coalesce(sum(amount_santim),0)::bigint from payouts po where po.payee_type = 'agent' and po.payee_id = users.id and po.status = 'paid') as paid_santim"))
    .orderBy('users.name');
  res.json({ items: agents.map((a) => ({ ...a, due_santim: Number(a.due_santim), paid_santim: Number(a.paid_santim) })) });
});

// ---------- vendors, products, categories ----------

router.get('/vendors', async (req, res) => {
  const q = db('vendors').join('users', 'users.id', 'vendors.agent_id')
    .select('vendors.*', 'users.name as agent_name',
      db.raw('(select count(*)::int from products p where p.vendor_id = vendors.id) as product_count'))
    .orderBy('vendors.name');
  if (req.query.q) q.where((w) => w.whereILike('vendors.name', likeTerm(req.query.q)).orWhereILike('vendors.phone', likeTerm(req.query.q)));
  if (req.query.agent_id) q.where('vendors.agent_id', Number(req.query.agent_id));
  res.json(await paginate(q, pageParams(req.query, 50)));
});

router.patch('/vendors/:id', async (req, res) => {
  const data = parse(z.object({
    name: z.string().trim().min(2).max(120).optional(),
    phone: phoneField.optional(),
    location_description: z.string().trim().max(255).optional(),
    agent_id: z.number().int().positive().optional(),
    is_active: z.boolean().optional(),
    payout_method: z.string().trim().max(30).nullable().optional(),
    payout_account: z.string().trim().max(80).nullable().optional(),
  }), req.body);
  if (data.agent_id && !(await db('users').where({ id: data.agent_id, role: 'agent' }).first())) {
    throw badRequest('validation_error', 'That user is not an agent.', { agent_id: 'Not an agent' });
  }
  const [vendor] = await db('vendors').where({ id: idParam(req) }).update({ ...data, updated_at: db.fn.now() }).returning('*');
  if (!vendor) throw notFound('Vendor not found.');
  // Products follow their vendor's agent.
  if (data.agent_id) await db('products').where({ vendor_id: vendor.id }).update({ agent_id: data.agent_id });
  res.json({ vendor });
});

router.get('/products', async (req, res) => {
  const q = db('products').join('vendors', 'vendors.id', 'products.vendor_id').join('users', 'users.id', 'products.agent_id')
    .select('products.id', 'products.title_en', 'products.price_santim', 'products.stock_qty', 'products.status', 'products.updated_at',
      'vendors.name as vendor_name', 'users.name as agent_name',
      db.raw('(select small_url from product_images pi where pi.product_id = products.id order by pi.sort_order, pi.id limit 1) as image_small'))
    .orderBy('products.id', 'desc');
  if (req.query.q) q.whereILike('products.title_en', likeTerm(req.query.q));
  if (req.query.status) q.where('products.status', String(req.query.status));
  res.json(await paginate(q, pageParams(req.query, 50)));
});

router.patch('/products/:id', async (req, res) => {
  const data = parse(z.object({
    status: z.enum(['draft', 'active', 'hidden']).optional(),
    price_santim: z.number().int().positive().optional(),
    stock_qty: z.number().int().min(0).optional(),
    category_id: z.number().int().positive().nullable().optional(),
  }), req.body);
  const [product] = await db('products').where({ id: idParam(req) }).update({ ...data, updated_at: db.fn.now() }).returning('*');
  if (!product) throw notFound('Product not found.');
  res.json({ product });
});

const categorySchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and dashes').max(60),
  name_en: z.string().trim().min(2).max(80),
  name_am: z.string().trim().max(80).optional(),
  sort_order: z.number().int().optional(),
});

router.post('/categories', async (req, res) => {
  const data = parse(categorySchema, req.body);
  const [category] = await db('categories').insert(data).returning('*');
  res.status(201).json({ category });
});

router.patch('/categories/:id', async (req, res) => {
  const data = parse(categorySchema.partial(), req.body);
  const [category] = await db('categories').where({ id: idParam(req) }).update(data).returning('*');
  if (!category) throw notFound('Category not found.');
  res.json({ category });
});

// ---------- orders ----------

router.get('/orders', async (req, res) => {
  const q = db('orders').join('users', 'users.id', 'orders.customer_id')
    .select('orders.id', 'orders.order_number', 'orders.status', 'orders.total_santim', 'orders.created_at', 'orders.paid_at',
      'orders.dropoff_deadline', 'orders.pickup_deadline', 'users.name as customer_name', 'users.phone as customer_phone')
    .orderBy('orders.id', 'desc');
  if (req.query.status) q.where('orders.status', String(req.query.status));
  if (req.query.q) {
    const term = String(req.query.q).trim();
    const phone = normalizePhone(term);
    q.where((w) => {
      w.whereILike('orders.order_number', likeTerm(term));
      if (phone) w.orWhere('users.phone', phone);
      w.orWhereILike('users.name', likeTerm(term));
    });
  }
  res.json(await paginate(q, pageParams(req.query, 30)));
});

router.get('/orders/:id', async (req, res) => {
  const order = await getOrderDetail(idParam(req));
  order.payments = await db('payments').where({ order_id: order.id }).select('id', 'provider', 'tx_ref', 'amount_santim', 'status', 'provider_reference', 'verified_at', 'created_at');
  order.payouts = await db('payouts').where({ order_id: order.id });
  res.json({ order });
});

router.post('/orders/:id/cancel', async (req, res) => {
  const { note } = parse(z.object({ note: z.string().trim().min(3, 'Please give a reason').max(255) }), req.body);
  await cancelOrder(idParam(req), req.user.id, note);
  res.json({ ok: true });
});

// ---------- settings ----------

router.get('/settings', async (_req, res) => {
  res.json({ settings: await getSettings(), defaults: DEFAULT_SETTINGS });
});

router.put('/settings', async (req, res) => {
  const data = parse(z.object({
    vendor_pct: pct.optional(),
    agent_pct: pct.optional(),
    platform_pct: pct.optional(),
    dropoff_window_hours: z.number().int().min(1).max(24 * 14).optional(),
    pickup_window_days: z.number().int().min(1).max(60).optional(),
    expiry_fee_santim: z.number().int().min(0).max(10_000_000).optional(),
    payment_timeout_minutes: z.number().int().min(5).max(24 * 60).optional(),
    pickup_reminder_hours_before: z.number().int().min(1).max(24 * 7).optional(),
    pickup_location: z.object({
      name: z.string().trim().min(2).max(120),
      address: z.string().trim().max(255),
      hours: z.string().trim().max(120),
      map_url: z.string().trim().max(500).optional().default(''),
    }).optional(),
  }), req.body);
  const merged = { ...(await getSettings()), ...data };
  const sum = Math.round((Number(merged.vendor_pct) + Number(merged.agent_pct) + Number(merged.platform_pct)) * 100);
  if (sum !== 10000) {
    throw badRequest('validation_error', 'Vendor, agent and platform percentages must add up to 100.', { platform_pct: 'Must add up to 100' });
  }
  const [maxOverride] = await db('agent_profiles').max('commission_pct as max');
  if (maxOverride.max !== null && Number(merged.vendor_pct) + Number(maxOverride.max) > 100) {
    throw badRequest('validation_error', 'Some agents have a commission override that would no longer fit. Lower it first.', { vendor_pct: 'Conflicts with agent overrides' });
  }
  res.json({ settings: await updateSettings(data) });
});

// ---------- payouts & refunds ----------

router.get('/payouts', async (req, res) => {
  const q = db('payouts')
    .join('orders', 'orders.id', 'payouts.order_id')
    .join('order_items', 'order_items.id', 'payouts.order_item_id')
    .leftJoin('vendors', function joinVendor() { this.on('vendors.id', 'payouts.payee_id').andOnVal('payouts.payee_type', 'vendor'); })
    .leftJoin('users as agent', function joinAgent() { this.on('agent.id', 'payouts.payee_id').andOnVal('payouts.payee_type', 'agent'); })
    .leftJoin('agent_profiles', 'agent_profiles.user_id', 'agent.id')
    .select('payouts.*', 'orders.order_number', 'order_items.title',
      db.raw('coalesce(vendors.name, agent.name) as payee_name'),
      db.raw('coalesce(vendors.phone, agent.phone) as payee_phone'),
      db.raw('coalesce(vendors.payout_method, agent_profiles.payout_method) as payout_method'),
      db.raw('coalesce(vendors.payout_account, agent_profiles.payout_account) as payout_account'))
    .orderBy('payouts.id', 'desc');
  q.where('payouts.status', req.query.status === 'paid' ? 'paid' : 'due');
  if (req.query.payee_type) q.where('payouts.payee_type', String(req.query.payee_type));
  res.json(await paginate(q, pageParams(req.query, 100)));
});

router.post('/payouts/mark-paid', async (req, res) => {
  const { ids, reference } = parse(z.object({
    ids: z.array(z.number().int().positive()).min(1).max(500),
    reference: z.string().trim().max(120).optional(),
  }), req.body);
  res.json(await markPayoutsPaid(ids, req.user.id, reference));
});

router.get('/refunds', async (req, res) => {
  const q = db('refunds').join('orders', 'orders.id', 'refunds.order_id').join('users', 'users.id', 'orders.customer_id')
    .leftJoin('order_items', 'order_items.id', 'refunds.order_item_id')
    .select('refunds.*', 'orders.order_number', 'users.name as customer_name', 'users.phone as customer_phone', 'order_items.title as item_title')
    .orderBy('refunds.id', 'desc');
  if (req.query.status) q.where('refunds.status', String(req.query.status));
  res.json(await paginate(q, pageParams(req.query, 50)));
});

router.post('/refunds/:id/mark-processed', async (req, res) => {
  const { reference } = parse(z.object({ reference: z.string().trim().max(120).optional() }), req.body);
  res.json({ refund: await markRefundProcessed(idParam(req), req.user.id, reference) });
});

// ---------- reports & SMS log ----------

function range(query) {
  const parseDate = (v) => (v && !Number.isNaN(Date.parse(v)) ? new Date(`${v}T00:00:00+03:00`) : null);
  const from = parseDate(query.from);
  const toDay = parseDate(query.to);
  const to = toDay ? new Date(toDay.getTime() + 24 * 60 * 60 * 1000) : null; // include the whole "to" day
  return { from, to };
}

const reportFns = {
  sales: (q) => reports.salesByPeriod({ ...range(q), group: q.group }),
  'by-agent': (q) => reports.salesByAgent(range(q)),
  'by-vendor': (q) => reports.salesByVendor(range(q)),
  'by-category': (q) => reports.salesByCategory(range(q)),
};

router.get('/reports/:name', async (req, res) => {
  const fn = reportFns[req.params.name];
  if (!fn) throw notFound('Unknown report.');
  const rows = await fn(req.query);
  if (req.query.format === 'csv') {
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="gexi-${req.params.name}.csv"`);
    return res.send(reports.toCsv(rows));
  }
  res.json({ items: rows });
});

router.get('/sms-log', async (req, res) => {
  const q = db('sms_log').orderBy('id', 'desc');
  if (req.query.phone) {
    const phone = normalizePhone(String(req.query.phone));
    if (phone) q.where({ to_phone: phone });
  }
  res.json(await paginate(q, pageParams(req.query, 50)));
});

export default router;
