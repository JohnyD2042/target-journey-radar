import type { Idea, Stage } from "@/lib/ideas";
import { ideaTitle, inPeriod } from "@/lib/ideas";
import { topArrivals, topClimbers, topDarkHorses, topPredictable, topPunctual, topUpside } from "@/lib/boards";

const DAY = 86_400_000;
type Raw = Idea & { opened?: string | null; closed?: string | null };

export type FeedKind = "open" | "close" | "target" | "approach" | "win" | "loss" | "hero" | "stat" | "upside" | "start" | "surprise" | "expiring" | "near-target" | "short-record" | "weekly-win" | "weekly-loss" | "portfolio" | "no-target" | "predictable" | "punctual";
export interface FeedEvent {
  id: string;
  kind: FeedKind;
  text: string;
  idea?: Idea;
  ticker?: string;
  analyst?: string;
  count?: number;
  shortCount?: number;
  /** upside or result, shown at the right end of the line */ value?: string;
  /** company / instrument / portfolio name, shown at the left end */ name?: string;
  /** state of the idea: взлёт / в полёте / посадка / закрыта ... */ status?: string | undefined;
}

const plural = (k: number) => (k % 10 === 1 && k % 100 !== 11 ? "идея" : k % 10 >= 2 && k % 10 <= 4 && (k % 100 < 12 || k % 100 > 14) ? "идеи" : "идей");
const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}%`;
const age = (d: string | null | undefined, now: number) => (d ? Math.round((now - Date.parse(d.slice(0, 10))) / DAY) : Infinity);

/** state of an idea, worded like the map zones */
// only the four statuses the user named; other stages carry no status
const STAGE_STATUS: Partial<Record<Stage, string>> = { liftoff: "взлёт", cruise: "в полёте", approach: "посадка", landed: "достигли цели" };
function statusOf(i: Idea): string | undefined {
  if (i.status === "closed") return i.stage === "landed" ? "достигли цели" : "закрыта";
  return STAGE_STATUS[i.stage];
}

/** deterministic shuffle so the order looks random but is stable for one snapshot */
function shuffle<T>(list: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    const left = out[i];
    const right = out[j];
    if (left !== undefined && right !== undefined) [out[i], out[j]] = [right, left];
  }
  return out;
}

export function weeklySummary(ideas: Idea[], asOf: string) {
  const week = ideas.filter((i) => inPeriod(i, "week", asOf));
  const stocks = new Map(ideas.filter((i) => !i.basket && i.assetType === "stock").map((i) => [i.ticker, i.name]));
  const byStock = new Map<string, number>();
  const byAnalyst = new Map<string, number>();
  for (const i of week) {
    byAnalyst.set(i.analyst, (byAnalyst.get(i.analyst) ?? 0) + 1);
    const codes = i.basket ? i.ticker.split(/[,;\s]+/).filter(Boolean) : [i.ticker];
    for (const code of codes) if (stocks.has(code)) byStock.set(code, (byStock.get(code) ?? 0) + 1);
  }
  const rank = (entries: Map<string, number>) => [...entries].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const stock = rank(byStock);
  const analyst = rank(byAnalyst);
  return {
    count: week.length,
    shortCount: week.filter((i) => i.strategy === "шорт").length,
    stock: stock ? { ticker: stock[0], name: stocks.get(stock[0]) || stock[0], count: stock[1] } : undefined,
    analyst: analyst ? { name: analyst[0], count: analyst[1] } : undefined,
  };
}

/** Round-robin selection reserves room for each real scenario before filling extra slots. */
export function buildFeed(ideas: Idea[], asOf: string, n = 25): FeedEvent[] {
  const now = Date.parse(asOf.slice(0, 10));
  if (!Number.isFinite(now) || n <= 0) return [];
  const raw = ideas as Raw[];
  const active = raw.filter((i) => i.status === "active");
  const groups: FeedEvent[][] = [];
  const group = (list: FeedEvent[]) => { if (list.length) groups.push(list); };
  const event = (i: Idea, kind: FeedKind, text: string, value?: string): FeedEvent => ({
    id: `${kind}-${i.id}`, kind, idea: i, name: ideaTitle(i), status: statusOf(i), text,
    ...(value ? { value } : {}),
  });
  const yieldValue = (i: Idea) => `доходность ${pct(i.yieldPct)}`;
  const upsideValue = (i: Idea) => !i.noTarget && i.toTargetPct != null && Number.isFinite(i.toTargetPct)
    ? `апсайд ${pct(i.toTargetPct)}` : undefined;
  const recent = (date: string | null | undefined, days: number) => { const a = age(date, now); return a >= 0 && a <= days; };
  const byYield = (a: Idea, b: Idea) => b.yieldPct - a.yieldPct;
  const byDate = (a: Raw, b: Raw) => Date.parse(b.closed ?? b.opened ?? "") - Date.parse(a.closed ?? a.opened ?? "");

  group(raw.filter((i) => i.status === "active" && recent(i.opened, 1)).sort(byDate)
    .map((i) => {
      const initial = (i as Raw & { upsidePct?: number }).upsidePct;
      return event(i, "open", "новая идея за сутки", !i.noTarget && initial != null && Number.isFinite(initial) ? `апсайд ${pct(initial)}` : upsideValue(i));
    }));
  group(raw.filter((i) => i.status === "closed" && recent(i.closed, 1) && i.stage !== "landed").sort(byDate)
    .map((i) => event(i, "close", "закрытие за сутки", `результат ${pct(i.yieldPct)}`)));
  group(raw.filter((i) => i.status === "closed" && recent(i.closed, 1) && i.stage === "landed").sort(byDate)
    .map((i) => event(i, "target", "цель достигнута за сутки", `результат ${pct(i.yieldPct)}`)));
  group(active.filter((i) => i.stage === "approach").sort(byYield)
    .map((i) => event(i, "approach", "заход на посадку", yieldValue(i))));
  group(topUpside(ideas, 10).map((i) => event(i, "upside", "максимальный апсайд", upsideValue(i))));
  group(topClimbers(ideas, asOf, 10).map((c) => event(c.idea, "start", "бодрый старт", `темп ${pct(c.perDay)}/день`)));
  group([...active].filter((i) => i.yieldPct >= 30).sort(byYield)
    .map((i) => event(i, "win", "рекорд в воздухе", yieldValue(i))));
  group([...active].filter((i) => i.yieldPct <= -25).sort((a, b) => a.yieldPct - b.yieldPct)
    .map((i) => event(i, "loss", "турбулентность", yieldValue(i))));
  group(active.filter((i) => recent(i.opened, 7) && i.yieldPct > 0).sort(byYield)
    .map((i) => event(i, "surprise", "сюрприз недели", yieldValue(i))));
  group(active.filter((i) => i.strategy === "шорт" && i.yieldPct > 0).sort(byYield)
    .map((i) => event(i, "short-record", "лидер среди шортов", yieldValue(i))));
  const weekClosed = raw.filter((i) => i.status === "closed" && recent(i.closed, 7));
  group(weekClosed.filter((i) => i.yieldPct > 0).sort(byYield)
    .map((i) => event(i, "weekly-win", "успешное закрытие недели", `результат ${pct(i.yieldPct)}`)));
  group(weekClosed.filter((i) => i.yieldPct < 0).sort((a, b) => a.yieldPct - b.yieldPct)
    .map((i) => event(i, "weekly-loss", "убыточное закрытие недели", `результат ${pct(i.yieldPct)}`)));
  const arrivals = topArrivals(ideas, asOf, ideas.length);
  group(arrivals.filter((a) => a.reason === "expiring").map((a) => event(a.idea, "expiring", `срок истекает через ${a.days ?? 0} дн.`, yieldValue(a.idea))));
  group(arrivals.filter((a) => a.reason === "upside").map((a) => event(a.idea, "near-target", "до цели меньше 3%", upsideValue(a.idea))));
  group(active.filter((i) => i.basket && i.yieldPct > 0).sort(byYield)
    .map((i) => event(i, "portfolio", "портфель в плюсе", yieldValue(i))));
  group(active.filter((i) => i.noTarget && i.yieldPct > 0).sort(byYield)
    .map((i) => event(i, "no-target", "полёт без целевой цены", yieldValue(i))));
  group(topDarkHorses(ideas, asOf, 5).map((h) => ({
    id: `h${h.ticker}`, kind: "hero" as const, ticker: h.ticker, name: h.name || h.ticker,
    status: "герой", text: `новый герой ${h.count} ${plural(h.count)} за 60 дней`,
    ...(h.averageUpside != null ? { value: `средний апсайд ${pct(h.averageUpside)}` } : {}),
  })));
  group(topPredictable(ideas, 3).map((t) => ({
    id: `p${t.ticker}`, kind: "predictable" as const, ticker: t.ticker, name: t.name || t.ticker,
    text: `точность прогнозов ${t.positive} из ${t.total} идей в плюсе`,
  })));
  group(topPunctual(ideas, 3).map((a) => ({
    id: `analyst-${a.name}`, kind: "punctual" as const, analyst: a.name,
    text: `${a.name} ${a.onTarget} из ${a.total} идей у цели или на посадке`,
  })));
  const summary = weeklySummary(ideas, asOf);
  if (summary.count > 0) {
    group([{ id: "s-short", kind: "stat", count: summary.count, shortCount: summary.shortCount, text: `${summary.count} ${plural(summary.count)} за неделю, из них ${summary.shortCount} в шорт` }]);
    if (summary.stock) group([{ id: `s-${summary.stock.ticker}`, kind: "stat", ticker: summary.stock.ticker, count: summary.stock.count, text: `Самая популярная акция недели ${summary.stock.name}: ${summary.stock.count} ${plural(summary.stock.count)}` }]);
    if (summary.analyst) group([{ id: "s-analyst", kind: "stat", analyst: summary.analyst.name, count: summary.analyst.count, text: `Самый активный аналитик недели ${summary.analyst.name}: ${summary.analyst.count} ${plural(summary.analyst.count)}` }]);
  }

  const queues = groups.map((list) => [...list]);
  const out: FeedEvent[] = [];
  const used = new Set<Idea["id"]>();
  while (out.length < n) {
    let added = false;
    for (const queue of queues) {
      let next = queue.shift();
      while (next?.idea && used.has(next.idea.id)) next = queue.shift();
      if (!next) continue;
      if (next.idea) used.add(next.idea.id);
      out.push(next);
      added = true;
      if (out.length >= n) break;
    }
    if (!added) break;
  }
  // Shuffle stories, not the category selection: rankings and fresh-event priority stay meaningful.
  const pending = shuffle(out, asOf);
  const ordered: FeedEvent[] = [];
  while (pending.length) {
    const previous = ordered.at(-1);
    const different = pending.findIndex((e) => e.kind !== previous?.kind);
    const next = pending.splice(different < 0 ? 0 : different, 1)[0];
    if (next) ordered.push(next);
  }
  return ordered;
}
