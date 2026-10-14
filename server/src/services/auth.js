// Logging in with a phone number, using a password or a one-time SMS code.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/knex.js';
import { config } from '../config.js';
import { clock } from '../lib/clock.js';
import { sixDigitCode, sha256 } from '../lib/codes.js';
import { normalizePhone } from '../lib/phone.js';
import { badRequest, conflict, unauthorized, AppError } from '../lib/errors.js';
import { sendSms } from './sms/index.js';

export const SESSION_DAYS = 30;
const OTP_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_SECONDS = 60;

export const ROLES = ['customer', 'agent', 'warehouse', 'pickup', 'admin'];

export function publicUser(u) {
  return { id: u.id, phone: u.phone, name: u.name, role: u.role, preferred_language: u.preferred_language };
}

export function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export function signSession(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: `${SESSION_DAYS}d` });
}

export function verifySession(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

function requirePhone(raw) {
  const phone = normalizePhone(raw);
  if (!phone) throw badRequest('invalid_phone', 'Enter a valid Ethiopian mobile number, e.g. 0911 223344.', { phone: 'invalid' });
  return phone;
}

export async function registerCustomer({ phone: rawPhone, name, password, preferred_language = 'en' }) {
  const phone = requirePhone(rawPhone);
  const existing = await db('users').where({ phone }).first();
  if (existing) throw conflict('phone_taken', 'An account with this phone number already exists. Please log in.');
  const [user] = await db('users')
    .insert({ phone, name: name.trim(), password_hash: await hashPassword(password), role: 'customer', preferred_language })
    .returning('*');
  return user;
}

export async function loginWithPassword({ phone: rawPhone, password }) {
  const phone = normalizePhone(rawPhone);
  const user = phone && (await db('users').where({ phone }).first());
  const ok = user && user.password_hash && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw unauthorized('Wrong phone number or password.');
  if (!user.is_active) throw unauthorized('This account has been deactivated.');
  return user;
}

/** Send a one-time code by SMS. Returns the code itself only in development, so you can log in without a phone. */
export async function requestOtp(rawPhone) {
  const phone = requirePhone(rawPhone);
  const now = clock.now();
  const recent = await db('otp_codes')
    .where({ phone })
    .where('created_at', '>', new Date(now.getTime() - OTP_RESEND_SECONDS * 1000))
    .first();
  if (recent) throw new AppError(429, 'too_soon', 'Please wait a minute before asking for another code.');
  const code = sixDigitCode();
  await db('otp_codes').insert({ phone, code_hash: sha256(code), expires_at: new Date(now.getTime() + OTP_MINUTES * 60_000), created_at: now });
  const user = await db('users').where({ phone }).first();
  await sendSms({ to: phone, template: 'otp', vars: { code }, lang: user?.preferred_language || 'en' });
  return { phone, devCode: config.devTools && config.smsProvider === 'console' ? code : undefined };
}

/** Check a one-time code. A new phone number gets a customer account automatically. */
export async function verifyOtp({ phone: rawPhone, code, name }) {
  const phone = requirePhone(rawPhone);
  const now = clock.now();
  const otp = await db('otp_codes').where({ phone }).whereNull('used_at').where('expires_at', '>', now).orderBy('id', 'desc').first();
  if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS) throw unauthorized('This code has expired. Please request a new one.');
  if (otp.code_hash !== sha256(String(code).trim())) {
    await db('otp_codes').where({ id: otp.id }).increment('attempts', 1);
    throw unauthorized('Wrong code. Please try again.');
  }
  await db('otp_codes').where({ id: otp.id }).update({ used_at: now });
  let user = await db('users').where({ phone }).first();
  if (!user) {
    [user] = await db('users').insert({ phone, name: (name || '').trim(), role: 'customer' }).returning('*');
  }
  if (!user.is_active) throw unauthorized('This account has been deactivated.');
  return user;
}
