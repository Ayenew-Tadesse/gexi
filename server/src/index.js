// Starts the API server and the background timer.
// On start it brings the database tables up to date, and in demo mode it loads sample data into an empty database.
import { config } from './config.js';
import { db } from './db/knex.js';
import { migrateLatest } from './db/migrate.js';
import { createApp } from './app.js';
import { startScheduler } from './jobs/scheduler.js';

await migrateLatest();
if (config.demoMode) {
  const { count } = await db('users').count('* as count').first();
  if (Number(count) === 0) {
    console.log('Empty database in demo mode: loading sample data…');
    const { seedDemoData } = await import('./db/seeds/seed.js');
    await seedDemoData({ reset: false });
  }
}

const app = createApp();
app.listen(config.port, () => {
  console.log(`✅ Gexi API running on http://localhost:${config.port}`);
  console.log(`   Payments: ${config.paymentProvider}  ·  SMS: ${config.smsProvider}  ·  Dev tools: ${config.devTools ? 'on' : 'off'}${config.demoMode ? '  ·  DEMO MODE' : ''}`);
});
startScheduler();
