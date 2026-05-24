<?php
/**
 * رواق — مرافق REST عامة
 *  - استجابة JSON
 *  - قراءة جسم JSON
 *  - تأكيد طريقة HTTP
 *  - CORS
 */

declare(strict_types=1);

function riwaq_send_json($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function riwaq_error(string $code, string $message, int $status = 400, array $extra = []): void {
    riwaq_send_json(array_merge([
        'ok'      => false,
        'error'   => $code,
        'message' => $message,
    ], $extra), $status);
}

function riwaq_ok($data = null, array $extra = []): void {
    $body = ['ok' => true];
    if ($data !== null) $body['data'] = $data;
    if ($extra) $body = array_merge($body, $extra);
    riwaq_send_json($body, 200);
}

function riwaq_method(): string {
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

function riwaq_require_method(string ...$allowed): void {
    if (!in_array(riwaq_method(), $allowed, true)) {
        header('Allow: ' . implode(', ', $allowed));
        riwaq_error('method_not_allowed', 'طريقة الطلب غير مدعومة.', 405);
    }
}

function riwaq_read_json(): array {
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) return [];
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        riwaq_error('invalid_json', 'الجسم ليس JSON صالحًا.', 400);
    }
    return $data;
}

function riwaq_client_ip(): string {
    $candidates = ['HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'];
    foreach ($candidates as $k) {
        if (!empty($_SERVER[$k])) {
            $ip = trim(explode(',', $_SERVER[$k])[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
        }
    }
    return '';
}

function riwaq_handle_cors(): void {
    $origin = riwaq_config()['cors_origin'] ?? '';
    if ($origin === '') {
        // نفس الـ origin — لا نحتاج CORS
        if (riwaq_method() === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
        return;
    }
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
    header('Access-Control-Max-Age: 86400');
    if (riwaq_method() === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// نص آمن (يحذف whitespace، يقصر الطول)
function riwaq_str(?string $value, int $maxLen = 1000): string {
    if ($value === null) return '';
    $v = trim($value);
    if (mb_strlen($v) > $maxLen) $v = mb_substr($v, 0, $maxLen);
    return $v;
}

function riwaq_require_field($value, string $name): void {
    if ($value === null || $value === '' || (is_array($value) && empty($value))) {
        riwaq_error('missing_field', "الحقل '$name' مطلوب.", 422);
    }
}

// تنسيق صف منشور للاستجابة JSON
function riwaq_format_post(array $row): array {
    return [
        'id'              => (int)$row['id'],
        'clubId'          => $row['club_id'],
        'type'            => $row['type'],
        'title'           => $row['title'],
        'body'            => $row['body'],
        'tags'            => $row['tags'] !== null ? json_decode($row['tags'], true) : [],
        'image'           => $row['image'],
        'externalUrl'     => $row['external_url'],
        'linkedEventId'   => $row['linked_event_id'] !== null ? (int)$row['linked_event_id'] : null,
        'createdAt'       => $row['created_at'],
    ];
}

function riwaq_format_event(array $row): array {
    return [
        'id'              => (int)$row['id'],
        'clubId'          => $row['club_id'],
        'title'           => $row['title'],
        'description'     => $row['description'],
        'date'            => $row['event_date'],   // ISO YYYY-MM-DD
        'time'            => $row['event_time'],   // HH:MM:SS
        'location'        => $row['location'],
        'spots'           => (int)$row['spots'],
        'taken'           => (int)$row['taken'],
        'registrationUrl' => $row['registration_url'],
        'createdAt'       => $row['created_at'],
    ];
}

function riwaq_format_club(array $row): array {
    return [
        'id'          => $row['id'],
        'name'        => $row['name'],
        'short'       => $row['short_name'],
        'cat'         => $row['category'],
        'college'     => $row['college'],
        'members'     => (int)$row['members'],
        'color'       => $row['color'],
        'icon'        => $row['icon'],
        'image'       => $row['image'] ?? null,
        'desc'        => $row['description'],
        'cover'       => $row['cover'],
    ];
}

/**
 * يولّد تدرّجاً لونياً (CSS linear-gradient) من لون أساسي.
 * يخفّف اللون قليلاً للحصول على تدرّج طبيعي.
 */
function riwaq_make_cover(string $color): string {
    $hex = ltrim($color, '#');
    if (!preg_match('/^[0-9a-fA-F]{6}$/', $hex)) {
        return "linear-gradient(135deg, $color 0%, $color 100%)";
    }
    $r = hexdec(substr($hex, 0, 2));
    $g = hexdec(substr($hex, 2, 2));
    $b = hexdec(substr($hex, 4, 2));
    // فاتح ٢٥٪
    $lr = min(255, (int)($r + (255 - $r) * 0.25));
    $lg = min(255, (int)($g + (255 - $g) * 0.25));
    $lb = min(255, (int)($b + (255 - $b) * 0.25));
    $light = sprintf('#%02x%02x%02x', $lr, $lg, $lb);
    return "linear-gradient(135deg, $color 0%, $light 100%)";
}

/**
 * يولّد ID فريد جديد للنادي بصيغة c{N}.
 */
function riwaq_next_club_id(PDO $db): string {
    $max = (int)$db->query(
        "SELECT IFNULL(MAX(CAST(SUBSTRING(id, 2) AS UNSIGNED)), 0)
           FROM clubs
          WHERE id REGEXP '^c[0-9]+$'"
    )->fetchColumn();
    return 'c' . ($max + 1);
}

function riwaq_format_social(array $row): array {
    return [
        'platform' => $row['platform'],
        'handle'   => $row['handle'],
        'url'      => $row['url'],
    ];
}
