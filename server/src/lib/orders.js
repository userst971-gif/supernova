import { db } from '../db.js';
import { audit } from './http.js';

export const SHIPPING_FLAT = 9.0;
export const FREE_SHIPPING_FROM = 150;

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'IN_PRODUCTION',
  'PRINTING',
  'QUALITY_CHECK',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];

export const PRODUCTION_COLUMNS = ['CONFIRMED', 'IN_PRODUCTION', 'PRINTING', 'QUALITY_CHECK', 'PACKED'];

/** Allowed forward transitions. Cancellation is allowed from any active stage;
 *  CANCELLED/REFUNDED/DELIVERED are terminal except DELIVERED→REFUNDED. */
const TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PRODUCTION', 'CANCELLED'],
  IN_PRODUCTION: ['PRINTING', 'CANCELLED'],
  PRINTING: ['QUALITY_CHECK', 'CANCELLED'],
  QUALITY_CHECK: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

export function isValidTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

export function orderNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SN-${stamp}-${rand}`;
}

/**
 * Moves an order through the state machine, recording status history + audit.
 * Restocks sold variants when an order is cancelled or refunded.
 */
export function transitionOrder({ orderId, from, to, changedBy, note = '' }) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });

  if (!isValidTransition(from, to)) {
    throw Object.assign(
      new Error(`Cannot move an order from ${from} to ${to}.`),
      { status: 400 }
    );
  }

  const dbUpdate = db.prepare(
    'UPDATE orders SET status = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).run(to, orderId);
  if (dbUpdate.changes === 0) throw Object.assign(new Error('Order update failed'), { status: 500 });

  db.prepare(
    `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, note)
     VALUES (?, ?, ?, ?, ?)`
  ).run(orderId, from, to, changedBy?.id ?? null, String(note));

  if (to === 'CANCELLED' || to === 'REFUNDED') {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    for (const item of items) {
      if (!item.variant_id) continue;
      db.prepare(
        'UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?'
      ).run(item.quantity, item.variant_id);
      db.prepare(
        `INSERT INTO inventory_movements (variant_id, type, quantity, reference_id, note, created_by)
         VALUES (?, 'CANCELLED_ORDER', ?, ?, ?, ?)`
      ).run(item.variant_id, item.quantity, order.order_number, `${order.order_number} ${to}`, changedBy?.id ?? null);
    }
  }

  audit(changedBy, 'order_status_changed', 'order', orderId, {
    orderNumber: order.order_number,
    oldStatus: from,
    newStatus: to,
    note,
  });

  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
}

/** Marks an order paid (or failed/refunded) and records it. */
export function setPaymentStatus({ orderId, status, changedBy }) {
  if (!PAYMENT_STATUSES.includes(status)) {
    throw Object.assign(new Error('Invalid payment status.'), { status: 400 });
  }
  const res = db.prepare(
    'UPDATE orders SET payment_status = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).run(status, orderId);
  if (res.changes === 0) throw Object.assign(new Error('Order not found'), { status: 404 });
  audit(changedBy, 'payment_status_changed', 'order', orderId, { status });
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
}

/** Route-friendly wrapper: never throws, returns { error } or { to }. */
export function transition(order, to, note, changedBy) {
  if (!order?.id) return { error: 'Order not found' };
  try {
    const updated = transitionOrder({ orderId: order.id, from: order.status, to, note, changedBy });
    return { to: updated.status };
  } catch (err) {
    return { error: err.status === 404 ? 'Order not found' : err.message };
  }
}
