// Seller agent area: their vendors, product listings, orders and commission.
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { db } from '../db/knex.js';
import { parse } from '../lib/validate.js';
import { idParam, likeTerm } from '../lib/http.js';
import { normalizePhone } from '../lib/phone.js';
import { badRequest, notFound } from '../lib/errors.js';
import { requireRole } from '../middleware/auth.js';
import { saveProductImage, deleteProductImageFiles } from '../services/images.js';

const router = Router();
router.use(requireRole('agent'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

const phoneField = z.string().transform((v, ctx) => {
  const phone = normalizePhone(v);
  if (!phone) ctx.addIssue({ code: 'custom', message: 'Enter a valid Ethiopian mobile number' });
  return phone;
});

// Edit rules have no default values, so fields that are not sent stay unchanged.
const vendorFields = {
  name: z.string().trim().min(2, 'Please enter a name').max(120),
  phone: phoneField,
  location_description: z.string().trim().max(255),
  payout_method: z.string().trim().max(30).optional().nullable(),
  payout_account: z.string().trim().max(80).optional().nullable(),
  is_active: z.boolean().optional(),
};
const vendorCreate = z.object({ ...vendorFields, location_description: vendorFields.location_description.default('') });
const vendorUpdate = z.object(vendorFields).partial();

const productFields = {
  vendor_id: z.number().int().positive(),
  category_id: z.number().int().positive().nullable().optional(),
  title_en: z.string().trim().min(2, 'Please enter a title').max(160),
  title_am: z.string().trim().max(160),
  description_en: z.string().trim().max(5000),
  description_am: z.string().trim().max(5000),
  price_santim: z.number().int().positive('Price must be more than 0').max(100_000_000),
  stock_qty: z.number().int().min(0).max(100_000),
  status: z.enum(['draft', 'active', 'hidden']),
};
const productCreate = z.object({
  ...productFields,
  title_am: productFields.title_am.default(''),
  description_en: productFields.description_en.default(''),
  description_am: productFields.description_am.default(''),
  status: productFields.status.default('active'),
});
const productUpdate = z.object(productFields).partial();

async function ownVendor(agentId, vendorId) {
  const vendor = await db('vendors').where({ id: vendorId, agent_id: agentId }).first();
  if (!vendor) throw notFound('Vendor not found.');
  return vendor;
}

async function ownProduct(agentId, productId) {
  const product = await db('products').where({ id: productId, agent_id: agentId }).first();
  if (!product) throw notFound('Product not found.');
  return product;
}

// ---------- dashboard ----------

router.get('/dashboard', async (req, res) => {
  const agentId = req.user.id;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [[vendors], [products], [ordersThisMonth], [payouts], [pending]] = await Promise.all([
    db('vendors').where({ agent_id: agentId, is_active: true }).count('* as n'),
    db('products').where({ agent_id: agentId, status: 'active' }).count('* as n'),
    db('order_items').join('orders', 'orders.id', 'order_items.order_id')
      .where('order_items.agent_id', agentId).where('orders.paid_at', '>=', monthStart).countDistinct('orders.id as n'),
    db('payouts').where({ payee_type: 'agent', payee_id: agentId })
      .select(db.raw("coalesce(sum(amount_santim) filter (where status = 'due'), 0)::int as due"),
        db.raw("coalesce(sum(amount_santim) filter (where status = 'paid'), 0)::int as paid")),
    db('order_items').join('orders', 'orders.id', 'order_items.order_id')
      .where('order_items.agent_id', agentId)
      .whereIn('order_items.item_status', ['awaiting_dropoff', 'received'])
      .whereIn('orders.status', ['awaiting_dropoff', 'received_at_warehouse', 'packed', 'ready_for_pickup'])
      .select(db.raw('coalesce(sum(order_items.agent_commission_santim), 0)::int as pending')),
  ]);
  res.json({
    vendors: Number(vendors.n),
    activeProducts: Number(products.n),
    ordersThisMonth: Number(ordersThisMonth.n),
    commission: { pending: pending.pending, due: payouts.due, paid: payouts.paid },
  });
});

// ---------- vendors ----------

router.get('/vendors', async (req, res) => {
  const q = db('vendors').where({ agent_id: req.user.id })
    .select('vendors.*', db.raw('(select count(*)::int from products p where p.vendor_id = vendors.id) as product_count'))
    .orderBy('name');
  if (req.query.q) q.where((w) => w.whereILike('name', likeTerm(req.query.q)).orWhereILike('phone', likeTerm(req.query.q)));
  res.json({ items: await q });
});

router.post('/vendors', async (req, res) => {
  const data = parse(vendorCreate, req.body);
  const [vendor] = await db('vendors').insert({ ...data, agent_id: req.user.id }).returning('*');
  res.status(201).json({ vendor });
});

router.get('/vendors/:id', async (req, res) => {
  res.json({ vendor: await ownVendor(req.user.id, idParam(req)) });
});

router.patch('/vendors/:id', async (req, res) => {
  const vendor = await ownVendor(req.user.id, idParam(req));
  const data = parse(vendorUpdate, req.body);
  const [updated] = await db('vendors').where({ id: vendor.id }).update({ ...data, updated_at: db.fn.now() }).returning('*');
  res.json({ vendor: updated });
});

// ---------- products ----------

router.get('/products', async (req, res) => {
  const q = db('products')
    .join('vendors', 'vendors.id', 'products.vendor_id')
    .where('products.agent_id', req.user.id)
    .select('products.*', 'vendors.name as vendor_name',
      db.raw('(select small_url from product_images pi where pi.product_id = products.id order by pi.sort_order, pi.id limit 1) as image_small'))
    .orderBy('products.updated_at', 'desc');
  if (req.query.vendor_id) q.where('products.vendor_id', Number(req.query.vendor_id));
  if (req.query.status) q.where('products.status', String(req.query.status));
  if (req.query.q) q.whereILike('products.title_en', likeTerm(req.query.q));
  res.json({ items: await q });
});

router.post('/products', async (req, res) => {
  const data = parse(productCreate, req.body);
  await ownVendor(req.user.id, data.vendor_id);
  const [product] = await db('products').insert({ ...data, agent_id: req.user.id }).returning('*');
  res.status(201).json({ product: { ...product, images: [] } });
});

router.get('/products/:id', async (req, res) => {
  const product = await ownProduct(req.user.id, idParam(req));
  product.images = await db('product_images').where({ product_id: product.id }).orderBy(['sort_order', 'id']);
  res.json({ product });
});

router.patch('/products/:id', async (req, res) => {
  const product = await ownProduct(req.user.id, idParam(req));
  const data = parse(productUpdate, req.body);
  if (data.vendor_id) await ownVendor(req.user.id, data.vendor_id);
  const [updated] = await db('products').where({ id: product.id }).update({ ...data, updated_at: db.fn.now() }).returning('*');
  updated.images = await db('product_images').where({ product_id: product.id }).orderBy(['sort_order', 'id']);
  res.json({ product: updated });
});

router.post('/products/:id/images', upload.single('image'), async (req, res) => {
  const product = await ownProduct(req.user.id, idParam(req));
  if (!req.file) throw badRequest('no_image', 'Please choose a photo (JPG, PNG or WebP).');
  const count = await db('product_images').where({ product_id: product.id }).count('* as n').first();
  if (Number(count.n) >= 8) throw badRequest('too_many_images', 'A product can have up to 8 photos.');
  let urls;
  try {
    urls = await saveProductImage(req.file.buffer);
  } catch {
    throw badRequest('bad_image', 'We could not read this photo. Please try another one.');
  }
  const [image] = await db('product_images').insert({ product_id: product.id, ...urls, sort_order: Number(count.n) }).returning('*');
  res.status(201).json({ image });
});

router.delete('/products/:id/images/:imageId', async (req, res) => {
  const product = await ownProduct(req.user.id, idParam(req));
  const image = await db('product_images').where({ id: idParam(req, 'imageId'), product_id: product.id }).first();
  if (!image) throw notFound('Photo not found.');
  await db('product_images').where({ id: image.id }).delete();
  await deleteProductImageFiles(image);
  res.json({ ok: true });
});

// ---------- orders & earnings ----------

router.get('/orders', async (req, res) => {
  const rows = await db('order_items')
    .join('orders', 'orders.id', 'order_items.order_id')
    .join('vendors', 'vendors.id', 'order_items.vendor_id')
    .where('order_items.agent_id', req.user.id)
    .whereNot('orders.status', 'pending_payment')
    .select('order_items.id', 'order_items.order_id', 'order_items.title', 'order_items.quantity', 'order_items.line_total_santim',
      'order_items.agent_commission_santim', 'order_items.item_status', 'orders.order_number', 'orders.status as order_status',
      'orders.paid_at', 'orders.dropoff_deadline', 'vendors.name as vendor_name')
    .orderBy('orders.id', 'desc')
    .limit(200);
  res.json({ items: rows });
});

router.get('/earnings', async (req, res) => {
  const payouts = await db('payouts')
    .join('order_items', 'order_items.id', 'payouts.order_item_id')
    .join('orders', 'orders.id', 'payouts.order_id')
    .where({ payee_type: 'agent', payee_id: req.user.id })
    .select('payouts.*', 'order_items.title', 'order_items.line_total_santim', 'orders.order_number')
    .orderBy('payouts.id', 'desc');
  const totals = payouts.reduce((t, p) => ({ ...t, [p.status]: t[p.status] + p.amount_santim }), { due: 0, paid: 0 });
  res.json({ items: payouts, totals });
});

export default router;
