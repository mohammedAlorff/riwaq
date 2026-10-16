<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli-server') { http_response_code(404); exit; }
$config = require getenv('RIWAQ_CONFIG_PATH');
if (!preg_match('/^riwaq_test_[a-f0-9]{16}$/D', $config['db']['name'])) {
    throw new RuntimeException('Refusing a non-test server.');
}
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if (preg_match('~^/uploads/([a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png|webp|gif))$~', $path, $match)) {
    $file = $config['uploads_dir'] . '/' . $match[1];
    if (!is_file($file)) { http_response_code(404); exit; }
    header('Content-Type: ' . (new finfo(FILEINFO_MIME_TYPE))->file($file));
    header('X-Content-Type-Options: nosniff');
    readfile($file);
    exit;
}
return require dirname(__DIR__) . '/router.php';
