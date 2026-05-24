<?php
/**
 * رواق — اتصال PDO مفرد (singleton)
 */

declare(strict_types=1);

function riwaq_config(): array {
    static $config = null;
    if ($config !== null) return $config;
    $path = __DIR__ . '/config.php';
    if (!is_file($path)) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'error' => 'configuration_missing',
            'message' => 'انسخ config.example.php إلى config.php وعدّل القيم.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $config = require $path;
    return $config;
}

function riwaq_db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $cfg = riwaq_config()['db'];
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $cfg['host'], $cfg['port'], $cfg['name'], $cfg['charset']
    );
    $mysqlInitCommand = defined('Pdo\\Mysql::ATTR_INIT_COMMAND')
        ? constant('Pdo\\Mysql::ATTR_INIT_COMMAND')
        : PDO::MYSQL_ATTR_INIT_COMMAND;

    try {
        $pdo = new PDO($dsn, $cfg['user'], $cfg['password'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            $mysqlInitCommand            => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
        ]);
    } catch (PDOException $e) {
        $debug = riwaq_config()['debug'] ?? false;
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'error'   => 'database_unavailable',
            'message' => $debug ? $e->getMessage() : 'تعذّر الاتصال بقاعدة البيانات.',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    return $pdo;
}
