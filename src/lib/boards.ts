import type { Idea } from "@/lib/ideas";

const DAY = 86_400_000;
type Raw = Idea & { opened?: string };

export interface Climber { idea: Idea; days: number; perDay: number }
/** One engine per rounded percentage point per day; every positive idea has at least one. */
export function thrustEngines(perDay: number): number {
  return Number.isFinite(perDay) && perDay > 0 ? Math.max(1, Math.round(perDay)) : 0;
}
/** «Набирают высоту»: active, opened within 30 days of asOf, yield > 0; top by yield per day of life */
export function topClimbers(ideas: Idea[], asOf: string, n = 5): Climber[] {
  const now = Date.parse(asOf.slice(0, 10));
  const out: Climber[] = [];
  for (const i of ideas as Raw[]) {
    if (i.status !== "active" || !(i.yieldPct > 0) || !i.opened) continue;
    if (!i.noTarget && !(i.capturedX < 0.5)) continue;
    const age = Math.round((now - Date.parse(i.opened.slice(0, 10))) / DAY);
    if (age < 0 || age > 30) continue;
    const days = Math.max(1, age);
    out.push({ idea: i, days, perDay: i.yieldPct / days });
  }
  return out.sort((a, b) => b.perDay - a.perDay).slice(0, n);
}

export interface Punctual { name: string; total: number; positive: number; onTarget: number; rate: number }
/** «Пунктуальность аналитиков»: authors with more than 3 ideas; rate = (landed + approach) / total */
export function topPunctual(ideas: Idea[], n = 5): Punctual[] {
  const m = new Map<string, Punctual>();
  for (const i of ideas) {
    const e = m.get(i.analyst) ?? { name: i.analyst, total: 0, positive: 0, onTarget: 0, rate: 0 };
    e.total++;
    if (i.yieldPct > 0) e.positive++;
    if (i.stage === "landed" || i.stage === "approach") e.onTarget++;
    m.set(i.analyst, e);
  }
  return [...m.values()]
    .filter((e) => e.total > 3)
    .map((e) => ({ ...e, rate: (e.onTarget / e.total) * 100 }))
    .sort((a, b) => b.rate - a.rate || b.total - a.total)
    .slice(0, n);
}

/** «Максимальный апсайд»: active ideas in liftoff or cruise with a target; one row per ticker — its highest-upside idea; top by remaining upside (toTargetPct) */
export function topUpside(ideas: Idea[], n = 5): Idea[] {
  const best = new Map<string, Idea>();
  for (const i of ideas) {
    if (i.status !== "active" || i.noTarget || i.toTargetPct == null || (i.stage !== "liftoff" && i.stage !== "cruise")) continue;
    const cur = best.get(i.ticker);
    if (!cur || (i.toTargetPct ?? 0) > (cur.toTargetPct ?? 0)) best.set(i.ticker, i);
  }
  return [...best.values()]
    .sort((a, b) => (b.toTargetPct ?? 0) - (a.toTargetPct ?? 0))
    .slice(0, n);
}

export interface DarkHorse { ticker: string; name: string; count: number; analysts: string[]; averageUpside: number | null }
/** Dormancy uses all openings; the recent count/authors use only currently active ideas. */
export function topDarkHorses(ideas: Idea[], asOf: string, n = 5): DarkHorse[] {
  const now = Date.parse(asOf.slice(0, 10));
  if (!Number.isFinite(now)) return [];
  const dormantBlock = new Set<string>();
  const recent = new Map<string, { name: string; ideas: Map<Idea["id"], Idea> }>();
  for (const i of ideas as Raw[]) {
    if (!i.opened) continue;
    const age = (now - Date.parse(i.opened.slice(0, 10))) / DAY;
    if (!Number.isFinite(age) || age < 0 || age > 150) continue;
    const tickers = [...new Set((i.basket ? i.ticker.split(/[,;\s]+/) : [i.ticker]).map((t) => t.trim()).filter(Boolean))];
    for (const ticker of tickers) {
      if (age > 60) { dormantBlock.add(ticker); continue; }
      if (i.status !== "active") continue;
      const entry = recent.get(ticker) ?? { name: "", ideas: new Map<Idea["id"], Idea>() };
      if (!i.basket && !entry.name) entry.name = i.name;
      entry.ideas.set(i.id, i);
      recent.set(ticker, entry);
    }
  }
  return [...recent.entries()]
    .filter(([ticker]) => !dormantBlock.has(ticker))
    .map(([ticker, entry]) => {
      const active = [...entry.ideas.values()];
      const upside = active.filter((i) => !i.noTarget && i.target != null && i.toTargetPct != null && Number.isFinite(i.toTargetPct));
      return {
        ticker, name: entry.name, count: active.length,
        analysts: [...new Set(active.map((i) => i.analyst))],
        averageUpside: upside.length ? upside.reduce((sum, i) => sum + (i.toTargetPct ?? 0), 0) / upside.length : null,
      };
    })
    .sort((a, b) => b.count - a.count || (b.averageUpside ?? -Infinity) - (a.averageUpside ?? -Infinity) || a.ticker.localeCompare(b.ticker))
    .slice(0, n);
}

export interface Predictable { ticker: string; name: string; total: number; positive: number; rate: number; averageYield: number }
/** «КПД аналитики»: tickers with ≥ 3 ideas of any status (basket ideas count for each ticker inside); rate = share with yield > 0 */
export function topPredictable(ideas: Idea[], n = 5): Predictable[] {
  const m = new Map<string, { name: string; list: Idea[] }>();
  for (const i of ideas) {
    const tickers = [...new Set((i.basket ? i.ticker.split(/[,;\s]+/) : [i.ticker]).map((t) => t.trim()).filter(Boolean))];
    for (const t of tickers) {
      const e = m.get(t) ?? { name: "", list: [] };
      if (!i.basket && !e.name) e.name = i.name;
      e.list.push(i);
      m.set(t, e);
    }
  }
  return [...m.entries()]
    .filter(([, e]) => e.list.length >= 3)
    .map(([ticker, e]) => {
      const positive = e.list.filter((i) => i.yieldPct > 0).length;
      return { ticker, name: e.name, total: e.list.length, positive, rate: (positive / e.list.length) * 100, averageYield: e.list.reduce((s, i) => s + i.yieldPct, 0) / e.list.length };
    })
    .sort((a, b) => b.rate - a.rate || b.total - a.total || b.averageYield - a.averageYield || a.ticker.localeCompare(b.ticker))
    .slice(0, n);
}

export type ArrivalReason = "landing" | "upside" | "expiring" | "stoploss";
export interface Arrival { idea: Idea; reason: ArrivalReason; days?: number }
/** «Прибытие»: active ideas only; priority landing (approach) → nearest expectedEnd (0–2 days) → yield < −20% (stop-loss proxy, the API has no stop level) → upside < 3%; first n rows */
export function topArrivals(ideas: Idea[], asOf: string, n = 10): Arrival[] {
  const now = Date.parse(asOf.slice(0, 10));
  const active = ideas.filter((i) => i.status === "active");
  const out: Arrival[] = [];
  const seen = new Set<Idea["id"]>();
  const add = (list: Arrival[]) => { for (const a of list) { if (out.length >= n) return; if (seen.has(a.idea.id)) continue; seen.add(a.idea.id); out.push(a); } };
  add(active.filter((i) => i.stage === "approach").map((idea) => ({ idea, reason: "landing" as const })));
  add(active.flatMap((idea) => {
    const end = (idea as Idea & { expectedEnd?: string | null }).expectedEnd;
    if (!end || !Number.isFinite(now)) return [];
    const days = Math.round((Date.parse(end.slice(0, 10)) - now) / DAY);
    return days >= 0 && days <= 2 ? [{ idea, reason: "expiring" as const, days }] : [];
  }).sort((a, b) => a.days - b.days));
  add(active.filter((i) => i.yieldPct < -20).sort((a, b) => a.yieldPct - b.yieldPct).map((idea) => ({ idea, reason: "stoploss" as const })));
  add(active.filter((i) => !i.noTarget && i.toTargetPct != null && i.toTargetPct >= 0 && i.toTargetPct < 3)
    .sort((a, b) => (a.toTargetPct ?? 0) - (b.toTargetPct ?? 0)).map((idea) => ({ idea, reason: "upside" as const })));
  return out;
}
