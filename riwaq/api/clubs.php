<?php
/**
 * GET     clubs.php                 → كل الأندية (عام)
 * GET     clubs.php?id=cN           → نادٍ واحد + سوشاله (عام)
 * POST    clubs.php                 → إنشاء نادٍ + حساب رئيس (أدمن)
 * PUT     clubs.php?id=cN           → تعديل نادٍ (أدمن)
 * DELETE  clubs.php?id=cN           → حذف نادٍ بكل محتواه (أدمن)
 */
declare(strict_types=1);

require_once __DIR__ . '/auth_helpers.php';
riwaq_handle_cors();

$method = riwaq_method();
$db     = riwaq_db();
$ip     = riwaq_client_ip() ?: 'unknown';
if (in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
    $writer = riwaq_require_user('admin');
    riwaq_require_csrf();
    riwaq_rate_limit("write:user:{$writer['id']}", (int)riwaq_config()['rate_limit']['write_per_user_per_min'], 60);
}

switch ($method) {
    case 'GET':    handleGet($db, $ip);    break;
    case 'POST':   handleCreate($db);      break;
    case 'PUT':    handleUpdate($db);      break;
    case 'DELETE': handleDelete($db);      break;
    default:       riwaq_error('method_not_allowed', '', 405);
}

// ================================================================
// GET — قراءة عامة
// ================================================================
function handleGet(PDO $db, string $ip): void {
    riwaq_rate_limit("read:$ip", (int)riwaq_config()['rate_limit']['read_per_ip_per_min'], 60);

    $id = riwaq_str($_GET['id'] ?? '', 16);

    if ($id !== '') {
        $stmt = $db->prepare("SELECT * FROM clubs WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) riwaq_error('not_found', 'النادي غير موجود.', 404);

        $socials = $db->prepare("SELECT platform, handle, url FROM socials WHERE club_id = :c");
        $socials->execute([':c' => $id]);
        $socialMap = [];
        foreach ($socials->fetchAll() as $s) {
            $socialMap[$s['platform']] = ['handle' => $s['handle'], 'url' => $s['url']];
        }
        $club = riwaq_format_club($row);
        $club['socials'] = $socialMap;
        riwaq_ok($club);
    }

    // قائمة كاملة
    $clubs = $db->query("SELECT * FROM clubs ORDER BY name ASC")->fetchAll();
    $socials = $db->query("SELECT club_id, platform, handle, url FROM socials")->fetchAll();

    $socialMap = [];
    foreach ($socials as $s) {
        $socialMap[$s['club_id']][$s['platform']] = ['handle' => $s['handle'], 'url' => $s['url']];
    }

    $result = [];
    foreach ($clubs as $c) {
        $row = riwaq_format_club($c);
        $row['socials'] = $socialMap[$c['id']] ?? new stdClass();
        $result[] = $row;
    }
    riwaq_ok($result);
}

// ================================================================
// POST — إنشاء نادٍ + حساب رئيس (في معاملة واحدة)
// ================================================================
function handleCreate(PDO $db): void {
    $admin = riwaq_require_user('admin');
    riwaq_require_csrf();

    $body = riwaq_read_json();

    // -------- حقول النادي --------
    $name        = riwaq_str($body['name']        ?? '', 120);
    $shortName   = riwaq_str($body['short']       ?? '', 60);
    $category    = riwaq_str($body['cat']         ?? '', 40);
    $college     = riwaq_str($body['college']     ?? '', 120);
    $color       = riwaq_str($body['color']       ?? '', 20);
    $icon        = riwaq_str($body['icon']        ?? '', 16);
    $image       = riwaq_str($body['image']       ?? '', 255);
    $description = riwaq_str($body['desc']        ?? '', 5000);

    if ($name        === '') riwaq_error('missing_field', 'اسم النادي مطلوب.', 422);
    if ($category    === '') riwaq_error('missing_field', 'التصنيف مطلوب.', 422);
    if ($college     === '') riwaq_error('missing_field', 'الكلية مطلوبة.', 422);
    if ($description === '') riwaq_error('missing_field', 'وصف النادي مطلوب.', 422);

    if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) {
        riwaq_error('invalid_color', 'اللون يجب أن يكون بصيغة #RRGGBB.', 422);
    }

    $allowedCats = ['تقني', 'ثقافي', 'شرعي', 'أكاديمي', 'رياضي', 'إبداعي'];
    if (!in_array($category, $allowedCats, true)) {
        riwaq_error('invalid_category', 'التصنيف غير مسموح.', 422);
    }

    if ($icon === '' && $image === '') {
        riwaq_error('missing_field', 'يجب توفير أيقونة نصية أو صورة شعار.', 422);
    }
    if ($icon === '') $icon = mb_substr($name, 0, 1);  // افتراضي: أول حرف من الاسم

    // -------- حقول الحساب --------
    $username = riwaq_str($body['username'] ?? '', 32);
    $password = riwaq_password_input($body['password'] ?? '');
    if ($err = riwaq_validate_username($username)) riwaq_error('invalid_username', $err, 422);
    if ($err = riwaq_validate_password($password)) riwaq_error('invalid_password', $err, 422);

    // تأكد من تفرّد اسم المستخدم
    $dup = $db->prepare("SELECT 1 FROM users WHERE username = :u");
    $dup->execute([':u' => $username]);
    if ($dup->fetchColumn()) riwaq_error('username_taken', 'اسم المستخدم موجود مسبقًا.', 409);

    $hash = riwaq_hash_password($password);
    // Serialize the cN allocator across all admins without changing existing IDs/schema.
    $lockName = 'riwaq-clubs-' . substr(hash('sha256', (string)$db->query('SELECT DATABASE()')->fetchColumn()), 0, 40);
    $lock = $db->prepare('SELECT GET_LOCK(:name, 5)');
    $lock->execute([':name' => $lockName]);
    if ((int)$lock->fetchColumn() !== 1) {
        header('Retry-After: 5');
        riwaq_error('temporarily_busy', 'إنشاء الأندية مشغول مؤقتًا. حاول مرة أخرى.', 503);
    }
    $usernameTaken = false;
    try {
        $db->beginTransaction();
        $clubId = riwaq_next_club_id($db);
        $cover  = riwaq_make_cover($color);

        $db->prepare(
            "INSERT INTO clubs (id, name, short_name, category, college, members, color, icon, image, description, cover)
             VALUES (:id, :n, :sn, :cat, :col, 0, :clr, :ic, :im, :d, :cv)"
        )->execute([
            ':id'  => $clubId,
            ':n'   => $name,
            ':sn'  => $shortName ?: null,
            ':cat' => $category,
            ':col' => $college,
            ':clr' => $color,
            ':ic'  => $icon,
            ':im'  => $image ?: null,
            ':d'   => $description,
            ':cv'  => $cover,
        ]);

        $db->prepare(
            "INSERT INTO users (username, password_hash, role, club_id)
             VALUES (:u, :h, 'president', :c)"
        )->execute([':u' => $username, ':h' => $hash, ':c' => $clubId]);

        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        if ($e instanceof PDOException && (int)($e->errorInfo[1] ?? 0) === 1062) {
            $dup->execute([':u' => $username]);
            $usernameTaken = (bool)$dup->fetchColumn();
        }
        if (!$usernameTaken) throw $e;
    } finally {
        $db->prepare('SELECT RELEASE_LOCK(:name)')->execute([':name' => $lockName]);
    }
    if ($usernameTaken) riwaq_error('username_taken', 'اسم المستخدم موجود مسبقًا.', 409);

    riwaq_audit($admin, 'club.create', 'club', $clubId, [
        'name'     => $name,
        'username' => $username,
    ]);

    // أعِد النادي المُنشأ
    $row = $db->prepare("SELECT * FROM clubs WHERE id = :id");
    $row->execute([':id' => $clubId]);
    $club = riwaq_format_club($row->fetch());
    $club['username'] = $username;
    riwaq_ok($club);
}

// ================================================================
// PUT — تعديل نادٍ (أدمن فقط)
// ================================================================
function handleUpdate(PDO $db): void {
    $admin = riwaq_require_user('admin');
    riwaq_require_csrf();

    $id = riwaq_str($_GET['id'] ?? '', 16);
    if ($id === '') riwaq_error('missing_field', 'معرّف النادي مطلوب.', 422);

    $exists = $db->prepare("SELECT * FROM clubs WHERE id = :id");
    $exists->execute([':id' => $id]);
    $current = $exists->fetch();
    if (!$current) riwaq_error('not_found', 'النادي غير موجود.', 404);

    $body = riwaq_read_json();

    // ادمج القيم الجديدة مع الموجودة
    $name        = isset($body['name'])    ? riwaq_str($body['name'],    120) : $current['name'];
    $shortName   = isset($body['short'])   ? riwaq_str($body['short'],    60) : $current['short_name'];
    $category    = isset($body['cat'])     ? riwaq_str($body['cat'],      40) : $current['category'];
    $college     = isset($body['college']) ? riwaq_str($body['college'], 120) : $current['college'];
    $color       = isset($body['color'])   ? riwaq_str($body['color'],    20) : $current['color'];
    $icon        = isset($body['icon'])    ? riwaq_str($body['icon'],     16) : $current['icon'];
    $image       = array_key_exists('image', $body) ? (riwaq_str($body['image'], 255) ?: null) : $current['image'];
    $description = isset($body['desc'])    ? riwaq_str($body['desc'],   5000) : $current['description'];

    // تحقّق
    if ($name === '' || $college === '' || $description === '') {
        riwaq_error('missing_field', 'اسم النادي والكلية والوصف مطلوبة.', 422);
    }
    if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) {
        riwaq_error('invalid_color', 'اللون يجب أن يكون بصيغة #RRGGBB.', 422);
    }
    $allowedCats = ['تقني', 'ثقافي', 'شرعي', 'أكاديمي', 'رياضي', 'إبداعي'];
    if (!in_array($category, $allowedCats, true)) {
        riwaq_error('invalid_category', 'التصنيف غير مسموح.', 422);
    }
    if ($icon === '' && !$image) {
        riwaq_error('missing_field', 'يجب توفير أيقونة نصية أو صورة شعار.', 422);
    }
    if ($icon === '') $icon = mb_substr($name, 0, 1);

    $cover = riwaq_make_cover($color);

    $db->prepare(
        "UPDATE clubs
            SET name = :n, short_name = :sn, category = :cat, college = :col,
                color = :clr, icon = :ic, image = :im,
                description = :d, cover = :cv
          WHERE id = :id"
    )->execute([
        ':id'  => $id,
        ':n'   => $name,
        ':sn'  => $shortName ?: null,
        ':cat' => $category,
        ':col' => $college,
        ':clr' => $color,
        ':ic'  => $icon,
        ':im'  => $image,
        ':d'   => $description,
        ':cv'  => $cover,
    ]);

    riwaq_audit($admin, 'club.update', 'club', $id);

    $row = $db->prepare("SELECT * FROM clubs WHERE id = :id");
    $row->execute([':id' => $id]);
    riwaq_ok(riwaq_format_club($row->fetch()));
}

// ================================================================
// DELETE — حذف نادٍ بكل محتواه (cascade)
// ================================================================
function handleDelete(PDO $db): void {
    $admin = riwaq_require_user('admin');
    riwaq_require_csrf();

    $id = riwaq_str($_GET['id'] ?? '', 16);
    if ($id === '') riwaq_error('missing_field', 'معرّف النادي مطلوب.', 422);

    $check = $db->prepare("SELECT name FROM clubs WHERE id = :id");
    $check->execute([':id' => $id]);
    $name = $check->fetchColumn();
    if ($name === false) riwaq_error('not_found', 'النادي غير موجود.', 404);

    // CASCADE في DB يحذف users, posts, events, socials تلقائياً
    $db->prepare("DELETE FROM clubs WHERE id = :id")->execute([':id' => $id]);

    riwaq_audit($admin, 'club.delete', 'club', $id, ['name' => $name]);
    riwaq_ok();
}
