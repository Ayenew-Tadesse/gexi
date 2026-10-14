import { db } from '../db/knex.js';

/**
 * Run work inside a database transaction. Things that talk to the outside world (SMS, payment refunds)
 * are queued with after(fn) and only run once the transaction has been saved successfully.
 */
export async function runInTx(work) {
  const afterCommit = [];
  const result = await db.transaction((trx) => work(trx, (fn) => afterCommit.push(fn)));
  for (const fn of afterCommit) {
    try {
      await fn();
    } catch (err) {
      console.error('After-commit task failed:', err);
    }
  }
  return result;
}
