/* رواق — عميل REST API مشترك (مع وضع تجريبي تلقائي)
 *
 * إذا فشل أي طلب قراءة (GET) والـ window.RIWAQ_DEMO موجود،
 * يتحول العميل تلقائياً إلى وضع تجريبي ويُرجع بيانات نموذجية.
 *
 *   RiwaqAPI.isDemo       → true لو يعمل من بيانات Demo
 *   RiwaqAPI.demoReason   → سبب الانتقال (network / configuration_missing / ...)
 *
 *   RiwaqAPI.session(), login(), logout()
 *   RiwaqAPI.clubs.list() / get(id)
 *   RiwaqAPI.posts.list({ type?, clubId? }) / create() / remove(id)
 *   RiwaqAPI.events.list({ clubId? }) / create() / remove(id)
 *   RiwaqAPI.socials.get(clubId) / update(map)
 *   RiwaqAPI.accounts.list() / create() / updatePassword() / remove()
 *   RiwaqAPI.upload.image(file)
 */
(function () {
  "use strict";

  const here = window.location.pathname;
  const inSub = /\/(presidents|admin)\//.test(here);
  const API_BASE = inSub ? "../api" : "api";

  class ApiError extends Error {
    constructor(code, message, status, extra) {
      super(message || code);
      this.code = code;
      this.status = status;
      Object.assign(this, extra || {});
    }
  }

  function readCsrfToken() {
    const m = document.cookie.match(/(?:^|;\s*)riwaq_csrf=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }

  function isReadMethod(method) {
    return !method || method === "GET" || method === "HEAD";
  }

  // ----------------------------------------------------------------
  // الطلب الفعلي
  // ----------------------------------------------------------------
  async function realRequest(path, options) {
    const opts = Object.assign({
      method: "GET",
      credentials: "include",
      headers: {}
    }, options);
    opts.method = opts.method.toUpperCase();

    if (!isReadMethod(opts.method)) {
      const csrf = readCsrfToken();
      if (csrf) opts.headers["X-CSRF-Token"] = csrf;
    }

    if (opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData)) {
      opts.headers["Content-Type"] = "application/json; charset=utf-8";
      opts.body = JSON.stringify(opts.body);
    }

    let res;
    try {
      res = await fetch(`${API_BASE}/${path}`, opts);
    } catch (e) {
      throw new ApiError("network", "تعذّر الاتصال بالخادم.", 0);
    }

    let data;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try { data = await res.json(); }
      catch (e) {
        throw new ApiError("invalid_response", "استجابة غير صالحة من الخادم.", res.status);
      }
    } else {
      // ليست JSON — على الأرجح PHP لم يُترجم (file://) أو خطأ غير متوقع
      throw new ApiError(
        "not_json",
        "الخادم لم يُرجع JSON — تأكد أن PHP يعمل.",
        res.status
      );
    }

    if (!res.ok || data.ok === false) {
      throw new ApiError(
        data.error || "http_" + res.status,
        data.message || `خطأ ${res.status}`,
        res.status,
        data
      );
    }

    return data.data !== undefined ? data.data : data;
  }

  // ----------------------------------------------------------------
  // الطلب مع fallback تجريبي
  // ----------------------------------------------------------------
  async function request(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();

    // لو سبق وعرفنا أننا في وضع Demo، لا داعي للمحاولة الفعلية
    if (window.RiwaqAPI.isDemo && window.RIWAQ_DEMO) {
      if (isReadMethod(method)) {
        return resolveFromDemo(path);
      }
      throw new ApiError(
        "demo_readonly",
        "لا يمكن تعديل البيانات في الوضع التجريبي — شغّل الخادم لتفعيل العمليات.",
        503
      );
    }

    try {
      return await realRequest(path, options);
    } catch (err) {
      // إذا كان طلب قراءة، وفي بيانات Demo، تحوّل للوضع التجريبي
      if (isReadMethod(method) && window.RIWAQ_DEMO) {
        if (!window.RiwaqAPI.isDemo) {
          window.RiwaqAPI.isDemo = true;
          window.RiwaqAPI.demoReason = err.code || "network";
          window.RiwaqAPI.demoMessage = err.message || "";
          // أعلِم المستمعين أن الوضع تغيّر
          try {
            window.dispatchEvent(new CustomEvent("riwaq:demo-mode", {
              detail: { reason: err.code, message: err.message }
            }));
          } catch (e) {}
        }
        return resolveFromDemo(path);
      }
      throw err;
    }
  }

  // ----------------------------------------------------------------
  // ترجمة مسار الطلب إلى بيانات تجريبية
  // ----------------------------------------------------------------
  function parseQuery(path) {
    const i = path.indexOf("?");
    if (i < 0) return {};
    const params = new URLSearchParams(path.slice(i + 1));
    const obj = {};
    params.forEach((v, k) => obj[k] = v);
    return obj;
  }

  function resolveFromDemo(path) {
    const DEMO = window.RIWAQ_DEMO;
    const q = parseQuery(path);

    if (path.startsWith("session.php")) {
      return { authenticated: false };
    }

    if (path.startsWith("clubs.php")) {
      if (q.id) {
        const c = DEMO.clubs.find(x => x.id === q.id);
        return c || null;
      }
      return DEMO.clubs;
    }

    if (path.startsWith("posts.php")) {
      let list = DEMO.posts.slice();
      if (q.type)   list = list.filter(p => p.type === q.type);
      if (q.clubId) list = list.filter(p => p.clubId === q.clubId);
      return list;
    }

    if (path.startsWith("events.php")) {
      let list = DEMO.events.slice();
      if (q.clubId) list = list.filter(e => e.clubId === q.clubId);
      return list;
    }

    if (path.startsWith("socials.php")) {
      if (q.clubId) {
        const c = DEMO.clubs.find(x => x.id === q.clubId);
        return (c && c.socials) || {};
      }
      return {};
    }

    if (path.startsWith("accounts.php")) {
      // للأدمن — لا توجد حسابات حقيقية في وضع Demo
      return { accounts: [], stats: {
        totalAccounts: 0,
        totalPosts:    DEMO.posts.length,
        totalEvents:   DEMO.events.length,
      } };
    }

    // مسار غير معروف — رجّع كائن فارغ بدلاً من رمي خطأ
    return null;
  }

  // ----------------------------------------------------------------
  // الجلسة والمصادقة
  // ----------------------------------------------------------------
  async function session() {
    return await request("session.php");
  }

  async function login(username, password) {
    // login هي عملية كتابة — في وضع Demo، ترمي خطأ واضحًا
    return await request("login.php", {
      method: "POST",
      body: { username, password },
    });
  }

  async function logout() {
    if (window.RiwaqAPI.isDemo) return { ok: true };
    return await request("logout.php", { method: "POST" });
  }

  // ---------------- الأندية ----------------
  const clubs = {
    list: () => request("clubs.php"),
    get:  (id) => request(`clubs.php?id=${encodeURIComponent(id)}`),
    create(payload) {
      return request("clubs.php", { method: "POST", body: payload });
    },
    update(id, payload) {
      return request(`clubs.php?id=${encodeURIComponent(id)}`, { method: "PUT", body: payload });
    },
    remove(id) {
      return request(`clubs.php?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };

  // ---------------- المنشورات ----------------
  const posts = {
    list({ type, clubId } = {}) {
      const params = new URLSearchParams();
      if (type)   params.set("type", type);
      if (clubId) params.set("clubId", clubId);
      const qs = params.toString();
      return request("posts.php" + (qs ? "?" + qs : ""));
    },
    create(payload) {
      return request("posts.php", { method: "POST", body: payload });
    },
    remove(id) {
      return request(`posts.php?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };

  // ---------------- الفعاليات ----------------
  const events = {
    list({ clubId } = {}) {
      return request("events.php" + (clubId ? `?clubId=${encodeURIComponent(clubId)}` : ""));
    },
    create(payload) {
      return request("events.php", { method: "POST", body: payload });
    },
    remove(id) {
      return request(`events.php?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };

  // ---------------- السوشال ----------------
  const socials = {
    get(clubId) {
      return request(`socials.php?clubId=${encodeURIComponent(clubId)}`);
    },
    update(socialsMap) {
      return request("socials.php", { method: "PUT", body: { socials: socialsMap } });
    },
  };

  // ---------------- الحسابات (للأدمن) ----------------
  const accounts = {
    list: () => request("accounts.php"),
    create({ username, clubId, password }) {
      return request("accounts.php", { method: "POST", body: { username, clubId, password } });
    },
    updatePassword(username, password) {
      return request(`accounts.php?username=${encodeURIComponent(username)}`, {
        method: "PUT", body: { password }
      });
    },
    remove(username) {
      return request(`accounts.php?username=${encodeURIComponent(username)}`, { method: "DELETE" });
    },
  };

  // ---------------- رفع الصور ----------------
  const upload = {
    image(file, purpose) {
      const fd = new FormData();
      fd.append("file", file);
      if (purpose) fd.append("purpose", purpose);
      return request("upload.php", { method: "POST", body: fd });
    },
  };

  window.RiwaqAPI = {
    session, login, logout,
    clubs, posts, events, socials, accounts, upload,
    ApiError, API_BASE,
    isDemo: false,
    demoReason: null,
    demoMessage: null,
  };
})();
