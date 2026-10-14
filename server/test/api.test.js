// API tests: logging in, who may do what, checkout with the mock payment provider, webhooks.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { db } from '../src/db/knex.js';
import { app, resetDb, makeUser, makeCatalog, loginAs, order } from './helpers.js';

beforeEach(resetDb);
afterAll(() => db.destroy());

describe('login', () => {
  it('registers with an Ethiopian number in any common format and stays logged in', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/register').send({ phone: '0912 345678', name: 'Tigist', password: 'secret12' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ phone: '+251912345678', role: 'customer' });
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    const me = await agent.get('/api/auth/me');
    expect(me.body.user.name).toBe('Tigist');
  });

  it('rejects foreign or malformed numbers', async () => {
    const res = await request(app).post('/api/auth/register').send({ phone: '+1 555 1234567', name: 'X Y', password: 'secret12' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_phone');
  });

  it('rejects a wrong password without saying which part was wrong', async () => {
    const user = await makeUser('customer');
    const res = await request(app).post('/api/auth/login').send({ phone: user.phone, password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Wrong phone number or password.');
  });

  it('logs in with an SMS code, creating an account for a new number', async () => {
    const agent = request.agent(app);
    const req1 = await agent.post('/api/auth/otp/request').send({ phone: '0933112233' });
    expect(req1.status).toBe(200);
    const sms = await db('sms_log').where({ template: 'otp' }).first();
    const code = sms.message.match(/\d{6}/)[0];
    expect(req1.body.devCode).toBe(code);

    const bad = await agent.post('/api/auth/otp/verify').send({ phone: '0933112233', code: code === '000000' ? '111111' : '000000' });
    expect(bad.status).toBe(401);
    const ok = await agent.post('/api/auth/otp/verify').send({ phone: '0933112233', code, name: 'New Person' });
    expect(ok.status).toBe(200);
    expect(ok.body.user).toMatchObject({ phone: '+251933112233', role: 'customer', name: 'New Person' });

    // A code works only once
    const reuse = await request(app).post('/api/auth/otp/verify').send({ phone: '0933112233', code });
    expect(reuse.status).toBe(401);
  });

  it('does not let someone ask for codes repeatedly', async () => {
    await request(app).post('/api/auth/otp/request').send({ phone: '0933112233' });
    const again = await request(app).post('/api/auth/otp/request').send({ phone: '0933112233' });
    expect(again.status).toBe(429);
  });

  it('blocks deactivated accounts', async () => {
    const user = await makeUser('customer', { is_active: false });
    const res = await request(app).post('/api/auth/login').send({ phone: user.phone, password: 'password123' });
    expect(res.status).toBe(401);
  });
});

describe('permissions', () => {
  it('keeps each role in its own area', async () => {
    const customer = await loginAs(await makeUser('customer'));
    const agent = await loginAs(await makeUser('agent'));
    const warehouse = await loginAs(await makeUser('warehouse'));
    const pickup = await loginAs(await makeUser('pickup'));
    const admin = await loginAs(await makeUser('admin'));

    expect((await request(app).get('/api/agent/vendors')).status).toBe(401);
    expect((await customer.get('/api/agent/vendors')).status).toBe(403);
    expect((await customer.get('/api/warehouse/awaiting-dropoff')).status).toBe(403);
    expect((await customer.get('/api/admin/users')).status).toBe(403);
    expect((await agent.get('/api/warehouse/awaiting-dropoff')).status).toBe(403);
    expect((await warehouse.get('/api/pickup/lookup?code=123456')).status).toBe(403);
    expect((await pickup.get('/api/warehouse/awaiting-dropoff')).status).toBe(403);
    expect((await pickup.get('/api/admin/settings')).status).toBe(403);

    expect((await agent.get('/api/agent/vendors')).status).toBe(200);
    expect((await warehouse.get('/api/warehouse/awaiting-dropoff')).status).toBe(200);
    expect((await pickup.get('/api/pickup/lookup?code=123456')).status).toBe(200);
    expect((await admin.get('/api/admin/users')).status).toBe(200);
    expect((await admin.get('/api/warehouse/awaiting-dropoff')).status).toBe(200); // admin can help anywhere
  });

  it('agents only see and edit their own vendors and products', async () => {
    const mine = await makeCatalog([10000]);
    const other = await makeCatalog([20000]);
    const agent = await loginAs(mine.agent);
    const list = await agent.get('/api/agent/products');
    expect(list.body.items.map((p) => p.id)).toEqual([mine.products[0].id]);
    expect((await agent.patch(`/api/agent/products/${other.products[0].id}`).send({ price_santim: 1 })).status).toBe(404);
    expect((await agent.post('/api/agent/products').send({ vendor_id: other.vendor.id, title_en: 'Sneaky', price_santim: 100, stock_qty: 1 })).status).toBe(404);
  });

  it('customers cannot see other customers\' orders', async () => {
    const { products } = await makeCatalog([10000]);
    const alice = await loginAs(await makeUser('customer'));
    const bob = await loginAs(await makeUser('customer'));
    const res = await alice.post('/api/checkout').send({ items: [{ productId: products[0].id, quantity: 1 }] });
    expect((await bob.get(`/api/orders/${res.body.orderId}`)).status).toBe(404);
    expect((await alice.get(`/api/orders/${res.body.orderId}`)).status).toBe(200);
  });
});

describe('agent listings', () => {
  it('creates a vendor and a product, and editing does not reset other fields', async () => {
    const agent = await loginAs(await makeUser('agent'));
    const v = await agent.post('/api/agent/vendors').send({ name: 'Almaz Shop', phone: '0920111222', location_description: 'Megenagna' });
    expect(v.status).toBe(201);
    expect(v.body.vendor.phone).toBe('+251920111222');
    const p = await agent.post('/api/agent/products').send({
      vendor_id: v.body.vendor.id, title_en: 'Injera basket', title_am: 'ሞሶብ', price_santim: 50000, stock_qty: 3, status: 'draft',
    });
    expect(p.status).toBe(201);
    const edit = await agent.patch(`/api/agent/products/${p.body.product.id}`).send({ price_santim: 55000 });
    expect(edit.body.product).toMatchObject({ price_santim: 55000, title_am: 'ሞሶብ', status: 'draft' });
  });

  it('draft products are not visible in the shop', async () => {
    const { products } = await makeCatalog([10000, 20000]);
    await db('products').where({ id: products[1].id }).update({ status: 'draft' });
    const res = await request(app).get('/api/products');
    expect(res.body.items.map((p) => p.id)).toEqual([products[0].id]);
    expect((await request(app).get(`/api/products/${products[1].id}`)).status).toBe(404);
  });
});

describe('checkout and payment (mock provider)', () => {
  it('ignores prices sent by the browser and charges the database price', async () => {
    const { products } = await makeCatalog([12345]);
    const customer = await loginAs(await makeUser('customer'));
    const res = await customer.post('/api/checkout').send({ items: [{ productId: products[0].id, quantity: 2, price_santim: 1 }] });
    expect(res.status).toBe(201);
    expect((await order(res.body.orderId)).total_santim).toBe(24690);
    expect(res.body.checkoutUrl).toContain('/dev/mock-pay?tx_ref=');
  });

  it('only marks the order paid after the provider confirms it', async () => {
    const { products } = await makeCatalog([10000]);
    const customer = await loginAs(await makeUser('customer'));
    const { body } = await customer.post('/api/checkout').send({ items: [{ productId: products[0].id, quantity: 1 }] });

    const early = await customer.get(`/api/payments/verify/${body.txRef}`);
    expect(early.body.status).toBe('pending');
    expect((await order(body.orderId)).status).toBe('pending_payment');

    await request(app).post('/api/payments/mock/complete').send({ tx_ref: body.txRef, outcome: 'success' });
    const done = await customer.get(`/api/payments/verify/${body.txRef}`);
    expect(done.body.status).toBe('success');
    expect((await order(body.orderId)).status).toBe('awaiting_dropoff');

    const detail = await customer.get(`/api/orders/${body.orderId}`);
    expect(detail.body.order.pickup_code).toMatch(/^\d{6}$/);
    expect(detail.body.order.items[0]).not.toHaveProperty('vendor_amount_santim');
  });

  it('webhook triggers the same verification and is safe to repeat', async () => {
    const { products } = await makeCatalog([10000]);
    const customer = await loginAs(await makeUser('customer'));
    const { body } = await customer.post('/api/checkout').send({ items: [{ productId: products[0].id, quantity: 1 }] });
    await request(app).post('/api/payments/mock/complete').send({ tx_ref: body.txRef, outcome: 'success' });
    for (let i = 0; i < 3; i++) {
      expect((await request(app).post('/api/payments/chapa/webhook').send({ tx_ref: body.txRef })).status).toBe(200);
    }
    expect((await order(body.orderId)).status).toBe('awaiting_dropoff');
    expect(await db('order_status_history').where({ order_id: body.orderId, to_status: 'paid' })).toHaveLength(1);
  });

  it('a forged webhook cannot mark an unpaid order as paid', async () => {
    const { products } = await makeCatalog([10000]);
    const customer = await loginAs(await makeUser('customer'));
    const { body } = await customer.post('/api/checkout').send({ items: [{ productId: products[0].id, quantity: 1 }] });
    await request(app).post('/api/payments/chapa/webhook').send({ tx_ref: body.txRef, status: 'success' });
    expect((await order(body.orderId)).status).toBe('pending_payment');
  });

  it('a failed payment leaves the order unpaid and can be retried', async () => {
    const { products } = await makeCatalog([10000]);
    const customer = await loginAs(await makeUser('customer'));
    const { body } = await customer.post('/api/checkout').send({ items: [{ productId: products[0].id, quantity: 1 }] });
    await request(app).post('/api/payments/mock/complete').send({ tx_ref: body.txRef, outcome: 'failed' });
    expect((await customer.get(`/api/payments/verify/${body.txRef}`)).body.status).toBe('failed');
    const retry = await customer.post(`/api/orders/${body.orderId}/pay`);
    expect(retry.status).toBe(200);
    expect(retry.body.txRef).not.toBe(body.txRef);
  });
});

describe('warehouse and pickup over the API', () => {
  it('runs an order through the staff screens', async () => {
    const { products } = await makeCatalog([10000]);
    const customer = await loginAs(await makeUser('customer'));
    const warehouse = await loginAs(await makeUser('warehouse'));
    const pickup = await loginAs(await makeUser('pickup'));
    const { body } = await customer.post('/api/checkout').send({ items: [{ productId: products[0].id, quantity: 1 }] });
    await request(app).post('/api/payments/mock/complete').send({ tx_ref: body.txRef, outcome: 'success' });
    await customer.get(`/api/payments/verify/${body.txRef}`);

    const waiting = await warehouse.get('/api/warehouse/awaiting-dropoff');
    expect(waiting.body.items).toHaveLength(1);
    expect(waiting.body.items[0]).toHaveProperty('image_url');
    expect((await warehouse.post(`/api/warehouse/items/${waiting.body.items[0].id}/receive`)).status).toBe(200);
    expect((await warehouse.post(`/api/warehouse/orders/${body.orderId}/pack`)).status).toBe(200);
    expect((await warehouse.post(`/api/warehouse/orders/${body.orderId}/send-to-pickup`)).status).toBe(200);

    const { pickup_code: code } = await order(body.orderId);
    const found = await pickup.get(`/api/pickup/lookup?code=${code}`);
    expect(found.body.items).toHaveLength(1);
    expect(found.body.items[0]).not.toHaveProperty('pickup_code');

    const byPhone = await pickup.get(`/api/pickup/lookup?phone=${encodeURIComponent((await db('users').where({ role: 'customer' }).first()).phone)}`);
    expect(byPhone.body.items[0].id).toBe(body.orderId);

    expect((await pickup.post(`/api/pickup/orders/${body.orderId}/handover`).send({ code: '12345' })).status).toBe(400);
    expect((await pickup.post(`/api/pickup/orders/${body.orderId}/handover`).send({ code })).status).toBe(200);
    expect((await order(body.orderId)).status).toBe('picked_up');
  });
});

describe('admin', () => {
  it('only accepts split percentages that add up to 100', async () => {
    const admin = await loginAs(await makeUser('admin'));
    expect((await admin.put('/api/admin/settings').send({ vendor_pct: 80 })).status).toBe(400);
    const ok = await admin.put('/api/admin/settings').send({ vendor_pct: 80, agent_pct: 7, platform_pct: 13 });
    expect(ok.status).toBe(200);
    expect(ok.body.settings).toMatchObject({ vendor_pct: 80, agent_pct: 7, platform_pct: 13 });
  });

  it('creates staff accounts and cannot lock itself out', async () => {
    const adminUser = await makeUser('admin');
    const admin = await loginAs(adminUser);
    const res = await admin.post('/api/admin/users').send({ phone: '0944556677', name: 'New Agent', role: 'agent', password: 'secret12', commission_pct: 6 });
    expect(res.status).toBe(201);
    expect((await db('agent_profiles').where({ user_id: res.body.user.id }).first()).commission_pct).toBe('6.00');
    expect((await admin.patch(`/api/admin/users/${adminUser.id}`).send({ is_active: false })).status).toBe(400);
  });

  it('produces reports and CSV', async () => {
    const admin = await loginAs(await makeUser('admin'));
    const res = await admin.get('/api/admin/reports/by-agent');
    expect(res.status).toBe(200);
    const csv = await admin.get('/api/admin/reports/sales?format=csv');
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
  });
});
