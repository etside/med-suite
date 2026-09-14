/**
 * Medsuite-eT — Offline SQLite API Server (sql.js / pure WASM)
 * Mirrors the PHP MySQL API contract exactly.
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = 'medsuite-offline-jwt-secret-2024';

// --- sql.js helpers ---
function queryOne(db, sql, params = []) {
  const result = db.exec(sql, params);
  if (!result.length || !result[0].values.length) return undefined;
  return Object.fromEntries(result[0].columns.map((c, i) => [c, result[0].values[0][i]]));
}

function queryAll(db, sql, params = []) {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  return result[0].values.map(v => Object.fromEntries(result[0].columns.map((c, i) => [c, v[i]])));
}

function runSql(db, sql, params = []) {
  db.run(sql, params);
}

let dbPath;
let uploadsDir;

function createServer(userDataPath) {
  return new Promise(async (resolve) => {
    const SQL = await initSqlJs();

    dbPath = path.join(userDataPath, 'medsuite.db');
    uploadsDir = path.join(userDataPath, 'uploads', 'products');
    fs.mkdirSync(uploadsDir, { recursive: true });

    // Load existing DB or create new
    let db;
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    initSchema(db);
    seedDefaults(db);
    saveDb(db);

    // Save DB every 30 seconds
    setInterval(() => saveDb(db), 30000);

    // Save on exit
    process.on('exit', () => saveDb(db));
    process.on('SIGINT', () => { saveDb(db); process.exit(0); });
    process.on('SIGTERM', () => { saveDb(db); process.exit(0); });

    const app = express();
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));

    // Serve uploaded files
    app.use('/uploads', express.static(path.join(userDataPath, 'uploads')));

    // Multer config for file uploads
    const storage = multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        const name = `product_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`;
        cb(null, name);
      },
    });
    const upload = multer({ storage });

    // --- Middleware ---
    function requireAuth(req, res) {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required' });
        return null;
      }
      try {
        const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
        return decoded.userId;
      } catch {
        res.status(401).json({ error: 'Invalid token' });
        return null;
      }
    }

    function getUserRoles(userId) {
      const rows = queryAll(db, 'SELECT role FROM user_roles WHERE user_id = ?', [userId]);
      return rows.map(r => r.role);
    }

    function isStaff(roles) {
      return roles.some(r => ['staff', 'admin', 'super_admin'].includes(r));
    }

    function requireRoles(res, userId, allowed) {
      const roles = getUserRoles(userId);
      if (!roles.some(r => allowed.includes(r))) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return false;
      }
      return true;
    }

    // --- API Router ---
    app.all('/api/index.php', (req, res) => {
      const action = req.query.action || 'health';
      const method = req.method;

      try {
        switch (action) {
          // ===== Health =====
          case 'health':
            return res.json({
              status: 'ok',
              service: 'Medsuite-eT Offline API',
              version: '2.0.0',
              timestamp: new Date().toISOString(),
            });

          // ===== Auth =====
          case 'auth_login': {
            if (method !== 'POST') return res.status(405).json({ error: 'POST required' });
            const { email, password } = req.body;
            if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
            const user = queryOne(db, 'SELECT id, email, password_hash FROM users WHERE email = ?', [email.toLowerCase()]);
            if (!user) return res.status(401).json({ error: 'Invalid email or password' });
            const validBcrypt = bcryptjs.compareSync(password, user.password_hash);
            const validPin = user.password_hash === crypto.createHash('sha256').update(password).digest('hex');
            if (!validBcrypt && !validPin) return res.status(401).json({ error: 'Invalid email or password' });
            const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
            const roles = getUserRoles(user.id);
            const profile = queryOne(db, 'SELECT full_name, approval_status FROM profiles WHERE user_id = ?', [user.id]) || {};
            return res.json({
              data: {
                token,
                user: { id: user.id, email: user.email },
                roles,
                approval_status: profile.approval_status || 'approved',
                full_name: profile.full_name || null,
              },
            });
          }

          case 'auth_signup': {
            if (method !== 'POST') return res.status(405).json({ error: 'POST required' });
            const { email, password, full_name } = req.body;
            const normEmail = (email || '').toLowerCase().trim();
            if (!normEmail || !password || !(full_name || '').trim()) {
              return res.status(400).json({ error: 'Name, email and password required' });
            }
            if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
            const existing = queryOne(db, 'SELECT id FROM users WHERE email = ?', [normEmail]);
            if (existing) return res.status(409).json({ error: 'Email already registered' });
            const userId = uuidv4();
            const hash = bcryptjs.hashSync(password, 10);
            runSql(db, 'BEGIN');
            try {
              runSql(db, 'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [userId, normEmail, hash]);
              runSql(db, 'INSERT INTO profiles (id, user_id, full_name, approval_status) VALUES (?, ?, ?, ?)', [uuidv4(), userId, full_name.trim(), 'pending']);
              runSql(db, 'INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)', [uuidv4(), userId, 'customer']);
              runSql(db, 'COMMIT');
            } catch (e) {
              runSql(db, 'ROLLBACK');
              throw e;
            }
            saveDb(db);
            return res.status(201).json({ data: { message: 'Account created. Awaiting admin approval.' } });
          }

          case 'auth_me': {
            const userId = requireAuth(req, res);
            if (!userId) return;
            const user = queryOne(db, 'SELECT id, email FROM users WHERE id = ?', [userId]);
            if (!user) return res.status(404).json({ error: 'User not found' });
            const profile = queryOne(db, 'SELECT full_name, phone, address, approval_status FROM profiles WHERE user_id = ?', [userId]) || {};
            return res.json({
              data: {
                user,
                roles: getUserRoles(userId),
                profile,
                approval_status: profile.approval_status || 'approved',
              },
            });
          }

          case 'auth_password': {
            if (method !== 'POST') return res.status(405).json({ error: 'POST required' });
            const userId = requireAuth(req, res);
            if (!userId) return;
            const { password } = req.body;
            if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
            const hash = bcryptjs.hashSync(password, 10);
            runSql(db, 'UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
            saveDb(db);
            return res.json({ data: { message: 'Password updated' } });
          }

          case 'auth_set_pin': {
            if (method !== 'POST') return res.status(405).json({ error: 'POST required' });
            const userId = requireAuth(req, res);
            if (!userId) return;
            const { current_password, new_pin } = req.body;
            const user = queryOne(db, 'SELECT password_hash FROM users WHERE id = ?', [userId]);
            if (!user || !bcryptjs.compareSync(current_password || '', user.password_hash)) {
              return res.status(401).json({ error: 'Current password incorrect' });
            }
            const pinHash = crypto.createHash('sha256').update(new_pin).digest('hex');
            runSql(db, 'UPDATE users SET password_hash = ? WHERE id = ?', [pinHash, userId]);
            saveDb(db);
            return res.json({ data: { success: true, message: 'PIN set' } });
          }

          case 'auth_pin': {
            if (method !== 'POST') return res.status(405).json({ error: 'POST required' });
            const { email, pin } = req.body;
            if (!email || !pin) return res.status(400).json({ error: 'Email and PIN required' });
            const user = queryOne(db, 'SELECT id, email, password_hash FROM users WHERE email = ?', [email.toLowerCase()]);
            if (!user) return res.status(401).json({ error: 'Invalid email or PIN' });
            const pinHash = crypto.createHash('sha256').update(pin).digest('hex');
            if (user.password_hash !== pinHash) return res.status(401).json({ error: 'Invalid email or PIN' });
            const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
            const roles = getUserRoles(user.id);
            return res.json({ data: { token, user: { id: user.id, email: user.email }, roles } });
          }

          case 'auth_logs': {
            const userId = requireAuth(req, res);
            if (!userId) return;
            return res.json({ data: [] });
          }

          // Biometric stubs — not supported in offline mode
          case 'auth_biometric_status':
            return res.json({ data: { enrolled: false, supported: false } });
          case 'auth_biometric':
          case 'auth_biometric_remove':
          case 'auth_webauthn_register_options':
          case 'auth_webauthn_login_options':
          case 'auth_enroll_biometric':
            return res.status(400).json({ error: 'Biometric authentication not supported in offline mode' });

          // ===== Products =====
          case 'products': {
            if (method === 'GET') {
              const { category, search, limit: lim } = req.query;
              let sql = 'SELECT * FROM products WHERE 1=1';
              const params = [];
              if (category) { sql += ' AND category = ?'; params.push(category); }
              if (search) { sql += ' AND (name LIKE ? OR generic_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
              const limit = Math.min(20000, Math.max(1, parseInt(lim) || 10000));
              sql += ` ORDER BY name ASC LIMIT ${limit}`;
              return res.json({ data: queryAll(db, sql, params) });
            }
            if (method === 'POST') {
              const userId = requireAuth(req, res);
              if (!userId) return;
              if (!requireRoles(res, userId, ['staff', 'admin', 'super_admin'])) return;
              const b = req.body;
              const id = uuidv4();
              runSql(db,
                `INSERT INTO products (id, name, name_bn, generic_name, category, price, stock, min_stock, batch_number, expiry_date, requires_prescription, description, description_bn, image_url)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [id, b.name || '', b.name_bn || null, b.generic_name || null, b.category || null, b.price || 0, b.stock || 0, b.min_stock || 10, b.batch_number || null, b.expiry_date || null, b.requires_prescription ? 1 : 0, b.description || null, b.description_bn || null, b.image_url || null]
              );
              saveDb(db);
              return res.status(201).json({ data: { id } });
            }
            return res.status(405).json({ error: 'Method not allowed' });
          }

          case 'product': {
            const id = req.query.id;
            if (!id) return res.status(400).json({ error: 'id required' });
            if (method === 'GET') {
              const row = queryOne(db, 'SELECT * FROM products WHERE id = ?', [id]);
              return row ? res.json({ data: row }) : res.status(404).json({ error: 'Not found' });
            }
            if (method === 'PUT') {
              const userId = requireAuth(req, res);
              if (!userId) return;
              if (!requireRoles(res, userId, ['staff', 'admin', 'super_admin'])) return;
              const b = req.body;
              runSql(db,
                `UPDATE products SET name=?, name_bn=?, generic_name=?, category=?, price=?, stock=?, min_stock=?, batch_number=?, expiry_date=?, requires_prescription=?, description=?, description_bn=?, image_url=? WHERE id=?`,
                [b.name || '', b.name_bn || null, b.generic_name || null, b.category || null, b.price || 0, b.stock || 0, b.min_stock || 10, b.batch_number || null, b.expiry_date || null, b.requires_prescription ? 1 : 0, b.description || null, b.description_bn || null, b.image_url || null, id]
              );
              saveDb(db);
              return res.json({ data: { id } });
            }
            if (method === 'DELETE') {
              const userId = requireAuth(req, res);
              if (!userId) return;
              if (!requireRoles(res, userId, ['staff', 'admin', 'super_admin'])) return;
              runSql(db, 'DELETE FROM products WHERE id = ?', [id]);
              saveDb(db);
              return res.json({ data: { deleted: true } });
            }
            return res.status(405).json({ error: 'Method not allowed' });
          }

          // ===== Orders =====
          case 'orders': {
            const userId = requireAuth(req, res);
            if (!userId) return;
            const roles = getUserRoles(userId);
            if (method === 'GET') {
              const { status, user_id: forUser } = req.query;
              let sql, params;
              if (isStaff(roles)) {
                sql = 'SELECT * FROM orders WHERE 1=1';
                params = [];
                if (status) { sql += ' AND status = ?'; params.push(status); }
                if (forUser) { sql += ' AND user_id = ?'; params.push(forUser); }
                sql += ' ORDER BY created_at DESC LIMIT 500';
              } else {
                sql = 'SELECT * FROM orders WHERE user_id = ?';
                params = [userId];
                if (status) { sql += ' AND status = ?'; params.push(status); }
                sql += ' ORDER BY created_at DESC LIMIT 100';
              }
              return res.json({ data: queryAll(db, sql, params) });
            }
            if (method === 'POST') {
              const b = req.body;
              if (!b.customer_name || !b.customer_phone || !b.items) {
                return res.status(400).json({ error: 'Missing order fields' });
              }
              const orderId = uuidv4();
              const orderNumber = b.order_number || `ORD-${Date.now().toString(36).toUpperCase()}`;
              let subtotal = 0;
              for (const item of b.items) subtotal += (item.unit_price || 0) * (item.quantity || 1);
              const deliveryFee = parseFloat(b.delivery_fee ?? ((b.payment_method || 'cod') === 'cod' ? 50 : 0));
              const total = subtotal + deliveryFee;
              runSql(db, 'BEGIN');
              try {
                runSql(db,
                  `INSERT INTO orders (id, order_number, user_id, customer_name, customer_phone, customer_address, payment_method, payment_status, transaction_id, subtotal, delivery_fee, total, status, notes)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                  [orderId, orderNumber, userId, b.customer_name, b.customer_phone, b.customer_address || null, b.payment_method || 'cod', b.payment_status || 'pending', b.transaction_id || null, subtotal, deliveryFee, total, b.status || 'pending', b.notes || null]
                );
                for (const item of b.items) {
                  runSql(db, 'INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?,?)', [
                    uuidv4(), orderId, item.product_id, item.product_name, item.quantity || 1, item.unit_price, (item.unit_price || 0) * (item.quantity || 1)
                  ]);
                  runSql(db, 'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', [item.quantity || 1, item.product_id, item.quantity || 1]);
                }
                runSql(db, 'COMMIT');
              } catch (e) {
                runSql(db, 'ROLLBACK');
                throw e;
              }
              saveDb(db);
              return res.status(201).json({ data: { id: orderId, order_number: orderNumber, total } });
            }
            if (method === 'PUT') {
              if (!requireRoles(res, userId, ['staff', 'admin', 'super_admin'])) return;
              const b = req.body;
              const orderId = b.id || req.query.id;
              if (!orderId) return res.status(400).json({ error: 'id required' });
              const sets = [], params = [];
              for (const field of ['status', 'payment_status']) {
                if (b[field] !== undefined) { sets.push(`${field} = ?`); params.push(b[field]); }
              }
              if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
              params.push(orderId);
              runSql(db, `UPDATE orders SET ${sets.join(', ')} WHERE id = ?`, params);
              saveDb(db);
              return res.json({ data: { id: orderId } });
            }
            return res.status(405).json({ error: 'Method not allowed' });
          }

          case 'order_items': {
            requireAuth(req, res);
            const orderId = req.query.order_id;
            if (!orderId) return res.status(400).json({ error: 'order_id required' });
            return res.json({ data: queryAll(db, 'SELECT * FROM order_items WHERE order_id = ?', [orderId]) });
          }

          case 'track': {
            const orderNumber = req.query.order_number;
            if (!orderNumber) return res.status(400).json({ error: 'order_number required' });
            const order = queryOne(db, 'SELECT * FROM orders WHERE order_number = ?', [orderNumber.toUpperCase()]);
            if (!order) return res.status(404).json({ error: 'Order not found' });
            order.items = queryAll(db, 'SELECT * FROM order_items WHERE order_id = ?', [order.id]);
            return res.json({ data: order });
          }

          // ===== Sales =====
          case 'sales': {
            const userId = requireAuth(req, res);
            if (!userId) return;
            if (method === 'GET') {
              if (!requireRoles(res, userId, ['staff', 'admin', 'super_admin'])) return;
              const { since } = req.query;
              let sql = 'SELECT * FROM sales WHERE 1=1', params = [];
              if (since) { sql += ' AND created_at >= ?'; params.push(since); }
              sql += ' ORDER BY created_at DESC LIMIT 500';
              return res.json({ data: queryAll(db, sql, params) });
            }
            if (method === 'POST') {
              if (!requireRoles(res, userId, ['staff', 'admin', 'super_admin'])) return;
              const b = req.body;
              const id = uuidv4();
              const items = b.items || [];
              runSql(db,
                `INSERT INTO sales (id, invoice_number, customer_name, customer_phone, items, subtotal, discount, vat, total, payment_method, sold_by)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                [id, b.invoice_number || `INV-${Date.now()}`, b.customer_name || 'Walk-in Customer', b.customer_phone || null, JSON.stringify(items), b.subtotal || 0, b.discount || 0, b.vat || 0, b.total || 0, b.payment_method || 'cash', userId]
              );
              for (const item of items) {
                if (item.id && item.qty) {
                  runSql(db, 'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', [item.qty, item.id, item.qty]);
                }
              }
              saveDb(db);
              return res.status(201).json({ data: { id } });
            }
            return res.status(405).json({ error: 'Method not allowed' });
          }

          // ===== Settings =====
          case 'settings': {
            if (method === 'GET') {
              const row = queryOne(db, 'SELECT * FROM pharmacy_settings ORDER BY updated_at DESC LIMIT 1');
              return res.json({ data: row || null });
            }
            const userId = requireAuth(req, res);
            if (!userId) return;
            if (!requireRoles(res, userId, ['staff', 'admin', 'super_admin'])) return;
            const b = req.body;
            if (method === 'PUT' && b.id) {
              runSql(db,
                `UPDATE pharmacy_settings SET pharmacy_name=?, phone=?, email=?, address=?, license_number=?, logo_url=?, bkash_number=?, nagad_number=?, shop_enabled=? WHERE id=?`,
                [b.pharmacy_name || 'Medsuite-eT Pharmacy', b.phone || null, b.email || null, b.address || null, b.license_number || null, b.logo_url || null, b.bkash_number || null, b.nagad_number || null, b.shop_enabled ? 1 : 0, b.id]
              );
              saveDb(db);
              return res.json({ data: { id: b.id } });
            }
            if (method === 'POST') {
              const id = uuidv4();
              runSql(db,
                `INSERT INTO pharmacy_settings (id, pharmacy_name, phone, email, address, license_number, logo_url, bkash_number, nagad_number, shop_enabled) VALUES (?,?,?,?,?,?,?,?,?,?)`,
                [id, b.pharmacy_name || 'Medsuite-eT Pharmacy', b.phone || null, b.email || null, b.address || null, b.license_number || null, b.logo_url || null, b.bkash_number || null, b.nagad_number || null, b.shop_enabled ? 1 : 0]
              );
              saveDb(db);
              return res.status(201).json({ data: { id } });
            }
            return res.status(405).json({ error: 'Method not allowed' });
          }

          // ===== Profiles =====
          case 'profiles': {
            const userId = requireAuth(req, res);
            if (!userId) return;
            if (method === 'GET') {
              const roles = getUserRoles(userId);
              if (isStaff(roles) && !req.query.self) {
                return res.json({ data: queryAll(db, 'SELECT user_id, full_name, phone, address, approval_status, created_at FROM profiles ORDER BY created_at DESC') });
              }
              return res.json({ data: queryOne(db, 'SELECT * FROM profiles WHERE user_id = ?', [userId]) });
            }
            if (method === 'PUT') {
              const b = req.body;
              const target = b.user_id || userId;
              const roles = getUserRoles(userId);
              if (target !== userId && !requireRoles(res, userId, ['super_admin', 'admin'])) return;
              if (b.approval_status) {
                if (!requireRoles(res, userId, ['super_admin', 'admin'])) return;
                runSql(db, 'UPDATE profiles SET approval_status = ? WHERE user_id = ?', [b.approval_status, target]);
              } else {
                runSql(db, 'UPDATE profiles SET full_name=?, phone=?, address=? WHERE user_id=?', [b.full_name || null, b.phone || null, b.address || null, target]);
              }
              saveDb(db);
              return res.json({ data: { user_id: target } });
            }
            return res.status(405).json({ error: 'Method not allowed' });
          }

          // ===== User Roles =====
          case 'user_roles': {
            const userId = requireAuth(req, res);
            if (!userId) return;
            if (!requireRoles(res, userId, ['admin', 'super_admin'])) return;
            if (method === 'GET') {
              return res.json({ data: queryAll(db, 'SELECT user_id, role FROM user_roles') });
            }
            if (method === 'PUT') {
              const b = req.body;
              if (!b.user_id || !b.role) return res.status(400).json({ error: 'user_id and role required' });
              runSql(db, 'DELETE FROM user_roles WHERE user_id = ?', [b.user_id]);
              runSql(db, 'INSERT INTO user_roles (id, user_id, role) VALUES (?,?,?)', [uuidv4(), b.user_id, b.role]);
              saveDb(db);
              return res.json({ data: { user_id: b.user_id, role: b.role } });
            }
            if (method === 'DELETE') {
              const target = req.query.user_id || req.body.user_id;
              if (!target) return res.status(400).json({ error: 'user_id required' });
              if (!requireRoles(res, userId, ['super_admin'])) return;
              runSql(db, 'BEGIN');
              try {
                runSql(db, 'DELETE FROM notifications WHERE user_id = ?', [target]);
                runSql(db, 'DELETE FROM user_roles WHERE user_id = ?', [target]);
                runSql(db, 'DELETE FROM profiles WHERE user_id = ?', [target]);
                runSql(db, 'DELETE FROM users WHERE id = ?', [target]);
                runSql(db, 'COMMIT');
              } catch (e) {
                runSql(db, 'ROLLBACK');
                throw e;
              }
              saveDb(db);
              return res.json({ data: { deleted: true } });
            }
            return res.status(405).json({ error: 'Method not allowed' });
          }

          // ===== Suppliers =====
          case 'suppliers': {
            const userId = requireAuth(req, res);
            if (!userId) return;
            if (!requireRoles(res, userId, ['staff', 'admin', 'super_admin'])) return;
            if (method === 'GET') {
              return res.json({ data: queryAll(db, 'SELECT * FROM suppliers ORDER BY name') });
            }
            if (method === 'POST') {
              const b = req.body;
              const id = uuidv4();
              runSql(db, 'INSERT INTO suppliers (id, name, contact_person, phone, email, address) VALUES (?,?,?,?,?,?)', [
                id, b.name || '', b.contact_person || null, b.phone || null, b.email || null, b.address || null
              ]);
              saveDb(db);
              return res.status(201).json({ data: { id } });
            }
            return res.status(405).json({ error: 'Method not allowed' });
          }

          // ===== Purchase Orders =====
          case 'purchase_orders': {
            const userId = requireAuth(req, res);
            if (!userId) return;
            if (!requireRoles(res, userId, ['staff', 'admin', 'super_admin'])) return;
            if (method === 'GET') {
              return res.json({ data: queryAll(db,
                `SELECT po.*, s.name AS supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id ORDER BY po.created_at DESC`
              ) });
            }
            if (method === 'POST') {
              const b = req.body;
              const poId = uuidv4();
              runSql(db, 'BEGIN');
              try {
                runSql(db, 'INSERT INTO purchase_orders (id, po_number, supplier_id, created_by, status, total, notes) VALUES (?,?,?,?,?,?,?)', [
                  poId, b.po_number || `PO-${Date.now()}`, b.supplier_id || null, userId, b.status || 'draft', b.total || 0, b.notes || null
                ]);
                for (const item of b.items || []) {
                  runSql(db, 'INSERT INTO purchase_order_items (id, po_id, product_id, product_name, quantity, unit_cost, total_cost) VALUES (?,?,?,?,?,?,?)', [
                    uuidv4(), poId, item.product_id || null, item.product_name || '', item.quantity || 1, item.unit_cost || 0, item.total_cost || 0
                  ]);
                }
                runSql(db, 'COMMIT');
              } catch (e) {
                runSql(db, 'ROLLBACK');
                throw e;
              }
              saveDb(db);
              return res.status(201).json({ data: { id: poId } });
            }
            if (method === 'PUT') {
              const b = req.body;
              const id = b.id || req.query.id;
              if (!id) return res.status(400).json({ error: 'id required' });
              runSql(db, 'UPDATE purchase_orders SET status = ? WHERE id = ?', [b.status || 'received', id]);
              saveDb(db);
              return res.json({ data: { id } });
            }
            return res.status(405).json({ error: 'Method not allowed' });
          }

          // ===== Notifications =====
          case 'notifications': {
            const userId = requireAuth(req, res);
            if (!userId) return;
            if (method === 'GET') {
              return res.json({ data: queryAll(db, 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30', [userId]) });
            }
            if (method === 'PUT') {
              runSql(db, "UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0", [userId]);
              saveDb(db);
              return res.json({ data: { ok: true } });
            }
            return res.status(405).json({ error: 'Method not allowed' });
          }

          // ===== Dashboard =====
          case 'dashboard': {
            const userId = requireAuth(req, res);
            if (!userId) return;
            if (!requireRoles(res, userId, ['staff', 'admin', 'super_admin'])) return;
            const today = new Date().toISOString().slice(0, 10) + ' 00:00:00';
            const monthStart = new Date().toISOString().slice(0, 7) + '-01 00:00:00';
            const todaySales = queryOne(db, 'SELECT COALESCE(SUM(total),0) as t FROM sales WHERE created_at >= ?', [today])?.t || 0;
            const monthlyRevenue = queryOne(db, 'SELECT COALESCE(SUM(total),0) as t FROM sales WHERE created_at >= ?', [monthStart])?.t || 0;
            const topStock = queryAll(db, 'SELECT name, stock FROM products ORDER BY stock DESC LIMIT 4');
            const weekSales = queryAll(db, "SELECT total, created_at FROM sales WHERE created_at >= datetime('now', '-7 days')");

            // Top selling (last 30 days)
            const salesRows = queryAll(db, "SELECT items FROM sales WHERE created_at >= datetime('now', '-30 days')");
            const qtyByName = {};
            for (const row of salesRows) {
              const items = JSON.parse(row.items || '[]');
              for (const item of items) {
                const name = (item.name || '').trim();
                if (!name) continue;
                qtyByName[name] = (qtyByName[name] || 0) + Math.max(1, item.qty || 1);
              }
            }
            const topSelling = Object.entries(qtyByName)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([name, qty]) => ({ name, qty }));

            return res.json({
              data: {
                product_count: queryOne(db, 'SELECT COUNT(*) as c FROM products')?.c || 0,
                low_stock: queryOne(db, 'SELECT COUNT(*) as c FROM products WHERE stock < 20 AND stock > 0')?.c || 0,
                pending_orders: queryOne(db, "SELECT COUNT(*) as c FROM orders WHERE status = 'pending'")?.c || 0,
                expiring_soon: queryOne(db, "SELECT COUNT(*) as c FROM products WHERE expiry_date <= date('now', '+30 days') AND expiry_date > date('now')")?.c || 0,
                user_count: queryOne(db, 'SELECT COUNT(*) as c FROM profiles')?.c || 0,
                supplier_count: queryOne(db, 'SELECT COUNT(*) as c FROM suppliers')?.c || 0,
                pending_approvals: queryOne(db, "SELECT COUNT(*) as c FROM profiles WHERE approval_status = 'pending'")?.c || 0,
                today_sales: todaySales,
                monthly_revenue: monthlyRevenue,
                top_stock: topStock,
                top_selling: topSelling,
                week_sales: weekSales,
              },
            });
          }

          // ===== Upload =====
          case 'upload': {
            if (method !== 'POST') return res.status(405).json({ error: 'POST required' });
            const userId = requireAuth(req, res);
            if (!userId) return;
            if (!requireRoles(res, userId, ['staff', 'admin', 'super_admin'])) return;
            return res.status(400).json({ error: 'Use multipart form data' });
          }

          // ===== Categories =====
          case 'categories': {
            const rows = queryAll(db, 'SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category');
            return res.json({ data: rows.map(r => r.category) });
          }

          // ===== Manufacturers =====
          case 'manufacturers': {
            const userId = requireAuth(req, res);
            if (!userId) return;
            if (!requireRoles(res, userId, ['staff', 'admin', 'super_admin'])) return;
            return res.json({
              data: queryAll(db,
                `SELECT COALESCE(NULLIF(TRIM(category), ''), 'general') AS name,
                        COUNT(*) AS medicines,
                        SUM(requires_prescription) AS prescriptions,
                        1 AS divisions
                 FROM products GROUP BY COALESCE(NULLIF(TRIM(category), ''), 'general') ORDER BY medicines DESC`
              ),
            });
          }

          default:
            return res.status(400).json({ error: `Unknown action: ${action}` });
        }
      } catch (err) {
        console.error('API Error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Upload endpoint with multer
    app.post('/api/upload', requireAuthMW(db, JWT_SECRET), requireRolesMW(db, ['staff', 'admin', 'super_admin']), upload.single('file'), (req, res) => {
      if (!req.file) return res.status(400).json({ error: 'file required' });
      return res.json({ data: { url: `/uploads/products/${req.file.filename}` } });
    });

    resolve(app);
  });
}

// Standalone middleware for upload route
function requireAuthMW(db, secret) {
  return (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
    try {
      const decoded = jwt.verify(auth.slice(7), secret);
      req.userId = decoded.userId;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  };
}

function requireRolesMW(db, allowed) {
  return (req, res, next) => {
    const rows = queryAll(db, 'SELECT role FROM user_roles WHERE user_id = ?', [req.userId]);
    if (!rows.some(r => allowed.includes(r.role))) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}

// --- Save DB to disk ---
function saveDb(db) {
  try {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (err) {
    console.error('Failed to save database:', err);
  }
}

// --- Schema ---
function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT NOT NULL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS products (
      id TEXT NOT NULL PRIMARY KEY,
      name TEXT NOT NULL,
      name_bn TEXT,
      generic_name TEXT,
      category TEXT,
      price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 10,
      batch_number TEXT,
      expiry_date TEXT,
      requires_prescription INTEGER DEFAULT 0,
      description TEXT,
      description_bn TEXT,
      image_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT NOT NULL PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      full_name TEXT,
      phone TEXT,
      address TEXT,
      approval_status TEXT NOT NULL DEFAULT 'approved',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT NOT NULL PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      UNIQUE(user_id, role),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT NOT NULL PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_address TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_method TEXT,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      subtotal REAL NOT NULL DEFAULT 0,
      delivery_fee REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      transaction_id TEXT,
      notes TEXT,
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
      customer_phone TEXT,
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
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT NOT NULL PRIMARY KEY,
      po_number TEXT NOT NULL UNIQUE,
      supplier_id TEXT,
      created_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id TEXT NOT NULL PRIMARY KEY,
      po_id TEXT NOT NULL,
      product_id TEXT,
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
      phone TEXT,
      email TEXT,
      address TEXT,
      license_number TEXT,
      logo_url TEXT,
      bkash_number TEXT,
      nagad_number TEXT,
      shop_enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT NOT NULL PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      type TEXT NOT NULL DEFAULT 'info',
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

function seedDefaults(db) {
  // Seed pharmacy settings if empty
  const settingsCount = queryOne(db, 'SELECT COUNT(*) as c FROM pharmacy_settings')?.c || 0;
  if (settingsCount === 0) {
    runSql(db, 'INSERT INTO pharmacy_settings (id, pharmacy_name, shop_enabled) VALUES (?, ?, ?)', [
      uuidv4(), 'Medsuite-eT Pharmacy', 0
    ]);
  }

  // Seed users if no users exist
  const userCount = queryOne(db, 'SELECT COUNT(*) as c FROM users')?.c || 0;
  if (userCount === 0) {
    const defaultPassword = 'Pjokjict4';
    const hash = bcryptjs.hashSync(defaultPassword, 10);

    // Super admin: kptjms991@gmail.com
    const superAdminId = uuidv4();
    runSql(db, 'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [superAdminId, 'kptjms991@gmail.com', hash]);
    runSql(db, 'INSERT INTO profiles (id, user_id, full_name, approval_status) VALUES (?, ?, ?, ?)', [uuidv4(), superAdminId, 'Super Admin', 'approved']);
    runSql(db, 'INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)', [uuidv4(), superAdminId, 'super_admin']);

    // Admin: abdullahalmamunshaikh22@gmail.com
    const adminId = uuidv4();
    runSql(db, 'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [adminId, 'abdullahalmamunshaikh22@gmail.com', hash]);
    runSql(db, 'INSERT INTO profiles (id, user_id, full_name, approval_status) VALUES (?, ?, ?, ?)', [uuidv4(), adminId, 'Abdullah Al Mamun Shaikh', 'approved']);
    runSql(db, 'INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)', [uuidv4(), adminId, 'admin']);

    // Seed a sample product
    runSql(db,
      `INSERT INTO products (id, name, name_bn, category, price, stock, description)
       VALUES (?,?,?,?,?,?,?)`,
      [uuidv4(), 'ECG Test', 'ইসিজি টেস্ট', 'service', 500.00, 9999, 'Electrocardiogram test service']
    );
  }
}

module.exports = { createServer };
