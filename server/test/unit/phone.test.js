import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../../src/lib/phone.js';

describe('Ethiopian phone numbers', () => {
  it.each([
    ['0911223344', '+251911223344'],
    ['911223344', '+251911223344'],
    ['+251911223344', '+251911223344'],
    ['251911223344', '+251911223344'],
    ['+251 91 122 3344', '+251911223344'],
    ['0711-223-344', '+251711223344'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['', '0811223344', '091122334', '09112233445', '+1 555 123 4567', 'abc', null])('rejects %s', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});
