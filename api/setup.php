<?php
/**
 * رواق — تهيئة قاعدة البيانات (يُشغَّل مرة واحدة عند التركيب)
 *
 * كيف يعمل:
 *   ١. تأكد أن config.php موجود (انسخه من config.example.php)
 *   ٢. تأكد أن قاعدة البيانات موجودة (CREATE DATABASE) وأن المستخدم لديه صلاحية.
 *   ٣. شغّل هذا الملف من المتصفح:   http(s)://your.site/api/setup.php
 *      أو من الـ CLI:                php api/setup.php
 *
 * يُنشئ:
 *   - الجداول من schema.sql
 *   - الـ ٨ أندية الافتراضية + المنشورات والفعاليات + السوشال (من seed.sql)
 *   - حساب الأدمن (admin / admin1234)
 *   - حسابات الرؤساء الـ ٨ (club_c1 ... club_c8 / كلمة المرور: riwaq2026)
 *
 * بعد النجاح، يُعرض ملخص ثم يصبح الملف غير قابل لإعادة التشغيل (Safe guard).
 *
 * تنبيه: غيِّر كلمتي المرور الافتراضيتين فوراً بعد التركيب.
 */
declare(strict_types=1);

require_once __DIR__ . '/auth_helpers.php';

function riwaq_sql_statements(string $sql): array {
    $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
    return array_values(array_filter(array_map('trim', explode(';', $sql)), fn($stmt) => $stmt !== ''));
}

// مانع إعادة التشغيل — يمكن للأدمن إعادة التهيئة بتمرير ?force=1
$db   = riwaq_db();
$force = isset($_GET['force']) && $_GET['force'] === '1';

header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>رواق — تهيئة</title>
<style>
  body { font-family: "Tajawal", system-ui, sans-serif; background: #f6f4ef; padding: 40px; color: #1a1f1c; }
  .box { max-width: 720px; margin: 0 auto; background: #fff; border: 1px solid #e6e2d8; border-radius: 14px; padding: 30px; }
  h1 { color: #2d5a3d; margin-bottom: 12px; }
  pre { background: #faf8f3; padding: 14px; border-radius: 8px; overflow: auto; font-size: 13px; direction: ltr; text-align: left; }
  .ok { color: #2d5a3d; font-weight: 700; }
  .err { color: #8a3a2d; font-weight: 700; }
  code { background: #e8efe9; color: #1f3d29; padding: 2px 8px; border-radius: 4px; }
  .step { padding: 10px 14px; border-inline-start: 3px solid #2d5a3d; background: #faf8f3; margin: 12px 0; border-radius: 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { padding: 10px; border: 1px solid #e6e2d8; text-align: right; font-size: 14px; }
  th { background: #f3ead7; }
</style>
</head>
<body>
<div class="box">
<h1>🛠️ رواق — تهيئة قاعدة البيانات</h1>

<?php
try {
    // ١) تحقق من وجود الجداول؛ لو موجودة ولم يضع ?force=1 — توقف
    $tables = $db->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    $hasTables = !empty($tables);
    if ($hasTables && !$force) {
        echo '<div class="step">قاعدة البيانات تحتوي بالفعل على جداول: <code>' . htmlspecialchars(implode(', ', $tables)) . '</code></div>';
        echo '<p>للإعادة من الصفر (سيتم <span class="err">حذف كل البيانات</span>) اضغط:</p>';
        echo '<p><a href="?force=1" style="color:#2d5a3d;font-weight:700">إعادة التهيئة بالكامل ⟲</a></p>';
        echo '</div></body></html>';
        exit;
    }

    if ($force && $hasTables) {
        echo '<div class="step">إسقاط الجداول الحالية…</div>';
        $db->exec("SET FOREIGN_KEY_CHECKS = 0");
        foreach ($tables as $t) {
            $db->exec("DROP TABLE IF EXISTS `$t`");
        }
        $db->exec("SET FOREIGN_KEY_CHECKS = 1");
        echo '<div class="step ok">تم.</div>';
    }

    // ٢) شغّل schema.sql
    echo '<div class="step">إنشاء الجداول من <code>schema.sql</code> …</div>';
    $schema = file_get_contents(__DIR__ . '/schema.sql');
    if (!$schema) throw new RuntimeException('لم يتم العثور على schema.sql');
    // افصل الجمل بعد إزالة تعليقات SQL السطرية حتى لا تُهمل أوامر CREATE/INSERT.
    $statements = riwaq_sql_statements($schema);
    foreach ($statements as $stmt) {
        $db->exec($stmt);
    }
    echo '<div class="step ok">الجداول جاهزة.</div>';

    // ٣) شغّل seed.sql
    echo '<div class="step">إدخال البيانات الافتراضية (٨ أندية + منشورات + فعاليات + سوشال) …</div>';
    $seed = file_get_contents(__DIR__ . '/seed.sql');
    if (!$seed) throw new RuntimeException('لم يتم العثور على seed.sql');
    $statements = riwaq_sql_statements($seed);
    foreach ($statements as $stmt) {
        $db->exec($stmt);
    }
    echo '<div class="step ok">البيانات أُدخلت.</div>';

    // توليد كلمة مرور عشوائية آمنة (12 خانة: أرقام + حروف)
    function riwaq_gen_password(int $len = 12): string {
        $chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
        $out = '';
        for ($i = 0; $i < $len; $i++) {
            $out .= $chars[random_int(0, strlen($chars) - 1)];
        }
        return $out;
    }

    // ٤) أنشئ حساب الأدمن بكلمة مرور عشوائية
    echo '<div class="step">إنشاء حساب الأدمن …</div>';
    $adminPassword = riwaq_gen_password(14);
    $adminHash = riwaq_hash_password($adminPassword);
    $db->prepare(
        "INSERT INTO users (username, password_hash, role)
         VALUES ('admin', :h, 'admin')
         ON DUPLICATE KEY UPDATE password_hash = :h2"
    )->execute([':h' => $adminHash, ':h2' => $adminHash]);
    echo '<div class="step ok">الأدمن جاهز.</div>';

    // ٥) أنشئ حسابات الرؤساء الـ ٨ — كلمة مرور عشوائية لكل حساب
    echo '<div class="step">إنشاء حسابات الرؤساء الافتراضية …</div>';
    $clubs = $db->query("SELECT id FROM clubs ORDER BY id")->fetchAll(PDO::FETCH_COLUMN);
    $presidentPasswords = [];
    $ins = $db->prepare(
        "INSERT INTO users (username, password_hash, role, club_id)
         VALUES (:u, :h, 'president', :c)
         ON DUPLICATE KEY UPDATE password_hash = :h2"
    );
    foreach ($clubs as $cid) {
        $username = "club_$cid";
        $pwd = riwaq_gen_password(12);
        $presidentPasswords[$cid] = ['username' => $username, 'password' => $pwd];
        $hash = riwaq_hash_password($pwd);
        $ins->execute([':u' => $username, ':h' => $hash, ':c' => $cid, ':h2' => $hash]);
    }
    echo '<div class="step ok">' . count($clubs) . ' حساب رئيس جاهز.</div>';

    ?>
    <h2 style="color:#2d5a3d;margin-top:30px">✅ التهيئة اكتملت بنجاح</h2>
    <p style="background:#f3e1dc;border:1px solid #d4a89a;border-radius:8px;padding:12px 16px;color:#5a1f14;font-weight:700;">
      ⚠️ <strong>احفظ كلمات المرور الآن</strong> — لن تُعرض مرة أخرى. ثم <strong>احذف هذا الملف</strong> (<code>api/setup.php</code>) فور الانتهاء.
    </p>

    <h3>حساب الأدمن</h3>
    <table>
      <tr><th>اسم المستخدم</th><th>كلمة المرور (احفظها الآن)</th></tr>
      <tr><td><code>admin</code></td><td><code style="color:#8a3a2d;font-size:15px"><?= htmlspecialchars($adminPassword) ?></code></td></tr>
    </table>

    <h3 style="margin-top:20px">حسابات رؤساء الأندية</h3>
    <table>
      <tr><th>النادي</th><th>اسم المستخدم</th><th>كلمة المرور (احفظها الآن)</th></tr>
      <?php foreach ($presidentPasswords as $cid => $acc): ?>
      <tr>
        <td><code><?= htmlspecialchars($cid) ?></code></td>
        <td><code><?= htmlspecialchars($acc['username']) ?></code></td>
        <td><code style="color:#1f3d29"><?= htmlspecialchars($acc['password']) ?></code></td>
      </tr>
      <?php endforeach; ?>
    </table>

    <h3 style="margin-top:20px">الخطوات التالية</h3>
    <ol style="line-height:2">
      <li>افتح <a href="../admin/" style="color:#2d5a3d;font-weight:700">لوحة الأدمن</a> وسجّل دخول بكلمة المرور أعلاه.</li>
      <li>سلّم اسم المستخدم وكلمة المرور لكل رئيس نادٍ.</li>
      <li>يستطيع كل رئيس تغيير كلمة مروره من لوحة الأدمن.</li>
      <li><strong style="color:#8a3a2d">احذف هذا الملف فوراً:</strong> <code>rm api/setup.php</code></li>
    </ol>

    <?php
} catch (Throwable $e) {
    echo '<div class="step err">فشل: ' . htmlspecialchars($e->getMessage()) . '</div>';
    echo '<pre>' . htmlspecialchars($e->getTraceAsString()) . '</pre>';
}
?>
</div>
</body>
</html>
