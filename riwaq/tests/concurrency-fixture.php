<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__) . '/api/auth_helpers.php';
$cfg = riwaq_config()['db'];
if (!preg_match('/^riwaq_test_[a-f0-9]{16}$/D', $cfg['name'])
    || !in_array($cfg['host'], ['127.0.0.1', 'localhost', '::1'], true)) {
    throw new RuntimeException('Refusing a non-test database.');
}
$db = riwaq_db();
$mode = $argv[1] ?? '';
$gate = 'test-gate-' . $cfg['name'];
$table = $mode === 'clubs' ? 'clubs' : 'users';
$trigger = false;
$fault = false;
function report(string $state): void { echo $state . "\n"; flush(); }
try {
    if ($mode === 'reset') {
        $db->beginTransaction();
        $db->prepare('UPDATE users SET password_hash = ? WHERE username = ?')
            ->execute([riwaq_hash_password('Race-replacement-password'), 'race_president_90']);
        $db->exec("DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE username = 'race_president_90')");
    } elseif (in_array($mode, ['clubs', 'accounts'], true)) {
        $db->query("SELECT GET_LOCK('$gate', 10)");
        // Hold both real HTTP requests at the write boundary, not an arbitrary sleep.
        $db->exec("CREATE TRIGGER test_insert_gate BEFORE INSERT ON $table FOR EACH ROW
            BEGIN DO GET_LOCK('$gate', 15); DO RELEASE_LOCK('$gate'); END");
        $trigger = true;
    } elseif ($mode === 'fault') {
        $db->exec('RENAME TABLE socials TO test_hidden_socials');
        $fault = true;
    } else { throw new RuntimeException('Unknown concurrency fixture.'); }
    report('ready');
    while (($command = fgets(STDIN)) !== false) {
        $command = trim($command);
        if ($command === 'wait') {
            $deadline = microtime(true) + 10;
            do {
                $waiting = 0;
                foreach ($db->query('SHOW FULL PROCESSLIST')->fetchAll() as $process) {
                    if ($process['db'] !== $cfg['name'] || !$process['Info']) continue;
                    $sql = $process['Info'];
                    $match = $mode === 'reset'
                        ? preg_match('/INSERT INTO sessions|FROM users.*FOR UPDATE/is', $sql)
                        : preg_match('/INSERT INTO ' . $table . '|(?:SELECT|DO) GET_LOCK/i', $sql);
                    if ($match) $waiting++;
                }
                if ($waiting >= ($mode === 'reset' ? 1 : 2)) break;
                usleep(20000);
            } while (microtime(true) < $deadline);
            if ($waiting < ($mode === 'reset' ? 1 : 2)) throw new RuntimeException('Requests did not reach the lock barrier.');
            report('blocked');
        } elseif ($command === 'release') {
            if ($db->inTransaction()) $db->commit();
            else $db->query("SELECT RELEASE_LOCK('$gate')");
            report('released');
        } elseif ($command === 'finish') { break; }
        else { throw new RuntimeException('Unknown fixture command.'); }
    }
} finally {
    if ($db->inTransaction()) $db->rollBack();
    $db->query("SELECT RELEASE_LOCK('$gate')");
    if ($trigger) $db->exec('DROP TRIGGER IF EXISTS test_insert_gate');
    if ($fault) $db->exec('RENAME TABLE test_hidden_socials TO socials');
}
