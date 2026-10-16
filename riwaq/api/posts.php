<?php
declare(strict_types=1);

require_once __DIR__ . '/auth_helpers.php';
riwaq_handle_cors();

$method = riwaq_method();
$db     = riwaq_db();
$ip     = riwaq_client_ip() ?: 'unknown';

switch ($method) {
    case 'GET':    listPosts($db, $ip); break;
    case 'POST':   createPost($db);     break;
    case 'DELETE': deletePost($db);     break;
    default:       riwaq_error('method_not_allowed', '', 405);
}

// ----------------------------------------------------------------
function listPosts(PDO $db, string $ip): void {
    riwaq_rate_limit("read:$ip", (int)riwaq_config()['rate_limit']['read_per_ip_per_min'], 60);

    $where  = [];
    $params = [];

    $type = riwaq_str($_GET['type'] ?? '', 20);
    if ($type && in_array($type, ['post', 'announcement', 'event'], true)) {
        $where[] = 'type = :type';
        $params[':type'] = $type;
    }

    $clubId = riwaq_str($_GET['clubId'] ?? '', 16);
    if ($clubId) {
        $where[] = 'club_id = :cid';
        $params[':cid'] = $clubId;
    }

    $sql = "SELECT * FROM posts";
    if ($where) $sql .= " WHERE " . implode(' AND ', $where);
    $sql .= " ORDER BY created_at DESC LIMIT 500";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = array_map('riwaq_format_post', $stmt->fetchAll());
    riwaq_ok($rows);
}

function createPost(PDO $db): void {
    $u = riwaq_require_user('president');
    riwaq_require_csrf();
    riwaq_rate_limit("write:user:{$u['id']}", (int)riwaq_config()['rate_limit']['write_per_user_per_min'], 60);

    $body = riwaq_read_json();
    $type  = $body['type']  ?? '';
    $title = riwaq_str($body['title'] ?? '', 200);
    $text  = riwaq_str($body['body']  ?? '', 5000);
    $tags  = $body['tags'] ?? [];
    $externalUrl = riwaq_str($body['externalUrl'] ?? '', 500);
    $image = riwaq_str($body['image'] ?? '', 255);

    if (!in_array($type, ['post', 'announcement'], true)) {
        riwaq_error('invalid_type', 'النوع غير صحيح. للفعاليات استخدم endpoint منفصل.', 422);
    }
    if ($title === '') riwaq_error('missing_field', 'العنوان مطلوب.', 422);
    if ($text  === '') riwaq_error('missing_field', 'المحتوى مطلوب.', 422);
    if (!is_array($tags) || count($tags) > 20) {
        riwaq_error('invalid_tags', 'الوسوم يجب أن تكون قائمة لا تتجاوز ٢٠ وسمًا.', 422);
    }

    // تنظيف الوسوم
    $tags = array_values(array_filter(array_map(function ($t) {
        $t = riwaq_str($t, 60);
        if ($t === '') return '';
        return $t[0] === '#' ? $t : '#' . $t;
    }, $tags), fn($t) => $t !== ''));

    // تحقق من رابط التسجيل
    if ($externalUrl !== '' && !riwaq_is_http_url($externalUrl)) {
        riwaq_error('invalid_url', 'رابط التسجيل غير صالح.', 422);
    }
    if ($image !== '') {
        $pattern = '~^' . preg_quote($u['clubId'], '~') . '_[0-9]{8}_[0-9]{6}_[a-f0-9]{8}\.(?:jpg|png|webp|gif)$~D';
        if (!preg_match($pattern, $image)
            || !is_file(rtrim(riwaq_config()['uploads_dir'], '/\\') . '/' . $image)) {
            riwaq_error('invalid_image', 'اختر صورة مرفوعة بواسطة ناديك.', 422);
        }
    }

    $stmt = $db->prepare(
        "INSERT INTO posts (club_id, type, title, body, tags, external_url, image)
         VALUES (:c, :ty, :ti, :b, :tg, :url, :image)"
    );
    $stmt->execute([
        ':c'   => $u['clubId'],
        ':ty'  => $type,
        ':ti'  => $title,
        ':b'   => $text,
        ':tg'  => $tags ? json_encode($tags, JSON_UNESCAPED_UNICODE) : null,
        ':url' => $externalUrl ?: null,
        ':image' => $image ?: null,
    ]);
    $id = (int)$db->lastInsertId();

    riwaq_audit($u, 'post.create', 'post', (string)$id, ['type' => $type]);

    $row = $db->prepare("SELECT * FROM posts WHERE id = :id");
    $row->execute([':id' => $id]);
    riwaq_ok(riwaq_format_post($row->fetch()));
}

function deletePost(PDO $db): void {
    $u = riwaq_require_user('president', 'admin');
    riwaq_require_csrf();
    riwaq_rate_limit("write:user:{$u['id']}", (int)riwaq_config()['rate_limit']['write_per_user_per_min'], 60);

    $id = riwaq_positive_id($_GET['id'] ?? null);

    // يجب أن يكون المنشور لنفس النادي (إلا أن الأدمن يستطيع حذف أي منشور)
    $check = $db->prepare("SELECT club_id, linked_event_id FROM posts WHERE id = :id");
    $check->execute([':id' => $id]);
    $row = $check->fetch();
    if (!$row) riwaq_error('not_found', 'المنشور غير موجود.', 404);
    if ($u['role'] === 'president' && $row['club_id'] !== $u['clubId']) {
        riwaq_error('forbidden', 'لا يمكن حذف منشورات نادٍ آخر.', 403);
    }

    $db->beginTransaction();
    try {
        $db->prepare("DELETE FROM posts WHERE id = :id")->execute([':id' => $id]);
        // لو فيه فعالية مرتبطة، احذفها كذلك (سلوك يطابق الواجهة)
        if ($row['linked_event_id']) {
            $db->prepare("DELETE FROM events WHERE id = :eid")->execute([':eid' => $row['linked_event_id']]);
        }
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }

    riwaq_audit($u, 'post.delete', 'post', (string)$id);
    riwaq_ok();
}
