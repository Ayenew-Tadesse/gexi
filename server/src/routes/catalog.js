// Public catalog: anyone can browse without logging in.
import { Router } from 'express';
import { db } from '../db/knex.js';
import { idParam, pageParams, paginate, likeTerm } from '../lib/http.js';
import { notFound } from '../lib/errors.js';
import { getSettings, PUBLIC_SETTING_KEYS } from '../services/settings.js';
import { config } from '../config.js';

const router = Router();

const firstImage = (size) => db.raw(
  `(select ${size}_url from product_images pi where pi.product_id = products.id order by pi.sort_order, pi.id limit 1) as image_${size}`,
);

function publicProducts() {
  return db('products')
    .join('vendors', 'vendors.id', 'products.vendor_id')
    .leftJoin('categories', 'categories.id', 'products.category_id')
    .where('products.status', 'active')
    .where('vendors.is_active', true);
}

router.get('/categories', async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ items: await db('categories').orderBy(['sort_order', 'name_en']) });
});

router.get('/products', async (req, res) => {
  const q = publicProducts().select(
    'products.id', 'products.title_en', 'products.title_am', 'products.price_santim', 'products.stock_qty',
    'categories.slug as category_slug', firstImage('small'), firstImage('medium'),
  );
  if (req.query.q) {
    const term = likeTerm(req.query.q);
    q.where((w) => w.whereILike('products.title_en', term).orWhereILike('products.title_am', term).orWhereILike('products.description_en', term));
  }
  if (req.query.category) q.where('categories.slug', String(req.query.category));
  if (req.query.min_price) q.where('products.price_santim', '>=', Math.round(Number(req.query.min_price) * 100) || 0);
  if (req.query.max_price) q.where('products.price_santim', '<=', Math.round(Number(req.query.max_price) * 100) || Number.MAX_SAFE_INTEGER);
  const sort = {
    price_asc: ['products.price_santim', 'asc'],
    price_desc: ['products.price_santim', 'desc'],
  }[req.query.sort] || ['products.created_at', 'desc'];
  q.orderByRaw('(products.stock_qty > 0) desc').orderBy(...sort).orderBy('products.id', 'desc');
  res.json(await paginate(q, pageParams(req.query, 20)));
});

router.get('/products/:id', async (req, res) => {
  const product = await publicProducts()
    .where('products.id', idParam(req))
    .select('products.id', 'products.title_en', 'products.title_am', 'products.description_en', 'products.description_am',
      'products.price_santim', 'products.stock_qty', 'categories.slug as category_slug', 'categories.name_en as category_name_en',
      'categories.name_am as category_name_am')
    .first();
  if (!product) throw notFound('This product is not available.');
  product.images = await db('product_images').where({ product_id: product.id }).orderBy(['sort_order', 'id'])
    .select('id', 'small_url', 'medium_url', 'large_url');
  res.json({ product });
});

router.get('/settings/public', async (_req, res) => {
  const settings = await getSettings();
  res.json({ ...Object.fromEntries(PUBLIC_SETTING_KEYS.map((k) => [k, settings[k]])), demo_mode: config.demoMode });
});

export default router;
