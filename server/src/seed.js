import bcrypt from 'bcryptjs';
import { db, mapProduct, colorHexFor } from './db.js';

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

/**
 * Studio garment model each product renders with for its product photos
 * (tee → tshirt.glb, hoodie → hoodie.glb). The Design Studio has no jacket /
 * puffer model yet, so outerwear products render with the hoodie model.
 */
const MODEL_BY_SLUG = {
  'nebula-oversized-hoodie': 'hoodie',
  'supernova-box-tee': 'tee',
  'aurora-shell-jacket': 'hoodie',
  'event-horizon-zip-hoodie': 'hoodie',
  'quasar-longsleeve': 'tee',
  'nova-classic-tee': 'tee',
  'polaris-technical-puffer': 'hoodie',
  'comet-heavyweight-crewneck': 'hoodie',
  'eclipse-muscle-tee': 'tee',
};

/** Builds the /img/products/<slug>-<colorSlug>.png path for a colorway. */
function renderPath(slug, color) {
  const colorSlug = color.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `/img/products/${slug}-${colorSlug}.png`;
}

const products = [
  {
    name: 'Nebula Oversized Hoodie',
    slug: 'nebula-oversized-hoodie',
    category: 'hoodies',
    type: 'hoodie',
    description:
      'A 480gsm heavyweight fleece hoodie cut with an oversized cosmic silhouette. Double-lined hood, dropped shoulders and a deep kangaroo pocket. Dye-dipped near Orion to catch the exact shade of a nebula at midnight.',
    price: 148,
    compare_at_price: 180,
    sizes: SIZES,
    colors: ['Void Black', 'Emerald Dust', 'Nebula'],
    stock: 42,
    featured: 1,
  },
  {
    name: 'Aurora Box Tee',
    slug: 'supernova-box-tee',
    category: 'tees',
    type: 'tshirt',
    description:
      'The signature drop. Heavy 240gsm combed cotton with a boxy, genderless fit and a tonal AURORA wordmark that catches light like a dying star. Pre-shrunk, stone-washed, built for a thousand washes.',
    price: 58,
    compare_at_price: 72,
    sizes: SIZES,
    colors: ['Void Black', 'Moon White', 'Emerald Dust'],
    stock: 120,
    featured: 1,
  },
  {
    name: 'Aurora Shell Jacket',
    slug: 'aurora-shell-jacket',
    category: 'outerwear',
    type: 'other',
    description:
      'A 3-layer technical shell treated with a custom iridescent finish. Waterproof, seam-sealed, and packed down to nothing. The hood seam glows faintly in low light — a permanent northern light.',
    price: 228,
    compare_at_price: 260,
    sizes: SIZES,
    colors: ['Aurora Green', 'Void Black'],
    stock: 28,
    featured: 1,
  },
  {
    name: 'Event Horizon Zip Hoodie',
    slug: 'event-horizon-zip-hoodie',
    category: 'hoodies',
    type: 'hoodie',
    description:
      'Full-zip heavyweight hoodie named for the point of no return. Brushed interior, matte YKK zip, hidden media pocket in the seam. The blackest black we can legally print.',
    price: 168,
    compare_at_price: null,
    sizes: SIZES,
    colors: ['Void Black'],
    stock: 55,
    featured: 0,
  },
  {
    name: 'Quasar Longsleeve',
    slug: 'quasar-longsleeve',
    category: 'tees',
    type: 'tshirt',
    description:
      'A sharp longsleeve with a slim tapered body and a starburst graphic rendered in reflective micro-print. Under ambient light it is quiet. Under a flash, it detonates.',
    price: 64,
    compare_at_price: null,
    sizes: SIZES,
    colors: ['Void Black', 'Emerald Dust'],
    stock: 74,
    featured: 0,
  },
  {
    name: 'Nova Classic Tee',
    slug: 'nova-classic-tee',
    category: 'tees',
    type: 'tshirt',
    description:
      'The essential. A crisp 200gsm jersey tee with a relaxed fit and a single embroidered AURORA mark over the heart. The staple of every wardrobe in the galaxy.',
    price: 42,
    compare_at_price: null,
    sizes: SIZES,
    colors: ['Void Black', 'Moon White', 'Aurora Green'],
    stock: 200,
    featured: 1,
  },
  {
    name: 'Polaris Technical Puffer',
    slug: 'polaris-technical-puffer',
    category: 'outerwear',
    type: 'other',
    description:
      'A navigational-grade puffer insulated for deep winter. Horizontal baffles channel warmth the way Polaris channels mariners. Compact, featherless, brutally effective.',
    price: 248,
    compare_at_price: 290,
    sizes: SIZES,
    colors: ['Void Black', 'Aurora Green'],
    stock: 20,
    featured: 0,
  },
  {
    name: 'Comet Heavyweight Crewneck',
    slug: 'comet-heavyweight-crewneck',
    category: 'hoodies',
    type: 'hoodie',
    description:
      'A 520gsm loopback crewneck with a gusseted underarm and a trace of comet-dust sheen in the weave. Structured, heavy, and cut long enough to live in.',
    price: 132,
    compare_at_price: null,
    sizes: SIZES,
    colors: ['Void Black', 'Moon White'],
    stock: 60,
    featured: 0,
  },
  {
    name: 'Eclipse Muscle Tee',
    slug: 'eclipse-muscle-tee',
    category: 'tees',
    type: 'tshirt',
    description:
      'Boxy-cut, wide-hem tee with an eclipse graphic printed under a matte finish. Wear it to block out the sun.',
    price: 48,
    compare_at_price: null,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['Void Black', 'Emerald Dust'],
    stock: 90,
    featured: 0,
  },
];

const users = [
  {
    name: 'Nova Admin',
    email: 'admin@aurora.io',
    password: 'aurora123',
    role: 'admin',
  },
  {
    name: 'Atlas Staff',
    email: 'staff@aurora.io',
    password: 'aurora123',
    role: 'staff',
  },
  {
    name: 'Galactic Customer',
    email: 'customer@aurora.io',
    password: 'aurora123',
    role: 'customer',
  },
];

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function skuFor(slug, color, size) {
  const c = color.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug}-${c}-${size.toLowerCase()}`;
}

export default function seed() {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
  const inserted = [];

  for (const u of users) {
    db.prepare(
      `INSERT OR IGNORE INTO users (name, email, password_hash, role, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).run(u.name, u.email, bcrypt.hashSync(u.password, 10), u.role);
  }

  for (const p of products) {
    const slug = p.slug || slugify(p.name);
    const model = MODEL_BY_SLUG[slug] || 'tee';
    const colors = p.colors.length ? p.colors : ['Void Black'];
    const heroColor = colors[0];
    const front = renderPath(slug, heroColor);
    const angle = `${front.replace(/\.png$/, '')}-angle.png`;
    const images = [front, angle];
    const color_images = Object.fromEntries(colors.map((c) => [c, renderPath(slug, c)]));
    db.prepare(
      `INSERT OR IGNORE INTO products
       (name, slug, category, type, description, base_price, compare_at_price, images, color_images, featured, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      p.name,
      slug,
      p.category,
      p.type,
      p.description,
      p.price,
      p.compare_at_price ?? null,
      JSON.stringify(images),
      JSON.stringify(color_images),
      p.featured
    );

    const product = db.prepare('SELECT * FROM products WHERE slug = ?').get(slug);
    if (product) {
      // Refresh the rendered photos even if the product row already exists
      // (dev DB — re-running seed re-points images at the latest studio renders).
      db.prepare('UPDATE products SET images = ?, color_images = ? WHERE slug = ?').run(
        JSON.stringify(images),
        JSON.stringify(color_images),
        slug
      );
      for (const color of colors) {
        for (const size of p.sizes) {
          db.prepare(
            `INSERT OR IGNORE INTO product_variants
             (product_id, color, color_hex, size, sku, price, stock_quantity, low_stock_threshold)
             VALUES (?, ?, ?, ?, ?, ?, ?, 5)`
          ).run(product.id, color, colorHexFor(color), size, skuFor(slug, color, size), p.price, Math.max(1, Math.round(p.stock / (colors.length * p.sizes.length))));
        }
      }
    }
    inserted.push(`${p.name} [${model}]`);
  }

  const count = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
  const variants = db.prepare('SELECT COUNT(*) AS count FROM product_variants').get().count;
  console.log(`[seed] products in db: ${count} (${existing === 0 ? 'fresh seed, ' : ''}${inserted.length} defined)`);
  console.log(`[seed] variants in db: ${variants}`);
  console.log('[seed] users: admin@aurora.io / aurora123 (admin), staff@aurora.io / aurora123 (staff), customer@aurora.io / aurora123 (customer)');
  console.log(`[seed] featured: ${mapProduct(db.prepare('SELECT * FROM products WHERE featured = 1 LIMIT 1').get())?.name ?? 'none'}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  seed();
}
