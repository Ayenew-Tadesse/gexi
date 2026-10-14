// Talking to the server. Every call returns JSON or throws an ApiError with a readable message.
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || 'Something went wrong. Please try again.');
    this.status = status;
    this.code = body?.error?.code;
    this.details = body?.error?.details;
  }
}

const TIMEOUT_MS = 30_000; // generous, for slow mobile connections

export async function api(path, { method = 'GET', body, form } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: form || (body !== undefined ? JSON.stringify(body) : undefined),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, { error: { code: 'network', message: 'No connection. Check your internet and try again.' } });
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const get = (path) => api(path);
export const post = (path, body = {}) => api(path, { method: 'POST', body });
export const patch = (path, body) => api(path, { method: 'PATCH', body });
export const put = (path, body) => api(path, { method: 'PUT', body });
export const del = (path) => api(path, { method: 'DELETE' });

/** Build a query string, skipping empty values. */
export function qs(params) {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  return s ? `?${s}` : '';
}
