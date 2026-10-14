// Initial database structure. Money is always stored in santim (1 ETB = 100 santim).

export async function up(knex) {
  await knex.schema.createTable('users', (t) => {
    t.increments('id');
    t.string('phone', 16).notNullable().unique(); // +2519XXXXXXXX
    t.string('name', 120).notNullable().defaultTo('');
    t.string('password_hash');
    t.string('role', 16).notNullable().defaultTo('customer'); // customer | agent | warehouse | pickup | admin
    t.string('preferred_language', 5).notNullable().defaultTo('en');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('otp_codes', (t) => {
    t.increments('id');
    t.string('phone', 16).notNullable().index();
    t.string('code_hash').notNullable();
    t.timestamp('expires_at').notNullable();
    t.integer('attempts').notNullable().defaultTo(0);
    t.timestamp('used_at');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('agent_profiles', (t) => {
    t.integer('user_id').primary().references('users.id').onDelete('CASCADE');
    t.decimal('commission_pct', 5, 2); // optional override of the global agent %
    t.string('payout_method', 30);
    t.string('payout_account', 80);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('vendors', (t) => {
    t.increments('id');
    t.integer('agent_id').notNullable().references('users.id').index();
    t.string('name', 120).notNullable();
    t.string('phone', 16).notNullable();
    t.string('location_description', 255).notNullable().defaultTo('');
    t.string('payout_method', 30);
    t.string('payout_account', 80);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('categories', (t) => {
    t.increments('id');
    t.string('slug', 60).notNullable().unique();
    t.string('name_en', 80).notNullable();
    t.string('name_am', 80).notNullable().defaultTo('');
    t.integer('sort_order').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('products', (t) => {
    t.increments('id');
    t.integer('vendor_id').notNullable().references('vendors.id').index();
    t.integer('agent_id').notNullable().references('users.id').index();
    t.integer('category_id').references('categories.id').index();
    t.string('title_en', 160).notNullable();
    t.string('title_am', 160).notNullable().defaultTo('');
    t.text('description_en').notNullable().defaultTo('');
    t.text('description_am').notNullable().defaultTo('');
    t.integer('price_santim').notNullable();
    t.integer('stock_qty').notNullable().defaultTo(0);
    t.string('status', 12).notNullable().defaultTo('active'); // draft | active | hidden
    t.timestamps(true, true);
  });
  await knex.raw('ALTER TABLE products ADD CONSTRAINT products_price_positive CHECK (price_santim > 0)');
  await knex.raw('ALTER TABLE products ADD CONSTRAINT products_stock_nonneg CHECK (stock_qty >= 0)');

  await knex.schema.createTable('product_images', (t) => {
    t.increments('id');
    t.integer('product_id').notNullable().references('products.id').onDelete('CASCADE').index();
    t.string('small_url').notNullable();
    t.string('medium_url').notNullable();
    t.string('large_url').notNullable();
    t.integer('sort_order').notNullable().defaultTo(0);
  });

  await knex.schema.createTable('orders', (t) => {
    t.increments('id');
    t.string('order_number', 20).unique();
    t.integer('customer_id').notNullable().references('users.id').index();
    t.string('status', 24).notNullable().index();
    t.integer('total_santim').notNullable();
    t.string('pickup_code', 6);
    t.timestamp('paid_at');
    t.timestamp('dropoff_deadline');
    t.timestamp('ready_at');
    t.timestamp('pickup_deadline');
    t.timestamp('pickup_reminder_sent_at');
    t.timestamp('picked_up_at');
    t.timestamp('closed_at'); // completed, cancelled or expired
    t.timestamps(true, true);
  });
  // A pickup code is unique among orders that are still open.
  await knex.raw(`CREATE UNIQUE INDEX orders_open_pickup_code ON orders (pickup_code)
    WHERE status IN ('paid','awaiting_dropoff','received_at_warehouse','packed','ready_for_pickup')`);

  await knex.schema.createTable('order_items', (t) => {
    t.increments('id');
    t.integer('order_id').notNullable().references('orders.id').onDelete('CASCADE').index();
    t.integer('product_id').notNullable().references('products.id');
    t.integer('vendor_id').notNullable().references('vendors.id').index();
    t.integer('agent_id').notNullable().references('users.id').index();
    t.string('title', 160).notNullable(); // copied so the order still reads correctly if the listing changes
    t.integer('quantity').notNullable();
    t.integer('unit_price_santim').notNullable();
    t.integer('line_total_santim').notNullable();
    // Split, copied at checkout. vendor + agent + platform = line total.
    t.decimal('agent_pct', 5, 2).notNullable();
    t.decimal('platform_pct', 5, 2).notNullable();
    t.integer('vendor_amount_santim').notNullable();
    t.integer('agent_commission_santim').notNullable();
    t.integer('platform_fee_santim').notNullable();
    // pending_payment | awaiting_dropoff | received | rejected | missed_dropoff | cancelled | return_pending | returned_to_vendor
    t.string('item_status', 20).notNullable();
    t.string('rejection_reason', 255);
    t.timestamp('received_at');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('order_status_history', (t) => {
    t.increments('id');
    t.integer('order_id').notNullable().references('orders.id').onDelete('CASCADE').index();
    t.integer('order_item_id').references('order_items.id').onDelete('CASCADE');
    t.string('from_status', 24);
    t.string('to_status', 24).notNullable();
    t.integer('changed_by').references('users.id'); // null = system (background timer)
    t.string('note', 255);
    t.timestamp('created_at').notNullable();
  });

  await knex.schema.createTable('payments', (t) => {
    t.increments('id');
    t.integer('order_id').notNullable().references('orders.id').onDelete('CASCADE').index();
    t.string('provider', 12).notNullable();
    t.string('tx_ref', 64).notNullable().unique();
    t.integer('amount_santim').notNullable();
    t.string('status', 12).notNullable().defaultTo('pending'); // pending | success | failed
    t.string('provider_reference', 80);
    t.string('checkout_url', 500);
    t.jsonb('raw_response');
    t.timestamp('verified_at');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('refunds', (t) => {
    t.increments('id');
    t.integer('order_id').notNullable().references('orders.id').onDelete('CASCADE').index();
    t.integer('order_item_id').references('order_items.id').onDelete('CASCADE');
    t.integer('amount_santim').notNullable();
    t.integer('fee_santim').notNullable().defaultTo(0);
    t.string('reason', 40).notNullable(); // rejected | missed_dropoff | expired | cancelled_by_admin
    t.string('status', 12).notNullable().defaultTo('pending'); // pending | processed | failed
    t.string('provider_reference', 120);
    t.string('note', 255);
    t.integer('processed_by').references('users.id');
    t.timestamp('processed_at');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('payouts', (t) => {
    t.increments('id');
    t.string('payee_type', 8).notNullable(); // vendor | agent
    t.integer('payee_id').notNullable(); // vendors.id or users.id
    t.integer('order_id').notNullable().references('orders.id').index();
    t.integer('order_item_id').notNullable().references('order_items.id');
    t.integer('amount_santim').notNullable();
    t.string('status', 8).notNullable().defaultTo('due'); // due | paid
    t.string('reference', 120);
    t.integer('paid_by').references('users.id');
    t.timestamp('paid_at');
    t.timestamps(true, true);
    t.unique(['payee_type', 'order_item_id']);
    t.index(['payee_type', 'payee_id', 'status']);
  });

  await knex.schema.createTable('settings', (t) => {
    t.string('key', 60).primary();
    t.jsonb('value').notNullable();
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('sms_log', (t) => {
    t.increments('id');
    t.string('to_phone', 16).notNullable().index();
    t.string('template', 40).notNullable();
    t.text('message').notNullable();
    t.string('provider', 20).notNullable();
    t.string('status', 12).notNullable(); // sent | failed
    t.string('error', 255);
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  for (const table of [
    'sms_log', 'settings', 'payouts', 'refunds', 'payments', 'order_status_history', 'order_items',
    'orders', 'product_images', 'products', 'categories', 'vendors', 'agent_profiles', 'otp_codes', 'users',
  ]) {
    await knex.schema.dropTableIfExists(table);
  }
}
