<?php
/**
 * Medsuite-eT — MySQL REST API (primary backend)
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require __DIR__ . '/inc/helpers.php';
require __DIR__ . '/inc/webauthn.php';

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    api_json([
        'error' => 'API not configured. Copy config.example.php to config.php.',
        'status' => 503,
    ], 503);
}

$config = require $configPath;
if (empty($config['jwt_secret'])) {
    $config['jwt_secret'] = 'medsuite-et-dev-secret-change-in-production';
}

try {
    $pdo = db_connect($config);
} catch (PDOException $e) {
    api_json(['error' => 'Database connection failed', 'status' => 500], 500);
}

$action = $_GET['action'] ?? 'health';
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($action) {
        case 'health':
            api_json([
                'status' => 'ok',
                'service' => 'Medsuite-eT MySQL API',
                'version' => '2.0.0',
                'timestamp' => date('c'),
            ]);

        // ——— Auth ———
        case 'auth_login':
            if ($method !== 'POST') {
                api_error('POST required', 405);
            }
            $body = api_body();
            $email = trim($body['email'] ?? '');
            $password = $body['password'] ?? '';
            if ($email === '' || $password === '') {
                api_error('Email and password required');
            }
            $stmt = $pdo->prepare('SELECT id, email, password_hash FROM users WHERE email = ? LIMIT 1');
            $stmt->execute([strtolower($email)]);
            $row = $stmt->fetch();
            if (!$row) {
                api_error('Invalid email or password', 401);
            }
            // Support bcrypt AND plain SHA256 pin (for initial setup)
            $validBcrypt = password_verify($password, $row['password_hash']);
            $validPin    = ($row['password_hash'] === hash('sha256', $password));
            if (!$validBcrypt && !$validPin) {
                api_error('Invalid email or password', 401);
            }
            $token = create_token($row['id'], $config['jwt_secret']);
            $roles = user_roles($pdo, $row['id']);
            $prof = $pdo->prepare('SELECT full_name, approval_status FROM profiles WHERE user_id = ?');
            $prof->execute([$row['id']]);
            $profile = $prof->fetch() ?: [];
            api_json([
                'data' => [
                    'token' => $token,
                    'user' => ['id' => $row['id'], 'email' => $row['email']],
                    'roles' => $roles,
                    'approval_status' => $profile['approval_status'] ?? 'approved',
                    'full_name' => $profile['full_name'] ?? null,
                ],
            ]);

        case 'auth_signup':
            if ($method !== 'POST') {
                api_error('POST required', 405);
            }
            $body = api_body();
            $email = strtolower(trim($body['email'] ?? ''));
            $password = $body['password'] ?? '';
            $fullName = trim($body['full_name'] ?? '');
            if ($email === '' || $password === '' || $fullName === '') {
                api_error('Name, email and password required');
            }
            if (strlen($password) < 8) {
                api_error('Password must be at least 8 characters');
            }
            $check = $pdo->prepare('SELECT id FROM users WHERE email = ?');
            $check->execute([$email]);
            if ($check->fetch()) {
                api_error('Email already registered', 409);
            }
            $userId = uuid();
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $pdo->beginTransaction();
            $pdo->prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)')->execute([$userId, $email, $hash]);
            $pdo->prepare('INSERT INTO profiles (id, user_id, full_name, approval_status) VALUES (?, ?, ?, ?)')->execute([uuid(), $userId, $fullName, 'pending']);
            $pdo->prepare('INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)')->execute([uuid(), $userId, 'customer']);
            $pdo->commit();
            api_json(['data' => ['message' => 'Account created. Awaiting admin approval.']], 201);

        case 'auth_me':
            $userId = require_auth($pdo, $config);
            $stmt = $pdo->prepare('SELECT id, email FROM users WHERE id = ?');
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            if (!$user) {
                api_error('User not found', 404);
            }
            $prof = $pdo->prepare('SELECT full_name, phone, address, approval_status FROM profiles WHERE user_id = ?');
            $prof->execute([$userId]);
            $profile = $prof->fetch() ?: [];
            api_json([
                'data' => [
                    'user' => $user,
                    'roles' => user_roles($pdo, $userId),
                    'profile' => $profile,
                    'approval_status' => $profile['approval_status'] ?? 'approved',
                ],
            ]);

        case 'auth_biometric_status':
            webauthn_require_columns($pdo);
            $email = strtolower(trim($_GET['email'] ?? ''));
            if ($email === '') {
                api_error('Email required');
            }
            $stmt = $pdo->prepare('SELECT biometric_enrolled FROM users WHERE email = ? LIMIT 1');
            $stmt->execute([$email]);
            $row = $stmt->fetch();
            api_json([
                'data' => [
                    'enrolled' => $row && !empty($row['biometric_enrolled']),
                    'supported' => true,
                ],
            ]);

        case 'auth_webauthn_register_options':
            if ($method !== 'POST') {
                api_error('POST required', 405);
            }
            webauthn_require_columns($pdo);
            $userId = require_auth($pdo, $config);
            require_roles($pdo, $userId, ['admin', 'super_admin']);
            $stmt = $pdo->prepare('SELECT u.id, u.email, p.full_name FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ?');
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            if (!$user) {
                api_error('User not found', 404);
            }
            $challenge = webauthn_new_challenge();
            webauthn_store_challenge($pdo, $userId, $challenge);
            $rpId = webauthn_rp_id();
            api_json([
                'data' => [
                    'rp' => ['name' => 'Medsuite-eT', 'id' => $rpId],
                    'user' => [
                        'id' => webauthn_b64url_encode((string) $user['id']),
                        'name' => $user['email'],
                        'displayName' => $user['full_name'] ?? $user['email'],
                    ],
                    'challenge' => $challenge,
                    'pubKeyCredParams' => [
                        ['type' => 'public-key', 'alg' => -7],
                        ['type' => 'public-key', 'alg' => -257],
                    ],
                    'timeout' => 60000,
                    'attestation' => 'none',
                    'authenticatorSelection' => [
                        'authenticatorAttachment' => 'platform',
                        'residentKey' => 'preferred',
                        'userVerification' => 'required',
                    ],
                ],
            ]);

        case 'auth_enroll_biometric':
            if ($method !== 'POST') {
                api_error('POST required', 405);
            }
            webauthn_require_columns($pdo);
            $userId = require_auth($pdo, $config);
            require_roles($pdo, $userId, ['admin', 'super_admin']);
            $body = api_body();
            $credential = $body['credential'] ?? null;
            if (!is_array($credential) || empty($credential['id'])) {
                api_error('Invalid credential payload');
            }
            $clientData = webauthn_parse_client_data($credential['response']['clientDataJSON'] ?? null);
            if (($clientData['type'] ?? '') !== 'webauthn.create') {
                api_error('Invalid registration ceremony', 400);
            }
            $challenge = $clientData['challenge'] ?? '';
            if (!webauthn_verify_challenge($pdo, $userId, $challenge)) {
                api_error('Registration challenge expired or invalid', 401);
            }
            $store = [
                'credentialId' => $credential['id'],
                'rawId' => $credential['rawId'] ?? $credential['id'],
                'enrolledAt' => date('c'),
            ];
            $pdo->prepare(
                'UPDATE users SET biometric_enrolled = 1, biometric_data = ? WHERE id = ?'
            )->execute([json_encode($store, JSON_UNESCAPED_UNICODE), $userId]);
            api_json(['data' => ['success' => true, 'message' => 'Biometric enrolled']]);

        case 'auth_webauthn_login_options':
            if ($method !== 'POST') {
                api_error('POST required', 405);
            }
            webauthn_require_columns($pdo);
            $body = api_body();
            $email = strtolower(trim($body['email'] ?? ''));
            if ($email === '') {
                api_error('Email required');
            }
            $stmt = $pdo->prepare(
                'SELECT id, email, biometric_enrolled, biometric_data FROM users WHERE email = ? LIMIT 1'
            );
            $stmt->execute([$email]);
            $user = $stmt->fetch();
            if (!$user || empty($user['biometric_enrolled'])) {
                api_error('Biometric not enrolled for this account', 404);
            }
            $stored = json_decode($user['biometric_data'] ?? '{}', true);
            $credId = $stored['credentialId'] ?? '';
            if ($credId === '') {
                api_error('Biometric credential missing', 404);
            }
            $challenge = webauthn_new_challenge();
            webauthn_store_challenge($pdo, (string) $user['id'], $challenge);
            $rpId = webauthn_rp_id();
            api_json([
                'data' => [
                    'challenge' => $challenge,
                    'timeout' => 60000,
                    'rpId' => $rpId,
                    'allowCredentials' => [
                        [
                            'type' => 'public-key',
                            'id' => $credId,
                            'transports' => ['internal', 'hybrid'],
                        ],
                    ],
                    'userVerification' => 'required',
                ],
            ]);

        case 'auth_biometric':
            if ($method !== 'POST') {
                api_error('POST required', 405);
            }
            webauthn_require_columns($pdo);
            $body = api_body();
            $email = strtolower(trim($body['email'] ?? ''));
            $credential = $body['credential'] ?? null;
            if ($email === '' || !is_array($credential) || empty($credential['id'])) {
                api_error('Email and credential required');
            }
            $stmt = $pdo->prepare(
                'SELECT id, email, biometric_enrolled, biometric_data FROM users WHERE email = ? LIMIT 1'
            );
            $stmt->execute([$email]);
            $user = $stmt->fetch();
            if (!$user || empty($user['biometric_enrolled'])) {
                api_error('Biometric not enrolled', 401);
            }
            $stored = json_decode($user['biometric_data'] ?? '{}', true);
            $expectedId = $stored['credentialId'] ?? '';
            if ($expectedId === '' || !hash_equals($expectedId, (string) $credential['id'])) {
                api_error('Unknown biometric credential', 401);
            }
            $clientData = webauthn_parse_client_data($credential['response']['clientDataJSON'] ?? null);
            if (($clientData['type'] ?? '') !== 'webauthn.get') {
                api_error('Invalid authentication ceremony', 400);
            }
            $challenge = $clientData['challenge'] ?? '';
            if (!webauthn_verify_challenge($pdo, (string) $user['id'], $challenge)) {
                api_error('Authentication challenge expired or invalid', 401);
            }
            webauthn_issue_session($pdo, $config, $user);

        case 'auth_biometric_remove':
            if ($method !== 'POST') {
                api_error('POST required', 405);
            }
            webauthn_require_columns($pdo);
            $userId = require_auth($pdo, $config);
            $pdo->prepare(
                'UPDATE users SET biometric_enrolled = 0, biometric_data = NULL, webauthn_challenge = NULL, webauthn_challenge_expires = NULL WHERE id = ?'
            )->execute([$userId]);
            api_json(['data' => ['success' => true]]);

        case 'auth_password':
            if ($method !== 'POST') {
                api_error('POST required', 405);
            }
            $userId = require_auth($pdo, $config);
            $body = api_body();
            $newPassword = $body['password'] ?? '';
            if (strlen($newPassword) < 8) {
                api_error('Password must be at least 8 characters');
            }
            $hash = password_hash($newPassword, PASSWORD_DEFAULT);
            $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([$hash, $userId]);
            api_json(['data' => ['message' => 'Password updated']]);

        // ——— Products ———
        case 'products':
            if ($method === 'GET') {
                $category = $_GET['category'] ?? null;
                $search = $_GET['search'] ?? null;
                $sql = 'SELECT * FROM products WHERE 1=1';
                $params = [];
                if ($category) {
                    $sql .= ' AND category = ?';
                    $params[] = $category;
                }
                if ($search) {
                    $sql .= ' AND (name LIKE ? OR generic_name LIKE ?)';
                    $params[] = "%$search%";
                    $params[] = "%$search%";
                }
                $limit = min(20000, max(1, (int) ($_GET['limit'] ?? 10000)));
                $sql .= ' ORDER BY name ASC LIMIT ' . $limit;
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                api_json(['data' => $stmt->fetchAll()]);
            }
            if ($method === 'POST') {
                $userId = require_auth($pdo, $config);
                require_roles($pdo, $userId, ['staff', 'admin', 'super_admin']);
                $b = api_body();
                $id = uuid();
                $hasMfr = db_has_column($pdo, 'products', 'manufacturer');
                if ($hasMfr) {
                    $pdo->prepare(
                        'INSERT INTO products (id, name, name_bn, generic_name, manufacturer, category, price, stock, min_stock, batch_number, expiry_date, requires_prescription, description, description_bn, image_url)
                         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
                    )->execute([
                        $id,
                        $b['name'] ?? '',
                        $b['name_bn'] ?? null,
                        $b['generic_name'] ?? null,
                        $b['manufacturer'] ?? null,
                        $b['category'] ?? null,
                        $b['price'] ?? 0,
                        $b['stock'] ?? 0,
                        $b['min_stock'] ?? 10,
                        $b['batch_number'] ?? null,
                        $b['expiry_date'] ?? null,
                        !empty($b['requires_prescription']) ? 1 : 0,
                        $b['description'] ?? null,
                        $b['description_bn'] ?? null,
                        $b['image_url'] ?? null,
                    ]);
                } else {
                    $pdo->prepare(
                        'INSERT INTO products (id, name, name_bn, generic_name, category, price, stock, min_stock, batch_number, expiry_date, requires_prescription, description, description_bn, image_url)
                         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
                    )->execute([
                        $id,
                        $b['name'] ?? '',
                        $b['name_bn'] ?? null,
                        $b['generic_name'] ?? null,
                        $b['category'] ?? null,
                        $b['price'] ?? 0,
                        $b['stock'] ?? 0,
                        $b['min_stock'] ?? 10,
                        $b['batch_number'] ?? null,
                        $b['expiry_date'] ?? null,
                        !empty($b['requires_prescription']) ? 1 : 0,
                        $b['description'] ?? null,
                        $b['description_bn'] ?? null,
                        $b['image_url'] ?? null,
                    ]);
                }
                api_json(['data' => ['id' => $id]], 201);
            }
            api_error('Method not allowed', 405);

        case 'product':
            $id = $_GET['id'] ?? null;
            if (!$id) {
                api_error('id required');
            }
            if ($method === 'GET') {
                $stmt = $pdo->prepare('SELECT * FROM products WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $row ? api_json(['data' => $row]) : api_error('Not found', 404);
            }
            if ($method === 'PUT') {
                $userId = require_auth($pdo, $config);
                require_roles($pdo, $userId, ['staff', 'admin', 'super_admin']);
                $b = api_body();
                $hasMfr = db_has_column($pdo, 'products', 'manufacturer');
                if ($hasMfr) {
                    $pdo->prepare(
                        'UPDATE products SET name=?, name_bn=?, generic_name=?, manufacturer=?, category=?, price=?, stock=?, min_stock=?, batch_number=?, expiry_date=?, requires_prescription=?, description=?, description_bn=?, image_url=? WHERE id=?'
                    )->execute([
                        $b['name'] ?? '',
                        $b['name_bn'] ?? null,
                        $b['generic_name'] ?? null,
                        $b['manufacturer'] ?? null,
                        $b['category'] ?? null,
                        $b['price'] ?? 0,
                        $b['stock'] ?? 0,
                        $b['min_stock'] ?? 10,
                        $b['batch_number'] ?? null,
                        $b['expiry_date'] ?? null,
                        !empty($b['requires_prescription']) ? 1 : 0,
                        $b['description'] ?? null,
                        $b['description_bn'] ?? null,
                        $b['image_url'] ?? null,
                        $id,
                    ]);
                } else {
                    $pdo->prepare(
                        'UPDATE products SET name=?, name_bn=?, generic_name=?, category=?, price=?, stock=?, min_stock=?, batch_number=?, expiry_date=?, requires_prescription=?, description=?, description_bn=?, image_url=? WHERE id=?'
                    )->execute([
                        $b['name'] ?? '',
                        $b['name_bn'] ?? null,
                        $b['generic_name'] ?? null,
                        $b['category'] ?? null,
                        $b['price'] ?? 0,
                        $b['stock'] ?? 0,
                        $b['min_stock'] ?? 10,
                        $b['batch_number'] ?? null,
                        $b['expiry_date'] ?? null,
                        !empty($b['requires_prescription']) ? 1 : 0,
                        $b['description'] ?? null,
                        $b['description_bn'] ?? null,
                        $b['image_url'] ?? null,
                        $id,
                    ]);
                }
                api_json(['data' => ['id' => $id]]);
            }
            if ($method === 'DELETE') {
                $userId = require_auth($pdo, $config);
                require_roles($pdo, $userId, ['staff', 'admin', 'super_admin']);
                $pdo->prepare('DELETE FROM products WHERE id = ?')->execute([$id]);
                api_json(['data' => ['deleted' => true]]);
            }
            api_error('Method not allowed', 405);

        // ——— Orders ———
        case 'orders':
            $userId = require_auth($pdo, $config);
            $roles = user_roles($pdo, $userId);
            if ($method === 'GET') {
                $status = $_GET['status'] ?? null;
                $forUser = $_GET['user_id'] ?? null;
                if (is_staff_role($roles)) {
                    $sql = 'SELECT * FROM orders WHERE 1=1';
                    $params = [];
                    if ($status) {
                        $sql .= ' AND status = ?';
                        $params[] = $status;
                    }
                    if ($forUser) {
                        $sql .= ' AND user_id = ?';
                        $params[] = $forUser;
                    }
                    $sql .= ' ORDER BY created_at DESC LIMIT 500';
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                } else {
                    $sql = 'SELECT * FROM orders WHERE user_id = ?';
                    $params = [$userId];
                    if ($status) {
                        $sql .= ' AND status = ?';
                        $params[] = $status;
                    }
                    $sql .= ' ORDER BY created_at DESC LIMIT 100';
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                }
                api_json(['data' => $stmt->fetchAll()]);
            }
            if ($method === 'POST') {
                $b = api_body();
                if (empty($b['customer_name']) || empty($b['customer_phone']) || empty($b['items'])) {
                    api_error('Missing order fields');
                }
                $pdo->beginTransaction();
                $orderId = uuid();
                $orderNumber = $b['order_number'] ?? ('ORD-' . strtoupper(base_convert((string) time(), 10, 36)));
                $subtotal = 0;
                foreach ($b['items'] as $item) {
                    $subtotal += ($item['unit_price'] ?? 0) * ($item['quantity'] ?? 1);
                }
                $deliveryFee = (float) ($b['delivery_fee'] ?? (($b['payment_method'] ?? 'cod') === 'cod' ? 50 : 0));
                $total = $subtotal + $deliveryFee;
                $pdo->prepare(
                    'INSERT INTO orders (id, order_number, user_id, customer_name, customer_phone, customer_address, payment_method, payment_status, transaction_id, subtotal, delivery_fee, total, status, notes)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
                )->execute([
                    $orderId,
                    $orderNumber,
                    $userId,
                    $b['customer_name'],
                    $b['customer_phone'],
                    $b['customer_address'] ?? null,
                    $b['payment_method'] ?? 'cod',
                    $b['payment_status'] ?? 'pending',
                    $b['transaction_id'] ?? null,
                    $subtotal,
                    $deliveryFee,
                    $total,
                    $b['status'] ?? 'pending',
                    $b['notes'] ?? null,
                ]);
                foreach ($b['items'] as $item) {
                    $pdo->prepare(
                        'INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?,?,?,?,?,?,?)'
                    )->execute([
                        uuid(),
                        $orderId,
                        $item['product_id'],
                        $item['product_name'],
                        $item['quantity'] ?? 1,
                        $item['unit_price'],
                        ($item['unit_price'] ?? 0) * ($item['quantity'] ?? 1),
                    ]);
                    $pdo->prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?')->execute([
                        $item['quantity'] ?? 1,
                        $item['product_id'],
                        $item['quantity'] ?? 1,
                    ]);
                }
                $pdo->commit();
                api_json(['data' => ['id' => $orderId, 'order_number' => $orderNumber, 'total' => $total]], 201);
            }
            if ($method === 'PUT') {
                require_roles($pdo, $userId, ['staff', 'admin', 'super_admin']);
                $b = api_body();
                $orderId = $b['id'] ?? $_GET['id'] ?? null;
                if (!$orderId) {
                    api_error('id required');
                }
                $sets = [];
                $params = [];
                foreach (['status', 'payment_status'] as $field) {
                    if (array_key_exists($field, $b)) {
                        $sets[] = "$field = ?";
                        $params[] = $b[$field];
                    }
                }
                if (!$sets) {
                    api_error('Nothing to update');
                }
                $params[] = $orderId;
                $pdo->prepare('UPDATE orders SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
                api_json(['data' => ['id' => $orderId]]);
            }
            api_error('Method not allowed', 405);

        case 'order_items':
            require_auth($pdo, $config);
            $orderId = $_GET['order_id'] ?? null;
            if (!$orderId) {
                api_error('order_id required');
            }
            $stmt = $pdo->prepare('SELECT * FROM order_items WHERE order_id = ?');
            $stmt->execute([$orderId]);
            api_json(['data' => $stmt->fetchAll()]);

        case 'track':
            $orderNumber = $_GET['order_number'] ?? null;
            if (!$orderNumber) {
                api_error('order_number required');
            }
            $stmt = $pdo->prepare('SELECT * FROM orders WHERE order_number = ?');
            $stmt->execute([strtoupper($orderNumber)]);
            $order = $stmt->fetch();
            if (!$order) {
                api_error('Order not found', 404);
            }
            $stmt2 = $pdo->prepare('SELECT * FROM order_items WHERE order_id = ?');
            $stmt2->execute([$order['id']]);
            $order['items'] = $stmt2->fetchAll();
            api_json(['data' => $order]);

        // ——— Sales ———
        case 'sales':
            $userId = require_auth($pdo, $config);
            if ($method === 'GET') {
                require_roles($pdo, $userId, ['staff', 'admin', 'super_admin']);
                $since = $_GET['since'] ?? null;
                $sql = 'SELECT * FROM sales WHERE 1=1';
                $params = [];
                if ($since) {
                    $sql .= ' AND created_at >= ?';
                    $params[] = $since;
                }
                $sql .= ' ORDER BY created_at DESC LIMIT 500';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                api_json(['data' => $stmt->fetchAll()]);
            }
            if ($method === 'POST') {
                require_roles($pdo, $userId, ['staff', 'admin', 'super_admin']);
                $b = api_body();
                $id = uuid();
                $items = $b['items'] ?? [];
                $pdo->prepare(
                    'INSERT INTO sales (id, invoice_number, customer_name, customer_phone, items, subtotal, discount, vat, total, payment_method, sold_by)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?)'
                )->execute([
                    $id,
                    $b['invoice_number'] ?? ('INV-' . time()),
                    $b['customer_name'] ?? 'Walk-in Customer',
                    $b['customer_phone'] ?? null,
                    json_encode($items),
                    $b['subtotal'] ?? 0,
                    $b['discount'] ?? 0,
                    $b['vat'] ?? 0,
                    $b['total'] ?? 0,
                    $b['payment_method'] ?? 'cash',
                    $userId,
                ]);
                foreach ($items as $item) {
                    if (!empty($item['id']) && !empty($item['qty'])) {
                        $pdo->prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?')->execute([
                            $item['qty'],
                            $item['id'],
                            $item['qty'],
                        ]);
                    }
                }
                api_json(['data' => ['id' => $id]], 201);
            }
            api_error('Method not allowed', 405);

        // ——— Settings ———
        case 'settings':
            if ($method === 'GET') {
                $stmt = $pdo->query('SELECT * FROM pharmacy_settings ORDER BY updated_at DESC LIMIT 1');
                api_json(['data' => $stmt->fetch() ?: null]);
            }
            $userId = require_auth($pdo, $config);
            require_roles($pdo, $userId, ['staff', 'admin', 'super_admin']);
            $b = api_body();
            if ($method === 'PUT' && !empty($b['id'])) {
                $pdo->prepare(
                    'UPDATE pharmacy_settings SET pharmacy_name=?, phone=?, email=?, address=?, license_number=?, logo_url=?, bkash_number=?, nagad_number=?, shop_enabled=? WHERE id=?'
                )->execute([
                    $b['pharmacy_name'] ?? 'Medsuite-eT Pharmacy',
                    $b['phone'] ?? null,
                    $b['email'] ?? null,
                    $b['address'] ?? null,
                    $b['license_number'] ?? null,
                    $b['logo_url'] ?? null,
                    $b['bkash_number'] ?? null,
                    $b['nagad_number'] ?? null,
                    !empty($b['shop_enabled']) ? 1 : 0,
                    $b['id'],
                ]);
                api_json(['data' => ['id' => $b['id']]]);
            }
            if ($method === 'POST') {
                $id = uuid();
                $pdo->prepare(
                    'INSERT INTO pharmacy_settings (id, pharmacy_name, phone, email, address, license_number, logo_url, bkash_number, nagad_number, shop_enabled)
                     VALUES (?,?,?,?,?,?,?,?,?,?)'
                )->execute([
                    $id,
                    $b['pharmacy_name'] ?? 'Medsuite-eT Pharmacy',
                    $b['phone'] ?? null,
                    $b['email'] ?? null,
                    $b['address'] ?? null,
                    $b['license_number'] ?? null,
                    $b['logo_url'] ?? null,
                    $b['bkash_number'] ?? null,
                    $b['nagad_number'] ?? null,
                    !empty($b['shop_enabled']) ? 1 : 0,
                ]);
                api_json(['data' => ['id' => $id]], 201);
            }
            api_error('Method not allowed', 405);

        // ——— Profiles & users ———
        case 'profiles':
            $userId = require_auth($pdo, $config);
            if ($method === 'GET') {
                $roles = user_roles($pdo, $userId);
                if (is_staff_role($roles) && empty($_GET['self'])) {
                    $stmt = $pdo->query('SELECT user_id, full_name, phone, address, approval_status, created_at FROM profiles ORDER BY created_at DESC');
                    api_json(['data' => $stmt->fetchAll()]);
                }
                $stmt = $pdo->prepare('SELECT * FROM profiles WHERE user_id = ?');
                $stmt->execute([$userId]);
                api_json(['data' => $stmt->fetch()]);
            }
            if ($method === 'PUT') {
                $b = api_body();
                $target = $b['user_id'] ?? $userId;
                $roles = user_roles($pdo, $userId);
                if ($target !== $userId) {
                    require_roles($pdo, $userId, ['super_admin', 'admin']);
                }
                if (!empty($b['approval_status'])) {
                    require_roles($pdo, $userId, ['super_admin', 'admin']);
                    $pdo->prepare('UPDATE profiles SET approval_status = ? WHERE user_id = ?')->execute([$b['approval_status'], $target]);
                } else {
                    $pdo->prepare('UPDATE profiles SET full_name=?, phone=?, address=? WHERE user_id=?')->execute([
                        $b['full_name'] ?? null,
                        $b['phone'] ?? null,
                        $b['address'] ?? null,
                        $target,
                    ]);
                }
                api_json(['data' => ['user_id' => $target]]);
            }
            api_error('Method not allowed', 405);

        case 'user_roles':
            $userId = require_auth($pdo, $config);
            require_roles($pdo, $userId, ['admin', 'super_admin']);
            if ($method === 'GET') {
                $stmt = $pdo->query('SELECT user_id, role FROM user_roles');
                api_json(['data' => $stmt->fetchAll()]);
            }
            if ($method === 'PUT') {
                $b = api_body();
                $target = $b['user_id'] ?? '';
                $role = $b['role'] ?? '';
                if ($target === '' || $role === '') {
                    api_error('user_id and role required');
                }
                $pdo->prepare('DELETE FROM user_roles WHERE user_id = ?')->execute([$target]);
                $pdo->prepare('INSERT INTO user_roles (id, user_id, role) VALUES (?,?,?)')->execute([uuid(), $target, $role]);
                api_json(['data' => ['user_id' => $target, 'role' => $role]]);
            }
            if ($method === 'DELETE') {
                $target = $_GET['user_id'] ?? api_body()['user_id'] ?? '';
                if ($target === '') {
                    api_error('user_id required');
                }
                require_roles($pdo, $userId, ['super_admin']);
                $pdo->prepare('DELETE FROM notifications WHERE user_id = ?')->execute([$target]);
                $pdo->prepare('DELETE FROM user_roles WHERE user_id = ?')->execute([$target]);
                $pdo->prepare('DELETE FROM profiles WHERE user_id = ?')->execute([$target]);
                $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$target]);
                api_json(['data' => ['deleted' => true]]);
            }
            api_error('Method not allowed', 405);

        case 'suppliers':
            $userId = require_auth($pdo, $config);
            require_roles($pdo, $userId, ['staff', 'admin', 'super_admin']);
            if ($method === 'GET') {
                $stmt = $pdo->query('SELECT * FROM suppliers ORDER BY name');
                api_json(['data' => $stmt->fetchAll()]);
            }
            if ($method === 'POST') {
                $b = api_body();
                $id = uuid();
                $pdo->prepare('INSERT INTO suppliers (id, name, contact_person, phone, email, address) VALUES (?,?,?,?,?,?)')->execute([
                    $id, $b['name'] ?? '', $b['contact_person'] ?? null, $b['phone'] ?? null, $b['email'] ?? null, $b['address'] ?? null,
                ]);
                api_json(['data' => ['id' => $id]], 201);
            }
            api_error('Method not allowed', 405);

        case 'purchase_orders':
            $userId = require_auth($pdo, $config);
            require_roles($pdo, $userId, ['staff', 'admin', 'super_admin']);
            if ($method === 'GET') {
                $stmt = $pdo->query(
                    'SELECT po.*, s.name AS supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id ORDER BY po.created_at DESC'
                );
                api_json(['data' => $stmt->fetchAll()]);
            }
            if ($method === 'POST') {
                $b = api_body();
                $poId = uuid();
                $pdo->beginTransaction();
                $pdo->prepare('INSERT INTO purchase_orders (id, po_number, supplier_id, created_by, status, total, notes) VALUES (?,?,?,?,?,?,?)')->execute([
                    $poId,
                    $b['po_number'] ?? ('PO-' . time()),
                    $b['supplier_id'] ?? null,
                    $userId,
                    $b['status'] ?? 'draft',
                    $b['total'] ?? 0,
                    $b['notes'] ?? null,
                ]);
                foreach ($b['items'] ?? [] as $item) {
                    $pdo->prepare('INSERT INTO purchase_order_items (id, po_id, product_id, product_name, quantity, unit_cost, total_cost) VALUES (?,?,?,?,?,?,?)')->execute([
                        uuid(), $poId, $item['product_id'] ?? null, $item['product_name'] ?? '', $item['quantity'] ?? 1, $item['unit_cost'] ?? 0, $item['total_cost'] ?? 0,
                    ]);
                }
                $pdo->commit();
                api_json(['data' => ['id' => $poId]], 201);
            }
            if ($method === 'PUT') {
                $b = api_body();
                $id = $b['id'] ?? $_GET['id'] ?? null;
                if (!$id) {
                    api_error('id required');
                }
                $pdo->prepare('UPDATE purchase_orders SET status = ? WHERE id = ?')->execute([$b['status'] ?? 'received', $id]);
                api_json(['data' => ['id' => $id]]);
            }
            api_error('Method not allowed', 405);

        case 'notifications':
            $userId = require_auth($pdo, $config);
            if ($method === 'GET') {
                $stmt = $pdo->prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30');
                $stmt->execute([$userId]);
                api_json(['data' => $stmt->fetchAll()]);
            }
            if ($method === 'PUT') {
                $pdo->prepare('UPDATE notifications SET `read` = 1 WHERE user_id = ? AND `read` = 0')->execute([$userId]);
                api_json(['data' => ['ok' => true]]);
            }
            api_error('Method not allowed', 405);

        case 'dashboard':
            $userId = require_auth($pdo, $config);
            require_roles($pdo, $userId, ['staff', 'admin', 'super_admin']);
            $today = date('Y-m-d 00:00:00');
            $monthStart = date('Y-m-01 00:00:00');
            $st = $pdo->prepare('SELECT COALESCE(SUM(total),0) FROM sales WHERE created_at >= ?');
            $st->execute([$today]);
            $todaySales = (float) $st->fetchColumn();
            $st->execute([$monthStart]);
            $monthlyRevenue = (float) $st->fetchColumn();
            $topStock = $pdo->query('SELECT name, stock FROM products ORDER BY stock DESC LIMIT 4')->fetchAll();
            $weekStmt = $pdo->prepare('SELECT total, created_at FROM sales WHERE created_at >= ?');
            $weekStmt->execute([date('Y-m-d H:i:s', strtotime('-7 days'))]);
            $weekSales = $weekStmt->fetchAll();

            $topSelling = [];
            $salesStmt = $pdo->prepare('SELECT items FROM sales WHERE created_at >= ?');
            $salesStmt->execute([date('Y-m-d H:i:s', strtotime('-30 days'))]);
            $salesRows = $salesStmt->fetchAll();
            $qtyByName = [];
            foreach ($salesRows as $saleRow) {
                $items = json_decode($saleRow['items'] ?? '[]', true);
                if (!is_array($items)) {
                    continue;
                }
                foreach ($items as $item) {
                    $name = trim((string) ($item['name'] ?? ''));
                    if ($name === '') {
                        continue;
                    }
                    $qty = (int) ($item['qty'] ?? 1);
                    $qtyByName[$name] = ($qtyByName[$name] ?? 0) + max(1, $qty);
                }
            }
            arsort($qtyByName);
            foreach (array_slice($qtyByName, 0, 8, true) as $name => $qty) {
                $topSelling[] = ['name' => $name, 'qty' => $qty];
            }

            api_json([
                'data' => [
                    'product_count' => (int) $pdo->query('SELECT COUNT(*) FROM products')->fetchColumn(),
                    'low_stock' => (int) $pdo->query('SELECT COUNT(*) FROM products WHERE stock < 20 AND stock > 0')->fetchColumn(),
                    'pending_orders' => (int) $pdo->query("SELECT COUNT(*) FROM orders WHERE status = 'pending'")->fetchColumn(),
                    'expiring_soon' => (int) (function () use ($pdo) {
                        $st = $pdo->prepare('SELECT COUNT(*) FROM products WHERE expiry_date <= ? AND expiry_date > ?');
                        $st->execute([date('Y-m-d', strtotime('+30 days')), date('Y-m-d')]);
                        return $st->fetchColumn();
                    })(),
                    'user_count' => (int) $pdo->query('SELECT COUNT(*) FROM profiles')->fetchColumn(),
                    'supplier_count' => (int) $pdo->query('SELECT COUNT(*) FROM suppliers')->fetchColumn(),
                    'pending_approvals' => (int) $pdo->query("SELECT COUNT(*) FROM profiles WHERE approval_status = 'pending'")->fetchColumn(),
                    'today_sales' => $todaySales,
                    'monthly_revenue' => $monthlyRevenue,
                    'top_stock' => $topStock,
                    'top_selling' => $topSelling,
                    'week_sales' => $weekSales,
                ],
            ]);

        case 'upload':
            if ($method !== 'POST') {
                api_error('POST required', 405);
            }
            $userId = require_auth($pdo, $config);
            require_roles($pdo, $userId, ['staff', 'admin', 'super_admin']);
            if (empty($_FILES['file'])) {
                api_error('file required');
            }
            $file = $_FILES['file'];
            if ($file['error'] !== UPLOAD_ERR_OK) {
                api_error('Upload failed');
            }
            $ext = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg';
            $name = 'product_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . preg_replace('/[^a-z0-9]/i', '', $ext);
            $dir = dirname(__DIR__) . '/uploads/products';
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            $dest = $dir . '/' . $name;
            if (!move_uploaded_file($file['tmp_name'], $dest)) {
                api_error('Could not save file', 500);
            }
            api_json(['data' => ['url' => '/uploads/products/' . $name]]);

        case 'categories':
            $stmt = $pdo->query('SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category');
            api_json(['data' => $stmt->fetchAll(PDO::FETCH_COLUMN)]);

        case 'cms_content':
            $hasCms = db_has_table($pdo, 'cms_content');
            if (!$hasCms) {
                api_json(['data' => []]);
            }
            if ($method === 'GET') {
                $status = $_GET['status'] ?? 'published';
                $category = $_GET['category'] ?? null;
                $sql = 'SELECT id, title, slug, content, category, status, excerpt, author_id, created_at FROM cms_content WHERE status = ?';
                $params = [$status];
                if ($category) {
                    $sql .= ' AND category = ?';
                    $params[] = $category;
                }
                $sql .= ' ORDER BY created_at DESC LIMIT 50';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                api_json(['data' => $stmt->fetchAll()]);
            }
            $userId = require_auth($pdo, $config);
            require_roles($pdo, $userId, ['admin', 'super_admin']);
            $b = api_body();
            if ($method === 'POST') {
                $id = uuid();
                $slug = trim($b['slug'] ?? '') ?: strtolower(preg_replace('/[^a-z0-9]+/i', '-', $b['title'] ?? 'post'));
                $pdo->prepare(
                    'INSERT INTO cms_content (id, title, slug, content, category, status, excerpt, author_id) VALUES (?,?,?,?,?,?,?,?)'
                )->execute([
                    $id,
                    $b['title'] ?? 'Untitled',
                    $slug,
                    $b['content'] ?? '',
                    $b['category'] ?? 'announcement',
                    $b['status'] ?? 'draft',
                    $b['excerpt'] ?? '',
                    $userId,
                ]);
                api_json(['data' => ['id' => $id]], 201);
            }
            if ($method === 'PUT' && !empty($_GET['id'])) {
                $pdo->prepare(
                    'UPDATE cms_content SET title=?, slug=?, content=?, category=?, status=?, excerpt=? WHERE id=?'
                )->execute([
                    $b['title'] ?? '',
                    $b['slug'] ?? '',
                    $b['content'] ?? '',
                    $b['category'] ?? 'announcement',
                    $b['status'] ?? 'draft',
                    $b['excerpt'] ?? '',
                    $_GET['id'],
                ]);
                api_json(['data' => ['id' => $_GET['id']]]);
            }
            if ($method === 'DELETE' && !empty($_GET['id'])) {
                $pdo->prepare('DELETE FROM cms_content WHERE id = ?')->execute([$_GET['id']]);
                api_json(['data' => ['deleted' => true]]);
            }
            api_error('Method not allowed', 405);

        case 'manufacturers':
            $userId = require_auth($pdo, $config);
            require_roles($pdo, $userId, ['staff', 'admin', 'super_admin']);
            $hasMfr = db_has_column($pdo, 'products', 'manufacturer');
            if ($hasMfr) {
                $stmt = $pdo->query(
                    "SELECT COALESCE(NULLIF(TRIM(manufacturer), ''), 'General') AS name,
                            COUNT(*) AS medicines,
                            SUM(requires_prescription) AS prescriptions,
                            COUNT(DISTINCT category) AS divisions
                     FROM products
                     GROUP BY COALESCE(NULLIF(TRIM(manufacturer), ''), 'General')
                     ORDER BY medicines DESC"
                );
            } else {
                $stmt = $pdo->query(
                    "SELECT COALESCE(NULLIF(TRIM(category), ''), 'general') AS name,
                            COUNT(*) AS medicines,
                            SUM(requires_prescription) AS prescriptions,
                            1 AS divisions
                     FROM products
                     GROUP BY COALESCE(NULLIF(TRIM(category), ''), 'general')
                     ORDER BY medicines DESC"
                );
            }
            api_json(['data' => $stmt->fetchAll()]);

        case 'backup':
            // Full data backup as JSON download (admin only).
            // GET /api/index.php?action=backup
            $userId = require_auth($pdo, $config);
            require_roles($pdo, $userId, ['admin', 'super_admin']);
            $tables = ['users', 'products', 'profiles', 'user_roles', 'orders', 'order_items', 'sales', 'suppliers', 'purchase_orders', 'purchase_order_items', 'pharmacy_settings', 'notifications', 'cms_content'];
            $dump = [
                'meta' => [
                    'service' => 'Medsuite-eT backup',
                    'version' => '2.0.0',
                    'exported_at' => date('c'),
                    'driver' => $pdo->getAttribute(PDO::ATTR_DRIVER_NAME),
                ],
                'tables' => [],
            ];
            foreach ($tables as $t) {
                if (!db_has_table($pdo, $t)) {
                    continue;
                }
                $dump['tables'][$t] = $pdo->query("SELECT * FROM {$t}")->fetchAll();
            }
            header('Content-Disposition: attachment; filename="medsuite-backup-' . date('Ymd-His') . '.json"');
            api_json($dump);

        case 'restore':
            // Restore from a JSON backup (admin only).
            // POST JSON body {"tables": {"products": [...], ...}} with ?mode=replace (default) or merge.
            // Or multipart upload with file field "file".
            if ($method !== 'POST') {
                api_error('POST required', 405);
            }
            $userId = require_auth($pdo, $config);
            require_roles($pdo, $userId, ['admin', 'super_admin']);
            $body = api_body();
            if (empty($body['tables']) && !empty($_FILES['file']['tmp_name'])) {
                $raw = file_get_contents($_FILES['file']['tmp_name']);
                $body = json_decode($raw ?: '', true) ?: [];
            }
            $incoming = $body['tables'] ?? null;
            if (!is_array($incoming) || $incoming === []) {
                api_error('No tables found in backup (expected {"tables": {...}})');
            }
            $allowed = ['users', 'products', 'profiles', 'user_roles', 'orders', 'order_items', 'sales', 'suppliers', 'purchase_orders', 'purchase_order_items', 'pharmacy_settings', 'notifications', 'cms_content'];
            $mode = $_GET['mode'] ?? 'replace';
            if (!in_array($mode, ['replace', 'merge'], true)) {
                api_error('mode must be replace or merge');
            }
            // Children first for deletes, parents first for inserts.
            $order = ['order_items', 'orders', 'purchase_order_items', 'purchase_orders', 'sales', 'notifications', 'profiles', 'user_roles', 'products', 'suppliers', 'pharmacy_settings', 'users', 'cms_content'];
            $counts = [];
            try {
                $pdo->beginTransaction();
                db_fk_off($pdo);
                if ($mode === 'replace') {
                    foreach ($order as $t) {
                        if (isset($incoming[$t]) && db_has_table($pdo, $t)) {
                            $pdo->exec("DELETE FROM {$t}");
                        }
                    }
                }
                foreach (array_reverse($order) as $t) {
                    if (!isset($incoming[$t]) || !is_array($incoming[$t]) || !db_has_table($pdo, $t)) {
                        continue;
                    }
                    $cols = [];
                    foreach ($incoming[$t] as $row) {
                        if (is_array($row)) {
                            $cols = array_keys($row);
                            break;
                        }
                    }
                    if ($cols === []) {
                        continue;
                    }
                    if (db_is_sqlite($pdo)) {
                        $tableCols = array_column($pdo->query("SELECT name FROM pragma_table_info('{$t}')")->fetchAll(), 'name');
                    } else {
                        $tableCols = array_column($pdo->query("SHOW COLUMNS FROM `{$t}`")->fetchAll(), 'Field');
                    }
                    $cols = array_values(array_intersect($cols, $tableCols));
                    if ($cols === []) {
                        continue;
                    }
                    $place = implode(',', array_fill(0, count($cols), '?'));
                    $ins = $pdo->prepare("INSERT INTO {$t} (" . implode(',', $cols) . ") VALUES ({$place})");
                    $n = 0;
                    foreach ($incoming[$t] as $row) {
                        if (!is_array($row)) {
                            continue;
                        }
                        $ins->execute(array_map(function ($c) use ($row) {
                            $v = $row[$c] ?? null;
                            return is_array($v) ? json_encode($v, JSON_UNESCAPED_UNICODE) : $v;
                        }, $cols));
                        $n++;
                    }
                    $counts[$t] = $n;
                }
                db_fk_on($pdo);
                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                try {
                    db_fk_on($pdo);
                } catch (Throwable $ignored) {
                }
                throw $e;
            }
            api_json(['data' => ['restored' => $counts, 'mode' => $mode]]);

        case 'export_csv':
            // CSV export for readable backups (admin/staff).
            // GET /api/index.php?action=export_csv&table=products|sales|orders
            $userId = require_auth($pdo, $config);
            require_roles($pdo, $userId, ['staff', 'admin', 'super_admin']);
            $allowedCsv = ['products', 'sales', 'orders', 'suppliers', 'purchase_orders'];
            $csvTable = $_GET['table'] ?? 'products';
            if (!in_array($csvTable, $allowedCsv, true) || !db_has_table($pdo, $csvTable)) {
                api_error('Unknown or missing table (products|sales|orders|suppliers|purchase_orders)');
            }
            $rows = $pdo->query("SELECT * FROM {$csvTable}")->fetchAll();
            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="medsuite-' . $csvTable . '-' . date('Ymd-His') . '.csv"');
            $out = fopen('php://output', 'w');
            if ($rows === []) {
                fclose($out);
                exit;
            }
            fputcsv($out, array_keys($rows[0]));
            foreach ($rows as $r) {
                fputcsv($out, array_map(function ($v) {
                    return is_array($v) ? json_encode($v, JSON_UNESCAPED_UNICODE) : $v;
                }, array_values($r)));
            }
            fclose($out);
            exit;

        case 'import_csv':
            // CSV product import (admin). Columns like medsuite_import.csv:
            // name,name_bn,generic_name,manufacturer,category,price,stock,min_stock,batch_number,expiry_date,requires_prescription,description
            if ($method !== 'POST') {
                api_error('POST required', 405);
            }
            $userId = require_auth($pdo, $config);
            require_roles($pdo, $userId, ['admin', 'super_admin']);
            if (empty($_FILES['file']['tmp_name'])) {
                api_error('CSV file required (field "file")');
            }
            $fh = fopen($_FILES['file']['tmp_name'], 'r');
            $header = fgetcsv($fh);
            if (!$header) {
                api_error('Empty CSV');
            }
            $header = array_map(function ($h) {
                return strtolower(trim((string) $h));
            }, $header);
            $replace = !empty($_POST['replace']);
            $imported = 0;
            try {
                $pdo->beginTransaction();
                if ($replace) {
                    db_fk_off($pdo);
                    $pdo->exec('DELETE FROM order_items');
                    $pdo->exec('DELETE FROM products');
                    db_fk_on($pdo);
                }
                $ins = $pdo->prepare('INSERT INTO products (id, name, name_bn, generic_name, manufacturer, category, price, stock, min_stock, batch_number, expiry_date, requires_prescription, description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
                while (($line = fgetcsv($fh)) !== false) {
                    $row = array_combine($header, $line);
                    if (!$row || trim((string) ($row['name'] ?? '')) === '') {
                        continue;
                    }
                    $req = strtolower(trim((string) ($row['requires_prescription'] ?? '')));
                    $ins->execute([
                        uuid(),
                        trim((string) $row['name']),
                        $row['name_bn'] ?? null,
                        ($row['generic_name'] ?? '') !== '' && ($row['generic_name'] ?? '') !== 'N/A' ? $row['generic_name'] : null,
                        ($row['manufacturer'] ?? '') !== '' && ($row['manufacturer'] ?? '') !== 'Unknown' ? $row['manufacturer'] : null,
                        ($row['category'] ?? '') !== '' ? $row['category'] : 'Uncategorized',
                        (float) ($row['price'] ?? 0),
                        (int) ($row['stock'] ?? 0),
                        (int) ($row['min_stock'] ?? 10),
                        ($row['batch_number'] ?? '') !== '' ? $row['batch_number'] : null,
                        ($row['expiry_date'] ?? '') !== '' ? $row['expiry_date'] : null,
                        in_array($req, ['1', 'true', 'yes', 'required'], true) ? 1 : 0,
                        $row['description'] ?? null,
                    ]);
                    $imported++;
                }
                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            } finally {
                fclose($fh);
            }
            api_json(['data' => ['imported' => $imported]]);

        default:
            api_error("Unknown action: $action", 400);
    }
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Medsuite-eT API: ' . $e->getMessage());
    api_json(['error' => 'Internal server error', 'status' => 500], 500);
}
