import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowDownUp, ArrowUpRight, CalendarDays, MapPin, Menu, Sparkles, TrainFront, AlertCircle, X, History, ChevronDown, ShieldCheck, RotateCcw, Send } from "lucide-react";
import { addDays, format, isSameDay, isValid, parseISO, startOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { DatePanel } from "@/components/date-panel";
import { JourneyAssistant } from "@/components/journey-assistant";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import heroJpg from "@/assets/midnight-lake.jpg";
import { useHomeEntrance } from "@/hooks/use-home-entrance";
import { HeroAtmosphere, useHeroDepth } from "@/components/hero-depth";
import { AnimatePresence, LayoutGroup, motion, SelectionMark, SearchAction, useSearchMicroMotion } from "@/components/search-motion";
import { useReducedMotion } from "framer-motion";
import { motionTokens, searchMotion } from "@/lib/motion";
import { RouteCard } from "@/components/route-card";
import { CityMarquee } from "@/components/city-marquee";
import { useBookingTransition } from "@/components/booking-motion";
import { ThemeToggle } from "@/components/global-polish";
import { profileQuery } from "@/lib/auth";
import { parseTrip } from "@/lib/trip";
import { findStation, popularStationNames, stationCodeFor, stationLabel, stationSearchQuery, stationSuggestions, type Station } from "@/lib/railway";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { from?: string; to?: string; date?: string } => ({
    ...(typeof search["from"] === "string" && { from: search["from"].slice(0, 100) }),
    ...(typeof search["to"] === "string" && { to: search["to"].slice(0, 100) }),
    ...(typeof search["date"] === "string" && { date: search["date"] }),
  }),
  head: () => ({ links: [
    { rel: "preload", as: "image", href: heroJpg, type: "image/jpeg", fetchPriority: "high" },
  ], meta: [
    { title: "Rail Daddy — Find train routes & book tickets across India" },
    { name: "description", content: "Find scheduled trains across India by departure station, arrival station, and travel date." },
    { property: "og:title", content: "Rail Daddy — Find train routes & book tickets across India" },
    { property: "og:description", content: "Search Indian train schedules by route and travel date." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { property: "og:image", content: heroJpg },
    { name: "twitter:image", content: heroJpg },
  ] }),
  component: Index,
});

const popularRoutes = [
  { from: "New Delhi", to: "Jaipur", fromLabel: "Delhi", toLabel: "Jaipur" },
  { from: "Mumbai Central", to: "Goa", fromLabel: "Mumbai", toLabel: "Goa" },
  { from: "New Delhi", to: "Varanasi", fromLabel: "Delhi", toLabel: "Varanasi" },
  { from: "Bengaluru", to: "Chennai Central", fromLabel: "Bengaluru", toLabel: "Chennai" },
  { from: "New Delhi", to: "Shimla", fromLabel: "Delhi", toLabel: "Shimla" },
];
const marqueeCities = [
  ["DELHI", "New Delhi"],
  ["JAIPUR", "Jaipur"],
  ["GOA", "Goa"],
  ["VARANASI", "Varanasi"],
  ["SHIMLA", "Shimla"],
  ["MUMBAI", "Mumbai Central"],
  ["KOCHI", "Kochi"],
  ["DARJEELING", "Darjeeling"],
  ["UDAIPUR", "Udaipur"],
] as const;

const shortName = (name: string) => findStation(name)?.city ?? name;

/** True on phone widths, where the search card switches to its compact row layout. */
function useCompactSearchCard() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const sync = () => setCompact(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return compact;
}

type StationFieldProps = {
  id: "source" | "destination";
  label: string;
  hint: string;
  error?: string | undefined;
  placeholder: string;
  compactPlaceholder: string;
  compact: boolean;
  value: string;
  recent: string[];
  onChange: (value: string) => void;
};

function StationField({ id, label, hint, error, placeholder, compactPlaceholder, compact, value, recent, onChange }: StationFieldProps) {
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const field = fieldRef.current;
    const viewport = window.visualViewport;
    if (!open || !field || !viewport) return;
    // Keep the fixed picker within the area above the on-screen keyboard.
    const syncViewport = () => {
      field.style.setProperty("--station-sheet-height", `${viewport.height}px`);
      field.style.setProperty("--station-sheet-top", `${viewport.offsetTop}px`);
    };
    syncViewport();
    viewport.addEventListener("resize", syncViewport);
    viewport.addEventListener("scroll", syncViewport);
    return () => {
      viewport.removeEventListener("resize", syncViewport);
      viewport.removeEventListener("scroll", syncViewport);
      field.style.removeProperty("--station-sheet-height");
      field.style.removeProperty("--station-sheet-top");
    };
  }, [open]);
  const reduced = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(-1);
  const query = value.trim();
  const keyword = open && !/ \([A-Z0-9]{1,10}\)$/.test(query) ? query : "";
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedKeyword(keyword), 300);
    return () => window.clearTimeout(timeout);
  }, [keyword]);
  const lookupEnabled = keyword.length >= 2 && keyword === debouncedKeyword;
  const lookup = useQuery({ ...stationSearchQuery(debouncedKeyword.toLowerCase()), enabled: lookupEnabled });
  const groups: { title: string; items: Station[] }[] = [];
  if (keyword) {
    const found = stationSuggestions(keyword, lookupEnabled ? lookup.data : undefined);
    if (found.length) groups.push({ title: "Matching stations", items: found });
  } else {
    const recentItems = recent.flatMap((text) => {
      const code = stationCodeFor(text);
      return code ? [findStation(text) ?? { code, name: text.replace(/ \([A-Z0-9]{1,10}\)$/, ""), city: null }] : [];
    }).slice(0, 3);
    if (recentItems.length) groups.push({ title: "Recent", items: recentItems });
    groups.push({ title: "Popular", items: popularStationNames.filter((n) => !recent.includes(n)).map(findStation).filter((s): s is Station => !!s) });
  }
  const flat = groups.flatMap((g) => g.items);
  const highlightedIndex = activeIndex < flat.length ? activeIndex : -1;
  const lookupStatus = keyword.length < 2 || flat.length > 0 ? "" :
    !lookupEnabled || lookup.isPending ? "Searching stations…" :
      lookup.isError ? "Station suggestions unavailable. You can enter a station code." : "No matching stations.";

  function choose(station: Station) {
    onChange(stationLabel(station));
    if (window.matchMedia("(max-width: 760px)").matches) fieldRef.current?.querySelector("input")?.blur();
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, flat.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && open && flat.length > 0 && (highlightedIndex >= 0 || !stationCodeFor(value))) {
      event.preventDefault();
      const station = flat[Math.max(highlightedIndex, 0)];
      if (station) choose(station);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  let running = -1;
  return (
    <div ref={fieldRef} className={`station-field ${id}-field pop${error ? " field-invalid" : ""}${open ? " sheet-open" : ""}`}>
      <span className="field-focus-glow" aria-hidden="true" /><label htmlFor={id}><MapPin size={15} /> {label}</label>
      <span className="row-pin" aria-hidden="true"><MapPin size={16} /></span>
      <button type="button" className="sheet-close" aria-label="Close station search" onMouseDown={(event) => event.preventDefault()} onClick={() => { setOpen(false); (document.activeElement as HTMLElement | null)?.blur(); }}><X size={20} /></button>
      <input
        id={id}
        maxLength={100}
        value={value}
        onChange={(event) => { onChange(event.target.value); setOpen(true); setActiveIndex(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={handleKeyDown}
        aria-label={label}
        placeholder={compact ? compactPlaceholder : placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && flat.length > 0}
        aria-controls={`${id}-suggestions`}
        aria-activedescendant={open && highlightedIndex >= 0 ? `${id}-option-${highlightedIndex}` : undefined}
        aria-invalid={!!error}
        aria-describedby={`${id}-hint`}
      />
      <span id={`${id}-hint`} className={error ? "field-hint search-field-error" : "field-hint"}>
        {error ? <><AlertCircle size={14} aria-hidden="true" />{error}</> : stationCodeFor(value) ?? hint}
      </span>
      {open && lookupStatus && <div className="station-suggestions suggestion-group" role="status">{lookupStatus}</div>}
      <AnimatePresence>
      {open && flat.length > 0 && (
        <motion.div key="suggestions" data-motion-owned="true" initial={{ scaleY: reduced ? 1 : 0.85, opacity: reduced ? 1 : 0 }} animate={{ scaleY: 1, opacity: 1 }} exit={{ scaleY: reduced ? 1 : 0.95, opacity: 0 }} transition={{ duration: reduced ? 0 : motionTokens.duration.micro, ease: motionTokens.easing.entrance }} id={`${id}-suggestions`} className="station-suggestions" role="listbox"><LayoutGroup id={`${id}-suggestions`}>
          {groups.map((group) => (
            <div key={group.title} role="group" aria-label={group.title || "Stations"}>
              {group.title && <div className="suggestion-group">{group.title === "Recent" ? <History size={12} /> : null}{group.title}</div>}
              {group.items.map((station) => {
                running += 1;
                const index = running;
                return (
                  <motion.div key={station.code} className="suggestion-motion-row" initial={{ y: reduced ? 0 : -6, opacity: reduced ? 1 : 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: reduced ? 0 : motionTokens.duration.micro, delay: reduced ? 0 : index * searchMotion.suggestionStagger }}>
                  <Button
                    id={`${id}-option-${index}`}
                    key={station.code}
                    variant="ghost"
                    type="button"
                    role="option"
                    aria-selected={activeIndex === index}
                    className={activeIndex === index ? "active" : ""}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(station)}
                  >
                    {activeIndex === index && <SelectionMark id="station-highlight" />}<MapPin size={14} /><span className="suggestion-name">{station.name}<small>{station.city}</small></span><span className="suggestion-code">{station.code}</span>
                  </Button></motion.div>
                );
              })}
            </div>
          ))}
        </LayoutGroup></motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

function Index() {
  const editSearch = Route.useSearch();
  const { data: profile } = useQuery(profileQuery);
  const { begin } = useBookingTransition();
  const homeRef = useRef<HTMLDivElement>(null);
  useHomeEntrance(homeRef);
  useHeroDepth(homeRef);
  const heroRef = useRef<HTMLImageElement>(null);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const saved = window.localStorage.getItem("rd-theme");
    if (saved === "dark" || saved === "light") setTheme(saved);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("rd-theme", theme);
  }, [theme]);
  useEffect(() => {
    const image = heroRef.current;
    if (image?.complete && image.naturalWidth > 0) setHeroLoaded(true);
  }, []);
  const [source, setSource] = useState(editSearch.from ?? "");
  const [destination, setDestination] = useState(editSearch.to ?? "");
  const compactCard = useCompactSearchCard();
  const today = startOfDay(new Date());
  const tomorrow = startOfDay(addDays(new Date(), 1));
  const [date, setDate] = useState<Date | undefined>(() => {
    const saved = parseISO(editSearch.date ?? "");
    return isValid(saved) && saved >= today ? saved : tomorrow;
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [cardMode, setCardMode] = useState<"search" | "ai">("search");
  const [askText, setAskText] = useState("");
  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const closeCalendar = useCallback(() => setCalendarOpen(false), []);
  const [dialog, setDialog] = useState<"ai" | "about" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [swapTurns, setSwapTurns] = useState(0);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [ctaFloating, setCtaFloating] = useState(false);
  useEffect(() => {
    const controls = homeRef.current?.querySelector(".booking-console");
    if (!controls) return;
    const observer = new IntersectionObserver((entries) => { const entry = entries[0]; if (entry) setCtaFloating(!entry.isIntersecting); }, { threshold: 0 });
    observer.observe(controls);
    return () => observer.disconnect();
  }, []);
  const submittingRef = useRef(false);
  const reduced = useReducedMotion();
  const { swapNames, leaveSearch } = useSearchMicroMotion(homeRef, swapTurns, validationAttempt);
  const [recent, setRecent] = useState<string[]>([]);
  const [lastSearch, setLastSearch] = useState<{ from: string; to: string; date: string } | null>(null);
  useEffect(() => {
    try {
      const r = JSON.parse(window.localStorage.getItem("rd-recent-stations") ?? "[]");
      if (Array.isArray(r)) setRecent(r.filter((x) => typeof x === "string").slice(0, 5));
      const l = JSON.parse(window.localStorage.getItem("rd-last-search") ?? "null");
      if (l && typeof l.from === "string" && typeof l.to === "string" && typeof l.date === "string") setLastSearch(l);
    } catch { /* ignore corrupt storage */ }
  }, []);
  const navigate = useNavigate();
  const from = stationCodeFor(source);
  const to = stationCodeFor(destination);
  const problems = {
    source: from ? "" : "Choose a departure station or enter its code.",
    destination: !to ? "Choose an arrival station or enter its code." : from === to ? "Choose a different arrival station." : "",
    date: date ? "" : "Choose a travel date.",
  };
  const fieldErrors = validationAttempt > 0 ? problems : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!from || !to || problems.destination || !date) {
      setValidationAttempt(attempt => attempt + 1);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    const nextRecent = [destination.trim(), source.trim(), ...recent.filter((r) => r !== source.trim() && r !== destination.trim())].slice(0, 5);
    setRecent(nextRecent);
    const search = { from: source.trim(), to: destination.trim(), date: format(date, "yyyy-MM-dd") };
    try { window.localStorage.setItem("rd-recent-stations", JSON.stringify(nextRecent)); window.localStorage.setItem("rd-last-search", JSON.stringify(search)); } catch { /* storage unavailable */ }
    const tripSearch = parseTrip({ from, to, date: search.date });
    await leaveSearch();
    const consoleElement = homeRef.current?.querySelector<HTMLElement>('.booking-console');
    if (consoleElement) {
      begin(consoleElement, tripSearch);
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }
    try {
      await navigate({ to: "/trains", search: tripSearch });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div ref={homeRef} className={`railway-app${ctaFloating ? " cta-floating" : ""}`} data-home-entrance="pending">
      <div className="hero-dark">
      <header className="site-header reveal" style={{ ["--d" as string]: "0ms" }}>
        <a href="/" className="wordmark" aria-label="Rail Daddy home"><span className="wordmark-type" aria-hidden="true">RAIL <span className="wordmark-daddy">D<span className="wordmark-wink">A</span>DDY</span><span className="wordmark-stop">.</span></span></a>
        <nav aria-label="Main navigation"><Button variant="nav" className="active" onClick={() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "center" })}>Find a train</Button><Button variant="nav" onClick={() => setDialog("about")}>Why rail? <ArrowUpRight size={13} /></Button><Button variant="nav" asChild><Link to={profile ? "/account" : "/login"}>{profile ? "Account" : "Sign in"}</Link></Button></nav>
        <div className="header-actions">
          <ThemeToggle theme={theme} onChange={setTheme} />
          <Button variant="travel" className="ai-cta" onClick={() => setDialog("ai")}>Ask Daddy AI <ArrowUpRight size={14} /><span className="ai-tip" role="tooltip">Ask: best train to Goa this weekend</span></Button>
          <button type="button" className="ai-icon-btn" aria-label="Ask Daddy AI" onClick={() => setDialog("ai")}><Sparkles size={16} aria-hidden="true" /><span>Ask Daddy</span></button>
          <button type="button" className="menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}><Menu size={20} /></button>
          {menuOpen && (
            <div className="mobile-menu" role="menu" aria-label="Site menu">
              <Button variant="nav" role="menuitem" onClick={() => { setMenuOpen(false); document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Find a train</Button>
              <Button variant="nav" role="menuitem" onClick={() => { setMenuOpen(false); setDialog("about"); }}>Why rail? <ArrowUpRight size={13} /></Button>
              <Button variant="nav" role="menuitem" onClick={() => { setMenuOpen(false); setDialog("ai"); }}>Ask Daddy AI <ArrowUpRight size={13} /></Button>
              <Button variant="nav" asChild><Link role="menuitem" to={profile ? "/account" : "/login"}>{profile ? "Account" : "Sign in"}</Link></Button>
              <div className="mobile-menu-theme" role="group" aria-label="Theme">
                <span>Theme</span>
                <ThemeToggle theme={theme} onChange={setTheme} />
              </div>
            </div>
          )}
        </div>
      </header>

      <main>
        <section className="journey-stage" aria-label="Find your train">
          <div className={`stage-parallax${heroLoaded ? " hero-loaded" : ""}`} aria-hidden="true">
            <div className="hero-photo-depth">
              <img
                ref={heroRef}
                src={heroJpg}
                width={1920}
                height={1088}
                alt=""
                className="lights-backdrop hero-photo"
                fetchPriority="high"
                decoding="async"
                onLoad={() => setHeroLoaded(true)}
              />
            </div>
          </div>
          <div className="stage-shade" />
          <HeroAtmosphere />

          <div className="hero-content">
            <div className="hero-eyebrow reveal" style={{ ["--d" as string]: "100ms" }}><span className="status-dot" /> YOUR ROUTE. YOUR SEAT.</div>
            <h1 aria-label="REACH YOUR DESTINATION."><span className="line" aria-hidden="true"><span className="headline-mask"><span className="headline-word">REACH</span></span>{" "}<span className="headline-mask"><span className="headline-word">YOUR</span></span>{" "}<br className="h1-break" /><span className="headline-mask destination-mask"><span className="headline-word h1-accent">DESTINATION.</span><span className="destination-underline" /></span></span><span className="headline-star" aria-hidden="true">✳</span></h1>
            <p className="hero-subhead reveal" style={{ ["--d" as string]: "400ms" }}>Compare direct trains and find connections when you need to change along the way.</p>
          </div>

          <div className="booking-area" id="booking">
            <div className="booking-intro reveal" style={{ ["--d" as string]: "550ms" }}><span><span className="mini-track" /> Start with the route. We'll find the trains.</span>{lastSearch ? <button type="button" className="last-search" aria-label={`Repeat last search: ${shortName(lastSearch.from)} to ${shortName(lastSearch.to)}`} onClick={() => { setSource(lastSearch.from); setDestination(lastSearch.to); const d = parseISO(lastSearch.date); if (!Number.isNaN(d.getTime()) && d >= startOfDay(new Date())) setDate(startOfDay(d)); }}><History size={14} aria-hidden="true" /><span className="last-search-label">Last search</span> {shortName(lastSearch.from)} to {shortName(lastSearch.to)}{lastSearch.date && !Number.isNaN(parseISO(lastSearch.date).getTime()) ? `, ${format(parseISO(lastSearch.date), "EEE")}` : ""}</button> : <span className="booking-step">01 <span>/ ROUTE BASICS</span></span>}</div>
            <form onSubmit={submit} data-mode={cardMode} className={`booking-console${submitting ? " search-submitting" : ""}`} aria-busy={submitting}>
              <span className="booking-landing-surface" aria-hidden="true" />
              <span className="booking-landing-shadow" aria-hidden="true" />
              <div className="mode-switch" role="tablist" aria-label="Search mode">
                {(["search", "ai"] as const).map((m) => (
                  <button key={m} type="button" role="tab" aria-selected={cardMode === m} className={cardMode === m ? "on" : ""} onClick={() => setCardMode(m)}>
                    {cardMode === m && <motion.span layoutId="mode-switch-pill" className="mode-switch-pill" transition={{ type: "spring", stiffness: 300, damping: 24 }} />}
                    <span className="mode-switch-label">{m === "ai" && <Sparkles size={15} aria-hidden="true" />}{m === "search" ? "Search trains" : "Ask Daddy"}</span>
                  </button>
                ))}
              </div>
              {cardMode === "ai" && (
                <div className="ask-pane" role="tabpanel" aria-label="Ask Daddy">
                  <div className="ask-box">
                    <textarea aria-label="Ask Daddy" value={askText} onChange={(e) => setAskText(e.target.value)} maxLength={600} placeholder="Ask about train connections or how to plan your trip" rows={4} />
                    <div className="ask-actions">
                      <button type="button" className="ask-send" aria-label="Open Ask Daddy AI" onClick={() => setDialog("ai")}><Send size={17} aria-hidden="true" /></button>
                    </div>
                  </div>
                  <div className="ask-chips">
                    {["How do I find a connection?", "Can I check seats and fares?", "Do I need separate tickets?"].map((c) => (
                      <button key={c} type="button" onClick={() => setAskText(c)}>{c}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="booking-form">
              <div className="route-block">
              <StationField id="source" label="From" hint="City, station or code" recent={recent} placeholder="Boarding station" compactPlaceholder="From" compact={compactCard} value={source} error={fieldErrors?.source} onChange={setSource} />
              <Button variant="swap" size="icon" type="button" aria-label="Swap start and destination" title="Swap start and destination" onClick={() => { swapNames(); setSource(destination); setDestination(source); setSwapTurns((t) => t + 1); }}><span className="swap-glyph"><ArrowDownUp size={18} /></span></Button>
              <StationField id="destination" label="To" hint="City, station or code" recent={recent} placeholder="Destination city" compactPlaceholder="To" compact={compactCard} value={destination} error={fieldErrors?.destination} onChange={setDestination} />
              </div>
              <div className="date-row">
              <Button ref={dateButtonRef} variant="date" type="button" aria-label={date ? `Travel date, ${format(date, "EEEE, d MMMM yyyy")}` : "Travel date"}
                aria-haspopup="dialog" aria-expanded={calendarOpen} aria-invalid={!!fieldErrors?.date} aria-describedby={fieldErrors?.date ? "date-error" : undefined}
                className={`${fieldErrors?.date ? "field-invalid" : ""} ${calendarOpen ? "date-open" : ""}`.trim()} onClick={() => setCalendarOpen((open) => !open)}>
                <span className="field-focus-glow" aria-hidden="true" />
                <span className="field-label"><CalendarDays size={15} /> Date</span>
                <span className="date-value">{date ? format(date, "dd MMM yyyy") : "Pick a date"}</span>
                <span className="date-value-short"><CalendarDays size={16} aria-hidden="true" />{date ? format(date, "EEE, d MMM") : "Pick a date"}</span>
                {fieldErrors?.date
                  ? <span id="date-error" className="field-hint search-field-error"><AlertCircle size={14} aria-hidden="true" />{fieldErrors.date}</span>
                  : <span className="field-hint">{date ? format(date, "EEEE") : "Open the calendar"}</span>}
                <ChevronDown className="date-chevron" size={16} aria-hidden="true" />
              </Button>
              <span className="date-quick" role="group" aria-label="Quick travel dates">
                <button type="button" className={date && isSameDay(date, today) ? "on" : ""} aria-pressed={!!date && isSameDay(date, today)} onClick={() => setDate(today)}>Today</button>
                <button type="button" className={date && isSameDay(date, tomorrow) ? "on" : ""} aria-pressed={!!date && isSameDay(date, tomorrow)} onClick={() => setDate(tomorrow)}>Tomorrow</button>
              </span>
              </div>
              </div>
             <span className="sr-only" role="status">{fieldErrors && Object.values(fieldErrors).filter(Boolean).join(" ")}</span>
             <div className="booking-controls reveal" style={{ ["--d" as string]: "870ms" }}>
               <SearchAction busy={submitting} />
            </div>
            </form>
          </div>

        </section>
      </main>
      </div>
      <section className="content-light" aria-label="Popular routes and destinations">
          <div className="popular-routes reveal" style={{ ["--d" as string]: "1080ms" }}>
            <div className="routes-head"><span className="routes-label">Popular routes</span><span className="routes-sub">Tap one — it fills the form</span></div>
            <div className="routes-row">
              {popularRoutes.map((route, index) => (
                <RouteCard key={route.from + route.to} route={{ ...route, note: `${stationCodeFor(route.from)} → ${stationCodeFor(route.to)}` }} index={index} onChoose={() => { setSource(route.from); setDestination(route.to); }} />
              ))}
            </div>
          </div>
        <CityMarquee cities={marqueeCities} destination={destination} onChoose={setDestination} />
      <footer className="site-footer">
        <div className="footer-top">
          <div className="footer-brand"><span className="footer-wordmark">RAIL DADDY<span className="footer-stop">.</span></span><p className="footer-tagline">Trips worth the ride.</p></div>
          <nav className="footer-links" aria-label="About Rail Daddy">
            <Link to="/info/$topic" params={{ topic: "about" }}>About</Link>
            <Link to="/info/$topic" params={{ topic: "help" }}>Help</Link>
            <Link to="/info/$topic" params={{ topic: "cancellation" }}>Cancellation and refund policy</Link>
            <Link to="/info/$topic" params={{ topic: "privacy" }}>Privacy</Link>
            <Link to="/info/$topic" params={{ topic: "contact" }}>Contact</Link>
          </nav>
        </div>
        <p className="footer-note">Rail Daddy is a booking assistant. Tickets are issued through authorized Indian Railways channels.</p>
        <div className="footer-bottom">
          <span className="footer-copy">© {new Date().getFullYear()} Rail Daddy</span>
          <div className="trust-row"><span className="trust-badge"><ShieldCheck size={15} aria-hidden="true" /> Secure payment</span><span className="trust-badge"><RotateCcw size={15} aria-hidden="true" /> Refund policy</span></div>
          <a className="scenic-link" href="#booking">Take the scenic route <ArrowUpRight size={14} aria-hidden="true" /></a>
        </div>
      </footer>
      </section>
      <JourneyAssistant open={dialog === "ai"} onOpenChange={(open) => setDialog(open ? "ai" : null)}
        initialQuestion={askText} trip={from && to && from !== to && date ? { source: from, destination: to, date: format(date, "yyyy-MM-dd") } : undefined} />
      <Dialog open={dialog === "about"} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogContent className="railway-dialog">
          <DialogHeader>
            <div className="dialog-icon"><TrainFront /></div>
            <DialogTitle>Why travel by rail?</DialogTitle>
            <DialogDescription>Rail travel means no airport stress, more scenery and a journey that’s part of the holiday. Rail Daddy finds the right train for you.</DialogDescription>
          </DialogHeader>
          <Button variant="travel" onClick={() => setDialog(null)}>Got it<X size={16} /></Button>
        </DialogContent>
      </Dialog>
      <DatePanel open={calendarOpen} anchor={dateButtonRef} value={date} onClose={closeCalendar} onSelect={setDate} />
      <div className="cta-fade" aria-hidden="true" />
    </div>
  );
}
