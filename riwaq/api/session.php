<?php
declare(strict_types=1);

require_once __DIR__ . '/auth_helpers.php';
riwaq_handle_cors();
riwaq_require_method('GET');

$u = riwaq_current_user();
if (!$u) {
    riwaq_ok(['authenticated' => false]);
}

// Refresh legacy CSRF cookies when an existing management page is reloaded.
$csrf = riwaq_csrf_token($u['token']);
if (($_COOKIE[RIWAQ_COOKIE_CSRF] ?? '') !== $csrf) {
    riwaq_set_cookie(RIWAQ_COOKIE_CSRF, $csrf, strtotime($u['expiresAt'] . ' +03:00'), false);
}

riwaq_ok([
    'authenticated' => true,
    'username'      => $u['username'],
    'role'          => $u['role'],
    'clubId'        => $u['clubId'],
    'expiresAt'     => $u['expiresAt'],
]);
