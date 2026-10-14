// Reports. "Delivered sales" = items handed to customers (order picked up or completed),
// so the numbers match what vendors and agents are owed.
import { db } from '../db/knex.js';

const TZ = 'Africa/Addis_Ababa';

function deliveredItems({ from, to }) {
  const q = db('order_items')
    .join('orders', 'orders.id', 'order_items.order_id')
    .whereIn('orders.status', ['picked_up', 'completed'])
    .where('order_items.item_status', 'received');
  if (from) q.where('orders.picked_up_at', '>=', from);
  if (to) q.where('orders.picked_up_at', '<', to);
  return q;
}

const moneyColumns = [
  db.raw('count(distinct orders.id)::int as orders'),
  db.raw('coalesce(sum(order_items.quantity), 0)::int as units'),
  db.raw('coalesce(sum(order_items.line_total_santim), 0)::bigint as sales_santim'),
  db.raw('coalesce(sum(order_items.vendor_amount_santim), 0)::bigint as vendor_santim'),
  db.raw('coalesce(sum(order_items.agent_commission_santim), 0)::bigint as agent_santim'),
  db.raw('coalesce(sum(order_items.platform_fee_santim), 0)::bigint as platform_santim'),
];

function toNumbers(rows) {
  return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, /_santim$|^orders$|^units$/.test(k) ? Number(v) : v])));
}

export async function salesByPeriod({ from, to, group = 'day' }) {
  const unit = group === 'month' ? 'month' : 'day';
  const period = db.raw(`to_char(date_trunc('${unit}', orders.picked_up_at at time zone '${TZ}'), '${unit === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD'}')`);
  const rows = await deliveredItems({ from, to }).select(db.raw(`${period.toQuery()} as period`), ...moneyColumns).groupByRaw('1').orderByRaw('1');
  return toNumbers(rows);
}

export async function salesByAgent(range) {
  const rows = await deliveredItems(range).join('users', 'users.id', 'order_items.agent_id')
    .select('users.id as agent_id', 'users.name as agent_name', 'users.phone as agent_phone', ...moneyColumns)
    .groupBy('users.id').orderBy('sales_santim', 'desc');
  return toNumbers(rows);
}

export async function salesByVendor(range) {
  const rows = await deliveredItems(range).join('vendors', 'vendors.id', 'order_items.vendor_id')
    .select('vendors.id as vendor_id', 'vendors.name as vendor_name', 'vendors.phone as vendor_phone', ...moneyColumns)
    .groupBy('vendors.id').orderBy('sales_santim', 'desc');
  return toNumbers(rows);
}

export async function salesByCategory(range) {
  const rows = await deliveredItems(range).join('products', 'products.id', 'order_items.product_id')
    .leftJoin('categories', 'categories.id', 'products.category_id')
    .select(db.raw("coalesce(categories.name_en, 'Uncategorised') as category"), ...moneyColumns)
    .groupByRaw('1').orderBy('sales_santim', 'desc');
  return toNumbers(rows);
}

export async function overview() {
  const [statusRows, [refunds], [payouts], [totals], [today]] = await Promise.all([
    db('orders').select('status').count('* as n').groupBy('status'),
    db('refunds').where({ status: 'pending' }).select(db.raw('count(*)::int as count'), db.raw('coalesce(sum(amount_santim),0)::bigint as amount')),
    db('payouts').where({ status: 'due' }).select(db.raw('count(*)::int as count'), db.raw('coalesce(sum(amount_santim),0)::bigint as amount')),
    deliveredItems({}).select(...moneyColumns),
    db('orders').whereNotNull('paid_at')
      .whereRaw(`(paid_at at time zone '${TZ}')::date = (now() at time zone '${TZ}')::date`)
      .select(db.raw('count(*)::int as orders'), db.raw('coalesce(sum(total_santim),0)::bigint as amount')),
  ]);
  return {
    ordersByStatus: Object.fromEntries(statusRows.map((r) => [r.status, Number(r.n)])),
    pendingRefunds: { count: refunds.count, amount_santim: Number(refunds.amount) },
    payoutsDue: { count: payouts.count, amount_santim: Number(payouts.amount) },
    delivered: toNumbers([totals])[0],
    paidToday: { orders: today.orders, amount_santim: Number(today.amount) },
  };
}

/** Turn rows into CSV text (amounts in birr, for spreadsheets). */
export function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]).map((h) => h.replace(/_santim$/, '_etb'));
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) => Object.entries(r).map(([k, v]) => escape(/_santim$/.test(k) ? (Number(v) / 100).toFixed(2) : v)).join(','));
  return [headers.join(','), ...lines].join('\n');
}
