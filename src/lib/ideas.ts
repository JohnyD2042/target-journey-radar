export type Zone = 1 | 2 | 3 | 4 | 5;
export type Stage = "cold" | "liftoff" | "cruise" | "approach" | "landed";
export type Period = "all" | "month" | "week";
export type Book = "active" | "closed" | "all";

/** Idea as returned by the flight API — all metrics are computed server-side. */
export interface Idea {
  id: number | string;
  ticker: string;
  name: string;
  analyst: string;
  strategy: "лонг" | "шорт";
  status: "active" | "closed";
  openedLabel: string;
  closedLabel?: string | null;
  expectedEndLabel?: string | null;
  start: number;
  current: number;
  target: number | null;
  yieldPct: number;
  toTargetPct: number | null;
  noTarget: boolean;
  capturedX: number;
  stage: Stage;
  /** portfolio idea: one plane, one bet, several tickers inside the ticker string */
  basket?: boolean;
  /** portfolio idea title; a single-ticker idea is described by name */
  title?: string;
  /** instrument type from the API: stock, etf, futures_commodities, index, ... */
  assetType?: string;
  drivers?: string[];
  url?: string | null;
}

export interface FlightResponse {
  asOf: string;
  from: string;
  to: string;
  yieldMin: number;
  yieldMax: number;
  counts: Record<Book | Stage, number>;
  periods: Record<Period, number>;
  analysts: { name: string; count: number }[];
  instruments: { ticker: string; name: string; count: number }[];
  /** ideas per instrument type (filled locally) */
  kinds?: Record<Kind, number>;
  ideas: Idea[];
}

export const API_URL = "https://web-production-d1c75.up.railway.app/flight";

export function flightUrl(f: { period: Period; book: Book; analyst: string; ticker: string }) {
  return `${API_URL}?period=${f.period}&book=${f.book}&analyst=${encodeURIComponent(f.analyst)}&ticker=${encodeURIComponent(f.ticker)}`;
}

export async function fetchFlight(f: { period: Period; book: Book; analyst: string; ticker: string }): Promise<FlightResponse> {
  // the API sometimes hangs; give up after 30s so the page shows an error instead of endless loading
  const res = await fetch(flightUrl(f), { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export const STAGE_ZONE: Record<Stage, Zone> = { cold: 1, liftoff: 2, cruise: 3, approach: 4, landed: 5 };
export const ZONE_STAGE: Record<Zone, Stage> = { 1: "cold", 2: "liftoff", 3: "cruise", 4: "approach", 5: "landed" };
export const zoneOf = (i: Idea): Zone => STAGE_ZONE[i.stage] ?? 1;
export const isLong = (i: Idea) => i.strategy === "лонг";
/** portfolio idea: one plane, one bet, several tickers inside the ticker string */
export const isBasket = (i: Idea) => i.basket === true;
/** line under the tickers: portfolio ideas carry their title, single ideas their name */
export const ideaTitle = (i: Idea) => (isBasket(i) ? (i.title ?? i.name) : i.name);
/** LIVE in the air: active ideas currently showing a positive yield */
export const liveInAir = (ideas: Idea[]) =>
  ideas.reduce((n, i) => n + (i.status === "active" && i.yieldPct > 0 ? 1 : 0), 0);

/**
 * Show an API date (YYYY-MM-DD) as DD.MM.YY. The day is taken from the string itself,
 * so a viewer west of UTC (e.g. Buenos Aires) never sees yesterday's date.
 */
export function isoLabel(s: string): string {
  const [, y, mo, d] = /^(\d{4})-(\d{2})-(\d{2})/.exec(s) ?? [];
  if (y && mo && d) return `${d}.${mo}.${y.slice(2)}`;
  const t = new Date(s);
  return isNaN(t.getTime()) ? "" : t.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" });
}

export const ZONES: Record<Zone, { name: string; short: string; hint: string }> = {
  1: { name: "Не завелись", short: "На земле", hint: "доходность ниже нуля" },
  2: { name: "Взлёт", short: "0 → 0,2x", hint: "до 20% пути" },
  3: { name: "В полёте", short: "0,2x → 0,8x", hint: "20–80% пути" },
  4: { name: "Посадка", short: "0,8x → 1x", hint: "больше 80%" },
  5: { name: "Достигли цели", short: "1X Цель", hint: "закрыты по цели" },
};

export type Kind = "stock" | "etf" | "futures";
export const KINDS: [Kind, string][] = [["stock", "Акции"], ["etf", "БПИФ"], ["futures", "Фьючерсы"]];
export const kindOf = (i: Idea): Kind | null =>
  i.assetType === "stock" ? "stock" : i.assetType === "etf" ? "etf" : i.assetType?.startsWith("futures") ? "futures" : null;
export interface Filters { period: Period; book: Book; analyst: string; ticker: string; kind?: Kind | "" }
type RawIdea = Idea & { opened?: string };

const DAY = 86_400_000;
const PERIOD_DAYS: Record<Period, number> = { all: Infinity, month: 30, week: 7 };

export function inPeriod(i: RawIdea, p: Period, asOf: string) {
  if (p === "all") return true;
  if (!i.opened) return false;
  const days = (Date.parse(asOf) - Date.parse(i.opened)) / DAY;
  return days <= PERIOD_DAYS[p];
}
const inBook = (i: Idea, b: Book) => b === "all" || i.status === b;
const byAnalyst = (i: Idea, a: string) => !a || i.analyst === a;
function byTicker(i: RawIdea, t: string) {
  const q = t.trim().toLowerCase();
  if (!q) return true;
  return i.ticker.toLowerCase().includes(q) || i.name.toLowerCase().includes(q) || (i.title ?? "").toLowerCase().includes(q);
}

/** Apply all filters locally to the full dataset fetched once; counters are tallies of the filtered set. */
export function applyFilters(all: FlightResponse, f: Filters): FlightResponse {
  const src = all.ideas as RawIdea[];
  const ok = (i: RawIdea, skip?: keyof Filters) =>
    (skip === "period" || inPeriod(i, f.period, all.asOf)) &&
    (skip === "book" || inBook(i, f.book)) &&
    (skip === "analyst" || byAnalyst(i, f.analyst)) &&
    (skip === "ticker" || byTicker(i, f.ticker)) &&
    (skip === "kind" || !f.kind || kindOf(i) === f.kind);

  const ideas = src.filter((i) => ok(i));
  const periods: Record<Period, number> = { all: 0, month: 0, week: 0 };
  const counts = { all: 0, active: 0, closed: 0, cold: 0, liftoff: 0, cruise: 0, approach: 0, landed: 0 } as Record<Book | Stage, number>;
  const an = new Map<string, number>();
  const ins = new Map<string, { ticker: string; name: string; count: number }>();
  const kinds: Record<Kind, number> = { stock: 0, etf: 0, futures: 0 };
  for (const i of src) {
    if (ok(i, "kind")) { const k = kindOf(i); if (k) kinds[k]++; }
    if (ok(i, "period")) for (const p of ["all", "month", "week"] as Period[]) if (inPeriod(i, p, all.asOf)) periods[p]++;
    if (ok(i, "book")) { counts.all++; counts[i.status]++; }
    if (ok(i, "analyst")) an.set(i.analyst, (an.get(i.analyst) ?? 0) + 1);
    if (ok(i, "ticker")) {
      // portfolio ideas are not listed as their own row: each ticker inside counts towards that stock
      const basket = i.basket === true;
      const tks = basket ? i.ticker.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean) : [i.ticker];
      for (const t of tks) {
        const e = ins.get(t) ?? { ticker: t, name: basket ? "" : i.name, count: 0 };
        if (!basket && !e.name) e.name = i.name;
        e.count++; ins.set(t, e);
      }
    }
  }
  for (const i of ideas) counts[i.stage]++;
  return {
    ...all,
    counts,
    periods,
    analysts: [...an].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    instruments: [...ins.values()].sort((a, b) => b.count - a.count || a.ticker.localeCompare(b.ticker)),
    kinds,
    ideas,
  };
}
