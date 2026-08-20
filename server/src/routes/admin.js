import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, mapOrder, mapVariant, mapUser } from '../db.js';
import { requireAuth, requireStaff, requireAdmin } from '../middleware/auth.js';
import { audit } from '../lib/http.js';
import { transition } from '../lib/orders.js';

const router = Router();
router.use(requireAuth, requireStaff);

/* ---------------------------------------------------------------------------
 * Analytics
 * ------------------------------------------------------------------------- */

router.get('/analytics', (req, res) => {
  const totals = db.prepare(
    `SELECT COUNT(*) AS orders,
            COALESCE(SUM(total), 0) AS revenue,
            COUNT(DISTINCT user_id) AS customers
     FROM orders WHERE status != 'CANCELLED'`
  ).get();
  const paid = db.prepare(
    `SELECT COALESCE(SUM(total), 0) AS revenue FROM orders WHERE payment_status = 'PAID'`
  ).get();
  const newCustomers = db.prepare(
    `SELECT COUNT(*) AS count FROM users WHERE role = 'customer' AND created_at >= datetime('now', '-30 days')`
  ).get().count;
  const pending = db.prepare(`SELECT COUNT(*) AS count FROM orders WHERE status = 'PENDING'`).get().count;
  const revenueTrend = db.prepare(
    `SELECT date(created_at) AS day, SUM(total) AS revenue, COUNT(*) AS orders
     FROM orders WHERE status != 'CANCELLED'
     GROUP BY day ORDER BY day DESC LIMIT 14`
  ).all();

  const topProducts = db.prepare(
    `SELECT product_name_snapshot AS name, SUM(quantity) AS units, SUM(total_price) AS revenue
     FROM order_items GROUP BY product_name_snapshot ORDER BY revenue DESC LIMIT 8`
  ).all();
  const topVariants = db.prepare(
    `SELECT oi.variant_snapshot, v.sku, v.size, v.color, v.product_id, p.name AS product_name,
            SUM(oi.quantity) AS units, SUM(oi.total_price) AS revenue
     FROM order_items oi
     LEFT JOIN product_variants v ON v.id = oi.variant_id
     LEFT JOIN products p ON p.id = v.product_id
     GROUP BY oi.variant_snapshot ORDER BY revenue DESC LIMIT 8`
  ).all();

  const variants = db.prepare(
    `SELECT v.*, (SELECT COALESCE(SUM(quantity), 0) FROM cart_items ci WHERE ci.variant_id = v.id) AS reserved
     FROM product_variants v`
  ).all();
  const inventory = {
    total: variants.length,
    out_of_stock: variants.filter((v) => v.stock_quantity <= 0).length,
    low_stock: variants.filter((v) => v.stock_quantity > 0 && v.stock_quantity <= v.low_stock_threshold).length,
    in_stock: variants.filter((v) => v.stock_quantity > v.low_stock_threshold).length,
    low_stock_items: variants
      .filter((v) => v.stock_quantity > 0 && v.stock_quantity <= v.low_stock_threshold)
      .sort((a, b) => a.stock_quantity - b.stock_quantity)
      .slice(0, 10)
      .map((v) => ({ id: v.id, sku: v.sku, size: v.size, color: v.color, stock_quantity: v.stock_quantity })),
  };

  res.json({
    totals: {
      orders: totals.orders,
      revenue: totals.revenue,
      paid_revenue: paid.revenue,
      aov: totals.orders ? Math.round((totals.revenue / totals.orders) * 100) / 100 : 0,
      customers: totals.customers,
      new_customers_30d: newCustomers,
      pending_orders: pending,
    },
    revenue_trend: revenueTrend,
    top_products: topProducts,
    top_variants: topVariants,
    inventory,
  });
});

/* ---------------------------------------------------------------------------
 * Orders management
 * ------------------------------------------------------------------------- */

router.get('/orders', (req, res) => {
  const { status, payment_status, search, page = 1, limit = 20 } = req.query;
  const where = [];
  const params = [];
  if (status && status !== 'all') {
    where.push('status = ?');
    params.push(String(status).toUpperCase());
  }
  if (payment_status && payment_status !== 'all') {
    where.push('payment_status = ?');
    params.push(String(payment_status).toUpperCase());
  }
  if (search) {
    const like = `%${String(search).toLowerCase()}%`;
    where.push('(LOWER(order_number) LIKE ? OR LOWER(customer_email) LIKE ? OR LOWER(shipping_name) LIKE ?)');
    params.push(like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const per = Math.min(100, Math.max(1, Number(limit) || 20));
  const off = (Math.max(1, Number(page) || 1) - 1) * per;

  const rows = db.prepare(
    `SELECT * FROM orders ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
  ).all(...params, per, off);
  const total = db.prepare(`SELECT COUNT(*) AS count FROM orders ${whereSql}`).all(...params)[0].count;

  res.json({
    orders: rows.map((r) => mapOrder(r, { items: true })),
    total,
    page: Number(page) || 1,
    limit: per,
  });
});

router.get('/orders/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const detail = mapOrder(order, { items: true, history: true });
  detail.customer = order.user_id
    ? mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(order.user_id))
    : null;
  detail.print_jobs = db.prepare(
    `SELECT * FROM print_jobs WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)`
  ).all(order.id);
  res.json({ order: detail });
});

router.post('/orders/:id/status', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const { status, note } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status is required' });
  const result = transition(order, String(status).toUpperCase(), note, req.user);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ order: mapOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id), { items: true, history: true }) });
});

const PAYMENT_STATUSES = ['PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED'];

router.patch('/orders/:id/payment', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const status = String(req.body?.payment_status || '').toUpperCase();
  if (!PAYMENT_STATUSES.includes(status)) {
    return res.status(400).json({ error: `payment_status must be one of ${PAYMENT_STATUSES.join(', ')}` });
  }
  db.prepare("UPDATE orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ?").run(status, order.id);
  audit(req.user, 'payment_status_changed', 'order', order.id, { from: order.payment_status, to: status });
  res.json({ order: mapOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id), { items: true, history: true }) });
});

/* ---------------------------------------------------------------------------
 * Production (print jobs + batches + size/color matrix)
 * ------------------------------------------------------------------------- */

const JOB_STATUSES = ['QUEUED', 'DESIGN_READY', 'PRINTING', 'PRINTED', 'QUALITY_CHECK', 'COMPLETE', 'FAILED'];
const BATCH_STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETE'];

router.get('/production/jobs', (req, res) => {
  const { status, batch_id, order_id } = req.query;
  const where = [];
  const params = [];
  if (status && status !== 'all') {
    where.push('pj.status = ?');
    params.push(String(status).toUpperCase());
  }
  if (batch_id) {
    where.push('pj.batch_id = ?');
    params.push(Number(batch_id));
  }
  if (order_id) {
    where.push('o.id = ?');
    params.push(Number(order_id));
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(
    `SELECT pj.*, oi.product_name_snapshot, oi.quantity, oi.variant_snapshot,
            v.size, v.color, v.sku,
            o.id AS order_id, o.order_number, o.shipping_name, o.customer_email
     FROM print_jobs pj
     JOIN order_items oi ON oi.id = pj.order_item_id
     LEFT JOIN product_variants v ON v.id = oi.variant_id
     JOIN orders o ON o.id = oi.order_id
     ${whereSql}
     ORDER BY pj.created_at DESC, pj.id DESC LIMIT 500`
  ).all(...params);
  res.json({ jobs: rows });
});

router.post('/production/jobs', (req, res) => {
  const ids = Array.isArray(req.body?.order_item_ids) ? req.body.order_item_ids.map(Number).filter(Boolean) : [];
  if (!ids.length) return res.status(400).json({ error: 'order_item_ids is required' });
  const { batch_id } = req.body || {};
  const created = [];
  for (const orderItemId of ids) {
    const item = db.prepare('SELECT id FROM order_items WHERE id = ?').get(orderItemId);
    if (!item) continue;
    const existing = db.prepare('SELECT * FROM print_jobs WHERE order_item_id = ?').get(orderItemId);
    if (existing) {
      created.push(existing.id);
      continue;
    }
    const info = db.prepare(
      `INSERT INTO print_jobs (order_item_id, batch_id, status) VALUES (?, ?, 'QUEUED')`
    ).run(orderItemId, batch_id ? Number(batch_id) : null);
    created.push(Number(info.lastInsertRowid));
  }
  audit(req.user, 'print_jobs_created', 'print_job', created.join(','), { count: created.length });
  res.status(201).json({ job_ids: created });
});

router.post('/production/jobs/:id/status', (req, res) => {
  const job = db.prepare('SELECT * FROM print_jobs WHERE id = ?').get(Number(req.params.id));
  if (!job) return res.status(404).json({ error: 'Print job not found' });
  const status = String(req.body?.status || '').toUpperCase();
  if (!JOB_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${JOB_STATUSES.join(', ')}` });
  }
  db.prepare("UPDATE print_jobs SET status = ?, notes = ?, updated_at = datetime('now') WHERE id = ?").run(
    status,
    String(req.body?.notes || job.notes || '').slice(0, 500),
    job.id
  );
  audit(req.user, 'print_job_status_changed', 'print_job', job.id, { from: job.status, to: status });
  res.json({ job: db.prepare('SELECT * FROM print_jobs WHERE id = ?').get(job.id) });
});

router.post('/production/batches', (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 120);
  if (!name) return res.status(400).json({ error: 'Batch name is required' });
  const info = db.prepare(
    'INSERT INTO print_batches (name, created_by) VALUES (?, ?)'
  ).run(name, req.user.id);
  const id = Number(info.lastInsertRowid);
  const { job_ids } = req.body || {};
  if (Array.isArray(job_ids)) {
    for (const jid of job_ids.map(Number).filter(Boolean)) {
      db.prepare('UPDATE print_jobs SET batch_id = ? WHERE id = ?').run(id, jid);
    }
  }
  audit(req.user, 'print_batch_created', 'print_batch', id, { name });
  res.status(201).json({ batch: db.prepare('SELECT * FROM print_batches WHERE id = ?').get(id) });
});

router.get('/production/batches', (req, res) => {
  const rows = db.prepare(
    `SELECT b.*,
            (SELECT COUNT(*) FROM print_jobs pj WHERE pj.batch_id = b.id) AS job_count,
            (SELECT COUNT(*) FROM print_jobs pj WHERE pj.batch_id = b.id AND pj.status = 'COMPLETE') AS complete_count
     FROM print_batches b ORDER BY b.created_at DESC LIMIT 100`
  ).all();
  res.json({ batches: rows });
});

router.post('/production/batches/:id/status', (req, res) => {
  const batch = db.prepare('SELECT * FROM print_batches WHERE id = ?').get(Number(req.params.id));
  if (!batch) return res.status(404).json({ error: 'Batch not found' });
  const status = String(req.body?.status || '').toUpperCase();
  if (!BATCH_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${BATCH_STATUSES.join(', ')}` });
  }
  db.prepare('UPDATE print_batches SET status = ? WHERE id = ?').run(status, batch.id);
  audit(req.user, 'print_batch_status_changed', 'print_batch', batch.id, { from: batch.status, to: status });
  res.json({ batch: db.prepare('SELECT * FROM print_batches WHERE id = ?').get(batch.id) });
});

/** Size × color matrix of not-yet-complete ordered quantities. */
router.get('/production/matrix', (req, res) => {
  const rows = db.prepare(
    `SELECT v.size, v.color,
            SUM(CASE WHEN pj.status = 'COMPLETE' THEN 0 ELSE oi.quantity END) AS qty
     FROM order_items oi
     LEFT JOIN product_variants v ON v.id = oi.variant_id
     LEFT JOIN print_jobs pj ON pj.order_item_id = oi.id
     LEFT JOIN orders o ON o.id = oi.order_id
     WHERE o.status NOT IN ('CANCELLED')
     GROUP BY v.size, v.color
     ORDER BY v.size, v.color`
  ).all();
  const colors = [...new Set(rows.map((r) => r.color))];
  const sizes = [...new Set(rows.map((r) => r.size))];
  res.json({ sizes, colors, cells: rows });
});

/* ---------------------------------------------------------------------------
 * Designs management
 * ------------------------------------------------------------------------- */

router.get('/designs', (req, res) => {
  const { search, include_archived } = req.query;
  const where = [];
  const params = [];
  if (include_archived !== 'true') {
    where.push('d.archived = 0');
  }
  if (search) {
    where.push('(d.name LIKE ? OR d.prompt LIKE ? OR LOWER(u.email) LIKE ?)');
    const like = `%${String(search).toLowerCase()}%`;
    params.push(like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(
    `SELECT d.*, u.name AS owner_name, u.email AS owner_email,
            (SELECT COUNT(*) FROM customizations c WHERE c.design_id = d.id) AS customization_count
     FROM designs d LEFT JOIN users u ON u.id = d.user_id
     ${whereSql} ORDER BY d.updated_at DESC LIMIT 300`
  ).all(...params);
  res.json({ designs: rows });
});

router.post('/designs/:id/status', (req, res) => {
  const design = db.prepare('SELECT * FROM designs WHERE id = ?').get(Number(req.params.id));
  if (!design) return res.status(404).json({ error: 'Design not found' });
  const { archived, published } = req.body || {};
  const sets = [];
  const params = [];
  if (archived !== undefined) {
    sets.push('archived = ?');
    params.push(archived === 'true' || archived === 1 || archived === true ? 1 : 0);
  }
  if (published !== undefined) {
    sets.push('published = ?');
    params.push(published === 'true' || published === 1 || published === true ? 1 : 0);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  sets.push("updated_at = datetime('now')");
  params.push(design.id);
  db.prepare(`UPDATE designs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  audit(req.user, 'design_updated', 'design', design.id, req.body);
  res.json({ design: db.prepare('SELECT * FROM designs WHERE id = ?').get(design.id) });
});

/* ---------------------------------------------------------------------------
 * Inventory
 * ------------------------------------------------------------------------- */

router.get('/variants', (req, res) => {
  const { status, search, page = 1, limit = 50 } = req.query;
  const per = Math.min(200, Math.max(1, Number(limit) || 50));
  const off = (Math.max(1, Number(page) || 1) - 1) * per;
  const where = [];
  const params = [];
  if (search) {
    where.push('(p.name LIKE ? OR v.sku LIKE ? OR v.color LIKE ? OR v.size LIKE ?)');
    const like = `%${String(search).toLowerCase()}%`;
    params.push(like, like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(
    `SELECT v.*, p.name AS product_name, p.slug AS product_slug,
            (SELECT COALESCE(SUM(quantity), 0) FROM cart_items ci WHERE ci.variant_id = v.id) AS reserved
     FROM product_variants v JOIN products p ON p.id = v.product_id
     ${whereSql} ORDER BY p.name, v.size, v.color LIMIT ? OFFSET ?`
  ).all(...params, per, off);
  const variants = rows.map((r) => {
    const v = mapVariant(r);
    v.product_name = r.product_name;
    v.reserved = Number(r.reserved || 0);
    v.available = Math.max(0, v.stock_quantity - v.reserved);
    v.stock_status = v.stock_quantity <= 0 ? 'OUT_OF_STOCK' : v.stock_quantity <= v.low_stock_threshold ? 'LOW_STOCK' : 'IN_STOCK';
    return v;
  });
  let filtered = variants;
  if (status && status !== 'all') filtered = variants.filter((v) => v.stock_status === status);
  const total = db.prepare(
    `SELECT COUNT(*) AS count FROM product_variants v JOIN products p ON p.id = v.product_id ${whereSql}`
  ).all(...params)[0].count;
  res.json({ variants: filtered, total, page: Number(page) || 1, limit: per });
});

router.get('/variants/:id', (req, res) => {
  const row = db.prepare(
    `SELECT v.*, p.name AS product_name, p.slug AS product_slug
     FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?`
  ).get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Variant not found' });
  const v = mapVariant(row);
  v.product_name = row.product_name;
  v.reserved = Number(db.prepare('SELECT COALESCE(SUM(quantity), 0) AS r FROM cart_items WHERE variant_id = ?').get(v.id).r || 0);
  v.available = Math.max(0, v.stock_quantity - v.reserved);
  v.movements = db
    .prepare('SELECT * FROM inventory_movements WHERE variant_id = ? ORDER BY created_at DESC, id DESC LIMIT 100')
    .all(v.id);
  res.json({ variant: v });
});

const MOVEMENT_SIGN = { RESTOCK: 1, ADJUSTMENT: 1, DAMAGE: -1, RETURN: 1 };

router.post('/variants/:id/stock', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(id);
  if (!variant) return res.status(404).json({ error: 'Variant not found' });
  const { type, quantity, note = '' } = req.body || {};
  if (!MOVEMENT_SIGN[type]) {
    return res.status(400).json({ error: 'type must be RESTOCK, ADJUSTMENT, DAMAGE or RETURN' });
  }
  const qty = Math.round(Number(quantity));
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: 'quantity must be a positive number' });
  }
  const delta = MOVEMENT_SIGN[type] * qty;
  db.prepare('UPDATE product_variants SET stock_quantity = MAX(0, stock_quantity + ?) WHERE id = ?').run(delta, id);
  db.prepare(
    'INSERT INTO inventory_movements (variant_id, type, quantity, note, created_by) VALUES (?, ?, ?, ?, ?)'
  ).run(id, type, delta, String(note), req.user.id);
  audit(req.user, 'inventory_adjusted', 'variant', id, { type, quantity: delta, note, sku: variant.sku });
  res.json({ variant: mapVariant(db.prepare('SELECT * FROM product_variants WHERE id = ?').get(id)) });
});

router.get('/movements', (req, res) => {
  const rows = db.prepare(
    `SELECT m.*, v.sku, v.size, v.color, p.name AS product_name
     FROM inventory_movements m
     LEFT JOIN product_variants v ON v.id = m.variant_id
     LEFT JOIN products p ON p.id = v.product_id
     ORDER BY m.created_at DESC, m.id DESC LIMIT 200`
  ).all();
  res.json({ movements: rows });
});

/* ---------------------------------------------------------------------------
 * Customers
 * ------------------------------------------------------------------------- */

router.get('/customers', (req, res) => {
  const { search, page = 1, limit = 25 } = req.query;
  const where = ["u.role = 'customer'"];
  const params = [];
  if (search) {
    where.push('(u.name LIKE ? OR u.email LIKE ?)');
    const like = `%${String(search).toLowerCase()}%`;
    params.push(like, like);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const per = Math.min(100, Math.max(1, Number(limit) || 25));
  const off = (Math.max(1, Number(page) || 1) - 1) * per;

  const rows = db.prepare(
    `SELECT u.*, COUNT(o.id) AS order_count,
            COALESCE(SUM(CASE WHEN o.status != 'CANCELLED' THEN o.total END), 0) AS total_spent
     FROM users u
     LEFT JOIN orders o ON o.user_id = u.id
     ${whereSql}
     GROUP BY u.id
     ORDER BY u.created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, per, off);
  const total = db.prepare(`SELECT COUNT(*) AS count FROM users u ${whereSql}`).all(...params)[0].count;
  res.json({ customers: rows.map((r) => ({ ...mapUser(r), order_count: r.order_count, total_spent: r.total_spent })), total, page: Number(page) || 1, limit: per });
});

router.get('/customers/:id', (req, res) => {
  const row = db.prepare(
    `SELECT u.*, COUNT(o.id) AS order_count,
            COALESCE(SUM(CASE WHEN o.status != 'CANCELLED' THEN o.total END), 0) AS total_spent
     FROM users u LEFT JOIN orders o ON o.user_id = u.id
     WHERE u.id = ? GROUP BY u.id`
  ).get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Customer not found' });
  const customer = { ...mapUser(row), order_count: row.order_count, total_spent: row.total_spent };
  customer.profile = db.prepare('SELECT * FROM customer_profiles WHERE user_id = ?').get(customer.id) || null;
  customer.orders = db.prepare(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(customer.id).map((o) => mapOrder(o, { items: true }));
  res.json({ customer });
});

router.patch('/customers/:id', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Customer not found' });
  const { name, email, active } = req.body || {};
  const sets = [];
  const params = [];
  if (name !== undefined) {
    sets.push('name = ?');
    params.push(String(name).trim().slice(0, 120));
  }
  if (email !== undefined) {
    const normalized = String(email).trim().toLowerCase();
    const dup = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(normalized, user.id);
    if (dup) return res.status(409).json({ error: 'Another account uses that email' });
    sets.push('email = ?');
    params.push(normalized);
  }
  if (active !== undefined) {
    sets.push('active = ?');
    params.push(active === 'false' || active === 0 || active === false ? 0 : 1);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  sets.push("updated_at = datetime('now')");
  params.push(user.id);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  audit(req.user, 'customer_updated', 'user', user.id, req.body);
  res.json({ customer: mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) });
});

/* ---------------------------------------------------------------------------
 * Audit log
 * ------------------------------------------------------------------------- */

router.get('/audit', (req, res) => {
  const { action, entity, search, limit = 100 } = req.query;
  const where = [];
  const params = [];
  if (action && action !== 'all') {
    where.push('action = ?');
    params.push(String(action));
  }
  if (entity && entity !== 'all') {
    where.push('entity = ?');
    params.push(String(entity));
  }
  if (search) {
    const like = `%${String(search).toLowerCase()}%`;
    where.push('(admin_email LIKE ? OR entity_id LIKE ? OR metadata LIKE ?)');
    params.push(like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const per = Math.min(500, Math.max(1, Number(limit) || 100));
  const rows = db.prepare(
    `SELECT * FROM audit_log ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ?`
  ).all(...params, per);
  res.json({ logs: rows.map((r) => ({ ...r, metadata: (() => { try { return JSON.parse(r.metadata || '{}'); } catch { return {}; } })() })) });
});

/* ---------------------------------------------------------------------------
 * Staff user management (admin)
 * ------------------------------------------------------------------------- */

router.get('/users', requireAdmin, (_req, res) => {
  const rows = db.prepare(
    `SELECT id, name, email, role, active, created_at, updated_at FROM users
     WHERE role IN ('admin','staff') ORDER BY role, name`
  ).all();
  res.json({ users: rows });
});

router.post('/users', requireAdmin, (req, res) => {
  const { name, email, password, role = 'staff' } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (!['admin', 'staff'].includes(role)) {
    return res.status(400).json({ error: 'role must be admin or staff' });
  }
  const normalized = String(email).trim().toLowerCase();
  const dup = db.prepare('SELECT id FROM users WHERE email = ?').get(normalized);
  if (dup) return res.status(409).json({ error: 'An account with that email already exists' });
  const info = db.prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(String(name).trim(), normalized, bcrypt.hashSync(String(password), 10), role);
  const id = Number(info.lastInsertRowid);
  audit(req.user, 'staff_created', 'user', id, { name, email: normalized, role });
  res.status(201).json({ user: mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
});

router.patch('/users/:id/role', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  const role = String(req.body?.role || '');
  if (!['admin', 'staff', 'customer'].includes(role)) {
    return res.status(400).json({ error: 'role must be admin, staff or customer' });
  }
  if (user.id === req.user.id && role !== 'admin') {
    return res.status(400).json({ error: 'You cannot demote your own account' });
  }
  if (user.role === 'admin' && role !== 'admin') {
    const admins = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND active = 1").get().count;
    if (admins <= 1) return res.status(400).json({ error: 'At least one admin is required' });
  }
  db.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?").run(role, user.id);
  audit(req.user, 'user_role_changed', 'user', user.id, { from: user.role, to: role });
  res.json({ user: mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) });
});

/* ---------------------------------------------------------------------------
 * Store settings (brand / shipping / payment / studio files)
 * ------------------------------------------------------------------------- */

const SETTING_KEYS = ['brand', 'shipping', 'payment', 'studio', 'store'];

function readSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const row of rows) {
    try {
      out[row.key] = JSON.parse(row.value || '{}');
    } catch {
      out[row.key] = {};
    }
  }
  return out;
}

router.get('/settings', (_req, res) => {
  const settings = readSettings();
  res.json({
    settings: {
      brand: settings.brand || { store_name: 'AURORA', currency: 'AED', contact_email: '', phone: '' },
      shipping: settings.shipping || { flat_rate: 9, free_shipping_from: 150, methods: ['standard', 'express'] },
      payment: settings.payment || { method: 'cash_on_delivery' },
      studio: settings.studio || { garment_default: 'hoodie', print_technique: 'screen_print' },
      store: settings.store || {},
    },
  });
});

router.put('/settings', (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !SETTING_KEYS.includes(String(key))) {
    return res.status(400).json({ error: `key must be one of ${SETTING_KEYS.join(', ')}` });
  }
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(String(key), JSON.stringify(value || {}));
  audit(req.user, 'settings_updated', 'settings', String(key), value || {});
  res.json({ settings: readSettings() });
});

export default router;
