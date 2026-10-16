/* رواق — لوحة رؤساء الأندية (تستخدم REST API)
 *
 * كل العمليات عبر window.RiwaqAPI:
 *   - login / logout / session
 *   - posts.list / create / remove
 *   - events.list / create / remove
 *   - socials.get / update
 *   - upload.image
 */

// ----------------------------------------------------------------
// أدوات DOM
// ----------------------------------------------------------------
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function escape(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function arabicDigits(str) {
  const map = { "0":"٠","1":"١","2":"٢","3":"٣","4":"٤","5":"٥","6":"٦","7":"٧","8":"٨","9":"٩" };
  return String(str).replace(/[0-9]/g, d => map[d]);
}

function relativeTimeAr(input) {
  if (!input) return "";
  const iso = typeof input === "string" && !input.includes("T") ? input.replace(" ", "T") : input;
  const ts = new Date(iso).getTime();
  if (!isFinite(ts)) return "";
  const diff = Math.max(0, Date.now() - ts);
  const min  = Math.floor(diff / 60000);
  const hour = Math.floor(min / 60);
  const day  = Math.floor(hour / 24);
  if (min < 1)   return "الآن";
  if (min === 1) return "قبل دقيقة";
  if (min < 60)  return `قبل ${arabicDigits(min)} دقيقة`;
  if (hour === 1) return "قبل ساعة";
  if (hour < 24)  return `قبل ${arabicDigits(hour)} ساعة`;
  if (day === 1) return "أمس";
  if (day < 30)  return `قبل ${arabicDigits(day)} يوماً`;
  return arabicDigits(input.slice(0, 10));
}

let toastTimer = null;
function toast(msg, kind) {
  let t = $("#toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.toggle("toast-danger", kind === "danger");
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}

// ----------------------------------------------------------------
// حالة محلية
// ----------------------------------------------------------------
let SESSION = null;
let CLUB    = null;
let SOCIALS = {};
let MY_POSTS  = [];
let MY_EVENTS = [];
let currentTab = "post";  // post | announcement | event | socials
let drafts = {};
let publishing = false;

function draftFor(type = currentTab) {
  return drafts[type] || (drafts[type] = {values:{}, file:null, previewUrl:null, uploaded:null, imageVersion:0});
}
function clearDraft(type) {
  const draft = drafts[type];
  if (draft?.previewUrl) URL.revokeObjectURL(draft.previewUrl);
  delete drafts[type];
}
function clearDrafts() {
  Object.keys(drafts).forEach(clearDraft);
  currentTab = "post";
}
function captureDraft(type = currentTab) {
  const draft = draftFor(type);
  $$("#form-slot input:not([type=file]), #form-slot textarea, #form-slot select")
    .forEach(input => { if (input.id) draft.values[input.id] = input.value; });
  return draft;
}
function bindDraft(form) {
  const draft = draftFor();
  Object.entries(draft.values).forEach(([id,value]) => { const field = $("#" + id, form); if (field) field.value = value; });
  form.addEventListener("input", () => captureDraft());
  form.addEventListener("reset", event => {
    event.preventDefault();
    if (publishing) return;
    clearDraft(currentTab);
    renderForm();
  });
  setComposerBusy(publishing);
}
function setComposerBusy(value) {
  publishing = value;
  $$("#form-slot input, #form-slot textarea, #form-slot select, #form-slot button, #type-chips button, #logout")
    .forEach(control => { control.disabled = value; });
  if (drafts[currentTab]?.imagePending) {
    if ($("#p-submit")) $("#p-submit").disabled = true;
    if ($("#p-preview")) $("#p-preview").disabled = true;
  }
}
function renderImageAttachment() {
  const slot = $("#image-attachment");
  if (!slot) return;
  const draft = draftFor();
  slot.innerHTML = draft.file ? `
    <img src="${escape(draft.previewUrl)}" alt="الصورة المرفقة"/>
    <span class="attachment-name">${escape(draft.file.name)}<small>${arabicDigits(Math.max(1, Math.round(draft.file.size / 1024)))} ك.ب</small></span>
    <button type="button" class="tool-btn" id="image-remove" title="إزالة الصورة" aria-label="إزالة الصورة">${RiwaqUI.icon('Trash2')}</button>` : '';
  slot.hidden = !draft.file;
  if (draft.file) $("#image-remove").addEventListener("click", () => {
    if (publishing) return;
    draft.imageVersion++;
    draft.imagePending = false;
    URL.revokeObjectURL(draft.previewUrl);
    draft.file = draft.previewUrl = draft.uploaded = null;
    $("#p-image").value = '';
    renderImageAttachment();
    setComposerBusy(publishing);
  });
}
async function choosePostImage(event) {
  if (publishing) return;
  const file = event.target.files[0];
  if (!file) return;
  const type = currentTab;
  const draft = draftFor(type);
  const version = ++draft.imageVersion;
  draft.imagePending = false;
  const error = $("#image-error");
  error.textContent = '';
  event.target.value = '';
  setComposerBusy(publishing);
  if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type) || file.size > 4 * 1024 * 1024) {
    error.textContent = 'اختر صورة PNG أو JPG أو WebP أو GIF بحجم لا يتجاوز ٤ م.ب.';
    return;
  }
  const url = URL.createObjectURL(file);
  draft.imagePending = true;
  setComposerBusy(false);
  try {
    const probe = new Image();
    probe.src = url;
    await probe.decode();
    if (drafts[type] !== draft || draft.imageVersion !== version || publishing) {
      URL.revokeObjectURL(url);
      return;
    }
    if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    draft.file = file;
    draft.previewUrl = url;
    draft.uploaded = null;
    if (currentTab === type) renderImageAttachment();
  } catch {
    URL.revokeObjectURL(url);
    if (drafts[type] === draft && draft.imageVersion === version && currentTab === type) {
      $("#image-error").textContent = 'تعذّر قراءة الصورة. اختر ملفًا سليمًا.';
    }
  } finally {
    if (draft.imageVersion === version) {
      draft.imagePending = false;
      if (drafts[type] === draft && currentTab === type) setComposerBusy(publishing);
    }
  }
}
function previewPost() {
  const draft = captureDraft();
  const isAnnouncement = currentTab === 'announcement';
  const label = isAnnouncement ? 'إعلان' : 'منشور';
  const dialog = document.createElement('dialog');
  dialog.className = 'post-preview-dialog';
  dialog.setAttribute('aria-labelledby', 'preview-title');
  dialog.innerHTML = `<header class="preview-head"><h2 id="preview-title">معاينة المنشور</h2>
    <button type="button" class="tool-btn" aria-label="إغلاق المعاينة" title="إغلاق المعاينة">${RiwaqUI.icon('X')}</button></header>
    <article class="preview-content"><div class="preview-author"><span class="preview-club-icon" style="background:${escape(CLUB.color)}">${escape(CLUB.icon)}</span>
    <span><strong>${escape(CLUB.name)}</strong><small>${escape(CLUB.college)}</small></span><span class="preview-type">${label}</span></div>
    <h3>${escape(draft.values['p-title'] || 'عنوان المنشور')}</h3>
    <p>${escape(draft.values['p-body'] || '')}</p>
    ${draft.file ? `<img class="preview-image" src="${escape(draft.previewUrl)}" alt="الصورة المرفقة"/>` : ''}
    <div class="preview-tags">${(draft.values['p-tags'] || '').split(/[،,]/).map(t => t.trim()).filter(Boolean).map(t => `<span>${escape(t.startsWith('#') ? t : '#'+t)}</span>`).join('')}</div>
    ${draft.values['p-url'] ? `<div class="preview-link" dir="ltr">${escape(draft.values['p-url'])}</div>` : ''}</article>`;
  const trigger = $("#p-preview");
  const previousOverflow = document.body.style.overflow;
  document.body.appendChild(dialog);
  document.body.style.overflow = 'hidden';
  dialog.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    dialog.remove();
    trigger?.focus();
  }, {once:true});
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.showModal();
}

// ----------------------------------------------------------------
// تسجيل الدخول
// ----------------------------------------------------------------
function renderLogin() {
  clearDrafts();
  SESSION = null;
  $("#root").innerHTML = `
    <div class="login-shell">
      <div class="login-card">
        <div class="login-brand">
          <div class="brand-mark">ر</div>
          <div class="brand-text">
            <div class="brand-name">رواق</div>
            <div class="brand-sub">جامعة الإمام محمد بن سعود الإسلامية</div>
          </div>
          <span class="brand-pill" style="margin-inline-start:auto">لوحة الرؤساء</span>
        </div>

        <div class="login-title">تسجيل دخول رئيس النادي</div>
        <div class="login-sub">
          ادخل باسم المستخدم وكلمة المرور الخاصَّين بنادي الجامعة
          (يُسلَّمان لك من قِبل إدارة الأنشطة الطلابية).
        </div>

        <form id="login-form" autocomplete="off">
          <div class="field">
            <label for="username">اسم المستخدم<span class="req">*</span></label>
            <input id="username" type="text" required autocomplete="off"
                   placeholder="مثال: club_c1"
                   style="direction:ltr;text-align:left"/>
          </div>
          <div class="field">
            <label for="password">كلمة المرور<span class="req">*</span></label>
            <input id="password" type="password" required autocomplete="off"
                   style="direction:ltr;text-align:left"/>
          </div>

          <div style="margin-top:22px">
            <button type="submit" class="btn btn-primary btn-lg btn-block" id="login-btn">
              تسجيل الدخول
            </button>
          </div>
        </form>

        <hr class="sep"/>
        <div class="muted" style="font-size:12px;text-align:center;line-height:1.7">
          ليس لديك حساب؟ اطلبه من
          <a href="../admin/" style="color:var(--brand);font-weight:700">إدارة المنصة</a>
          ·
          منصة الطلبة في
          <a href="../رواق.html" style="color:var(--brand);font-weight:700">رواق</a>
        </div>
      </div>
    </div>
  `;

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#login-btn");
    const username = $("#username").value.trim();
    const password = $("#password").value;
    if (!username || !password) return;

    btn.disabled = true;
    btn.textContent = "جارٍ التحقق…";

    try {
      const result = await window.RiwaqAPI.login(username, password);
      if (result.role !== "president") {
        await window.RiwaqAPI.logout().catch(()=>{});
        toast("هذا الحساب ليس حساب رئيس نادٍ", "danger");
        btn.disabled = false;
        btn.textContent = "تسجيل الدخول";
        return;
      }
      await loadAndRenderDashboard();
    } catch (err) {
      toast(err.message || "اسم المستخدم أو كلمة المرور غير صحيحة", "danger");
      btn.disabled = false;
      btn.textContent = "تسجيل الدخول";
      $("#password").value = "";
      $("#password").focus();
    }
  });

  setTimeout(() => $("#username") && $("#username").focus(), 30);
}

// ----------------------------------------------------------------
// تحميل البيانات
// ----------------------------------------------------------------
async function loadAndRenderDashboard() {
  $("#root").innerHTML = `
    <div class="login-shell"><div class="login-card" style="text-align:center">
      <div class="spinner" style="margin:20px auto"></div>
      <div style="color:var(--ink-3);font-size:13px">جاري تحميل لوحة التحكم…</div>
    </div></div>
  `;

  try {
    const session = await window.RiwaqAPI.session();
    if (SESSION && SESSION.username !== session.username) clearDrafts();
    SESSION = session;
    if (!SESSION.authenticated || SESSION.role !== "president") {
      return renderLogin();
    }

    const [club, posts, events, socials] = await Promise.all([
      window.RiwaqAPI.clubs.get(SESSION.clubId),
      window.RiwaqAPI.posts.list({ clubId: SESSION.clubId }),
      window.RiwaqAPI.events.list({ clubId: SESSION.clubId }),
      window.RiwaqAPI.socials.get(SESSION.clubId),
    ]);
    CLUB      = club;
    MY_POSTS  = posts;
    MY_EVENTS = events;
    SOCIALS   = socials || {};
    renderDashboard();
  } catch (err) {
    if (err.status === 401) {
      return renderLogin();
    }
    $("#root").innerHTML = `
      <div class="login-shell"><div class="login-card">
        <h2 style="color:var(--danger);margin-bottom:10px">تعذّر تحميل البيانات</h2>
        <p>${escape(err.message || "")}</p>
        <button class="btn btn-primary" id="retry">إعادة المحاولة</button>
      </div></div>
    `;
    $("#retry").addEventListener("click", loadAndRenderDashboard);
  }
}

// ----------------------------------------------------------------
// عرض اللوحة
// ----------------------------------------------------------------
function renderDashboard() {
  const announcements = MY_POSTS.filter(p => p.type === "announcement").length;
  const regularPosts  = MY_POSTS.filter(p => p.type === "post").length;

  $("#root").innerHTML = `
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">ر</div>
        <div class="brand-text">
          <div class="brand-name">رواق</div>
          <div class="brand-sub">لوحة رئيس النادي</div>
        </div>
      </div>
      <div class="topbar-spacer"></div>

      <div class="club-pill" title="${escape(CLUB.college)}">
        <div class="club-pill-icon" style="background:${CLUB.color}">${escape(CLUB.icon)}</div>
        <div>
          <div class="club-pill-name">${escape(CLUB.name)}</div>
          <div class="club-pill-sub">${escape(SESSION.username)} · ${escape(CLUB.college)}</div>
        </div>
      </div>

      <a class="btn-link" href="../رواق.html" target="_blank" rel="noopener">معاينة منصة الطلبة ↗</a>
      <button class="btn-link" id="logout">تسجيل الخروج</button>
    </header>

    <main class="page">
      <div class="page-head">
        <div>
          <h1>${escape(CLUB.name)}</h1>
          <div class="sub">${escape(CLUB.college)} · مساحة النشر</div>
        </div>
      </div>

      <div class="stats">
        <div class="stat">
          <div class="stat-label">المنشورات</div>
          <div class="stat-value">${arabicDigits(regularPosts)}</div>
          <div class="stat-hint">من نشر ناديك</div>
        </div>
        <div class="stat">
          <div class="stat-label">الإعلانات</div>
          <div class="stat-value">${arabicDigits(announcements)}</div>
          <div class="stat-hint">إعلانات مثبتة</div>
        </div>
        <div class="stat">
          <div class="stat-label">الفعاليات</div>
          <div class="stat-value">${arabicDigits(MY_EVENTS.length)}</div>
          <div class="stat-hint">فعالية منشورة</div>
        </div>
        <div class="stat">
          <div class="stat-label">إجمالي المنشور</div>
          <div class="stat-value">${arabicDigits(MY_POSTS.length)}</div>
          <div class="stat-hint">عنصر ظاهر للطلبة</div>
        </div>
      </div>

      <div class="dash-grid">
        <section class="card" id="composer-card">
          <div class="card-head">
            <h2>إضافة محتوى جديد</h2>
            <span class="sub composer-status">مسودة جديدة</span>
          </div>

          <div class="chips" id="type-chips">
            <button type="button" class="chip ${currentTab==='post'?'active':''}"         data-type="post">منشور</button>
            <button type="button" class="chip ${currentTab==='announcement'?'active':''}" data-type="announcement">إعلان</button>
            <button type="button" class="chip ${currentTab==='event'?'active':''}"        data-type="event">فعالية</button>
            <button type="button" class="chip ${currentTab==='socials'?'active':''}"      data-type="socials">حسابات التواصل</button>
          </div>

          <div id="form-slot" style="margin-top:18px"></div>
        </section>

        <section class="card" id="list-card">
          <div class="card-head">
            <h2>محتواي المنشور</h2>
            <span class="sub">${arabicDigits(MY_POSTS.length + MY_EVENTS.filter(ev => !MY_POSTS.some(p => p.linkedEventId === ev.id)).length)} عنصر</span>
          </div>
          <div id="list-slot"></div>
        </section>
      </div>
    </main>
  `;

  $("#logout").addEventListener("click", async () => {
    try { await window.RiwaqAPI.logout(); renderLogin(); }
    catch (error) { toast(error.message || "تعذّر تسجيل الخروج، حاول مرة أخرى", "danger"); }
  });

  $$("#type-chips .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      if (publishing || chip.dataset.type === currentTab) return;
      captureDraft();
      currentTab = chip.dataset.type;
      $$("#type-chips .chip").forEach(c => c.classList.toggle("active", c === chip));
      renderForm();
    });
  });

  renderForm();
  renderList();
}

// ----------------------------------------------------------------
// النماذج
// ----------------------------------------------------------------
function renderForm() {
  const slot = $("#form-slot");

  if (currentTab === "event") {
    slot.innerHTML = `
      <form id="form-event" autocomplete="off">
        <div class="field">
          <label for="ev-title">عنوان الفعالية<span class="req">*</span></label>
          <input id="ev-title" type="text" required maxlength="200" placeholder="مثال: هاكاثون رواق ٢٠٢٦"/>
        </div>
        <div class="field">
          <label for="ev-desc">وصف الفعالية</label>
          <textarea id="ev-desc" placeholder="نبذة قصيرة عن الفعالية وأهدافها وما يحصل عليه المشاركون…"></textarea>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="ev-date">التاريخ<span class="req">*</span></label>
            <input id="ev-date" type="date" required/>
          </div>
          <div class="field">
            <label for="ev-time">الوقت<span class="req">*</span></label>
            <input id="ev-time" type="time" required/>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="ev-loc">المكان<span class="req">*</span></label>
            <input id="ev-loc" type="text" required maxlength="200" placeholder="مثال: مبنى ٢٤ - قاعة الإبداع"/>
          </div>
          <div class="field">
            <label for="ev-spots">عدد المقاعد<span class="req">*</span></label>
            <input id="ev-spots" type="number" min="1" max="100000" required placeholder="١٠٠"/>
          </div>
        </div>
        <div class="field">
          <label for="ev-reg">
            رابط تسجيل الطلبة
            <span style="color:var(--ink-4);font-weight:400;font-size:11px"> (يُنصح بإضافته)</span>
          </label>
          <input id="ev-reg" type="url" maxlength="500"
                 placeholder="https://forms.gle/..."
                 style="direction:ltr;text-align:left"/>
          <span class="hint">
            أنشئ نموذج Google Forms أو Microsoft Forms وألصق رابطه هنا.
            سيظهر للطلبة كزر <strong>«سجِّل في الفعالية»</strong> مباشرةً في بطاقة الفعالية.
          </span>
        </div>
        <div class="form-error" id="ev-error"></div>
        <div class="form-actions">
          <span class="muted">سيتم نشر الفعالية تحت <strong style="color:var(--ink-2)">${escape(CLUB.name)}</strong></span>
          <span class="spacer"></span>
          <button type="reset" class="btn btn-ghost">مسح</button>
          <button type="submit" class="btn btn-primary" id="ev-submit">نشر الفعالية</button>
        </div>
      </form>
    `;
    $("#form-event").addEventListener("submit", onSubmitEvent);
    bindDraft($("#form-event"));
    return;
  }

  if (currentTab === "socials") {
    renderSocialsForm();
    bindDraft($("#form-socials"));
    return;
  }

  const label = currentTab === "announcement" ? "إعلان" : "منشور";
  slot.innerHTML = `
    <form id="form-post" autocomplete="off">
      <div class="field">
        <label for="p-title">عنوان ال${label}<span class="req">*</span></label>
        <input id="p-title" type="text" required maxlength="200" placeholder="عنوان مختصر وواضح"/>
      </div>
      <div class="field">
        <label for="p-body">المحتوى<span class="req">*</span></label>
        <textarea id="p-body" required maxlength="5000" placeholder="اكتب محتوى ال${label}"></textarea>
      </div>
      <div class="field">
        <label for="p-tags">الوسوم (اختياري)</label>
        <input id="p-tags" type="text" placeholder="مثال: هاكاثون، برمجة (افصل بفاصلة)"/>
        <span class="hint">ستتحول تلقائياً إلى وسوم مثل #هاكاثون</span>
      </div>
      <div class="field">
        <label for="p-url">رابط خارجي (اختياري)</label>
        <input id="p-url" type="url" maxlength="500"
               placeholder="https://forms.gle/..."
               style="direction:ltr;text-align:left"/>
        <span class="hint">يظهر للطلبة كزر — مفيد للتسجيل أو الاستبيانات</span>
      </div>
      <div class="attachment-field">
        <div class="attachment-toolbar"><button type="button" class="btn btn-ghost" id="image-choose">${RiwaqUI.icon('ImagePlus')}إرفاق صورة</button><span>PNG، JPG، WebP، GIF · ٤ م.ب</span></div>
        <input id="p-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden/>
        <div id="image-attachment" class="image-attachment" hidden></div>
        <p id="image-error" class="inline-error" role="alert"></p>
      </div>
      <div class="form-error" id="p-error" role="alert"></div>
      <div class="form-actions">
        <span class="muted">سيُنشر باسم <strong style="color:var(--ink-2)">${escape(CLUB.name)}</strong></span>
        <span class="spacer"></span>
        <button type="reset" class="tool-btn" aria-label="مسح المسودة" title="مسح المسودة">${RiwaqUI.icon('RotateCcw')}</button>
        <button type="button" class="btn btn-ghost" id="p-preview">${RiwaqUI.icon('Eye')}معاينة</button>
        <button type="submit" class="btn btn-primary" id="p-submit">${RiwaqUI.icon('Send')}نشر ال${label}</button>
      </div>
    </form>
  `;
  $("#form-post").addEventListener("submit", onSubmitPost);
  bindDraft($("#form-post"));
  $("#image-choose").addEventListener("click", () => $("#p-image").click());
  $("#p-image").addEventListener("change", choosePostImage);
  $("#p-preview").addEventListener("click", previewPost);
  renderImageAttachment();
}

function renderSocialsForm() {
  const slot = $("#form-slot");
  const platforms = [
    { key: "twitter",   label: "تويتر / X",  color: "#000000", placeholder: "@imamu_dev" },
    { key: "instagram", label: "إنستقرام",   color: "#c2185b", placeholder: "@imamu.dev" },
    { key: "snapchat",  label: "سناب شات",   color: "#fbbf24", placeholder: "imamu.dev" },
    { key: "tiktok",    label: "تيك توك",    color: "#1a1a1a", placeholder: "@imamu.dev" },
    { key: "telegram",  label: "تيليجرام",   color: "#2aabee", placeholder: "t.me/imamu_dev" }
  ];

  slot.innerHTML = `
    <form id="form-socials" autocomplete="off">
      <p class="muted" style="margin-bottom:14px">
        أدخل اسم المستخدم أو الرابط الكامل لكل منصة. اترك الحقل فارغاً لإخفاء المنصة من صفحة النادي للطلبة.
      </p>

      <div class="social-rows">
        ${platforms.map(p => {
          const val = SOCIALS[p.key] || {};
          const initial = val.handle || val.url || "";
          return `
            <div class="social-row">
              <div class="platform">
                <div class="platform-ico" style="background:${p.color}">${escape(p.label[0])}</div>
                ${escape(p.label)}
              </div>
              <input
                id="social-${p.key}"
                aria-label="${escape(p.label)}"
                type="text"
                data-platform="${p.key}"
                placeholder="${escape(p.placeholder)}"
                value="${escape(initial)}"
                style="direction:ltr;text-align:left"/>
            </div>
          `;
        }).join("")}
      </div>

      <div class="form-error" id="s-error"></div>
      <div class="form-actions">
        <span class="muted">حسابات <strong style="color:var(--ink-2)">${escape(CLUB.name)}</strong></span>
        <span class="spacer"></span>
        <button type="submit" class="btn btn-primary" id="s-submit">حفظ الحسابات</button>
      </div>
    </form>
  `;

  $("#form-socials").addEventListener("submit", onSaveSocials);
}

// ----------------------------------------------------------------
// إرسال
// ----------------------------------------------------------------
async function onSubmitPost(e) {
  e.preventDefault();
  if (publishing) return;
  const type = currentTab;
  const draft = captureDraft();
  const errEl = $("#p-error");
  const btn   = $("#p-submit");
  errEl.classList.remove("show");

  const title = $("#p-title").value.trim();
  const body  = $("#p-body").value.trim();
  const tagsRaw = $("#p-tags").value.trim();
  const url   = $("#p-url").value.trim();
  if (!title || !body) return;

  const tags = tagsRaw
    ? tagsRaw.split(/[،,]/).map(t => t.trim()).filter(Boolean)
    : [];

  try {
    setComposerBusy(true);
    btn.textContent = "جارٍ النشر…";
    if (draft.file && !draft.uploaded) draft.uploaded = await window.RiwaqAPI.upload.image(draft.file, 'post');
    await window.RiwaqAPI.posts.create({
      type,
      title, body, tags,
      externalUrl: url || null,
      image: draft.uploaded?.filename || null,
    });
    clearDraft(type);
    toast(type === "announcement" ? "تم نشر الإعلان" : "تم نشر المنشور");
    await loadAndRenderDashboard();
  } catch (err) {
    errEl.textContent = err.message || "تعذّر النشر";
    errEl.classList.add("show");
    btn.disabled = false;
    btn.textContent = type === "announcement" ? "نشر الإعلان" : "نشر المنشور";
  } finally { setComposerBusy(false); }
}

async function onSubmitEvent(e) {
  e.preventDefault();
  if (publishing) return;
  const errEl = $("#ev-error");
  const btn   = $("#ev-submit");
  errEl.classList.remove("show");

  const title = $("#ev-title").value.trim();
  const desc  = $("#ev-desc").value.trim();
  const date  = $("#ev-date").value;
  const time  = $("#ev-time").value;
  const loc   = $("#ev-loc").value.trim();
  const spots = parseInt($("#ev-spots").value, 10);
  const reg   = $("#ev-reg").value.trim();

  if (!title || !date || !time || !loc || !Number.isFinite(spots) || spots <= 0) return;

  try {
    setComposerBusy(true);
    btn.textContent = "جارٍ النشر…";
    await window.RiwaqAPI.events.create({
      title,
      description: desc || null,
      date, time, location: loc, spots,
      registrationUrl: reg || null,
    });
    toast("تم نشر الفعالية");
    clearDraft('event');
    await loadAndRenderDashboard();
  } catch (err) {
    errEl.textContent = err.message || "تعذّر النشر";
    errEl.classList.add("show");
    btn.disabled = false;
    btn.textContent = "نشر الفعالية";
  } finally { setComposerBusy(false); }
}

async function onSaveSocials(e) {
  e.preventDefault();
  if (publishing) return;
  const errEl = $("#s-error");
  const btn   = $("#s-submit");
  errEl.classList.remove("show");

  const inputs = $$("#form-socials input[data-platform]");
  const map = {};
  inputs.forEach(inp => {
    const platform = inp.dataset.platform;
    const raw = inp.value.trim();
    if (!raw) return;
    if (/^https?:\/\//i.test(raw)) {
      map[platform] = { url: raw, handle: raw };
    } else {
      map[platform] = { handle: raw, url: "" };
    }
  });

  try {
    setComposerBusy(true);
    btn.textContent = "جارٍ الحفظ…";
    SOCIALS = await window.RiwaqAPI.socials.update(map);
    toast("تم حفظ حسابات التواصل");
    clearDraft('socials');
    renderForm();
    btn.disabled = false;
    btn.textContent = "حفظ الحسابات";
  } catch (err) {
    errEl.textContent = err.message || "تعذّر الحفظ";
    errEl.classList.add("show");
    btn.disabled = false;
    btn.textContent = "حفظ الحسابات";
  } finally { setComposerBusy(false); }
}

// ----------------------------------------------------------------
// قائمة "منشوراتي"
// ----------------------------------------------------------------
function renderList() {
  const slot = $("#list-slot");

  // اعرض المنشورات (التي ليس لها فعالية مرتبطة بشكل مكرر) ثم الفعاليات
  const eventPostsMap = new Map();   // event_id -> post_id
  MY_POSTS.forEach(p => {
    if (p.type === "event" && p.linkedEventId) {
      eventPostsMap.set(p.linkedEventId, p.id);
    }
  });

  const items = [];
  MY_POSTS.forEach(p => items.push({ kind: "post", item: p }));

  // الفعاليات لا داعي لعرضها مكررة مع منشوراتها — لكن نبقيها لو لم يكن لها منشور
  MY_EVENTS.forEach(e => {
    const hasLinkedPost = [...eventPostsMap.keys()].includes(e.id);
    if (!hasLinkedPost) {
      items.push({ kind: "event", item: e });
    }
  });

  items.sort((a, b) =>
    (new Date(b.item.createdAt).getTime() || 0) - (new Date(a.item.createdAt).getTime() || 0)
  );

  if (items.length === 0) {
    slot.innerHTML = `
      <div class="empty">
        <div class="ico">✎</div>
        لم تنشر أي محتوى بعد.<br/>
        أنشئ منشورك الأول من النموذج جانباً.
      </div>
    `;
    return;
  }

  slot.innerHTML = items.map(({ kind, item }) => {
    if (kind === "event") {
      const day = (item.date || "").split("-")[2] || "";
      return `
        <div class="item">
          <div class="item-badge event">فعالية<br/>${escape(arabicDigits(day))}</div>
          <div class="item-body">
            <div class="item-title">${escape(item.title)}</div>
            <div class="item-meta">
              <span>${escape(arabicDigits(item.date))}</span>
              <span class="dot">·</span>
              <span>${escape(arabicDigits((item.time || "").slice(0,5)))}</span>
              <span class="dot">·</span>
              <span>${escape(item.location)}</span>
              <span class="dot">·</span>
              <span>${arabicDigits(item.spots)} مقعد</span>
            </div>
          </div>
          <div class="item-actions">
            <button class="item-del" title="حذف الفعالية" aria-label="حذف الفعالية" data-del-event="${escape(item.id)}">✕</button>
          </div>
        </div>
      `;
    }
    const typeLabel = item.type === "announcement" ? "إعلان"
                   : item.type === "event"        ? "فعالية"
                                                  : "منشور";
    const typeCls = item.type === "announcement" ? "announcement"
                  : item.type === "event"        ? "event"
                                                 : "post";
    return `
      <div class="item">
        <div class="item-badge ${typeCls}">${typeLabel}</div>
        <div class="item-body">
          <div class="item-title">${escape(item.title)}</div>
          <div class="item-meta">
            <span>${escape(relativeTimeAr(item.createdAt) || "الآن")}</span>
            ${item.tags && item.tags.length
              ? `<span class="dot">·</span><span>${escape(item.tags.join(" "))}</span>`
              : ""}
          </div>
        </div>
        <div class="item-actions">
          <button class="item-del" title="حذف المنشور" aria-label="حذف المنشور" data-del-post="${escape(item.id)}">✕</button>
        </div>
      </div>
    `;
  }).join("");

  $$("[data-del-post]").forEach(btn =>
    btn.addEventListener("click", () => deletePost(btn.dataset.delPost))
  );
  $$("[data-del-event]").forEach(btn =>
    btn.addEventListener("click", () => deleteEvent(btn.dataset.delEvent))
  );
}

async function deletePost(id) {
  if (!confirm("حذف هذا المنشور؟ لن يظهر للطلبة بعد ذلك.")) return;
  try {
    await window.RiwaqAPI.posts.remove(id);
    toast("تم الحذف");
    await loadAndRenderDashboard();
  } catch (err) {
    toast(err.message || "تعذّر الحذف", "danger");
  }
}

async function deleteEvent(id) {
  if (!confirm("حذف هذه الفعالية؟")) return;
  try {
    await window.RiwaqAPI.events.remove(id);
    toast("تم الحذف");
    await loadAndRenderDashboard();
  } catch (err) {
    toast(err.message || "تعذّر الحذف", "danger");
  }
}

// ----------------------------------------------------------------
// التشغيل
// ----------------------------------------------------------------
(async function init() {
  try {
    const s = await window.RiwaqAPI.session();
    if (s.authenticated && s.role === "president") {
      await loadAndRenderDashboard();
    } else {
      renderLogin();
    }
  } catch (err) {
    renderLogin();
  }
})();
