<?php
/**
 * إدارة حسابات رؤساء الأندية — للأدمن فقط.
 *   GET    accounts.php                 → قائمة الحسابات
 *   POST   accounts.php                 → إنشاء حساب { username, clubId, password }
 *   PUT    accounts.php?username=...    → تغيير كلمة المرور { password }
 *   DELETE accounts.php?username=...    → حذف حساب
 */
declare(strict_types=1);

require_once __DIR__ . '/auth_helpers.php';
riwaq_handle_cors();

$method = riwaq_method();
$db     = riwaq_db();

// كل العمليات تتطلب أدمن
$u = riwaq_require_user('admin');

switch ($method) {
    case 'GET':    listAccounts($db);   break;
    case 'POST':   createAccount($db, $u); break;
    case 'PUT':    updateAccount($db, $u); break;
    case 'DELETE': deleteAccount($db, $u); break;
    default:       riwaq_error('method_not_allowed', '', 405);
}

// ----------------------------------------------------------------
function listAccounts(PDO $db): void {
    $rows = $db->query(
        "SELECT u.id, u.username, u.club_id, u.created_at, u.updated_at, u.last_login_at,
                c.name AS club_name, c.icon AS club_icon, c.color AS club_color, c.college AS club_college
           FROM users u
           LEFT JOIN clubs c ON c.id = u.club_id
          WHERE u.role = 'president'
          ORDER BY u.created_at DESC"
    )->fetchAll();

    $accounts = array_map(fn($r) => [
        'username'    => $r['username'],
        'clubId'      => $r['club_id'],
        'clubName'    => $r['club_name'],
        'clubIcon'    => $r['club_icon'],
        'clubColor'   => $r['club_color'],
        'clubCollege' => $r['club_college'],
        'createdAt'   => $r['created_at'],
        'updatedAt'   => $r['updated_at'],
        'lastLoginAt' => $r['last_login_at'],
    ], $rows);

    // كذلك أرسل أعداد المحتوى الإجمالية لإحصاءات لوحة الأدمن
    $totalPosts  = (int)$db->query("SELECT COUNT(*) FROM posts")->fetchColumn();
    $totalEvents = (int)$db->query("SELECT COUNT(*) FROM events")->fetchColumn();

    riwaq_ok([
        'accounts' => $accounts,
        'stats'    => [
            'totalAccounts' => count($accounts),
            'totalPosts'    => $totalPosts,
            'totalEvents'   => $totalEvents,
        ],
    ]);
}

function createAccount(PDO $db, array $admin): void {
    riwaq_require_csrf();

    $body     = riwaq_read_json();
    $username = riwaq_str($body['username'] ?? '', 32);
    $clubId   = riwaq_str($body['clubId']   ?? '', 16);
    $password = (string)($body['password'] ?? '');

    if ($err = riwaq_validate_username($username)) riwaq_error('invalid_username', $err, 422);
    if ($err = riwaq_validate_password($password)) riwaq_error('invalid_password', $err, 422);
    if ($clubId === '') riwaq_error('missing_field', 'النادي مطلوب.', 422);

    // تأكد من وجود النادي
    $exists = $db->prepare("SELECT 1 FROM clubs WHERE id = :c");
    $exists->execute([':c' => $clubId]);
    if (!$exists->fetchColumn()) riwaq_error('club_not_found', 'النادي غير موجود.', 422);

    // username فريد؟
    $dup = $db->prepare("SELECT 1 FROM users WHERE username = :u");
    $dup->execute([':u' => $username]);
    if ($dup->fetchColumn()) riwaq_error('username_taken', 'اسم المستخدم موجود مسبقًا.', 409);

    // النادي عنده حساب بالفعل؟
    $dup2 = $db->prepare("SELECT 1 FROM users WHERE role='president' AND club_id = :c");
    $dup2->execute([':c' => $clubId]);
    if ($dup2->fetchColumn()) riwaq_error('club_has_account', 'هذا النادي يملك حسابًا بالفعل.', 409);

    $hash = riwaq_hash_password($password);
    $ins = $db->prepare(
        "INSERT INTO users (username, password_hash, role, club_id)
         VALUES (:u, :h, 'president', :c)"
    );
    $ins->execute([':u' => $username, ':h' => $hash, ':c' => $clubId]);

    riwaq_audit($admin, 'account.create', 'user', $username, ['clubId' => $clubId]);
    riwaq_ok(['username' => $username, 'clubId' => $clubId]);
}

function updateAccount(PDO $db, array $admin): void {
    riwaq_require_csrf();

    $username = isset($_GET['username']) ? trim((string)$_GET['username']) : '';
    if ($username === '') riwaq_error('missing_field', 'اسم المستخدم مطلوب.', 422);

    $body     = riwaq_read_json();
    $password = (string)($body['password'] ?? '');
    if ($err = riwaq_validate_password($password)) riwaq_error('invalid_password', $err, 422);

    $check = $db->prepare("SELECT id FROM users WHERE username = :u AND role = 'president'");
    $check->execute([':u' => $username]);
    $uid = $check->fetchColumn();
    if (!$uid) riwaq_error('not_found', 'الحساب غير موجود.', 404);

    $hash = riwaq_hash_password($password);
    $db->prepare("UPDATE users SET password_hash = :h WHERE id = :id")
       ->execute([':h' => $hash, ':id' => $uid]);

    // ابطل كل جلسات المستخدم النشطة (إلزامه بإعادة الدخول)
    $db->prepare("DELETE FROM sessions WHERE user_id = :id")->execute([':id' => $uid]);

    riwaq_audit($admin, 'account.update_password', 'user', $username);
    riwaq_ok();
}

function deleteAccount(PDO $db, array $admin): void {
    riwaq_require_csrf();

    $username = isset($_GET['username']) ? trim((string)$_GET['username']) : '';
    if ($username === '') riwaq_error('missing_field', 'اسم المستخدم مطلوب.', 422);

    $check = $db->prepare("SELECT id, club_id FROM users WHERE username = :u AND role = 'president'");
    $check->execute([':u' => $username]);
    $row = $check->fetch();
    if (!$row) riwaq_error('not_found', 'الحساب غير موجود.', 404);

    // CASCADE يحذف الجلسات تلقائياً
    $db->prepare("DELETE FROM users WHERE id = :id")->execute([':id' => $row['id']]);

    riwaq_audit($admin, 'account.delete', 'user', $username, ['clubId' => $row['club_id']]);
    riwaq_ok();
}
