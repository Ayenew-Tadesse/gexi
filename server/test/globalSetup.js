// Before all tests: rebuild the test database from scratch.
export async function setup() {
  process.env.NODE_ENV = 'test';
  const { migrateLatest } = await import('../src/db/migrate.js');
  const { db } = await import('../src/db/knex.js');
  await migrateLatest({ reset: true });
  await db.destroy();
}
