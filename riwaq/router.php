<?php
declare(strict_types=1);

// The built-in server otherwise exposes local setup output and database scripts.
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
$path = str_replace('\\', '/', $path);
if (str_contains($path, '..') || str_contains($path, '/.')) {
    http_response_code(404);
    exit;
}

$api = preg_match('~^/api/(clubs|posts|events|socials|upload|login|logout|session|accounts)\.php$~', $path);
$static = preg_match('~^/$|^/(?:admin|presidents)/?$|^/(?:admin|presidents)/index\.html$|^/(?:admin|presidents)/[a-zA-Z0-9_-]+\.(?:css|js)$|^/[a-zA-Z0-9_-]+\.(?:css|js)$|^/assets/[a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png|webp|gif|svg|ico|woff2|js)$|^/uploads/[a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png|webp|gif)$|^/رواق\.html$|^/favicon\.ico$~u', $path);
if (!$api && !$static) {
    http_response_code(404);
    exit;
}

if ($api) return false;

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
if (in_array($path, ['/admin', '/presidents'], true)) {
    header('Location: ' . $path . '/', true, 308);
    exit;
}

if ($path === '/') {
    header('Location: /رواق.html', true, 302);
    exit;
}

$file = preg_match('~^/(admin|presidents)/?$~', $path) ? __DIR__ . $path . '/index.html' : __DIR__ . $path;
$resolved = realpath($file);
if (!$resolved || !str_starts_with($resolved, __DIR__ . DIRECTORY_SEPARATOR) || !is_file($resolved)) {
    http_response_code(404);
    exit;
}

$types = [
    'html' => 'text/html; charset=utf-8', 'css' => 'text/css; charset=utf-8',
    'js' => 'application/javascript; charset=utf-8', 'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp',
    'gif' => 'image/gif', 'svg' => 'image/svg+xml', 'ico' => 'image/x-icon',
    'woff2' => 'font/woff2',
];
header('Content-Type: ' . ($types[strtolower(pathinfo($resolved, PATHINFO_EXTENSION))] ?? 'application/octet-stream'));
header('Cache-Control: no-store, max-age=0');
readfile($resolved);
exit;
