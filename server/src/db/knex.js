import knexFactory from 'knex';
import { config } from '../config.js';

export const db = knexFactory({
  client: 'pg',
  connection: config.databaseUrl,
  pool: { min: 0, max: 10 },
});
