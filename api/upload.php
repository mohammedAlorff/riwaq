<?php
/**
 * رفع صور للمنشورات — للرؤساء فقط.
 */
declare(strict_types=1);

require_once __DIR__ . '/auth_helpers.php';
riwaq_handle_cors();
riwaq_require_method('POST');

$u = riwaq_require_user('president', 'admin');
riwaq_require_csrf();
riwaq_rate_limit("upload:user:{$u['id']}", 30, 60);

$purpose = isset($_POST['purpose']) ? trim((string)$_POST['purpose']) : '';
// نوع الرفع: post (لصور المنشورات، يحتاج رئيس)، club (لشعار النادي، يقبل أدمن)

if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    riwaq_error('upload_failed', 'لم يُرفع الملف.', 400);
}

$file   = $_FILES['file'];
$cfg    = riwaq_config();
$maxSz  = (int)$cfg['max_upload_bytes'];
$mimes  = $cfg['allowed_image_mimes'];

if ($file['size'] > $maxSz) {
    riwaq_error('too_large', 'حجم الملف يتجاوز الحد المسموح (' . round($maxSz / 1024 / 1024, 1) . ' ميغابايت).', 413);
}

// نوع MIME الحقيقي (وليس الذي يرسله المتصفح)
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime  = $finfo->file($file['tmp_name']);
if (!in_array($mime, $mimes, true)) {
    riwaq_error('invalid_mime', 'نوع الصورة غير مسموح. المسموح: JPEG/PNG/WebP/GIF.', 415);
}

// تحقق فعلي أن الصورة قابلة للقراءة
$dim = @getimagesize($file['tmp_name']);
if (!$dim) {
    riwaq_error('invalid_image', 'الملف ليس صورة سليمة.', 422);
}

$ext = match ($mime) {
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
    'image/gif'  => 'gif',
    default      => 'bin',
};

// مكان الحفظ
$dir = rtrim($cfg['uploads_dir'], '/\\');
if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
    riwaq_error('storage_unavailable', 'تعذّر إنشاء مجلد الرفع.', 500);
}

// اسم آمن (يمنع directory traversal واسماء غريبة)
$prefix = ($u['role'] === 'admin')
    ? ($purpose === 'club' ? 'club' : 'admin')
    : ($u['clubId'] ?? 'user');
$name = sprintf('%s_%s_%s.%s',
    $prefix,
    date('Ymd_His'),
    bin2hex(random_bytes(4)),
    $ext
);
$target = $dir . '/' . $name;

if (!move_uploaded_file($file['tmp_name'], $target)) {
    riwaq_error('save_failed', 'تعذّر حفظ الملف.', 500);
}
@chmod($target, 0644);

$url = rtrim($cfg['uploads_url'], '/') . '/' . $name;

riwaq_audit($u, 'upload.create', 'image', $name, [
    'mime' => $mime,
    'size' => $file['size'],
]);

riwaq_ok([
    'filename' => $name,
    'url'      => $url,
    'mime'     => $mime,
    'size'     => $file['size'],
    'width'    => $dim[0] ?? null,
    'height'   => $dim[1] ?? null,
]);
