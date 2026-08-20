import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { db, transaction } from '../db.js';
import { upload } from '../middleware/upload.js';

const router = Router();

const CUSTOM_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const DEFAULT_COLOR = 'Void Black';

const GARMENTS = {
  tee: { label: 'T-Shirt', price: 89 },
  hoodie: { label: 'Hoodie', price: 129 },
  bag: { label: 'Canvas Tote', price: 69 },
};

router.post('/', upload.single('design'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'A design image is required' });

  try {
    const { type = 'hoodie', color = DEFAULT_COLOR, name, price, stock = 999 } = req.body;
    const garment = GARMENTS[type] || GARMENTS.hoodie;
    const productName = String(name || `Custom ${garment.label}`).trim().slice(0, 80);
    const slug = `custom-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
    const computedPrice = Number(price);
    const finalPrice = Number.isFinite(computedPrice) && computedPrice >= 0 ? computedPrice : garment.price;
    const images = [`/uploads/${req.file.filename}`];
    const stockQty = Math.max(1, Math.round(Number(stock) || 999));

    const create = transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO products
           (name, slug, category, description, base_price, images, active)
           VALUES (?, ?, 'custom', ?, ?, ?, 1)`
        )
        .run(
          productName,
          slug,
          `One-of-one ${garment.label.toLowerCase()} designed in the AURORA Design Studio.`,
          finalPrice,
          JSON.stringify(images)
        );
      const productId = Number(info.lastInsertRowid);

      const insertVariant = db.prepare(
        `INSERT INTO product_variants (product_id, sku, size, color, color_hex, price, stock_quantity, low_stock_threshold, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 5, 1)`
      );
      for (const size of CUSTOM_SIZES) {
        insertVariant.run(productId, `${slug.toUpperCase()}-${size}`, size, color, '#0b0d0f', finalPrice, stockQty);
      }
      return productId;
    });

    const productId = create();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    product.variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ?').all(productId);
    res.status(201).json({ product });
  } catch (err) {
    try { unlinkSync(req.file.path); } catch { /* keep going */ }
    throw err;
  }
});

export default router;
