<?php
declare(strict_types=1);

require_once __DIR__ . '/auth_helpers.php';
riwaq_handle_cors();
riwaq_require_method('GET');

$u = riwaq_current_user();
if (!$u) {
    riwaq_ok(['authenticated' => false]);
}

riwaq_ok([
    'authenticated' => true,
    'username'      => $u['username'],
    'role'          => $u['role'],
    'clubId'        => $u['clubId'],
    'expiresAt'     => $u['expiresAt'],
]);
