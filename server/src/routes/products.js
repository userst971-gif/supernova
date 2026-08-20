import { Router } from 'express';
import { db, mapProduct, mapVariant, colorHexFor } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { audit } from '../lib/http.js';
import { unlinkSync } from 'node:fs';

const router = Router();

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function variantsFor(productId, includeInactive = true) {
  const rows = includeInactive
    ? db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY size, color').all(productId)
    : db.prepare('SELECT * FROM product_variants WHERE product_id = ? AND active = 1 ORDER BY size, color').all(productId);
  return rows.map(mapVariant);
}

/** Attaches variants + legacy derived fields (sizes/colors/stock) for compatibility. */
function hydrate(row) {
  if (!row) return null;
  const product = mapProduct(row);
  const variants = variantsFor(product.id, false);
  product.variants = variants;
  product.sizes = [...new Set(variants.map((v) => v.size))];
  product.colors = [...new Set(variants.map((v) => v.color))];
  product.stock = variants.reduce((sum, v) => sum + v.stock_quantity, 0);
  return product;
}

function list(query) {
  const { category, featured, search, sort = 'new', limit, offset } = query;
  const where = [];
  const params = [];

  if (category === 'custom') {
    where.push("category = 'custom'");
  } else {
    where.push("category != 'custom'");
    if (category && category !== 'all') {
      where.push('category = ?');
      params.push(category);
    }
  }
  if (featured === 'true' || featured === '1') {
    where.push('featured = 1');
  }
  if (search) {
    where.push('(name LIKE ? OR description LIKE ? OR category LIKE ?)');
    const like = `%${String(search).toLowerCase()}%`;
    params.push(like, like, like);
  }

  const orderBy = {
    new: 'created_at DESC, id DESC',
    price_asc: 'base_price ASC',
    price_desc: 'base_price DESC',
    name: 'name ASC',
  }[sort] || 'created_at DESC, id DESC';

  let sql = `SELECT * FROM products ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${orderBy}`;
  const lim = Number(limit);
  if (Number.isFinite(lim) && lim > 0) {
    sql += ' LIMIT ? OFFSET ?';
    params.push(lim, Number(offset) || 0);
  }
  return db.prepare(sql).all(...params).map(hydrate);
}

router.get('/', (req, res) => {
  const rows = list(req.query);
  const total = db.prepare("SELECT COUNT(*) AS count FROM products WHERE category != 'custom'").get().count;
  res.json({ products: rows, total });
});

router.get('/featured', (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM products WHERE featured = 1 ORDER BY created_at DESC')
    .all()
    .map(hydrate);
  res.json({ products: rows });
});

router.get('/categories', (_req, res) => {
  const rows = db.prepare("SELECT DISTINCT category FROM products WHERE category != 'custom' ORDER BY category").all();
  res.json({ categories: rows.map((r) => r.category) });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ? OR slug = ?')
    .get(Number(req.params.id) || null, String(req.params.id));
  if (!row) return res.status(404).json({ error: 'Product not found' });
  res.json({ product: hydrate(row) });
});

router.get('/:id/variants', (req, res) => {
  const row = db.prepare('SELECT id FROM products WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Product not found' });
  res.json({ variants: variantsFor(row.id, false) });
});

function parseList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    return JSON.parse(value);
  } catch {
    return value.split(',').map((v) => v.trim()).filter(Boolean);
  }
}

function parseVariants(value) {
  if (!value) return null;
  const arr = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(arr)) return null;
  return arr
    .map((v) => ({
      color: String(v.color ?? '').trim(),
      size: String(v.size ?? 'OS').trim(),
      sku: String(v.sku ?? '').trim(),
      price: Number(v.price),
      stock_quantity: Math.max(0, Math.round(Number(v.stock_quantity) || 0)),
      low_stock_threshold: Math.max(0, Math.round(Number(v.low_stock_threshold) || 0)),
      active: v.active === false || v.active === 'false' || v.active === 0 ? 0 : 1,
    }))
    .filter((v) => v.sku);
}

function skuFor(slug, color, size) {
  const c = String(color).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'default';
  return `${slug}-${c}-${String(size).toLowerCase()}`;
}

function buildProductFromRequest(req) {
  const {
    name, category = 'tees', type, description = '', price, compare_at_price,
    sizes = '[]', colors = '[]', stock = 0, featured = 'false', active = 'true',
    model3d_url,
  } = req.body;

  const uploaded = (req.files || []).map((f) => `/uploads/${f.filename}`);
  let provided = [];
  try {
    provided = parseList(req.body.images);
  } catch {
    provided = [];
  }
  const images = [...provided, ...uploaded];

  if (!name?.trim()) throw Object.assign(new Error('Product name is required'), { status: 400 });
  if (price === undefined || Number(price) < 0) throw Object.assign(new Error('A valid price is required'), { status: 400 });

  const cat = String(category);
  return {
    name: String(name).trim(),
    slug: slugify(name),
    category: cat,
    type: cat === 'custom' ? 'custom' : String(type || 'tshirt'),
    description: String(description),
    base_price: Number(price),
    compare_at_price: compare_at_price === '' || compare_at_price == null ? null : Number(compare_at_price),
    images,
    model3d_url: model3d_url?.trim() || null,
    stock: Number(stock) || 0,
    featured: featured === 'true' || featured === '1' || featured === true ? 1 : 0,
    active: active === 'false' || active === 0 ? 0 : 1,
    sizes: parseList(sizes),
    colors: parseList(colors),
  };
}

function replaceVariants(productId, data, req, existingSlug) {
  const explicit = parseVariants(req.body.variants);
  if (explicit && explicit.length) {
    db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(productId);
    for (const v of explicit) {
      db.prepare(
        `INSERT INTO product_variants
         (product_id, color, color_hex, size, sku, price, stock_quantity, low_stock_threshold, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(productId, v.color, colorHexFor(v.color), v.size, v.sku, v.price, v.stock_quantity, v.low_stock_threshold, v.active);
    }
    return;
  }

  // Legacy path: derive variants from sizes × colors, distributing stock evenly.
  const sizes = data.sizes.length ? data.sizes : ['OS'];
  const colors = data.colors.length ? data.colors : ['Void Black'];
  const total = sizes.length * colors.length;
  const per = Math.max(1, Math.round(data.stock / total));
  db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(productId);
  for (const color of colors) {
    for (const size of sizes) {
      db.prepare(
        `INSERT INTO product_variants
         (product_id, color, color_hex, size, sku, price, stock_quantity, low_stock_threshold)
         VALUES (?, ?, ?, ?, ?, ?, ?, 5)`
      ).run(productId, color, colorHexFor(color), size, skuFor(existingSlug || data.slug, color, size), data.base_price, per);
    }
  }
}

router.post('/', requireAuth, requireAdmin, upload.array('images', 8), (req, res) => {
  let data;
  try {
    data = buildProductFromRequest(req);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  const dup = db.prepare('SELECT id FROM products WHERE slug = ?').get(data.slug);
  if (dup) {
    for (const img of (req.files || [])) unlinkSync(img.path);
    return res.status(409).json({ error: 'A product with that name already exists' });
  }

  const info = db
    .prepare(
      `INSERT INTO products
       (name, slug, category, type, description, base_price, compare_at_price, images, model3d_url, active, featured, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(
      data.name, data.slug, data.category, data.type, data.description, data.base_price,
      data.compare_at_price, JSON.stringify(data.images), data.model3d_url, data.active,
      data.featured
    );

  replaceVariants(Number(info.lastInsertRowid), data, req, data.slug);

  const product = hydrate(db.prepare('SELECT * FROM products WHERE id = ?').get(Number(info.lastInsertRowid)));
  audit(req.user, 'product_created', 'product', product.id, { name: product.name, slug: product.slug });
  res.status(201).json({ product });
});

router.put('/:id', requireAuth, requireAdmin, upload.array('images', 8), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  let data;
  try {
    data = buildProductFromRequest(req);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  const dup = db.prepare('SELECT id FROM products WHERE slug = ? AND id != ?').get(data.slug, id);
  if (dup) {
    for (const img of (req.files || [])) unlinkSync(img.path);
    return res.status(409).json({ error: 'Another product already uses that name' });
  }

  const keepImages = req.body.keepImages;
  const finalImages = Array.isArray(keepImages) && keepImages.length
    ? [...keepImages, ...data.images.filter((img) => img.startsWith('/uploads/'))]
    : data.images;

  db.prepare(
    `UPDATE products SET
       name = ?, slug = ?, category = ?, type = ?, description = ?, base_price = ?, compare_at_price = ?,
       images = ?, model3d_url = ?, active = ?, featured = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    data.name, data.slug, data.category, data.type, data.description, data.base_price,
    data.compare_at_price, JSON.stringify(finalImages), data.model3d_url, data.active,
    data.featured, id
  );

  replaceVariants(id, data, req, existing.slug);

  const product = hydrate(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
  audit(req.user, 'product_updated', 'product', id, { name: product.name, slug: product.slug });
  res.json({ product });
});

router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  for (const img of mapProduct(existing).images) {
    if (img.startsWith('/uploads/')) {
      try { unlinkSync(`uploads/${img.split('/').pop()}`); } catch { /* keep going */ }
    }
  }
  audit(req.user, 'product_deleted', 'product', id, { name: existing.name });
  res.json({ ok: true });
});

export default router;
