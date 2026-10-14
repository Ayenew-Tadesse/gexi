// Brings the database structure up to date. With --reset it wipes everything first.
import { db } from './knex.js';

const migrations = {
  directory: new URL('./migrations/', import.meta.url).pathname,
  loadExtensions: ['.js'],
};

export async function migrateLatest({ reset = false } = {}) {
  if (reset) await db.migrate.rollback(migrations, true);
  await db.migrate.latest(migrations);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const reset = process.argv.includes('--reset');
  migrateLatest({ reset })
    .then(() => console.log(reset ? 'Database reset and migrated.' : 'Database migrated.'))
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(() => db.destroy());
}
