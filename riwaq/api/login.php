<?php
declare(strict_types=1);

require_once __DIR__ . '/auth_helpers.php';
riwaq_handle_cors();
riwaq_require_method('POST');

// rate limit بالـ IP
$ip = riwaq_client_ip() ?: 'unknown';
$cfg = riwaq_config()['rate_limit'];
riwaq_rate_limit("login:$ip", (int)$cfg['login_per_ip_per_15min'], 900);

$body     = riwaq_read_json();
$username = riwaq_str($body['username'] ?? '', 64);
$password = riwaq_password_input($body['password'] ?? '');

if ($username === '' || $password === '') {
    riwaq_log_login_attempt($username ?: null, false);
    // تأخير ثابت لتثبيط الفحص
    usleep(400000);
    riwaq_error('invalid_credentials', 'اسم المستخدم وكلمة المرور مطلوبان.', 401);
}

// قبل المحاولة: لو الـ IP أو username فيهم عدد كبير من المحاولات الفاشلة، أبطئ بشكل ملحوظ
$failed = riwaq_recent_failed_attempts($username, $ip, 900);
if ($failed >= 8) {
    // تأخير تصاعدي خفيف
    usleep(min(1500000, 400000 + ($failed - 7) * 200000));
}

$stmt = riwaq_db()->prepare(
    "SELECT id, username, password_hash, role, club_id
       FROM users
      WHERE username = :u
      LIMIT 1"
);
$stmt->execute([':u' => $username]);
$user = $stmt->fetch();

$valid = ($user !== false) && riwaq_verify_password($password, $user['password_hash']);

if (!$valid) {
    riwaq_log_login_attempt($username, false);
    usleep(400000);
    riwaq_error('invalid_credentials', 'اسم المستخدم أو كلمة المرور غير صحيحة.', 401);
}

$db = riwaq_db();
$db->beginTransaction();
try {
    // A reset/deletion must serialize with issuance, including an already-verified login.
    $locked = $db->prepare('SELECT id, username, password_hash, role, club_id FROM users WHERE id = :id FOR UPDATE');
    $locked->execute([':id' => $user['id']]);
    $current = $locked->fetch();
    if (!$current || !hash_equals($user['password_hash'], $current['password_hash'])) {
        $db->rollBack();
        riwaq_log_login_attempt($username, false);
        riwaq_error('invalid_credentials', 'اسم المستخدم أو كلمة المرور غير صحيحة.', 401);
    }
    $user = $current;
    if ($user['role'] === 'president') {
        if (!$user['club_id']) {
            $db->rollBack();
            riwaq_error('account_misconfigured', 'الحساب غير مرتبط بنادٍ.', 500);
        }
        $check = $db->prepare('SELECT 1 FROM clubs WHERE id = :c');
        $check->execute([':c' => $user['club_id']]);
        if (!$check->fetchColumn()) {
            $db->rollBack();
            riwaq_error('club_missing', 'النادي المرتبط بهذا الحساب غير موجود.', 410);
        }
    }
    $token = riwaq_create_session((int)$user['id']);
    $db->prepare('UPDATE users SET last_login_at = NOW() WHERE id = :id')->execute([':id' => $user['id']]);
    riwaq_log_login_attempt($username, true);
    $db->commit();
} catch (Throwable $e) {
    if ($db->inTransaction()) $db->rollBack();
    throw $e;
}
riwaq_set_session_cookies($token);

riwaq_audit([
    'id'       => (int)$user['id'],
    'username' => $user['username'],
], 'login');

riwaq_ok([
    'username' => $user['username'],
    'role'     => $user['role'],
    'clubId'   => $user['club_id'],
]);
