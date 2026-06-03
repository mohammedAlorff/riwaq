/* رواق — لوحة الأدمن (REST API)
 *
 * يدير:
 *   - إنشاء/تعديل/حذف الأندية بالكامل (اسم + كلية + لون + شعار + وصف + حساب رئيس)
 *   - تغيير كلمة مرور حساب رئيس
 *   - حذف حساب رئيس فقط
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

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T"));
  if (isNaN(d.getTime())) return "—";
  return arabicDigits(`${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`);
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
// حالة عامة
// ----------------------------------------------------------------
const CATEGORIES = ["تقني", "ثقافي", "شرعي", "أكاديمي", "رياضي", "إبداعي"];

let CACHE = {
  clubs: [],
  accounts: [],
  stats: { totalAccounts: 0, totalPosts: 0, totalEvents: 0 },
};

// ----------------------------------------------------------------
// شاشة دخول الأدمن
// ----------------------------------------------------------------
function renderLogin() {
  $("#root").innerHTML = `
    <div class="login-shell">
      <div class="login-card">
        <div class="login-brand">
          <div class="brand-mark">ر</div>
          <div class="brand-text">
            <div class="brand-name">رواق</div>
            <div class="brand-sub">جامعة الإمام محمد بن سعود الإسلامية</div>
          </div>
          <span class="brand-pill admin-badge" style="margin-inline-start:auto">لوحة الأدمن</span>
        </div>

        <div class="login-title">تسجيل دخول الأدمن</div>
        <div class="login-sub">
          ادخل بحساب الأدمن لإدارة الأندية وحسابات الرؤساء.
        </div>

        <form id="login-form" autocomplete="off">
          <div class="field">
            <label for="username">اسم المستخدم<span class="req">*</span></label>
            <input id="username" type="text" required autocomplete="off"
                   placeholder="admin"
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
          منصة الطلبة في
          <a href="../رواق.html" style="color:var(--brand);font-weight:700">رواق</a>
          · لوحة الرؤساء في
          <a href="../presidents/" style="color:var(--brand);font-weight:700">presidents</a>
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
      if (result.role !== "admin") {
        await window.RiwaqAPI.logout().catch(()=>{});
        toast("هذا الحساب ليس حساب أدمن", "danger");
        btn.disabled = false;
        btn.textContent = "تسجيل الدخول";
        return;
      }
      await renderDashboard();
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
// لوحة الأدمن
// ----------------------------------------------------------------
async function renderDashboard() {
  $("#root").innerHTML = `
    <div class="login-shell"><div class="login-card" style="text-align:center">
      <div class="spinner" style="margin:20px auto"></div>
      <div style="color:var(--ink-3);font-size:13px">جاري تحميل البيانات…</div>
    </div></div>
  `;

  try {
    const [clubs, accountsResp] = await Promise.all([
      window.RiwaqAPI.clubs.list(),
      window.RiwaqAPI.accounts.list(),
    ]);
    CACHE.clubs    = clubs;
    CACHE.accounts = accountsResp.accounts || [];
    CACHE.stats    = accountsResp.stats || { totalAccounts: 0, totalPosts: 0, totalEvents: 0 };
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      return renderLogin();
    }
    $("#root").innerHTML = `
      <div class="login-shell"><div class="login-card">
        <h2 style="color:var(--danger);margin-bottom:10px">تعذّر تحميل البيانات</h2>
        <p>${escape(err.message || "")}</p>
        <button class="btn btn-primary" id="retry">إعادة المحاولة</button>
      </div></div>
    `;
    $("#retry").addEventListener("click", renderDashboard);
    return;
  }

  $("#root").innerHTML = `
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">ر</div>
        <div class="brand-text">
          <div class="brand-name">رواق</div>
          <div class="brand-sub">لوحة الأدمن</div>
        </div>
      </div>
      <div class="topbar-spacer"></div>

      <span class="admin-badge">الأدمن</span>
      <a class="btn-link" href="../رواق.html" target="_blank" rel="noopener">معاينة منصة الطلبة ↗</a>
      <a class="btn-link" href="../presidents/" target="_blank" rel="noopener">لوحة الرؤساء ↗</a>
      <button class="btn-link" id="logout">تسجيل الخروج</button>
    </header>

    <main class="page">
      <div class="page-head">
        <div>
          <h1>إدارة الأندية</h1>
          <div class="sub">
            أنشئ نوادي جديدة (مع شعار وحساب الرئيس)، أو عدِّل القائمة الحالية.
          </div>
        </div>
        <div class="page-head-actions">
          <button class="btn btn-primary" id="new-club-btn">+ إنشاء نادٍ جديد</button>
        </div>
      </div>

      <div class="stats">
        <div class="stat">
          <div class="stat-label">عدد الأندية</div>
          <div class="stat-value">${arabicDigits(CACHE.clubs.length)}</div>
          <div class="stat-hint">في قاعدة البيانات</div>
        </div>
        <div class="stat">
          <div class="stat-label">حسابات الرؤساء</div>
          <div class="stat-value">${arabicDigits(CACHE.stats.totalAccounts)}</div>
          <div class="stat-hint">من ${arabicDigits(CACHE.clubs.length)} نادٍ</div>
        </div>
        <div class="stat">
          <div class="stat-label">إجمالي المنشورات</div>
          <div class="stat-value">${arabicDigits(CACHE.stats.totalPosts)}</div>
          <div class="stat-hint">من جميع الأندية</div>
        </div>
        <div class="stat">
          <div class="stat-label">إجمالي الفعاليات</div>
          <div class="stat-value">${arabicDigits(CACHE.stats.totalEvents)}</div>
          <div class="stat-hint">معلنة في الموقع</div>
        </div>
      </div>

      <section class="card">
        <div class="card-head">
          <h2>الأندية الحالية</h2>
          <span class="sub">${arabicDigits(CACHE.clubs.length)} نادٍ</span>
        </div>
        <div id="clubs-slot"></div>
      </section>
    </main>
  `;

  $("#logout").addEventListener("click", async () => {
    try { await window.RiwaqAPI.logout(); } catch (e) {}
    renderLogin();
  });

  $("#new-club-btn").addEventListener("click", openCreateClubModal);

  renderClubsTable();
}

// ----------------------------------------------------------------
// جدول الأندية
// ----------------------------------------------------------------
function renderClubsTable() {
  const slot = $("#clubs-slot");
  if (CACHE.clubs.length === 0) {
    slot.innerHTML = `
      <div class="empty">
        <div class="ico">★</div>
        لا توجد أندية بعد. أنشئ أول نادٍ من الأعلى.
      </div>
    `;
    return;
  }

  const accByClub = {};
  CACHE.accounts.forEach(a => { accByClub[a.clubId] = a; });

  const sorted = CACHE.clubs.slice().sort((a, b) => a.name.localeCompare(b.name, "ar"));

  slot.innerHTML = `
    <div class="accounts-table-wrap">
      <table class="accounts-table">
        <thead>
          <tr>
            <th>النادي</th>
            <th>التصنيف</th>
            <th>الكلية</th>
            <th>اسم المستخدم</th>
            <th style="text-align:left">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map(c => {
            const acc = accByClub[c.id];
            const iconCell = c.image
              ? `<div class="acc-club-icon" style="background:#fff;padding:0;overflow:hidden"><img src="${escape(c.image)}" alt="" style="width:100%;height:100%;object-fit:cover"/></div>`
              : `<div class="acc-club-icon" style="background:${c.color}">${escape(c.icon)}</div>`;
            return `
              <tr>
                <td>
                  <div class="acc-club">
                    ${iconCell}
                    <div>
                      <div class="acc-club-name">${escape(c.name)}</div>
                      <div class="acc-club-meta">${escape(c.id)}</div>
                    </div>
                  </div>
                </td>
                <td><span class="club-cat-chip">${escape(c.cat)}</span></td>
                <td style="font-size:13px;color:var(--ink-2)">${escape(c.college)}</td>
                <td>
                  ${acc
                    ? `<span class="acc-username">${escape(acc.username)}</span>`
                    : `<span style="color:var(--ink-4);font-size:12px">— بلا حساب —</span>`}
                </td>
                <td>
                  <div class="acc-actions">
                    <button class="btn btn-ghost btn-sm" data-edit-club="${escape(c.id)}">تعديل</button>
                    ${acc
                      ? `<button class="btn btn-ghost btn-sm" data-edit-pwd="${escape(acc.username)}">كلمة المرور</button>`
                      : ""}
                    <button class="btn btn-danger btn-sm" data-del-club="${escape(c.id)}">حذف</button>
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  $$("[data-edit-club]").forEach(btn =>
    btn.addEventListener("click", () => openEditClubModal(btn.dataset.editClub))
  );
  $$("[data-edit-pwd]").forEach(btn =>
    btn.addEventListener("click", () => openChangePasswordModal(btn.dataset.editPwd))
  );
  $$("[data-del-club]").forEach(btn =>
    btn.addEventListener("click", () => onDeleteClub(btn.dataset.delClub))
  );
}

// ================================================================
// مودال: إنشاء نادٍ + حساب
// ================================================================
function openCreateClubModal() {
  openClubModal({ mode: "create" });
}

function openEditClubModal(clubId) {
  const club = CACHE.clubs.find(c => c.id === clubId);
  if (!club) return;
  openClubModal({ mode: "edit", club });
}

function openClubModal({ mode, club }) {
  const isEdit = mode === "edit";
  const c = club || {
    id: "", name: "", cat: "تقني", college: "",
    color: "#2d5a3d", icon: "", image: null, desc: ""
  };

  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `
    <div class="modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-head">
        <h2 id="modal-title">${isEdit ? "تعديل نادٍ" : "إنشاء نادٍ جديد"}</h2>
        <div class="sub">${isEdit ? `${escape(c.name)} · ${escape(c.id)}` : "أدخل بيانات النادي وحساب الرئيس"}</div>
      </div>

      <form class="modal-body club-form" id="club-form" autocomplete="off">
        <div class="club-form-row">
          <div class="club-form-icon-section">
            <label>شعار النادي</label>
            <div class="club-form-preview" id="club-preview" style="background:${c.color}">
              ${c.image
                ? `<img src="${escape(c.image)}" alt="" id="preview-img"/>`
                : `<span id="preview-icon">${escape(c.icon || "؟")}</span>`}
            </div>
            <div class="club-form-icon-controls">
              <label class="btn btn-ghost btn-sm" style="cursor:pointer">
                رفع صورة
                <input type="file" id="club-image" accept="image/*" hidden/>
              </label>
              ${c.image
                ? `<button type="button" class="btn-link btn-sm" id="clear-image" style="color:var(--danger)">إزالة الصورة</button>`
                : ""}
            </div>
            <input type="hidden" id="club-image-url" value="${escape(c.image || "")}"/>
            <div class="field" style="margin-top:12px">
              <label for="club-icon">أيقونة نصية (افتراضية)</label>
              <input id="club-icon" type="text" maxlength="8" value="${escape(c.icon)}"
                     placeholder="ر / ق / </>"
                     style="text-align:center;font-size:16px;font-weight:700"/>
              <span class="hint">تظهر فقط لو لم تُرفع صورة</span>
            </div>
          </div>

          <div class="club-form-fields">
            <div class="field">
              <label for="club-name">اسم النادي<span class="req">*</span></label>
              <input id="club-name" type="text" required maxlength="120"
                     value="${escape(c.name)}"
                     placeholder="مثال: نادي البرمجة"/>
            </div>

            <div class="field-row">
              <div class="field">
                <label for="club-cat">التصنيف<span class="req">*</span></label>
                <select id="club-cat" required>
                  ${CATEGORIES.map(cat => `
                    <option value="${escape(cat)}" ${cat === c.cat ? "selected" : ""}>${escape(cat)}</option>
                  `).join("")}
                </select>
              </div>
              <div class="field">
                <label for="club-college">الكلية<span class="req">*</span></label>
                <input id="club-college" type="text" required maxlength="120"
                       value="${escape(c.college)}"
                       placeholder="علوم الحاسب"/>
              </div>
            </div>

            <div class="field">
              <label for="club-color">لون النادي<span class="req">*</span></label>
              <div style="display:flex;gap:10px;align-items:center">
                <input id="club-color" type="color" value="${escape(c.color || "#2d5a3d")}"
                       style="width:60px;height:42px;padding:2px;cursor:pointer"/>
                <span style="font-size:12.5px;color:var(--ink-3)">يُستخدم لخلفية بطاقة النادي ولمسات بصرية</span>
              </div>
            </div>

            <div class="field">
              <label for="club-desc">وصف النادي<span class="req">*</span></label>
              <textarea id="club-desc" required maxlength="500"
                        placeholder="نبذة قصيرة عن النادي ونشاطاته…">${escape(c.desc)}</textarea>
            </div>

            ${!isEdit ? `
              <hr class="sep"/>
              <h3 style="font-size:14px;font-weight:700;margin-bottom:10px;color:var(--brand-deep)">حساب رئيس النادي</h3>
              <div class="field-row">
                <div class="field">
                  <label for="club-username">اسم المستخدم<span class="req">*</span></label>
                  <input id="club-username" type="text" required
                         pattern="[A-Za-z0-9_\\-]{3,24}"
                         placeholder="مثال: programming_lead"
                         style="direction:ltr;text-align:left"/>
                  <span class="hint">٣ إلى ٢٤ خانة · حروف لاتينية وأرقام و _ -</span>
                </div>
                <div class="field">
                  <label for="club-password">كلمة المرور<span class="req">*</span></label>
                  <div class="pwd-wrap">
                    <input id="club-password" type="password" required minlength="8" maxlength="128"
                           placeholder="٨ خانات على الأقل"
                           style="direction:ltr;text-align:left"/>
                    <button type="button" class="pwd-toggle" data-toggle="club-password">إظهار</button>
                  </div>
                </div>
              </div>
            ` : ""}
          </div>
        </div>

        <div class="form-error" id="club-error"></div>
      </form>

      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" id="club-cancel">إلغاء</button>
        <button type="button" class="btn btn-primary" id="club-save">
          ${isEdit ? "حفظ التعديلات" : "إنشاء النادي + الحساب"}
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(back);

  const close = () => back.remove();
  back.addEventListener("click", (e) => { if (e.target === back) close(); });
  $("#club-cancel", back).addEventListener("click", close);
  $$("[data-toggle]", back).forEach(b => b.addEventListener("click", togglePassword));

  const onKey = (e) => { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); } };
  document.addEventListener("keydown", onKey);

  // معاينة اللون
  $("#club-color", back).addEventListener("input", (e) => {
    const preview = $("#club-preview", back);
    if (!$("#preview-img", back)) preview.style.background = e.target.value;
  });

  // معاينة الأيقونة
  $("#club-icon", back).addEventListener("input", (e) => {
    const previewIcon = $("#preview-icon", back);
    if (previewIcon) previewIcon.textContent = e.target.value || "؟";
  });

  // رفع الصورة
  $("#club-image", back).addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const errEl = $("#club-error", back);
    errEl.classList.remove("show");
    try {
      const result = await window.RiwaqAPI.upload.image(file, "club");
      $("#club-image-url", back).value = result.url;
      const preview = $("#club-preview", back);
      preview.style.background = "#fff";
      preview.innerHTML = `<img src="${escape(result.url)}" alt="" id="preview-img"/>`;
      toast("تم رفع الصورة");
    } catch (err) {
      errEl.textContent = "تعذّر رفع الصورة: " + (err.message || "");
      errEl.classList.add("show");
    }
  });

  // إزالة الصورة (في وضع التعديل)
  const clearBtn = $("#clear-image", back);
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      $("#club-image-url", back).value = "";
      const preview = $("#club-preview", back);
      const color = $("#club-color", back).value;
      const iconVal = $("#club-icon", back).value || c.icon || "؟";
      preview.style.background = color;
      preview.innerHTML = `<span id="preview-icon">${escape(iconVal)}</span>`;
      clearBtn.remove();
    });
  }

  // الحفظ
  $("#club-save", back).addEventListener("click", async () => {
    const errEl = $("#club-error", back);
    const btn   = $("#club-save", back);
    errEl.classList.remove("show");

    const payload = {
      name:    $("#club-name", back).value.trim(),
      cat:     $("#club-cat", back).value,
      college: $("#club-college", back).value.trim(),
      color:   $("#club-color", back).value,
      icon:    $("#club-icon", back).value.trim(),
      image:   $("#club-image-url", back).value.trim() || null,
      desc:    $("#club-desc", back).value.trim(),
    };

    if (!isEdit) {
      payload.username = $("#club-username", back).value.trim();
      payload.password = $("#club-password", back).value;
    }

    try {
      btn.disabled = true;
      btn.textContent = isEdit ? "جارٍ الحفظ…" : "جارٍ الإنشاء…";
      if (isEdit) {
        await window.RiwaqAPI.clubs.update(c.id, payload);
        toast("تم حفظ التعديلات");
      } else {
        await window.RiwaqAPI.clubs.create(payload);
        toast("تم إنشاء النادي وحساب الرئيس");
      }
      close();
      document.removeEventListener("keydown", onKey);
      await renderDashboard();
    } catch (err) {
      errEl.textContent = err.message || "تعذّر الحفظ";
      errEl.classList.add("show");
      btn.disabled = false;
      btn.textContent = isEdit ? "حفظ التعديلات" : "إنشاء النادي + الحساب";
    }
  });

  setTimeout(() => $("#club-name", back).focus(), 30);
}

// ================================================================
// حذف نادٍ
// ================================================================
async function onDeleteClub(clubId) {
  const club = CACHE.clubs.find(c => c.id === clubId);
  if (!club) return;
  const ok = confirm(
    `حذف نادي "${club.name}" بالكامل؟\n\n` +
    `سيُحذف معه:\n` +
    `• حساب الرئيس\n` +
    `• كل المنشورات والإعلانات\n` +
    `• كل الفعاليات\n` +
    `• كل حسابات السوشال\n\n` +
    `هذا الإجراء لا يمكن التراجع عنه.`
  );
  if (!ok) return;
  try {
    await window.RiwaqAPI.clubs.remove(clubId);
    toast("تم حذف النادي");
    await renderDashboard();
  } catch (err) {
    toast(err.message || "تعذّر الحذف", "danger");
  }
}

// ================================================================
// تغيير كلمة المرور
// ================================================================
function togglePassword(e) {
  const targetId = e.currentTarget.dataset.toggle;
  const input = document.getElementById(targetId);
  if (!input) return;
  const showing = input.type === "text";
  input.type = showing ? "password" : "text";
  e.currentTarget.textContent = showing ? "إظهار" : "إخفاء";
}

function openChangePasswordModal(username) {
  const acc = CACHE.accounts.find(a => a.username === username);
  if (!acc) return;
  const club = CACHE.clubs.find(c => c.id === acc.clubId);
  const clubName = club ? club.name : "نادٍ محذوف";

  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-head">
        <h2 id="modal-title">تغيير كلمة مرور</h2>
        <div class="sub">${escape(clubName)} · ${escape(username)}</div>
      </div>
      <form class="modal-body" autocomplete="off">
        <div class="field">
          <label for="new-pwd">كلمة المرور الجديدة<span class="req">*</span></label>
          <div class="pwd-wrap">
            <input id="new-pwd" type="password" required
                   minlength="8" maxlength="128"
                   placeholder="٨ خانات على الأقل"
                   autocomplete="off"
                   style="direction:ltr;text-align:left"/>
            <button type="button" class="pwd-toggle" data-toggle="new-pwd">إظهار</button>
          </div>
          <span class="hint">سيتم تشفيرها (bcrypt) وإلغاء جلسات الرئيس النشطة.</span>
        </div>
        <div class="form-error" id="pwd-error"></div>
      </form>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" id="pwd-cancel">إلغاء</button>
        <button type="button" class="btn btn-primary" id="pwd-save">حفظ</button>
      </div>
    </div>
  `;
  document.body.appendChild(back);

  const close = () => back.remove();
  back.addEventListener("click", (e) => { if (e.target === back) close(); });
  $("#pwd-cancel", back).addEventListener("click", close);
  $$("[data-toggle]", back).forEach(b => b.addEventListener("click", togglePassword));

  const onKey = (e) => { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); } };
  document.addEventListener("keydown", onKey);

  $("#pwd-save", back).addEventListener("click", async () => {
    const errEl = $("#pwd-error", back);
    const newPwd = $("#new-pwd", back).value;
    errEl.classList.remove("show");
    try {
      await window.RiwaqAPI.accounts.updatePassword(username, newPwd);
      close();
      document.removeEventListener("keydown", onKey);
      toast("تم تحديث كلمة المرور");
      await renderDashboard();
    } catch (err) {
      errEl.textContent = err.message || "تعذّر التحديث";
      errEl.classList.add("show");
    }
  });

  setTimeout(() => $("#new-pwd", back).focus(), 30);
}

// ----------------------------------------------------------------
// التشغيل
// ----------------------------------------------------------------
(async function init() {
  try {
    const s = await window.RiwaqAPI.session();
    if (s.authenticated && s.role === "admin") {
      await renderDashboard();
    } else {
      renderLogin();
    }
  } catch (err) {
    renderLogin();
  }
})();
