// Product photos are stored in the database. This keeps them safe on hosts that wipe their disk
// on every restart (like Render's free plan). Each photo is small (a few KB as WebP).
// Later, for very large catalogues, this can move to cloud storage without changing the screens.

export async function up(knex) {
  await knex.schema.createTable('stored_files', (t) => {
    t.string('path', 200).primary(); // e.g. products/abc123-small.webp
    t.string('content_type', 60).notNullable();
    t.binary('data').notNullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('stored_files');
}
