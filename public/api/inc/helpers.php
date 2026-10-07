<?php

function api_json($payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function api_error(string $message, int $status = 400): void
{
    api_json(['error' => $message, 'status' => $status], $status);
}

function api_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function uuid(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.+)/i', $header, $m)) {
        return trim($m[1]);
    }
    return null;
}

function get_bearer_token(): ?string
{
    return bearer_token();
}

function create_token(string $userId, string $secret, int $ttl = 604800): string
{
    $payload = base64_encode(json_encode([
        'sub' => $userId,
        'exp' => time() + $ttl,
    ]));
    $sig = hash_hmac('sha256', $payload, $secret);
    return $payload . '.' . $sig;
}

function verify_token($pdo, ?string $token, string $secret): ?array
{
    if (!$token) {
        return null;
    }
    $parts = explode('.', $token, 2);
    if (count($parts) !== 2) {
        return null;
    }
    [$payload, $sig] = $parts;
    if (!hash_equals(hash_hmac('sha256', $payload, $secret), $sig)) {
        return null;
    }
    $data = json_decode(base64_decode($payload, true), true);
    if (!is_array($data) || empty($data['sub']) || empty($data['exp']) || $data['exp'] < time()) {
        return null;
    }
    
    $userId = (string) $data['sub'];
    $stmt = $pdo->prepare('SELECT id, email FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function current_user_id(PDO $pdo, array $config): ?string
{
    $token = bearer_token();
    if (!$token) {
        return null;
    }
    $user = verify_token($pdo, $token, $config['jwt_secret'] ?? 'change-me-in-config');
    return $user ? (string) $user['id'] : null;
}

function user_roles(PDO $pdo, string $userId): array
{
    $stmt = $pdo->prepare('SELECT role FROM user_roles WHERE user_id = ?');
    $stmt->execute([$userId]);
    return $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
}

function require_auth(PDO $pdo, array $config): string
{
    $userId = current_user_id($pdo, $config);
    if (!$userId) {
        api_error('Unauthorized', 401);
    }
    return $userId;
}

function require_roles(PDO $pdo, string $userId, array $allowed): void
{
    $roles = user_roles($pdo, $userId);
    if (!array_intersect($roles, $allowed)) {
        api_error('Forbidden', 403);
    }
}

function is_staff_role(array $roles): bool
{
    return (bool) array_intersect($roles, ['staff', 'admin', 'super_admin']);
}

/**
 * Shared PDO factory (MySQL default, SQLite file mode for VPS).
 * SQLite keeps all data in one file on the VPS: easy backup/restore.
 */
function db_driver(array $config): string
{
    return strtolower($config['db_driver'] ?? 'mysql');
}

function db_connect(array $config): PDO
{
    if (db_driver($config) === 'sqlite') {
        $dbPath = $config['db_path'] ?? '/var/www/med-data/med-suite.sqlite';
        $dir = dirname($dbPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $pdo = new PDO('sqlite:' . $dbPath, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA journal_mode = WAL');
        $pdo->exec('PRAGMA busy_timeout = 5000');
        return $pdo;
    }
    $dsn = "mysql:host={$config['db_host']};port={$config['db_port']};dbname={$config['db_name']};charset=utf8mb4";
    return new PDO($dsn, $config['db_user'], $config['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}

function db_is_sqlite(PDO $pdo): bool
{
    return $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
}

function db_has_table(PDO $pdo, string $table): bool
{
    if (db_is_sqlite($pdo)) {
        $st = $pdo->prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?");
        $st->execute([$table]);
        return (bool) $st->fetchColumn();
    }
    $st = $pdo->prepare('SHOW TABLES LIKE ?');
    $st->execute([$table]);
    return (bool) $st->fetch();
}

function db_has_column(PDO $pdo, string $table, string $col): bool
{
    if (db_is_sqlite($pdo)) {
        $safe = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
        foreach ($pdo->query("PRAGMA table_info({$safe})") as $row) {
            if (($row['name'] ?? null) === $col) {
                return true;
            }
        }
        return false;
    }
    return (bool) $pdo->query("SHOW COLUMNS FROM `$table` LIKE " . $pdo->quote($col))->fetch();
}

function db_fk_off(PDO $pdo): void
{
    if (db_is_sqlite($pdo)) {
        $pdo->exec('PRAGMA foreign_keys = OFF');
    } else {
        $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
    }
}

function db_fk_on(PDO $pdo): void
{
    if (db_is_sqlite($pdo)) {
        $pdo->exec('PRAGMA foreign_keys = ON');
    } else {
        $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
    }
}
