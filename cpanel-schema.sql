-- ============================================================
--  Medsuite-eT — cPanel / Shared Hosting Schema
--  Domain  : med-suit.shop
--  Host    : localhost
--  Database: hause_med
--  User    : hause_med
--
--  Import via phpMyAdmin:
--    Database → hause_med → Import → choose this file
--  Or via SSH:
--    mysql -u hause_med -p hause_med < cpanel-schema.sql
-- ============================================================

USE hause_med;

-- ── Users (replaces Supabase auth.users) ────────────────────
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email)
) ENGINE=InnoDB;

-- ── Products (medicines + services) ─────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_bn VARCHAR(255) DEFAULT NULL,
  generic_name VARCHAR(255) DEFAULT NULL,
  manufacturer VARCHAR(255) DEFAULT NULL,
  category VARCHAR(100) DEFAULT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  min_stock INT NOT NULL DEFAULT 10,
  batch_number VARCHAR(100) DEFAULT NULL,
  expiry_date DATE DEFAULT NULL,
  requires_prescription TINYINT(1) DEFAULT 0,
  description TEXT DEFAULT NULL,
  description_bn TEXT DEFAULT NULL,
  image_url TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_name (name),
  INDEX idx_manufacturer (manufacturer)
) ENGINE=InnoDB;

-- ── Profiles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL UNIQUE,
  full_name VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── User Roles ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  role ENUM('super_admin','admin','staff','customer') NOT NULL DEFAULT 'customer',
  UNIQUE KEY uq_user_role (user_id, role),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Orders ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  user_id VARCHAR(36) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_address TEXT DEFAULT NULL,
  status ENUM('pending','confirmed','processing','delivered','cancelled') NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(20) DEFAULT NULL,
  payment_status ENUM('pending','verified','failed') NOT NULL DEFAULT 'pending',
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  transaction_id VARCHAR(100) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Order Items ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Sales (POS) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  customer_name VARCHAR(255) DEFAULT 'Walk-in Customer',
  customer_phone VARCHAR(20) DEFAULT NULL,
  items JSON NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  vat DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
  sold_by VARCHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sold_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Suppliers ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Purchase Orders ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  po_number VARCHAR(50) NOT NULL UNIQUE,
  supplier_id VARCHAR(36) DEFAULT NULL,
  created_by VARCHAR(36) NOT NULL,
  status ENUM('draft','ordered','received','cancelled') NOT NULL DEFAULT 'draft',
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Purchase Order Items ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  po_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) DEFAULT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Pharmacy Settings ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pharmacy_settings (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  pharmacy_name VARCHAR(255) NOT NULL DEFAULT 'Medsuite-eT Pharmacy',
  phone VARCHAR(20) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  license_number VARCHAR(100) DEFAULT NULL,
  logo_url TEXT DEFAULT NULL,
  bkash_number VARCHAR(20) DEFAULT NULL,
  nagad_number VARCHAR(20) DEFAULT NULL,
  shop_enabled TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Notifications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT DEFAULT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'info',
  `read` TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── CMS Content ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cms_content (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  content MEDIUMTEXT,
  category VARCHAR(100) DEFAULT 'announcement',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  excerpt TEXT,
  author_id VARCHAR(36) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cms_status (status),
  INDEX idx_cms_category (category)
) ENGINE=InnoDB;

-- ── Default seed data ────────────────────────────────────────
INSERT INTO pharmacy_settings (id, pharmacy_name, shop_enabled)
SELECT UUID(), 'Medsuite-eT Pharmacy', 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM pharmacy_settings LIMIT 1);

INSERT INTO products (id, name, name_bn, category, price, stock, description)
SELECT UUID(), 'ECG Test', 'ইসিজি টেস্ট', 'service', 500.00, 9999,
       'Electrocardiogram test service' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'ECG Test' LIMIT 1);
