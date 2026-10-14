// The order lifecycle. This file is the single source of truth for which status can follow which.

export const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'awaiting_dropoff',
  'received_at_warehouse',
  'packed',
  'ready_for_pickup',
  'picked_up',
  'completed',
  'cancelled',
  'expired',
];

const TRANSITIONS = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['awaiting_dropoff', 'cancelled'],
  awaiting_dropoff: ['received_at_warehouse', 'cancelled'],
  received_at_warehouse: ['packed', 'cancelled'],
  packed: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['picked_up', 'expired'],
  picked_up: ['completed'],
  completed: [],
  cancelled: [],
  expired: [],
};

export function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

export function nextStatuses(from) {
  return [...(TRANSITIONS[from] || [])];
}

/** Statuses in which the order is still being worked on (and its pickup code must be unique). */
export const OPEN_STATUSES = ['paid', 'awaiting_dropoff', 'received_at_warehouse', 'packed', 'ready_for_pickup'];

/** Item statuses that still count towards the order (the others have been refunded or cancelled). */
export const ACTIVE_ITEM_STATUSES = ['pending_payment', 'awaiting_dropoff', 'received'];
