const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async function({base, adminLogin, presidentLogin, test}) {
  const {chromium} = require('playwright');
  const browser = await chromium.launch({headless:true, channel:process.env.RIWAQ_TEST_BROWSER_CHANNEL || undefined});
  const errors = [];
  const screenshots = process.env.RIWAQ_TEST_SCREENSHOTS;
  async function login(portal, credentials) {
    const context = await browser.newContext({viewport:{width:1440,height:1000}});
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/' + portal + '/');
    await page.locator('#username').fill(credentials.username);
    await page.locator('#password').fill(credentials.password);
    await page.locator('#login-btn').click();
    await page.locator('#logout').waitFor();
    return page;
  }
  async function api(page, route, method, data) {
    const csrf = (await page.context().cookies()).find(c => c.name === 'riwaq_csrf').value;
    const response = await page.request.fetch(base + '/api/' + route, {method, data, headers:{'X-CSRF-Token':csrf}});
    assert.equal(response.status(), 200);
    return (await response.json()).data;
  }
  async function capture(page, name) {
    for (const width of [1440,390,320]) {
      await page.setViewportSize({width,height:1000});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} overflow at ${width}`);
      if (screenshots) await page.screenshot({path:path.join(screenshots, `${name}-${width}.png`),fullPage:!name.includes('preview')});
    }
    await page.setViewportSize({width:1440,height:1000});
  }
  try {
    const president = await login('presidents', presidentLogin);
    const admin = await login('admin', adminLogin);
    const student = await browser.newPage({viewport:{width:1440,height:1000}});
    student.on('pageerror', error => errors.push(error.message));
    const studentUrl = base + '/' + encodeURIComponent('\u0631\u0648\u0627\u0642.html');
    const event = {description:'Campus workshop',date:'2031-05-12',time:'14:00',location:'Design studio',spots:20};
    await api(president,'events.php','POST',{...event,title:'Afternoon workshop'});
    await api(president,'events.php','POST',{...event,title:'Morning workshop',time:'09:00'});
    await api(president,'events.php','POST',{...event,title:'Archived workshop',date:'2020-05-12'});
    await test('event discovery combines search, club filters and periods', async () => {
      await student.goto(studentUrl + '#events');
      await student.getByLabel('البحث في الفعاليات',{exact:true}).fill('Morning');
      assert.equal(await student.locator('.event-card').count(),1);
      assert.equal(await student.locator('.event-card-title').textContent(),'Morning workshop');
      await student.getByLabel('النادي المنظم',{exact:true}).selectOption({label:'Test club 2'});
      await student.getByText('لا توجد فعاليات تطابق بحثك',{exact:true}).waitFor();
      await student.getByRole('button',{name:'مسح الفلاتر',exact:true}).click();
      const titles = await student.locator('.event-card-title').allTextContents();
      assert.ok(titles.indexOf('Morning workshop') < titles.indexOf('Afternoon workshop'));
      await capture(student,'events');
      await student.getByRole('tab',{name:/السابقة/}).click();
      await student.getByText('Archived workshop',{exact:true}).waitFor();
      assert.equal(await student.locator('.event-card-title').filter({hasText:'Morning workshop'}).count(),0);
    });
    await test('composer preserves drafts and previews an image before publishing', async () => {
      await president.locator('#p-title').fill('Image workshop post');
      await president.locator('#p-body').fill('A complete draft that survives changing content types.');
      await president.locator('[data-type="announcement"]').click();
      await president.locator('#p-title').fill('Separate announcement draft');
      await president.locator('[data-type="event"]').click();
      await president.locator('#ev-title').fill('Unpublished event draft');
      await president.locator('[data-type="socials"]').click();
      await president.locator('#social-twitter').fill('@draft_club');
      await president.locator('[data-type="event"]').click();
      assert.equal(await president.locator('#ev-title').inputValue(),'Unpublished event draft');
      await president.locator('[data-type="socials"]').click();
      assert.equal(await president.locator('#social-twitter').inputValue(),'@draft_club');
      await president.locator('[data-type="post"]').click();
      assert.equal(await president.locator('#p-title').inputValue(),'Image workshop post');
      let uploads = 0;
      president.on('request', request => {if(request.url().endsWith('/api/upload.php') && request.method()==='POST') uploads++;});
      await president.locator('#p-image').setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('not an image')});
      await president.locator('#image-error').filter({hasText:'صورة'}).waitFor();
      const photo = fs.readFileSync(path.join(__dirname,'../assets/campus.jpg'));
      await president.locator('#p-image').setInputFiles({name:'workshop.jpg',mimeType:'image/jpeg',buffer:photo});
      assert.equal(uploads,0);
      await president.locator('#p-preview').click();
      await president.getByRole('dialog',{name:'معاينة المنشور'}).waitFor();
      assert.ok(await president.locator('.preview-image').evaluate(img => img.complete && img.naturalWidth > 0));
      await capture(president,'composer-preview');
      await president.keyboard.press('Escape');
      assert.equal(await president.locator('#p-preview').evaluate(el => el===document.activeElement),true);
      // Hold the browser decoder at its async boundary while the user removes the old image.
      await president.evaluate(() => {
        const decode = HTMLImageElement.prototype.decode;
        HTMLImageElement.prototype.decode = function() {
          return decode.call(this).then(() => new Promise(resolve => {
            window.finishTestDecode = () => {HTMLImageElement.prototype.decode = decode; resolve();};
          }));
        };
      });
      await president.locator('#p-image').setInputFiles({name:'replacement.jpg',mimeType:'image/jpeg',buffer:photo});
      await president.waitForFunction(() => typeof window.finishTestDecode === 'function');
      await president.locator('#image-remove').click();
      try {assert.equal(await president.locator('#p-submit').isEnabled(),true);}
      finally {await president.evaluate(() => window.finishTestDecode());}
      await president.locator('#p-image').setInputFiles({name:'workshop.jpg',mimeType:'image/jpeg',buffer:photo});
      await president.locator('#image-attachment img').waitFor();
      await president.route('**/api/posts.php',route => route.abort());
      await president.locator('#p-submit').click();
      await president.locator('#p-error.show').waitFor();
      assert.equal(await president.locator('#p-title').inputValue(),'Image workshop post');
      assert.equal(uploads,1);
      await president.unroute('**/api/posts.php');
      await president.locator('#p-submit').click();
      await president.locator('.item-title').filter({hasText:'Image workshop post'}).waitFor();
      assert.equal(uploads,1,'Retry must reuse the already uploaded image');
      assert.equal(await president.locator('#p-title').inputValue(),'');
      await president.locator('[data-type="announcement"]').click();
      assert.equal(await president.locator('#p-title').inputValue(),'Separate announcement draft');
      await student.goto(studentUrl);
      const published = student.locator('.post').filter({hasText:'Image workshop post'});
      await published.locator('.post-photo').waitFor();
      assert.ok(await published.locator('.post-photo').evaluate(img => img.complete && img.naturalWidth > 0));
      await capture(president,'composer');
      await president.locator('#logout').click();
      await president.locator('#username').fill(presidentLogin.username);
      await president.locator('#password').fill(presidentLogin.password);
      await president.locator('#login-btn').click();
      await president.locator('[data-type="announcement"]').click();
      assert.equal(await president.locator('#p-title').inputValue(),'');
    });
    await test('admin filters clubs by category and account state', async () => {
      const club = await api(admin,'clubs.php','POST',{name:'Account needed club',cat:'ثقافي',college:'Test college',
        color:'#315c83',icon:'A',desc:'Synthetic club',username:'account_filter_test',password:'Temporary-filter-password'});
      await api(admin,'accounts.php?username=account_filter_test','DELETE');
      await admin.reload();
      await admin.getByLabel('حالة حساب الرئيس',{exact:true}).selectOption('missing');
      assert.equal(await admin.locator('tbody tr').count(),1);
      await admin.getByText('Account needed club',{exact:true}).waitFor();
      await admin.getByLabel('تصنيف النادي',{exact:true}).selectOption('تقني');
      await admin.getByText('لا توجد أندية تطابق الفلاتر',{exact:true}).waitFor();
      await admin.getByRole('button',{name:'مسح الفلاتر',exact:true}).click();
      await admin.getByLabel('حالة حساب الرئيس',{exact:true}).selectOption('active');
      assert.equal(await admin.getByText('Account needed club',{exact:true}).count(),0);
      await admin.getByRole('button',{name:'مسح الفلاتر',exact:true}).click();
      await capture(admin,'admin-filters');
      assert.ok(club.id);
    });
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
};
