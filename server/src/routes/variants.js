import { Router } from 'express';
import { db, mapVariant } from '../db.js';
import { requireAuth, requireStaff, requireAdmin } from '../middleware/auth.js';
import { audit, httpError } from '../lib/http.js';

const router = Router();

router.use(requireAuth, requireStaff);

/** Admin variant list with reservation (carts) + availability + status. */
router.get('/', (req, res) => {
  const { status, productId, search, page = 1, limit = 50 } = req.query;
  const where = [];
  const params = [];
  const per = Math.min(200, Math.max(1, Number(limit) || 50));
  const off = (Math.max(1, Number(page) || 1) - 1) * per;

  if (productId) {
    where.push('v.product_id = ?');
    params.push(Number(productId));
  }
  if (search) {
    where.push('(p.name LIKE ? OR v.sku LIKE ? OR v.color LIKE ? OR v.size LIKE ?)');
    const like = `%${String(search).toLowerCase()}%`;
    params.push(like, like, like, like);
  }

  const base = `
    SELECT v.*, p.name AS product_name, p.slug AS product_slug, p.category AS product_category,
      (SELECT COALESCE(SUM(ci.quantity), 0) FROM cart_items ci WHERE ci.variant_id = v.id) AS reserved
    FROM product_variants v
    JOIN products p ON p.id = v.product_id
  `;
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(`${base} ${whereSql} ORDER BY p.name, v.size, v.color LIMIT ? OFFSET ?`).all(...params, per, off);

  const variants = rows.map((r) => {
    const v = mapVariant(r);
    v.product_name = r.product_name;
    v.product_slug = r.product_slug;
    v.product_category = r.product_category;
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

/** Variant detail + movement history. */
router.get('/:id', (req, res) => {
  const row = db.prepare(
    `SELECT v.*, p.name AS product_name, p.slug AS product_slug
     FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?`
  ).get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Variant not found' });
  const v = mapVariant(row);
  v.product_name = row.product_name;
  v.product_slug = row.product_slug;
  const reserved = db.prepare('SELECT COALESCE(SUM(quantity), 0) AS r FROM cart_items WHERE variant_id = ?').get(v.id).r || 0;
  v.reserved = reserved;
  v.available = Math.max(0, v.stock_quantity - reserved);
  v.movements = db
    .prepare('SELECT * FROM inventory_movements WHERE variant_id = ? ORDER BY created_at DESC, id DESC LIMIT 50')
    .all(v.id);
  res.json({ variant: v });
});

/** Update variant pricing/threshold/active status (admin only). */
router.put('/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Variant not found' });

  const { price, low_stock_threshold, active } = req.body || {};
  const updates = [];
  const params = [];
  if (price !== undefined) {
    if (Number(price) < 0) return res.status(400).json({ error: 'Price must be zero or more' });
    updates.push('price = ?');
    params.push(Number(price));
  }
  if (low_stock_threshold !== undefined) {
    updates.push('low_stock_threshold = ?');
    params.push(Math.max(0, Math.round(Number(low_stock_threshold) || 0)));
  }
  if (active !== undefined) {
    updates.push('active = ?');
    params.push(active === 'false' || active === 0 ? 0 : 1);
  }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
  params.push(id);
  db.prepare(`UPDATE product_variants SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  audit(req.user, 'variant_updated', 'variant', id, { ...req.body, sku: existing.sku });
  res.json({ variant: mapVariant(db.prepare('SELECT * FROM product_variants WHERE id = ?').get(id)) });
});

/**
 * Inventory operations. Every change is atomic and records an inventory
 * movement. quantity is always positive; the sign is derived from the type.
 */
const MOVEMENT_SIGN = { RESTOCK: 1, ADJUSTMENT: 1, DAMAGE: -1, RETURN: 1 };

router.post('/:id/stock', requireAdmin, (req, res) => {
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
  db.prepare(
    'UPDATE product_variants SET stock_quantity = MAX(0, stock_quantity + ?) WHERE id = ?'
  ).run(delta, id);

  db.prepare(
    `INSERT INTO inventory_movements (variant_id, type, quantity, note, created_by)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, type, delta, String(note), req.user.id);

  audit(req.user, 'inventory_adjusted', 'variant', id, { type, quantity: delta, note, sku: variant.sku });
  res.json({ variant: mapVariant(db.prepare('SELECT * FROM product_variants WHERE id = ?').get(id)) });
});

export default router;
