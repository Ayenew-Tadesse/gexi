// The background timer: every 5 minutes it checks deadlines (unpaid orders, missed drop-offs,
// pickup reminders, uncollected orders) and retries pending refunds.
import { processDeadlines } from '../services/orders.js';

const EVERY_MS = 5 * 60 * 1000;
let running = false;

export async function tick() {
  if (running) return null;
  running = true;
  try {
    const counts = await processDeadlines();
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total > 0) console.log('⏱  Deadline check:', counts);
    return counts;
  } catch (err) {
    console.error('Deadline check failed:', err);
    return null;
  } finally {
    running = false;
  }
}

export function startScheduler() {
  setTimeout(tick, 10_000);
  return setInterval(tick, EVERY_MS);
}
