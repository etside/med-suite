<?php
/**
 * Create first super_admin user (CLI only).
 * Usage: php public/api/seed-admin.php email@example.com YourPassword
 */
if (php_sapi_name() !== 'cli') {
    exit('CLI only');
}

require __DIR__ . '/inc/helpers.php';

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    fwrite(STDERR, "Copy config.example.php to config.php first.\n");
    exit(1);
}

$config = require $configPath;
$email = strtolower($argv[1] ?? '');
$password = $argv[2] ?? '';

if ($email === '' || $password === '') {
    fwrite(STDERR, "Usage: php seed-admin.php email@example.com password\n");
    exit(1);
}

try {
    $pdo = db_connect($config);
} catch (PDOException $e) {
    fwrite(STDERR, "Database connection failed.\n");
    exit(1);
}

$check = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$check->execute([$email]);
if ($check->fetch()) {
    fwrite(STDERR, "User already exists.\n");
    exit(1);
}

$userId = uuid();
$hash = password_hash($password, PASSWORD_DEFAULT);
$pdo->beginTransaction();
$pdo->prepare('INSERT INTO users (id, email, password_hash) VALUES (?,?,?)')->execute([$userId, $email, $hash]);
$pdo->prepare('INSERT INTO profiles (id, user_id, full_name, approval_status) VALUES (?,?,?,?)')->execute([uuid(), $userId, 'Super Admin', 'approved']);
$pdo->prepare('INSERT INTO user_roles (id, user_id, role) VALUES (?,?,?)')->execute([uuid(), $userId, 'super_admin']);
$pdo->commit();

echo "Super admin created: $email\n";
