/* Shared student interface. Icons come from bundled Lucide. */
function arabicDigits(value) {
  return String(value).replace(/[0-9]/g, n => '٠١٢٣٤٥٦٧٨٩'[n]);
}
function relativeTimeAr(input) {
  if (!input) return '';
  const date = new Date(typeof input === 'string' ? input.replace(' ', 'T') : input);
  if (!Number.isFinite(date.getTime())) return '';
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days > 6) return date.toLocaleDateString('ar-SA', {calendar:'gregory', day:'numeric', month:'short'});
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'الآن';
  return new Intl.RelativeTimeFormat('ar', {numeric:'auto'}).format(
    days > 0 ? -days : minutes >= 60 ? -Math.floor(minutes / 60) : -minutes,
    days > 0 ? 'day' : minutes >= 60 ? 'hour' : 'minute');
}
function Icon({name, size=20, stroke=1.7}) {
  const names = {home:'House', compass:'Compass', calendar:'CalendarDays', search:'Search', users:'Users',
    pin:'MapPin', clock:'Clock3', check:'Check', x:'X', 'arrow-right':'ArrowRight', 'arrow-left':'ArrowLeft',
    external:'ArrowUpLeft', image:'Image', refresh:'RefreshCw', grid:'LayoutGrid', shield:'ShieldCheck',
    pen:'PenLine', logout:'LogOut', chevron:'ChevronLeft', megaphone:'Megaphone', link:'Link',
    instagram:'Instagram', twitter:'AtSign', snapchat:'MessageCircle', tiktok:'Music2', telegram:'Send', spark:'Sparkles'};
  const node = window.lucide.icons[names[name] || 'Circle'];
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {node[2].map(([tag, attrs], i) => React.createElement(tag, {...attrs, key:i}))}
  </svg>;
}
function Avatar({size='md', color, children, image, alt=''}) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [image]);
  return <span className={'avatar '+size} style={{background:color || '#17644b'}}>
    {image && !failed ? <img src={image} alt={alt} loading="lazy" onError={() => setFailed(true)}/> : children}
  </span>;
}
function Sidebar({route}) {
  const {clubs, events} = React.useContext(window.RiwaqData);
  return <aside className="sidebar" aria-label="القائمة الرئيسية">
    <a className="brand" href="#feed" aria-label="رواق، الرئيسية"><span className="brand-mark">ر</span><span><strong className="brand-name">رواق</strong><span className="brand-sub">مجتمع الأندية الجامعية</span></span></a>
    <div className="nav-section">مساحتك الجامعية</div>
    <nav className="nav">
      {[['feed','الرئيسية','home',null],['clubs','الأندية','compass',clubs.length],['events','الفعاليات','calendar',events.length]].map(([id,label,icon,count]) =>
        <a key={id} href={'#'+id} className={'nav-item '+(route===id?'active':'')} aria-current={route===id?'page':undefined}>
          <Icon name={icon}/><span>{label}</span>{count !== null && <span className="nav-count">{arabicDigits(count)}</span>}
        </a>)}
    </nav>
    <div className="sidebar-bottom">
      <div className="campus-seal"><Icon name="spark" size={22}/><p>شغفك له مكان.<br/><strong>وأثرُك يبدأ هنا.</strong></p></div>
      <div className="portal-links"><a href="presidents/"><Icon name="pen" size={17}/>بوابة رئيس النادي<Icon name="external" size={14}/></a><a href="admin/"><Icon name="shield" size={17}/>إدارة رواق<Icon name="external" size={14}/></a></div>
      <div className="sidebar-foot-note">جامعة الإمام محمد بن سعود<br/>الإسلامية</div>
    </div>
  </aside>;
}
function MainHead({title, sub, search, children}) {
  return <header className="main-head"><div className="heading-row"><div><div className="eyebrow">رواق / مجتمع الجامعة</div><h1>{title}</h1>{sub && <p className="sub">{sub}</p>}</div>
    {search && <label className="search"><Icon name="search" size={18}/><input type="search" aria-label={search.placeholder || 'البحث في رواق'} placeholder={search.placeholder || 'ابحث عن شيء يلهمك…'} value={search.value} onChange={e=>search.onChange(e.target.value)}/></label>}
    </div>{children}</header>;
}
function PostCard({post, club}) {
  const [expanded, setExpanded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  if (!club) return null;
  const type = {announcement:'إعلان', event:'فعالية', post:'منشور'}[post.type] || 'منشور';
  const imageSrc = post.image ? (/^https?:\/\//.test(post.image) ? post.image : 'uploads/'+post.image.replace(/^\/?uploads\//,'')) : null;
  return <article className="post">
    <div className="post-head"><a className="post-author-link" href={'#clubs/'+encodeURIComponent(club.id)}>
      <Avatar color={club.color} image={club.image} alt={club.name}>{club.icon}</Avatar>
      <span><span className="post-author-name">{club.name}<span className="verified" title="نادي جامعي"><Icon name="check" size={11}/></span></span>
        <span className="post-meta">{club.college}<span>·</span>{relativeTimeAr(post.createdAt || post._createdAt) || post.time}</span></span>
    </a><span className={'post-type-pill '+post.type}><Icon name={post.type==='event'?'calendar':post.type==='announcement'?'megaphone':'pen'} size={13}/>{type}</span></div>
    <div className="post-body"><h2 className="post-title">{post.title}</h2><p className={'post-text '+(expanded?'expanded':'')}>{post.body}</p>
      {(post.body || '').length > 180 && <button className="text-action" onClick={()=>setExpanded(!expanded)} aria-expanded={expanded}>{expanded?'عرض أقل':'قراءة المزيد'}</button>}
      {imageSrc && !failed && <img className="post-photo" src={imageSrc} alt={post.title} loading="lazy" onError={()=>setFailed(true)}/>}
    </div>
    <div className="post-foot"><div className="post-tags">{(post.tags || []).map(t=><a key={t} href={'#feed?tag='+encodeURIComponent(t)}>{t.startsWith('#')?t:'#'+t}</a>)}</div>
      {post.externalUrl && <a className="text-action" href={post.externalUrl} target="_blank" rel="noopener noreferrer">{post.type==='event'?'رابط الفعالية':'افتح الرابط'}<Icon name="external" size={16}/></a>}
    </div>
  </article>;
}
function eventIsPast(ev) {
  return new Date(ev.date+'T'+(ev.time || '23:59:59')+'+03:00').getTime() < Date.now();
}
function FeedRail() {
  const {clubs,events,trendingTags} = React.useContext(window.RiwaqData);
  const upcoming = events.filter(e=>!eventIsPast(e)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,3);
  return <aside className="rail" aria-label="حول مجتمع رواق">
    <section className="rail-section"><div className="section-label"><h2>على الموعد</h2><Icon name="calendar" size={18}/></div><p className="rail-sub">مساحة لتجربة جديدة</p>
      {upcoming.length ? upcoming.map(ev=><a className="event-row" href="#events" key={ev.id}><span className="date-block"><strong>{arabicDigits(Number(ev.date.slice(8,10)))}</strong><small>{new Date(ev.date+'T12:00:00').toLocaleDateString('ar-SA',{calendar:'gregory',month:'short'})}</small></span><span><strong>{ev.title}</strong><small>{ev.location}</small></span><Icon name="chevron" size={15}/></a>) : <div className="rail-empty">لا توجد فعاليات قادمة حاليًا.<br/>تبقى لقاءاتنا السابقة في الأرشيف.</div>}
      <a className="rail-more" href="#events">تقويم الفعاليات<Icon name="arrow-left" size={16}/></a>
    </section>
    <section className="rail-section"><div className="section-label"><h2>تعرّف على الأندية</h2><Icon name="compass" size={18}/></div>
      {clubs.slice(0,4).map(c=><a className="club-row" href={'#clubs/'+encodeURIComponent(c.id)} key={c.id}><Avatar size="sm" color={c.color} image={c.image}>{c.icon}</Avatar><span><strong>{c.name}</strong><small>{c.cat} · {arabicDigits(c.members)} عضو</small></span><Icon name="chevron" size={15}/></a>)}
      <a className="rail-more" href="#clubs">كل الأندية<Icon name="arrow-left" size={16}/></a>
    </section>
    <section className="rail-section"><div className="section-label"><h2>حديث المجتمع</h2></div><div className="trending-tags">{trendingTags.map(tag=><a href={'#feed?tag='+encodeURIComponent(tag)} key={tag}>{tag}</a>)}</div></section>
    <p className="rail-footer">رواق · حيث يلتقي الشغف بالأثر<br/>{new Date().getFullYear()} ©</p>
  </aside>;
}
function SocialLinks({socials={}}) {
  const labels={twitter:'X / تويتر',instagram:'إنستقرام',snapchat:'سناب شات',tiktok:'تيك توك',telegram:'تيليجرام'};
  return <div className="socials">{Object.entries(socials).filter(([key,v])=>labels[key] && /^https?:\/\//i.test(v.url || '')).map(([key,v])=><a className="social-card" href={v.url} target="_blank" rel="noopener noreferrer" aria-label={`${labels[key]}، ${v.handle || v.url}`} key={key}><span className="social-ico"><Icon name={key}/></span><span><strong>{labels[key]}</strong><small dir="ltr">{v.handle || v.url}</small></span><Icon name="external" size={18}/></a>)}</div>;
}
Object.assign(window,{Icon,Avatar,Sidebar,MainHead,PostCard,FeedRail,SocialLinks,arabicDigits,relativeTimeAr,eventIsPast});
