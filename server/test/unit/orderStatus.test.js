import { describe, it, expect } from 'vitest';
import { canTransition, ORDER_STATUSES } from '../../src/lib/orderStatus.js';

describe('order status rules', () => {
  it('allows the normal lifecycle in order', () => {
    const path = ['pending_payment', 'paid', 'awaiting_dropoff', 'received_at_warehouse', 'packed', 'ready_for_pickup', 'picked_up', 'completed'];
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });

  it('does not allow skipping steps or going backwards', () => {
    expect(canTransition('paid', 'packed')).toBe(false);
    expect(canTransition('awaiting_dropoff', 'ready_for_pickup')).toBe(false);
    expect(canTransition('packed', 'received_at_warehouse')).toBe(false);
    expect(canTransition('picked_up', 'cancelled')).toBe(false);
    expect(canTransition('pending_payment', 'picked_up')).toBe(false);
  });

  it('only ready orders can expire, and finished orders never change', () => {
    for (const s of ORDER_STATUSES) expect(canTransition(s, 'expired')).toBe(s === 'ready_for_pickup');
    for (const s of ORDER_STATUSES) {
      expect(canTransition('completed', s)).toBe(false);
      expect(canTransition('cancelled', s)).toBe(false);
      expect(canTransition('expired', s)).toBe(false);
    }
  });
});
