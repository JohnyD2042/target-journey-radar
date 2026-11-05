import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FlightChart, ZoneGlyph, ZONE_ICON, ZONE_TEXT } from "@/components/FlightChart";
import { BasketTag, SideTag, IdeaPath } from "@/components/IdeaPath";
import { WindowMark } from "@/components/WindowMark";
import { ZONES, applyFilters, fetchFlight, ideaTitle, isBasket, isoLabel, zoneOf, type Book, type Idea, type Period, type Zone } from "@/lib/ideas";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Монитор полётов — инвестидеи на пути к цели" },
      { name: "description", content: "Визуальный радар инвестиционных идей аналитиков: доходность и пройденный путь до целевой цены." },
      { property: "og:title", content: "Монитор полётов — инвестидеи на пути к цели" },
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
          className={`flex-1 whitespace-nowrap rounded px-3 py-1.5 transition-colors ${value === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {l} <span className="ml-1 font-mono text-[11px] opacity-70">{counts?.[k] ?? "·"}</span>
        </button>
      ))}
    </div>
  );
}

function Index() {
  const [period, setPeriod] = useState<Period>("all");
  const [book, setBook] = useState<Book>("all");
  const [analyst, setAnalyst] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [tq, setTq] = useState("");
  const [tFocus, setTFocus] = useState(false);
  const [zone, setZone] = useState<Zone | null>(null);
  const [sel, setSel] = useState<Idea | null>(null);

  // the API is asked only after an exact instrument is chosen: list click, Enter, or an exactly typed ticker/name
  const [ticker, setTicker] = useState("");
  // any header filter change drops the secondary zone highlight: the whole map shows again
  useEffect(() => { setZone(null); }, [period, book, analyst, ticker]);
  const commitTicker = (v: string) => { setTq(v); setTicker(v.trim()); };
  const filters = { period, book, analyst: analyst ?? "", ticker };
  // one full download, refreshed at most every 15 minutes; all filtering is local
  const { data: full, isError, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["flight", "full"],
    queryFn: () => fetchFlight({ period: "all", book: "all", analyst: "", ticker: "" }),
    placeholderData: keepPreviousData,
    staleTime: 15 * 60_000,
    refetchInterval: 15 * 60_000,
    refetchOnWindowFocus: false,
  });
  const data = useMemo(() => (full ? applyFilters(full, filters) : undefined), [full, period, book, analyst, ticker]);

  const ideas = data?.ideas ?? [];
  const shown = useMemo(() => (zone ? ideas.filter((i) => zoneOf(i) === zone) : ideas), [ideas, zone]);
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
          <WindowMark className="h-10 w-8 shrink-0" />
          <div>
            <h1 className="text-lg font-semibold leading-none tracking-tight">Монитор полётов</h1>
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
      <div className="flex flex-col gap-3 px-4 py-3 md:px-6">
       <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Дата старта идей</span>
          <Seg items={PERIODS} value={period} onChange={setPeriod} counts={data?.periods} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Статус</span>
          <Seg items={BOOKS} value={book} onChange={setBook} counts={data?.counts} />
        </div>
       </div>
       <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex flex-col gap-1 md:w-80">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Аналитик</span>
        <div className="relative">
          <input
            value={analyst ?? q}
            onChange={(e) => { setAnalyst(null); setQ(e.target.value); }}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            placeholder="Все аналитики — поиск…"
            className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          {analyst && (
            <button onClick={() => { setAnalyst(null); setQ(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground">✕</button>
          )}
          {focus && !analyst && (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover text-sm shadow-xl">
              <button onMouseDown={() => { setAnalyst(null); setQ(""); }} className="flex w-full justify-between px-3 py-2 text-left text-muted-foreground hover:bg-accent">Все аналитики</button>
              {analysts.map((a) => (
                <button key={a.name} onMouseDown={() => { setAnalyst(a.name); setQ(""); }} className="flex w-full justify-between gap-2 px-3 py-2 text-left hover:bg-accent">
                  {a.name} <span className="font-mono text-xs text-muted-foreground">{a.count}</span>
                </button>
              ))}
              {!analysts.length && <div className="px-3 py-2 text-muted-foreground">Никого не нашли</div>}
            </div>
          )}
        </div>
        <Presets items={["СберИнвестиции", "Финам"]} onPick={(v) => { setAnalyst(v); setQ(""); }} />
        </div>
        <label className="flex flex-col gap-1 md:w-80">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Акция / инструмент</span>
          <div className="relative">
            <input
              value={tq}
              onChange={(e) => setTq(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                commitTicker(instruments[0]?.ticker || exactHit(tq) || tq.trim());
                setTFocus(false);
              }}
              onFocus={() => setTFocus(true)}
              onBlur={() => setTimeout(() => setTFocus(false), 150)}
              placeholder="Тикер или название…"
              className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            {tq && <button onClick={() => commitTicker("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground" aria-label="Очистить">✕</button>}
            {tFocus && instruments.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover text-sm shadow-xl">
                {instruments.map((x) => (
                  <button key={x.ticker} type="button" onMouseDown={() => { commitTicker(x.ticker); setTFocus(false); }} className="flex w-full justify-between gap-2 px-3 py-2 text-left hover:bg-accent">
                    <span className="min-w-0 truncate"><span className="font-mono font-semibold">{x.ticker}</span> <span className="text-muted-foreground">{x.name}</span></span>
                    <span className="font-mono text-xs text-muted-foreground">{x.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Presets items={["OZON", "Новатэк"]} onPick={(v) => commitTicker(exactHit(v) || v)} />
        </label>
       </div>
      </div>

      {/* Scene */}
      <div className="flex flex-col pb-8 lg:flex-row">
        <div className="relative mb-4 h-[480px] p-2 lg:flex-1 md:h-[680px] md:p-4">
          {data && ideas.length > 0 ? (
            <FlightChart
              ideas={shown}
              yieldMin={data.yieldMin}
              yieldMax={data.yieldMax}
              zoneCounts={data.counts}
              onSelect={setSel}
              selectedId={sel?.id != null ? String(sel.id) : undefined}
              activeZone={zone}
              onZoneChange={(z) => setZone(zone === z ? null : z)}
            />
          ) : (
            <div className="map-bg flex h-full w-full items-center justify-center rounded-xl border text-sm text-muted-foreground">
              {isError ? "Не удалось загрузить данные. Попробуйте обновить страницу." : data ? "По выбранным фильтрам идей нет" : "Загружаем идеи…"}
            </div>
          )}
          {isFetching && data && <div className="pointer-events-none absolute right-6 top-4 font-mono text-[10px] text-muted-foreground">обновление…</div>}
          <div className="pointer-events-none absolute -bottom-3 left-4 flex flex-wrap gap-4 font-mono text-[10px] text-muted-foreground md:left-6">
            <span className="text-long">✈ лонг</span><span className="text-short">✈ шорт</span>
          </div>
          {sel && <Card idea={sel} onClose={() => setSel(null)} />}
        </div>
      </div>
      <Legend />

    </div>
  );
}

function Presets({ items, onPick }: { items: string[]; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((v) => (
        <button key={v} type="button" onClick={() => onPick(v)} className="rounded-full border bg-card px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground">{v}</button>
      ))}
    </div>
  );
}

function Status({ asOf, fetchedAt, isError }: { asOf?: string | undefined; fetchedAt: number; isError: boolean }) {
  if (!asOf) return <span className="font-mono text-[11px] text-muted-foreground">{isError ? "Источник недоступен" : "Загрузка…"}</span>;
  // asOf is a calendar day: treat it as fresh until the end of that day (UTC)
  const dayEnd = Date.parse(asOf.slice(0, 10)) + 86_400_000;
  const stale = isError || Date.now() - (asOf.includes("T") ? Date.parse(asOf) : dayEnd) > 86_400_000;
  const time = fetchedAt ? new Date(fetchedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";
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
    <details className="group mx-4 mb-10 rounded-xl border bg-card/60 md:mx-6">
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
          <span className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-short" />
          <div>
            <div className="text-xs font-semibold uppercase text-primary">LIVE в воздухе</div>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">Сколько сейчас активных идей с положительной доходностью.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Card({ idea: i, onClose }: { idea: Idea; onClose: () => void }) {
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
      className="fixed inset-x-2 bottom-2 z-30 rounded-xl border bg-popover/95 p-3 shadow-2xl backdrop-blur md:absolute md:inset-x-auto md:bottom-auto md:right-20 md:top-32 md:w-72 md:p-3"
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
        <span className="rounded-full px-1.5 py-px" style={{ color: `var(--z${z})`, border: `1px solid var(--z${z})` }}>{ZONES[z].name}</span>
        {i.status === "active" && <span className="rounded-full border border-long/60 px-1.5 py-px text-long">Активна</span>}
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
