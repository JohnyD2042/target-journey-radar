import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FlightChart } from "@/components/FlightChart";
import { SideTag, IdeaPath } from "@/components/IdeaPath";
import { WindowMark } from "@/components/WindowMark";
import { ZONES, fetchFlight, zoneOf, type Book, type Idea, type Period, type Zone } from "@/lib/ideas";

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
const BOOKS: [Book, string][] = [["active", "Активные"], ["closed", "Закрытые"], ["all", "Все"]];
const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
const isoLabel = (s: string) => s ? new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";
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
  const [book, setBook] = useState<Book>("active");
  const [analyst, setAnalyst] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [tq, setTq] = useState("");
  const [tFocus, setTFocus] = useState(false);
  const [zone, setZone] = useState<Zone | null>(null);
  const [sel, setSel] = useState<Idea | null>(null);

  // the API is asked only after an exact instrument is chosen: list click, Enter, or an exactly typed ticker/name
  const [ticker, setTicker] = useState("");
  const commitTicker = (v: string) => { setTq(v); setTicker(v.trim()); };
  const filters = { period, book, analyst: analyst ?? "", ticker };
  const { data, isError, isFetching } = useQuery({
    queryKey: ["flight", filters],
    queryFn: () => fetchFlight(filters),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

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
        <div className="font-mono text-[11px] text-muted-foreground">
          {data ? <>Источник: база Invest-Idei · Период {isoLabel(data.from)} — {isoLabel(data.to)}</> : isError ? "Источник недоступен" : "Загрузка…"}
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
              onBlur={() => setTimeout(() => { setTFocus(false); const hit = exactHit(tq); if (hit) commitTicker(hit); }, 150)}
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

    </div>
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
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-base font-semibold leading-none">{i.ticker}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{i.name}</span>
            <SideTag idea={i} />
          </div>
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
        <span className="rounded-full border px-1.5 py-px text-muted-foreground">{i.status === "active" ? "Активна" : "Закрыта"}</span>
      </div>
    </aside>
  );
}
