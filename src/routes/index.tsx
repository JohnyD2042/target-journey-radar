import { fitYRange } from "@/lib/map-view";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FlightChart, ZoneGlyph, ZONE_ICON, ZONE_TEXT } from "@/components/FlightChart";
import { BasketTag, SideTag, IdeaPath } from "@/components/IdeaPath";
import { Boards } from "@/components/Boards";
import { NewsTicker } from "@/components/NewsTicker";
import { IDEA_ICON } from "@/components/board-icons";
import { buildFeed, type FeedEvent } from "@/lib/feed";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TabloLogo } from "@/components/TabloLogo";
import { ZONES, applyFilters, fetchFlight, ideaTitle, isBasket, isoLabel, moscowTime, byUpside, UPSIDE_STEPS, zoneOf, ANALYST_TYPES, KINDS, type AnalystType, type Kind, type Book, type Idea, type Period, type Zone } from "@/lib/ideas";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Табло — инвестидеи аналитиков на пути к цели" },
      { name: "description", content: "Визуальный радар инвестиционных идей аналитиков: доходность и пройденный путь до целевой цены." },
      { property: "og:title", content: "Табло — инвестидеи аналитиков на пути к цели" },
      { property: "og:description", content: "Радар инвестидей аналитиков: каждая идея — самолёт на маршруте к цели." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const PERIODS: [Period, string][] = [["all", "За всё время"], ["month", "Месяц"], ["week", "Неделя"]];
const BOOKS: [Book, string][] = [["all", "Все"], ["active", "Активные"], ["closed", "Закрытые"]];
const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
const money = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 4 });

function Seg<T extends string>({ items, value, onChange, counts }: { items: [T, string][]; value: T; onChange: (v: T) => void; counts?: Record<T, number> | undefined }) {
  return (
    <div className="flex rounded-md border bg-card p-0.5 text-sm">
      {items.map(([k, l]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`flex-1 whitespace-nowrap rounded px-3 py-2 md:py-1.5 xl:px-2 transition-colors ${value === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {l} <span className="ml-1 font-mono text-[11px] opacity-70">{counts?.[k] ?? "·"}</span>
        </button>
      ))}
    </div>
  );
}

/** Compact "Апсайд от X" badge in the Status label row; the discrete slider lives in a popover so filters never shift. */
function UpsidePicker({ value, counts, onChange }: { value: number; counts: number[]; onChange: (v: number) => void }) {
  const idx = Math.max(0, UPSIDE_STEPS.indexOf(value as (typeof UPSIDE_STEPS)[number]));
  const label = (s: number) => (s === 0 ? "0" : s === 100 ? "100%+" : `${s}%`);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Фильтр по апсайду" className={`inline-flex h-4 items-center gap-1 rounded-full border px-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${value ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:border-primary/60 hover:text-foreground"}`}>
          Апсайд {value ? `от ${label(value)}` : "любой"}
          {value ? <span className="opacity-70">· {counts[idx] ?? 0}</span> : null}
          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4">
        <div className="mb-3 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-wider">
          <span className="text-muted-foreground">Апсайд от</span>
          <span><span className="font-semibold text-primary">{value ? label(value) : "любой"}</span> <span className="text-muted-foreground">· {counts[idx] ?? 0} идей</span></span>
        </div>
        <div role="radiogroup" aria-label="Минимальный апсайд" className="relative px-2">
          <div className="absolute left-2 right-2 top-[8px] h-1 rounded-full bg-zinc-600" />
          <div className="absolute left-2 top-[8px] h-1 rounded-full bg-primary transition-all" style={{ width: `calc((100% - 1rem) * ${idx / (UPSIDE_STEPS.length - 1)})` }} />
          <div className="relative flex justify-between">
            {UPSIDE_STEPS.map((s, k) => (
              <button key={s} type="button" role="radio" aria-checked={k === idx} aria-label={`Апсайд от ${label(s)}`} onClick={() => onChange(s)}
                className="-mx-2 flex w-8 flex-col items-center gap-1.5 focus-visible:outline-2">
                <span className="flex h-5 w-5 items-center justify-center"><span className={`block rounded-full transition-all ${k === idx ? "h-5 w-5 border-2 border-background bg-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_35%,transparent)]" : k < idx ? "h-2.5 w-2.5 bg-primary" : "h-2.5 w-2.5 border-2 border-zinc-400 bg-zinc-800"}`} /></span>
                <span className={`font-mono text-[10px] ${k === idx ? "text-primary" : "text-muted-foreground"}`}>{label(s)}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[10px] leading-snug text-muted-foreground">При пороге выше 0 идеи без целевой цены скрываются.</p>
      </PopoverContent>
    </Popover>
  );
}

function Index() {
  const [period, setPeriod] = useState<Period>("all");
  const [book, setBook] = useState<Book>("all");
  const [minUp, setMinUp] = useState(0);
  const [analyst, setAnalyst] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [tq, setTq] = useState("");
  const [tFocus, setTFocus] = useState(false);
  const [zone, setZone] = useState<Zone | null>(null);
  const [sel, setSel] = useState<Idea | null>(null);
  const mapStart = useRef<HTMLDivElement>(null);
  const [boardPick, setBoardPick] = useState<Idea | null>(null);
  const [mapVisit, setMapVisit] = useState(0);
  // clicking empty map space closes the card after a short beat; picking a plane cancels the pending close
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPicked = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setSel(null);
    setBoardPick(null);
  };
  const pickIdea = (i: Idea) => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } setSel(i); };
  const pickBoardIdea = (i: Idea) => {
    setPeriod("all");
    setBook("all");
    setTicker("");
    setTq("");
    setAnalyst(null);
    setQ("");
    setKind("");
    setAtype("");
    setSide(null);
    setMinUp(0);
    setFocus(false);
    setTFocus(false);
    pickIdea(i);
    setBoardPick(i);
    setZone(null);
    setMapVisit((v) => v + 1);
    mapStart.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  const scheduleClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => { closeTimer.current = null; setSel(null); setBoardPick(null); }, 500); };

  // the API is asked only after an exact instrument is chosen: list click, Enter, or an exactly typed ticker/name
  const [ticker, setTicker] = useState("");
  const [kind, setKind] = useState<Kind | "">("");
  const toggleKind = (k: Kind) => { clearPicked(); setKind(kind === k ? "" : k); };
  // analyst kind: institutional -> Профучастники, finfluencer -> Финфлюенсеры
  const [atype, setAtype] = useState<AnalystType | "">("");
  const toggleAtype = (t: AnalystType) => { clearPicked(); setAtype(atype === t ? "" : t); };
  const pickBoardAnalyst = (name: string, scope: Period = "all") => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setSel(null);
    setBoardPick(null);
    setPeriod(scope);
    setBook("all");
    setTicker("");
    setTq("");
    setKind("");
    setAtype("");
    setSide(null);
    setMinUp(0);
    setAnalyst(name);
    setQ("");
    setFocus(false);
    setTFocus(false);
    setZone(null);
    setMapVisit((v) => v + 1);
    mapStart.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  // any header filter change drops the secondary zone highlight: the whole map shows again
  useEffect(() => { setZone(null); }, [period, book, analyst, ticker, kind, atype]);
  const commitTicker = (v: string) => { clearPicked(); setTq(v); setTicker(v.trim()); };
  const changePeriod = (v: Period) => { clearPicked(); setPeriod(v); };
  const changeBook = (v: Book) => { clearPicked(); setBook(v); setMinUp(0); };
  const changeMinUp = (v: number) => { clearPicked(); setZone(null); setMinUp(v); };
  const selectAnalyst = (name: string | null) => { clearPicked(); setAnalyst(name); setQ(""); };
  // after any dropdown pick: hide the list and release DOM focus so the next click reopens it
  const blurActive = () => (document.activeElement as HTMLElement | null)?.blur?.();
  const pickBoardTicker = (value: string, status: Book, scope: Period = "all") => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setSel(null);
    setBoardPick(null);
    setPeriod(scope);
    setBook(status);
    setAnalyst(null);
    setQ("");
    setKind("");
    setAtype("");
    setSide(null);
    setMinUp(0);
    commitTicker(value);
    setFocus(false);
    setTFocus(false);
    setZone(null);
    setMapVisit((v) => v + 1);
    mapStart.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  const filters = { period, book, analyst: analyst ?? "", ticker, kind, atype };
  // one full download, refreshed at most every 15 minutes; all filtering is local
  const { data: full, isError, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["flight", "full"],
    queryFn: () => fetchFlight({ period: "all", book: "all", analyst: "", ticker: "" }),
    placeholderData: keepPreviousData,
    staleTime: 15 * 60_000,
    refetchInterval: 15 * 60_000,
    refetchOnWindowFocus: false,
  });
  // ticker-tape snapshot: rebuilt at most every 12 hours
  const feedSnap = useRef<{ at: number; events: FeedEvent[] } | null>(null);
  const feed = useMemo(() => {
    if (!full) return [];
    const s = feedSnap.current;
    if (!s || Date.now() - s.at > 12 * 3_600_000) feedSnap.current = { at: Date.now(), events: buildFeed(full.ideas, full.asOf) };
    return feedSnap.current?.events ?? [];
  }, [full]);
  const data = useMemo(() => (full ? applyFilters(full, filters) : undefined), [full, period, book, analyst, ticker, kind, atype]);

  const ideas = data?.ideas ?? [];
  const [side, setSide] = useState<"лонг" | "шорт" | null>(null);
  // upside threshold exists only for active ideas; any other status means "no threshold"
  const up = book === "active" ? minUp : 0;
  const sided = useMemo(() => ideas.filter((i) => !side || i.strategy === side), [ideas, side]);
  const upCounts = useMemo(() => UPSIDE_STEPS.map((s) => sided.filter((i) => byUpside(i, s)).length), [sided]);
  // zone counters follow every map filter (side, upside) except the zone itself
  const zoneCounts = useMemo(() => {
    if (!data) return undefined;
    const c = { ...data.counts, cold: 0, liftoff: 0, cruise: 0, approach: 0, landed: 0 };
    for (const i of sided) if (byUpside(i, up)) c[i.stage]++;
    return c;
  }, [data, sided, up]);
  const shown = useMemo(() => {
    const filtered = ideas.filter((i) => (!zone || zoneOf(i) === zone) && (!side || i.strategy === side) && byUpside(i, up));
    return boardPick && !filtered.some((i) => i.id === boardPick.id) ? [...filtered, boardPick] : filtered;
  }, [ideas, zone, side, boardPick, up]);
  const yRange = useMemo(() => fitYRange(shown.map((i) => i.yieldPct), data?.yieldMin ?? 0, data?.yieldMax ?? 0), [shown, data]);
  const analysts = (data?.analysts ?? []).filter((a) => a.name.toLowerCase().includes(q.toLowerCase()));
  const tqn = tq.trim().toLowerCase();
  const instruments = (data?.instruments ?? []).filter((x) => !tqn || x.ticker.toLowerCase().includes(tqn) || x.name.toLowerCase().includes(tqn)).slice(0, 30);
  const exactHit = (text: string) => {
    const t = text.trim().toLowerCase();
    if (!t) return "";
    const hit = (data?.instruments ?? []).find((x) => x.ticker.toLowerCase() === t || x.name.toLowerCase() === t);
    return hit ? hit.ticker : "";
  };

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          
          <div>
            <h1 className="leading-none"><TabloLogo className="h-8 w-auto" /></h1>
            <p className="mt-1 text-xs text-muted-foreground">Инвестидеи аналитиков на маршруте к целевой цене</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Status asOf={data?.asOf} fetchedAt={dataUpdatedAt} isError={isError} />
          <a href="https://t.me/investidei_konkurs" target="_blank" rel="noopener noreferrer" aria-label="Комьюнити в Телеграме" title="Комьюнити в Телеграме" className="flex h-8 w-8 items-center justify-center rounded-full border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M21.9 4.3 18.7 19.4c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.3 13 1.5 11.5c-1-.3-1.1-1 .2-1.5L20.6 2.8c.9-.3 1.6.2 1.3 1.5Z" /></svg>
          </a>
        </div>
      </header>

      {/* Filters */}
      <div className="grid grid-cols-1 items-start gap-3 px-4 py-3 md:grid-cols-2 md:px-6 xl:grid-cols-[auto_auto_minmax(0,1fr)_minmax(0,1fr)] xl:gap-x-5">
       <div className="contents">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Дата старта идей</span>
          <Seg items={PERIODS} value={period} onChange={changePeriod} counts={data?.periods} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="flex h-4 items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Статус</span>
            {book === "active" && <UpsidePicker value={minUp} counts={upCounts} onChange={changeMinUp} />}
          </span>
          <Seg items={BOOKS} value={book} onChange={changeBook} counts={data?.counts} />
        </div>
       </div>
       <div className="contents">
        <div className="flex min-w-0 flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Аналитик</span>
        <div className="relative">
          <input
            value={analyst ?? q}
            onChange={(e) => { clearPicked(); setAnalyst(null); setQ(e.target.value); }}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            placeholder="Все аналитики — поиск…"
            className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          {analyst && (
            <button onClick={() => selectAnalyst(null)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground">✕</button>
          )}
          {focus && !analyst && (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover text-sm shadow-xl">
              <div className="border-b px-3 py-2">
                <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">── Тип аналитика ──</div>
                <div className="flex flex-wrap gap-1.5">
                  {ANALYST_TYPES.map(([k, l]) => (
                    <Annunciator key={k} label={l} count={data?.atypes?.[k] ?? 0} on={atype === k} onClick={() => { toggleAtype(k); setFocus(false); blurActive(); }} mouseDown />
                  ))}
                </div>
              </div>
              <button onMouseDown={() => { selectAnalyst(null); setFocus(false); blurActive(); }} className="flex w-full justify-between px-3 py-2 text-left text-muted-foreground hover:bg-accent">Все аналитики</button>
              {analysts.map((a) => (
                <button key={a.name} onMouseDown={() => { selectAnalyst(a.name); setFocus(false); blurActive(); }} className="flex w-full justify-between gap-2 px-3 py-2 text-left hover:bg-accent">
                  {a.name} <span className="font-mono text-xs text-muted-foreground">{a.count}</span>
                </button>
              ))}
              {!analysts.length && <div className="px-3 py-2 text-muted-foreground">Никого не нашли</div>}
            </div>
          )}
        </div>
        <Presets items={["СберИнвестиции"]} wide="Финам" selected={analyst ?? ""} onPick={selectAnalyst}>
          {analyst ? <Annunciator label={analyst} count={data?.ideas.length ?? 0} on onClick={() => selectAnalyst(null)} /> : <Annunciator label="Профучастники" count={data?.atypes?.institutional ?? 0} on={atype === "institutional"} onClick={() => toggleAtype("institutional")} />}
          {!analyst && atype && atype !== "institutional" && <Annunciator label={ANALYST_TYPES.find(([k]) => k === atype)![1]} count={data?.atypes?.[atype] ?? 0} on onClick={() => toggleAtype(atype)} />}
        </Presets>
        </div>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Инструмент</span>
          <div className="relative">
            <input
              value={tq}
              onChange={(e) => {
                const v = e.target.value;
                clearPicked();
                // editing the committed ticker (or erasing it) releases the ticker filter at once
                if (ticker && v.trim() !== ticker) setTicker("");
                setTq(v);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                commitTicker(instruments[0]?.ticker || exactHit(tq) || tq.trim());
                setTFocus(false);
                blurActive();
              }}
              onFocus={() => setTFocus(true)}
              onBlur={() => setTimeout(() => setTFocus(false), 150)}
              placeholder="Тикер или название…"
              className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            {tq && <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.preventDefault(); commitTicker(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground" aria-label="Очистить">✕</button>}
            {tFocus && (
              <div className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-md border bg-popover text-sm shadow-xl">
                <div className="border-b px-3 py-2">
                  <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">── Тип инструмента ──</div>
                  <div className="flex flex-wrap gap-1.5">
                    {KINDS.map(([k, l]) => (
                      <Annunciator key={k} label={l} count={data?.kinds?.[k] ?? 0} on={kind === k} onClick={() => { toggleKind(k); setTFocus(false); blurActive(); }} mouseDown />
                    ))}
                  </div>
                </div>
                {!instruments.length && <div className="px-3 py-2 text-muted-foreground">Ничего не нашли</div>}
                {instruments.map((x) => (
                  <button key={x.ticker} type="button" onMouseDown={() => { commitTicker(x.ticker); setTFocus(false); blurActive(); }} className="flex w-full justify-between gap-2 px-3 py-2 text-left hover:bg-accent">
                    <span className="min-w-0 truncate"><span className="font-mono font-semibold">{x.ticker}</span> <span className="text-muted-foreground">{x.name}</span></span>
                    <span className="font-mono text-xs text-muted-foreground">{x.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Presets items={["OZON", "Новатэк"]} wide="Яндекс" selected={ticker} onPick={(v) => commitTicker(exactHit(v) || v)}>
            {ticker ? <Annunciator label={ticker} count={data?.ideas.length ?? 0} on onClick={() => commitTicker("")} /> : <Annunciator label="Акции" count={data?.kinds?.stock ?? 0} on={kind === "stock"} onClick={() => toggleKind("stock")} />}
            {!ticker && kind && kind !== "stock" && <Annunciator label={KINDS.find(([k]) => k === kind)![1]} count={data?.kinds?.[kind] ?? 0} on onClick={() => toggleKind(kind)} />}
          </Presets>
        </label>
       </div>
      </div>

      {feed.length > 0 && <NewsTicker events={feed} onIdea={pickBoardIdea} onTicker={(t, scope) => pickBoardTicker(t, "all", scope)} onAnalyst={pickBoardAnalyst} onWeek={() => pickBoardTicker("", "all", "week")} />}
      {/* Scene */}
      <div className="flex flex-col pb-8 lg:flex-row">
        <div ref={mapStart} className="relative mb-4 p-0 lg:flex-1 min-[640px]:p-2 md:h-[680px] md:p-4">
          {/* the map itself keeps its own box; the direction keys below it get their own row */}
          <div className="relative h-[480px] md:absolute md:inset-0 md:h-auto">
          {data && shown.length > 0 ? (
            <FlightChart
              key={mapVisit}
              ideas={shown}
              yieldMin={yRange.yMin}
              yieldMax={yRange.yMax}
              zoneCounts={zoneCounts ?? data.counts}
              onSelect={pickIdea}
              onDeselect={scheduleClose}
              selectedId={sel?.id != null ? String(sel.id) : undefined}
              activeZone={zone}
              onZoneChange={(z) => { clearPicked(); setZone(zone === z ? null : z); }}
            />
          ) : (
            <div className="map-bg flex h-full w-full items-center justify-center text-sm text-muted-foreground min-[640px]:rounded-xl min-[640px]:border">
              {isError ? "Не удалось загрузить данные. Попробуйте обновить страницу." : data ? "По выбранным фильтрам идей нет" : "Загружаем идеи…"}
            </div>
          )}
          {isFetching && data && <div className="pointer-events-none absolute right-6 top-4 font-mono text-[10px] text-muted-foreground">обновление…</div>}
          {sel && <Card idea={sel} onClose={clearPicked} onOthers={(t) => pickBoardTicker(t, "all")} />}
          </div>
          <div className="z-10 mt-2 flex flex-wrap gap-2 px-4 font-mono text-xs md:absolute md:-bottom-4 md:left-6 md:mt-0 md:px-0">
            {(["лонг", "шорт"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={side === s} title={side === s ? "Показать все идеи" : `Показать только ${s}`}
                onClick={() => { clearPicked(); setZone(null); setSide(side === s ? null : s); }}
                className={`inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 font-semibold uppercase ${s === "лонг" ? "text-long" : "text-short"} ${side === s ? (s === "лонг" ? "border-long" : "border-short") : side ? "opacity-50" : ""}`}>
                <IDEA_ICON size={20} aria-hidden="true" /> {s === "лонг" ? "Long" : "Short"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Legend />
      {full && <Boards ideas={full.ideas} asOf={full.asOf} onPick={pickBoardIdea} onAnalystPick={pickBoardAnalyst} onTickerPick={pickBoardTicker} />}

    </div>
  );
}

/** cockpit annunciator: square key with a lamp, mono caps — an instrument-type mode, not a single ticker */
function Annunciator({ label, count, on, onClick, mouseDown }: { label: string; count: number; on: boolean; onClick: () => void; mouseDown?: boolean }) {
  const off = count === 0 && !on;
  const act = (e: React.MouseEvent) => { e.preventDefault(); onClick(); };
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={off}
      title={off ? "Идей этого типа пока нет" : undefined}
      onMouseDown={mouseDown ? act : (e) => e.preventDefault()}
      onClick={mouseDown ? undefined : act}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-[3px] border px-3 py-2 font-mono text-xs uppercase tracking-wider md:min-h-0 md:px-2.5 md:py-1.5 md:text-[11px] xl:tracking-normal transition-colors ${
        on ? "kind-on border-kind/60 text-kind" : off ? "cursor-not-allowed border-dashed opacity-40 text-muted-foreground" : "border-border bg-background text-muted-foreground hover:border-kind/60 hover:text-foreground"
      }`}
    >
      <span className={`h-2 w-2 rounded-[1px] ${on ? "bg-kind shadow-[0_0_6px_var(--kind)]" : "border border-muted-foreground/60"}`} />
      {label}
      <span className="opacity-60">{count}</span>
    </button>
  );
}

function Presets({ items, wide, selected = "", onPick, children }: { items: string[]; wide?: string; selected?: string; onPick: (v: string) => void; children?: React.ReactNode }) {
  // a selected name is never truncated: the longer it is, the fewer hints stay beside it
  const len = selected.length;
  const hide = len > 22 ? "hidden" : len > 12 ? "hidden md:inline-flex" : "";
  const same = (v: string) => !!selected && v.toLowerCase() === selected.toLowerCase();
  const chip = "min-h-9 rounded-full border bg-card px-3.5 py-2 text-sm md:min-h-0 md:px-3 md:py-1.5 md:text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground";
  return (
    <div className="flex flex-wrap items-center gap-2 md:gap-1.5">
      {children}
      {children && <span className={`${len > 22 ? "hidden" : ""} mx-0.5 h-4 w-px bg-border`} aria-hidden="true" />}
      {items.filter((v) => !same(v)).map((v) => (
        <button key={v} type="button" onClick={() => onPick(v)} className={`${hide} ${chip}`}>{v}</button>
      ))}
      {/* third hint only where there is room for it, and only beside a short selection */}
      {wide && !same(wide) && len <= 12 && <button type="button" onClick={() => onPick(wide)} className={`hidden md:inline-flex xl:hidden min-[1500px]:inline-flex ${chip}`}>{wide}</button>}
    </div>
  );
}

function Status({ asOf, fetchedAt, isError }: { asOf?: string | undefined; fetchedAt: number; isError: boolean }) {
  if (!asOf) return <span className="font-mono text-[11px] text-muted-foreground">{isError ? "Источник недоступен" : "Загрузка…"}</span>;
  // asOf is a calendar day: treat it as fresh until the end of that day (UTC)
  const dayEnd = Date.parse(asOf.slice(0, 10)) + 86_400_000;
  const stale = isError || Date.now() - (asOf.includes("T") ? Date.parse(asOf) : dayEnd) > 86_400_000;
  const time = moscowTime(fetchedAt);
  return (
    <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-[11px]" title={stale ? "Данные устарели более чем на сутки" : "Данные актуальны"}>
      <span className="relative flex h-2 w-2">
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${stale ? "bg-z5" : "bg-long"}`} />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${stale ? "bg-z5" : "bg-long"}`} />
      </span>
      <span className="font-medium">Invest-Idei</span>
      <span className="font-mono text-muted-foreground">обновлено {isoLabel(asOf)}{time && `, ${time}`}</span>
    </div>
  );
}


function Legend() {
  return (
    <details className="group mx-4 mb-4 rounded-xl border bg-card/60 md:mx-6">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 md:px-5 [&::-webkit-details-marker]:hidden">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Легенда карты</span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="border-t px-4 pb-4 pt-3 md:px-5 md:pb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {([1, 2, 3, 4, 5] as Zone[]).map((z) => (
          <div key={z} className="flex gap-3">
            <div className="shrink-0" style={{ color: `var(--z${z})` }}><ZoneGlyph rot={ZONE_ICON[z].rot} ground={ZONE_ICON[z].ground} flag={ZONE_ICON[z].flag} /></div>
            <div>
              <div className="text-xs font-semibold uppercase" style={{ color: `var(--z${z})` }}>{ZONES[z].name}</div>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{ZONE_TEXT[z]}</p>
            </div>
          </div>
        ))}
        <div className="flex gap-3">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-6 w-6 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M3 20 H21" strokeLinecap="round" opacity="0.5" />
            <path d="M12 20 V4" strokeDasharray="3 3" strokeLinecap="round" />
            <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
          </svg>
          <div>
            <div className="text-xs font-semibold uppercase text-foreground">Идеи без целевой цены</div>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              Целевая цена таких идей неизвестна, поэтому их путь не строится: идеи с положительной доходностью показываются на координате 0,5x по умолчанию.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <span className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-short" />
          <div>
            <div className="text-xs font-semibold uppercase text-primary">LIVE в воздухе</div>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">Сколько сейчас активных идей с положительной доходностью.</p>
          </div>
        </div>
        </div>
      </div>
    </details>
  );
}

function Card({ idea: i, onClose, onOthers }: { idea: Idea; onClose: () => void; onOthers?: (ticker: string) => void }) {
  const z = zoneOf(i);
  const r = i.yieldPct;
  const Col = ({ k, v, sub, align }: { k: string; v: string; sub: React.ReactNode; align: string }) => (
    <div className={`flex min-w-0 flex-col ${align}`}>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{k}</span>
      <span className="font-mono text-xs font-semibold">{v}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{sub}</span>
    </div>
  );
  return (
    <aside
      aria-label={`Идея ${i.ticker}`}
      className="fixed inset-x-2 bottom-2 z-30 rounded-xl border bg-popover/95 p-3 shadow-2xl backdrop-blur md:absolute md:inset-x-auto md:bottom-auto md:left-6 md:top-32 md:w-72 md:p-3"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {isBasket(i) ? (
            <>
              {/* portfolio: the whole ticker string on one plane, its title underneath */}
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="font-mono text-base font-semibold leading-tight">{i.ticker}</span>
                <SideTag idea={i} />
                <BasketTag />
              </div>
              <div className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{ideaTitle(i)}</div>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-base font-semibold leading-none">{i.ticker}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{i.name}</span>
              <SideTag idea={i} />
            </div>
          )}
          <div className="mt-1 truncate text-[11px] text-muted-foreground">{i.analyst}</div>
        </div>
        <button onClick={onClose} className="-mr-1 -mt-1 rounded p-1 text-xs text-muted-foreground hover:text-foreground" aria-label="Закрыть">✕</button>
      </div>
      <IdeaPath idea={i} />
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Col k="Вход" v={money(i.start)} sub={i.openedLabel} align="items-start text-left" />
        <Col
          k={i.status === "active" ? "Сейчас" : "Закрытие"}
          v={money(i.current)}
          sub={<>{i.status === "closed" && i.closedLabel ? `${i.closedLabel} · ` : ""}<span className={r >= 0 ? "text-long" : "text-short"}>{pct(r)}</span></>}
          align="items-center text-center"
        />
        <Col
          k="Цель"
          v={!i.noTarget && i.target != null ? money(i.target) : "—"}
          sub={!i.noTarget && i.expectedEndLabel ? i.expectedEndLabel : "—"}
          align="items-end text-right"
        />
      </div>
      {!!i.drivers?.length && (
        <div className="mt-2 border-t border-dashed pt-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Драйверы роста</div>
          <ul className="mt-1 space-y-0.5 text-[11px]">
            {i.drivers.map((d, n) => (
              <li key={n} className="flex gap-1.5"><span className="text-long">•</span>{d}</li>
            ))}
          </ul>
        </div>
      )}
      {i.url && (
        <a href={i.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[11px] text-primary hover:underline">
          Полная версия идеи ↗
        </a>
      )}
      <div className="mt-2 flex items-center gap-1.5 text-[10px]">
        {i.status === "active" && <span className="rounded-full px-1.5 py-px" style={{ color: `var(--z${z})`, border: `1px solid var(--z${z})` }}>{ZONES[z].name}</span>}
        {i.status === "active" && <span className="rounded-full border border-long/60 px-1.5 py-px text-long">Активна</span>}
        {/* single-ticker ideas only: same as searching the instrument */}
        {!isBasket(i) && onOthers && (
          <button type="button" onClick={() => onOthers(i.ticker)} className="rounded-full border border-foreground/70 px-1.5 py-px text-foreground transition-colors hover:bg-foreground hover:text-background">Другие идеи</button>
        )}
      </div>
      {i.status === "closed" && (
        <div
          aria-label="Статус: закрыта"
          className="pointer-events-none absolute bottom-3 right-3 -rotate-12 rounded-md border-2 border-double border-short px-2 py-0.5 font-mono text-sm font-bold uppercase tracking-[0.2em] text-short opacity-85 shadow-[0_0_0_2px_var(--short)_inset]"
          style={{ mixBlendMode: "screen" }}
        >
          Закрыта
        </div>
      )}
    </aside>
  );
}
