import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { db } from '../db/knex.js';
import { config } from '../config.js';
import { parse } from '../lib/validate.js';
import { unauthorized } from '../lib/errors.js';
import { SESSION_COOKIE, requireLogin } from '../middleware/auth.js';
import {
  registerCustomer, loginWithPassword, requestOtp, verifyOtp, signSession, publicUser, hashPassword, SESSION_DAYS,
} from '../services/auth.js';
import bcrypt from 'bcryptjs';

const router = Router();

// Slow down password guessing: 20 attempts per 15 minutes per IP.
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, skip: () => config.isTest, standardHeaders: true, legacyHeaders: false });

const lang = z.enum(['en', 'am']);

function setSession(res, user) {
  res.cookie(SESSION_COOKIE, signSession(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

router.post('/register', limiter, async (req, res) => {
  const data = parse(z.object({
    phone: z.string(),
    name: z.string().trim().min(2, 'Please enter your name').max(120),
    password: z.string().min(6, 'Use at least 6 characters').max(100),
    preferred_language: lang.optional(),
  }), req.body);
  const user = await registerCustomer(data);
  setSession(res, user);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', limiter, async (req, res) => {
  const data = parse(z.object({ phone: z.string(), password: z.string().min(1) }), req.body);
  const user = await loginWithPassword(data);
  setSession(res, user);
  res.json({ user: publicUser(user) });
});

router.post('/otp/request', limiter, async (req, res) => {
  const { phone } = parse(z.object({ phone: z.string() }), req.body);
  res.json(await requestOtp(phone));
});

router.post('/otp/verify', limiter, async (req, res) => {
  const data = parse(z.object({ phone: z.string(), code: z.string().min(4).max(8), name: z.string().max(120).optional() }), req.body);
  const user = await verifyOtp(data);
  setSession(res, user);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

router.patch('/me', requireLogin, async (req, res) => {
  const data = parse(z.object({
    name: z.string().trim().min(2).max(120).optional(),
    preferred_language: lang.optional(),
    current_password: z.string().optional(),
    new_password: z.string().min(6, 'Use at least 6 characters').max(100).optional(),
  }), req.body);
  const changes = {};
  if (data.name) changes.name = data.name;
  if (data.preferred_language) changes.preferred_language = data.preferred_language;
  if (data.new_password) {
    // Accounts created by SMS code have no password yet; others must confirm the old one.
    if (req.user.password_hash && !(await bcrypt.compare(data.current_password || '', req.user.password_hash))) {
      throw unauthorized('Your current password is wrong.');
    }
    changes.password_hash = await hashPassword(data.new_password);
  }
  if (Object.keys(changes).length) {
    await db('users').where({ id: req.user.id }).update({ ...changes, updated_at: db.fn.now() });
  }
  const user = await db('users').where({ id: req.user.id }).first();
  res.json({ user: publicUser(user) });
});

export default router;
