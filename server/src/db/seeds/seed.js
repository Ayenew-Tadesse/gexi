// Sample data so you can click around immediately.
// ⚠️  This WIPES the database and starts fresh every time you run it.
//
// All sample accounts use the password:  password123
process.env.SMS_CONSOLE_QUIET = '1';

const { db } = await import('../knex.js');
const { migrateLatest } = await import('../migrate.js');
const { clock, DAY, HOUR } = await import('../../lib/clock.js');
const { hashPassword } = await import('../../services/auth.js');
const { saveProductImage } = await import('../../services/images.js');
const orders = await import('../../services/orders.js');
const { markPayoutsPaid } = await import('../../services/payouts.js');
const { config } = await import('../../config.js');
const fs = await import('node:fs/promises');
const sharp = (await import('sharp')).default;

const PASSWORD = 'password123';

const USERS = [
  { phone: '+251911000000', name: 'Selam Admin', role: 'admin' },
  { phone: '+251911000001', name: 'Abebe Kebede', role: 'agent', key: 'abebe' },
  { phone: '+251911000002', name: 'Hana Tesfaye', role: 'agent', key: 'hana', commission_pct: 6 },
  { phone: '+251911000003', name: 'Dawit Warehouse', role: 'warehouse', key: 'warehouse' },
  { phone: '+251911000004', name: 'Meron Pickup', role: 'pickup', key: 'pickup' },
  { phone: '+251911000010', name: 'Liya Alemu', role: 'customer', key: 'liya' },
  { phone: '+251911000011', name: 'Yonas Girma', role: 'customer', key: 'yonas' },
  { phone: '+251911000012', name: 'Sara Mekonnen', role: 'customer', key: 'sara', preferred_language: 'am' },
];

const CATEGORIES = [
  { slug: 'coffee-spices', name_en: 'Coffee & Spices', name_am: 'ቡና እና ቅመማ ቅመም', color: '#7c4a2d' },
  { slug: 'fashion', name_en: 'Fashion', name_am: 'ፋሽን', color: '#9b2c5a' },
  { slug: 'home-kitchen', name_en: 'Home & Kitchen', name_am: 'ቤት እና ማእድ ቤት', color: '#2f6f5e' },
  { slug: 'electronics', name_en: 'Electronics', name_am: 'ኤሌክትሮኒክስ', color: '#2b4c8c' },
  { slug: 'beauty', name_en: 'Beauty & Care', name_am: 'ውበት እና እንክብካቤ', color: '#b0603a' },
];

const VENDORS = [
  { key: 'tomoca', agent: 'abebe', name: 'Bole Coffee Roasters', phone: '+251920000001', location_description: 'Bole, behind Friendship building', payout_method: 'telebirr', payout_account: '0920000001' },
  { key: 'merkato', agent: 'abebe', name: 'Merkato Spice House', phone: '+251920000002', location_description: 'Merkato, Shema Tera', payout_method: 'cbe', payout_account: '1000123456789' },
  { key: 'shiro', agent: 'hana', name: 'Shiro Meda Weavers', phone: '+251920000003', location_description: 'Shiro Meda market, shop 14', payout_method: 'telebirr', payout_account: '0920000003' },
  { key: 'piassa', agent: 'hana', name: 'Piassa Electronics', phone: '+251920000004', location_description: 'Piassa, Taitu street', payout_method: 'cbe', payout_account: '1000987654321' },
  { key: 'kazanchis', agent: 'abebe', name: 'Kazanchis Home Goods', phone: '+251920000005', location_description: 'Kazanchis, near Intercontinental', payout_method: 'telebirr', payout_account: '0920000005' },
];

// [vendor, category, title, price (ETB), stock, description]
const PRODUCTS = [
  ['tomoca', 'coffee-spices', 'Yirgacheffe Coffee Beans 500g', 650, 40, 'Freshly roasted single-origin beans with floral, citrus notes.'],
  ['tomoca', 'coffee-spices', 'Sidamo Coffee Beans 1kg', 1150, 25, 'Medium roast, rich and sweet. Great for buna ceremonies.'],
  ['tomoca', 'coffee-spices', 'Harar Coffee Beans 500g', 700, 18, 'Bold, fruity Harar beans, dry-processed.'],
  ['merkato', 'coffee-spices', 'Berbere Spice Mix 500g', 380, 60, 'Traditional hot spice blend for wot and tibs.'],
  ['merkato', 'coffee-spices', 'Mitmita 250g', 220, 45, 'Fiery bird\'s eye chili blend for kitfo.'],
  ['merkato', 'coffee-spices', 'Shiro Powder 1kg', 300, 70, 'Smooth chickpea flour seasoned for shiro wot.'],
  ['merkato', 'coffee-spices', 'Korerima (Ethiopian Cardamom) 100g', 160, 30, 'Aromatic spice for coffee and stews.'],
  ['shiro', 'fashion', 'Habesha Kemis – White & Gold', 6500, 6, 'Hand-woven cotton dress with tilet border.'],
  ['shiro', 'fashion', 'Netela Scarf', 900, 20, 'Light hand-woven cotton shawl.'],
  ['shiro', 'fashion', 'Men\'s Kuta Gabi Set', 3200, 8, 'Traditional cotton outfit with embroidered trim.'],
  ['shiro', 'fashion', 'Tilet Table Runner', 750, 15, 'Colourful woven runner, 180 cm.'],
  ['shiro', 'fashion', 'Leather Sandals', 1400, 0, 'Handmade leather sandals (sold out sample).'],
  ['piassa', 'electronics', 'Power Bank 20,000 mAh', 2300, 22, 'Charges a phone up to 5 times. Helpful during power cuts.'],
  ['piassa', 'electronics', 'USB-C Fast Charger 25W', 850, 35, 'Wall charger with USB-C cable.'],
  ['piassa', 'electronics', 'Bluetooth Earbuds', 1900, 14, 'Wireless earbuds with charging case.'],
  ['piassa', 'electronics', 'Rechargeable LED Lamp', 1200, 30, 'Solar + USB rechargeable lamp, 12 hours of light.'],
  ['piassa', 'electronics', 'Phone Case (Universal)', 350, 50, 'Shock-proof silicone case.'],
  ['kazanchis', 'home-kitchen', 'Clay Jebena (Coffee Pot)', 450, 25, 'Traditional clay coffee pot.'],
  ['kazanchis', 'home-kitchen', 'Sini Coffee Cup Set (6)', 600, 18, 'Six porcelain sini cups.'],
  ['kazanchis', 'home-kitchen', 'Mesob Basket', 2800, 5, 'Hand-woven basket table for injera.'],
  ['kazanchis', 'home-kitchen', 'Electric Mitad 40cm', 7800, 4, 'Electric griddle for baking injera.'],
  ['kazanchis', 'home-kitchen', 'Rekebot Coffee Tray', 1600, 7, 'Wooden coffee ceremony tray.'],
  ['shiro', 'beauty', 'Shea Butter 250g', 420, 40, 'Pure unrefined shea butter.'],
  ['shiro', 'beauty', 'Black Seed Oil 100ml', 550, 26, 'Cold-pressed tikur azmud oil.'],
  ['merkato', 'beauty', 'Frankincense (Etan) 200g', 250, 50, 'Natural incense for the coffee ceremony.'],
];

function escapeXml(s) {
  return s.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' }[c]));
}

/** Simple placeholder picture: coloured square with the product name. */
async function placeholderImage(title, color) {
  const words = title.split(' ');
  const lines = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + w).length <= 13) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  const text = lines.slice(0, 4).map((l, i) => `<text x="400" y="${360 + i * 70 - (lines.length - 1) * 35}" font-size="54" font-family="sans-serif" font-weight="bold" fill="#fff" text-anchor="middle">${escapeXml(l)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="${color}"/><circle cx="650" cy="150" r="220" fill="#ffffff" fill-opacity="0.08"/><circle cx="120" cy="700" r="180" fill="#000000" fill-opacity="0.08"/>${text}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function run() {
  console.log('🧹 Resetting database…');
  await migrateLatest({ reset: true });
  await fs.rm(config.uploadDir, { recursive: true, force: true });
  clock.reset();

  console.log('👤 Users…');
  const hash = await hashPassword(PASSWORD);
  const users = {};
  for (const u of USERS) {
    const [row] = await db('users').insert({ phone: u.phone, name: u.name, role: u.role, password_hash: hash, preferred_language: u.preferred_language || 'en' }).returning('*');
    users[u.key || u.role] = row;
    if (u.role === 'agent') {
      await db('agent_profiles').insert({ user_id: row.id, commission_pct: u.commission_pct ?? null, payout_method: 'telebirr', payout_account: u.phone.replace('+251', '0') });
    }
  }

  console.log('🏷  Categories, vendors, products and photos…');
  const categories = {};
  for (const [i, c] of CATEGORIES.entries()) {
    const [row] = await db('categories').insert({ slug: c.slug, name_en: c.name_en, name_am: c.name_am, sort_order: i }).returning('*');
    categories[c.slug] = { ...row, color: c.color };
  }
  const vendors = {};
  for (const v of VENDORS) {
    const { key, agent, ...data } = v;
    const [row] = await db('vendors').insert({ ...data, agent_id: users[agent].id }).returning('*');
    vendors[key] = row;
  }
  const products = [];
  for (const [vendorKey, cat, title, price, stock, description] of PRODUCTS) {
    const vendor = vendors[vendorKey];
    const [row] = await db('products').insert({
      vendor_id: vendor.id, agent_id: vendor.agent_id, category_id: categories[cat].id, title_en: title,
      description_en: description, price_santim: price * 100, stock_qty: stock, status: 'active',
    }).returning('*');
    const urls = await saveProductImage(await placeholderImage(title, categories[cat].color));
    await db('product_images').insert({ product_id: row.id, ...urls, sort_order: 0 });
    products.push(row);
  }
  // One draft listing so agents can see the draft state.
  await db('products').insert({
    vendor_id: vendors.piassa.id, agent_id: vendors.piassa.agent_id, category_id: categories.electronics.id,
    title_en: 'Smart Watch (draft)', description_en: 'Not published yet.', price_santim: 350000, stock_qty: 3, status: 'draft',
  });

  console.log('📦 Orders in every status…');
  const P = (title) => products.find((p) => p.title_en.startsWith(title)).id;
  const customers = [users.liya, users.yonas, users.sara];
  const staff = { warehouse: users.warehouse.id, pickup: users.pickup.id, admin: users.admin.id };

  async function place(customer, lines) {
    const order = await orders.createOrder(customer.id, lines.map(([title, quantity]) => ({ productId: P(title), quantity })));
    await db('payments').insert({ order_id: order.id, provider: 'mock', tx_ref: `${order.order_number}-seed`, amount_santim: order.total_santim, status: 'success', provider_reference: `SEED-${order.id}`, verified_at: clock.now() });
    return order;
  }
  async function pay(order) { await orders.markOrderPaid(order.id, { reference: `SEED-${order.id}` }); }
  async function receiveAll(order) {
    for (const item of await db('order_items').where({ order_id: order.id, item_status: 'awaiting_dropoff' })) {
      await orders.receiveItem(item.id, staff.warehouse);
    }
  }
  async function toReady(order) {
    await pay(order); clock.advance(5 * HOUR);
    await receiveAll(order); clock.advance(2 * HOUR);
    await orders.packOrder(order.id, staff.warehouse); clock.advance(HOUR);
    await orders.sendToPickup(order.id, staff.warehouse);
  }

  // Past two weeks of delivered orders (for reports and payouts).
  clock.advance(-15 * DAY);
  const baskets = [
    [['Yirgacheffe', 2], ['Clay Jebena', 1]],
    [['Berbere', 1], ['Mitmita', 2]],
    [['Power Bank', 1]],
    [['Habesha Kemis', 1], ['Netela', 1]],
    [['Sini Coffee', 1], ['Frankincense', 3]],
    [['Bluetooth Earbuds', 1], ['Phone Case', 2]],
    [['Sidamo', 1], ['Korerima', 1]],
    [['Mesob', 1]],
    [['Shea Butter', 2], ['Black Seed', 1]],
    [['Rechargeable LED', 2]],
    [['Harar', 1], ['Rekebot', 1]],
    [['USB-C', 1], ['Shiro Powder', 2]],
  ];
  const delivered = [];
  for (const [i, basket] of baskets.entries()) {
    const order = await place(customers[i % 3], basket);
    await toReady(order);
    clock.advance(20 * HOUR);
    const { pickup_code: code } = await db('orders').where({ id: order.id }).first();
    await orders.handOver(order.id, code, staff.pickup);
    delivered.push(order);
    clock.advance(4 * HOUR);
  }
  // Pay out the older half so those orders become "completed".
  const oldPayouts = await db('payouts').whereIn('order_id', delivered.slice(0, 7).map((o) => o.id)).pluck('id');
  await markPayoutsPaid(oldPayouts, staff.admin, 'TELEBIRR-SEED-BATCH-1');

  // An order where one item failed the quality check (refunded), the rest was collected.
  const partial = await place(users.yonas, [['Tilet Table Runner', 1], ['Netela', 1]]);
  await pay(partial); clock.advance(3 * HOUR);
  const [badItem, goodItem] = await db('order_items').where({ order_id: partial.id }).orderBy('id');
  await orders.rejectItem(badItem.id, staff.warehouse, 'Torn fabric on one edge');
  await orders.receiveItem(goodItem.id, staff.warehouse);
  await orders.packOrder(partial.id, staff.warehouse);
  await orders.sendToPickup(partial.id, staff.warehouse);
  clock.advance(DAY);
  await orders.handOver(partial.id, (await db('orders').where({ id: partial.id }).first()).pickup_code, staff.pickup);

  // An order that was never collected: expired, refunded, item waiting to go back to the vendor.
  const expired = await place(users.liya, [['Electric Mitad', 1]]);
  await toReady(expired);
  clock.advance(8 * DAY);
  await orders.expireOrder(expired.id);

  // An order the vendor never dropped off (cancelled automatically).
  clock.reset();
  clock.advance(-4 * DAY);
  const missed = await place(users.sara, [['Harar', 1]]);
  await pay(missed);
  clock.reset();
  await orders.processDeadlines();

  // ---- Orders happening "now" ----
  clock.reset();
  clock.advance(-30 * HOUR);
  const waitingOld = await place(users.yonas, [['Sidamo', 2], ['Berbere', 1]]); // one item already received
  await pay(waitingOld);
  clock.reset();
  clock.advance(-3 * HOUR);
  const waiting = await place(users.liya, [['Power Bank', 1], ['Clay Jebena', 2]]);
  await pay(waiting);
  clock.reset();
  const [firstItem] = await db('order_items').where({ order_id: waitingOld.id }).orderBy('id');
  await orders.receiveItem(firstItem.id, staff.warehouse);

  clock.advance(-20 * HOUR);
  const toPack = await place(users.sara, [['Netela', 2]]);
  await pay(toPack); clock.advance(4 * HOUR); await receiveAll(toPack);
  const packed = await place(users.yonas, [['Bluetooth Earbuds', 1]]);
  await pay(packed); clock.advance(4 * HOUR); await receiveAll(packed); await orders.packOrder(packed.id, staff.warehouse);
  const ready1 = await place(users.liya, [['Yirgacheffe', 1], ['Sini Coffee', 1]]);
  await toReady(ready1);
  const ready2 = await place(users.yonas, [['Mitmita', 1]]);
  await toReady(ready2);
  clock.reset();
  await place(users.sara, [['Shea Butter', 1]]); // not paid yet

  await db('sms_log').delete(); // start with a clean SMS log
  const codes = await db('orders').where({ status: 'ready_for_pickup' }).join('users', 'users.id', 'orders.customer_id')
    .select('orders.order_number', 'orders.pickup_code', 'users.name');

  console.log('\n✅ Sample data ready. All passwords:', PASSWORD);
  console.table(USERS.map((u) => ({ role: u.role, name: u.name, phone: u.phone.replace('+251', '0') })));
  console.log('Orders ready for pickup (use these codes on the pickup screen):');
  console.table(codes);
}

run()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => db.destroy());
