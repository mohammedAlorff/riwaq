<?php
/**
 * رواق — مرافق المصادقة والصلاحيات
 *
 *   - التحقق من الجلسة (token في cookie httpOnly).
 *   - حماية CSRF (double-submit token).
 *   - rate limiting (للـ login والـ writes).
 *   - تسجيل التدقيق.
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

const RIWAQ_COOKIE_SESSION = 'riwaq_session';
const RIWAQ_COOKIE_CSRF    = 'riwaq_csrf';

// -------------------------------------------------------------
// كوكيز
// -------------------------------------------------------------
function riwaq_set_cookie(string $name, string $value, int $expiresAt, bool $httpOnly = true): void {
    $secure = !empty($_SERVER['HTTPS']);
    setcookie($name, $value, [
        'expires'  => $expiresAt,
        'path'     => '/',
        'secure'   => $secure,
        'httponly' => $httpOnly,
        'samesite' => 'Lax',
    ]);
}

function riwaq_clear_cookie(string $name, bool $httpOnly = true): void {
    riwaq_set_cookie($name, '', time() - 3600, $httpOnly);
}

// -------------------------------------------------------------
// إنشاء جلسة
// -------------------------------------------------------------
function riwaq_create_session(int $userId): string {
    $token   = bin2hex(random_bytes(32));   // 64 hex chars
    $ttl     = (int)(riwaq_config()['session_ttl_seconds'] ?? 28800);
    $expires = (new DateTime('@' . (time() + $ttl)))->setTimezone(new DateTimeZone('Asia/Riyadh'));
    $expiresFmt = $expires->format('Y-m-d H:i:s');

    $stmt = riwaq_db()->prepare(
        "INSERT INTO sessions (token, user_id, expires_at, ip_address, user_agent)
         VALUES (:t, :u, :e, :ip, :ua)"
    );
    $stmt->execute([
        ':t'  => $token,
        ':u'  => $userId,
        ':e'  => $expiresFmt,
        ':ip' => riwaq_client_ip() ?: null,
        ':ua' => mb_substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255) ?: null,
    ]);

    riwaq_set_cookie(RIWAQ_COOKIE_SESSION, $token, time() + $ttl, true);
    // CSRF token (مكشوف للـ JS كي يقرأه ويرسله في الـ header)
    $csrf = bin2hex(random_bytes(16));
    riwaq_set_cookie(RIWAQ_COOKIE_CSRF, $csrf, time() + $ttl, false);

    return $token;
}

function riwaq_destroy_session(string $token): void {
    $stmt = riwaq_db()->prepare("DELETE FROM sessions WHERE token = :t");
    $stmt->execute([':t' => $token]);
    riwaq_clear_cookie(RIWAQ_COOKIE_SESSION, true);
    riwaq_clear_cookie(RIWAQ_COOKIE_CSRF, false);
}

/**
 * يعيد المستخدم الحالي أو null. لا يطلب — للتحقق غير الإلزامي.
 */
function riwaq_current_user(): ?array {
    static $cached = false;
    static $user   = null;
    if ($cached) return $user;
    $cached = true;

    $token = $_COOKIE[RIWAQ_COOKIE_SESSION] ?? '';
    if ($token === '' || strlen($token) !== 64 || !ctype_xdigit($token)) {
        return $user = null;
    }

    $stmt = riwaq_db()->prepare(
        "SELECT u.id, u.username, u.role, u.club_id, s.expires_at, s.token
           FROM sessions s
           JOIN users u ON u.id = s.user_id
          WHERE s.token = :t AND s.expires_at > NOW()
          LIMIT 1"
    );
    $stmt->execute([':t' => $token]);
    $row = $stmt->fetch();
    if (!$row) return $user = null;

    return $user = [
        'id'        => (int)$row['id'],
        'username'  => $row['username'],
        'role'      => $row['role'],
        'clubId'    => $row['club_id'],
        'token'     => $row['token'],
        'expiresAt' => $row['expires_at'],
    ];
}

/**
 * يفرض وجود مستخدم مسجَّل دخوله، وإلا 401.
 * يقبل دور(أدوار) معينة عبر الـ args.
 */
function riwaq_require_user(string ...$rolesAllowed): array {
    $u = riwaq_current_user();
    if (!$u) {
        riwaq_error('unauthenticated', 'يجب تسجيل الدخول.', 401);
    }
    if ($rolesAllowed && !in_array($u['role'], $rolesAllowed, true)) {
        riwaq_error('forbidden', 'لا تملك صلاحيات الوصول.', 403);
    }
    return $u;
}

// -------------------------------------------------------------
// CSRF
// -------------------------------------------------------------
function riwaq_require_csrf(): void {
    $method = riwaq_method();
    if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) return;
    $cookie = $_COOKIE[RIWAQ_COOKIE_CSRF] ?? '';
    $header = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if ($cookie === '' || $header === '' || !hash_equals($cookie, $header)) {
        riwaq_error('csrf_failed', 'فشل التحقق من توكن CSRF.', 419);
    }
}

// -------------------------------------------------------------
// كلمات المرور (bcrypt)
// -------------------------------------------------------------
function riwaq_hash_password(string $plain): string {
    return password_hash($plain, PASSWORD_BCRYPT, ['cost' => 12]);
}

function riwaq_verify_password(string $plain, string $hash): bool {
    return password_verify($plain, $hash);
}

// -------------------------------------------------------------
// rate limit
// -------------------------------------------------------------
function riwaq_rate_limit(string $bucket, int $maxPerWindow, int $windowSeconds): void {
    $key = hash('sha256', $bucket);
    $db  = riwaq_db();
    // نظّف النوافذ القديمة دورياً (بساطة: كل طلب فيه فرصة ٣٪)
    if (mt_rand(0, 99) < 3) {
        $db->prepare("DELETE FROM rate_limits WHERE window_start < DATE_SUB(NOW(), INTERVAL :w SECOND)")
           ->execute([':w' => $windowSeconds]);
    }

    $stmt = $db->prepare(
        "INSERT INTO rate_limits (key_hash, request_count, window_start)
         VALUES (:k, 1, NOW())
         ON DUPLICATE KEY UPDATE
           request_count = IF(window_start < DATE_SUB(NOW(), INTERVAL :w SECOND), 1, request_count + 1),
           window_start  = IF(window_start < DATE_SUB(NOW(), INTERVAL :w2 SECOND), NOW(), window_start)"
    );
    $stmt->execute([':k' => $key, ':w' => $windowSeconds, ':w2' => $windowSeconds]);

    $cur = $db->prepare("SELECT request_count FROM rate_limits WHERE key_hash = :k");
    $cur->execute([':k' => $key]);
    $count = (int)($cur->fetchColumn() ?: 0);

    if ($count > $maxPerWindow) {
        header('Retry-After: ' . $windowSeconds);
        riwaq_error('rate_limited', 'عدد كبير من الطلبات — حاول لاحقًا.', 429);
    }
}

// -------------------------------------------------------------
// محاولات تسجيل الدخول (للحماية من البروت فورس)
// -------------------------------------------------------------
function riwaq_log_login_attempt(?string $username, bool $success): void {
    $stmt = riwaq_db()->prepare(
        "INSERT INTO login_attempts (username, ip_address, success) VALUES (:u, :ip, :s)"
    );
    $stmt->execute([
        ':u'  => $username !== null ? mb_substr($username, 0, 64) : null,
        ':ip' => riwaq_client_ip() ?: null,
        ':s'  => $success ? 1 : 0,
    ]);
}

function riwaq_recent_failed_attempts(?string $username, string $ip, int $windowSeconds = 900): int {
    $stmt = riwaq_db()->prepare(
        "SELECT COUNT(*) FROM login_attempts
          WHERE success = 0
            AND attempted_at > DATE_SUB(NOW(), INTERVAL :w SECOND)
            AND (ip_address = :ip OR username = :u)"
    );
    $stmt->execute([':w' => $windowSeconds, ':ip' => $ip, ':u' => $username]);
    return (int)($stmt->fetchColumn() ?: 0);
}

// -------------------------------------------------------------
// سجل التدقيق
// -------------------------------------------------------------
function riwaq_audit(?array $user, string $action, ?string $resourceType = null, ?string $resourceId = null, ?array $details = null): void {
    try {
        $stmt = riwaq_db()->prepare(
            "INSERT INTO audit_log (user_id, username, action, resource_type, resource_id, details, ip_address)
             VALUES (:uid, :un, :a, :rt, :ri, :d, :ip)"
        );
        $stmt->execute([
            ':uid' => $user['id'] ?? null,
            ':un'  => $user['username'] ?? null,
            ':a'   => $action,
            ':rt'  => $resourceType,
            ':ri'  => $resourceId,
            ':d'   => $details !== null ? json_encode($details, JSON_UNESCAPED_UNICODE) : null,
            ':ip'  => riwaq_client_ip() ?: null,
        ]);
    } catch (Throwable $e) {
        // لا نفشل العملية الأساسية من أجل سجل التدقيق
    }
}

// -------------------------------------------------------------
// التحقق من اسم المستخدم وكلمة المرور
// -------------------------------------------------------------
function riwaq_validate_username(string $u): ?string {
    if (!preg_match('/^[A-Za-z0-9_\-]{3,24}$/', $u)) {
        return 'اسم المستخدم: حروف لاتينية وأرقام و _ - فقط (٣ إلى ٢٤ خانة).';
    }
    return null;
}

function riwaq_validate_password(string $p): ?string {
    if (strlen($p) < 8)   return 'كلمة المرور قصيرة جدًا (٨ خانات على الأقل).';
    if (strlen($p) > 128) return 'كلمة المرور طويلة جدًا.';
    return null;
}
