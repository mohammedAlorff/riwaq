-- ============================================================
-- رواق — بذرة الأندية الافتراضية
-- (المستخدمون يُنشَؤون عبر setup.php لاستخدام password_hash من PHP)
-- ============================================================

SET NAMES utf8mb4;

-- ============================================================
-- ٨ أندية افتراضية
-- ============================================================
INSERT INTO clubs (id, name, short_name, category, college, members, color, icon, description, cover) VALUES
  ('c1', 'نادي البرمجة',        'البرمجة',   'تقني',   'علوم الحاسب',     412, '#2d5a3d', '</>',
   'نادٍ يجمع طلبة الجامعة المهتمين بالبرمجة وتطوير البرمجيات والذكاء الاصطناعي.',
   'linear-gradient(135deg, #2d5a3d 0%, #4a7c59 100%)'),

  ('c2', 'النادي الثقافي',       'الثقافي',  'ثقافي',  'اللغة العربية',   638, '#7d4f1f', 'ك',
   'نادٍ يهتم بإحياء الموروث الثقافي العربي والإسلامي وتنظيم الأمسيات الأدبية.',
   'linear-gradient(135deg, #7d4f1f 0%, #b08350 100%)'),

  ('c3', 'نادي المناظرات',       'المناظرات','أكاديمي','الشريعة',          287, '#1f3d4f', 'م',
   'تطوير مهارات الحجاج والإقناع والخطابة لدى طلبة الجامعة.',
   'linear-gradient(135deg, #1f3d4f 0%, #3a6378 100%)'),

  ('c4', 'نادي ريادة الأعمال',    'الريادي',  'تقني',   'إدارة الأعمال',    524, '#5a3a52', 'ر',
   'احتضان أفكار الطلبة الريادية وربطهم بالمستثمرين والمسرّعات.',
   'linear-gradient(135deg, #5a3a52 0%, #8a5d7e 100%)'),

  ('c5', 'ملتقى القرآن',         'القرآن',   'شرعي',   'أصول الدين',       891, '#2d4a3d', 'ق',
   'حلقات تحفيظ وتجويد وتدبر للقرآن الكريم لطلبة الجامعة.',
   'linear-gradient(135deg, #2d4a3d 0%, #4a6a5a 100%)'),

  ('c6', 'النادي العلمي',        'العلمي',   'أكاديمي','العلوم',           356, '#3d3a5a', 'ع',
   'نشر الثقافة العلمية وتنظيم المسابقات والمعارض البحثية.',
   'linear-gradient(135deg, #3d3a5a 0%, #5d5a8a 100%)'),

  ('c7', 'نادي التصوير',         'التصوير',  'إبداعي', 'الإعلام',          203, '#5a4a2d', 'ت',
   'ورش وتحديات تصوير فوتوغرافي داخل الحرم وخارجه.',
   'linear-gradient(135deg, #5a4a2d 0%, #8a724a 100%)'),

  ('c8', 'نادي الرياضة',         'الرياضة',  'رياضي',  'عام',              712, '#2d4a5a', 'ر',
   'بطولات داخلية في كرة القدم والطائرة وألعاب القوى.',
   'linear-gradient(135deg, #2d4a5a 0%, #4a728a 100%)');

-- ============================================================
-- حسابات السوشال الافتراضية
-- ============================================================
INSERT INTO socials (club_id, platform, handle, url) VALUES
  ('c1', 'twitter',   '@imamu_dev',      'https://twitter.com/imamu_dev'),
  ('c1', 'instagram', '@imamu.dev',      'https://instagram.com/imamu.dev'),
  ('c1', 'snapchat',  'imamu.dev',       'https://snapchat.com/add/imamu.dev'),
  ('c1', 'tiktok',    '@imamu.dev',      'https://tiktok.com/@imamu.dev'),
  ('c1', 'telegram',  't.me/imamu_dev',  'https://t.me/imamu_dev'),

  ('c2', 'twitter',   '@imamu_culture',  'https://twitter.com/imamu_culture'),
  ('c2', 'instagram', '@imamu.culture',  'https://instagram.com/imamu.culture'),
  ('c2', 'snapchat',  'imamu.culture',   'https://snapchat.com/add/imamu.culture'),
  ('c2', 'tiktok',    '@imamu.culture',  'https://tiktok.com/@imamu.culture'),

  ('c3', 'twitter',   '@imamu_debate',   'https://twitter.com/imamu_debate'),
  ('c3', 'instagram', '@imamu.debate',   'https://instagram.com/imamu.debate'),
  ('c3', 'snapchat',  'imamu.debate',    'https://snapchat.com/add/imamu.debate'),
  ('c3', 'telegram',  't.me/imamu_debate','https://t.me/imamu_debate'),

  ('c4', 'twitter',   '@imamu_entre',    'https://twitter.com/imamu_entre'),
  ('c4', 'instagram', '@imamu.entre',    'https://instagram.com/imamu.entre'),
  ('c4', 'tiktok',    '@imamu.entre',    'https://tiktok.com/@imamu.entre'),

  ('c5', 'twitter',   '@imamu_quran',    'https://twitter.com/imamu_quran'),
  ('c5', 'instagram', '@imamu.quran',    'https://instagram.com/imamu.quran'),
  ('c5', 'telegram',  't.me/imamu_quran','https://t.me/imamu_quran'),

  ('c6', 'twitter',   '@imamu_sci',      'https://twitter.com/imamu_sci'),
  ('c6', 'instagram', '@imamu.sci',      'https://instagram.com/imamu.sci'),
  ('c6', 'snapchat',  'imamu.sci',       'https://snapchat.com/add/imamu.sci'),

  ('c7', 'twitter',   '@imamu_lens',     'https://twitter.com/imamu_lens'),
  ('c7', 'instagram', '@imamu.lens',     'https://instagram.com/imamu.lens'),
  ('c7', 'tiktok',    '@imamu.lens',     'https://tiktok.com/@imamu.lens'),
  ('c7', 'snapchat',  'imamu.lens',      'https://snapchat.com/add/imamu.lens'),

  ('c8', 'twitter',   '@imamu_sport',    'https://twitter.com/imamu_sport'),
  ('c8', 'instagram', '@imamu.sport',    'https://instagram.com/imamu.sport'),
  ('c8', 'tiktok',    '@imamu.sport',    'https://tiktok.com/@imamu.sport');

-- ============================================================
-- منشورات افتراضية (لتبدو المنصة حيّة عند التشغيل الأول)
-- ============================================================
INSERT INTO posts (club_id, type, title, body, tags) VALUES
  ('c1', 'announcement', 'هاكاثون رواق ٢٠٢٦',
   'يسرّ نادي البرمجة الإعلان عن الهاكاثون السنوي بمشاركة أكثر من ١٢٠ طالبًا من مختلف الكليات. التسجيل مفتوح حتى يوم الخميس القادم.',
   JSON_ARRAY('#هاكاثون', '#برمجة')),

  ('c5', 'event', 'ختمة جماعية ليلة الجمعة',
   'تُقام بمسجد الجامعة بعد صلاة العشاء، يقرأ بنا الشيخ د. سلمان الغامدي. الحضور مفتوح لجميع طلبة الجامعة.',
   JSON_ARRAY('#قرآن', '#ختمة')),

  ('c3', 'post', 'نتائج بطولة المناظرات بين الكليات',
   'تتويج فريق كلية الشريعة بطلاً لبطولة المناظرات بعد منافسة قوية مع كلية اللغة العربية.',
   JSON_ARRAY('#مناظرات')),

  ('c4', 'announcement', 'ورشة: من فكرة إلى منتج',
   'بمشاركة المؤسس الشريك لشركة سلّة، نتعرف على رحلة بناء المنتج من الصفر حتى الإطلاق. مقاعد محدودة.',
   JSON_ARRAY('#ريادة', '#ورشة')),

  ('c7', 'post', 'تحدي صورة الأسبوع: الضوء بين الأقواس',
   'ندعو المصورين لالتقاط لقطات تعكس انعكاس الضوء داخل مباني الجامعة. آخر موعد للإرسال السبت.',
   JSON_ARRAY('#تصوير', '#تحدي')),

  ('c2', 'event', 'أمسية شعرية: من ديوان الجواهري',
   'يحييها الشاعر فارس الدوسري مع قراءات لطلبة قسم الأدب العربي.',
   JSON_ARRAY('#أدب', '#شعر'));

-- ============================================================
-- فعاليات افتراضية
-- ============================================================
INSERT INTO events (club_id, title, description, event_date, event_time, location, spots, taken, registration_url) VALUES
  ('c1', 'هاكاثون رواق ٢٠٢٦', 'مسابقة برمجية مفتوحة لطلبة الجامعة.',
   DATE_ADD(CURDATE(), INTERVAL 14 DAY), '09:00:00', 'مبنى ٢٤ - قاعة الإبداع', 120, 96, NULL),

  ('c5', 'ختمة جماعية', 'ختمة بعد صلاة العشاء.',
   DATE_ADD(CURDATE(), INTERVAL 16 DAY), '20:30:00', 'مسجد الجامعة',           500, 240, NULL),

  ('c3', 'نهائي بطولة المناظرات', 'مباراة نهائية بين الكليات.',
   DATE_ADD(CURDATE(), INTERVAL 19 DAY), '16:00:00', 'قاعة الملك سلمان',       300, 187, NULL),

  ('c4', 'ورشة من فكرة إلى منتج', 'رحلة بناء منتج كامل.',
   DATE_ADD(CURDATE(), INTERVAL 21 DAY), '18:00:00', 'مبنى الإدارة - ق ٣',     80,  80,  NULL),

  ('c2', 'أمسية شعرية', 'مع الشاعر فارس الدوسري.',
   DATE_ADD(CURDATE(), INTERVAL 25 DAY), '19:00:00', 'مسرح كلية اللغة',        200, 60,  NULL),

  ('c8', 'بطولة كرة القدم - افتتاح', 'حفل افتتاح البطولة.',
   DATE_ADD(CURDATE(), INTERVAL 28 DAY), '16:30:00', 'ملعب الجامعة',           1000,412, NULL);
