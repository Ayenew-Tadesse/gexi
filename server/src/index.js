// Starts the API server and the background timer.
import { config } from './config.js';
import { createApp } from './app.js';
import { startScheduler } from './jobs/scheduler.js';

const app = createApp();
app.listen(config.port, () => {
  console.log(`✅ Gexi API running on http://localhost:${config.port}`);
  console.log(`   Payments: ${config.paymentProvider}  ·  SMS: ${config.smsProvider}  ·  Dev tools: ${config.devTools ? 'on' : 'off'}`);
});
startScheduler();
