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

/** «Максимальный апсайд»: active ideas in liftoff or cruise with a target; top by remaining upside (toTargetPct) */
export function topUpside(ideas: Idea[], n = 5): Idea[] {
  return ideas
    .filter((i) => i.status === "active" && !i.noTarget && i.toTargetPct != null && (i.stage === "liftoff" || i.stage === "cruise"))
    .sort((a, b) => (b.toTargetPct ?? 0) - (a.toTargetPct ?? 0))
    .slice(0, n);
}
