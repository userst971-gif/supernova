import { Router } from 'express';
import { db } from '../db.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

function cartToken(req) {
  return req.headers['x-cart-token'] || null;
}

function ensureCart(token, userId = null) {
  db.prepare(
    `INSERT INTO carts (token, user_id, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(token) DO UPDATE SET user_id = COALESCE(carts.user_id, excluded.user_id), updated_at = datetime('now')`
  ).run(token, userId);
}

function touch(token) {
  db.prepare("UPDATE carts SET updated_at = datetime('now') WHERE token = ?").run(token);
}

function imageOf(product) {
  try {
    return (JSON.parse(product.images || '[]') || [])[0] || null;
  } catch {
    return null;
  }
}

function getCart(token) {
  const rows = db
    .prepare(
      `SELECT ci.id, ci.variant_id, ci.quantity, ci.unit_price, ci.customization_id,
              v.size, v.color, v.color_hex, v.stock_quantity, v.active AS variant_active, v.sku,
              p.id AS product_id, p.name, p.slug, p.category, p.images, p.compare_at_price, p.base_price,
              p.active AS product_active,
              c.preview_image_url AS customization_preview
       FROM cart_items ci
       JOIN product_variants v ON v.id = ci.variant_id
       JOIN products p ON p.id = v.product_id
       LEFT JOIN customizations c ON c.id = ci.customization_id
       WHERE ci.cart_id = (SELECT id FROM carts WHERE token = ?)
       ORDER BY ci.created_at ASC`
    )
    .all(token);

  const items = rows.map((r) => ({
    id: r.id,
    product_id: r.product_id,
    variant_id: r.variant_id,
    customization_id: r.customization_id,
    size: r.size,
    color: r.color,
    color_hex: r.color_hex,
    qty: r.quantity,
    unit_price: r.unit_price,
    price: r.unit_price,
    name: r.name,
    slug: r.slug,
    category: r.category,
    compare_at_price: r.compare_at_price,
    stock: r.stock_quantity,
    image: imageOf(r),
    customization_preview: r.customization_preview || null,
  }));

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const count = items.reduce((sum, i) => sum + i.qty, 0);
  return { token, items, subtotal, count };
}

/** Resolves the variant for a product + size (+ optional color). */
function resolveVariant(productId, size, color) {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(productId));
  if (!product) return { error: 'Product not found', status: 404 };
  if (product.active !== 1) return { error: 'Product is not available', status: 400 };

  const sizeKey = String(size || 'OS').trim() || 'OS';
  const variants = db
    .prepare('SELECT * FROM product_variants WHERE product_id = ? AND active = 1')
    .all(product.id);

  if (!variants.length) return { error: 'No size or color options are available for this product yet.', status: 400 };

  let variant = null;
  if (color) {
    variant = variants.find((v) => v.size === sizeKey && v.color === color);
  } else {
    variant = variants.filter((v) => v.size === sizeKey).sort((a, b) => a.color.localeCompare(b.color))[0] || null;
  }
  if (!variant) {
    const sizes = [...new Set(variants.map((v) => v.size))];
    return {
      error: sizeKey === 'OS' ? 'This product has no available options.' : `Size ${sizeKey} is not available. Choose from ${sizes.join(', ')}.`,
      status: 400,
    };
  }
  return { variant };
}

function requireCartToken(req, res, next) {
  const token = cartToken(req);
  if (!token) return res.status(400).json({ error: 'Missing x-cart-token header' });
  req.cartToken = token;
  next();
}

router.get('/', requireCartToken, (req, res) => {
  ensureCart(req.cartToken);
  res.json(getCart(req.cartToken));
});

router.post('/items', optionalAuth, requireCartToken, (req, res) => {
  const { product_id, size, color, qty = 1, customization_id } = req.body || {};
  const resolved = resolveVariant(product_id, size, color);
  if (resolved.error) return res.status(resolved.status).json({ error: resolved.error });

  let customization = null;
  if (customization_id) {
    customization = db
      .prepare('SELECT * FROM customizations WHERE id = ?')
      .get(Number(customization_id));
    if (!customization) return res.status(404).json({ error: 'Customization not found' });
  }

  ensureCart(req.cartToken, req.user?.id ?? null);
  const quantity = Math.max(1, Math.min(Number(qty) || 1, 99));
  const unitPrice = resolved.variant.price;

  if (customization) {
    db.prepare("UPDATE customizations SET status = 'cart' WHERE id = ?").run(customization.id);
  }

  db.prepare(
    `INSERT INTO cart_items (cart_id, variant_id, customization_id, quantity, unit_price)
     VALUES ((SELECT id FROM carts WHERE token = ?), ?, ?, ?, ?)
     ON CONFLICT(cart_id, variant_id)
     DO UPDATE SET quantity = MIN(cart_items.quantity + excluded.quantity, 99),
                   customization_id = COALESCE(excluded.customization_id, cart_items.customization_id),
                   unit_price = excluded.unit_price`
  ).run(req.cartToken, resolved.variant.id, customization?.id ?? null, quantity, unitPrice);

  touch(req.cartToken);
  res.status(201).json(getCart(req.cartToken));
});

router.patch('/items/:id', requireCartToken, (req, res) => {
  const id = Number(req.params.id);
  const cart = db.prepare('SELECT id FROM carts WHERE token = ?').get(req.cartToken);
  if (!cart) return res.status(404).json({ error: 'Cart not found' });
  const item = db.prepare('SELECT * FROM cart_items WHERE id = ? AND cart_id = ?').get(id, cart.id);
  if (!item) return res.status(404).json({ error: 'Cart item not found' });

  const quantity = Math.max(1, Math.min(Number(req.body?.qty) || 1, 99));
  db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, id);
  touch(req.cartToken);
  res.json(getCart(req.cartToken));
});

router.delete('/items/:id', requireCartToken, (req, res) => {
  const cart = db.prepare('SELECT id FROM carts WHERE token = ?').get(req.cartToken);
  if (cart) {
    db.prepare('DELETE FROM cart_items WHERE id = ? AND cart_id = ?').run(Number(req.params.id), cart.id);
  }
  touch(req.cartToken);
  res.json(getCart(req.cartToken));
});

router.delete('/', requireCartToken, (req, res) => {
  const cart = db.prepare('SELECT id FROM carts WHERE token = ?').get(req.cartToken);
  if (cart) {
    db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.id);
  }
  res.json({ token: req.cartToken, items: [], subtotal: 0, count: 0 });
});

export default router;
