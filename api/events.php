<?php
declare(strict_types=1);

require_once __DIR__ . '/auth_helpers.php';
riwaq_handle_cors();

$method = riwaq_method();
$db     = riwaq_db();
$ip     = riwaq_client_ip() ?: 'unknown';

switch ($method) {
    case 'GET':    listEvents($db, $ip); break;
    case 'POST':   createEvent($db);     break;
    case 'DELETE': deleteEvent($db);     break;
    default:       riwaq_error('method_not_allowed', '', 405);
}

// ----------------------------------------------------------------
function listEvents(PDO $db, string $ip): void {
    riwaq_rate_limit("read:$ip", (int)riwaq_config()['rate_limit']['read_per_ip_per_min'], 60);

    $clubId = $_GET['clubId'] ?? null;
    $sql    = "SELECT * FROM events";
    $params = [];
    if ($clubId) {
        $sql .= " WHERE club_id = :c";
        $params[':c'] = $clubId;
    }
    $sql .= " ORDER BY event_date ASC, event_time ASC";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = array_map('riwaq_format_event', $stmt->fetchAll());
    riwaq_ok($rows);
}

function createEvent(PDO $db): void {
    $u = riwaq_require_user('president');
    riwaq_require_csrf();
    riwaq_rate_limit("write:user:{$u['id']}", (int)riwaq_config()['rate_limit']['write_per_user_per_min'], 60);

    $body  = riwaq_read_json();
    $title = riwaq_str($body['title'] ?? '', 200);
    $desc  = riwaq_str($body['description'] ?? '', 5000);
    $date  = riwaq_str($body['date'] ?? '', 10);
    $time  = riwaq_str($body['time'] ?? '', 8);
    $loc   = riwaq_str($body['location'] ?? '', 200);
    $spots = (int)($body['spots'] ?? 0);
    $regUrl = riwaq_str($body['registrationUrl'] ?? '', 500);

    if ($title === '' || $loc === '' || $date === '' || $time === '') {
        riwaq_error('missing_field', 'العنوان والمكان والتاريخ والوقت مطلوبة.', 422);
    }
    if ($spots <= 0 || $spots > 100000) {
        riwaq_error('invalid_spots', 'عدد المقاعد يجب أن يكون بين ١ و١٠٠٠٠٠.', 422);
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        riwaq_error('invalid_date', 'صيغة التاريخ غير صحيحة (YYYY-MM-DD).', 422);
    }
    if (!preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $time)) {
        riwaq_error('invalid_time', 'صيغة الوقت غير صحيحة (HH:MM).', 422);
    }
    if (strlen($time) === 5) $time .= ':00';

    if ($regUrl !== '' && !filter_var($regUrl, FILTER_VALIDATE_URL)) {
        riwaq_error('invalid_url', 'رابط التسجيل غير صالح.', 422);
    }

    $db->beginTransaction();
    try {
        // أنشئ الفعالية
        $stmt = $db->prepare(
            "INSERT INTO events
              (club_id, title, description, event_date, event_time, location, spots, taken, registration_url)
             VALUES (:c, :ti, :d, :dt, :tm, :l, :s, 0, :u)"
        );
        $stmt->execute([
            ':c'  => $u['clubId'],
            ':ti' => $title,
            ':d'  => $desc ?: null,
            ':dt' => $date,
            ':tm' => $time,
            ':l'  => $loc,
            ':s'  => $spots,
            ':u'  => $regUrl ?: null,
        ]);
        $eventId = (int)$db->lastInsertId();

        // وأنشئ منشور فعالية مرتبط
        $bodyText = $desc !== ''
            ? $desc
            : "تُقام بتاريخ $date الساعة $time في $loc. عدد المقاعد: $spots.";
        $postStmt = $db->prepare(
            "INSERT INTO posts (club_id, type, title, body, linked_event_id, external_url)
             VALUES (:c, 'event', :ti, :b, :eid, :u)"
        );
        $postStmt->execute([
            ':c'   => $u['clubId'],
            ':ti'  => $title,
            ':b'   => $bodyText,
            ':eid' => $eventId,
            ':u'   => $regUrl ?: null,
        ]);

        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }

    riwaq_audit($u, 'event.create', 'event', (string)$eventId);

    $row = $db->prepare("SELECT * FROM events WHERE id = :id");
    $row->execute([':id' => $eventId]);
    riwaq_ok(riwaq_format_event($row->fetch()));
}

function deleteEvent(PDO $db): void {
    $u = riwaq_require_user('president', 'admin');
    riwaq_require_csrf();
    riwaq_rate_limit("write:user:{$u['id']}", (int)riwaq_config()['rate_limit']['write_per_user_per_min'], 60);

    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($id <= 0) riwaq_error('missing_id', 'معرّف الفعالية مطلوب.', 422);

    $check = $db->prepare("SELECT club_id FROM events WHERE id = :id");
    $check->execute([':id' => $id]);
    $row = $check->fetch();
    if (!$row) riwaq_error('not_found', 'الفعالية غير موجودة.', 404);

    if ($u['role'] === 'president' && $row['club_id'] !== $u['clubId']) {
        riwaq_error('forbidden', 'لا يمكن حذف فعالية نادٍ آخر.', 403);
    }

    // ON DELETE CASCADE/SET NULL يعالج المنشور المرتبط
    $db->beginTransaction();
    try {
        $db->prepare("DELETE FROM posts WHERE linked_event_id = :id")->execute([':id' => $id]);
        $db->prepare("DELETE FROM events WHERE id = :id")->execute([':id' => $id]);
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }

    riwaq_audit($u, 'event.delete', 'event', (string)$id);
    riwaq_ok();
}
