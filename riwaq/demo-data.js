/* رواق — بيانات نموذجية للوضع التجريبي
 *
 * يُستخدم تلقائياً من api-client.js عندما يكون الخادم غير متاح
 * (مثلاً عند فتح الصفحة بـ file:// أو بدون PHP/MySQL مُهيَّأ).
 *
 * البنية تطابق ما يُرجعه الـ API بالضبط.
 */
(function () {
  "use strict";

  // التواريخ نسبية — تبقى دائماً "قادمة"
  const today = new Date();
  const addDays = (n) => {
    const d = new Date(today.getTime() + n * 86400000);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  };

  const clubs = [
    {
      id: "c1", name: "نادي البرمجة", short: "البرمجة",
      cat: "تقني", college: "علوم الحاسب",
      members: 412, color: "#2d5a3d", icon: "</>",
      desc: "نادٍ يجمع طلبة الجامعة المهتمين بالبرمجة وتطوير البرمجيات والذكاء الاصطناعي.",
      cover: "linear-gradient(135deg, #2d5a3d 0%, #4a7c59 100%)",
      socials: {
        twitter:   { handle: "@imamu_dev",     url: "https://twitter.com/imamu_dev" },
        instagram: { handle: "@imamu.dev",     url: "https://instagram.com/imamu.dev" },
        snapchat:  { handle: "imamu.dev",      url: "https://snapchat.com/add/imamu.dev" },
        tiktok:    { handle: "@imamu.dev",     url: "https://tiktok.com/@imamu.dev" },
        telegram:  { handle: "t.me/imamu_dev", url: "https://t.me/imamu_dev" }
      }
    },
    {
      id: "c2", name: "النادي الثقافي", short: "الثقافي",
      cat: "ثقافي", college: "اللغة العربية",
      members: 638, color: "#7d4f1f", icon: "ك",
      desc: "نادٍ يهتم بإحياء الموروث الثقافي العربي والإسلامي وتنظيم الأمسيات الأدبية.",
      cover: "linear-gradient(135deg, #7d4f1f 0%, #b08350 100%)",
      socials: {
        twitter:   { handle: "@imamu_culture", url: "https://twitter.com/imamu_culture" },
        instagram: { handle: "@imamu.culture", url: "https://instagram.com/imamu.culture" },
        snapchat:  { handle: "imamu.culture",  url: "https://snapchat.com/add/imamu.culture" },
        tiktok:    { handle: "@imamu.culture", url: "https://tiktok.com/@imamu.culture" }
      }
    },
    {
      id: "c3", name: "نادي المناظرات", short: "المناظرات",
      cat: "أكاديمي", college: "الشريعة",
      members: 287, color: "#1f3d4f", icon: "م",
      desc: "تطوير مهارات الحجاج والإقناع والخطابة لدى طلبة الجامعة.",
      cover: "linear-gradient(135deg, #1f3d4f 0%, #3a6378 100%)",
      socials: {
        twitter:   { handle: "@imamu_debate",     url: "https://twitter.com/imamu_debate" },
        instagram: { handle: "@imamu.debate",     url: "https://instagram.com/imamu.debate" },
        snapchat:  { handle: "imamu.debate",      url: "https://snapchat.com/add/imamu.debate" },
        telegram:  { handle: "t.me/imamu_debate", url: "https://t.me/imamu_debate" }
      }
    },
    {
      id: "c4", name: "نادي ريادة الأعمال", short: "الريادي",
      cat: "تقني", college: "إدارة الأعمال",
      members: 524, color: "#5a3a52", icon: "ر",
      desc: "احتضان أفكار الطلبة الريادية وربطهم بالمستثمرين والمسرّعات.",
      cover: "linear-gradient(135deg, #5a3a52 0%, #8a5d7e 100%)",
      socials: {
        twitter:   { handle: "@imamu_entre", url: "https://twitter.com/imamu_entre" },
        instagram: { handle: "@imamu.entre", url: "https://instagram.com/imamu.entre" },
        tiktok:    { handle: "@imamu.entre", url: "https://tiktok.com/@imamu.entre" }
      }
    },
    {
      id: "c5", name: "ملتقى القرآن", short: "القرآن",
      cat: "شرعي", college: "أصول الدين",
      members: 891, color: "#2d4a3d", icon: "ق",
      desc: "حلقات تحفيظ وتجويد وتدبر للقرآن الكريم لطلبة الجامعة.",
      cover: "linear-gradient(135deg, #2d4a3d 0%, #4a6a5a 100%)",
      socials: {
        twitter:   { handle: "@imamu_quran",     url: "https://twitter.com/imamu_quran" },
        instagram: { handle: "@imamu.quran",     url: "https://instagram.com/imamu.quran" },
        telegram:  { handle: "t.me/imamu_quran", url: "https://t.me/imamu_quran" }
      }
    },
    {
      id: "c6", name: "النادي العلمي", short: "العلمي",
      cat: "أكاديمي", college: "العلوم",
      members: 356, color: "#3d3a5a", icon: "ع",
      desc: "نشر الثقافة العلمية وتنظيم المسابقات والمعارض البحثية.",
      cover: "linear-gradient(135deg, #3d3a5a 0%, #5d5a8a 100%)",
      socials: {
        twitter:   { handle: "@imamu_sci",  url: "https://twitter.com/imamu_sci" },
        instagram: { handle: "@imamu.sci",  url: "https://instagram.com/imamu.sci" },
        snapchat:  { handle: "imamu.sci",   url: "https://snapchat.com/add/imamu.sci" }
      }
    },
    {
      id: "c7", name: "نادي التصوير", short: "التصوير",
      cat: "إبداعي", college: "الإعلام",
      members: 203, color: "#5a4a2d", icon: "ت",
      desc: "ورش وتحديات تصوير فوتوغرافي داخل الحرم وخارجه.",
      cover: "linear-gradient(135deg, #5a4a2d 0%, #8a724a 100%)",
      socials: {
        twitter:   { handle: "@imamu_lens", url: "https://twitter.com/imamu_lens" },
        instagram: { handle: "@imamu.lens", url: "https://instagram.com/imamu.lens" },
        tiktok:    { handle: "@imamu.lens", url: "https://tiktok.com/@imamu.lens" },
        snapchat:  { handle: "imamu.lens",  url: "https://snapchat.com/add/imamu.lens" }
      }
    },
    {
      id: "c8", name: "نادي الرياضة", short: "الرياضة",
      cat: "رياضي", college: "عام",
      members: 712, color: "#2d4a5a", icon: "ر",
      desc: "بطولات داخلية في كرة القدم والطائرة وألعاب القوى.",
      cover: "linear-gradient(135deg, #2d4a5a 0%, #4a728a 100%)",
      socials: {
        twitter:   { handle: "@imamu_sport", url: "https://twitter.com/imamu_sport" },
        instagram: { handle: "@imamu.sport", url: "https://instagram.com/imamu.sport" },
        tiktok:    { handle: "@imamu.sport", url: "https://tiktok.com/@imamu.sport" }
      }
    }
  ];

  // أوقات إنشاء المنشورات (نسبية للوقت الحالي)
  const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString().slice(0, 19).replace("T", " ");

  const posts = [
    {
      id: 1, clubId: "c1", type: "announcement",
      title: "هاكاثون رواق ٢٠٢٦",
      body: "يسرّ نادي البرمجة الإعلان عن الهاكاثون السنوي بمشاركة أكثر من ١٢٠ طالبًا من مختلف الكليات. التسجيل مفتوح حتى يوم الخميس القادم.",
      tags: ["#هاكاثون", "#برمجة"],
      image: null, externalUrl: null, linkedEventId: null,
      createdAt: minutesAgo(20)
    },
    {
      id: 2, clubId: "c5", type: "event",
      title: "ختمة جماعية ليلة الجمعة",
      body: "تُقام بمسجد الجامعة بعد صلاة العشاء، يقرأ بنا الشيخ د. سلمان الغامدي. الحضور مفتوح لجميع طلبة الجامعة.",
      tags: ["#قرآن", "#ختمة"],
      image: null, externalUrl: null, linkedEventId: 2,
      createdAt: minutesAgo(60)
    },
    {
      id: 3, clubId: "c3", type: "post",
      title: "نتائج بطولة المناظرات بين الكليات",
      body: "تتويج فريق كلية الشريعة بطلاً لبطولة المناظرات بعد منافسة قوية مع كلية اللغة العربية. مبروك للفائزين وشكراً لجميع المشاركين.",
      tags: ["#مناظرات"],
      image: null, externalUrl: null, linkedEventId: null,
      createdAt: minutesAgo(180)
    },
    {
      id: 4, clubId: "c4", type: "announcement",
      title: "ورشة: من فكرة إلى منتج",
      body: "بمشاركة المؤسس الشريك لشركة سلّة، نتعرف على رحلة بناء المنتج من الصفر حتى الإطلاق. مقاعد محدودة.",
      tags: ["#ريادة", "#ورشة"],
      image: null, externalUrl: null, linkedEventId: null,
      createdAt: minutesAgo(60 * 24)
    },
    {
      id: 5, clubId: "c7", type: "post",
      title: "تحدي صورة الأسبوع: الضوء بين الأقواس",
      body: "ندعو المصورين لالتقاط لقطات تعكس انعكاس الضوء داخل مباني الجامعة. آخر موعد للإرسال السبت.",
      tags: ["#تصوير", "#تحدي"],
      image: null, externalUrl: null, linkedEventId: null,
      createdAt: minutesAgo(60 * 26)
    },
    {
      id: 6, clubId: "c2", type: "event",
      title: "أمسية شعرية: من ديوان الجواهري",
      body: "يحييها الشاعر فارس الدوسري مع قراءات لطلبة قسم الأدب العربي.",
      tags: ["#أدب", "#شعر"],
      image: null, externalUrl: null, linkedEventId: 6,
      createdAt: minutesAgo(60 * 48)
    }
  ];

  const events = [
    {
      id: 1, clubId: "c1",
      title: "هاكاثون رواق ٢٠٢٦",
      description: "مسابقة برمجية مفتوحة لطلبة الجامعة.",
      date: addDays(14),  time: "09:00:00",
      location: "مبنى ٢٤ - قاعة الإبداع",
      spots: 120, taken: 96,
      registrationUrl: null,
      createdAt: minutesAgo(20)
    },
    {
      id: 2, clubId: "c5",
      title: "ختمة جماعية",
      description: "ختمة بعد صلاة العشاء.",
      date: addDays(16),  time: "20:30:00",
      location: "مسجد الجامعة",
      spots: 500, taken: 240,
      registrationUrl: null,
      createdAt: minutesAgo(60)
    },
    {
      id: 3, clubId: "c3",
      title: "نهائي بطولة المناظرات",
      description: "مباراة نهائية بين الكليات.",
      date: addDays(19),  time: "16:00:00",
      location: "قاعة الملك سلمان",
      spots: 300, taken: 187,
      registrationUrl: null,
      createdAt: minutesAgo(180)
    },
    {
      id: 4, clubId: "c4",
      title: "ورشة من فكرة إلى منتج",
      description: "رحلة بناء منتج كامل.",
      date: addDays(21),  time: "18:00:00",
      location: "مبنى الإدارة - ق ٣",
      spots: 80, taken: 80,
      registrationUrl: null,
      createdAt: minutesAgo(60 * 24)
    },
    {
      id: 5, clubId: "c2",
      title: "أمسية شعرية",
      description: "مع الشاعر فارس الدوسري.",
      date: addDays(25),  time: "19:00:00",
      location: "مسرح كلية اللغة",
      spots: 200, taken: 60,
      registrationUrl: null,
      createdAt: minutesAgo(60 * 48)
    },
    {
      id: 6, clubId: "c8",
      title: "بطولة كرة القدم - افتتاح",
      description: "حفل افتتاح البطولة.",
      date: addDays(28),  time: "16:30:00",
      location: "ملعب الجامعة",
      spots: 1000, taken: 412,
      registrationUrl: null,
      createdAt: minutesAgo(60 * 6)
    }
  ];

  window.RIWAQ_DEMO = { clubs, posts, events };
})();
