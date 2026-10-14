// Ethiopian phone numbers. We accept the common ways people type them and always store +2519XXXXXXXX / +2517XXXXXXXX.
//   0911223344  -> +251911223344
//   911223344   -> +251911223344
//   +251 91 122 3344, 251911223344 -> +251911223344
// Mobile numbers start with 9 (Ethio Telecom) or 7 (Safaricom) and have 9 digits after the country code.

export function normalizePhone(input) {
  if (typeof input !== 'string') return null;
  let digits = input.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith('251')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[79]\d{8}$/.test(digits)) return null;
  return `+251${digits}`;
}

export function isValidPhone(input) {
  return normalizePhone(input) !== null;
}
