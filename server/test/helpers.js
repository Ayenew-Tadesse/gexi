// Shared test helpers: wipe tables and create sample users, vendors and products.
import request from 'supertest';
import { db } from '../src/db/knex.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/services/auth.js';
import { clock } from '../src/lib/clock.js';

export const app = createApp();

export async function resetDb() {
  clock.reset();
  const tables = ['stored_files', 'sms_log', 'settings', 'payouts', 'refunds', 'payments', 'order_status_history', 'order_items', 'orders',
    'product_images', 'products', 'categories', 'vendors', 'agent_profiles', 'otp_codes', 'users'];
  await db.raw(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
}

let phoneCounter = 100;
export async function makeUser(role = 'customer', extra = {}) {
  phoneCounter++;
  const [user] = await db('users').insert({
    phone: `+2519110${String(phoneCounter).padStart(5, '0')}`,
    name: `${role} ${phoneCounter}`,
    role,
    password_hash: await hashPassword('password123'),
    ...extra,
  }).returning('*');
  return user;
}

/** An agent with one vendor and products priced as given (in santim). */
export async function makeCatalog(prices = [10000, 25000], { stock = 10, agentOverride = null } = {}) {
  const agent = await makeUser('agent');
  if (agentOverride !== null) await db('agent_profiles').insert({ user_id: agent.id, commission_pct: agentOverride });
  const [vendor] = await db('vendors').insert({ agent_id: agent.id, name: 'Test Vendor', phone: '+251920000099' }).returning('*');
  const products = [];
  for (const [i, price] of prices.entries()) {
    const [p] = await db('products').insert({
      vendor_id: vendor.id, agent_id: agent.id, title_en: `Product ${i + 1}`, price_santim: price, stock_qty: stock, status: 'active',
    }).returning('*');
    products.push(p);
  }
  return { agent, vendor, products };
}

/** Log in through the API and return a supertest agent that keeps the session cookie. */
export async function loginAs(user) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ phone: user.phone, password: 'password123' });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export const order = (id) => db('orders').where({ id }).first();
export const items = (orderId) => db('order_items').where({ order_id: orderId }).orderBy('id');
export const stockOf = async (productId) => (await db('products').where({ id: productId }).first()).stock_qty;
