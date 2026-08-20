import { Router } from 'express';
import { db, mapOrder, transaction } from '../db.js';
import { requireAuth, requireStaff, optionalAuth } from '../middleware/auth.js';
import { transition } from '../lib/orders.js';

const router = Router();

const SHIPPING_FLAT = 9.0;
const FREE_SHIPPING_FROM = 150;

function cartToken(req) {
  return req.headers['x-cart-token'] || null;
}

function orderRef() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SN-${stamp}-${rand}`;
}

/** Public order lookup by order ref + email (order tracking). */
router.post('/track', (req, res) => {
  const { order_ref, email } = req.body || {};
  const ref = String(order_ref || '').trim().toUpperCase();
  const mail = String(email || '').trim().toLowerCase();
  if (!ref || !mail) return res.status(400).json({ error: 'Order reference and email are required' });
  const order = db.prepare('SELECT * FROM orders WHERE order_number = ? AND customer_email = ?').get(ref, mail);
  if (!order) return res.status(404).json({ error: 'No order found for that reference and email' });
  res.json({ order: mapOrder(order, { items: true, history: true }) });
});

/** Place an order: validate availability, persist atomically, clear cart. */
router.post('/', optionalAuth, (req, res) => {
  const token = cartToken(req);
  if (!token) return res.status(400).json({ error: 'Cart token is required' });

  const { name, email, address, city, zip, country, phone } = req.body || {};
  if (![name, email, address, city, zip, country].every((v) => String(v ?? '').trim())) {
    return res.status(400).json({ error: 'Please complete every shipping field' });
  }

  const cart = db.prepare('SELECT id FROM carts WHERE token = ?').get(token);
  if (!cart) return res.status(400).json({ error: 'Your cart is empty' });

  const rows = db
    .prepare(
      `SELECT ci.id AS cart_item_id, ci.variant_id, ci.customization_id, ci.quantity, ci.unit_price,
              v.size, v.color, v.sku, v.stock_quantity,
              p.id AS product_id, p.name, p.slug, p.category
       FROM cart_items ci
       JOIN product_variants v ON v.id = ci.variant_id
       JOIN products p ON p.id = v.product_id
       WHERE ci.cart_id = ?
       ORDER BY ci.created_at ASC`
    )
    .all(cart.id);

  if (!rows.length) return res.status(400).json({ error: 'Your cart is empty' });

  // Reserve counts from OTHER carts so two checkouts can't over-sell.
  for (const row of rows) {
    const reserved = db
      .prepare(
        `SELECT COALESCE(SUM(quantity), 0) AS r FROM cart_items
         WHERE variant_id = ? AND cart_id != ?`
      )
      .get(row.variant_id, cart.id).r;
    if (row.quantity > row.stock_quantity - reserved) {
      return res.status(409).json({
        error: `Only ${Math.max(0, row.stock_quantity - reserved)} left of ${row.name} (${row.size}${row.color ? ` / ${row.color}` : ''}). Please adjust your cart.`,
      });
    }
  }

  const subtotal = rows.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const shipping = subtotal >= FREE_SHIPPING_FROM || subtotal === 0 ? 0 : SHIPPING_FLAT;
  const total = subtotal + shipping;
  const ref = orderRef();

  const insertOrder = () => transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO orders
         (order_number, user_id, shipping_name, shipping_phone, shipping_address, shipping_city, shipping_zip, shipping_country, customer_email, subtotal, shipping_cost, discount, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
      )
      .run(
        ref,
        req.user?.id ?? null,
        String(name).trim(),
        String(phone || '').trim(),
        String(address).trim(),
        String(city).trim(),
        String(zip).trim(),
        String(country).trim(),
        String(email).trim().toLowerCase(),
        subtotal,
        shipping,
        total
      );
    const orderId = Number(info.lastInsertRowid);

    const insertItem = db.prepare(
      `INSERT INTO order_items
       (order_id, variant_id, customization_id, product_name_snapshot, variant_snapshot, quantity, unit_price, total_price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const row of rows) {
      insertItem.run(
        orderId,
        row.variant_id,
        row.customization_id,
        row.name,
        JSON.stringify({ product_id: row.product_id, size: row.size, color: row.color, sku: row.sku }),
        row.quantity,
        row.unit_price,
        row.unit_price * row.quantity
      );
      db.prepare('UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?').run(row.quantity, row.variant_id);
      db.prepare(
        `INSERT INTO inventory_movements (variant_id, type, quantity, reference_id, note)
         VALUES (?, 'SALE', ?, ?, ?)`
      ).run(row.variant_id, -row.quantity, ref, `${row.name} ${row.size}${row.color ? ` / ${row.color}` : ''}`);
      if (row.customization_id) {
        db.prepare('UPDATE customizations SET status = \'paid\' WHERE id = ? AND status = \'cart\'').run(row.customization_id);
      }
    }

    db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.id);
    db.prepare('DELETE FROM carts WHERE token = ?').run(token);
    return orderId;
  });

  let orderId;
  try {
    orderId = insertOrder();
  } catch (err) {
    console.error('[checkout] failed:', err.message, '\n', err.stack);
    return res.status(500).json({ error: `Order could not be placed. Please try again. (${err.message})` });
  }

  res.status(201).json({ order: mapOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId), { items: true }) });
});

/** Signed-in customers: their own orders (with items). */
router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC')
    .all(req.user.id);
  res.json({ orders: rows.map((r) => mapOrder(r, { items: true })) });
});

/** Admin order search by ref / customer. */
router.get('/search/all', requireStaff, (req, res) => {
  const { q } = req.query || {};
  if (!q) return res.status(400).json({ error: 'Query is required' });
  const like = `%${String(q).toLowerCase()}%`;
  const rows = db
    .prepare(
      `SELECT * FROM orders
       WHERE LOWER(order_ref) LIKE ? OR LOWER(email) LIKE ? OR LOWER(name) LIKE ?
       ORDER BY created_at DESC LIMIT 25`
    )
    .all(like, like, like);
  res.json({ orders: rows.map((r) => mapOrder(r, { items: true })) });
});

/** Customers: own order detail. Staff: any order detail. */
router.get('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const isStaff = ['admin', 'staff'].includes(req.user.role);
  if (!isStaff && order.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Not your order' });
  }
  res.json({ order: mapOrder(order, { items: true, history: isStaff }) });
});

/** Order status transitions (admin). */
router.post('/:id/status', requireStaff, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const { status, note } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status is required' });

  const to = String(status).toUpperCase();
  const result = transition(order, to, note, req.user);
  if (result.error) return res.status(400).json({ error: result.error });

  res.json({ order: mapOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id), { items: true, history: true }) });
});

export default router;
