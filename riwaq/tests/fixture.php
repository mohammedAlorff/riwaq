<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root = dirname(__DIR__);
$mode = $argv[1] ?? '';
$configPath = $argv[2] ?? '';
if ($mode === 'create') {
    $localPath = getenv('RIWAQ_TEST_SOURCE_CONFIG') ?: $root . '/api/config.local.php';
    $config = require $localPath;
    if (!in_array($config['db']['host'], ['127.0.0.1', 'localhost', '::1'], true)) {
        throw new RuntimeException('Tests require a local database server.');
    }
    $config['db']['name'] = 'riwaq_test_' . bin2hex(random_bytes(8));
    $config['db']['user'] = getenv('RIWAQ_TEST_DB_USER') ?: 'root';
    $config['db']['password'] = getenv('RIWAQ_TEST_DB_PASSWORD') ?: '';
    $config['uploads_dir'] = dirname($configPath) . '/uploads';
    $config['trusted_proxies'] = ['192.0.2.10'];
    $config['debug'] = false;
} else {
    $config = require $configPath;
}
$dbConfig = $config['db'];
$name = $dbConfig['name'];
if (!preg_match('/^riwaq_test_[a-f0-9]{16}$/D', $name)
    || !in_array($dbConfig['host'], ['127.0.0.1', 'localhost', '::1'], true)) {
    throw new RuntimeException('Refusing a non-test database.');
}
$db = new PDO(sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $dbConfig['host'], $dbConfig['port']),
    $dbConfig['user'], $dbConfig['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
if ($mode === 'drop') {
    $db->exec("DROP DATABASE IF EXISTS `$name`");
    exit;
}
if ($mode === 'reset-limits') {
    $db->exec("USE `$name`");
    $db->exec('DELETE FROM rate_limits');
    $db->exec('DELETE FROM login_attempts');
    exit;
}
if ($mode !== 'create') throw new RuntimeException('Unknown fixture operation.');
$db->exec("CREATE DATABASE `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
// Persist the random test name before initialization so the runner can clean up on failure.
file_put_contents($configPath, "<?php\nreturn " . var_export($config, true) . ";\n");
$db->exec("USE `$name`");
$sql = preg_replace('/--[^\r\n]*/', '', file_get_contents($root . '/api/schema.sql'));
foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) $db->exec($statement);
$password = bin2hex(random_bytes(16));
$db->prepare("INSERT INTO users (username,password_hash,role) VALUES ('test_admin',?,'admin')")
    ->execute([password_hash($password, PASSWORD_BCRYPT)]);
echo json_encode(['username' => 'test_admin', 'password' => $password]);
