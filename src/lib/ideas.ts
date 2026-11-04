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

export const ZONES: Record<Zone, { name: string; short: string; hint: string }> = {
  1: { name: "Не завелись", short: "На земле", hint: "доходность ниже нуля" },
  2: { name: "Взлёт", short: "0 → 0,2x", hint: "до 20% пути" },
  3: { name: "В полёте", short: "0,2x → 0,8x", hint: "20–80% пути" },
  4: { name: "Посадка", short: "0,8x → 1x", hint: "больше 80%" },
  5: { name: "Достигли цели", short: "1X Цель", hint: "закрыты по цели" },
};
