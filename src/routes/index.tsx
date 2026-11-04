import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FlightChart } from "@/components/FlightChart";
import { SideTag, IdeaPath } from "@/components/IdeaPath";
import { IDEAS, TODAY, ZONES, type Idea, type Zone, ret, upside, zoneOf } from "@/lib/ideas";

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

type Period = "all" | "month" | "week";
type Book = "active" | "closed" | "all";
const PERIODS: [Period, string][] = [["all", "За всё время"], ["month", "Месяц"], ["week", "Неделя"]];
const BOOKS: [Book, string][] = [["active", "Активные"], ["closed", "Закрытые"], ["all", "Все"]];

const inPeriod = (i: Idea, p: Period) =>
  p === "all" || TODAY.getTime() - new Date(i.openDate).getTime() <= (p === "month" ? 30 : 7) * 864e5;
const inBook = (i: Idea, b: Book) => b === "all" || i.status === b;
const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
const date = (s: string) => new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
const money = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 1 });

function Seg<T extends string>({ items, value, onChange, counts }: { items: [T, string][]; value: T; onChange: (v: T) => void; counts: Record<T, number> }) {
  return (
    <div className="flex rounded-md border bg-card p-0.5 text-sm">
      {items.map(([k, l]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`flex-1 whitespace-nowrap rounded px-3 py-1.5 transition-colors ${value === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {l} <span className="ml-1 font-mono text-[11px] opacity-70">{counts[k]}</span>
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
  const [zone, setZone] = useState<Zone | "notarget" | null>(null);
  const [sel, setSel] = useState<Idea | null>(null);

  const byPeriod = IDEAS.filter((i) => inPeriod(i, period));
  const [tq, setTq] = useState("");
  const tqn = tq.trim().toLowerCase();
  const byTicker = (i: Idea) => !tqn || i.ticker.toLowerCase().includes(tqn) || i.name.toLowerCase().includes(tqn);
  const byAnalyst = byPeriod.filter((i) => (!analyst || i.analyst === analyst) && byTicker(i));
  const shown = useMemo(
    () => byAnalyst.filter((i) => inBook(i, book) && (!zone || (zone === "notarget" ? i.target == null : zoneOf(i) === zone))),
    [period, book, analyst, zone, tqn],
  );

  const periodCounts = Object.fromEntries(PERIODS.map(([p]) => [p, IDEAS.filter((i) => inPeriod(i, p) && inBook(i, book) && (!analyst || i.analyst === analyst) && byTicker(i)).length])) as Record<Period, number>;
  const bookCounts = Object.fromEntries(BOOKS.map(([b]) => [b, byAnalyst.filter((i) => inBook(i, b)).length])) as Record<Book, number>;

  const analysts = useMemo(() => {
    const m = new Map<string, number>();
    byPeriod.forEach((i) => m.set(i.analyst, (m.get(i.analyst) ?? 0) + 1));
    return [...m].filter(([a]) => a.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b[1] - a[1]);
  }, [period, q]);

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded bg-primary font-mono text-sm font-bold text-primary-foreground">✈</div>
          <div>
            <h1 className="text-lg font-semibold leading-none tracking-tight">Монитор полётов</h1>
            <p className="mt-1 text-xs text-muted-foreground">Инвестидеи аналитиков на маршруте к целевой цене</p>
          </div>
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">
          Источник: база Invest-Idei · Срез {date(TODAY.toISOString())} · 11:00
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-3 px-4 py-3 md:px-6">
       <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Дата старта идей</span>
          <Seg items={PERIODS} value={period} onChange={setPeriod} counts={periodCounts} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Статус</span>
          <Seg items={BOOKS} value={book} onChange={setBook} counts={bookCounts} />
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
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover text-sm shadow-xl">
              <button onMouseDown={() => { setAnalyst(null); setQ(""); }} className="flex w-full justify-between px-3 py-2 text-left text-muted-foreground hover:bg-accent">Все аналитики</button>
              {analysts.map(([a, n]) => (
                <button key={a} onMouseDown={() => { setAnalyst(a); setQ(""); }} className="flex w-full justify-between px-3 py-2 text-left hover:bg-accent">
                  {a} <span className="font-mono text-xs text-muted-foreground">{n}</span>
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
              placeholder="Тикер или название…"
              className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            {tq && <button onClick={() => setTq("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground" aria-label="Очистить">✕</button>}
          </div>
        </label>
       </div>
      </div>

      {/* Scene */}
      <div className="flex flex-col pb-8 lg:flex-row">
        <div className="relative mb-4 h-[480px] p-2 lg:flex-1 md:h-[680px] md:p-4">
          <FlightChart ideas={shown} onSelect={setSel} selectedId={sel?.id} activeZone={zone} onZoneChange={(z) => setZone(zone === z ? null : z)} />
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
  const r = ret(i);
  const u = upside(i);
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
        <Col k="Вход" v={money(i.openPrice)} sub={date(i.openDate)} align="items-start text-left" />
        <Col
          k={i.status === "active" ? "Сейчас" : "Закрытие"}
          v={money(i.price)}
          sub={<span className={r >= 0 ? "text-long" : "text-short"}>{pct(r)}</span>}
          align="items-center text-center"
        />
        <Col
          k="Цель"
          v={i.target != null ? money(i.target) : "—"}
          sub={i.target != null ? `${u != null && u > 0 ? `${pct(u)} · ` : ""}${i.targetDate ? date(i.targetDate) : ""}` : "—"}
          align="items-end text-right"
        />
      </div>
      {!!i.drivers?.length && (
        <div className="mt-2 border-t border-dashed pt-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Драйверы роста</div>
          <ul className="mt-1 space-y-0.5 text-[11px]">
            {i.drivers.map((d) => (
              <li key={d} className="flex gap-1.5"><span className="text-long">•</span>{d}</li>
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
