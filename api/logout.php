<?php
declare(strict_types=1);

require_once __DIR__ . '/auth_helpers.php';
riwaq_handle_cors();
riwaq_require_method('POST');

$u = riwaq_current_user();
if ($u) {
    riwaq_require_csrf();
    riwaq_destroy_session($u['token']);
    riwaq_audit($u, 'logout');
} else {
    // امسح الكوكيز على كل حال
    riwaq_clear_cookie(RIWAQ_COOKIE_SESSION, true);
    riwaq_clear_cookie(RIWAQ_COOKIE_CSRF, false);
}

riwaq_ok();
