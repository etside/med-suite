-- Medsuite-eT SQLite schema (VPS file mode)
-- Apply with: sqlite3 /var/www/med-data/med-suite.sqlite < public/api/schema-sqlite.sql
-- Includes base schema + biometric columns + cms_content + manufacturer column,
-- so no extra migrations are needed on a fresh VPS install.

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS users (
  id TEXT NOT NULL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  biometric_enrolled INTEGER NOT NULL DEFAULT 0,
  biometric_data TEXT NULL,
  webauthn_challenge TEXT NULL,
  webauthn_challenge_expires TEXT NULL,
  auth_pin_hash TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  name_bn TEXT DEFAULT NULL,
  generic_name TEXT DEFAULT NULL,
  manufacturer TEXT DEFAULT NULL,
  category TEXT DEFAULT NULL,
  price REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 10,
  batch_number TEXT DEFAULT NULL,
  expiry_date TEXT DEFAULT NULL,
  requires_prescription INTEGER DEFAULT 0,
  description TEXT DEFAULT NULL,
  description_bn TEXT DEFAULT NULL,
  image_url TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_name ON products (name);
CREATE INDEX IF NOT EXISTS idx_products_manufacturer ON products (manufacturer);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  full_name TEXT DEFAULT NULL,
  phone TEXT DEFAULT NULL,
  address TEXT DEFAULT NULL,
  approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('super_admin','admin','staff','customer')),
  UNIQUE (user_id, role),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT NOT NULL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','processing','delivered','cancelled')),
  payment_method TEXT DEFAULT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','verified','failed')),
  subtotal REAL NOT NULL DEFAULT 0,
  delivery_fee REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  transaction_id TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT NOT NULL PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT NOT NULL PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  customer_name TEXT DEFAULT 'Walk-in Customer',
  customer_phone TEXT DEFAULT NULL,
  items TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  vat REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  sold_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sold_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT DEFAULT NULL,
  phone TEXT DEFAULT NULL,
  email TEXT DEFAULT NULL,
  address TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT NOT NULL PRIMARY KEY,
  po_number TEXT NOT NULL UNIQUE,
  supplier_id TEXT DEFAULT NULL,
  created_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ordered','received','cancelled')),
  total REAL NOT NULL DEFAULT 0,
  notes TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id TEXT NOT NULL PRIMARY KEY,
  po_id TEXT NOT NULL,
  product_id TEXT DEFAULT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost REAL NOT NULL DEFAULT 0,
  total_cost REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pharmacy_settings (
  id TEXT NOT NULL PRIMARY KEY,
  pharmacy_name TEXT NOT NULL DEFAULT 'Medsuite-eT Pharmacy',
  phone TEXT DEFAULT NULL,
  email TEXT DEFAULT NULL,
  address TEXT DEFAULT NULL,
  license_number TEXT DEFAULT NULL,
  logo_url TEXT DEFAULT NULL,
  bkash_number TEXT DEFAULT NULL,
  nagad_number TEXT DEFAULT NULL,
  shop_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT DEFAULT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  "read" INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cms_content (
  id TEXT NOT NULL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT,
  category TEXT DEFAULT 'announcement',
  status TEXT NOT NULL DEFAULT 'draft',
  excerpt TEXT,
  author_id TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cms_status ON cms_content (status);
CREATE INDEX IF NOT EXISTS idx_cms_category ON cms_content (category);

CREATE INDEX IF NOT EXISTS idx_email ON users (email);

-- updated_at auto-touch triggers (replaces MySQL ON UPDATE CURRENT_TIMESTAMP)
CREATE TRIGGER IF NOT EXISTS trg_products_updated AFTER UPDATE ON products
BEGIN UPDATE products SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_profiles_updated AFTER UPDATE ON profiles
BEGIN UPDATE profiles SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_orders_updated AFTER UPDATE ON orders
BEGIN UPDATE orders SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_suppliers_updated AFTER UPDATE ON suppliers
BEGIN UPDATE suppliers SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_orders_updated AFTER UPDATE ON purchase_orders
BEGIN UPDATE purchase_orders SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_pharmacy_settings_updated AFTER UPDATE ON pharmacy_settings
BEGIN UPDATE pharmacy_settings SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_cms_content_updated AFTER UPDATE ON cms_content
BEGIN UPDATE cms_content SET updated_at = datetime('now') WHERE id = NEW.id; END;

-- Seed rows
INSERT INTO pharmacy_settings (id, pharmacy_name, shop_enabled)
SELECT 'dac6a452-b7ec-48aa-9458-b9d0a99f5c15', 'Medsuite-eT Pharmacy', 0
WHERE NOT EXISTS (SELECT 1 FROM pharmacy_settings LIMIT 1);

INSERT INTO products (id, name, name_bn, category, price, stock, description)
SELECT '8ccc6e43-a561-4696-b30a-fdd3442d97ac', 'ECG Test', 'ইসিজি টেস্ট', 'service', 500.00, 9999, 'Electrocardiogram test service'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'ECG Test' LIMIT 1);

-- Remove legacy user if present (keeps all product/catalog data)
DELETE FROM order_items WHERE order_id IN (SELECT o.id FROM orders o JOIN users u ON u.id = o.user_id WHERE LOWER(u.email) = 'abdullahalmamunshaikh22@gmail.com');
DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE LOWER(email) = 'abdullahalmamunshaikh22@gmail.com');
DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE LOWER(email) = 'abdullahalmamunshaikh22@gmail.com');
DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE LOWER(email) = 'abdullahalmamunshaikh22@gmail.com');
DELETE FROM profiles WHERE user_id IN (SELECT id FROM users WHERE LOWER(email) = 'abdullahalmamunshaikh22@gmail.com');
DELETE FROM users WHERE LOWER(email) = 'abdullahalmamunshaikh22@gmail.com';

PRAGMA foreign_keys = ON;
