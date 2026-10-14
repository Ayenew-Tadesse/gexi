// Admin-configurable settings, stored in the "settings" table with these defaults.
import { db } from '../db/knex.js';

export const DEFAULT_SETTINGS = {
  vendor_pct: 85,
  agent_pct: 5,
  platform_pct: 10,
  dropoff_window_hours: 48,
  pickup_window_days: 7,
  expiry_fee_santim: 0,
  payment_timeout_minutes: 30,
  pickup_reminder_hours_before: 24,
  pickup_location: {
    name: 'Gexi Pickup Point',
    address: 'Bole, near Edna Mall, Addis Ababa',
    hours: 'Mon–Sat, 9:00–19:00',
    map_url: '',
  },
};

export async function getSettings(trx = db) {
  const rows = await trx('settings').select('key', 'value');
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(changes, trx = db) {
  for (const [key, value] of Object.entries(changes)) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    await trx('settings')
      .insert({ key, value: JSON.stringify(value), updated_at: trx.fn.now() })
      .onConflict('key')
      .merge();
  }
  return getSettings(trx);
}

export const PUBLIC_SETTING_KEYS = ['pickup_location', 'pickup_window_days'];
