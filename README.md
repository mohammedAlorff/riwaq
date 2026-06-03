# رواق — منصة أندية جامعة الإمام محمد بن سعود

منصة متكاملة بـ **PHP + MySQL** و**React** للواجهة الطلابية. ثلاث مواقع منفصلة + REST API.

---

## ⚡ معاينة فورية (بدون أي إعداد)

افتح `رواق.html` مباشرة في المتصفح (دبل كليك) — ستظهر المنصة الطلابية فوراً مع بيانات نموذجية وشريط برتقالي يوضح أنك في **"وضع تجريبي"**.

كل الميزات تعمل (بحث، فلاتر، صفحات الأندية، الفعاليات) لكن المحتوى ساكن ولا يمكن النشر.

> 🔵 لتفعيل المنصة الكاملة (حسابات حقيقية + نشر فعلي) — اتبع قسم [التركيب](#-التركيب-محلياً-أو-على-خادم) أدناه.

### تشغيل خادم محلي سريع (إذا كان PHP مثبتاً)

**Windows:** دبل كليك على `start-dev.bat`
**Mac / Linux:** `chmod +x start-dev.sh && ./start-dev.sh`

أو يدوياً:
```bash
php -S localhost:8000
```
ثم افتح: `http://localhost:8000/رواق.html`

---

```
riwaq/
├── api/                       ← PHP REST API
│   ├── .htaccess
│   ├── config.example.php     ← انسخه إلى config.php وعدّل القيم
│   ├── db.php                 ← اتصال PDO
│   ├── helpers.php            ← مرافق JSON + CORS
│   ├── auth_helpers.php       ← جلسات + CSRF + bcrypt + rate limit
│   ├── login.php              ← POST تسجيل الدخول
│   ├── logout.php             ← POST تسجيل الخروج
│   ├── session.php            ← GET الجلسة الحالية
│   ├── clubs.php              ← GET الأندية
│   ├── posts.php              ← GET/POST/DELETE المنشورات
│   ├── events.php             ← GET/POST/DELETE الفعاليات
│   ├── socials.php            ← GET/PUT حسابات السوشال
│   ├── accounts.php           ← (أدمن) GET/POST/PUT/DELETE حسابات الرؤساء
│   ├── upload.php             ← (رئيس) POST رفع صور المنشورات
│   ├── schema.sql             ← مخطط قاعدة البيانات
│   ├── seed.sql               ← ٨ أندية + بيانات افتراضية
│   └── setup.php              ← يُشغَّل مرة واحدة للتركيب
│
├── uploads/                   ← صور المنشورات المرفوعة
│   └── .htaccess              ← يمنع تنفيذ السكربتات
│
├── رواق.html                  ← (١) موقع الطلبة (قراءة فقط)
├── styles.css
├── api-client.js              ← مرافق fetch مشترك
├── app.jsx / components.jsx / screens.jsx
│
├── presidents/                ← (٢) لوحة رئيس النادي
│   ├── index.html
│   ├── presidents.js
│   └── presidents.css
│
└── admin/                     ← (٣) لوحة الأدمن
    ├── index.html
    ├── admin.js
    └── admin.css
```

---

## 🚀 التركيب (محلياً أو على خادم)

### ١. متطلبات الخادم
- **PHP 8.0+** مع امتدادات: `pdo_mysql`, `mbstring`, `fileinfo`, `json`, `openssl`.
- **MySQL 5.7+** أو **MariaDB 10.3+**.
- **Apache** مع `mod_rewrite` (للـ `.htaccess`) أو Nginx مع إعدادات مكافئة.

### ٢. إنشاء قاعدة البيانات
على خادمك (cPanel / phpMyAdmin / CLI):
```sql
CREATE DATABASE riwaq CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'riwaq_user'@'localhost' IDENTIFIED BY 'كلمة-مرور-قوية';
GRANT ALL PRIVILEGES ON riwaq.* TO 'riwaq_user'@'localhost';
FLUSH PRIVILEGES;
```

### ٣. ضبط الإعدادات
```bash
cd api/
cp config.example.php config.php
```
ثم عدّل `config.php`:
- `db.host`, `db.name`, `db.user`, `db.password` ← قيمك الفعلية.
- `cors_origin` ← اتركها `""` لو الـ frontend على نفس النطاق.
- `debug` ← `false` في الإنتاج.

### ٤. تركيب الجداول والبيانات
افتح في المتصفح:
```
http://your-site.com/api/setup.php
```
سيُنشئ:
- ٩ جداول (clubs, users, sessions, events, posts, socials, audit_log, rate_limits, login_attempts).
- ٨ أندية افتراضية + منشورات وفعاليات وسوشال.
- حساب الأدمن: `admin` / `admin1234`.
- ٨ حسابات للرؤساء: `club_c1`…`club_c8` / كلمة المرور: `riwaq2026`.

**⚠️ مهم جدًا:**
- **احذف `api/setup.php` من الخادم** بعد التركيب الناجح.
- **غيِّر كلمات المرور الافتراضية** من لوحة الأدمن.

### ٥. صلاحيات المجلدات
```bash
chmod 755 uploads/
chown www-data:www-data uploads/   # أو المستخدم الذي يُشغِّل PHP
```

### ٦. افتح الموقع
- **الطلبة:** `http://your-site.com/رواق.html`
- **الرؤساء:** `http://your-site.com/presidents/`
- **الأدمن:** `http://your-site.com/admin/`

---

## 🔐 الحسابات الافتراضية (غيِّرها فورًا!)

| المنصة | اسم المستخدم | كلمة المرور | الدور |
|--------|--------------|--------------|------|
| **الأدمن** | `admin` | `admin1234` | يدير حسابات الأندية |
| **رئيس نادي ١** | `club_c1` | `riwaq2026` | نادي البرمجة |
| **رئيس نادي ٢** | `club_c2` | `riwaq2026` | النادي الثقافي |
| … | `club_c3` … `club_c8` | `riwaq2026` | باقي الأندية |
| **الطلبة** | — | — | لا تسجيل دخول |

### تغيير كلمة مرور الأدمن

من سطر الأوامر:
```bash
php -r "echo password_hash('NEW_PASSWORD', PASSWORD_BCRYPT, ['cost' => 12]);"
```
ثم نفّذ:
```sql
UPDATE users SET password_hash = 'HASH_HERE' WHERE username = 'admin';
```

أو احذف الأدمن الحالي وأنشئ غيره مباشرة في قاعدة البيانات.

---

## 🏛️ هندسة النظام

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  المتصفّح   │      │     PHP     │      │   MySQL     │
│  (الطلبة /  │ ───→ │   /api/*    │ ───→ │             │
│  الرؤساء /  │ ←─── │             │ ←─── │             │
│   الأدمن)   │      │             │      │             │
└─────────────┘      └─────────────┘      └─────────────┘
   cookies:                          tables:
   - riwaq_session (httpOnly)         users, sessions, clubs,
   - riwaq_csrf   (JS-readable)       posts, events, socials,
                                      audit_log, rate_limits,
                                      login_attempts
```

### تدفّق المصادقة
1. **POST** `/api/login.php` `{ username, password }` →
   يُتحقق بـ `password_verify` (bcrypt).
2. عند النجاح: ينشئ سجل في `sessions` ويرسل cookie `riwaq_session` (httpOnly).
3. يرسل كذلك cookie `riwaq_csrf` (قابل للقراءة من JS) — يُعاد إرساله في `X-CSRF-Token` لكل طلب يغيّر بيانات.
4. كل endpoint يكتب يتحقق من:
   - وجود الجلسة (`riwaq_current_user`).
   - الدور الصحيح (`riwaq_require_user("president")` …).
   - الـ CSRF token (`riwaq_require_csrf`).
   - معدّل الطلبات (`riwaq_rate_limit`).

### الأمن المضمَّن
- ✅ كلمات المرور مشفّرة بـ **bcrypt** (cost=12) — مقاومة لـ rainbow tables.
- ✅ **Prepared statements** في كل استعلام SQL — حماية كاملة من SQL injection.
- ✅ **CSRF double-submit token**.
- ✅ Cookies بـ `HttpOnly`, `SameSite=Lax`, `Secure` (على HTTPS).
- ✅ **Rate limiting** لكل من:
  - تسجيل الدخول (١٠ محاولات/IP/١٥ دقيقة).
  - الكتابة (٦٠/مستخدم/دقيقة).
  - القراءة (٣٠٠/IP/دقيقة).
- ✅ تأخير تصاعدي عند فشل تسجيل الدخول.
- ✅ **سجل تدقيق كامل** (`audit_log`) لكل عملية.
- ✅ التحقق من نوع MIME الحقيقي للصور المرفوعة (لا الاعتماد على الامتداد).
- ✅ مجلد `uploads/` يمنع تنفيذ السكربتات (`.htaccess`).
- ✅ ملفات الإعدادات والمساعدة محمية من الوصول المباشر.

---

## 🛠️ نقاط النهاية (API Endpoints)

| المسار | الطريقة | الصلاحية | الوصف |
|--------|----------|----------|-------|
| `login.php` | POST | عام | تسجيل دخول، يضع cookies |
| `logout.php` | POST | محمي | تسجيل خروج |
| `session.php` | GET | عام | فحص الجلسة الحالية |
| `clubs.php` | GET | عام | كل الأندية أو `?id=c1` |
| `posts.php` | GET | عام | المنشورات (`?type=`, `?clubId=`) |
| `posts.php` | POST | رئيس | إنشاء منشور `{ type, title, body, tags, externalUrl }` |
| `posts.php?id=N` | DELETE | رئيس/أدمن | حذف منشور |
| `events.php` | GET | عام | الفعاليات (`?clubId=`) |
| `events.php` | POST | رئيس | إنشاء فعالية `{ title, description, date, time, location, spots, registrationUrl }` |
| `events.php?id=N` | DELETE | رئيس/أدمن | حذف فعالية |
| `socials.php?clubId=c1` | GET | عام | حسابات سوشال نادٍ |
| `socials.php` | PUT | رئيس | تحديث حسابات نادي الرئيس |
| `accounts.php` | GET | أدمن | قائمة الحسابات |
| `accounts.php` | POST | أدمن | إنشاء حساب رئيس |
| `accounts.php?username=u` | PUT | أدمن | تغيير كلمة مرور |
| `accounts.php?username=u` | DELETE | أدمن | حذف حساب |
| `upload.php` | POST | رئيس | رفع صورة (multipart/form-data, حقل `file`) |

---

## 🎨 ميزات الواجهة

### موقع الطلبة (`رواق.html`)
- ✓ شاشة تحميل + شاشة خطأ مع إعادة محاولة.
- ✓ Feed مع فلاتر النوع (الكل/إعلانات/فعاليات/منشورات).
- ✓ بحث نصي حيّ (عناوين + محتوى + أسماء أندية + وسوم).
- ✓ فلترة بالوسوم (الأكثر تداولاً تُحسَب تلقائياً من المنشورات).
- ✓ بطاقات الفعاليات بشريط طاقة استيعابية + زر "سجِّل في الفعالية" إذا كان فيه `registrationUrl`.
- ✓ المنشورات تعرض روابط خارجية (Google Forms مثلاً).
- ✓ صور المنشورات (uploads/) مع `loading="lazy"`.
- ✓ إعادة تحميل تلقائي كل ٦٠ ثانية.
- ✓ RTL أصلي، خط Tajawal، responsive.

### لوحة الرؤساء (`presidents/`)
- ✓ تسجيل دخول بالـ username/password.
- ✓ نشر منشور/إعلان/فعالية مع وسوم + رابط خارجي اختياري.
- ✓ إدارة حسابات سوشال النادي.
- ✓ حذف المحتوى الخاص بالنادي.
- ✓ Toast notifications + spinner.

### لوحة الأدمن (`admin/`)
- ✓ إدارة كاملة لحسابات الرؤساء (CRUD).
- ✓ تغيير كلمة مرور أي حساب — يُلغي كل الجلسات النشطة للمستخدم تلقائيًا.
- ✓ إحصاءات لحظية (عدد المنشورات، الفعاليات، الحسابات).

---

## 🔧 إعادة الضبط الكاملة

لو احتجت تبدأ من جديد (سيمسح كل البيانات):
```
http://your-site.com/api/setup.php?force=1
```
(يحتاج أن يكون `setup.php` موجوداً).

---

## 📦 النشر على Production

### قائمة فحص قبل الإطلاق
- [ ] حذف `api/setup.php` من الخادم.
- [ ] `debug = false` في `api/config.php`.
- [ ] تشغيل الموقع على **HTTPS** فقط (Let's Encrypt).
- [ ] تغيير كلمة مرور الأدمن.
- [ ] تغيير كل كلمات مرور رؤساء الأندية.
- [ ] فحص `uploads/` بحيث `.htaccess` يعمل (جرّب رفع ملف `.php` وحاول تنفيذه — يجب أن يفشل).
- [ ] إعداد نسخ احتياطية يومية لقاعدة البيانات.
- [ ] إعداد monitoring بسيط (Uptime Robot أو ما شابه).
- [ ] مراجعة `audit_log` بشكل دوري.

### استضافة على cPanel (الأكثر شيوعًا في الجامعات)
1. ارفع مجلد `riwaq/` بأكمله إلى `public_html/`.
2. أنشئ قاعدة بيانات MySQL من cPanel.
3. عدّل `api/config.php` ببيانات القاعدة.
4. زر `api/setup.php` مرة واحدة.
5. احذف `api/setup.php`.

### استضافة على VPS (Apache + Ubuntu)
```bash
sudo apt update
sudo apt install apache2 php php-mysql php-mbstring mysql-server
sudo a2enmod rewrite
sudo systemctl restart apache2
# انسخ مجلد riwaq إلى /var/www/html/
sudo chown -R www-data:www-data /var/www/html/riwaq
```

---

## 🐛 استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| **شريط برتقالي "وضع تجريبي" يظهر في موقع الطلبة** | الـ API لا يرد. الأسباب: لا خادم PHP (افتحت الملف بـ file://)، أو `api/config.php` غير موجود، أو قاعدة البيانات غير مهيَّأة. اتبع قسم التركيب. |
| `تعذّر الاتصال بقاعدة البيانات` | تأكد من `config.php` صحيح وأن مستخدم MySQL موجود. |
| لوحة الرؤساء/الأدمن: "تعذّر الاتصال بالخادم" عند الدخول | الـ API غير متاح. تشغيل الخادم وقاعدة البيانات إلزامي لهاتين اللوحتين (الـ Demo فقط لصفحة الطلبة). |
| `csrf_failed` في كل طلب | تأكد أن المتصفح يحفظ cookies. على HTTPS؟ |
| الـ login يعمل ثم يخرج فورًا | مشكلة في الـ cookies — تأكد أن النطاق نفسه للـ frontend والـ API. |
| رفع الصور يفشل | تأكد من صلاحيات `uploads/` (`chmod 755`) و`upload_max_filesize` في php.ini. |
| `Method Not Allowed` | الطلب ليس HTTPS أو CORS غير مضبوط. |

---

## 📝 الترخيص

مشروع تجريبي لجامعة الإمام محمد بن سعود الإسلامية. للاستخدام التعليمي.
