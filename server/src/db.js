import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

// Persistence: if a Railway volume mount is configured, sit the SQLite file on
// it so orders/data survive redeploys and restarts (the container filesystem
// itself is ephemeral). Falls back to DB_PATH or the local ./data directory.
const VOLUME_MOUNT = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.VOLUME_MOUNT_PATH || '';
const DB_PATH = VOLUME_MOUNT
  ? resolve(VOLUME_MOUNT, 'data', 'supernova.db')
  : resolve(process.env.DB_PATH || './data/supernova.db');

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

/**
 * Migration system. `PRAGMA user_version` tracks the schema revision.
 * Revision 1 is the full Aurora store/management relational schema.
 * Old-schema tables (the flat prototype schema) are dropped and recreated —
 * this is a development database (gitignored, auto-seeded); production
 * migrations would be additive ALTER TABLE scripts.
 */
export const SCHEMA_VERSION = 5;

/** Canonical hex for every brand colorway name. Variants carry their own
 * `color_hex`; this map is the seed/backfill source of truth and the
 * client-side fallback when a variant has no stored hex. */
export const COLOR_HEX = {
  'Void Black': '#16181c',
  'Moon White': '#f1f0ea',
  'Aurora Green': '#21f59a',
  'Emerald Dust': '#4d7a64',
  Nebula: '#6d5bd0',
  default: '#3b3e43',
};

export function colorHexFor(name) {
  return COLOR_HEX[String(name || '').trim()] || COLOR_HEX.default;
}

function migrate() {
  const current = db.prepare('PRAGMA user_version').get().user_version ?? 0;
  if (current >= SCHEMA_VERSION) return;

  if (current < 1) {
    db.exec(`
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS carts;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin','staff','customer')),
  auth_provider TEXT NOT NULL DEFAULT 'password',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE customer_profiles (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  phone             TEXT NOT NULL DEFAULT '',
  shipping_name     TEXT NOT NULL DEFAULT '',
  shipping_address  TEXT NOT NULL DEFAULT '',
  shipping_city     TEXT NOT NULL DEFAULT '',
  shipping_zip      TEXT NOT NULL DEFAULT '',
  shipping_country  TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT NOT NULL DEFAULT '',
  type            TEXT NOT NULL DEFAULT 'tshirt',
  category        TEXT NOT NULL DEFAULT 'tees',
  base_price      REAL NOT NULL,
  compare_at_price REAL,
  images          TEXT NOT NULL DEFAULT '[]',
  color_images    TEXT NOT NULL DEFAULT '{}',
  model3d_url     TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  featured        INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_products_type ON products(type);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_active ON products(active);

CREATE TABLE product_variants (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id          INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color               TEXT NOT NULL DEFAULT '',
  color_hex           TEXT NOT NULL DEFAULT '',
  size                TEXT NOT NULL DEFAULT 'OS',
  sku                 TEXT NOT NULL UNIQUE,
  price               REAL NOT NULL,
  stock_quantity      INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  active              INTEGER NOT NULL DEFAULT 1,
  UNIQUE(product_id, color, size)
);
CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku);
CREATE INDEX idx_variants_active ON product_variants(active);

CREATE TABLE designs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  image_url  TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'UPLOADED' CHECK (source IN ('AI_GENERATED','UPLOADED','ADMIN_CREATED')),
  prompt     TEXT NOT NULL DEFAULT '',
  archived   INTEGER NOT NULL DEFAULT 0,
  published  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_designs_user ON designs(user_id);
CREATE INDEX idx_designs_created ON designs(created_at);
CREATE INDEX idx_designs_source ON designs(source);

CREATE TABLE design_versions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  design_id  INTEGER NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  image_url  TEXT NOT NULL,
  prompt     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_design_versions_design ON design_versions(design_id);

CREATE TABLE customizations (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  design_id          INTEGER NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  product_id         INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id         INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  position_x         REAL NOT NULL DEFAULT 0,
  position_y         REAL NOT NULL DEFAULT 0,
  scale              REAL NOT NULL DEFAULT 1,
  rotation           REAL NOT NULL DEFAULT 0,
  print_area         TEXT NOT NULL DEFAULT 'front',
  preview_image_url  TEXT NOT NULL DEFAULT '',
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_customizations_design ON customizations(design_id);
CREATE INDEX idx_customizations_product ON customizations(product_id);

CREATE TABLE carts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token      TEXT NOT NULL UNIQUE,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_carts_user ON carts(user_id);

CREATE TABLE cart_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  cart_id          INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id       INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  customization_id INTEGER REFERENCES customizations(id) ON DELETE SET NULL,
  quantity         INTEGER NOT NULL DEFAULT 1,
  unit_price       REAL NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(cart_id, variant_id)
);
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX idx_cart_items_variant ON cart_items(variant_id);

CREATE TABLE orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number    TEXT NOT NULL UNIQUE,
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING',
  payment_status  TEXT NOT NULL DEFAULT 'PENDING',
  subtotal        REAL NOT NULL,
  shipping_cost   REAL NOT NULL,
  discount        REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL,
  shipping_name   TEXT NOT NULL,
  shipping_phone  TEXT NOT NULL DEFAULT '',
  shipping_address TEXT NOT NULL,
  shipping_city   TEXT NOT NULL,
  shipping_zip    TEXT NOT NULL DEFAULT '',
  shipping_country TEXT NOT NULL,
  customer_email  TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_orders_payment ON orders(payment_status);

CREATE TABLE order_items (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id               INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id             INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  customization_id       INTEGER REFERENCES customizations(id) ON DELETE SET NULL,
  product_name_snapshot  TEXT NOT NULL,
  variant_snapshot       TEXT NOT NULL,
  quantity               INTEGER NOT NULL,
  unit_price             REAL NOT NULL,
  total_price            REAL NOT NULL
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_variant ON order_items(variant_id);

CREATE TABLE order_status_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status TEXT NOT NULL DEFAULT '',
  new_status TEXT NOT NULL,
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_status_history_order ON order_status_history(order_id);

CREATE TABLE inventory_movements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id   INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('SALE','RESTOCK','ADJUSTMENT','RETURN','DAMAGE','CANCELLED_ORDER')),
  quantity     INTEGER NOT NULL,
  reference_id TEXT NOT NULL DEFAULT '',
  note         TEXT NOT NULL DEFAULT '',
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_inventory_variant ON inventory_movements(variant_id);
CREATE INDEX idx_inventory_created ON inventory_movements(created_at);

CREATE TABLE audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  admin_email  TEXT NOT NULL DEFAULT '',
  action       TEXT NOT NULL,
  entity       TEXT NOT NULL DEFAULT '',
  entity_id    TEXT NOT NULL DEFAULT '',
  metadata     TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_created ON audit_log(created_at);
CREATE INDEX idx_audit_entity ON audit_log(entity);
`);

    db.exec(`PRAGMA user_version = 1;`);
    console.log('[db] schema migrated to revision', 1);
  }

  if (current < 2) {
    // Design customizations gain a JSON settings blob (color scheme, print
    // technique, etc.) and a per-change version trail of JSON patches.
    db.exec(`
CREATE TABLE IF NOT EXISTS customization_versions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  customization_id INTEGER NOT NULL REFERENCES customizations(id) ON DELETE CASCADE,
  patch            TEXT NOT NULL DEFAULT '{}',
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customization_versions_customization ON customization_versions(customization_id);

ALTER TABLE customizations ADD COLUMN settings TEXT NOT NULL DEFAULT '{}';
ALTER TABLE customizations ADD COLUMN status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','cart','paid'));
`);
    db.exec(`PRAGMA user_version = 2;`);
    console.log('[db] schema migrated to revision', 2);
  }

  if (current < 3) {
    // Admin store settings (brand/shipping/payment), production print batches
    // and print jobs, and user suspension support.
    db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS print_batches (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','COMPLETE')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS print_jobs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_item_id INTEGER NOT NULL UNIQUE REFERENCES order_items(id) ON DELETE CASCADE,
  batch_id      INTEGER REFERENCES print_batches(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'QUEUED'
                CHECK (status IN ('QUEUED','DESIGN_READY','PRINTING','PRINTED','QUALITY_CHECK','COMPLETE','FAILED')),
  notes         TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_print_jobs_batch ON print_jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);

ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
`);
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION};`);
    console.log('[db] schema migrated to revision', SCHEMA_VERSION);
  }

  if (current < 4) {
    // Variants carry their own color swatch hex. Older DBs lack the column
    // (custom.js already inserts into it, so this was a latent 500); backfill
    // from the canonical brand palette where it's missing.
    const hasHex = db.prepare(`PRAGMA table_info(product_variants)`).all().some((c) => c.name === 'color_hex');
    if (!hasHex) {
      db.exec(`ALTER TABLE product_variants ADD COLUMN color_hex TEXT NOT NULL DEFAULT '';`);
    }
    const backfill = db.prepare(`UPDATE product_variants SET color_hex = ? WHERE color = ? AND (color_hex IS NULL OR color_hex = '')`);
    const any = db.prepare(`SELECT COUNT(*) AS count FROM product_variants WHERE color_hex IS NULL OR color_hex = ''`).get().count;
    if (any > 0) {
      let filled = 0;
      for (const [name, hex] of Object.entries(COLOR_HEX)) {
        filled += backfill.run(hex, name).changes;
      }
      console.log(`[db] backfilled color_hex for ${filled} variants`);
    }
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION};`);
    console.log('[db] schema migrated to revision', SCHEMA_VERSION);
  }

  if (current < 5) {
    // Per-colorway product photos. `images` holds the default gallery (front +
    // angled studio renders of the hero colorway); `color_images` maps each
    // colorway name to its own front studio render so the PDP can swap the
    // hero image when the buyer changes color.
    const hasColorImages = db.prepare(`PRAGMA table_info(products)`).all().some((c) => c.name === 'color_images');
    if (!hasColorImages) {
      db.exec(`ALTER TABLE products ADD COLUMN color_images TEXT NOT NULL DEFAULT '{}';`);
    }
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION};`);
    console.log('[db] schema migrated to revision', SCHEMA_VERSION);
  }
}

migrate();

const parseJson = (value, fallback) => {
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value ?? '[]');
  } catch {
    return fallback ?? [];
  }
};

/** Synchronous transaction helper (node:sqlite has no db.transaction()). */
export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function mapUser(row) {
  if (!row) return null;
  const { password_hash, ...user } = row;
  return user;
}

export function mapProduct(row) {
  if (!row) return null;
  return {
    ...row,
    images: parseJson(row.images),
    color_images: parseJson(row.color_images, {}),
    featured: !!row.featured,
    active: row.active !== 0,
    price: row.base_price,
  };
}

export function mapVariant(row) {
  if (!row) return null;
  return {
    ...row,
    active: row.active !== 0,
  };
}

export function mapOrder(row, opts = {}) {
  if (!row) return null;
  const order = { ...row, order_ref: row.order_number, items: [] };
  if (opts.items) {
    order.items = db
      .prepare(
        `SELECT oi.id, oi.quantity, oi.unit_price, oi.total_price,
                oi.product_name_snapshot, oi.variant_snapshot, oi.customization_id,
                v.size, v.color, v.sku
         FROM order_items oi
         LEFT JOIN product_variants v ON v.id = oi.variant_id
         WHERE oi.order_id = ?
         ORDER BY oi.id ASC`
      )
      .all(row.id)
      .map((oi) => {
        let snap = {};
        try {
          snap = JSON.parse(oi.variant_snapshot || '{}');
        } catch {
          snap = {};
        }
        return {
          id: oi.id,
          product_id: snap.product_id ?? null,
          customization_id: oi.customization_id,
          name: oi.product_name_snapshot,
          size: oi.size || snap.size,
          color: oi.color || snap.color,
          sku: oi.sku || snap.sku,
          quantity: oi.quantity,
          unit_price: oi.unit_price,
          total_price: oi.total_price,
        };
      });
  }
  if (opts.history) {
    order.history = db
      .prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id ASC')
      .all(row.id);
  }
  return order;
}

export function mapDesign(row) {
  if (!row) return null;
  return { ...row, archived: !!row.archived, published: !!row.published };
}
