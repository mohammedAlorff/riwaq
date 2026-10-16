<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/api/auth_helpers.php';
if (!preg_match('/^riwaq_test_[a-f0-9]{16}$/D', riwaq_config()['db']['name'])) {
    throw new RuntimeException('Requires isolated test configuration.');
}
$results = [];
$check = function (bool $ok, string $name) use (&$results): void {
    if (!$ok) throw new RuntimeException($name);
    $results[] = 'PASS ' . $name;
};
$_SERVER = ['REMOTE_ADDR' => '198.51.100.15', 'HTTP_X_FORWARDED_FOR' => '203.0.113.8',
    'HTTP_X_FORWARDED_PROTO' => 'https', 'HTTPS' => 'off'];
$check(riwaq_client_ip() === '198.51.100.15', 'spoofed forwarding headers cannot change client identity');
$check(!riwaq_is_https(), 'untrusted forwarding headers cannot change transport detection');
$_SERVER['REMOTE_ADDR'] = '192.0.2.10';
$_SERVER['HTTP_X_FORWARDED_FOR'] = '203.0.113.8, 198.51.100.15';
$check(riwaq_client_ip() === '198.51.100.15', 'trusted proxy chain stops at the nearest untrusted client');
$check(riwaq_is_https(), 'explicitly trusted HTTPS proxy is recognized');
$check(riwaq_validate_password(str_repeat('a',73)) !== null, 'new bcrypt passwords cannot silently truncate');
$db = riwaq_db();
$loginKey = hash('sha256', 'login:regression');
$db->prepare('INSERT INTO rate_limits (key_hash,request_count,window_start) VALUES (?,10,DATE_SUB(NOW(),INTERVAL 120 SECOND))')
    ->execute([$loginKey]);
mt_srand(7);
for ($i=0;$i<200;$i++) riwaq_rate_limit('read:regression', 1000, 60);
$query=$db->prepare('SELECT request_count FROM rate_limits WHERE key_hash=?');
$query->execute([$loginKey]);
$check((int)$query->fetchColumn() === 10, 'read cleanup retains active fifteen-minute login buckets');
$userId = (int)$db->query("SELECT id FROM users WHERE username='test_admin'")->fetchColumn();
$token = riwaq_create_session($userId);
$query = $db->prepare('SELECT TIMESTAMPDIFF(SECOND,NOW(),expires_at) FROM sessions WHERE token=?');
$query->execute([$token]);
$remaining = (int)$query->fetchColumn();
$check(abs($remaining - riwaq_config()['session_ttl_seconds']) <= 2, 'database and cookie session lifetimes agree');
$check(riwaq_csrf_token($token) !== riwaq_csrf_token(str_repeat('a',64)), 'CSRF tokens are bound to a single session');
echo implode("\n", $results), "\n";
