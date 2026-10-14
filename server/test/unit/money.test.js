import { describe, it, expect } from 'vitest';
import { splitSale, resolveSplit, expiryRefund, birrToSantim, santimToBirrString } from '../../src/lib/money.js';

describe('money split', () => {
  it('splits 1,000 ETB into 85/5/10', () => {
    expect(splitSale(100000, 5, 10)).toEqual({ vendor: 85000, agent: 5000, platform: 10000 });
  });

  it('always adds up exactly, even with awkward amounts', () => {
    for (const total of [1, 7, 99, 333, 12345, 999999, 65000]) {
      for (const [a, p] of [[5, 10], [6, 9], [2.5, 7.5], [3.33, 11.11], [0, 0], [0, 100]]) {
        const s = splitSale(total, a, p);
        expect(s.vendor + s.agent + s.platform).toBe(total);
        expect(Math.min(s.vendor, s.agent, s.platform)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('rounds agent and platform down, vendor gets the remainder', () => {
    // 3.33 ETB: agent 5% = 16.65 santim -> 16, platform 10% = 33.3 -> 33, vendor 284
    expect(splitSale(333, 5, 10)).toEqual({ vendor: 284, agent: 16, platform: 33 });
  });

  it('rejects invalid input', () => {
    expect(() => splitSale(100, 60, 50)).toThrow();
    expect(() => splitSale(10.5, 5, 10)).toThrow();
    expect(() => splitSale(-1, 5, 10)).toThrow();
  });

  it('applies an agent override, platform takes the rest', () => {
    const settings = { vendor_pct: 85, agent_pct: 5, platform_pct: 10 };
    expect(resolveSplit(settings, null)).toEqual({ vendorPct: 85, agentPct: 5, platformPct: 10 });
    expect(resolveSplit(settings, '7.50')).toEqual({ vendorPct: 85, agentPct: 7.5, platformPct: 7.5 });
    expect(() => resolveSplit(settings, 20)).toThrow();
  });
});

describe('expiry refund', () => {
  it('refunds the paid amount minus the fee', () => {
    expect(expiryRefund(50000, 5000)).toEqual({ refund: 45000, fee: 5000 });
  });
  it('never refunds less than zero', () => {
    expect(expiryRefund(3000, 5000)).toEqual({ refund: 0, fee: 3000 });
  });
  it('with no fee refunds everything', () => {
    expect(expiryRefund(50000, 0)).toEqual({ refund: 50000, fee: 0 });
  });
});

describe('birr conversion', () => {
  it('converts both ways', () => {
    expect(birrToSantim('1,234.50')).toBe(123450);
    expect(birrToSantim(0.1 + 0.2)).toBe(30);
    expect(birrToSantim('abc')).toBeNull();
    expect(santimToBirrString(123450)).toBe('1234.50');
  });
});
