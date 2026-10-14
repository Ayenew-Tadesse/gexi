import crypto from 'node:crypto';

/** Random 6-digit code such as "042917" (cryptographically random). */
export function sixDigitCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function randomToken(bytes = 12) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function orderNumberFor(id) {
  return `GX-${String(id).padStart(6, '0')}`;
}
