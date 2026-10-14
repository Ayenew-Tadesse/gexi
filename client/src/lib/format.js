// Formatting money and dates for display. Times are shown in Addis Ababa time.
export function birr(santim) {
  const value = (santim || 0) / 100;
  const hasCents = Math.round(value * 100) % 100 !== 0;
  return `ETB ${value.toLocaleString('en-US', { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 })}`;
}

const TZ = 'Africa/Addis_Ababa';

export function dateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function dateOnly(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
}

/** "in 5h" / "3h ago" style relative time (for deadlines). */
export function relative(value, now = Date.now()) {
  if (!value) return '';
  const diff = new Date(value).getTime() - now;
  const abs = Math.abs(diff);
  const hours = Math.round(abs / 3_600_000);
  const text = abs < 3_600_000 ? `${Math.max(1, Math.round(abs / 60_000))}m` : hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`;
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

/** Show +251911223344 as 0911 223 344 */
export function phone(value) {
  if (!value) return '';
  const local = value.replace('+251', '0');
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

/** Turn a birr amount typed by a person ("1,250.50") into santim. */
export function toSantim(text) {
  const n = Number(String(text).replace(/,/g, '').trim());
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
