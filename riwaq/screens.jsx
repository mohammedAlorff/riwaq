/* Screen components — public student portal (read-only)
 * تقرأ كل البيانات من RiwaqData context (لا أكثر من window.RIWAQ_DATA).
 */

// ====================================================================
// FEED SCREEN — feed with type/tag filters + search
// ====================================================================
function FeedScreen({ state, dispatch }) {
  const { clubs, posts } = React.useContext(window.RiwaqData);

  const clubMap = React.useMemo(
    () => Object.fromEntries(clubs.map(c => [c.id, c])),
    [clubs]
  );

  const [tab, setTab]     = React.useState("all");
  const [query, setQuery] = React.useState("");

  const q = query.trim().toLowerCase();
  const tagFilter = state.feedTag || null;

  const filtered = React.useMemo(() => posts.filter(p => {
    if (!clubMap[p.clubId]) return false;
    if (tab === "events"        && p.type !== "event")        return false;
    if (tab === "announcements" && p.type !== "announcement") return false;
    if (tab === "posts"         && p.type !== "post")         return false;
    if (tagFilter && !(p.tags && p.tags.includes(tagFilter))) return false;
    if (q) {
      const haystack = (
        (p.title || "") + " " +
        (p.body  || "") + " " +
        ((p.tags || []).join(" ")) + " " +
        (clubMap[p.clubId].name || "")
      ).toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  }), [posts, clubMap, tab, tagFilter, q]);

  return (
    <>
      <MainHead
        title="الرئيسية"
        sub={`أحدث ما يدور في أندية وفعاليات جامعة الإمام · ${arabicDigits(filtered.length)} منشور`}
        search={{ value: query, onChange: setQuery }}
      >
        <div className="tabs" role="tablist" aria-label="تصفية حسب النوع">
          {[
            { id: "all", label: "الكل" },
            { id: "announcements", label: "إعلانات" },
            { id: "events", label: "فعاليات" },
            { id: "posts", label: "منشورات" }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </MainHead>

      <div className="main-body">
        {tagFilter && (
          <div className="filter-bar" role="status">
            <span className="filter-bar-label">عرض المنشورات الموسومة بـ</span>
            <span className="filter-bar-tag">{tagFilter}</span>
            <button
              type="button"
              className="filter-bar-clear"
              onClick={() => dispatch({ type: "clearFeedTag" })}
              aria-label="إزالة الفلتر"
            >
              <Icon name="x" size={14}/>
              <span>إلغاء</span>
            </button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="empty">
            <Icon name="compass" size={48} stroke={1.2}/>
            <div className="title">
              {q || tagFilter ? "لا منشورات تطابق البحث" : "لا منشورات هنا بعد"}
            </div>
            <div className="sub">
              {q || tagFilter
                ? "جرّب كلمة أخرى أو ألغِ الفلاتر"
                : "ستظهر هنا أحدث إعلانات وفعاليات أندية الجامعة فور نشرها"}
            </div>
          </div>
        ) : (
          filtered.map(p => (
            <PostCard
              key={p.id}
              post={p}
              club={clubMap[p.clubId]}
            />
          ))
        )}
      </div>
    </>
  );
}

// ====================================================================
// CLUBS SCREEN — browse all clubs
// ====================================================================
function ClubsScreen({ state, dispatch }) {
  const { clubs } = React.useContext(window.RiwaqData);
  const [cat, setCat] = React.useState("الكل");
  const [q, setQ]     = React.useState("");

  const cats = ["الكل", "تقني", "ثقافي", "شرعي", "أكاديمي", "رياضي", "إبداعي"];

  const query = q.trim().toLowerCase();
  const filtered = clubs.filter(c =>
    (cat === "الكل" || c.cat === cat) &&
    (query === "" ||
      c.name.toLowerCase().includes(query) ||
      (c.desc || "").toLowerCase().includes(query) ||
      (c.college || "").toLowerCase().includes(query))
  );

  return (
    <>
      <MainHead title="الأندية" sub={`اكتشف ${arabicDigits(clubs.length)} نادياً طلابياً في الجامعة`}/>
      <div className="main-body">
        <div className="clubs-filters">
          <div role="tablist" aria-label="تصفية حسب التصنيف" className="clubs-filter-tabs">
            {cats.map(c => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={cat === c}
                className={`tab ${cat === c ? "active" : ""}`}
                onClick={() => setCat(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <label className="search clubs-search" aria-label="ابحث عن نادٍ">
            <Icon name="search" size={16}/>
            <input
              type="search"
              placeholder="ابحث عن نادٍ…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </label>
        </div>

        <div className="club-grid">
          {filtered.map(c => (
            <button
              key={c.id}
              type="button"
              className="club-card"
              onClick={() => dispatch({ type: "openClub", id: c.id })}
              aria-label={`فتح ${c.name}`}
            >
              <div className="club-cover" style={{ background: c.cover }}>
                <div className="club-cover-pattern" aria-hidden="true"></div>
                {c.image ? (
                  <div className="club-card-icon club-card-icon-image" aria-hidden="true">
                    <img src={c.image} alt="" loading="lazy"/>
                  </div>
                ) : (
                  <div className="club-card-icon" style={{ background: c.color }} aria-hidden="true">{c.icon}</div>
                )}
              </div>
              <div className="club-card-body">
                <span className="club-card-cat">{c.cat}</span>
                <div className="club-card-name">{c.name}</div>
                <div className="club-card-desc">{c.desc}</div>
                <div className="club-card-foot">
                  <div className="club-card-members">
                    <Icon name="users" size={14}/>
                    {arabicDigits(c.members)} عضو
                  </div>
                  <div className="club-card-college">{c.college}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="empty">
            <Icon name="search" size={42} stroke={1.2}/>
            <div className="title">لم نجد نادياً يطابق بحثك</div>
            <div className="sub">جرّب تصنيفًا أو كلمةً أخرى</div>
          </div>
        )}
      </div>
    </>
  );
}

// ====================================================================
// CLUB DETAIL — read-only: posts, events, socials, about
// ====================================================================
function ClubDetail({ clubId, state, dispatch, onBack }) {
  const { clubs, posts, events } = React.useContext(window.RiwaqData);
  const club = clubs.find(c => c.id === clubId);
  const [tab, setTab] = React.useState("posts");

  const clubMap = React.useMemo(
    () => Object.fromEntries(clubs.map(c => [c.id, c])),
    [clubs]
  );

  if (!club) {
    return (
      <div className="empty">
        <Icon name="search" size={42} stroke={1.2}/>
        <div className="title">لم نتمكن من العثور على هذا النادي</div>
        <div className="sub">قد يكون قد حُذف أو غُيّر معرّفه</div>
        <button type="button" className="btn btn-ghost" style={{ marginTop: 14 }} onClick={onBack}>
          العودة إلى الأندية
        </button>
      </div>
    );
  }

  const clubPosts  = posts.filter(p => p.clubId === clubId);
  const clubEvents = events.filter(e => e.clubId === clubId);
  const hasSocials = club.socials && Object.keys(club.socials).length > 0;

  return (
    <>
      <div className="main-head cd-main-head">
        <button
          type="button"
          className="icon-btn"
          onClick={onBack}
          title="رجوع إلى الأندية"
          aria-label="رجوع إلى الأندية"
        >
          <Icon name="arrow-right" size={18}/>
        </button>
        <div>
          <h1>{club.name}</h1>
          <div className="sub">{club.college} · {club.cat}</div>
        </div>
      </div>

      <div className="cd-cover" style={{ background: club.cover }} aria-hidden="true">
        <div className="cd-cover-pattern"></div>
      </div>
      <div className="cd-head">
        {club.image ? (
          <div className="cd-icon cd-icon-image" aria-hidden="true">
            <img src={club.image} alt="" loading="lazy"/>
          </div>
        ) : (
          <div className="cd-icon" style={{ background: club.color }} aria-hidden="true">{club.icon}</div>
        )}
        <div className="cd-name-block">
          <div className="cd-name">{club.name}</div>
          <div className="cd-meta">
            <span>{club.college}</span>
            <span aria-hidden="true">·</span>
            <span>{arabicDigits(club.members)} عضو</span>
          </div>
        </div>
      </div>

      <div className="cd-desc">{club.desc}</div>

      <div className="stats-row">
        <div className="stat-cell">
          <div className="stat-v">{arabicDigits(club.members)}</div>
          <div className="stat-l">عضو نشط</div>
        </div>
        <div className="stat-cell">
          <div className="stat-v">{arabicDigits(clubPosts.length)}</div>
          <div className="stat-l">منشور</div>
        </div>
        <div className="stat-cell">
          <div className="stat-v">{arabicDigits(clubEvents.length)}</div>
          <div className="stat-l">فعالية</div>
        </div>
        <div className="stat-cell">
          <div className="stat-v">{hasSocials ? arabicDigits(Object.keys(club.socials).length) : "—"}</div>
          <div className="stat-l">حساب رسمي</div>
        </div>
      </div>

      <div className="cd-tabs" role="tablist" aria-label="أقسام النادي">
        {[
          { id: "posts",   label: "المنشورات" },
          { id: "events",  label: "الفعاليات" },
          { id: "socials", label: "حسابات النادي" },
          { id: "about",   label: "نبذة" }
        ].map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`cd-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="main-body">
        {tab === "posts" && (
          clubPosts.length === 0 ? (
            <div className="empty">
              <Icon name="compass" size={36} stroke={1.2}/>
              <div className="title">لا منشورات بعد</div>
              <div className="sub">سيُضيف النادي منشوراته وإعلاناته هنا قريباً</div>
            </div>
          ) : clubPosts.map(p => (
            <PostCard key={p.id} post={p} club={clubMap[p.clubId]}/>
          ))
        )}

        {tab === "events" && (
          clubEvents.length === 0 ? (
            <div className="empty">
              <Icon name="calendar" size={36} stroke={1.2}/>
              <div className="title">لا فعاليات قادمة</div>
              <div className="sub">تابع النادي لمعرفة فعالياته القادمة</div>
            </div>
          ) : (
            <div className="event-grid">
              {clubEvents.map(e => <EventCard key={e.id} ev={e} club={club} interactive={false}/>)}
            </div>
          )
        )}

        {tab === "socials" && (
          <div className="panel">
            <h3 className="panel-title">حسابات النادي</h3>
            <p className="panel-sub">تابع {club.name} على حساباته الرسمية في منصات التواصل.</p>
            {hasSocials ? (
              <SocialLinks socials={club.socials}/>
            ) : (
              <div className="empty" style={{ padding: 30 }}>
                <div className="title">لا توجد حسابات مسجّلة بعد</div>
              </div>
            )}
          </div>
        )}

        {tab === "about" && (
          <div className="panel">
            <h3 className="panel-title">عن {club.name}</h3>
            <p className="panel-text">
              {club.desc} يجتمع أعضاء النادي بشكل دوري داخل الحرم الجامعي لتنظيم الفعاليات والورش وإصدار الإعلانات الرسمية بعد اعتمادها من إدارة الأنشطة الطلابية بالجامعة.
            </p>
            <h4 className="panel-subtitle">شروط العضوية</h4>
            <ul className="panel-list">
              <li>· أن يكون منتسبًا لجامعة الإمام محمد بن سعود.</li>
              <li>· الالتزام بسياسة الأنشطة الطلابية المعتمدة.</li>
              <li>· المشاركة الفعّالة في فعاليتين على الأقل في الفصل.</li>
            </ul>
            <h4 className="panel-subtitle">كيف تنضم؟</h4>
            <div className="panel-text" style={{ fontSize: 14 }}>
              تواصل مع إدارة الأنشطة الطلابية في مبنى ١٢، أو راسل النادي مباشرة عبر حساباته الرسمية في تبويب «حسابات النادي».
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ====================================================================
// EVENT CARD — read-only event display with capacity progress
// ====================================================================
function EventCard({ ev, club, onOpenClub, interactive = true }) {
  const spots = Number(ev.spots) || 0;
  const taken = Math.min(spots, Math.max(0, Number(ev.taken) || 0));
  const pct   = spots > 0 ? Math.round((taken / spots) * 100) : 0;
  const full  = spots > 0 && taken >= spots;

  const handleOpenClub = () => {
    if (!interactive) return;
    if (onOpenClub && club) onOpenClub(club.id);
  };

  // اشتق day/month من event_date (YYYY-MM-DD أو مفرّغ)
  const { d: dayLabel, m: monthLabel } = React.useMemo(() => {
    if (!ev.date || typeof ev.date !== "string") return { d: "", m: "" };
    const parts = ev.date.split("-");
    if (parts.length < 3) return { d: "", m: "" };
    const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
    const day = arabicDigits(parts[2]);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const month = monthNames[monthIdx] || arabicDigits(parts[1]);
    return { d: day, m: month };
  }, [ev.date]);

  const displayDate = ev.date ? arabicDigits(ev.date.split("-").reverse().join("/")) : "";
  const displayTime = ev.time ? arabicDigits((ev.time || "").slice(0, 5)) : "";

  return (
    <div
      className={`event-card ${interactive ? "is-interactive" : ""}`}
      role={interactive ? "group" : undefined}
      aria-label={`فعالية ${ev.title}${club ? " · " + club.name : ""}`}
    >
      <div
        className="event-card-head"
        onClick={handleOpenClub}
        style={interactive ? { cursor: "pointer" } : undefined}
      >
        <div className="event-card-date" aria-hidden="true">
          <div className="d">{dayLabel}</div>
          <div className="m">{monthLabel}</div>
        </div>
        <div className="event-card-headtext">
          <div className="event-card-title">{ev.title}</div>
          {club && (
            <div className="event-card-club">
              <span className="event-card-club-dot" style={{ background: club.color }} aria-hidden="true"></span>
              {club.name}
            </div>
          )}
        </div>
      </div>
      <div className="event-card-row"><span className="ico"><Icon name="calendar" size={14}/></span>{displayDate}</div>
      <div className="event-card-row"><span className="ico"><Icon name="clock"    size={14}/></span>{displayTime}</div>
      <div className="event-card-row"><span className="ico"><Icon name="pin"      size={14}/></span>{ev.location}</div>

      <div className="event-card-cap">
        <div className="event-card-cap-row">
          <span className="event-card-cap-label">
            <Icon name="users" size={13}/>
            <span>{arabicDigits(taken)} / {arabicDigits(spots)} مقعد</span>
          </span>
          <span className={`event-card-cap-pct ${full ? "full" : ""}`}>
            {full ? "مكتمل" : `${arabicDigits(pct)}%`}
          </span>
        </div>
        <div className="event-card-progress" aria-hidden="true">
          <div style={{ width: `${pct}%` }} className={full ? "full" : ""}></div>
        </div>
      </div>

      {ev.registrationUrl && !full && (
        <a
          className="btn btn-primary event-card-register"
          href={ev.registrationUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon name="external" size={14}/>
          <span>سجِّل في الفعالية</span>
        </a>
      )}
      {!ev.registrationUrl && !full && (
        <div className="event-card-open-attendance">
          <Icon name="users" size={13}/>
          <span>الحضور مفتوح · للتسجيل تواصل مع النادي عبر حساباته</span>
        </div>
      )}
    </div>
  );
}

// ====================================================================
// EVENTS SCREEN — read-only list of upcoming events
// ====================================================================
function EventsScreen({ state, dispatch }) {
  const { clubs, events } = React.useContext(window.RiwaqData);
  const clubMap = React.useMemo(
    () => Object.fromEntries(clubs.map(c => [c.id, c])),
    [clubs]
  );

  return (
    <>
      <MainHead title="الفعاليات" sub={`${arabicDigits(events.length)} فعالية قادمة من أندية الجامعة`}/>
      <div className="main-body">
        {events.length === 0 ? (
          <div className="empty">
            <Icon name="calendar" size={42} stroke={1.2}/>
            <div className="title">لا فعاليات قادمة</div>
            <div className="sub">ستظهر هنا أحدث فعاليات الأندية فور الإعلان عنها</div>
          </div>
        ) : (
          <div className="event-grid">
            {events.map(e => (
              <EventCard
                key={e.id}
                ev={e}
                club={clubMap[e.clubId]}
                onOpenClub={(id) => dispatch({ type: "openClub", id })}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// Make screens globally available
Object.assign(window, {
  FeedScreen, ClubsScreen, ClubDetail, EventsScreen, EventCard
});
