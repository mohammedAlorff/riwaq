<?php
declare(strict_types=1);

require_once __DIR__ . '/auth_helpers.php';
riwaq_handle_cors();

$method = riwaq_method();
$db     = riwaq_db();

if ($method === 'GET') {
    $ip = riwaq_client_ip() ?: 'unknown';
    riwaq_rate_limit("read:$ip", (int)riwaq_config()['rate_limit']['read_per_ip_per_min'], 60);

    $clubId = isset($_GET['clubId']) ? trim((string)$_GET['clubId']) : '';
    if ($clubId === '') riwaq_error('missing_field', 'clubId مطلوب.', 422);

    $stmt = $db->prepare("SELECT platform, handle, url FROM socials WHERE club_id = :c");
    $stmt->execute([':c' => $clubId]);
    $map = [];
    foreach ($stmt->fetchAll() as $s) {
        $map[$s['platform']] = ['handle' => $s['handle'], 'url' => $s['url']];
    }
    riwaq_ok($map);
}

if ($method === 'PUT') {
    $u = riwaq_require_user('president');
    riwaq_require_csrf();
    riwaq_rate_limit("write:user:{$u['id']}", (int)riwaq_config()['rate_limit']['write_per_user_per_min'], 60);

    $body = riwaq_read_json();
    if (!is_array($body['socials'] ?? null)) {
        riwaq_error('invalid_body', 'يجب إرسال { socials: {...} }.', 422);
    }
    $socials = $body['socials'];
    $allowed = ['twitter', 'instagram', 'snapchat', 'tiktok', 'telegram'];

    // تنظيف
    $clean = [];
    foreach ($socials as $platform => $entry) {
        if (!in_array($platform, $allowed, true)) continue;
        if (!is_array($entry)) continue;
        $handle = riwaq_str($entry['handle'] ?? '', 120);
        $url    = riwaq_str($entry['url']    ?? '', 500);
        if ($handle === '' && $url === '') continue;
        if ($url === '' && $handle !== '') {
            // اشتقّ URL بسيط
            $clean_h = ltrim($handle, '@');
            $urls = [
                'twitter'   => 'https://twitter.com/'    . $clean_h,
                'instagram' => 'https://instagram.com/'  . $clean_h,
                'snapchat'  => 'https://snapchat.com/add/' . $clean_h,
                'tiktok'    => 'https://tiktok.com/@'    . $clean_h,
                'telegram'  => str_starts_with($clean_h, 't.me/') ? "https://$clean_h" : "https://t.me/$clean_h",
            ];
            $url = $urls[$platform];
        }
        if ($url !== '' && !filter_var($url, FILTER_VALIDATE_URL)) {
            riwaq_error('invalid_url', "رابط $platform غير صالح.", 422);
        }
        $clean[$platform] = ['handle' => $handle ?: $url, 'url' => $url];
    }

    $db->beginTransaction();
    try {
        $db->prepare("DELETE FROM socials WHERE club_id = :c")->execute([':c' => $u['clubId']]);
        $ins = $db->prepare("INSERT INTO socials (club_id, platform, handle, url) VALUES (:c, :p, :h, :u)");
        foreach ($clean as $p => $e) {
            $ins->execute([':c' => $u['clubId'], ':p' => $p, ':h' => $e['handle'], ':u' => $e['url']]);
        }
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }

    riwaq_audit($u, 'socials.update', 'club', $u['clubId'], ['count' => count($clean)]);
    riwaq_ok($clean);
}

riwaq_error('method_not_allowed', '', 405);
