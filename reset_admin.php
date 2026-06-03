<?php
$config = require __DIR__ . '/../api/config.php';
$db = $config['db'];

try {
    $pdo = new PDO(
        "mysql:host={$db['host']};port={$db['port']};dbname={$db['name']};charset={$db['charset']}",
        $db['user'], $db['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $newPassword = 'Admin@2026';
    $hash = password_hash($newPassword, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE username = 'admin' AND role = 'admin'");
    $stmt->execute([$hash]);

    $rows = $stmt->rowCount();
    if ($rows > 0) {
        echo '<p style="color:green;font-size:20px">✅ تم تعيين كلمة المرور: <strong>Admin@2026</strong></p>';
    } else {
        echo '<p style="color:red">❌ لم يتم تحديث أي سجل. تأكد من وجود حساب admin.</p>';
    }
} catch (Exception $e) {
    echo '<p style="color:red">❌ خطأ: ' . htmlspecialchars($e->getMessage()) . '</p>';
}

// self-delete
unlink(__FILE__);
echo '<p style="color:gray;font-size:13px">🗑️ تم حذف هذا الملف تلقائياً.</p>';
