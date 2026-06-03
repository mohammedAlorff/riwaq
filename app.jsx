/* Main App — public student portal (read-only)
 *
 * يحمّل البيانات من /api عند الإقلاع. إذا فشل الـ API،
 * api-client يتحول تلقائياً إلى بيانات تجريبية من demo-data.js،
 * ونعرض شريط برتقالي يوضح للمستخدم أنه في وضع تجريبي.
 */

const RiwaqData = React.createContext({
  clubs: [], posts: [], events: [],
  trendingTags: [],
  loading: true, error: null,
  demo: false, demoReason: null,
  reload: () => {},
});

const initialState = {
  route: "feed",
  clubDetailId: null,
  feedTag: null
};

function reducer(state, action) {
  switch (action.type) {
    case "openClub":
      return { ...state, route: "clubDetail", clubDetailId: action.id };
    case "backFromClub":
      return { ...state, route: "clubs", clubDetailId: null };
    case "setRoute":
      return { ...state, route: action.route, clubDetailId: null, feedTag: null };
    case "setFeedTag":
      return { ...state, route: "feed", clubDetailId: null, feedTag: action.tag };
    case "clearFeedTag":
      return { ...state, feedTag: null };
    default:
      return state;
  }
}

const DEFAULT_TRENDING = ["#هاكاثون", "#رواق", "#فعاليات", "#مناظرات", "#ريادة"];

function DemoBanner({ reason }) {
  const [hidden, setHidden] = React.useState(() => {
    try { return sessionStorage.getItem("riwaq.demo.banner.dismissed") === "1"; }
    catch (e) { return false; }
  });
  if (hidden) return null;

  const explain = (() => {
    switch (reason) {
      case "configuration_missing":
      case "not_json":
      case "network":
      case "database_unavailable":
        return "المنصة تعرض حالياً بيانات نموذجية — البيانات الحقيقية ستظهر عند تشغيل المنصة رسمياً.";
      default:
        return "أنت تشاهد بيانات نموذجية توضيحية. ستُحدَّث تلقائياً عند إطلاق المنصة رسمياً.";
    }
  })();

  const dismiss = () => {
    try { sessionStorage.setItem("riwaq.demo.banner.dismissed", "1"); } catch (e) {}
    setHidden(true);
  };

  return (
    <div className="demo-banner" role="status">
      <span className="demo-banner-icon" aria-hidden="true">●</span>
      <div className="demo-banner-text">
        <strong>وضع تجريبي</strong>
        <span>· {explain}</span>
      </div>
      <button
        type="button"
        className="demo-banner-dismiss"
        onClick={dismiss}
        aria-label="إخفاء التنبيه"
        title="إخفاء"
      >
        ✕
      </button>
    </div>
  );
}

function App() {
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const [data, setData] = React.useState({
    clubs: [], posts: [], events: [],
    trendingTags: DEFAULT_TRENDING,
    loading: true, error: null,
    demo: false, demoReason: null,
  });

  const loadAll = React.useCallback(async () => {
    setData(d => ({ ...d, loading: true, error: null }));
    try {
      const [clubs, posts, events] = await Promise.all([
        window.RiwaqAPI.clubs.list(),
        window.RiwaqAPI.posts.list(),
        window.RiwaqAPI.events.list(),
      ]);
      const tagCount = {};
      posts.forEach(p => (p.tags || []).forEach(t => {
        tagCount[t] = (tagCount[t] || 0) + 1;
      }));
      const trending = Object.entries(tagCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([t]) => t);
      setData({
        clubs, posts, events,
        trendingTags: trending.length > 0 ? trending : DEFAULT_TRENDING,
        loading: false, error: null,
        demo: !!window.RiwaqAPI.isDemo,
        demoReason: window.RiwaqAPI.demoReason || null,
      });
    } catch (e) {
      setData(d => ({
        ...d,
        loading: false,
        error: e && e.message ? e.message : "تعذّر تحميل البيانات.",
      }));
    }
  }, []);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  // إعادة تحميل دورية فقط لو لسنا في وضع تجريبي
  React.useEffect(() => {
    if (data.demo) return;
    const id = setInterval(() => {
      if (!document.hidden) loadAll();
    }, 60000);
    return () => clearInterval(id);
  }, [loadAll, data.demo]);

  const ctx = React.useMemo(() => ({ ...data, reload: loadAll }), [data, loadAll]);
  const hideRail = state.route === "clubDetail";

  // شاشة تحميل أوّلي
  if (data.loading && data.clubs.length === 0) {
    return (
      <div className="app-loading">
        <div className="brand-mark brand-mark-large" aria-hidden="true">ر</div>
        <div className="app-loading-title">رواق</div>
        <div className="app-loading-sub">جاري تحميل البيانات…</div>
        <div className="spinner" aria-label="جاري التحميل"></div>
      </div>
    );
  }

  // شاشة خطأ (نادراً — فقط لو حتى Demo data غير متاحة)
  if (data.error && data.clubs.length === 0) {
    return (
      <div className="app-loading">
        <div className="brand-mark brand-mark-large" aria-hidden="true">ر</div>
        <div className="app-loading-title">تعذّر تحميل البيانات</div>
        <div className="app-loading-sub" style={{ maxWidth: 420 }}>{data.error}</div>
        <button type="button" className="btn btn-primary" onClick={loadAll} style={{ marginTop: 16 }}>
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <RiwaqData.Provider value={ctx}>
      {data.demo && <DemoBanner reason={data.demoReason}/>}
      <div className={`app ${hideRail ? "no-right" : ""} ${data.demo ? "has-demo-banner" : ""}`}>
        <Sidebar
          route={state.route === "clubDetail" ? "clubs" : state.route}
          setRoute={r => dispatch({ type: "setRoute", route: r })}
        />
        <main className="main">
          {state.route === "feed" && (
            <FeedScreen state={state} dispatch={dispatch}/>
          )}
          {state.route === "clubs" && <ClubsScreen state={state} dispatch={dispatch}/>}
          {state.route === "clubDetail" && (
            <ClubDetail
              clubId={state.clubDetailId}
              state={state} dispatch={dispatch}
              onBack={() => dispatch({ type: "backFromClub" })}
            />
          )}
          {state.route === "events" && <EventsScreen state={state} dispatch={dispatch}/>}
        </main>
        {!hideRail && (
          <FeedRail
            onOpenClub={(id) => id ? dispatch({ type: "openClub", id }) : dispatch({ type: "setRoute", route: "clubs" })}
            onOpenEvents={() => dispatch({ type: "setRoute", route: "events" })}
            onSelectTag={(tag) => dispatch({ type: "setFeedTag", tag })}
          />
        )}
      </div>
    </RiwaqData.Provider>
  );
}

window.RiwaqData = RiwaqData;

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
