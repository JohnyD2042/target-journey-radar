import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FlightChart } from "@/components/FlightChart";
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
  const byAnalyst = byPeriod.filter((i) => !analyst || i.analyst === analyst);
  const shown = useMemo(
    () => byAnalyst.filter((i) => inBook(i, book) && (!zone || (zone === "notarget" ? i.target == null : zoneOf(i) === zone))),
    [period, book, analyst, zone],
  );

  const periodCounts = Object.fromEntries(PERIODS.map(([p]) => [p, IDEAS.filter((i) => inPeriod(i, p) && inBook(i, book) && (!analyst || i.analyst === analyst)).length])) as Record<Period, number>;
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
          Источник: база Invest-Idei · срез {date(TODAY.toISOString())} · по дате открытия {period === "all" ? "с 01.06.26" : period === "month" ? "за 30 дней" : "за 7 дней"}
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:px-6">
        <Seg items={PERIODS} value={period} onChange={setPeriod} counts={periodCounts} />
        <Seg items={BOOKS} value={book} onChange={setBook} counts={bookCounts} />
        <div className="relative md:w-72">
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

      {/* Scene */}
      <div className="flex flex-col pb-8 lg:flex-row">
        <div className="relative mb-4 h-[480px] p-2 lg:flex-1 md:h-[680px] md:p-4">
          <FlightChart ideas={shown} onSelect={setSel} selectedId={sel?.id} activeZone={zone} onZoneChange={(z) => setZone(zone === z ? null : z)} />
          <div className="pointer-events-none absolute -bottom-3 left-4 flex flex-wrap gap-4 font-mono text-[10px] text-muted-foreground md:left-6">
            <span className="text-long">✈ лонг</span><span className="text-short">✈ шорт</span><span>бледный — закрыта</span>
          </div>
        </div>
        {sel && <Card idea={sel} onClose={() => setSel(null)} />}
      </div>

    </div>
  );
}


function Card({ idea: i, onClose }: { idea: Idea; onClose: () => void }) {
  const z = zoneOf(i), r = ret(i), u = upside(i);
  const Row = ({ k, v, cls = "" }: { k: string; v: React.ReactNode; cls?: string }) => (
    <div className="flex justify-between border-b border-dashed py-2 text-sm"><span className="text-muted-foreground">{k}</span><span className={`font-mono ${cls}`}>{v}</span></div>
  );
  return (
    <aside className="fixed inset-x-0 bottom-0 z-30 max-h-[80vh] overflow-y-auto rounded-t-xl border-t bg-popover p-5 shadow-2xl lg:static lg:w-80 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xl font-semibold">{i.ticker}</span>
            <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase ${i.side === "long" ? "bg-long/15 text-long" : "bg-short/15 text-short"}`}>{i.side === "long" ? "лонг" : "шорт"}</span>
          </div>
          <div className="text-sm text-muted-foreground">{i.name}</div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Закрыть">✕</button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className="rounded-full px-2 py-0.5" style={{ color: `var(--z${z})`, border: `1px solid var(--z${z})` }}>{ZONES[z].name}</span>
        <span className={`rounded-full border px-2 py-0.5 ${i.status === "active" ? "text-foreground" : "text-muted-foreground"}`}>{i.status === "active" ? "Активна" : "Закрыта"}</span>
      </div>
      <div className="mt-4">
        <Row k="Аналитик" v={<span className="font-sans">{i.analyst}</span>} />
        <Row k="Открытие" v={`${money(i.openPrice)} · ${date(i.openDate)}`} />
        <Row k={i.status === "active" ? "Текущая цена" : "Цена закрытия"} v={money(i.price)} />
        <Row k="Доходность" v={pct(r)} cls={r >= 0 ? "text-long" : "text-short"} />
        <Row k="Целевая цена" v={i.target != null ? money(i.target) : "цели нет"} />
        {i.status === "active" && <Row k="До цели / апсайд" v={u != null ? pct(u) : "цели нет"} />}
      </div>
      {i.target == null && <p className="mt-3 text-xs text-primary">Идея без целевой цены — стоит на отметке 0,5x.</p>}
      <p className="mt-4 font-mono text-[10px] text-muted-foreground">{i.id} · Invest-Idei</p>
    </aside>
  );
}
