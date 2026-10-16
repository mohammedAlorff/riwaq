const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

module.exports = async function concurrency({ php, phpArgs, config, root, client, adminLogin, expectStatus, test }) {
  const env = { ...process.env, RIWAQ_CONFIG_PATH: config };
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
  const port = listener.address().port; await new Promise(resolve => listener.close(resolve));
  const base2 = `http://127.0.0.1:${port}`;
  const server = spawn(php, [...phpArgs, '-S', `127.0.0.1:${port}`, '-t', root, path.join(root, 'router.php')],
    { env, windowsHide: true, stdio: 'ignore' });
  async function gate(mode, action) {
    const child = spawn(php, [...phpArgs, path.join(__dirname, 'concurrency-fixture.php'), mode],
      { env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const done = once(child, 'exit');
    let stderr = '', stdout = '';
    child.stderr.on('data', data => { stderr += data; });
    child.stdout.on('data', data => { stdout += data; });
    const lines = readline.createInterface({ input: child.stdout })[Symbol.asyncIterator]();
    async function receive(expected) {
      let timer;
      try {
        const line = await Promise.race([lines.next(), new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Fixture timed out')), 15000);
        })]);
        assert.equal(line.value, expected, `Fixture ${expected}: ${stderr || line.value}`);
      } finally { clearTimeout(timer); }
    }
    async function command(message, expected) { child.stdin.write(message + '\n'); await receive(expected); }
    try {
      await receive('ready');
      await action({ wait: () => command('wait', 'blocked'), release: () => command('release', 'released') });
    } finally {
      if (child.exitCode === null) child.stdin.end('finish\n');
      const [code] = await done;
      assert.equal(code, 0, stderr || stdout);
    }
  }
  try {
    for (let i = 0; i < 50; i++) {
      try { await fetch(base2 + '/admin/'); break; }
      catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    const admin = client(), secondAdmin = client(base2);
    expectStatus(await admin.request('/api/login.php', 'POST', adminLogin), 200);
    expectStatus(await secondAdmin.request('/api/login.php', 'POST', adminLogin), 200);
    await test('unexpected database errors return JSON 500 without internal details', async () => {
      await gate('fault', async () => {
        const result = await client().request('/api/socials.php?clubId=missing');
        expectStatus(result, 500);
        assert.equal(result.json?.error, 'internal_error');
        assert.equal(result.json.ok, false);
        assert.ok(!/SQLSTATE|PDOException|Stack trace|test_hidden_socials/i.test(result.text));
        assert.match(result.headers.get('cache-control'), /no-store/);
      });
    });
    const password = 'Race-original-password';
    const data = n => ({ name: `Race club ${n}`, cat: '\u062a\u0642\u0646\u064a', college: 'Test college',
      color: '#246b45', icon: 'T', desc: 'Concurrency fixture', username: `race_president_${n}`, password });
    expectStatus(await admin.request('/api/clubs.php', 'POST', data(90)), 200);
    await test('password reset rejects an already-running login with the old hash', async () => {
      const stale = client();
      let pending;
      await gate('reset', async barrier => {
        pending = stale.request('/api/login.php', 'POST', { username: 'race_president_90', password });
        await barrier.wait();
        await barrier.release();
        expectStatus(await pending, 401);
      });
      assert.equal((await stale.request('/api/session.php')).json.data.authenticated, false);
      expectStatus(await stale.request('/api/login.php', 'POST', {
        username: 'race_president_90', password: 'Race-replacement-password'
      }), 200);
    });
    await test('simultaneous club creation allocates different IDs', async () => {
      await gate('clubs', async barrier => {
        const requests = [admin.request('/api/clubs.php', 'POST', data(91)), secondAdmin.request('/api/clubs.php', 'POST', data(92))];
        await barrier.wait(); await barrier.release();
        const results = await Promise.all(requests);
        results.forEach(result => expectStatus(result, 200));
        assert.notEqual(results[0].json.data.id, results[1].json.data.id);
      });
    });
    await test('simultaneous duplicate club usernames return conflict without orphan clubs', async () => {
      const before = (await admin.request('/api/clubs.php')).json.data.length;
      await gate('clubs', async barrier => {
        const requests = [admin.request('/api/clubs.php', 'POST', data(93)), secondAdmin.request('/api/clubs.php', 'POST', data(93))];
        await barrier.wait(); await barrier.release();
        const results = await Promise.all(requests);
        assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
        assert.equal(results.find(r => r.status === 409).json?.error, 'username_taken');
      });
      assert.equal((await admin.request('/api/clubs.php')).json.data.length, before + 1);
    });
    await test('simultaneous president accounts preserve one account per club', async () => {
      const club = await admin.request('/api/clubs.php', 'POST', data(94)); expectStatus(club, 200);
      expectStatus(await admin.request('/api/accounts.php?username=race_president_94', 'DELETE'), 200);
      await gate('accounts', async barrier => {
        const requests = [admin.request('/api/accounts.php', 'POST', { username: 'race_account_a', clubId: club.json.data.id, password }),
          secondAdmin.request('/api/accounts.php', 'POST', { username: 'race_account_b', clubId: club.json.data.id, password })];
        await barrier.wait(); await barrier.release();
        const results = await Promise.all(requests);
        assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
        assert.equal(results.find(r => r.status === 409).json?.error, 'club_has_account');
      });
      const accounts = (await admin.request('/api/accounts.php')).json.data.accounts;
      assert.equal(accounts.filter(a => a.clubId === club.json.data.id).length, 1);
    });
  } finally {
    if (server.exitCode === null) { const done = once(server, 'exit'); server.kill(); await done; }
  }
};
