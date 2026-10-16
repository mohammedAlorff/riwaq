// Uses a new local database and ephemeral server; never changes working data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const { once } = require('node:events');
const root = path.resolve(__dirname, '..');
const bundled = path.resolve(root, '../.tools/php/php.exe');
const php = process.env.RIWAQ_TEST_PHP || (fs.existsSync(bundled) ? bundled : 'php');
const phpArgs = fs.existsSync(bundled) && php === bundled
  ? ['-d', `extension_dir=${path.dirname(php)}/ext`, ...['pdo_mysql','mbstring','fileinfo','openssl'].flatMap(x => ['-d', `extension=${x}`])] : [];
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'riwaq-test-'));
const config = path.join(temp, 'config.php');
let server;
let failures = 0;
let passed = 0;
let base;
function fixture(mode) {
  return execFileSync(php, [...phpArgs, path.join(__dirname, 'fixture.php'), mode, config], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
async function test(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`); }
}
function client(origin = base) {
  const cookies = new Map();
  return { cookies, async request(url, method = 'GET', data, options = {}) {
    const headers = { Cookie: [...cookies].map(([k,v]) => `${k}=${v}`).join('; '), ...options.headers };
    const multipart = data instanceof FormData;
    if (data !== undefined && !multipart) headers['Content-Type'] = 'application/json';
    if (options.csrf !== false && cookies.has('riwaq_csrf')) headers['X-CSRF-Token'] = cookies.get('riwaq_csrf');
    const response = await fetch(origin + url, { method, headers, body: data === undefined ? undefined : multipart ? data : JSON.stringify(data), redirect: 'manual' });
    for (const cookie of response.headers.getSetCookie()) {
      const [key, value] = cookie.split(';')[0].split('='); cookies.set(key, value);
    }
    const text = await response.text();
    let json; try { json = JSON.parse(text); } catch {}
    return { status: response.status, json, text, headers: response.headers };
  }};
}
function expectStatus(response, status) {
  assert.equal(response.status, status, `expected ${status}, received ${response.status} (${response.json?.error || 'non-JSON'})`);
}
(async () => {
  try {
    const adminLogin = JSON.parse(fixture('create'));
    await test('backend proxy, rate-window and session regressions', async () => {
      const output=execFileSync(php,[...phpArgs,path.join(__dirname,'backend.php')],{
        env:{...process.env,RIWAQ_CONFIG_PATH:config},encoding:'utf8',stdio:['ignore','pipe','pipe']
      });
      console.log(output.trim());
    });
    const listener = net.createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
    const port = listener.address().port; await new Promise(resolve => listener.close(resolve));
    base = `http://127.0.0.1:${port}`;
    server = spawn(php, [...phpArgs, '-S', `127.0.0.1:${port}`, '-t', root, path.join(__dirname,'router.php')], {
      env: {...process.env, RIWAQ_CONFIG_PATH: config}, windowsHide: true, stdio: 'ignore'
    });
    for (let i=0;i<50;i++) { try { await fetch(base+'/admin/'); break; } catch { await new Promise(r=>setTimeout(r,100)); } }
    const guest = client(), admin = client(), president = client(), other = client();
    await test('anonymous users cannot write or list accounts', async () => {
      for (const [url, method] of [['accounts.php','GET'],['posts.php','POST'],['events.php','POST'],['clubs.php','POST'],['socials.php','PUT'],['upload.php','POST']])
        expectStatus(await guest.request('/api/'+url, method, method === 'GET' ? undefined : {}),401);
    });
    await test('portal paths redirect to trailing slash', async () => {
      for (const portal of ['admin','presidents']) {
        const r=await guest.request('/'+portal); assert.ok([301,302,308].includes(r.status)); assert.equal(r.headers.get('location'),'/'+portal+'/');
      }
    });
    await test('private files and setup are not public', async () => {
      for (const url of ['/api/setup.php?force=1','/api/config.local.php','/setup-output.html','/tests/fixture.php','/docs/review-plan.md'])
        expectStatus(await guest.request(url),404);
    });
    expectStatus(await admin.request('/api/login.php','POST',adminLogin),200);
    const password = 'Temporary-test-password-2026';
    const clubData = n => ({name:`Test club ${n}`,short:'Test',cat:'تقني',college:'Test college',color:'#246b45',icon:'T',desc:'Synthetic test club',username:`test_president_${n}`,password});
    const club1 = await admin.request('/api/clubs.php','POST',clubData(1)); expectStatus(club1,200);
    const club2 = await admin.request('/api/clubs.php','POST',clubData(2)); expectStatus(club2,200);
    expectStatus(await president.request('/api/login.php','POST',{username:'test_president_1',password}),200);
    expectStatus(await other.request('/api/login.php','POST',{username:'test_president_2',password}),200);
    await test('presidents cannot manage clubs or accounts', async () => {
      for (const [url,method] of [['accounts.php','GET'],['accounts.php','POST'],['clubs.php','POST'],[`clubs.php?id=${club2.json.data.id}`,'PUT']])
        expectStatus(await president.request('/api/'+url,method,method==='GET'?undefined:{}),403);
    });
    const post = {type:'post',title:'Test post',body:'Synthetic test content',tags:['test']};
    await test('missing and forged CSRF tokens are rejected', async () => {
      expectStatus(await president.request('/api/posts.php','POST',post,{csrf:false}),419);
      const saved=president.cookies.get('riwaq_csrf'); president.cookies.set('riwaq_csrf','forged');
      try { expectStatus(await president.request('/api/posts.php','POST',post),419); }
      finally { president.cookies.set('riwaq_csrf',saved); }
    });
    await test('invalid optional values and passwords produce JSON errors', async () => {
      expectStatus(await president.request('/api/posts.php','POST',{...post, externalUrl:[]}),422);
      expectStatus(await admin.request('/api/accounts.php?username=test_president_1','PUT',{password:['secret']}),422);
    });
    await test('unsafe and malformed URLs are rejected', async () => {
      for (const externalUrl of ['javascript:alert(1)','ftp://example.com/file','https://bad host/path','https://example.com\\@evil.test'])
        expectStatus(await president.request('/api/posts.php','POST',{...post,externalUrl}),422);
    });
    const event={title:'Test event',description:'Test',date:'2027-02-15',time:'12:30',location:'Test room',spots:10};
    await test('invalid dates, clock times and seat counts are rejected',async()=>{
      for (const change of [{date:'2027-02-30'},{date:'2027-02-15junk'},{time:'24:00'},{time:'12:99'},{time:'12:30:00junk'},{spots:1.5},{spots:[]}])
        expectStatus(await president.request('/api/events.php','POST',{...event,...change}),422);
    });
    await test('required club fields cannot be cleared',async()=>{
      for (const change of [{name:''},{college:''},{desc:''}])
        expectStatus(await admin.request(`/api/clubs.php?id=${club1.json.data.id}`,'PUT',change),422);
    });
    const createdPost=await president.request('/api/posts.php','POST',{...post,clubId:club2.json.data.id}); expectStatus(createdPost,200);
    const createdEvent=await president.request('/api/events.php','POST',event); expectStatus(createdEvent,200);
    await test('malformed queries cannot coerce a different resource ID',async()=>{
      for(const url of ['/api/posts.php?clubId[]=x','/api/events.php?clubId[]=x','/api/clubs.php?id[]=x','/api/socials.php?clubId[]=x'])
        expectStatus(await guest.request(url),422);
      expectStatus(await president.request(`/api/posts.php?id=${createdPost.json.data.id}junk`,'DELETE'),422);
    });
    await test('uploads validate actual bytes and accept a valid image',async()=>{
      const bad=new FormData(); bad.append('file',new Blob(['<?php echo 1; ?>'],{type:'image/png'}),'pretend.png');
      expectStatus(await president.request('/api/upload.php','POST',bad),415);
      const good=new FormData();
      const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6S8AAAAASUVORK5CYII=','base64');
      good.append('file',new Blob([png],{type:'image/png'}),'test.png');
      const result=await president.request('/api/upload.php','POST',good); expectStatus(result,200);
      assert.equal(result.json.data.mime,'image/png'); assert.equal(result.json.data.width,1);
      assert.ok(fs.existsSync(path.join(temp,'uploads',result.json.data.filename)));
      const imagePost=await president.request('/api/posts.php','POST',{...post,image:result.json.data.filename});
      expectStatus(imagePost,200);
      assert.equal(imagePost.json.data.image,result.json.data.filename);
      expectStatus(await other.request('/api/posts.php','POST',{...post,image:result.json.data.filename}),422);
      for(const image of ['../config.php','https://example.com/image.png',[],`${club1.json.data.id}_20260101_120000_12345678.png`])
        expectStatus(await president.request('/api/posts.php','POST',{...post,image}),422);
    });
    if (process.env.RIWAQ_TEST_BROWSER) await test('browser workflows for the three portals',async()=>{
      await require('./browser.cjs')({base,adminLogin,presidentLogin:{username:'test_president_1',password}});
    });
    else console.log('SKIP browser workflows (set RIWAQ_TEST_BROWSER=1)');
    if (process.env.RIWAQ_TEST_BROWSER) await require('./experience.cjs')({base,adminLogin,presidentLogin:{username:'test_president_1',password},test});
    await test('server owns club assignment and enforces cross-club deletion', async()=>{
      assert.equal(createdPost.json.data.clubId,club1.json.data.id);
      expectStatus(await other.request(`/api/posts.php?id=${createdPost.json.data.id}`,'DELETE'),403);
      expectStatus(await other.request(`/api/events.php?id=${createdEvent.json.data.id}`,'DELETE'),403);
    });
    await test('deleting an event removes its linked public post',async()=>{
      expectStatus(await president.request(`/api/events.php?id=${createdEvent.json.data.id}`,'DELETE'),200);
      const posts=await guest.request('/api/posts.php'); assert.ok(!posts.json.data.some(p=>p.linkedEventId===createdEvent.json.data.id));
    });
    await test('password reset revokes president sessions',async()=>{
      expectStatus(await admin.request('/api/accounts.php?username=test_president_1','PUT',{password:'Replacement-test-password'}),200);
      const session=await president.request('/api/session.php'); assert.equal(session.json.data.authenticated,false);
      expectStatus(await president.request('/api/posts.php','POST',post),401);
    });
    await test('logout revokes the saved session token',async()=>{
      const stale=client(); stale.cookies.set('riwaq_session',other.cookies.get('riwaq_session'));
      expectStatus(await other.request('/api/logout.php','POST'),200);
      assert.equal((await stale.request('/api/session.php')).json.data.authenticated,false);
    });
    await test('deleting a club cascades its accounts, sessions and posts',async()=>{
      expectStatus(await president.request('/api/login.php','POST',{username:'test_president_1',password:'Replacement-test-password'}),200);
      assert.equal((await president.request('/api/session.php')).json.data.authenticated,true);
      expectStatus(await president.request('/api/events.php','POST',event),200);
      expectStatus(await president.request('/api/socials.php','PUT',{socials:{twitter:{handle:'test_club',url:'https://example.com/test'}}}),200);
      const stale=client(); stale.cookies.set('riwaq_session',president.cookies.get('riwaq_session'));
      expectStatus(await admin.request(`/api/clubs.php?id=${club1.json.data.id}`,'DELETE'),200);
      const accounts=await admin.request('/api/accounts.php');
      assert.ok(!accounts.json.data.accounts.some(a=>a.clubId===club1.json.data.id));
      const posts=await guest.request(`/api/posts.php?clubId=${club1.json.data.id}`); assert.equal(posts.json.data.length,0);
      const events=await guest.request(`/api/events.php?clubId=${club1.json.data.id}`); assert.equal(events.json.data.length,0);
      const socials=await guest.request(`/api/socials.php?clubId=${club1.json.data.id}`); assert.equal(Object.keys(socials.json.data).length,0);
      assert.equal((await stale.request('/api/session.php')).json.data.authenticated,false);
    });
    fixture('reset-limits');
    await require('./concurrency.cjs')({ php, phpArgs, config, root, client, adminLogin, expectStatus, test });
    fixture('reset-limits');
    await test('rotating spoofed IP headers does not bypass login limits',async()=>{
      let limited=false;
      for(let i=0;i<11;i++) {
        const result=await guest.request('/api/login.php','POST',{username:'missing',password:'invalid-password'},
          {headers:{'X-Forwarded-For':`203.0.113.${i+1}`,'X-Real-IP':`203.0.113.${i+1}`}});
        if(result.status===429) {limited=true;break;}
        expectStatus(result,401);
      }
      assert.equal(limited,true);
    });
  } catch(error) { failures++; console.error(`TEST SETUP/WORKFLOW FAILED: ${error.message}`); }
  finally {
    if(server && server.exitCode===null) { const exited=once(server,'exit'); server.kill(); await exited; }
    if(fs.existsSync(config)) fixture('drop');
    fs.rmSync(temp,{recursive:true,force:true});
    console.log(`${passed} passed; ${failures} failed. Test database and server removed.`);
    if(failures) process.exitCode=1;
  }
})();
