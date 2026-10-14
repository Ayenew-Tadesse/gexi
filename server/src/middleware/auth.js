import { db } from '../db/knex.js';
import { verifySession } from '../services/auth.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export const SESSION_COOKIE = 'gexi_session';

/** Reads the login cookie (if any) and puts the user on req.user. */
export async function loadUser(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = token && verifySession(token);
  if (session) {
    const user = await db('users').where({ id: session.sub }).first();
    if (user && user.is_active) req.user = user;
  }
  next();
}

/** Only logged-in users with one of these roles may continue. Admins may enter every area. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (req.user.role !== 'admin' && !roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

export const requireLogin = (req, _res, next) => (req.user ? next() : next(unauthorized()));
