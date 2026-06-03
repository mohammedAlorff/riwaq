/* Shared components — public student portal (read-only) */

// =====================
// Utilities
// =====================
function arabicDigits(str) {
  const map = { "0":"٠","1":"١","2":"٢","3":"٣","4":"٤","5":"٥","6":"٦","7":"٧","8":"٨","9":"٩" };
  return String(str).replace(/[0-9]/g, d => map[d]);
}

// تحويل التاريخ القادم من MySQL (`YYYY-MM-DD HH:MM:SS`) إلى وقت نسبي بالعربية
function relativeTimeAr(input) {
  if (!input) return "";
  let ts;
  if (typeof input === "number") {
    ts = input;
  } else if (typeof input === "string") {
    // 'YYYY-MM-DD HH:MM:SS' (توقيت الخادم) — تعامله كـ UTC مرنة
    const iso = input.includes("T") ? input : input.replace(" ", "T");
    const d = new Date(iso);
    ts = d.getTime();
  } else {
    return "";
  }
  if (!isFinite(ts)) return "";

  const diff = Math.max(0, Date.now() - ts);
  const min  = Math.floor(diff / 60000);
  const hour = Math.floor(min / 60);
  const day  = Math.floor(hour / 24);
  if (min < 1)   return "الآن";
  if (min === 1) return "قبل دقيقة";
  if (min === 2) return "قبل دقيقتين";
  if (min < 11)  return `قبل ${arabicDigits(min)} دقائق`;
  if (min < 60)  return `قبل ${arabicDigits(min)} دقيقة`;
  if (hour === 1) return "قبل ساعة";
  if (hour === 2) return "قبل ساعتين";
  if (hour < 11)  return `قبل ${arabicDigits(hour)} ساعات`;
  if (hour < 24)  return `قبل ${arabicDigits(hour)} ساعة`;
  if (day === 1) return "أمس";
  if (day === 2) return "قبل يومين";
  if (day < 11)  return `قبل ${arabicDigits(day)} أيام`;
  if (day < 30)  return `قبل ${arabicDigits(day)} يوماً`;
  const month = Math.floor(day / 30);
  if (month === 1) return "قبل شهر";
  if (month < 12)  return `قبل ${arabicDigits(month)} أشهر`;
  return `قبل ${arabicDigits(Math.floor(month / 12))} سنة`;
}

// =====================
// Avatar
// =====================
function Avatar({ size = "md", color, children, image, alt, style = {} }) {
  if (image) {
    return (
      <div className={`avatar ${size} avatar-image`} style={style}>
        <img src={image} alt={alt || ""} loading="lazy"/>
      </div>
    );
  }
  return (
    <div className={`avatar ${size}`} style={{ background: color || "#3a5a40", ...style }}>
      {children}
    </div>
  );
}

// =====================
// Icons (line, monochrome)
// =====================
const Icon = ({ name, size = 20, stroke = 1.7 }) => {
  const props = {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: stroke,
    strokeLinecap: "round", strokeLinejoin: "round",
    "aria-hidden": "true", focusable: "false"
  };
  switch (name) {
    case "home":     return <svg {...props}><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/></svg>;
    case "compass":  return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5.5-5.5 2 2-5.5 5.5-2z"/></svg>;
    case "calendar": return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>;
    case "search":   return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
    case "users":    return <svg {...props}><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M21 19c0-2.5-1.5-3.5-4-3.5"/></svg>;
    case "pin":      return <svg {...props}><path d="M12 21s-6-6-6-11a6 6 0 1 1 12 0c0 5-6 11-6 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
    case "clock":    return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "check":    return <svg {...props}><path d="m5 12 5 5L20 7"/></svg>;
    case "x":        return <svg {...props}><path d="M6 6 18 18M18 6 6 18"/></svg>;
    case "arrow-right": return <svg {...props}><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>;
    case "image":    return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 19 6-6 5 5 3-3 2 2"/></svg>;
    case "external": return <svg {...props}><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>;
    case "twitter":  return <svg {...props} fill="currentColor" stroke="none">
        <path d="M18.244 2H21l-6.49 7.41L22.5 22h-6.83l-5.36-7-6.13 7H1.5l6.94-7.94L1.5 2h6.99l4.84 6.4L18.244 2Zm-2.39 18h1.88L8.27 4h-2L15.854 20Z"/>
      </svg>;
    case "instagram": return <svg {...props}>
        <rect x="3" y="3" width="18" height="18" rx="5"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor"/>
      </svg>;
    case "snapchat": return <svg {...props}>
        <path d="M12 3c-3 0-5 2-5 5v2c0 1-1 2-2 2.5l-1 .5c-.5.2-.5.7 0 1l1.5.7c.8.3 1.2.9 1.4 1.6.2.7.7.9 1.3.6.6-.3 1.4 0 1.9.6.6.7 1.7 1.5 3 1.5s2.4-.8 3-1.5c.5-.6 1.3-.9 1.9-.6.6.3 1.1.1 1.3-.6.2-.7.6-1.3 1.4-1.6l1.5-.7c.5-.3.5-.8 0-1l-1-.5c-1-.5-2-1.5-2-2.5V8c0-3-2-5-5-5Z"/>
      </svg>;
    case "tiktok": return <svg {...props}>
        <path d="M14 3v10.5a3.5 3.5 0 1 1-3.5-3.5"/>
        <path d="M14 3c.5 2.5 2.5 4 5 4.2"/>
      </svg>;
    case "linkedin": return <svg {...props} fill="currentColor" stroke="none">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
        <rect x="2" y="9" width="4" height="12"/>
        <circle cx="4" cy="4" r="2"/>
      </svg>;
    case "telegram": return <svg {...props}>
        <path d="M22 3 2 11l6 2 2 7 4-4 6 4 2-17Z"/>
        <path d="m8 13 10-6-8 8"/>
      </svg>;
    default: return null;
  }
};

// =====================
// Sidebar
// =====================
function Sidebar({ route, setRoute }) {
  const navItems = [
    { id: "feed",   label: "الرئيسية",  icon: "home" },
    { id: "clubs",  label: "الأندية",   icon: "compass" },
    { id: "events", label: "الفعاليات", icon: "calendar" }
  ];

  return (
    <aside className="sidebar" aria-label="القائمة الجانبية">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">ر</div>
        <div>
          <div className="brand-name">رواق</div>
          <div className="brand-sub">جامعة الإمام محمد بن سعود</div>
        </div>
      </div>

      <nav className="nav" aria-label="التنقل الرئيسي">
        {navItems.map(n => (
          <button
            key={n.id}
            type="button"
            className={`nav-item ${route === n.id ? "active" : ""}`}
            onClick={() => setRoute(n.id)}
            aria-current={route === n.id ? "page" : undefined}
            aria-label={n.label}
          >
            <span className="nav-icon"><Icon name={n.icon} size={20}/></span>
            <span className="nav-label">{n.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="sidebar-foot-note">
          بوابة استعراض رسمية لأندية جامعة الإمام محمد بن سعود الإسلامية.
          للانضمام لنادٍ، تواصل مع إدارة الأنشطة الطلابية.
        </div>
      </div>
    </aside>
  );
}

// =====================
// Main head — optional controlled search via props
// =====================
function MainHead({ title, sub, search, children }) {
  return (
    <div className="main-head">
      <div className="main-head-titles">
        <h1>{title}</h1>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      {search ? (
        <label className="search" aria-label="البحث في رواق">
          <Icon name="search" size={16}/>
          <input
            type="search"
            placeholder={search.placeholder || "ابحث في رواق…"}
            value={search.value}
            onChange={e => search.onChange(e.target.value)}
          />
        </label>
      ) : null}
      {children}
    </div>
  );
}

// =====================
// Post card — read-only
// =====================
function PostCard({ post, club }) {
  if (!club) return null;

  const typeLabel = { announcement: "إعلان", event: "فعالية", post: "منشور" }[post.type] || "منشور";
  const timeText  = relativeTimeAr(post.createdAt || post._createdAt) || post.time || "";
  const imageSrc  = post.image && post.image.startsWith("http")
    ? post.image
    : (post.image ? "uploads/" + post.image.replace(/^uploads\//, "") : null);

  return (
    <article className="post">
      <div className="post-head">
        <Avatar size="md" color={club.color} image={club.image} alt={club.name}>{club.icon}</Avatar>
        <div className="post-author">
          <div className="post-author-name">
            {club.name}
            <span className="verified" title="نادي معتمد" aria-label="نادي معتمد">
              <Icon name="check" size={9} stroke={3}/>
            </span>
          </div>
          <div className="post-meta">
            <span>{club.college}</span>
            <span className="dot" aria-hidden="true"></span>
            <span>{timeText}</span>
          </div>
        </div>
        <span className={`post-type-pill ${post.type}`}>{typeLabel}</span>
      </div>

      <div className="post-body">
        <div className="post-title">{post.title}</div>
        <div className="post-text">{post.body}</div>
        {post.tags && post.tags.length > 0 && (
          <div className="post-tags">
            {post.tags.map(t => <span key={t} className="post-tag">{t}</span>)}
          </div>
        )}
        {post.externalUrl && (
          <a
            className="post-external"
            href={post.externalUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            <Icon name="external" size={14}/>
            <span>{post.type === "event" ? "سجِّل في الفعالية" : "افتح الرابط"}</span>
          </a>
        )}
      </div>

      {imageSrc && (
        <div className="post-image">
          <img src={imageSrc} alt={post.title || "صورة المنشور"} loading="lazy"/>
        </div>
      )}
      {!imageSrc && post.image && (
        <div className="post-image" role="img" aria-label="صورة المنشور">
          <div className="post-image-bg" aria-hidden="true"></div>
          <div className="post-image-icon" aria-hidden="true">
            <Icon name="image" size={36} stroke={1.3}/>
          </div>
        </div>
      )}
    </article>
  );
}

// =====================
// Right rail
// =====================
function FeedRail({ onOpenClub, onOpenEvents, onSelectTag }) {
  const { clubs, events, trendingTags } = React.useContext(window.RiwaqData);

  return (
    <aside className="rail" aria-label="معلومات جانبية">
      <div className="rail-card">
        <div className="rail-title">
          <span>فعاليات قادمة</span>
          <button type="button" className="see-all" onClick={onOpenEvents}>عرض الكل</button>
        </div>
        {events.length === 0 && (
          <div className="rail-empty">لا فعاليات قادمة</div>
        )}
        {events.slice(0, 4).map(e => {
          const parts = (e.date || "").split("-");
          const day   = parts[2] ? arabicDigits(parts[2]) : "";
          const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
          const monthIdx = parts[1] ? parseInt(parts[1], 10) - 1 : -1;
          const month = monthIdx >= 0 && monthNames[monthIdx] ? monthNames[monthIdx] : (parts[1] ? arabicDigits(parts[1]) : "");
          const time  = (e.time || "").slice(0, 5);
          return (
            <button
              key={e.id}
              type="button"
              className="event-row"
              onClick={onOpenEvents}
              aria-label={`فعالية: ${e.title}`}
            >
              <div className="event-date" aria-hidden="true">
                <div className="d">{day}</div>
                <div className="m">{month}</div>
              </div>
              <div className="event-info">
                <div className="event-name">{e.title}</div>
                <div className="event-loc">{e.location} · {arabicDigits(time)}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="rail-card">
        <div className="rail-title">
          <span>أندية الجامعة</span>
          <button type="button" className="see-all" onClick={() => onOpenClub(null)}>عرض الكل</button>
        </div>
        {clubs.slice(0, 4).map(c => (
          <button
            key={c.id}
            type="button"
            className="club-row"
            onClick={() => onOpenClub(c.id)}
            aria-label={`فتح ${c.name}`}
          >
            {c.image ? (
              <div className="club-icon club-icon-image" aria-hidden="true">
                <img src={c.image} alt="" loading="lazy"/>
              </div>
            ) : (
              <div className="club-icon" style={{ background: c.color }} aria-hidden="true">{c.icon}</div>
            )}
            <div className="club-info">
              <div className="club-name">{c.name}</div>
              <div className="club-members">{c.college}</div>
            </div>
          </button>
        ))}
      </div>

      {trendingTags && trendingTags.length > 0 && (
        <div className="rail-card">
          <div className="rail-title"><span>الأكثر تداولاً</span></div>
          <div className="tag-chips">
            {trendingTags.map(t => (
              <button
                key={t}
                type="button"
                className="tag-chip"
                onClick={() => onSelectTag && onSelectTag(t)}
                aria-label={`تصفية ب${t}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rail-foot">
        © رواق ١٤٤٧هـ · بوابة طلابية لجامعة الإمام محمد بن سعود الإسلامية.
        <br/>
        نسخة تجريبية · بُنيت لطلبة الجامعة.
      </div>
    </aside>
  );
}

// =====================
// Social links
// =====================
function SocialLinks({ socials }) {
  if (!socials || Object.keys(socials).length === 0) return null;

  const meta = {
    twitter:   { label: "X",           icon: "twitter",   color: "#000000" },
    linkedin:  { label: "لينكدإن",    icon: "linkedin",  color: "#0077b5" },
    instagram: { label: "إنستقرام",   icon: "instagram", color: "#c2185b" },
    snapchat:  { label: "سناب شات",   icon: "snapchat",  color: "#fbbf24" },
    tiktok:    { label: "تيك توك",    icon: "tiktok",    color: "#1a1a1a" },
    telegram:  { label: "تيليجرام",   icon: "telegram",  color: "#2aabee" }
  };

  const entries = Object.entries(socials).filter(([k, v]) => meta[k] && v && (v.url || v.handle));
  if (entries.length === 0) return null;

  return (
    <div className="socials">
      {entries.map(([key, val]) => {
        const m = meta[key];
        return (
          <a
            key={key}
            className="social-card"
            href={val.url || "#"}
            target="_blank"
            rel="noopener noreferrer nofollow"
            aria-label={`${m.label}: ${val.handle || val.url}`}
          >
            <div className="social-ico" style={{ background: m.color }} aria-hidden="true">
              <Icon name={m.icon} size={16}/>
            </div>
            <div className="social-text">
              <div className="social-label">{m.label}</div>
              <div className="social-handle">{val.handle || val.url}</div>
            </div>
            <span className="social-arrow" aria-hidden="true"><Icon name="external" size={14}/></span>
          </a>
        );
      })}
    </div>
  );
}

// Make components and utils globally available
Object.assign(window, {
  Avatar, Icon, Sidebar, MainHead, PostCard, FeedRail, SocialLinks,
  arabicDigits, relativeTimeAr
});
