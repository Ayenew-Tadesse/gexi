import { badRequest } from './errors.js';

export function idParam(req, name = 'id') {
  const id = Number(req.params[name]);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('invalid_id', 'Invalid id.');
  return id;
}

export function pageParams(query, defaultSize = 20) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || defaultSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/** Run a knex query for one page plus a total count. */
export async function paginate(query, { page, pageSize, offset }) {
  const countQuery = query.clone().clearSelect().clearOrder().count('* as count');
  const [{ count }] = await countQuery;
  const items = await query.limit(pageSize).offset(offset);
  return { items, page, pageSize, total: Number(count) };
}

/** Escape % and _ so user text is matched literally in LIKE searches. */
export function likeTerm(text) {
  return `%${String(text).replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}
