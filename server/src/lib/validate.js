import { badRequest } from './errors.js';

/** Validate data against a zod schema; throws a 400 with readable field errors when invalid. */
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    throw badRequest('validation_error', 'Please check the highlighted fields.', fields);
  }
  return result.data;
}
