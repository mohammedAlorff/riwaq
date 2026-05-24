<?php
/**
 * رواق — إعدادات قاعدة البيانات
 *
 * انسخ هذا الملف إلى:   config.php
 * وعدّل القيم بحسب بيئتك.
 *
 * لا ترفع config.php إلى المستودع — أضفه إلى .gitignore.
 */

return [
    // قاعدة البيانات
    'db' => [
        'host'     => '127.0.0.1',
        'port'     => 3306,
        'name'     => 'riwaq',
        'user'     => 'riwaq_user',
        'password' => 'CHANGE_ME',
        'charset'  => 'utf8mb4',
    ],

    // الـ origin المسموح به للـ CORS.
    // اتركها فارغة لو الـ frontend على نفس النطاق.
    // مثال للتطوير المحلي: 'http://localhost:5500'
    'cors_origin' => '',

    // طول الجلسة بالثواني (افتراضي ٨ ساعات)
    'session_ttl_seconds' => 28800,

    // قِيَم rate limit
    'rate_limit' => [
        'login_per_ip_per_15min'  => 10,
        'write_per_user_per_min'  => 60,
        'read_per_ip_per_min'     => 300,
    ],

    // مجلد رفع الصور (نسبي إلى جذر الموقع)
    'uploads_dir'  => __DIR__ . '/../uploads',
    'uploads_url'  => 'uploads',          // كما يظهر في URL للمتصفح
    'max_upload_bytes' => 4 * 1024 * 1024, // ٤ ميغابايت

    // الأنواع المسموحة للرفع
    'allowed_image_mimes' => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],

    // وضع التشخيص (يطبع تفاصيل الأخطاء — أغلقه في الإنتاج)
    'debug' => false,
];
